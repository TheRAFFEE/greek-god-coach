import { test } from "node:test";
import * as assert from "node:assert/strict";
import { evaluateGoalTracking, progressionGoalTrackingSummary } from "./goal-tracking-engine";
import { goalTrackingSnapshotFromResult } from "./progression-engine";
import type { BodyMetric, NutritionLog, RunLog, WorkoutSession } from "./types";

const goals = {
  startWeight: 233,
  targetWeight: 199.9,
  targetRaceDate: "2027-01-17",
  targetRaceDistance: 13.1,
  targetRaceFinishMinutes: 118,
  targetRacePaceSecondsPerMile: 540,
  physiqueGoalName: "Greek God physique",
};

function metric(date: string, weight: number, waist?: number): BodyMetric {
  return { id: `metric-${date}`, userId: "u1", date, weight, waist };
}

function datedMetrics(weights: number[], start = "2026-06-01", waistStart = 40, waistStep = -0.05): BodyMetric[] {
  const startDate = new Date(`${start}T00:00:00Z`);
  return weights.map((weight, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    return metric(date.toISOString().slice(0, 10), weight, Number((waistStart + index * waistStep).toFixed(1)));
  });
}

function nutritionLog(date: string, protein = 220, calories = 2400): NutritionLog {
  return { id: `nutrition-${date}`, userId: "u1", date, calories, protein, carbs: 220, fat: 70, fiber: 35, sodium: 2500, water: 120, alcohol: 0, notes: "" };
}

function nutritionLogs(count: number, protein = 220): NutritionLog[] {
  return datedMetrics(Array.from({ length: count }, () => 233)).map((entry) => nutritionLog(entry.date, protein));
}

function workoutSession(date: string, status: WorkoutSession["status"] = "completed", rpe = 7, missed = false): WorkoutSession {
  return {
    id: `session-${date}`,
    userId: "u1",
    workoutId: `workout-${date}`,
    workoutTitle: "Upper",
    mode: "coach",
    startedAt: `${date}T12:00:00.000Z`,
    endedAt: `${date}T13:00:00.000Z`,
    status,
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    setLogs: [
      { id: `set-${date}-1`, sessionId: `session-${date}`, userId: "u1", workoutId: `workout-${date}`, exerciseId: "bench", exerciseName: "Bench Press", setNumber: 1, targetReps: "8", targetRpe: 8, weightUsed: 185, repsCompleted: missed ? 5 : 8, rpe, pain: false, formQuality: missed ? "missed" : "solid", completedAt: `${date}T12:30:00.000Z` },
      { id: `set-${date}-2`, sessionId: `session-${date}`, userId: "u1", workoutId: `workout-${date}`, exerciseId: "row", exerciseName: "Row", setNumber: 1, targetReps: "10", targetRpe: 8, weightUsed: 155, repsCompleted: missed ? 6 : 10, rpe, pain: false, formQuality: missed ? "missed" : "solid", completedAt: `${date}T12:40:00.000Z` },
    ],
  };
}

function run(date: string, pace = 540, completed = true, painScore = 0, distance = 6): RunLog {
  return { id: `run-${date}`, userId: "u1", date, runType: distance >= 6 ? "long run" : "easy", plannedDistance: distance, actualDistance: completed ? distance : Math.max(0, distance - 2), durationMinutes: Math.round((pace * distance) / 60), averagePace: pace / 60, averageHr: 145, maxHr: 165, rpe: 6, zone2Compliance: 85, completed, walkBreaks: false, pain: painScore > 0, painScore, painLocation: "", notes: "" };
}

function baseInput(overrides: Parameters<typeof evaluateGoalTracking>[0] = {}) {
  return {
    evaluationDate: "2026-06-21",
    goals,
    bodyMetrics: datedMetrics([233, 232.8, 232.5, 232.2, 231.9, 231.6, 231.3, 231.0, 230.7, 230.4, 230.1, 229.8, 229.5, 229.2]),
    nutritionAdherence: { macroAdherence: 90, proteinAdherence: 92, loggingConsistency: 100, caloriesAdherence: 90, confidence: "High" as const },
    nutritionLogs: nutritionLogs(7),
    workoutSessions: [workoutSession("2026-06-15"), workoutSession("2026-06-17"), workoutSession("2026-06-19")],
    workoutSummary: { overallDecision: "Progress" as const, strengthProgression: { action: "Progress" as const, estimatedOneRepMaxTrend: "improving" as const, exercisesProgressing: ["Bench"], exercisesStalled: [], exercisesRegressing: [], recommendation: "progress", reason: "clean" }, prs: { newPrs: [{ id: "pr1" }] }, fatigue: { fatigueStatus: "low" as const, systemicFatigueScore: 15 }, confidenceScore: 90, dataQualityScore: 90 },
    runLogs: [run("2026-06-16", 545, true, 0, 4), run("2026-06-20", 540, true, 0, 7)],
    runningEngineResult: runningResult({ paceGap: 10, injuryRisk: 15, longRunStatus: "strong", runningConsistency: 90 }),
    progressionEngineResult: { weeklyDecision: "Progress" as const, nutritionDecision: "Maintain Calories" as const, goalStatus: { "Fat Loss": "On Track" as const, Physique: "On Track" as const, Strength: "On Track" as const, "Half Marathon": "On Track" as const }, confidence: "High" as const, dataQuality: { score: 90, confidence: "High" as const, missingInputs: [], penalties: [], warnings: [] }, reasons: ["clean week"], warnings: [], auditEntries: [] },
    ...overrides,
  };
}

function runningResult(input: { paceGap?: number | null; finishMinutes?: number | null; injuryRisk?: number; longRunStatus?: "strong" | "adequate" | "watch" | "problem" | "unknown"; runningConsistency?: number }) {
  const paceGap = input.paceGap ?? 0;
  return {
    prediction: { predictedFinishMinutes: input.finishMinutes ?? 118 + paceGap * 13.1 / 60, predictedPaceSecondsPerMile: paceGap === null ? null : 540 + paceGap, targetPaceGapSecondsPerMile: paceGap, targetFinishGapMinutes: paceGap === null ? null : paceGap * 13.1 / 60 },
    readiness: { injuryRiskScore: input.injuryRisk ?? 10, raceReadinessScore: paceGap <= 15 ? 88 : paceGap <= 45 ? 68 : 35, status: "Green" as const, score: 85, reasons: [], blockers: [], confidence: "High" as const },
    fitnessProfile: { runningConsistency: input.runningConsistency ?? 90, weeklyMileage: 18, rolling7DayMileage: 18, longestRecentRunMiles: 7, longRunCompletionRate: input.longRunStatus === "problem" ? 40 : 100, paceTrend: "stable" as const, heartRateTrend: "stable" as const, rpeTrend: "stable" as const, painTrend: "stable" as const },
    longRunStatus: { status: input.longRunStatus ?? "strong", value: "7 mi", target: "6 mi", reason: "long run completed" },
    weeklyMileageStatus: { status: "adequate" as const, value: "18 mi", target: "18 mi", reason: "mileage adequate" },
    progression: { action: "Progress" as const, reason: "running can progress" },
    confidence: "High" as const,
    confidenceScore: 90,
    dataQualityScore: 90,
  };
}

test("Fat loss On Track", () => {
  const result = evaluateGoalTracking(baseInput());
  assert.equal(result.goals.fatLoss.status, "On Track");
  assert.ok(result.goals.fatLoss.score >= 80);
});

test("Fat loss At Risk from plateau with good adherence", () => {
  const result = evaluateGoalTracking(baseInput({ bodyMetrics: datedMetrics(Array.from({ length: 14 }, () => 231)), nutritionAdherence: { macroAdherence: 92, proteinAdherence: 92, loggingConsistency: 100, caloriesAdherence: 90, confidence: "High" } }));
  assert.equal(result.goals.fatLoss.status, "At Risk");
  assert.match(result.goals.fatLoss.explanation, /plateau/i);
});

test("Fat loss Off Track from gaining trend", () => {
  const result = evaluateGoalTracking(baseInput({ bodyMetrics: datedMetrics([231, 231.2, 231.4, 231.6, 231.8, 232, 232.2, 232.4, 232.6, 232.8, 233, 233.2, 233.4, 233.6]) }));
  assert.equal(result.goals.fatLoss.status, "Off Track");
});

test("Fat loss Insufficient Data", () => {
  const result = evaluateGoalTracking(baseInput({ bodyMetrics: [metric("2026-06-21", 231)] }));
  assert.equal(result.goals.fatLoss.status, "Insufficient Data");
  assert.equal(result.goals.fatLoss.confidence, "Low");
});

test("Physique On Track from weight and waist down plus protein and workouts good", () => {
  const result = evaluateGoalTracking(baseInput());
  assert.equal(result.goals.physique.status, "On Track");
  assert.match(result.goals.physique.explanation, /proxy/i);
});

test("Physique At Risk from protein and workout adherence poor", () => {
  const result = evaluateGoalTracking(baseInput({ nutritionAdherence: { macroAdherence: 65, proteinAdherence: 55, loggingConsistency: 70, caloriesAdherence: 80, confidence: "Medium" }, workoutSessions: [workoutSession("2026-06-15")] }));
  assert.equal(result.goals.physique.status, "At Risk");
});

test("Strength On Track from consistent workouts and progression", () => {
  const result = evaluateGoalTracking(baseInput());
  assert.equal(result.goals.strength.status, "On Track");
  assert.equal(result.goals.strength.trend, "progressing");
});

test("Strength At Risk from high RPE and missed reps", () => {
  const result = evaluateGoalTracking(baseInput({ workoutSessions: [workoutSession("2026-06-15", "completed", 9, true), workoutSession("2026-06-17", "completed", 9, true)] }));
  assert.equal(result.goals.strength.status, "At Risk");
  assert.ok(result.goals.strength.blockers.some((item) => /RPE|missed/i.test(item)));
});

test("Strength Insufficient Data", () => {
  const result = evaluateGoalTracking(baseInput({ workoutSessions: [workoutSession("2026-06-15")] , workoutSummary: undefined }));
  assert.equal(result.goals.strength.status, "Insufficient Data");
});

test("Half marathon On Track from Running Engine V2 prediction near 9:00 pace", () => {
  const result = evaluateGoalTracking(baseInput({ runningEngineResult: runningResult({ paceGap: 10, injuryRisk: 15, longRunStatus: "strong" }) }));
  assert.equal(result.goals.halfMarathon.status, "On Track");
  assert.equal(result.goals.halfMarathon.currentValue, "9:10/mile predicted");
});

test("Half marathon At Risk from predicted pace moderately slow", () => {
  const result = evaluateGoalTracking(baseInput({ runningEngineResult: runningResult({ paceGap: 35, injuryRisk: 20, longRunStatus: "adequate" }) }));
  assert.equal(result.goals.halfMarathon.status, "At Risk");
});

test("Half marathon Off Track from injury risk and high pace gap", () => {
  const result = evaluateGoalTracking(baseInput({ runningEngineResult: runningResult({ paceGap: 70, injuryRisk: 75, longRunStatus: "problem", runningConsistency: 35 }) }));
  assert.equal(result.goals.halfMarathon.status, "Off Track");
  assert.ok(result.warnings.some((warning) => /injury/i.test(warning)));
});

test("Half marathon Insufficient Data", () => {
  const result = evaluateGoalTracking(baseInput({ runningEngineResult: undefined, runLogs: [] }));
  assert.equal(result.goals.halfMarathon.status, "Insufficient Data");
});

test("Overall status combines goals correctly", () => {
  const result = evaluateGoalTracking(baseInput());
  assert.equal(result.overallStatus, "On Track");
  assert.ok(result.overallScore >= 80);
  assert.equal(result.priorityGoal, "fat_loss");
});

test("Low data reduces confidence", () => {
  const result = evaluateGoalTracking(baseInput({ bodyMetrics: [], nutritionLogs: [], nutritionAdherence: undefined, workoutSessions: [], workoutSummary: undefined, runLogs: [], runningEngineResult: undefined }));
  assert.equal(result.confidence, "Low");
  assert.ok(result.dataQualityScore < 65);
  assert.equal(result.overallStatus, "At Risk");
});

test("Audit trail is created", () => {
  const result = evaluateGoalTracking(baseInput());
  assert.equal(result.auditTrail.length, 4);
  assert.deepEqual(result.auditTrail.map((entry) => entry.domain), ["fat_loss", "physique", "strength", "half_marathon"]);
});

test("Progression Engine result can be consumed without circular dependency issues", () => {
  const result = evaluateGoalTracking(baseInput());
  const summary = progressionGoalTrackingSummary(result);
  const progressionSnapshot = goalTrackingSnapshotFromResult(result);
  assert.equal(summary.status, result.overallStatus);
  assert.equal(progressionSnapshot.overallStatus, result.overallStatus);
  assert.equal(progressionSnapshot.goalStatus["Fat Loss"], result.goals.fatLoss.status);
});

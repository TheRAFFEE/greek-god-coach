import { test } from "node:test";
import * as assert from "node:assert/strict";
import { evaluateRunning, type RunningEngineInput } from "./running-engine";
import {
  evaluateProgression,
  progressionRunningInputFromRunningEngineV2,
  type ProgressionEngineInput,
} from "./progression-engine";

const runningInput: RunningEngineInput = {
  generatedAt: "2026-06-08T12:00:00.000Z",
  evaluationDate: "2026-06-08",
  race: { raceDate: "2027-01-17", targetFinishMinutes: 118, targetPaceSecondsPerMile: 540, distanceMiles: 13.1 },
  runLogs: [
    { id: "r1", date: "2026-06-01", runType: "easy", plannedDistance: 4, actualDistance: 4, durationMinutes: 42, averagePace: 10.5, averageHr: 145, maxHr: 162, rpe: 5, zone2Compliance: 86, completed: true, walkBreaks: false, pain: false, painScore: 0, painLocation: "", notes: "" },
    { id: "r2", date: "2026-06-06", runType: "long run", plannedDistance: 8, actualDistance: 8, durationMinutes: 80, averagePace: 10, averageHr: 148, maxHr: 165, rpe: 6, zone2Compliance: 85, completed: true, walkBreaks: false, pain: false, painScore: 0, painLocation: "", notes: "" },
  ],
  currentWeek: { startDate: "2026-06-01", endDate: "2026-06-07", weeklyMileage: 12, rolling7DayMileage: 12, previousWeeklyMileage: 11, runningDaysPlanned: 2, runningDaysCompleted: 2 },
  readiness: { status: "Green", score: 84, averageSleep: 7.3, averageSoreness: 3, averageStress: 4, averageEnergy: 8 },
};

test("Progression Engine V1 consumes Running Engine V2 output instead of recalculating running progression", () => {
  const running = evaluateRunning(runningInput);
  const progressionInput = progressionRunningInputFromRunningEngineV2(running);

  assert.equal(progressionInput.progressionAction, running.progression.action);
  assert.equal(progressionInput.injuryRiskScore, running.readiness.injuryRiskScore);
  assert.equal(progressionInput.raceReadinessScore, running.readiness.raceReadinessScore);
  assert.equal(progressionInput.confidenceScore, running.confidenceScore);
  assert.deepEqual(progressionInput.explanations, running.explanations.map((explanation) => explanation.summary));
});

function baseInput(overrides: Partial<ProgressionEngineInput> = {}): ProgressionEngineInput {
  return {
    readinessResult: { status: "Green", score: 86, confidence: "High", reason: "Recovered", reasons: [] },
    nutritionResult: { macroAdherence: 88, caloriesAdherence: 90, proteinAdherence: 92, loggingConsistency: 100, confidence: "High", warnings: [] },
    runningResult: {
      progression: { action: "Progress", reason: "Running signals support a conservative build." },
      readiness: { injuryRiskScore: 20, raceReadinessScore: 82 },
      prediction: { targetFinishGapMinutes: 8, targetPaceGapSecondsPerMile: 30 },
      confidence: "High",
      confidenceScore: 90,
      dataQualityScore: 90,
      explanations: [{ summary: "Long run and weekly mileage are progressing." }],
    },
    workoutResult: {
      overallDecision: "Progress",
      strengthProgression: { action: "Progress", exercisesProgressing: ["Bench Press"], exercisesStalled: [], exercisesRegressing: [] },
      hypertrophyProgression: { action: "Progress" },
      fatigue: { systemicFatigueScore: 22, fatigueStatus: "low" },
      prs: { newPrs: [{ id: "pr1" }] },
      confidenceScore: 88,
      dataQualityScore: 88,
      explanation: { summary: "Strength work is progressing." },
    },
    weightTrend: {
      currentWeight: 226,
      goalWeight: 199.9,
      sevenDayAverage: 226.4,
      fourteenDayAverage: 227.4,
      weeklyLossRate: 1,
      waistTrend: -0.25,
    },
    weeklyReviewMetrics: {
      adherenceScore: 88,
      trainingAdherence: 90,
      nutritionAdherence: 88,
      longRunCompleted: true,
      liftsCompleted: 4,
      plannedLifts: 4,
      missedWorkouts: 0,
      missedRuns: 0,
      missedLogs: 0,
      missedCheckIns: 0,
      missingNutritionDays: 0,
      missingBodyMetrics: 0,
      weeklyFatigue: "low",
      recoveryTrend: "improving",
      strengthProgressStalled: false,
      weeksFatLossBelowMinimum: 0,
    },
    goalContext: {
      fatLossGoal: { label: "Under 200 lb" },
      physiqueGoal: { label: "Greek God physique" },
      strengthGoal: { label: "Strength progression" },
      halfMarathonGoal: { label: "January 17 half marathon" },
    },
    ...overrides,
  };
}

test("evaluateProgression returns Progress when recovery running workouts nutrition and confidence all support it", () => {
  const result = evaluateProgression(baseInput());

  assert.equal(result.weeklyDecision, "Progress");
  assert.equal(result.nutritionDecision, "Maintain Calories");
  assert.equal(result.goalStatus["Fat Loss"], "On Track");
  assert.equal(result.confidence, "High");
  assert.ok(result.auditEntries.some((entry) => entry.engine === "Progression Engine" && entry.decision === "Progress"));
});

test("evaluateProgression returns Repeat when adherence is low", () => {
  const result = evaluateProgression(baseInput({
    nutritionResult: { macroAdherence: 62, caloriesAdherence: 65, proteinAdherence: 70, loggingConsistency: 80, confidence: "Medium" },
    weeklyReviewMetrics: { ...baseInput().weeklyReviewMetrics, adherenceScore: 62, nutritionAdherence: 62 },
  }));

  assert.equal(result.weeklyDecision, "Repeat");
  assert.ok(result.reasons.some((reason) => /adherence/i.test(reason)));
});

test("evaluateProgression returns Deload when weekly fatigue is high", () => {
  const result = evaluateProgression(baseInput({
    weeklyReviewMetrics: { ...baseInput().weeklyReviewMetrics, weeklyFatigue: "high" },
    workoutResult: { ...baseInput().workoutResult, fatigue: { systemicFatigueScore: 65, fatigueStatus: "high" } },
  }));

  assert.equal(result.weeklyDecision, "Deload");
});

test("evaluateProgression returns Recovery Focus immediately for safety triggers", () => {
  const result = evaluateProgression(baseInput({
    readinessResult: { status: "Red", score: 48, confidence: "High", reason: "Pain and poor sleep" },
  }));

  assert.equal(result.weeklyDecision, "Recovery Focus");
  assert.ok(result.warnings.some((warning) => /safety/i.test(warning) || /red/i.test(warning)));
});

test("evaluateProgression reduces calories when weight plateaus with strong macro adherence", () => {
  const result = evaluateProgression(baseInput({
    nutritionResult: { macroAdherence: 90, caloriesAdherence: 92, proteinAdherence: 95, loggingConsistency: 100, confidence: "High" },
    weightTrend: { ...baseInput().weightTrend, weeklyLossRate: 0.1, waistTrend: 0.1 },
    weeklyReviewMetrics: { ...baseInput().weeklyReviewMetrics, weeksFatLossBelowMinimum: 3 },
  }));

  assert.equal(result.nutritionDecision, "Reduce Calories");
});

test("evaluateProgression increases calories when weight loss is excessive and recovery is worsening", () => {
  const result = evaluateProgression(baseInput({
    weightTrend: { ...baseInput().weightTrend, weeklyLossRate: 2.4 },
    weeklyReviewMetrics: { ...baseInput().weeklyReviewMetrics, recoveryTrend: "worsening" },
    readinessResult: { status: "Yellow", score: 69, confidence: "Medium", reason: "Recovery worsening" },
  }));

  assert.equal(result.nutritionDecision, "Increase Calories");
});

test("evaluateProgression reports Fat Loss On Track when weekly loss rate is between 0.5 and 2.0", () => {
  assert.equal(evaluateProgression(baseInput({ weightTrend: { ...baseInput().weightTrend, weeklyLossRate: 1.2 } })).goalStatus["Fat Loss"], "On Track");
});

test("evaluateProgression reports Fat Loss At Risk when weekly loss rate is between 0.25 and 0.5", () => {
  assert.equal(evaluateProgression(baseInput({ weightTrend: { ...baseInput().weightTrend, weeklyLossRate: 0.35 } })).goalStatus["Fat Loss"], "At Risk");
});

test("evaluateProgression reports Fat Loss Off Track when loss is below 0.25 for 3 or more weeks", () => {
  const result = evaluateProgression(baseInput({
    weightTrend: { ...baseInput().weightTrend, weeklyLossRate: 0.1 },
    weeklyReviewMetrics: { ...baseInput().weeklyReviewMetrics, weeksFatLossBelowMinimum: 3 },
  }));

  assert.equal(result.goalStatus["Fat Loss"], "Off Track");
});

test("evaluateProgression reports Half Marathon On Track from Running Engine V2 race readiness and prediction gaps", () => {
  const result = evaluateProgression(baseInput({
    runningResult: {
      ...baseInput().runningResult,
      readiness: { injuryRiskScore: 20, raceReadinessScore: 86 },
      prediction: { targetFinishGapMinutes: 5, targetPaceGapSecondsPerMile: 20 },
    },
  }));

  assert.equal(result.goalStatus["Half Marathon"], "On Track");
});

test("evaluateProgression returns Low confidence when a required engine result is missing", () => {
  const result = evaluateProgression(baseInput({ runningResult: null }));

  assert.equal(result.confidence, "Low");
  assert.ok(result.dataQuality.missingInputs.includes("runningResult"));
});

test("evaluateProgression lowers data quality for missing logs check-ins runs nutrition and body metrics", () => {
  const result = evaluateProgression(baseInput({
    weeklyReviewMetrics: {
      ...baseInput().weeklyReviewMetrics,
      missedLogs: 3,
      missedCheckIns: 4,
      missedRuns: 2,
      missingNutritionDays: 4,
      missingBodyMetrics: 1,
    },
  }));

  assert.ok(result.dataQuality.score < 75);
  assert.ok(result.dataQuality.penalties.length >= 5);
});

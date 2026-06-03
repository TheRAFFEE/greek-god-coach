import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { evaluatePerformance, type PerformanceEngineInput } from "./performance-engine";
import type { DailyCheckIn, NutritionLog, RunLog, WorkoutSession, SetLog, BodyMetric } from "./types";

const userId = "user-1";

function daysAgo(days: number) {
  const date = new Date("2026-06-01T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function metric(days: number, weight: number, waist = 39): BodyMetric {
  return { id: `m-${days}`, userId, date: daysAgo(days), weight, waist };
}

function nutrition(days: number, calories: number, protein: number): NutritionLog {
  return { id: `n-${days}`, userId, date: daysAgo(days), calories, protein, carbs: 200, fat: 70, fiber: 28, sodium: 2400, water: 120, alcohol: 0, notes: "" };
}

function run(days: number, miles: number, pace: number, completed = true, painScore = 0): RunLog {
  return { id: `r-${days}`, userId, date: daysAgo(days), runType: miles >= 6 ? "long run" : "easy", plannedDistance: miles, actualDistance: completed ? miles : 0, durationMinutes: Math.round(miles * pace), averagePace: pace, averageHr: 145, maxHr: 165, rpe: painScore ? 8 : 5, zone2Compliance: 85, completed, walkBreaks: false, pain: painScore > 0, painScore, painLocation: "", notes: "" };
}

function set(sessionId: string, days: number, weight: number, reps = 8): SetLog {
  return { id: `set-${sessionId}-${weight}`, sessionId, userId, workoutId: "w", exerciseId: "bench", exerciseName: "Bench Press", setNumber: 1, targetReps: "8", targetRpe: 8, weightUsed: weight, repsCompleted: reps, rpe: 8, pain: false, formQuality: "solid", completedAt: `${daysAgo(days)}T12:00:00.000Z` };
}

function workout(days: number, weight: number, status: WorkoutSession["status"] = "completed"): WorkoutSession {
  const id = `ws-${days}`;
  return { id, userId, workoutId: "upper", workoutTitle: "Upper", mode: "coach", startedAt: `${daysAgo(days)}T11:00:00.000Z`, endedAt: `${daysAgo(days)}T12:00:00.000Z`, status, currentExerciseIndex: 0, currentSetNumber: 1, setLogs: status === "completed" ? [set(id, days, weight)] : [] };
}

function checkIn(days: number, score: { sleep: number; stress: number; energy: number; soreness: number }): DailyCheckIn {
  return { id: `c-${days}`, userId, date: daysAgo(days), weight: 210, sleepHours: score.sleep, sleepQuality: 8, soreness: score.soreness, energy: score.energy, stress: score.stress, hunger: 4, motivation: 8, alcohol: false, steps: 9000, restingHr: 58, hrv: 60, pain: false, painLocation: "", painSeverity: 0, workoutCompleted: true, runCompleted: true, macrosHit: true, notes: "" };
}

function input(overrides: Partial<PerformanceEngineInput> = {}): PerformanceEngineInput {
  return {
    evaluationDate: "2026-06-01",
    goals: { startWeight: 233, targetWeight: 199.9 },
    historicalBodyMetrics: [metric(27, 214), metric(20, 212), metric(13, 210), metric(6, 208), metric(0, 207)],
    historicalRunLogs: [run(24, 3, 11), run(17, 4, 10.8), run(10, 5, 10.5), run(3, 6, 10.2)],
    historicalWorkoutSessions: [workout(24, 185), workout(17, 190), workout(10, 195), workout(3, 205)],
    historicalNutritionLogs: [nutrition(6, 2500, 205), nutrition(5, 2450, 215), nutrition(4, 2500, 220), nutrition(3, 2525, 225), nutrition(2, 2475, 220), nutrition(1, 2510, 222), nutrition(0, 2490, 220)],
    historicalCheckIns: [checkIn(13, { sleep: 6.2, stress: 5, energy: 6, soreness: 5 }), checkIn(6, { sleep: 7.2, stress: 3, energy: 8, soreness: 3 }), checkIn(0, { sleep: 7.6, stress: 3, energy: 8, soreness: 2 })],
    ...overrides,
  };
}

function statusFor(overrides: Partial<PerformanceEngineInput>, domain: keyof Pick<ReturnType<typeof evaluatePerformance>, "strengthTrend" | "runningTrend" | "recoveryTrend" | "nutritionTrend" | "adherenceTrend" | "weightTrend">) {
  return evaluatePerformance(input(overrides))[domain].status;
}

test("Strength improving", () => assert.equal(statusFor({}, "strengthTrend"), "Improving"));
test("Strength plateau", () => assert.equal(statusFor({ historicalWorkoutSessions: [workout(24, 200), workout(17, 200), workout(10, 200), workout(3, 200)] }, "strengthTrend"), "Plateau"));
test("Strength declining", () => assert.equal(statusFor({ historicalWorkoutSessions: [workout(24, 205), workout(17, 195), workout(10, 185), workout(3, 175), workout(1, 0, "ended")] }, "strengthTrend"), "Declining"));
test("Running improving", () => assert.equal(statusFor({}, "runningTrend"), "Improving"));
test("Running plateau", () => assert.equal(statusFor({ historicalRunLogs: [run(24, 4, 10), run(17, 4, 10), run(10, 4, 10), run(3, 4, 10)] }, "runningTrend"), "Plateau"));
test("Running declining", () => assert.equal(statusFor({ historicalRunLogs: [run(24, 6, 9.8), run(17, 5, 10.4), run(10, 4, 11), run(3, 3, 11.6, true, 5)] }, "runningTrend"), "Declining"));
test("Recovery improving", () => assert.equal(statusFor({}, "recoveryTrend"), "Improving"));
test("Recovery declining", () => assert.equal(statusFor({ historicalCheckIns: [checkIn(13, { sleep: 8, stress: 2, energy: 9, soreness: 2 }), checkIn(6, { sleep: 6, stress: 5, energy: 5, soreness: 6 }), checkIn(0, { sleep: 5, stress: 7, energy: 4, soreness: 7 })] }, "recoveryTrend"), "Declining"));
test("Nutrition improving", () => assert.equal(statusFor({ historicalNutritionLogs: [nutrition(13, 3300, 120), nutrition(10, 3100, 150), nutrition(6, 2600, 190), nutrition(3, 2500, 215), nutrition(0, 2480, 220)] }, "nutritionTrend"), "Improving"));
test("Nutrition declining", () => assert.equal(statusFor({ historicalNutritionLogs: [nutrition(13, 2500, 220), nutrition(10, 2500, 220), nutrition(6, 3100, 160), nutrition(3, 3300, 130), nutrition(0, 3400, 120)] }, "nutritionTrend"), "Declining"));
test("Adherence improving", () => assert.equal(statusFor({}, "adherenceTrend"), "Improving"));
test("Adherence declining", () => assert.equal(statusFor({ historicalWorkoutSessions: [workout(7, 200, "ended")], historicalRunLogs: [run(5, 3, 10, false)], historicalNutritionLogs: [nutrition(0, 3500, 100)], historicalCheckIns: [] }, "adherenceTrend"), "Declining"));
test("Weight improving", () => assert.equal(statusFor({}, "weightTrend"), "Improving"));
test("Weight plateau", () => assert.equal(statusFor({ historicalBodyMetrics: [metric(27, 210), metric(20, 210), metric(13, 210), metric(6, 210), metric(0, 210)] }, "weightTrend"), "Plateau"));
test("Weight declining", () => assert.equal(statusFor({ historicalBodyMetrics: [metric(27, 207), metric(20, 209), metric(13, 211), metric(6, 213), metric(0, 214)] }, "weightTrend"), "Declining"));

test("Overall score calculation uses documented weighted domains", () => {
  const result = evaluatePerformance(input());
  const expected = Math.round(result.strengthTrend.score * 0.2 + result.runningTrend.score * 0.2 + result.recoveryTrend.score * 0.15 + result.nutritionTrend.score * 0.15 + result.adherenceTrend.score * 0.15 + result.weightTrend.score * 0.15);
  assert.equal(result.overallScore, expected);
});

test("Primary opportunity selection finds lowest fixable domain", () => {
  const result = evaluatePerformance(input({ historicalNutritionLogs: [nutrition(3, 3400, 110), nutrition(2, 3300, 120), nutrition(1, 3200, 130), nutrition(0, 3300, 125)] }));
  assert.match(result.primaryOpportunity, /Nutrition|Protein|calorie/i);
});

test("Primary risk selection surfaces injury risk", () => {
  const result = evaluatePerformance(input({ runningEngineResult: { readiness: { injuryRiskScore: 82 } } as never }));
  assert.match(result.primaryRisk, /Injury risk/i);
});

test("Low data quality", () => {
  const result = evaluatePerformance(input({ historicalRunLogs: [], historicalWorkoutSessions: [], historicalNutritionLogs: [], historicalBodyMetrics: [] }));
  assert.equal(result.confidence, "Low");
  assert.ok(result.dataQualityScore < 60);
});

test("Insufficient data", () => {
  const result = evaluatePerformance(input({ historicalRunLogs: [], historicalWorkoutSessions: [], historicalNutritionLogs: [], historicalBodyMetrics: [], historicalCheckIns: [] }));
  assert.equal(result.overallStatus, "Insufficient Data");
});

test("Audit trail creation", () => {
  const result = evaluatePerformance(input());
  assert.deepEqual(result.auditTrail.map((entry) => entry.domain), ["Strength", "Running", "Recovery", "Nutrition", "Adherence", "Weight", "Overall"]);
});

test("Home integration", () => {
  const home = fsRead("src/lib/home-command-center.ts");
  assert.match(home, /evaluatePerformance/);
  assert.match(home, /performanceEngineResult/);
});

function fsRead(path: string) {
  return fs.readFileSync(path, "utf8");
}

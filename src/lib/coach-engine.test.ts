import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  calculateReadiness,
  calculateWeightTrend,
  calculateAdherence,
  recommendMacroAdjustment,
  recommendWorkoutAdjustment,
  recommendProgression,
  generateWeeklyReview,
  detectInjuryRisk,
  transformationScore,
} from "./coach-engine";
import type { DailyCheckIn, ExerciseLog, NutritionLog, BodyMetric } from "./types";

const checkIn = (overrides: Partial<DailyCheckIn> = {}): DailyCheckIn => ({
  id: "c1",
  userId: "demo-user",
  date: "2026-05-24",
  weight: 210,
  sleepHours: 7.5,
  sleepQuality: 8,
  soreness: 4,
  energy: 8,
  stress: 4,
  hunger: 5,
  motivation: 8,
  alcohol: false,
  steps: 11200,
  restingHr: 58,
  hrv: 62,
  pain: false,
  painLocation: "",
  painSeverity: 0,
  workoutCompleted: true,
  macrosHit: true,
  notes: "",
  ...overrides,
});


  test("returns green when recovery markers are strong", () => {
    const result = calculateReadiness(checkIn(), { restingHr: 58, hrv: 60 });
    assert.equal(result.status, "Green");
    assert.ok(result.score >= 80);
    assert.match(result.recommendation, /Complete the planned workout/);
  });

  test("returns yellow and volume reduction when markers are moderately poor", () => {
    const result = calculateReadiness(checkIn({ sleepHours: 6.2, soreness: 7, energy: 5, restingHr: 66, hrv: 50 }), { restingHr: 58, hrv: 60 });
    assert.equal(result.status, "Yellow");
    assert.match(result.recommendation, /reduce volume/);
  });

  test("returns red when pain severity is high", () => {
    const result = calculateReadiness(checkIn({ sleepHours: 5, energy: 2, pain: true, painSeverity: 7 }), { restingHr: 58, hrv: 60 });
    assert.equal(result.status, "Red");
    assert.match(result.recommendation, /No heavy lifting/);
  });


test("uses rolling averages for weight trend", () => {
    const metrics: BodyMetric[] = Array.from({ length: 14 }, (_, i) => ({
      id: `m${i}`,
      userId: "demo-user",
      date: `2026-05-${String(10 + i).padStart(2, "0")}`,
      weight: i < 7 ? 211 - i * 0.05 : 210 - (i - 7) * 0.2,
      waist: i < 7 ? 37.5 : 37.2,
    }));
    const trend = calculateWeightTrend(metrics);
    assert.ok(trend.current7DayAverage < trend.previous7DayAverage);
    assert.ok(trend.change14Day < 0);
  });

  test("calculates weekly adherence without punishing one imperfect day too hard", () => {
    const logs: NutritionLog[] = Array.from({ length: 7 }, (_, i) => ({
      id: `n${i}`,
      userId: "demo-user",
      date: `2026-05-${String(10 + i).padStart(2, "0")}`,
      calories: i === 3 ? 2850 : 2550,
      protein: i === 3 ? 180 : 220,
      carbs: 210,
      fat: 70,
      fiber: 32,
      sodium: 2600,
      water: 120,
      alcohol: i === 5 ? 1 : 0,
      notes: "",
    }));
    const adherence = calculateAdherence(logs, { calories: 2550, protein: 220, carbs: 210, fat: 70, fiber: 30, water: 120 });
    assert.ok(adherence >= 80);
  });


test("reduces calories when 14-day weight and waist stall with strong adherence", () => {
    const rec = recommendMacroAdjustment({
      currentCalories: 2550,
      weightChange14Day: 0,
      weeklyLossRate: 0,
      waistChange: 0,
      nutritionAdherence: 90,
      trainingAdherence: 90,
      energy: 7,
      hunger: 5,
      sleep: 7,
      performanceTrend: "stable",
      upcomingWorkoutType: "rest",
    });
    assert.equal(rec.action, "Reduce calories");
    assert.ok(rec.newCalories < 2550);
  });

  test("does not adjust calories when adherence is low", () => {
    const rec = recommendMacroAdjustment({
      currentCalories: 2550,
      weightChange14Day: 0,
      weeklyLossRate: 0,
      waistChange: 0,
      nutritionAdherence: 70,
      trainingAdherence: 90,
      energy: 7,
      hunger: 5,
      sleep: 7,
      performanceTrend: "stable",
      upcomingWorkoutType: "rest",
    });
    assert.equal(rec.action, "Improve adherence first");
  });

  test("modifies workout for yellow readiness and replaces movements when pain is present", () => {
    const rec = recommendWorkoutAdjustment({
      readinessStatus: "Yellow",
      soreness: 7,
      pain: true,
      painLocation: "shoulder",
      painSeverity: 4,
      missedReps: false,
      upcomingWorkoutType: "upper-strength",
    });
    assert.match(rec.action, /Reduce volume/);
    assert.match(rec.substitutions.join(" "), /landmine press/);
  });

  test("recommends load progression when all reps are complete at RPE 8 or less", () => {
    const rec = recommendProgression({
      exerciseName: "Bench Press",
      category: "compound-upper",
      prescribedSets: 5,
      prescribedReps: "5",
      previousWeight: 225,
      log: { setsCompleted: 5, repsCompleted: 25, weightUsed: 225, rpe: 8, pain: false } as ExerciseLog,
    });
    assert.equal(rec.nextWeight, 230);
    assert.match(rec.recommendation, /increase/);
  });


test("generates a practical weekly review and transformation score", () => {
    const checks = Array.from({ length: 7 }, (_, i) => checkIn({ id: `c${i}`, date: `2026-05-${10 + i}`, steps: 10000 + i * 200 }));
    const score = transformationScore({ nutritionAdherence: 90, trainingAdherence: 85, stepAdherence: 95, sleepRecovery: 80, weightWaistTrend: 85, injuryFree: 100 });
    const review = generateWeeklyReview({
      userId: "demo-user",
      week: 2,
      checkIns: checks,
      bodyMetrics: checks.map((c, i) => ({ id: `m${i}`, userId: c.userId, date: c.date, weight: 211 - i * 0.15, waist: 37.5 - i * 0.03 })),
      nutritionAdherence: 90,
      trainingAdherence: 85,
      strengthTrend: "stable",
      runningTrend: "improving",
    });
    assert.ok(score > 85);
    assert.match(review.recommendation, /Keep plan/);
  });

  test("flags high injury risk", () => {
    const risk = detectInjuryRisk(checkIn({ pain: true, painSeverity: 7, painLocation: "knee" }));
    assert.equal(risk.level, "High");
    assert.match(risk.recommendation, /professional evaluation/);
  });

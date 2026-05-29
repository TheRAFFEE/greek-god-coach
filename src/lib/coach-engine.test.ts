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
  adjustWorkoutForReadiness,
  generateWorkoutPreview,
  getRecommendedStartingWeight,
  getNextWorkoutStep,
  generateNextSetRecommendation,
  generatePostWorkoutAnalysis,
  generateDailyPrescription,
  calculateNutritionProgress,
  calculateDailyFuelScore,
  suggestNextMealMacros,
  calculateMealTotals,
  syncNutritionLogFromMeals,
  generateRunningRecommendation,
  calculateRunTrends,
  explainCoachDecision,
  createCoachDecisionLogEntry,
  summarizeTodaysChanges,
  normalizeScanResult,
  mockScanNutritionImage,
  scanResultToMealItem,
  parseVisionProviderScanResult,
  getScanProviderConfig,
  validateScanResultForReview,
  getSupabasePersistenceConfig,
  getSupabaseStorageBucketForImageKind,
  mapAppStateToSupabaseTableCounts,
  getReadinessGaugeModel,
  buildWeeklyAdherenceHeatmap,
  summarizeWorkoutCompletionCards,
  buildRunTrendCards,
} from "./coach-engine";
import { createInitialState } from "./seed-data";
import { migrateAppState } from "./storage";
import type { DailyCheckIn, ExerciseLog, NutritionLog, BodyMetric, Workout, WorkoutSession, SetLog, Meal, RunLog, FoodScanResult } from "./types";

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

  test("generates a coach mode workout preview with yellow readiness modifications and pain substitutions", () => {
    const original: Workout = {
      id: "w-test",
      userId: "demo-user",
      week: 1,
      phase: "Phase 1 — Foundation",
      day: "Monday",
      dayIndex: 0,
      title: "Upper Strength",
      type: "upper-strength",
      notes: "Bench and pull strength.",
      finisher: "Sprint intervals",
      exercises: [
        { id: "e1", workoutId: "w-test", order: 1, name: "Bench Press", prescribedSets: 5, prescribedReps: "5", category: "compound-upper", prescribedRpe: 8 },
        { id: "e2", workoutId: "w-test", order: 2, name: "Dips", prescribedSets: 3, prescribedReps: "12", category: "accessory-upper", prescribedRpe: 8 },
      ],
    };
    const readiness = calculateReadiness(checkIn({ sleepHours: 6.5, soreness: 6, energy: 6, pain: true, painLocation: "shoulder", painSeverity: 4 }), { restingHr: 58, hrv: 60 });
    const adjusted = adjustWorkoutForReadiness(original, readiness.status);

    const preview = generateWorkoutPreview({ mode: "coach", originalWorkout: original, adjustedWorkout: adjusted, readiness, checkIn: checkIn({ pain: true, painLocation: "shoulder", painSeverity: 4 }) });

    assert.equal(preview.modeLabel, "Coach Mode");
    assert.match(preview.primaryInstruction, /Modify/);
    assert.ok(preview.whatChanged.some((change) => change.includes("volume")));
    assert.ok(preview.substitutions.some((sub) => sub.includes("landmine press")));
    assert.match(preview.startButtonLabel, /Start Coach Workout/);
  });

  test("generates tracker and manual workout previews with lighter guidance", () => {
    const workout: Workout = {
      id: "w-test",
      week: 1,
      phase: "Phase 1 — Foundation",
      day: "Tuesday",
      dayIndex: 1,
      title: "Lower Strength",
      type: "lower-strength",
      notes: "Lower strength day.",
      exercises: [{ id: "e1", workoutId: "w-test", order: 1, name: "Back Squat", prescribedSets: 3, prescribedReps: "6", category: "compound-lower", prescribedRpe: 8 }],
    };
    const readiness = calculateReadiness(checkIn(), { restingHr: 58, hrv: 60 });

    const tracker = generateWorkoutPreview({ mode: "tracker", originalWorkout: workout, adjustedWorkout: workout, readiness, checkIn: checkIn() });
    const manual = generateWorkoutPreview({ mode: "manual", originalWorkout: workout, adjustedWorkout: workout, readiness, checkIn: checkIn() });

    assert.equal(tracker.modeLabel, "Tracker Mode");
    assert.match(tracker.primaryInstruction, /Log freely/);
    assert.equal(manual.modeLabel, "Manual Mode");
    assert.match(manual.primaryInstruction, /Override/);
  });

  test("uses last successful set weight as the deterministic starting weight", () => {
    const history: SetLog[] = [
      { id: "s1", sessionId: "old", userId: "demo-user", workoutId: "w-test", exerciseId: "e1", exerciseName: "Back Squat", setNumber: 1, targetReps: "6", targetRpe: 8, weightUsed: 185, repsCompleted: 6, rpe: 9, pain: false, formQuality: "solid", completedAt: "2026-05-20T10:00:00.000Z" },
      { id: "s2", sessionId: "old", userId: "demo-user", workoutId: "w-test", exerciseId: "e1", exerciseName: "Back Squat", setNumber: 2, targetReps: "6", targetRpe: 8, weightUsed: 195, repsCompleted: 6, rpe: 8, pain: false, formQuality: "solid", completedAt: "2026-05-21T10:00:00.000Z" },
      { id: "s3", sessionId: "old", userId: "demo-user", workoutId: "w-test", exerciseId: "e1", exerciseName: "Back Squat", setNumber: 3, targetReps: "6", targetRpe: 8, weightUsed: 205, repsCompleted: 3, rpe: 10, pain: false, formQuality: "missed", completedAt: "2026-05-22T10:00:00.000Z" },
    ];

    assert.equal(getRecommendedStartingWeight("e1", history), 195);
    assert.equal(getRecommendedStartingWeight("unknown", history), 0);
  });

  test("advances workout session set by set and completes after the final set", () => {
    const workout: Workout = {
      id: "w-test",
      week: 1,
      phase: "Phase 1 — Foundation",
      day: "Tuesday",
      dayIndex: 1,
      title: "Lower Strength",
      type: "lower-strength",
      notes: "Lower strength day.",
      exercises: [
        { id: "e1", workoutId: "w-test", order: 1, name: "Back Squat", prescribedSets: 2, prescribedReps: "6", category: "compound-lower", prescribedRpe: 8 },
        { id: "e2", workoutId: "w-test", order: 2, name: "RDL", prescribedSets: 1, prescribedReps: "10", category: "accessory-lower", prescribedRpe: 8 },
      ],
    };
    const baseSession: WorkoutSession = { id: "session", userId: "demo-user", workoutId: workout.id, workoutTitle: workout.title, mode: "coach", startedAt: "2026-05-24T10:00:00.000Z", status: "active", currentExerciseIndex: 0, currentSetNumber: 1, setLogs: [] };
    const firstSet: SetLog = { id: "set-1", sessionId: "session", userId: "demo-user", workoutId: workout.id, exerciseId: "e1", exerciseName: "Back Squat", setNumber: 1, targetReps: "6", targetRpe: 8, weightUsed: 185, repsCompleted: 6, rpe: 8, pain: false, formQuality: "solid", completedAt: "2026-05-24T10:05:00.000Z" };
    const secondSet: SetLog = { ...firstSet, id: "set-2", setNumber: 2, completedAt: "2026-05-24T10:10:00.000Z" };
    const thirdSet: SetLog = { ...firstSet, id: "set-3", exerciseId: "e2", exerciseName: "RDL", setNumber: 1, targetReps: "10", completedAt: "2026-05-24T10:15:00.000Z" };

    const afterOne = getNextWorkoutStep(baseSession, workout, firstSet);
    assert.equal(afterOne.currentExerciseIndex, 0);
    assert.equal(afterOne.currentSetNumber, 2);
    assert.equal(afterOne.status, "active");

    const afterTwo = getNextWorkoutStep(afterOne, workout, secondSet);
    assert.equal(afterTwo.currentExerciseIndex, 1);
    assert.equal(afterTwo.currentSetNumber, 1);
    assert.equal(afterTwo.status, "active");

    const complete = getNextWorkoutStep(afterTwo, workout, thirdSet);
    assert.equal(complete.status, "completed");
    assert.equal(complete.setLogs.length, 3);
  });

  const baseSetForRecommendation: SetLog = { id: "set-rec", sessionId: "session", userId: "demo-user", workoutId: "w-test", exerciseId: "e1", exerciseName: "Back Squat", setNumber: 1, targetReps: "6", targetRpe: 8, weightUsed: 200, repsCompleted: 6, rpe: 7, pain: false, formQuality: "solid", completedAt: "2026-05-24T10:05:00.000Z" };

  test("recommends a small next-set increase after target reps at easy RPE on green readiness", () => {
    const decision = generateNextSetRecommendation({ setLog: baseSetForRecommendation, readinessStatus: "Green" });
    assert.equal(decision.action, "increase");
    assert.equal(decision.nextWeight, 205);
    assert.equal(decision.nextReps, "6");
    assert.equal(decision.restSeconds, 120);
    assert.match(decision.reason, /RPE 7/);
  });

  test("keeps the same next-set weight when target reps land at RPE 8", () => {
    const decision = generateNextSetRecommendation({ setLog: { ...baseSetForRecommendation, rpe: 8 }, readinessStatus: "Green" });
    assert.equal(decision.action, "repeat");
    assert.equal(decision.nextWeight, 200);
    assert.equal(decision.restSeconds, 120);
  });

  test("increases rest and avoids progression when RPE reaches 9", () => {
    const decision = generateNextSetRecommendation({ setLog: { ...baseSetForRecommendation, rpe: 9 }, readinessStatus: "Green" });
    assert.equal(decision.action, "reduce");
    assert.equal(decision.nextWeight, 190);
    assert.equal(decision.restSeconds, 180);
  });

  test("reduces load and increases rest when target reps are missed", () => {
    const decision = generateNextSetRecommendation({ setLog: { ...baseSetForRecommendation, repsCompleted: 4, rpe: 8 }, readinessStatus: "Green" });
    assert.equal(decision.action, "reduce");
    assert.equal(decision.nextWeight, 190);
    assert.equal(decision.restSeconds, 180);
    assert.match(decision.message, /reduce/);
  });

  test("stops progression when pain is reported", () => {
    const decision = generateNextSetRecommendation({ setLog: { ...baseSetForRecommendation, pain: true }, readinessStatus: "Green" });
    assert.equal(decision.action, "stop");
    assert.equal(decision.nextWeight, 0);
    assert.equal(decision.restSeconds, 180);
    assert.match(decision.message, /Stop/);
  });

  test("uses conservative recommendations on yellow readiness and blocks red readiness", () => {
    const yellow = generateNextSetRecommendation({ setLog: baseSetForRecommendation, readinessStatus: "Yellow" });
    assert.equal(yellow.action, "repeat");
    assert.equal(yellow.nextWeight, 200);
    assert.match(yellow.reason, /Yellow/);

    const red = generateNextSetRecommendation({ setLog: baseSetForRecommendation, readinessStatus: "Red" });
    assert.equal(red.action, "stop");
    assert.equal(red.nextWeight, 0);
    assert.match(red.message, /should not proceed/);
  });

  const postWorkout: Workout = {
    id: "w-post",
    week: 1,
    phase: "Phase 1 — Foundation",
    day: "Tuesday",
    dayIndex: 1,
    title: "Lower Strength",
    type: "lower-strength",
    notes: "Lower strength day.",
    exercises: [
      { id: "sq", workoutId: "w-post", order: 1, name: "Back Squat", prescribedSets: 2, prescribedReps: "6", category: "compound-lower", prescribedRpe: 8 },
      { id: "rdl", workoutId: "w-post", order: 2, name: "RDL", prescribedSets: 1, prescribedReps: "10", category: "accessory-lower", prescribedRpe: 8 },
    ],
  };

  const completedPostSession = (logs: SetLog[]): WorkoutSession => ({ id: "session-post", userId: "demo-user", workoutId: postWorkout.id, workoutTitle: postWorkout.title, mode: "coach", startedAt: "2026-05-24T10:00:00.000Z", endedAt: "2026-05-24T11:00:00.000Z", status: "completed", currentExerciseIndex: 1, currentSetNumber: 1, setLogs: logs });

  const postSet = (overrides: Partial<SetLog>): SetLog => ({ id: `set-${overrides.exerciseId}-${overrides.setNumber}`, sessionId: "session-post", userId: "demo-user", workoutId: postWorkout.id, exerciseId: "sq", exerciseName: "Back Squat", setNumber: 1, targetReps: "6", targetRpe: 8, weightUsed: 200, repsCompleted: 6, rpe: 8, pain: false, formQuality: "solid", completedAt: "2026-05-24T10:05:00.000Z", ...overrides });

  test("summarizes completed workout metrics and recommends progression when all work is clean", () => {
    const logs = [
      postSet({ exerciseId: "sq", exerciseName: "Back Squat", setNumber: 1, weightUsed: 200, repsCompleted: 6, rpe: 7 }),
      postSet({ exerciseId: "sq", exerciseName: "Back Squat", setNumber: 2, weightUsed: 205, repsCompleted: 6, rpe: 8 }),
      postSet({ exerciseId: "rdl", exerciseName: "RDL", setNumber: 1, targetReps: "10", weightUsed: 185, repsCompleted: 10, rpe: 8 }),
    ];
    const analysis = generatePostWorkoutAnalysis({ session: completedPostSession(logs), workout: postWorkout, completedAt: "2026-05-24T11:00:00.000Z" });

    assert.equal(analysis.completionPercentage, 100);
    assert.equal(analysis.exercisesCompleted, 2);
    assert.equal(analysis.totalSets, 3);
    assert.equal(analysis.totalReps, 22);
    assert.equal(analysis.estimatedVolume, 4280);
    assert.equal(analysis.highRpeFlags.length, 0);
    assert.equal(analysis.nextSessionRecommendations[0].action, "progress");
    assert.match(analysis.coachSummary, /Progress/);
  });

  test("post-workout analysis recommends repeating or reducing after high RPE, missed reps, pain, and poor form", () => {
    const logs = [
      postSet({ exerciseId: "sq", exerciseName: "Back Squat", setNumber: 1, repsCompleted: 6, rpe: 9 }),
      postSet({ exerciseId: "sq", exerciseName: "Back Squat", setNumber: 2, repsCompleted: 4, rpe: 8, formQuality: "minor breakdown" }),
      postSet({ exerciseId: "rdl", exerciseName: "RDL", setNumber: 1, targetReps: "10", repsCompleted: 10, rpe: 7, pain: true, formQuality: "missed" }),
    ];
    const analysis = generatePostWorkoutAnalysis({ session: completedPostSession(logs), workout: postWorkout, completedAt: "2026-05-24T11:00:00.000Z" });

    assert.equal(analysis.completionPercentage, 91);
    assert.equal(analysis.highRpeFlags.length, 1);
    assert.equal(analysis.missedRepFlags.length, 1);
    assert.equal(analysis.painFlags.length, 1);
    assert.equal(analysis.poorFormFlags.length, 2);
    assert.ok(analysis.nextSessionRecommendations.some((rec) => rec.action === "reduce"));
    assert.ok(analysis.nextSessionRecommendations.some((rec) => rec.action === "substitute"));
    assert.ok(analysis.nextSessionRecommendations.some((rec) => rec.action === "reduce-volume"));
  });


const dailyWorkout: Workout = {
  id: "w-daily",
  week: 1,
  phase: "Phase 1 — Foundation",
  day: "Tuesday",
  dayIndex: 1,
  title: "Lower Strength",
  type: "lower-strength",
  notes: "Lower strength day.",
  finisher: "Incline treadmill walk 10 min",
  exercises: [
    { id: "dl", workoutId: "w-daily", order: 1, name: "Trap Bar Deadlift", prescribedSets: 4, prescribedReps: "5", category: "compound-lower", prescribedRpe: 8 },
    { id: "sq", workoutId: "w-daily", order: 2, name: "Back Squat", prescribedSets: 3, prescribedReps: "6", category: "compound-lower", prescribedRpe: 8 },
  ],
};

const dailyMacro = { calories: 2500, protein: 220, carbs: 200, fat: 70, fiber: 30, water: 120 };
const dailyMetrics = Array.from({ length: 14 }, (_, i): BodyMetric => ({ id: `dm-${i}`, userId: "demo-user", date: `2026-05-${String(10 + i).padStart(2, "0")}`, weight: 210, waist: 38 }));
const goodNutrition = Array.from({ length: 7 }, (_, i): NutritionLog => ({ id: `dn-${i}`, userId: "demo-user", date: `2026-05-${String(17 + i).padStart(2, "0")}`, calories: 2500, protein: 222, carbs: 198, fat: 70, fiber: 31, sodium: 2500, water: 120, alcohol: 0, notes: "" }));
const poorNutrition = goodNutrition.map((log, i) => ({ ...log, id: `poor-${i}`, calories: 3100, protein: 140, carbs: 310, fat: 110, fiber: 15 }));

test("generates green Today's Orders with exact workout, macros, water, steps, and stall adjustment", () => {
  const readiness = calculateReadiness(checkIn(), { restingHr: 58, hrv: 60 });
  const prescription = generateDailyPrescription({
    readiness,
    checkIn: checkIn(),
    workout: dailyWorkout,
    macroTarget: dailyMacro,
    nutritionLogs: goodNutrition,
    bodyMetrics: dailyMetrics,
    trainingAdherence: 100,
    postWorkoutRecommendations: [],
  });

  assert.equal(prescription.readinessStatus, "Green");
  assert.equal(prescription.trainingDecision, "Full workout");
  assert.match(prescription.exactWorkoutRecommendation, /Do Lower Strength/);
  assert.match(prescription.nutritionTarget, /2500 calories/);
  assert.equal(prescription.waterTarget, "120 oz water");
  assert.equal(prescription.stepsTarget, "12,000 steps");
  assert.ok(prescription.workoutModifications.includes("No readiness modifications: perform all prescribed sets."));
  assert.ok(prescription.explanation.some((line) => /stalled/.test(line)));
});

test("generates yellow Today's Orders with reduced volume, pain substitutions, and adherence-first nutrition", () => {
  const yellowCheckIn = checkIn({ sleepHours: 6.8, soreness: 6, energy: 6, restingHr: 62, hrv: 55, pain: true, painLocation: "knee", painSeverity: 4, macrosHit: false });
  const readiness = calculateReadiness(yellowCheckIn, { restingHr: 58, hrv: 60 });
  const prescription = generateDailyPrescription({
    readiness,
    checkIn: yellowCheckIn,
    workout: dailyWorkout,
    macroTarget: dailyMacro,
    nutritionLogs: poorNutrition,
    bodyMetrics: dailyMetrics,
    trainingAdherence: 86,
    postWorkoutRecommendations: [{ sessionId: "s", workoutId: dailyWorkout.id, action: "repeat", message: "Hold progression on Trap Bar Deadlift next time.", reason: "Prior high RPE.", createdAt: "2026-05-23T00:00:00.000Z" }],
  });

  assert.equal(prescription.readinessStatus, "Yellow");
  assert.equal(prescription.trainingDecision, "Modified workout");
  assert.ok(prescription.workoutModifications.some((item) => /Reduce volume/.test(item)));
  assert.ok(prescription.workoutModifications.some((item) => /Replace running/.test(item)));
  assert.ok(prescription.workoutModifications.some((item) => /Hold progression/.test(item)));
  assert.match(prescription.nutritionTarget, /Improve adherence first/);
  assert.ok(prescription.warnings.some((warning) => /Pain/.test(warning)));
});

test("generates red Today's Orders as recovery replacement with no heavy workout", () => {
  const redCheckIn = checkIn({ sleepHours: 5, energy: 2, soreness: 8, pain: true, painLocation: "back", painSeverity: 7 });
  const readiness = calculateReadiness(redCheckIn, { restingHr: 58, hrv: 60 });
  const prescription = generateDailyPrescription({
    readiness,
    checkIn: redCheckIn,
    workout: dailyWorkout,
    macroTarget: dailyMacro,
    nutritionLogs: goodNutrition,
    bodyMetrics: dailyMetrics,
    trainingAdherence: 100,
    postWorkoutRecommendations: [],
  });

  assert.equal(prescription.readinessStatus, "Red");
  assert.equal(prescription.trainingDecision, "Recovery replacement");
  assert.match(prescription.exactWorkoutRecommendation, /Do not lift heavy/);
  assert.match(prescription.cardioRecommendation, /easy walk/);
  assert.ok(prescription.recoveryTasks.some((task) => /sleep/.test(task)));
  assert.ok(prescription.warnings.some((warning) => /No heavy lifting/.test(warning)));
});


test("calculates nutrition progress and remaining values with capped percentages", () => {
  const target = { calories: 2500, protein: 220, carbs: 240, fat: 70, fiber: 30, water: 120 };
  const log: NutritionLog = { id: "np", userId: "demo-user", date: "2026-05-24", calories: 1800, protein: 150, carbs: 260, fat: 50, fiber: 18, sodium: 2400, water: 80, alcohol: 0, notes: "" };
  const progress = calculateNutritionProgress(log, target);

  assert.equal(progress.calories.consumed, 1800);
  assert.equal(progress.calories.remaining, 700);
  assert.equal(progress.calories.percent, 72);
  assert.equal(progress.carbs.remaining, 0);
  assert.equal(progress.carbs.percent, 100);
  assert.equal(progress.water.remaining, 40);
  assert.equal(progress.water.percent, 67);
});

test("scores daily fuel from calories, protein, water, fiber, and alcohol penalty", () => {
  const target = { calories: 2500, protein: 220, carbs: 240, fat: 70, fiber: 30, water: 120 };
  const strong: NutritionLog = { id: "fuel-good", userId: "demo-user", date: "2026-05-24", calories: 2475, protein: 215, carbs: 235, fat: 72, fiber: 30, sodium: 2400, water: 125, alcohol: 0, notes: "" };
  const weak: NutritionLog = { ...strong, id: "fuel-bad", calories: 1600, protein: 110, fiber: 10, water: 45, alcohol: 2 };

  assert.ok(calculateDailyFuelScore(strong, target).score >= 95);
  const weakScore = calculateDailyFuelScore(weak, target);
  assert.ok(weakScore.score < 60);
  assert.ok(weakScore.reasons.some((reason) => /alcohol/.test(reason)));
});

test("suggests next meal macros from remaining targets with sane per-meal caps", () => {
  const target = { calories: 2500, protein: 220, carbs: 240, fat: 70, fiber: 30, water: 120 };
  const log: NutritionLog = { id: "meal", userId: "demo-user", date: "2026-05-24", calories: 1200, protein: 80, carbs: 90, fat: 35, fiber: 8, sodium: 2400, water: 56, alcohol: 0, notes: "" };
  const meal = suggestNextMealMacros(log, target, 3);

  assert.equal(meal.protein, 45);
  assert.equal(meal.carbs, 50);
  assert.equal(meal.fat, 12);
  assert.equal(meal.water, 24);
  assert.match(meal.message, /Next meal: aim for 45g protein, 50g carbs, 12g fat, and 24 oz water/);
});


test("calculates daily nutrition totals from meal items and meal-level quick entries", () => {
  const meals: Meal[] = [
    {
      id: "meal-1",
      userId: "demo-user",
      date: "2026-05-24",
      category: "Breakfast",
      name: "Greek yogurt bowl",
      calories: 100,
      protein: 10,
      carbs: 12,
      fat: 2,
      fiber: 3,
      sodium: 100,
      water: 8,
      notes: "meal-level base",
      items: [
        { id: "item-1", mealId: "meal-1", name: "Yogurt", calories: 220, protein: 35, carbs: 12, fat: 2, fiber: 0, sodium: 90, water: 0, notes: "" },
        { id: "item-2", mealId: "meal-1", name: "Berries", calories: 80, protein: 1, carbs: 18, fat: 0, fiber: 6, sodium: 5, water: 4, notes: "" },
      ],
    },
    {
      id: "meal-2",
      userId: "demo-user",
      date: "2026-05-24",
      category: "Post-workout",
      name: "Shake",
      calories: 350,
      protein: 45,
      carbs: 40,
      fat: 4,
      fiber: 2,
      sodium: 300,
      water: 24,
      notes: "quick macro entry",
      items: [],
    },
    {
      id: "meal-other-day",
      userId: "demo-user",
      date: "2026-05-23",
      category: "Dinner",
      name: "Ignore other day",
      calories: 999,
      protein: 99,
      carbs: 99,
      fat: 99,
      fiber: 99,
      sodium: 999,
      water: 99,
      notes: "",
      items: [],
    },
  ];

  const totals = calculateMealTotals(meals, "2026-05-24");

  assert.equal(totals.calories, 750);
  assert.equal(totals.protein, 91);
  assert.equal(totals.carbs, 82);
  assert.equal(totals.fat, 8);
  assert.equal(totals.fiber, 11);
  assert.equal(totals.sodium, 495);
  assert.equal(totals.water, 36);
});

test("syncs meal totals into a daily NutritionLog while preserving compatibility fields", () => {
  const meals: Meal[] = [{ id: "meal", userId: "demo-user", date: "2026-05-24", category: "Lunch", name: "Chicken rice", calories: 620, protein: 55, carbs: 70, fat: 12, fiber: 5, sodium: 700, water: 12, notes: "", items: [] }];
  const existing: NutritionLog = { id: "existing-log", userId: "demo-user", date: "2026-05-24", calories: 100, protein: 10, carbs: 10, fat: 10, fiber: 1, sodium: 100, water: 8, alcohol: 1, notes: "keep alcohol and notes" };

  const synced = syncNutritionLogFromMeals({ userId: "demo-user", date: "2026-05-24", meals, existingLog: existing });

  assert.equal(synced.id, "existing-log");
  assert.equal(synced.calories, 620);
  assert.equal(synced.protein, 55);
  assert.equal(synced.carbs, 70);
  assert.equal(synced.fat, 12);
  assert.equal(synced.fiber, 5);
  assert.equal(synced.sodium, 700);
  assert.equal(synced.water, 12);
  assert.equal(synced.alcohol, 1);
  assert.equal(synced.notes, "keep alcohol and notes");
});


const runLog = (overrides: Partial<RunLog> = {}): RunLog => ({
  id: "run-base",
  userId: "demo-user",
  date: "2026-05-24",
  plannedDistance: 4,
  actualDistance: 4,
  durationMinutes: 44,
  averagePace: 11,
  averageHr: 138,
  maxHr: 156,
  rpe: 5,
  zone2Compliance: 90,
  completed: true,
  pain: false,
  painLocation: "",
  notes: "",
  ...overrides,
});

test("progresses running after an easy completed Zone 2 run with stable readiness and reasonable mileage", () => {
  const logs = [runLog({ id: "r1", date: "2026-05-17", plannedDistance: 4, actualDistance: 4, averagePace: 11.2, averageHr: 140 }), runLog({ id: "r2", date: "2026-05-24", plannedDistance: 4, actualDistance: 4, averagePace: 11, averageHr: 138 })];
  const recommendation = generateRunningRecommendation({ runLogs: logs, nextDayReadiness: "Green", plannedDistance: 4, runType: "Zone 2", currentWeeklyMileage: 12, previousWeeklyMileage: 11 });

  assert.equal(recommendation.action, "Progress");
  assert.equal(recommendation.recommendedDistance, 4.5);
  assert.match(recommendation.message, /increase/i);
  assert.ok(recommendation.reasons.some((reason) => reason.includes("completed")));
});

test("holds running progression when RPE is high, HR/pace worsens, or readiness is yellow", () => {
  const logs = [runLog({ id: "r1", date: "2026-05-17", averagePace: 10.5, averageHr: 135, rpe: 5 }), runLog({ id: "r2", date: "2026-05-24", averagePace: 11.4, averageHr: 150, rpe: 7 })];
  const recommendation = generateRunningRecommendation({ runLogs: logs, nextDayReadiness: "Yellow", plannedDistance: 4, runType: "Zone 2", currentWeeklyMileage: 13, previousWeeklyMileage: 12 });

  assert.equal(recommendation.action, "Hold");
  assert.equal(recommendation.recommendedDistance, 4);
  assert.ok(recommendation.reasons.some((reason) => /RPE|readiness|HR/.test(reason)));
});

test("regresses running after pain, two poor runs, red readiness, or failed long run", () => {
  const logs = [runLog({ id: "r1", date: "2026-05-17", plannedDistance: 6, actualDistance: 4, completed: false, rpe: 8 }), runLog({ id: "r2", date: "2026-05-24", plannedDistance: 7, actualDistance: 5, completed: false, pain: true, painLocation: "left knee", rpe: 8 })];
  const recommendation = generateRunningRecommendation({ runLogs: logs, nextDayReadiness: "Red", plannedDistance: 7, runType: "Long run", currentWeeklyMileage: 10, previousWeeklyMileage: 14 });

  assert.equal(recommendation.action, "Regress");
  assert.equal(recommendation.recommendedDistance, 0);
  assert.ok(recommendation.warnings.some((warning) => warning.includes("left knee")));
  assert.match(recommendation.message, /No run today|walking/i);
});

test("calculates run trends for distance, pace, RPE, and long-run progression", () => {
  const trends = calculateRunTrends([
    runLog({ id: "r1", date: "2026-05-10", actualDistance: 3, averagePace: 11.5, rpe: 6, plannedDistance: 3 }),
    runLog({ id: "r2", date: "2026-05-17", actualDistance: 4, averagePace: 11.2, rpe: 5, plannedDistance: 4 }),
    runLog({ id: "r3", date: "2026-05-24", actualDistance: 5, averagePace: 11, rpe: 5, plannedDistance: 5 }),
  ]);

  assert.deepEqual(trends.distanceTrend, [3, 4, 5]);
  assert.deepEqual(trends.paceTrend, [11.5, 11.2, 11]);
  assert.deepEqual(trends.rpeTrend, [6, 5, 5]);
  assert.equal(trends.longRunProgression.at(-1), 5);
  assert.equal(trends.weeklyMileage, 12);
});


test("explains coach decisions with changed/why/data/next-step fields", () => {
  const explanation = explainCoachDecision({
    category: "Run progression/regression",
    originalPrescription: "4 mile Zone 2 run",
    adjustedPrescription: "3 mile easy run",
    reason: "Pain and Red readiness after the previous run.",
    triggerData: { pain: true, painLocation: "left knee", nextDayReadiness: "Red" },
    nextStep: "Regress distance and keep effort conversational.",
  });

  assert.equal(explanation.whatChanged, "Run progression/regression: 4 mile Zone 2 run → 3 mile easy run");
  assert.match(explanation.whyItChanged, /Pain and Red readiness/);
  assert.match(explanation.dataThatCausedIt, /left knee/);
  assert.match(explanation.whatToDoNext, /Regress distance/);
});

test("creates structured coach decision log entries with audit metadata", () => {
  const entry = createCoachDecisionLogEntry({
    id: "decision-1",
    userId: "demo-user",
    date: "2026-05-24T10:00:00.000Z",
    category: "Readiness modification",
    originalPrescription: "Upper Strength 4 sets",
    adjustedPrescription: "Upper Strength 3 sets",
    reason: "Yellow readiness reduced volume.",
    triggerData: { readinessStatus: "Yellow", soreness: 7 },
    confidence: "High",
    mode: "automatic",
    notes: "Generated from daily prescription.",
  });

  assert.equal(entry.adjustmentType, "Readiness modification");
  assert.equal(entry.previousValue, "Upper Strength 4 sets");
  assert.equal(entry.newValue, "Upper Strength 3 sets");
  assert.equal(entry.category, "Readiness modification");
  assert.equal(entry.confidence, "High");
  assert.equal(entry.mode, "automatic");
  assert.match(entry.triggerData ?? "", /soreness/);
  assert.match(entry.explanation?.whatChanged ?? "", /Upper Strength 4 sets/);
});

test("summarizes what changed today from automatic and manual coach decisions", () => {
  const changes = summarizeTodaysChanges([
    createCoachDecisionLogEntry({ userId: "demo-user", date: "2026-05-24T08:00:00.000Z", category: "Recovery replacement", originalPrescription: "Leg day", adjustedPrescription: "Mobility + walk", reason: "Red readiness", triggerData: { readiness: "Red" }, confidence: "High", mode: "automatic" }),
    createCoachDecisionLogEntry({ userId: "demo-user", date: "2026-05-24T09:00:00.000Z", category: "Manual override", originalPrescription: "2300 calories", adjustedPrescription: "2400 calories", reason: "User edited macros", triggerData: { screen: "Nutrition" }, confidence: "Medium", mode: "manual override" }),
    createCoachDecisionLogEntry({ userId: "demo-user", date: "2026-05-23T09:00:00.000Z", category: "Old", originalPrescription: "Old", adjustedPrescription: "Old", reason: "Old", triggerData: {}, confidence: "Low", mode: "automatic" }),
  ], "2026-05-24");

  assert.equal(changes.length, 2);
  assert.match(changes[0], /Recovery replacement/);
  assert.match(changes[1], /Manual override/);
});


test("normalizes scan result by servings eaten and clamps confidence", () => {
  const raw: FoodScanResult = {
    id: "scan-result-1",
    mode: "Nutrition Label Scan",
    detectedName: "Protein Cereal",
    servingSize: "1 cup",
    servingsEaten: 1.5,
    calories: 180,
    protein: 12,
    carbs: 32,
    fat: 3,
    fiber: 6,
    sodium: 210,
    confidence: 120,
    provider: "mock-deterministic",
    isMock: true,
  };

  const normalized = normalizeScanResult(raw);

  assert.equal(normalized.calories, 270);
  assert.equal(normalized.protein, 18);
  assert.equal(normalized.carbs, 48);
  assert.equal(normalized.fat, 4.5);
  assert.equal(normalized.fiber, 9);
  assert.equal(normalized.sodium, 315);
  assert.equal(normalized.confidence, 100);
  assert.equal(normalized.servingsEaten, 1.5);
});

test("mock scan provider returns deterministic label and food photo results", () => {
  const label = mockScanNutritionImage({ mode: "Nutrition Label Scan", fileName: "greek-yogurt-label.jpg" });
  const photo = mockScanNutritionImage({ mode: "Food Photo Scan", fileName: "salmon-rice-bowl.png" });

  assert.equal(label.provider, "mock-deterministic");
  assert.equal(label.isMock, true);
  assert.match(label.detectedName, /Greek Yogurt/);
  assert.equal(label.protein, 17);
  assert.match(photo.detectedName, /Salmon Rice Bowl/);
  assert.equal(photo.calories, 620);
  assert.ok(photo.confidence < label.confidence);
});

test("converts reviewed scan result into a meal item", () => {
  const result = normalizeScanResult(mockScanNutritionImage({ mode: "Nutrition Label Scan", fileName: "protein-bar-label.png" }));

  const item = scanResultToMealItem({ result, mealId: "meal-1", itemId: "item-1" });

  assert.equal(item.id, "item-1");
  assert.equal(item.mealId, "meal-1");
  assert.match(item.name, /Protein Bar/);
  assert.equal(item.calories, result.calories);
  assert.equal(item.protein, result.protein);
  assert.match(item.notes, /Mock scan/);
});


test("parses OpenAI vision label JSON into provider-neutral scan result fields", () => {
  const result = parseVisionProviderScanResult({
    mode: "Nutrition Label Scan",
    provider: "openai-vision",
    payload: {
      detectedName: "High Protein Oatmeal",
      servingSize: "1 packet (55g)",
      servingsPerContainer: "8",
      calories: 210,
      protein: 18,
      carbs: 30,
      fat: 4,
      fiber: 6,
      sodium: 240,
      sugar: 7,
      confidence: 88,
    },
  });

  assert.equal(result.provider, "openai-vision");
  assert.equal(result.isMock, false);
  assert.equal(result.servingSize, "1 packet (55g)");
  assert.equal(result.servingsPerContainer, "8");
  assert.equal(result.sugar, 7);
  assert.equal(result.confidenceLevel, "High");
});

test("parses OpenAI food photo JSON with detected foods and portion estimate", () => {
  const result = parseVisionProviderScanResult({
    mode: "Food Photo Scan",
    provider: "openai-vision",
    payload: {
      detectedName: "Chicken rice bowl",
      foodsDetected: ["grilled chicken", "white rice", "avocado"],
      portionEstimate: "about 6 oz chicken, 1 cup rice, 1/4 avocado",
      calories: 650,
      protein: 48,
      carbs: 62,
      fat: 22,
      confidence: 72,
    },
  });

  assert.deepEqual(result.foodsDetected, ["grilled chicken", "white rice", "avocado"]);
  assert.match(result.portionEstimate ?? "", /6 oz chicken/);
  assert.equal(result.confidenceLevel, "Medium");
  assert.equal(result.sodium, 0);
});

test("validates real scan results for missing fields and low confidence before review", () => {
  const lowConfidence = parseVisionProviderScanResult({
    mode: "Nutrition Label Scan",
    provider: "openai-vision",
    payload: { detectedName: "Unreadable label", calories: 0, protein: 0, carbs: 0, fat: 0, confidence: 42 },
  });

  const issues = validateScanResultForReview(lowConfidence);

  assert.ok(issues.some((issue) => issue.includes("Low confidence")));
  assert.ok(issues.some((issue) => issue.includes("serving size")));
  assert.ok(issues.some((issue) => issue.includes("calories")));
});

test("scan provider config defaults to mock and enables OpenAI only with key", () => {
  assert.deepEqual(getScanProviderConfig({}), { provider: "mock", model: "mock-deterministic", hasApiKey: false });
  assert.deepEqual(getScanProviderConfig({ GREEK_GOD_SCAN_PROVIDER: "openai", OPENAI_API_KEY: "sk-test", OPENAI_SCAN_MODEL: "gpt-4o-mini" }), { provider: "openai", model: "gpt-4o-mini", hasApiKey: true });
  assert.deepEqual(getScanProviderConfig({ GREEK_GOD_SCAN_PROVIDER: "openai" }), { provider: "mock", model: "mock-deterministic", hasApiKey: false });
});


test("supabase persistence config preserves local fallback unless env is complete", () => {
  assert.deepEqual(getSupabasePersistenceConfig({}), { mode: "localStorage", enabled: false, missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] });
  assert.deepEqual(getSupabasePersistenceConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" }), { mode: "supabase", enabled: true, missing: [] });
});

test("maps image kinds to dedicated supabase storage buckets", () => {
  assert.equal(getSupabaseStorageBucketForImageKind("progress-photo"), "progress-photos");
  assert.equal(getSupabaseStorageBucketForImageKind("food-photo"), "food-scan-images");
  assert.equal(getSupabaseStorageBucketForImageKind("nutrition-label"), "nutrition-label-images");
});

test("maps app state collections to phase 12 supabase table counts", () => {
  const state = createInitialState();
  state.workoutSessions = [{ id: "session-1", userId: state.user.id, workoutId: "w1", workoutTitle: "Upper", mode: "coach", startedAt: "2026-01-01T10:00:00.000Z", status: "active", currentExerciseIndex: 0, currentSetNumber: 1, setLogs: [] }];
  state.setLogs = [{ id: "set-1", sessionId: "session-1", userId: state.user.id, workoutId: "w1", exerciseId: "ex1", exerciseName: "Bench", setNumber: 1, targetReps: "8", targetRpe: 8, weightUsed: 135, repsCompleted: 8, rpe: 8, pain: false, formQuality: "solid", completedAt: "2026-01-01T10:05:00.000Z" }];
  state.meals = [{ id: "meal-1", userId: state.user.id, date: "2026-01-01", category: "Breakfast", name: "Breakfast", calories: 300, protein: 30, carbs: 30, fat: 8, fiber: 4, sodium: 300, water: 0, notes: "", items: [{ id: "item-1", mealId: "meal-1", name: "Eggs", calories: 300, protein: 30, carbs: 30, fat: 8, fiber: 4, sodium: 300, water: 0, notes: "" }] }];
  state.runLogs = [{ id: "run-1", userId: state.user.id, date: "2026-01-01", plannedDistance: 3, actualDistance: 3, durationMinutes: 30, averagePace: 10, averageHr: 140, maxHr: 155, rpe: 5, zone2Compliance: 90, completed: true, pain: false, painLocation: "", notes: "" }];

  const counts = mapAppStateToSupabaseTableCounts(state);

  assert.equal(counts.workout_sessions, 1);
  assert.equal(counts.set_logs, 1);
  assert.equal(counts.meals, 1);
  assert.equal(counts.meal_items, 1);
  assert.equal(counts.run_logs, 1);
  assert.equal(counts.macro_target_history, state.macroTargets.length);
});


test("builds premium readiness gauge model with status-specific copy", () => {
  const green = getReadinessGaugeModel({ score: 88, status: "Green", reason: "Recovered", recommendation: "Train hard" });
  const yellow = getReadinessGaugeModel({ score: 63, status: "Yellow", reason: "Fatigue", recommendation: "Reduce volume" });
  const red = getReadinessGaugeModel({ score: 31, status: "Red", reason: "Pain", recommendation: "Recover" });

  assert.equal(green.arcPercent, 88);
  assert.equal(green.tone, "green");
  assert.match(green.commandCopy, /Attack/i);
  assert.equal(yellow.tone, "yellow");
  assert.match(yellow.commandCopy, /Modify/i);
  assert.equal(red.tone, "red");
  assert.match(red.commandCopy, /Recover/i);
});

test("builds seven-day adherence heatmap cells from nutrition and check-ins", () => {
  const days = ["2026-01-01", "2026-01-02", "2026-01-03"];
  const heatmap = buildWeeklyAdherenceHeatmap({
    dates: days,
    checkIns: [checkIn({ id: "c-green", date: days[0], workoutCompleted: true, macrosHit: true }), checkIn({ id: "c-yellow", date: days[1], workoutCompleted: true, macrosHit: false })],
    nutritionLogs: [{ id: "n-green", userId: "demo-user", date: days[0], calories: 2600, protein: 200, carbs: 260, fat: 75, fiber: 35, sodium: 2200, water: 120, alcohol: 0, notes: "" }, { id: "n-red", userId: "demo-user", date: days[2], calories: 1400, protein: 80, carbs: 100, fat: 45, fiber: 12, sodium: 1800, water: 40, alcohol: 0, notes: "" }],
    target: { calories: 2600, protein: 200, carbs: 260, fat: 75, fiber: 35, water: 120 },
  });

  assert.equal(heatmap.length, 3);
  assert.equal(heatmap[0].tone, "green");
  assert.equal(heatmap[1].tone, "yellow");
  assert.equal(heatmap[2].tone, "red");
  assert.ok(heatmap[0].score > heatmap[2].score);
});

test("summarizes workout completion cards and empty active-session state", () => {
  const workout: Workout = { id: "w-p13", userId: "demo-user", week: 1, phase: "Build", day: "Monday", dayIndex: 1, title: "Upper Build", type: "Strength", notes: "", exercises: [
    { id: "ex-p13", workoutId: "w-p13", name: "Bench Press", prescribedSets: 3, prescribedReps: "8", prescribedRpe: 8, category: "push", order: 1 },
  ] };
  const sessions: WorkoutSession[] = [
    { id: "s1", userId: "demo-user", workoutId: workout.id, workoutTitle: workout.title, mode: "coach", startedAt: "2026-01-01T10:00:00.000Z", endedAt: "2026-01-01T11:00:00.000Z", status: "completed", currentExerciseIndex: 1, currentSetNumber: 1, setLogs: [] },
    { id: "s2", userId: "demo-user", workoutId: workout.id, workoutTitle: workout.title, mode: "tracker", startedAt: "2026-01-02T10:00:00.000Z", status: "active", currentExerciseIndex: 0, currentSetNumber: 2, setLogs: [] },
  ];
  const cards = summarizeWorkoutCompletionCards({ workouts: [workout], sessions });

  assert.equal(cards.totalWorkouts, 1);
  assert.equal(cards.completedSessions, 1);
  assert.equal(cards.activeSessions, 1);
  assert.equal(cards.completionPercent, 100);
  assert.match(cards.coachCopy, /active/i);
});

test("builds run trend cards with clear empty and populated copy", () => {
  const empty = buildRunTrendCards(calculateRunTrends([]));
  const populated = buildRunTrendCards(calculateRunTrends([
    { id: "r1", userId: "demo-user", date: "2026-01-01", plannedDistance: 3, actualDistance: 3, durationMinutes: 33, averagePace: 11, averageHr: 140, maxHr: 155, rpe: 5, zone2Compliance: 90, completed: true, pain: false, painLocation: "", notes: "" },
    { id: "r2", userId: "demo-user", date: "2026-01-03", plannedDistance: 4, actualDistance: 4, durationMinutes: 42, averagePace: 10.5, averageHr: 142, maxHr: 158, rpe: 6, zone2Compliance: 88, completed: true, pain: false, painLocation: "", notes: "" },
  ]));

  assert.equal(empty[0].value, "No runs yet");
  assert.equal(populated.find((card: any) => card.label === "Distance trend")?.value, "4 mi");
  assert.match(populated.find((card: any) => card.label === "Pace trend")?.coachCopy ?? "", /faster|slower|stable/i);
});


test("hardening: isolated significant pain forces red readiness", () => {
  const result = calculateReadiness(checkIn({ pain: true, painLocation: "knee", painSeverity: 6, sleepHours: 8, sleepQuality: 9, energy: 9, soreness: 1, stress: 2 }), { restingHr: 58, hrv: 60 });
  assert.equal(result.status, "Red");
  assert.match(result.recommendation, /No heavy lifting/);
});

test("hardening: red readiness daily prescription keeps recovery cardio over running engine copy", () => {
  const workout: Workout = { id: "run", week: 1, phase: "Base", day: "Long Run", dayIndex: 5, title: "Long Run", type: "long-run", notes: "", longRunMiles: 5, exercises: [] };
  const prescription = generateDailyPrescription({
    readiness: { score: 45, status: "Red", reason: "significant pain", recommendation: "No heavy lifting" },
    checkIn: checkIn({ pain: true, painSeverity: 7 }),
    workout,
    macroTarget: { calories: 2500, protein: 200, carbs: 240, fat: 70, fiber: 30, water: 120 },
    nutritionLogs: [],
    bodyMetrics: [],
    trainingAdherence: 90,
    postWorkoutRecommendations: [],
    runningRecommendation: { action: "Regress", recommendedDistance: 4, message: "Reduce the next long run to 4 miles.", reasons: [], warnings: ["red"] },
  });
  assert.equal(prescription.trainingDecision, "Recovery replacement");
  assert.match(prescription.cardioRecommendation, /easy walk|full rest/i);
  assert.doesNotMatch(prescription.cardioRecommendation, /4 miles|Regress/i);
});

test("hardening: red readiness or pain blocks running distance for today", () => {
  const logs: RunLog[] = [
    { id: "r1", userId: "demo-user", date: "2026-05-20", plannedDistance: 3, actualDistance: 3, durationMinutes: 33, averagePace: 11, averageHr: 135, maxHr: 150, rpe: 5, zone2Compliance: 90, completed: true, pain: false, painLocation: "", notes: "" },
  ];
  const rec = generateRunningRecommendation({ runLogs: logs, nextDayReadiness: "Red", plannedDistance: 4, runType: "Zone 2", currentWeeklyMileage: 6, previousWeeklyMileage: 6 });
  assert.equal(rec.action, "Regress");
  assert.equal(rec.recommendedDistance, 0);
  assert.match(rec.message, /No run today|walk/i);
});

test("hardening: latest comparable long run controls long-run progression", () => {
  const logs: RunLog[] = [
    { id: "long-fail", userId: "demo-user", date: "2026-05-18", plannedDistance: 7, actualDistance: 5, durationMinutes: 70, averagePace: 14, averageHr: 155, maxHr: 170, rpe: 8, zone2Compliance: 60, completed: false, pain: false, painLocation: "", notes: "" },
    { id: "short-clean", userId: "demo-user", date: "2026-05-21", plannedDistance: 3, actualDistance: 3, durationMinutes: 32, averagePace: 10.7, averageHr: 132, maxHr: 148, rpe: 5, zone2Compliance: 90, completed: true, pain: false, painLocation: "", notes: "" },
  ];
  const rec = generateRunningRecommendation({ runLogs: logs, nextDayReadiness: "Green", plannedDistance: 7, runType: "Long run", currentWeeklyMileage: 8, previousWeeklyMileage: 8 });
  assert.notEqual(rec.action, "Progress");
  assert.ok(rec.warnings.some((warning) => /Long run failed/i.test(warning)));
});

test("hardening: vision parser accepts unit-suffixed numeric strings", () => {
  const result = parseVisionProviderScanResult({ mode: "Nutrition Label Scan", provider: "openai", payload: { detectedName: "Soup", servingSize: "1 cup", servingsEaten: "1", calories: "210 kcal", protein: "18g", carbs: "28 g", fat: "6g", fiber: "4 g", sodium: "240 mg", confidence: "88%" } });
  assert.equal(result.calories, 210);
  assert.equal(result.protein, 18);
  assert.equal(result.sodium, 240);
  assert.equal(result.confidence, 88);
});

test("hardening: scan result conversion scales servings only once", () => {
  const raw: FoodScanResult = { id: "scan-double", mode: "Nutrition Label Scan", detectedName: "Rice", servingSize: "1 cup", servingsEaten: 2, calories: 100, protein: 4, carbs: 20, fat: 1, fiber: 1, sodium: 10, confidence: 90, provider: "test", isMock: false };
  const normalized = normalizeScanResult(raw);
  const item = scanResultToMealItem({ result: normalized, mealId: "meal-1" });
  assert.equal(item.calories, 200);
  assert.equal(item.carbs, 40);
});

test("hardening: old meals without items and partial state are safely counted", () => {
  const state = createInitialState() as any;
  state.meals = [{ id: "old-meal", userId: "demo-user", date: "2026-05-24", category: "Lunch", name: "Old meal", calories: 300, protein: 25, carbs: 30, fat: 8, fiber: 3, sodium: 400, water: 12, notes: "" }];
  state.foodScans = undefined;
  const totals = calculateMealTotals(state.meals, "2026-05-24");
  assert.equal(totals.calories, 300);
  const counts = mapAppStateToSupabaseTableCounts(state);
  assert.equal(counts.meal_items, 0);
  assert.equal(counts.food_scan_logs, 0);
});

test("hardening: localStorage migration repairs old partial data", () => {
  const migrated = migrateAppState({ user: { name: "Walter" }, appMode: "guided", nutritionLogs: null, meals: [{ id: "old-meal", date: "2026-05-24", calories: 100 }], macroTargets: [] });
  assert.equal(migrated.user.name, "Walter");
  assert.equal(migrated.user.id, "demo-user");
  assert.equal(migrated.appMode, "coach");
  assert.deepEqual(migrated.nutritionLogs, []);
  assert.equal(migrated.meals[0].items.length, 0);
  assert.ok(migrated.macroTargets.length >= 12);
});

test("hardening: coach decision default ids differ for multiple same-day decisions", () => {
  const a = createCoachDecisionLogEntry({ userId: "demo-user", date: "2026-05-24", category: "Readiness modification", originalPrescription: "Full", adjustedPrescription: "Modified", reason: "Yellow", triggerData: {} });
  const b = createCoachDecisionLogEntry({ userId: "demo-user", date: "2026-05-24", category: "Run progression/regression", originalPrescription: "Run", adjustedPrescription: "Hold", reason: "RPE", triggerData: {} });
  assert.notEqual(a.id, b.id);
});

test("hardening: next meal suggestion does not add macros already over target", () => {
  const suggestion = suggestNextMealMacros({ id: "n", userId: "demo-user", date: "2026-05-24", calories: 2800, protein: 230, carbs: 260, fat: 90, fiber: 35, sodium: 2500, water: 130, alcohol: 0, notes: "" }, { calories: 2500, protein: 200, carbs: 240, fat: 70, fiber: 30, water: 120 }, 1);
  assert.equal(suggestion.protein, 0);
  assert.equal(suggestion.carbs, 0);
  assert.equal(suggestion.fat, 0);
  assert.equal(suggestion.water, 0);
});

test("hardening: workout completion percentage is capped at 100", () => {
  const workout: Workout = { id: "w-over", week: 1, phase: "Base", day: "Monday", dayIndex: 0, title: "Over Reps", type: "upper-strength", notes: "", exercises: [{ id: "ex-over", workoutId: "w-over", name: "Press", prescribedSets: 1, prescribedReps: "5", category: "upper", order: 1 }] };
  const session: WorkoutSession = { id: "s-over", userId: "demo-user", workoutId: workout.id, workoutTitle: workout.title, mode: "coach", startedAt: "2026-05-24T00:00:00.000Z", endedAt: "2026-05-24T01:00:00.000Z", status: "completed", currentExerciseIndex: 0, currentSetNumber: 1, setLogs: [{ id: "set-over", sessionId: "s-over", userId: "demo-user", workoutId: workout.id, exerciseId: "ex-over", exerciseName: "Press", setNumber: 1, targetReps: "5", targetRpe: 8, weightUsed: 100, repsCompleted: 10, rpe: 7, pain: false, formQuality: "solid", completedAt: "2026-05-24T00:30:00.000Z" }] };
  const summary = generatePostWorkoutAnalysis({ session, workout });
  assert.equal(summary.completionPercentage, 100);
});

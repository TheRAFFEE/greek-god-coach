import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildDailyTrainingSession, type BuildDailyTrainingSessionInput } from "./training-planner";
import { workouts } from "./seed-data";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { Workout } from "./types";

const userId = "user-1";

const readiness = (status: "Green" | "Yellow" | "Red", overrides: Partial<ReadinessEngineResult> = {}): ReadinessEngineResult => ({
  score: status === "Green" ? 88 : status === "Yellow" ? 64 : 35,
  status,
  confidence: "High",
  reasons: [],
  reason: `${status} readiness`,
  recommendation: status === "Green" ? "Train normally" : status === "Yellow" ? "Modify training" : "Recovery only",
  recommendationType: status === "Green" ? "full_training" : status === "Yellow" ? "modified_training" : "recovery_focus",
  trainingGuidance: status === "Green" ? "Full session" : status === "Yellow" ? "Reduce volume" : "No hard training",
  recoveryGuidance: ["Hydrate", "Sleep 7+ hours"],
  dataQualityWarnings: [],
  ...overrides,
});

const progression = (decision: ProgressionEngineResult["weeklyDecision"] = "Progress", overrides: Partial<ProgressionEngineResult> = {}): ProgressionEngineResult => ({
  weeklyDecision: decision,
  nutritionDecision: "Maintain Calories",
  goalStatus: { "Fat Loss": "On Track", Physique: "On Track", Strength: "On Track", "Half Marathon": "On Track" },
  confidence: "High",
  dataQuality: { score: 92, confidence: "High", missingInputs: [], penalties: [], warnings: [] },
  reasons: [],
  warnings: [],
  auditEntries: [],
  ...overrides,
});

const goalTracking = (overrides: Partial<GoalTrackingEngineResult> = {}): GoalTrackingEngineResult => ({
  overallStatus: "On Track",
  overallScore: 88,
  confidence: "High",
  dataQualityScore: 90,
  goals: {
    fatLoss: { domain: "fat_loss", status: "On Track", score: 88, confidence: "High", currentValue: "210", targetValue: "199.9", trend: "down", blockers: [], supportingSignals: [], recommendation: "Stay consistent", explanation: "On track" },
    physique: { domain: "physique", status: "On Track", score: 88, confidence: "High", currentValue: "good", targetValue: "Greek God", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Lift", explanation: "On track" },
    strength: { domain: "strength", status: "On Track", score: 88, confidence: "High", currentValue: "good", targetValue: "progress", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Lift", explanation: "On track" },
    halfMarathon: { domain: "half_marathon", status: "On Track", score: 88, confidence: "High", currentValue: "building", targetValue: "13.1", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Run", explanation: "On track" },
  },
  priorityGoal: "half_marathon",
  summary: "Goals on track",
  recommendations: ["Hit protein goal"],
  warnings: [],
  explanations: [],
  auditTrail: [],
  ...overrides,
});

const baseWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  id: "custom-lift",
  userId,
  week: 1,
  phase: "Test",
  day: "Monday",
  dayIndex: 0,
  title: "Upper Strength",
  type: "upper-strength",
  notes: "Lift only.",
  exercises: [
    { id: "bench", workoutId: "custom-lift", name: "Bench Press", prescribedSets: 4, prescribedReps: "6", prescribedRpe: 8, category: "compound-upper", order: 1 },
    { id: "row", workoutId: "custom-lift", name: "Row", prescribedSets: 4, prescribedReps: "8", prescribedRpe: 8, category: "accessory-upper", order: 2 },
  ],
  ...overrides,
});

function input(overrides: Partial<BuildDailyTrainingSessionInput> = {}): BuildDailyTrainingSessionInput {
  return {
    date: "2026-06-01",
    currentWeek: 1,
    workouts,
    readinessResult: readiness("Green"),
    progressionResult: progression(),
    goalTrackingResult: goalTracking(),
    ...overrides,
  };
}

const blockKinds = (session: ReturnType<typeof buildDailyTrainingSession>) => session.blocks.map((block) => block.kind);

test("Monday maps to dayIndex 0", () => {
  assert.equal(buildDailyTrainingSession(input({ date: "2026-06-01" })).dayIndex, 0);
});

test("Sunday maps to dayIndex 6", () => {
  assert.equal(buildDailyTrainingSession(input({ date: "2026-06-07" })).dayIndex, 6);
});

test("Correct workout selected by week/day", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-04", currentWeek: 2 }));
  assert.equal(session.dayIndex, 3);
  assert.equal(session.sourcePlan.sourceWorkoutId, "w2-d4");
  assert.equal(session.sourcePlan.sourceWorkoutTitle, "Upper Hypertrophy + Density");
});

test("Lift-only day creates lift block and no run", () => {
  const workout = baseWorkout();
  const session = buildDailyTrainingSession(input({ workouts: [workout] }));
  assert.ok(blockKinds(session).includes("lift"));
  assert.equal(session.workout?.sourceWorkoutId, workout.id);
  assert.equal(session.run, null);
  assert.ok(!blockKinds(session).includes("run"));
});

test("Long run day creates distance run block", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-06" }));
  assert.equal(session.run?.prescriptionMode, "distance");
  assert.equal(session.run?.distanceMiles, 3);
  assert.ok(blockKinds(session).includes("run"));
  assert.equal(session.workout, null);
});

test("Zone 2 35-45 minute run creates duration run block", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-03" }));
  assert.equal(session.run?.prescriptionMode, "duration");
  assert.equal(session.run?.durationMinutes, 40);
  assert.equal(session.run?.distanceMiles, null);
  assert.ok(blockKinds(session).includes("run"));
});

test("Duration run does not become reps", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-03" }));
  assert.ok(session.run?.loggingTarget.plannedDurationMinutes);
  assert.doesNotMatch(session.blocks.find((block) => block.kind === "run")?.items.join(" ") ?? "", /\b1\s*x\s*35-45|min reps|reps/i);
});

test("Mobility preserves duration prescription without synthetic reps", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-07" }));
  assert.ok(session.mobility);
  assert.doesNotMatch(session.blocks.find((block) => block.kind === "mobility")?.items.join(" ") ?? "", /reps/i);
});

test("Recovery day creates recovery/mobility block, not lift", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-07" }));
  assert.equal(session.sessionType, "RecoveryDay");
  assert.equal(session.status, "Rest");
  assert.equal(session.workout, null);
  assert.ok(session.recovery || session.mobility);
  assert.ok(!blockKinds(session).includes("lift"));
});

test("all planned Sunday recovery days preserve RecoveryDay planner session type", () => {
  for (let week = 1; week <= 12; week += 1) {
    const session = buildDailyTrainingSession(input({ date: "2026-06-07", currentWeek: week }));
    assert.equal(session.sessionType, "RecoveryDay", `week ${week}`);
    assert.equal(session.sourcePlan.resolvedSessionType, "RecoveryDay", `week ${week}`);
    assert.equal(session.workout, null, `week ${week}`);
    assert.equal(session.run, null, `week ${week}`);
  }
});

test("core support extraction emits exact core support without changing primary type or logging", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-02", currentWeek: 5 }));
  assert.equal(session.sessionType, "LiftDay");
  assert.equal(session.sourcePlan.resolvedSessionType, "LiftDay");
  assert.equal(session.support.some((item) => item.kind === "Core"), true);
  assert.deepEqual(session.support.find((item) => item.kind === "Core")?.items, ["5. Loaded Carries: 4 x 1 round"]);
  assert.ok(session.workout?.loggingTarget);
  assert.equal(session.run, null);
  assert.equal(session.workout.exercises.some((exercise) => /Loaded Carries/i.test(exercise.name)), false);
});

test("run day core support remains support and keeps run-only logging", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-03", currentWeek: 1 }));
  const core = session.support.find((item) => item.kind === "Core");
  assert.equal(session.sessionType, "RunDay");
  assert.ok(core);
  assert.deepEqual(core?.items, ["5. Pallof Press: 3 x 12/side", "6. Side Plank: 3 x 45-60 sec/side"]);
  assert.ok(session.run?.loggingTarget);
  assert.equal(session.workout, null);
});

test("athletic day core support includes farmer carries and ab wheel without changing lift logging", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-05", currentWeek: 1 }));
  const core = session.support.find((item) => item.kind === "Core");
  assert.equal(session.sessionType, "LiftDay");
  assert.ok(core?.items.some((item) => /Farmer Carries/i.test(item)));
  assert.ok(core?.items.some((item) => /Ab Wheel/i.test(item)));
  assert.ok(session.workout?.loggingTarget);
  assert.equal(session.run, null);
});

test("deload metadata survives planner output without creating DeloadDay", () => {
  const lift = buildDailyTrainingSession(input({ date: "2026-06-01", currentWeek: 4 }));
  const run = buildDailyTrainingSession(input({ date: "2026-06-03", currentWeek: 4 }));
  const longRun = buildDailyTrainingSession(input({ date: "2026-06-06", currentWeek: 4 }));
  assert.equal(lift.metadata.deload, true);
  assert.equal(lift.sourcePlan.sourceWorkoutDeload, true);
  assert.equal(lift.sessionType, "LiftDay");
  assert.notEqual(lift.sessionType, "DeloadDay");
  assert.equal(run.metadata.deload, true);
  assert.equal(run.sessionType, "RunDay");
  assert.notEqual(run.sessionType, "DeloadDay");
  assert.equal(longRun.metadata.deload, true);
  assert.equal(longRun.sessionType, "LongRunDay");
  assert.notEqual(longRun.sessionType, "DeloadDay");
});

test("planned RecoveryDay preserves explicit seed recovery items without changing logging", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-07", currentWeek: 1 }));
  const recoveryItems = session.blocks.find((block) => block.kind === "mobility")?.items.join(" | ") ?? "";
  assert.equal(session.sessionType, "RecoveryDay");
  assert.equal(session.workout, null);
  assert.equal(session.run, null);
  assert.match(recoveryItems, /Easy Walk: 1 x 30-60 min/);
  assert.match(recoveryItems, /Mobility Flow: 1 x 15-25 min/);
  assert.match(recoveryItems, /Meal Prep: 1 x complete/);
});

test("upper hypertrophy preserves shoulder press accessory work", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-04", currentWeek: 1 }));
  assert.equal(session.sessionType, "LiftDay");
  assert.ok(session.workout?.exercises.some((exercise) => exercise.name === "DB Shoulder Press"));
  assert.match(session.blocks.find((block) => block.kind === "lift")?.items.join(" | ") ?? "", /3\. DB Shoulder Press: 4 x 10/);
});

test("athletic circuit preserves walking lunges in visible prescription output", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-05", currentWeek: 1 }));
  assert.equal(session.sessionType, "LiftDay");
  assert.ok(session.workout?.exercises.some((exercise) => exercise.name === "Walking Lunges"));
  assert.match(session.blocks.find((block) => block.kind === "lift")?.items.join(" | ") ?? "", /2\. Walking Lunges: 3 x 20 steps/);
});

test("lower strength preserves low-impact conditioning finishers", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-02", currentWeek: 1 }));
  const conditioningItems = session.blocks.find((block) => block.kind === "conditioning")?.items.join(" | ") ?? "";
  assert.equal(session.sessionType, "LiftDay");
  assert.match(conditioningItems, /5\. Box Jumps: 5 x 3/);
  assert.match(conditioningItems, /6\. Incline Treadmill Walk: 1 x 10 min/);
  assert.equal(session.run, null);
  assert.ok(session.workout?.loggingTarget);
});

test("duration ranges keep midpoint logging and expose source range metadata", () => {
  const phaseOne = buildDailyTrainingSession(input({ date: "2026-06-03", currentWeek: 1 }));
  const phaseTwo = buildDailyTrainingSession(input({ date: "2026-06-03", currentWeek: 5 }));
  assert.equal(phaseOne.run?.durationMinutes, 40);
  assert.equal(phaseOne.run?.durationRange?.source, "35-45 min");
  assert.equal(phaseOne.run?.durationRange?.resolvedMinutes, 40);
  assert.equal(phaseTwo.run?.durationMinutes, 53);
  assert.equal(phaseTwo.run?.durationRange?.source, "45-60 min");
  assert.equal(phaseTwo.run?.durationRange?.resolvedMinutes, 53);
});

test("Red readiness creates recovery session", () => {
  const session = buildDailyTrainingSession(input({ readinessResult: readiness("Red") }));
  assert.equal(session.status, "Recovery");
  assert.equal(session.workout, null);
  assert.equal(session.run, null);
  assert.ok(blockKinds(session).includes("recovery"));
});

test("Recovery Focus creates recovery session", () => {
  const session = buildDailyTrainingSession(input({ progressionResult: progression("Recovery Focus") }));
  assert.equal(session.status, "Recovery");
  assert.equal(session.workout, null);
  assert.equal(session.run, null);
});

test("Yellow readiness creates modified session", () => {
  const session = buildDailyTrainingSession(input({ readinessResult: readiness("Yellow") }));
  assert.equal(session.status, "Modified");
  assert.equal(session.modifications.filter((modification) => /Yellow readiness/i.test(modification.reason)).length, 1);
});

test("Lift + run flags combined load", () => {
  const hybrid = baseWorkout({
    title: "Upper + Zone 2",
    exercises: [
      ...baseWorkout().exercises,
      { id: "run", workoutId: "custom-lift", name: "Zone 2 Run", prescribedSets: 1, prescribedReps: "35-45 min", prescribedRpe: 6, category: "conditioning", order: 3 },
    ],
  });
  const session = buildDailyTrainingSession(input({ workouts: [hybrid] }));
  assert.equal(session.combinedLoad.hasLift, true);
  assert.equal(session.combinedLoad.hasRun, true);
  assert.ok(session.combinedLoad.overloadFlags.some((flag) => /lift \+ run/i.test(flag)));
});

test("Lower body + run flags high lower-body stress", () => {
  const lowerRun = baseWorkout({
    title: "Lower + Run",
    type: "lower-strength",
    exercises: [
      { id: "squat", workoutId: "custom-lift", name: "Back Squat", prescribedSets: 4, prescribedReps: "5", prescribedRpe: 8, category: "compound-lower", order: 1 },
      { id: "run", workoutId: "custom-lift", name: "Zone 2 Run", prescribedSets: 1, prescribedReps: "35 min", prescribedRpe: 6, category: "conditioning", order: 2 },
    ],
  });
  const session = buildDailyTrainingSession(input({ workouts: [lowerRun] }));
  assert.equal(session.combinedLoad.lowerBodyStress, "High");
  assert.ok(session.warnings.some((warning) => /lower-body/i.test(warning.message)));
});

test("Sprint/plyometric day flags conditioning stress", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-01" }));
  assert.equal(session.combinedLoad.hasPlyometricsOrSprints, true);
  assert.ok(session.combinedLoad.overloadFlags.some((flag) => /sprint|plyometric|conditioning/i.test(flag)));
});

test("Heavy Upper + Sprints + Core creates conditioning block without run logging target", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-01", currentWeek: 5 }));
  assert.equal(session.sourcePlan.sourceWorkoutTitle, "Heavy Upper + Sprints + Core");
  assert.deepEqual(blockKinds(session), ["warmup", "lift", "conditioning", "cooldown"]);
  assert.ok(session.workout);
  assert.equal(session.run, null);
  assert.equal(session.combinedLoad.hasConditioning, true);
});

test("Missing workout returns safe rest/unavailable session, not random fallback", () => {
  const session = buildDailyTrainingSession(input({ workouts: [], date: "2026-06-01" }));
  assert.equal(session.status, "Rest");
  assert.equal(session.sourcePlan.sourceWorkoutId, undefined);
  assert.equal(session.workout, null);
  assert.equal(session.run, null);
  assert.match(session.summary.title, /Unavailable|Rest/i);
});

test("Logging target workoutId equals source workout ID", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-01" }));
  assert.equal(session.workout?.loggingTarget.workoutId, session.sourcePlan.sourceWorkoutId);
});

test("Run logging target supports duration-based run", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-03" }));
  assert.equal(session.run?.loggingTarget.plannedDistance, null);
  assert.equal(session.run?.loggingTarget.plannedDurationMinutes, 40);
  assert.equal(session.run?.loggingTarget.runType, "easy");
});

test("Audit trail exists", () => {
  const session = buildDailyTrainingSession(input({ date: "2026-06-03" }));
  const audit = session.auditTrail.map((entry) => `${entry.event}: ${entry.message}`).join("\n");
  assert.ok(session.auditTrail.length >= 5);
  assert.match(audit, /dayIndex|source workout|classification|readiness|duration/i);
});

test("Deterministic output", () => {
  const first = buildDailyTrainingSession(input({ date: "2026-06-03" }));
  const second = buildDailyTrainingSession(input({ date: "2026-06-03" }));
  assert.deepEqual(second, first);
});

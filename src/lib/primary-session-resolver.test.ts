import { test } from "node:test";
import * as assert from "node:assert/strict";
import { resolvePrimarySession, type PrimarySessionResolution } from "./primary-session-resolver";
import { buildDailyTrainingSession, type BuildDailyTrainingSessionInput } from "./training-planner";
import { workouts } from "./seed-data";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { Exercise, Workout } from "./types";

const userId = "resolver-user";

const readinessResult: ReadinessEngineResult = {
  score: 90,
  status: "Green",
  confidence: "High",
  reasons: [],
  reason: "Green readiness",
  recommendation: "Train normally",
  recommendationType: "full_training",
  trainingGuidance: "Full session",
  recoveryGuidance: [],
  dataQualityWarnings: [],
};

const progressionResult: ProgressionEngineResult = {
  weeklyDecision: "Progress",
  nutritionDecision: "Maintain Calories",
  goalStatus: { "Fat Loss": "On Track", Physique: "On Track", Strength: "On Track", "Half Marathon": "On Track" },
  confidence: "High",
  dataQuality: { score: 95, confidence: "High", missingInputs: [], penalties: [], warnings: [] },
  reasons: [],
  warnings: [],
  auditEntries: [],
};

const goalTrackingResult: GoalTrackingEngineResult = {
  overallStatus: "On Track",
  overallScore: 90,
  confidence: "High",
  dataQualityScore: 95,
  goals: {
    fatLoss: { domain: "fat_loss", status: "On Track", score: 90, confidence: "High", currentValue: "210", targetValue: "199.9", trend: "down", blockers: [], supportingSignals: [], recommendation: "Stay consistent", explanation: "On track" },
    physique: { domain: "physique", status: "On Track", score: 90, confidence: "High", currentValue: "good", targetValue: "Greek God", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Lift", explanation: "On track" },
    strength: { domain: "strength", status: "On Track", score: 90, confidence: "High", currentValue: "good", targetValue: "progress", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Lift", explanation: "On track" },
    halfMarathon: { domain: "half_marathon", status: "On Track", score: 90, confidence: "High", currentValue: "building", targetValue: "13.1", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Run", explanation: "On track" },
  },
  priorityGoal: "half_marathon",
  summary: "Goals on track",
  recommendations: [],
  warnings: [],
  explanations: [],
  auditTrail: [],
};

function exercise(workoutId: string, order: number, name: string, category: string, reps = "10", sets = 1): Exercise {
  return { id: `${workoutId}-e${order}`, workoutId, order, name, category, prescribedReps: reps, prescribedSets: sets, prescribedRpe: 6 };
}

function workout(overrides: Partial<Workout>): Workout {
  const id = overrides.id ?? "resolver-workout";
  return {
    id,
    userId,
    week: 1,
    phase: "Resolver Test",
    day: "Monday",
    dayIndex: 0,
    title: "Resolver Workout",
    type: "resolver",
    notes: "Resolver test fixture",
    exercises: [],
    ...overrides,
  };
}

function seedWorkout(title: string): Workout {
  const found = workouts.find((candidate) => candidate.title === title);
  assert.ok(found, `Expected seed workout ${title} to exist`);
  return found;
}

function buildFor(sourceWorkout: Workout) {
  const input: BuildDailyTrainingSessionInput = {
    date: `2026-06-0${sourceWorkout.dayIndex + 1}`,
    currentWeek: sourceWorkout.week,
    workouts: workouts.includes(sourceWorkout) ? workouts : [sourceWorkout],
    readinessResult,
    progressionResult,
    goalTrackingResult,
    userPreferences: { includeWarmup: true, includeCooldown: true },
  };
  return buildDailyTrainingSession(input);
}

function blockKinds(sourceWorkout: Workout): string[] {
  return buildFor(sourceWorkout).blocks.map((block) => block.kind);
}

function expectDayType(sourceWorkout: Workout, dayType: PrimarySessionResolution["dayType"]) {
  assert.equal(resolvePrimarySession(sourceWorkout).dayType, dayType);
}

test("Upper Strength + Sprints + Core resolves to LiftDay", () => {
  const sourceWorkout = seedWorkout("Upper Strength + Sprints + Core");
  const result = resolvePrimarySession(sourceWorkout);
  assert.equal(result.dayType, "LiftDay");
  assert.equal(result.primaryStimulus, "Upper strength/hypertrophy");
  assert.deepEqual(result.allowedBlocks, ["warmup", "lift", "conditioning", "cooldown"]);
  assert.equal(result.hybridAllowed, false);
});

test("Lower Strength resolves to LiftDay", () => {
  expectDayType(seedWorkout("Lower Strength"), "LiftDay");
});

test("Zone 2 + Mobility + Core resolves to RunDay", () => {
  const result = resolvePrimarySession(seedWorkout("Zone 2 + Mobility + Core"));
  assert.equal(result.dayType, "RunDay");
  assert.equal(result.primaryStimulus, "Zone 2 aerobic run");
  assert.deepEqual(result.allowedBlocks, ["warmup", "run", "mobility", "cooldown"]);
  assert.deepEqual(result.forbiddenBlocks, ["lift"]);
});

test("Zone 2 Run + Mobility + Core resolves to RunDay", () => {
  expectDayType(seedWorkout("Zone 2 Run + Mobility + Core"), "RunDay");
});

test("Long Run resolves to LongRunDay", () => {
  const result = resolvePrimarySession(seedWorkout("Long Run — 3 miles"));
  assert.equal(result.dayType, "LongRunDay");
  assert.equal(result.primaryStimulus, "Long run (3 miles)");
  assert.deepEqual(result.allowedBlocks, ["warmup", "run", "cooldown"]);
});

test("Recovery resolves to RecoveryDay", () => {
  expectDayType(seedWorkout("Recovery"), "RecoveryDay");
});

test("Mobility only resolves to MobilityDay", () => {
  const mobility = workout({ id: "mobility-only", title: "Mobility Only", type: "mobility", exercises: [exercise("mobility-only", 1, "Mobility Flow", "mobility", "20 min")] });
  expectDayType(mobility, "MobilityDay");
});

test("Core only does not resolve to LiftDay", () => {
  const core = workout({ id: "core-only", title: "Core Only", type: "core", exercises: [exercise("core-only", 1, "Side Plank", "core", "45 sec/side", 3)] });
  assert.notEqual(resolvePrimarySession(core).dayType, "LiftDay");
});

test("Mobility + Core does not resolve to HybridDay", () => {
  const support = workout({
    id: "mobility-core",
    title: "Mobility + Core",
    type: "support",
    exercises: [
      exercise("mobility-core", 1, "Hip Mobility", "mobility", "10 min"),
      exercise("mobility-core", 2, "Side Plank", "core", "45 sec/side", 3),
    ],
  });
  assert.notEqual(resolvePrimarySession(support).dayType, "HybridDay");
});

test("Hybrid only appears when explicitly requested", () => {
  const accidental = workout({
    id: "accidental-support-run",
    title: "Zone 2 + Mobility + Core",
    type: "zone-2",
    notes: "35-45 minute conversational run, mobility, and core support work.",
    exercises: [
      exercise("accidental-support-run", 1, "Zone 2 Run", "conditioning", "35-45 min"),
      exercise("accidental-support-run", 2, "Hip Mobility", "mobility", "10 min"),
      exercise("accidental-support-run", 3, "Pallof Press", "core", "12/side", 3),
    ],
  });
  const explicit = workout({
    id: "explicit-hybrid",
    title: "Explicit Hybrid Lift + Run",
    type: "hybrid",
    notes: "Explicit hybrid session: lift and run are both primary stimuli.",
    exercises: [
      exercise("explicit-hybrid", 1, "Bench Press", "compound-upper", "5", 4),
      exercise("explicit-hybrid", 2, "Zone 2 Run", "conditioning", "35 min"),
    ],
  });
  assert.notEqual(resolvePrimarySession(accidental).dayType, "HybridDay");
  assert.equal(resolvePrimarySession(explicit).dayType, "HybridDay");
  assert.equal(resolvePrimarySession(explicit).hybridAllowed, true);
});

test("Long Run never becomes Hybrid", () => {
  assert.notEqual(resolvePrimarySession(seedWorkout("Long Run — 4 miles")).dayType, "HybridDay");
});

test("Long Run never becomes Lift", () => {
  assert.notEqual(resolvePrimarySession(seedWorkout("Long Run — 4 miles")).dayType, "LiftDay");
});

test("Support work does not change primary type", () => {
  const runWithSupport = seedWorkout("Zone 2 + Mobility + Core");
  const liftWithCore = seedWorkout("Upper Strength + Sprints + Core");
  assert.equal(resolvePrimarySession(runWithSupport).dayType, "RunDay");
  assert.equal(resolvePrimarySession(liftWithCore).dayType, "LiftDay");
});

test("Deload source flag and notes do not replace normal primary type", () => {
  assert.equal(resolvePrimarySession(seedWorkout("Upper Strength + Sprints + Core")).dayType, "LiftDay");
  assert.equal(resolvePrimarySession(workouts.find((candidate) => candidate.week === 4 && candidate.dayIndex === 0)).dayType, "LiftDay");
  assert.equal(resolvePrimarySession(workouts.find((candidate) => candidate.week === 4 && candidate.dayIndex === 2)).dayType, "RunDay");
  assert.equal(resolvePrimarySession(workouts.find((candidate) => candidate.week === 4 && candidate.dayIndex === 5)).dayType, "LongRunDay");
});

test("Deterministic output", () => {
  const sourceWorkout = seedWorkout("Zone 2 + Mobility + Core");
  const first = resolvePrimarySession(sourceWorkout);
  const second = resolvePrimarySession(sourceWorkout);
  assert.deepEqual(second, first);
});

test("planner consumes resolver: Zone 2 + Mobility + Core has run and mobility blocks with no lift block", () => {
  const sourceWorkout = seedWorkout("Zone 2 + Mobility + Core");
  const session = buildFor(sourceWorkout);
  assert.equal(session.workout, null);
  assert.ok(session.run);
  assert.ok(session.mobility);
  assert.deepEqual(blockKinds(sourceWorkout), ["warmup", "run", "mobility", "cooldown"]);
});

test("planner consumes resolver: core-only support work does not create a lift logging target", () => {
  const core = workout({ id: "core-only", title: "Core Only", type: "core", exercises: [exercise("core-only", 1, "Side Plank", "core", "45 sec/side", 3)] });
  const session = buildFor(core);
  assert.equal(session.workout, null);
  assert.ok(!session.blocks.some((block) => block.kind === "lift"));
});

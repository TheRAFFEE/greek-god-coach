import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildDailyTrainingSession, type DailyTrainingSession } from "./training-planner";
import { workouts } from "./seed-data";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { Workout } from "./types";

const readinessResult: ReadinessEngineResult = {
  score: 88,
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
  dataQuality: { score: 92, confidence: "High", missingInputs: [], penalties: [], warnings: [] },
  reasons: [],
  warnings: [],
  auditEntries: [],
};

const goalTrackingResult: GoalTrackingEngineResult = {
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
  recommendations: [],
  warnings: [],
  explanations: [],
  auditTrail: [],
};

function buildFor(workout: Workout, plan: Workout[] = [workout]): DailyTrainingSession {
  return buildDailyTrainingSession({
    date: `2026-06-0${workout.dayIndex + 1}`,
    currentWeek: workout.week,
    workouts: plan,
    readinessResult,
    progressionResult,
    goalTrackingResult,
    userPreferences: { includeWarmup: true, includeCooldown: true },
  });
}

function makeWorkout(overrides: Partial<Workout>): Workout {
  const id = overrides.id ?? "audit-workout";
  return {
    id,
    userId: "audit-user",
    week: 1,
    phase: "Audit",
    day: "Monday",
    dayIndex: 0,
    title: "Audit Workout",
    type: "audit",
    notes: "Audit fixture",
    exercises: [],
    ...overrides,
  };
}

function blockKinds(session: DailyTrainingSession): string[] {
  return session.blocks.map((block) => block.kind);
}

function seedWorkout(title: string): Workout {
  const workout = workouts.find((candidate) => candidate.title === title);
  assert.ok(workout, `Expected seed workout ${title} to exist`);
  return workout;
}

test("classification audit: mobility-only day is Mobility Day", () => {
  const workout = makeWorkout({
    id: "mobility-only",
    title: "Mobility Only",
    type: "mobility",
    exercises: [{ id: "mobility-only-e1", workoutId: "mobility-only", name: "Mobility Flow", prescribedSets: 1, prescribedReps: "20 min", prescribedRpe: 3, category: "mobility", order: 1 }],
  });
  const session = buildFor(workout);
  assert.equal(session.workout, null);
  assert.ok(session.mobility);
  assert.ok(!blockKinds(session).includes("lift"));
});

test("classification audit: core-only day is NOT Lift Day", () => {
  const workout = makeWorkout({
    id: "core-only",
    title: "Core Only",
    type: "core",
    exercises: [{ id: "core-only-e1", workoutId: "core-only", name: "Side Plank", prescribedSets: 3, prescribedReps: "45 sec/side", prescribedRpe: 4, category: "core", order: 1 }],
  });
  const session = buildFor(workout);
  assert.equal(session.workout, null);
  assert.ok(!blockKinds(session).includes("lift"));
});

test("classification audit: Zone 2 + Mobility + Core is Run Day", () => {
  const workout = seedWorkout("Zone 2 + Mobility + Core");
  const session = buildFor(workout, workouts);
  assert.equal(session.workout, null);
  assert.ok(session.run);
  assert.ok(!blockKinds(session).includes("lift"));
});

test("classification audit: Long Run remains Long Run Day", () => {
  const workout = seedWorkout("Long Run — 3 miles");
  const session = buildFor(workout, workouts);
  assert.equal(session.workout, null);
  assert.equal(session.run?.type, "long");
  assert.equal(session.run?.distanceMiles, 3);
});

test("classification audit: Upper Strength + Sprints + Core is Lift Day", () => {
  const workout = seedWorkout("Upper Strength + Sprints + Core");
  const session = buildFor(workout, workouts);
  assert.ok(session.workout);
  assert.equal(session.run, null);
  assert.ok(blockKinds(session).includes("lift"));
  assert.equal(session.combinedLoad.hasConditioning, true);
});

test("classification audit: Hybrid only appears when explicitly allowed", () => {
  const accidentalHybrids = workouts
    .map((workout) => buildFor(workout, workouts))
    .filter((session) => session.workout && session.run)
    .map((session) => session.sourcePlan.sourceWorkoutTitle);
  assert.deepEqual(accidentalHybrids, []);
});

test("classification audit: Lift-only day contains no run block", () => {
  const workout = seedWorkout("Lower Strength");
  const session = buildFor(workout, workouts);
  assert.ok(session.workout);
  assert.equal(session.run, null);
  assert.ok(!blockKinds(session).includes("run"));
});

test("classification audit: Run-only day contains no lift block", () => {
  const workout = makeWorkout({
    id: "run-only",
    title: "Zone 2 Run",
    type: "zone-2",
    exercises: [{ id: "run-only-e1", workoutId: "run-only", name: "Zone 2 Run", prescribedSets: 1, prescribedReps: "35-45 min", prescribedRpe: 6, category: "conditioning", order: 1 }],
  });
  const session = buildFor(workout);
  assert.equal(session.workout, null);
  assert.ok(session.run);
  assert.ok(!blockKinds(session).includes("lift"));
});

test("classification audit: Long Run Day contains no lift block", () => {
  const workout = seedWorkout("Long Run — 4 miles");
  const session = buildFor(workout, workouts);
  assert.ok(session.run);
  assert.ok(!blockKinds(session).includes("lift"));
});

test("classification audit: Mobility day contains no lift block", () => {
  const workout = makeWorkout({
    id: "mobility-day",
    title: "Mobility Day",
    type: "mobility",
    exercises: [{ id: "mobility-day-e1", workoutId: "mobility-day", name: "Hip Mobility", prescribedSets: 1, prescribedReps: "15 min", prescribedRpe: 3, category: "mobility", order: 1 }],
  });
  const session = buildFor(workout);
  assert.ok(!blockKinds(session).includes("lift"));
});

test("classification audit: No seed workout falls back to Hybrid accidentally", () => {
  const accidentalHybridCount = workouts.filter((workout) => {
    const session = buildFor(workout, workouts);
    return session.workout !== null && session.run !== null;
  }).length;
  assert.equal(accidentalHybridCount, 0);
});

test("classification audit: Deterministic output", () => {
  const workout = seedWorkout("Zone 2 + Mobility + Core");
  const first = buildFor(workout, workouts);
  const second = buildFor(workout, workouts);
  assert.deepEqual(second, first);
});

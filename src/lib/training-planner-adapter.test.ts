import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildPlannerSessionFromAppState, comparePlannerVsLegacy } from "./training-planner-adapter";
import { createInitialState } from "./seed-data";
import type { DailyTrainingSession } from "./training-planner";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { AppState, Workout } from "./types";

const userId = "user-1";

const readiness = (status: "Green" | "Yellow" | "Red" = "Green"): ReadinessEngineResult => ({
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
});

const progression = (decision: ProgressionEngineResult["weeklyDecision"] = "Progress"): ProgressionEngineResult => ({
  weeklyDecision: decision,
  nutritionDecision: "Maintain Calories",
  goalStatus: { "Fat Loss": "On Track", Physique: "On Track", Strength: "On Track", "Half Marathon": "On Track" },
  confidence: "High",
  dataQuality: { score: 92, confidence: "High", missingInputs: [], penalties: [], warnings: [] },
  reasons: [],
  warnings: [],
  auditEntries: [],
});

const goalTracking = (): GoalTrackingEngineResult => ({
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
});

const liftWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  id: "test-lift",
  userId,
  week: 1,
  phase: "Adapter Test",
  day: "Monday",
  dayIndex: 0,
  title: "Upper Strength",
  type: "upper-strength",
  notes: "Lift only.",
  exercises: [
    { id: "bench", workoutId: "test-lift", name: "Bench Press", prescribedSets: 4, prescribedReps: "6", prescribedRpe: 8, category: "compound-upper", order: 1 },
    { id: "row", workoutId: "test-lift", name: "Row", prescribedSets: 4, prescribedReps: "8", prescribedRpe: 8, category: "accessory-upper", order: 2 },
  ],
  ...overrides,
});

const runWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  id: "test-run",
  userId,
  week: 1,
  phase: "Adapter Test",
  day: "Wednesday",
  dayIndex: 2,
  title: "Zone 2 Run",
  type: "easy-run",
  notes: "Duration-based aerobic run.",
  exercises: [{ id: "run", workoutId: "test-run", name: "Zone 2 Run", prescribedSets: 1, prescribedReps: "35-45 min", prescribedRpe: 6, category: "conditioning", order: 1 }],
  ...overrides,
});

const mobilityWorkout = (): Workout => ({
  id: "test-mobility",
  userId,
  week: 1,
  phase: "Adapter Test",
  day: "Sunday",
  dayIndex: 6,
  title: "Mobility Reset",
  type: "mobility",
  notes: "Pain-free movement only.",
  exercises: [{ id: "hips", workoutId: "test-mobility", name: "Hip Mobility", prescribedSets: 1, prescribedReps: "15-25 min", prescribedRpe: 3, category: "mobility", order: 1 }],
});

const stateWithWorkouts = (workouts: Workout[], currentWeek = 1): AppState => ({
  ...createInitialState(),
  currentWeek,
  runLogs: [],
  workoutSessions: [],
});

const baseInput = (state: AppState, date: string, workouts: Workout[]) => ({
  state,
  date,
  workouts,
  readinessResult: readiness("Green"),
  progressionResult: progression(),
  goalTrackingResult: goalTracking(),
});

const blockKinds = (session: DailyTrainingSession) => session.blocks.map((block) => block.kind);

test("adapter maps Monday app state into a lift DailyTrainingSession", () => {
  const workout = liftWorkout();
  const session = buildPlannerSessionFromAppState(baseInput(stateWithWorkouts([workout]), "2026-06-01", [workout]));
  assert.equal(session.dayIndex, 0);
  assert.equal(session.workout?.sourceWorkoutId, workout.id);
  assert.equal(session.run, null);
  assert.ok(blockKinds(session).includes("lift"));
});

test("adapter maps run-only app state into a run DailyTrainingSession", () => {
  const workout = runWorkout();
  const session = buildPlannerSessionFromAppState(baseInput(stateWithWorkouts([workout]), "2026-06-03", [workout]));
  assert.equal(session.workout, null);
  assert.equal(session.run?.sourceWorkoutId, workout.id);
  assert.ok(blockKinds(session).includes("run"));
});

test("adapter maps red readiness into a recovery DailyTrainingSession", () => {
  const workout = liftWorkout();
  const session = buildPlannerSessionFromAppState({ ...baseInput(stateWithWorkouts([workout]), "2026-06-01", [workout]), readinessResult: readiness("Red") });
  assert.equal(session.status, "Recovery");
  assert.equal(session.workout, null);
  assert.equal(session.run, null);
  assert.ok(blockKinds(session).includes("recovery"));
});

test("adapter returns run null on no-run lift day", () => {
  const workout = liftWorkout();
  const session = buildPlannerSessionFromAppState(baseInput(stateWithWorkouts([workout]), "2026-06-01", [workout]));
  assert.equal(session.run, null);
});

test("Home and Train shadow inputs generate deterministic planner output", () => {
  const workout = runWorkout();
  const input = baseInput(stateWithWorkouts([workout]), "2026-06-03", [workout]);
  const homeShadow = buildPlannerSessionFromAppState(input);
  const trainShadow = buildPlannerSessionFromAppState({ ...input, selectedWeek: 1 });
  assert.deepEqual(trainShadow, homeShadow);
});

test("adapter preserves duration-based run logging target", () => {
  const workout = runWorkout();
  const session = buildPlannerSessionFromAppState(baseInput(stateWithWorkouts([workout]), "2026-06-03", [workout]));
  assert.equal(session.run?.prescriptionMode, "duration");
  assert.equal(session.run?.distanceMiles, null);
  assert.equal(session.run?.durationMinutes, 40);
  assert.equal(session.run?.loggingTarget.plannedDistance, null);
  assert.equal(session.run?.loggingTarget.plannedDurationMinutes, 40);
});

test("adapter preserves distance-based run logging target", () => {
  const workout = runWorkout({ id: "test-long-run", title: "Long Run", type: "long-run", longRunMiles: 4, notes: "Distance day.", exercises: [] });
  const session = buildPlannerSessionFromAppState(baseInput(stateWithWorkouts([workout]), "2026-06-03", [workout]));
  assert.equal(session.run?.prescriptionMode, "distance");
  assert.equal(session.run?.distanceMiles, 4);
  assert.equal(session.run?.loggingTarget.plannedDistance, 4);
  assert.equal(session.run?.loggingTarget.plannedDurationMinutes, null);
});

test("adapter keeps mobility session out of lift prescription", () => {
  const workout = mobilityWorkout();
  const session = buildPlannerSessionFromAppState(baseInput(stateWithWorkouts([workout]), "2026-06-07", [workout]));
  assert.equal(session.workout, null);
  assert.ok(session.mobility);
  assert.ok(!blockKinds(session).includes("lift"));
});

test("adapter missing workout returns safe rest instead of workouts[0] fallback", () => {
  const fallbackBait = liftWorkout({ id: "fallback-bait", dayIndex: 0 });
  const session = buildPlannerSessionFromAppState(baseInput(stateWithWorkouts([fallbackBait]), "2026-06-02", [fallbackBait]));
  assert.equal(session.sourcePlan.sourceWorkoutId, undefined);
  assert.equal(session.workout, null);
  assert.equal(session.run, null);
  assert.match(session.summary.title, /Unavailable|Rest/i);
});

test("adapter output contains valid workout and run logging targets", () => {
  const hybrid = liftWorkout({
    id: "hybrid",
    title: "Lift + Run",
    exercises: [
      ...liftWorkout().exercises.map((exercise) => ({ ...exercise, workoutId: "hybrid" })),
      { id: "run", workoutId: "hybrid", name: "Zone 2 Run", prescribedSets: 1, prescribedReps: "30 min", prescribedRpe: 6, category: "conditioning", order: 3 },
    ],
  });
  const session = buildPlannerSessionFromAppState(baseInput(stateWithWorkouts([hybrid]), "2026-06-01", [hybrid]));
  assert.equal(session.workout?.loggingTarget.workoutId, "hybrid");
  assert.equal(session.workout?.loggingTarget.date, "2026-06-01");
  assert.equal(session.run?.loggingTarget.date, "2026-06-01");
  assert.equal(session.run?.loggingTarget.plannedDurationMinutes, 30);
});

test("comparePlannerVsLegacy returns planner and legacy names plus match booleans", () => {
  const workout = runWorkout();
  const session = buildPlannerSessionFromAppState(baseInput(stateWithWorkouts([workout]), "2026-06-03", [workout]));
  const comparison = comparePlannerVsLegacy({
    plannerSession: session,
    legacyWorkout: null,
    legacyRun: "Zone 2 Run",
  });
  assert.equal(comparison.plannerWorkout, null);
  assert.equal(comparison.legacyWorkout, null);
  assert.equal(comparison.plannerRun, "Zone 2 Run");
  assert.equal(comparison.legacyRun, "Zone 2 Run");
  assert.equal(comparison.workoutMatch, true);
  assert.equal(comparison.runMatch, true);
});

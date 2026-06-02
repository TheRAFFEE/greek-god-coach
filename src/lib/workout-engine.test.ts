import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  buildWorkoutEngineInputFromSession,
  calculateDataQualityScore,
  calculateEstimatedOneRepMax,
  calculateFatigue,
  calculateMuscleGroupVolume,
  calculateWorkoutConfidenceScore,
  evaluateWorkout,
  type WorkoutEngineInput,
} from "./workout-engine";
import type { SetLog, WorkoutSession } from "./types";

const setLog = (overrides: Partial<SetLog> = {}): SetLog & { date: string } => ({
  id: overrides.id ?? "set-1",
  sessionId: overrides.sessionId ?? "session-1",
  userId: overrides.userId ?? "user-1",
  workoutId: overrides.workoutId ?? "workout-1",
  exerciseId: overrides.exerciseId ?? "bench",
  exerciseName: overrides.exerciseName ?? "Bench Press",
  setNumber: overrides.setNumber ?? 1,
  targetReps: overrides.targetReps ?? "5",
  targetRpe: overrides.targetRpe ?? 8,
  weightUsed: overrides.weightUsed ?? 185,
  repsCompleted: overrides.repsCompleted ?? 5,
  rpe: overrides.rpe ?? 8,
  pain: overrides.pain ?? false,
  formQuality: overrides.formQuality ?? "solid",
  completedAt: overrides.completedAt ?? "2026-06-01T12:00:00.000Z",
  notes: overrides.notes ?? "",
  date: (overrides.completedAt ?? "2026-06-01T12:00:00.000Z").slice(0, 10),
});

const session = (sets: SetLog[]): WorkoutSession => ({
  id: "session-1",
  userId: "user-1",
  workoutId: "workout-1",
  workoutTitle: "Upper Strength",
  mode: "coach",
  startedAt: "2026-06-01T12:00:00.000Z",
  endedAt: "2026-06-01T13:00:00.000Z",
  status: "completed",
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  setLogs: sets,
});

const baseInput = (overrides: Partial<WorkoutEngineInput> = {}): WorkoutEngineInput => {
  const sets = [
    setLog({ id: "bench-1", setNumber: 1, exerciseId: "bench", exerciseName: "Bench Press", weightUsed: 185, repsCompleted: 5, rpe: 8 }),
    setLog({ id: "bench-2", setNumber: 2, exerciseId: "bench", exerciseName: "Bench Press", weightUsed: 185, repsCompleted: 5, rpe: 8 }),
    setLog({ id: "row-1", setNumber: 1, exerciseId: "row", exerciseName: "Row", weightUsed: 155, repsCompleted: 8, rpe: 7 }),
  ];
  return {
    generatedAt: "2026-06-01T13:00:00.000Z",
    evaluationDate: "2026-06-01",
    userId: "user-1",
    currentSession: {
      id: "session-1",
      date: "2026-06-01",
      workoutId: "workout-1",
      workoutTitle: "Upper Strength",
      mode: "coach",
      status: "completed",
      exercises: [],
    },
    setLogs: sets,
    workoutSessions: [
      { id: "session-old", date: "2026-05-25", workoutId: "workout-1", workoutTitle: "Upper Strength", status: "completed", setLogs: [setLog({ id: "old", completedAt: "2026-05-25T12:00:00.000Z", weightUsed: 175, repsCompleted: 5 })] },
      { id: "session-1", date: "2026-06-01", workoutId: "workout-1", workoutTitle: "Upper Strength", status: "completed", setLogs: sets },
    ],
    exerciseCatalog: [
      { id: "bench", name: "Bench Press", primaryMuscleGroup: "chest", secondaryMuscleGroups: ["shoulders", "arms"], movementPattern: "horizontal-push", progressionType: "load", substitutionIds: ["db-bench"] },
      { id: "row", name: "Row", primaryMuscleGroup: "back", secondaryMuscleGroups: ["arms"], movementPattern: "horizontal-pull", progressionType: "load" },
      { id: "squat", name: "Squat", primaryMuscleGroup: "legs", secondaryMuscleGroups: ["core"], movementPattern: "squat", progressionType: "load" },
      { id: "plank", name: "Plank", primaryMuscleGroup: "core", movementPattern: "anti-extension", progressionType: "time" },
    ],
    readiness: { status: "Green", score: 85, sleepHours: 7, soreness: 4, confidence: "High" },
    recovery: { sorenessByMuscleGroup: { chest: 4, back: 4 }, sleepHours: 7 },
    goals: { primaryGoal: "hybrid", physiqueGoal: "Greek God physique", fatLossPhase: true, priorityMuscleGroups: ["chest", "back", "shoulders"] },
    ...overrides,
  };
};

test("Workout Engine V2 returns canonical result with Progress decision, volume, PRs, confidence, data quality, explanation, and audit trail", () => {
  const result = evaluateWorkout(baseInput());

  assert.equal(result.overallDecision, "Progress");
  assert.equal(result.workoutRecommendation.action, "Progress");
  assert.ok(result.exerciseDecisions.length >= 2);
  assert.ok(result.muscleGroupVolume.some((volume) => volume.muscleGroup === "chest" && volume.weeklySets >= 2));
  assert.ok(result.rollingFourWeekVolume.some((volume) => volume.muscleGroup === "back"));
  assert.ok(result.prs.newPrs.some((pr) => pr.type === "estimated-1rm"));
  assert.ok(result.confidenceScore >= 80);
  assert.ok(result.dataQualityScore >= 80);
  assert.match(result.explanation.summary, /Workout Engine V2/i);
  assert.ok(result.auditTrail.some((entry) => entry.decisionType === "overall-recommendation"));
});

test("Workout Engine V2 supports Repeat, Reduce, Deload, and Substitute decisions", () => {
  const repeat = evaluateWorkout(baseInput({ setLogs: [setLog({ rpe: 8, repsCompleted: 5 })], workoutSessions: [] }));
  assert.equal(repeat.overallDecision, "Repeat");

  const reduce = evaluateWorkout(baseInput({ setLogs: [setLog({ rpe: 9, repsCompleted: 3, formQuality: "minor breakdown" })], readiness: { status: "Yellow", score: 62, sleepHours: 6, soreness: 7 } }));
  assert.equal(reduce.overallDecision, "Reduce");

  const deload = evaluateWorkout(baseInput({ setLogs: [setLog({ rpe: 10, repsCompleted: 2, formQuality: "missed" })], readiness: { status: "Red", score: 35, sleepHours: 4.5, soreness: 9 } }));
  assert.equal(deload.overallDecision, "Deload");
  assert.equal(deload.deload.needed, true);

  const substitute = evaluateWorkout(baseInput({ setLogs: [setLog({ pain: true, notes: "sharp shoulder pain", rpe: 8 })], readiness: { status: "Yellow", score: 60, sleepHours: 6, soreness: 6 } }));
  assert.equal(substitute.overallDecision, "Substitute");
  assert.ok(substitute.substitutions.some((item) => item.shouldSubstitute));
});

test("calculates estimated 1RM with Epley and tracks muscle group volume using primary and secondary sets", () => {
  assert.equal(calculateEstimatedOneRepMax({ weightUsed: 185, repsCompleted: 5, rpe: 8, formQuality: "solid" }), 216);
  assert.equal(calculateEstimatedOneRepMax({ weightUsed: 185, repsCompleted: 13, rpe: 8, formQuality: "solid" }), null);

  const volume = calculateMuscleGroupVolume(baseInput());
  const chest = volume.find((item) => item.muscleGroup === "chest");
  const arms = volume.find((item) => item.muscleGroup === "arms");
  assert.equal(chest?.weeklySets, 2);
  assert.equal(arms?.weeklySets, 1.5);
});

test("fatigue, confidence, and data quality respond to missing or risky workout data", () => {
  const risky = baseInput({ setLogs: [setLog({ pain: true, rpe: 10, repsCompleted: 1, formQuality: "missed" })], readiness: { status: "Red", score: 30, sleepHours: 4, soreness: 9 } });
  const fatigue = calculateFatigue(risky, calculateMuscleGroupVolume(risky));
  assert.equal(fatigue.fatigueStatus, "severe");

  const sparse = baseInput({ exerciseCatalog: [], workoutSessions: [], readiness: undefined });
  assert.ok(calculateWorkoutConfidenceScore(sparse) < 80);
  assert.ok(calculateDataQualityScore(sparse) < 80);
});

test("buildWorkoutEngineInputFromSession adapts legacy WorkoutSession data without UI changes", () => {
  const adapted = buildWorkoutEngineInputFromSession({
    session: session([setLog({ exerciseId: "bench", exerciseName: "Bench Press" })]),
    recovery: { sorenessLevel: 4, sleepHours: 7 },
  });

  assert.equal(adapted.userId, "user-1");
  assert.equal(adapted.setLogs.length, 1);
  assert.ok(adapted.exerciseCatalog.some((exercise) => exercise.id === "bench" && exercise.primaryMuscleGroup === "chest"));
});

import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { AppState } from "./types";
import { buildWorkoutLoggerSession, evaluateWorkoutLoggerResult, saveWorkoutLoggerEntry } from "./workout-logger";

const input = {
  id: "manual-workout-1",
  userId: "user-1",
  date: "2026-06-01",
  workoutType: "upper strength" as const,
  exercises: [
    { id: "ex-1", name: "Bench Press", sets: 3, reps: 5, weight: 185, rpe: 8, painNotes: "", completed: true },
    { id: "ex-2", name: "Row", sets: 3, reps: 8, weight: 155, rpe: 7, painNotes: "", completed: true },
  ],
  completed: true,
  sorenessLevel: 4,
  sleepHours: 7,
};

test("builds a workout session and set logs from required workout logger fields", () => {
  const session = buildWorkoutLoggerSession(input);

  assert.equal(session.workoutTitle, "upper strength");
  assert.equal(session.status, "completed");
  assert.equal(session.setLogs.length, 6);
  assert.equal(session.setLogs[0].exerciseName, "Bench Press");
  assert.equal(session.setLogs[0].weightUsed, 185);
  assert.equal(session.setLogs[0].repsCompleted, 5);
  assert.equal(session.setLogs[0].rpe, 8);
});

test("summarizes a clean completed workout with progression suggestion", () => {
  const session = buildWorkoutLoggerSession(input);
  const result = evaluateWorkoutLoggerResult(session, { sorenessLevel: 4, sleepHours: 7 });

  assert.equal(result.summary.totalSets, 6);
  assert.equal(result.summary.totalReps, 39);
  assert.equal(result.summary.estimatedVolume, 6495);
  assert.equal(result.nextProgression.action, "progress");
  assert.match(result.nextProgression.message, /increase load/i);
  assert.equal(result.volumeWarning, null);
});

test("repeats or holds progression when reps are missed or RPE is too high", () => {
  const session = buildWorkoutLoggerSession({
    ...input,
    exercises: [{ id: "ex-1", name: "Squat", sets: 3, reps: 4, weight: 225, rpe: 9, painNotes: "", completed: false }],
    completed: false,
  });
  const result = evaluateWorkoutLoggerResult(session, { sorenessLevel: 5, sleepHours: 7 });

  assert.equal(result.nextProgression.action, "repeat");
  assert.match(result.nextProgression.message, /repeat/i);
});

test("warns to reduce volume when soreness is high or sleep is low", () => {
  const session = buildWorkoutLoggerSession(input);
  const result = evaluateWorkoutLoggerResult(session, { sorenessLevel: 8, sleepHours: 5.5 });

  assert.equal(result.volumeWarning?.reductionPercent, 30);
  assert.match(result.volumeWarning?.message ?? "", /reduce lifting volume/i);
});

test("saves one workout per date and stores summary plus progression", () => {
  const state = {
    user: { id: "user-1" },
    workoutSessions: [buildWorkoutLoggerSession({ ...input, id: "old", date: "2026-06-01" })],
    workoutSummaries: [],
    postWorkoutRecommendations: [],
  } as unknown as AppState;
  const session = buildWorkoutLoggerSession({ ...input, id: "new", date: "2026-06-01" });
  const saved = saveWorkoutLoggerEntry(state, session, { sorenessLevel: 4, sleepHours: 7 });

  assert.equal(saved.state.workoutSessions.length, 1);
  assert.equal(saved.state.workoutSessions[0].id, "new");
  assert.equal(saved.state.workoutSummaries.length, 1);
  assert.equal(saved.state.postWorkoutRecommendations[0].action, "progress");
});

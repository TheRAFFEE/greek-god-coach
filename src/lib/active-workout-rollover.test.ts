import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { AppState, SetLog, WorkoutSession } from "./types";
import { createInitialState } from "./seed-data";
import { resolveActiveWorkoutForToday } from "./active-workout-rollover";

const userId = "user-1";
const workoutId = "workout-a";
const otherWorkoutId = "workout-b";

function setLog(overrides: Partial<SetLog> = {}): SetLog {
  return {
    id: "set-1",
    sessionId: "session-active",
    userId,
    workoutId,
    exerciseId: "bench",
    exerciseName: "Bench Press",
    setNumber: 1,
    targetReps: "8",
    targetRpe: 8,
    weightUsed: 135,
    repsCompleted: 8,
    rpe: 7,
    pain: false,
    formQuality: "solid",
    completedAt: "2026-06-08T10:15:00.000Z",
    ...overrides,
  };
}

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "session-active",
    userId,
    workoutId,
    workoutTitle: "Upper Strength",
    mode: "coach",
    startedAt: "2026-06-08T10:00:00.000Z",
    status: "active",
    currentExerciseIndex: 1,
    currentSetNumber: 2,
    setLogs: [setLog()],
    ...overrides,
  };
}

function stateWithSessions(workoutSessions: WorkoutSession[]): AppState {
  return {
    ...createInitialState(),
    user: { ...createInitialState().user, id: userId },
    workoutSessions,
  };
}

test("same-day unfinished active workout resumes with existing session progress", () => {
  const active = session({ date: "2026-06-08" });
  const result = resolveActiveWorkoutForToday(stateWithSessions([active]), {
    workoutId,
    today: "2026-06-08",
  });

  assert.equal(result.resumableSession?.id, active.id);
  assert.equal(result.resumableSession?.currentExerciseIndex, 1);
  assert.equal(result.resumableSession?.currentSetNumber, 2);
  assert.equal(result.resumableSession?.setLogs.length, 1);
  assert.equal(result.staleSessions.length, 0);
});

test("next-day unfinished active workout does not resume and is reported stale", () => {
  const stale = session({ date: "2026-06-08" });
  const result = resolveActiveWorkoutForToday(stateWithSessions([stale]), {
    workoutId,
    today: "2026-06-09",
  });

  assert.equal(result.resumableSession, null);
  assert.deepEqual(result.staleSessions.map((item) => item.id), [stale.id]);
});

test("completed prior workout remains preserved in history and is not treated as stale active state", () => {
  const completed = session({
    id: "session-completed",
    date: "2026-06-08",
    status: "completed",
    endedAt: "2026-06-08T11:00:00.000Z",
  });
  const appState = stateWithSessions([completed]);
  const result = resolveActiveWorkoutForToday(appState, {
    workoutId,
    today: "2026-06-09",
  });

  assert.equal(result.resumableSession, null);
  assert.equal(result.staleSessions.length, 0);
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].id, completed.id);
  assert.equal(result.history[0].status, "completed");
});

test("today prescribed workout can load after rollover instead of stale prior active workout", () => {
  const stale = session({ date: "2026-06-08", workoutId });
  const result = resolveActiveWorkoutForToday(stateWithSessions([stale]), {
    workoutId: otherWorkoutId,
    today: "2026-06-09",
  });

  assert.equal(result.resumableSession, null);
  assert.equal(result.canStartTodayPrescription, true);
  assert.equal(result.todayWorkoutId, otherWorkoutId);
});

test("old currentExercise/currentSet/sessionProgress do not leak into today's active workout", () => {
  const stale = session({
    date: "2026-06-08",
    currentExerciseIndex: 3,
    currentSetNumber: 4,
    setLogs: [setLog(), setLog({ id: "set-2", setNumber: 2 })],
  });
  const result = resolveActiveWorkoutForToday(stateWithSessions([stale]), {
    workoutId,
    today: "2026-06-09",
  });

  assert.equal(result.resumableSession, null);
  assert.equal(result.resumeProgress, null);
  assert.deepEqual(result.staleSessions.map((item) => ({ id: item.id, currentExerciseIndex: item.currentExerciseIndex, currentSetNumber: item.currentSetNumber, setCount: item.setLogs.length })), [
    { id: stale.id, currentExerciseIndex: 3, currentSetNumber: 4, setCount: 2 },
  ]);
});

test("legacy sessions without date use their local startedAt calendar date", () => {
  const active = session({ startedAt: "2026-06-08T23:30:00.000Z" });
  const result = resolveActiveWorkoutForToday(stateWithSessions([active]), {
    workoutId,
    today: "2026-06-09",
    timeZone: "Europe/London",
  });

  assert.equal(result.resumableSession?.id, active.id);
});

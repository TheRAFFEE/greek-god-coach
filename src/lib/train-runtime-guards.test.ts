import { test } from "node:test";
import * as assert from "node:assert/strict";
import { createInitialState } from "./seed-data";
import type { AppState, WorkoutSession } from "./types";
import { buildTrainRuntimeStatus, normalizeTrainReadiness } from "./train-runtime-guards";

const today = "2026-06-09";
const workout = { id: "workout-a", title: "Upper Strength", exercises: [{ id: "bench" }] };

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "session-a",
    userId: "user-1",
    workoutId: "workout-a",
    workoutTitle: "Upper Strength",
    mode: "coach",
    date: today,
    startedAt: `${today}T10:00:00.000Z`,
    status: "active",
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    setLogs: [],
    ...overrides,
  };
}

function appState(workoutSessions: WorkoutSession[] = []): AppState {
  return { ...createInitialState(), workoutSessions };
}

test("Train loads with no activeWorkout", () => {
  const result = buildTrainRuntimeStatus({ state: appState(), workout, readiness: null, today });

  assert.equal(result.activeSession, null);
  assert.equal(result.canStartTodayPrescription, true);
  assert.equal(result.hasPrescribedWorkout, true);
  assert.equal(result.emptyState, null);
  assert.equal(result.readiness.status, "Yellow");
});

test("Train loads with stale prior-day active workout and does not resume it", () => {
  const stale = session({ date: "2026-06-08", startedAt: "2026-06-08T10:00:00.000Z" });
  const result = buildTrainRuntimeStatus({ state: appState([stale]), workout, readiness: { status: "Green", score: 80, reason: "Ready", recommendation: "Train" }, today });

  assert.equal(result.activeSession, null);
  assert.equal(result.canStartTodayPrescription, true);
});

test("Train loads with malformed legacy active workout missing date and startedAt", () => {
  const malformed = session({ date: undefined, startedAt: undefined as unknown as string });

  assert.doesNotThrow(() => buildTrainRuntimeStatus({ state: appState([malformed]), workout, readiness: null, today }));
  const result = buildTrainRuntimeStatus({ state: appState([malformed]), workout, readiness: null, today });
  assert.equal(result.activeSession, null);
  assert.equal(result.canStartTodayPrescription, true);
});

test("Train loads with no prescribed workout as a clean empty state", () => {
  const result = buildTrainRuntimeStatus({ state: appState(), workout: null, readiness: null, today });

  assert.equal(result.hasPrescribedWorkout, false);
  assert.equal(result.activeSession, null);
  assert.equal(result.canStartTodayPrescription, false);
  assert.match(result.emptyState?.title ?? "", /No prescribed workout/i);
});

test("Train loads after Phase 27N/27P rollover state", () => {
  const rolloverState = appState([
    session({ id: "stale-active", date: "2026-06-08", startedAt: "2026-06-08T23:30:00.000Z", currentExerciseIndex: 2, currentSetNumber: 3 }),
    session({ id: "today-completed", status: "completed", date: today, startedAt: `${today}T08:00:00.000Z`, endedAt: `${today}T09:00:00.000Z` }),
  ]);
  const result = buildTrainRuntimeStatus({ state: rolloverState, workout, readiness: null, today });

  assert.equal(result.activeSession, null);
  assert.equal(result.liftCompleted, true);
  assert.equal(result.readiness.reason, "No Daily Check-In has been saved for today.");
});

test("Train resumes same-day active session", () => {
  const active = session({ id: "today-active", date: today });
  const result = buildTrainRuntimeStatus({ state: appState([active]), workout, readiness: { status: "Green", score: 82, reason: "Ready", recommendation: "Train" }, today });

  assert.equal(result.activeSession?.id, "today-active");
  assert.equal(result.canStartTodayPrescription, false);
});

test("Train readiness fallback is null-safe when today's check-in is missing", () => {
  const result = normalizeTrainReadiness(null);

  assert.equal(result.status, "Yellow");
  assert.match(result.recommendation, /Daily Check-In/i);
});

import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { AppState, DailyCheckIn } from "./types";
import { deriveDailyCompletionStatus, evaluateDailyRecoveryStatus, upsertDailyCheckIn } from "./daily-checkin";

const baseCheckIn: DailyCheckIn = {
  id: "check-base",
  userId: "user-1",
  date: "2026-06-01",
  weight: 232.4,
  sleepHours: 7.2,
  sleepQuality: 4,
  soreness: 3,
  energy: 7,
  stress: 3,
  hunger: 4,
  motivation: 7,
  alcohol: false,
  steps: 8500,
  restingHr: 58,
  hrv: 60,
  pain: false,
  painLocation: "",
  painSeverity: 0,
  workoutCompleted: true,
  runCompleted: true,
  macrosHit: true,
  notes: "felt solid",
};

test("evaluates Green recovery when sleep, soreness, stress, and energy support normal training", () => {
  const result = evaluateDailyRecoveryStatus(baseCheckIn);

  assert.equal(result.status, "Green");
  assert.equal(result.recommendation, "Follow the plan as written.");
  assert.match(result.reasoning, /Recovery markers support normal training/i);
});

test("evaluates Yellow recovery when unified caution rules are present", () => {
  const result = evaluateDailyRecoveryStatus({
    ...baseCheckIn,
    sleepHours: 6,
    soreness: 6,
    stress: 6,
    energy: 8,
  });

  assert.equal(result.status, "Yellow");
  assert.equal(result.recommendation, "Modify today's training dose.");
  assert.match(result.reasoning, /sleep 6-7 hours/i);
  assert.match(result.reasoning, /moderate soreness/i);
  assert.match(result.reasoning, /elevated stress/i);
});

test("evaluates Red recovery with the most conservative documented priority rule", () => {
  const result = evaluateDailyRecoveryStatus({
    ...baseCheckIn,
    sleepHours: 4.75,
    soreness: 8,
    stress: 5,
    energy: 1,
  });

  assert.equal(result.status, "Red");
  assert.equal(result.recommendation, "Prioritize recovery, mobility, and walking only.");
  assert.match(result.reasoning, /sleep under 5 hours/i);
  assert.match(result.reasoning, /severe soreness/i);
});

test("alcohol is a small deduction but does not hide Red recovery risk", () => {
  assert.equal(evaluateDailyRecoveryStatus({ ...baseCheckIn, alcohol: true }).status, "Green");
  assert.equal(evaluateDailyRecoveryStatus({ ...baseCheckIn, alcohol: true, sleepHours: 4.5, energy: 2 }).status, "Red");
});

test("derives daily completion status from workout and run logs on the same date", () => {
  const state = {
    workoutSessions: [{ id: "workout-1", userId: "user-1", workoutId: "w1", workoutTitle: "Upper", mode: "coach", startedAt: "2026-06-01T08:00:00.000Z", status: "completed", currentExerciseIndex: 0, currentSetNumber: 1, setLogs: [] }],
    runLogs: [{ id: "run-1", userId: "user-1", date: "2026-06-01", plannedDistance: 3, actualDistance: 3, durationMinutes: 30, averagePace: 10, averageHr: 145, maxHr: 160, rpe: 6, zone2Compliance: 80, completed: true, notes: "" }],
  } as unknown as AppState;

  assert.deepEqual(deriveDailyCompletionStatus(state, "2026-06-01"), {
    workoutCompleted: true,
    runCompleted: true,
  });
});

test("ignores manual daily check-in completion answers and saves derived completion", () => {
  const state = {
    user: { id: "user-1" },
    checkIns: [{ ...baseCheckIn, id: "old-check", weight: 234, notes: "old", workoutCompleted: true, runCompleted: true }],
    bodyMetrics: [{ id: "old-metric", userId: "user-1", date: baseCheckIn.date, weight: 234, notes: "old metric" }],
    workoutSessions: [],
    runLogs: [],
  } as unknown as AppState;

  const next = upsertDailyCheckIn(state, { ...baseCheckIn, id: "new-check", weight: 231.8, notes: "updated", workoutCompleted: true, runCompleted: true }, "metric-fixed");

  assert.equal(next.checkIns.length, 1);
  assert.equal(next.checkIns[0].id, "new-check");
  assert.equal(next.checkIns[0].workoutCompleted, false);
  assert.equal(next.checkIns[0].runCompleted, false);
  assert.equal(next.bodyMetrics.length, 1);
  assert.deepEqual(next.bodyMetrics[0], {
    id: "metric-fixed",
    userId: "user-1",
    date: baseCheckIn.date,
    weight: 231.8,
    notes: "from daily check-in",
  });
});

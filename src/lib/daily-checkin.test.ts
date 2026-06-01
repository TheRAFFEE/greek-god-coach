import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { AppState, DailyCheckIn } from "./types";
import { evaluateDailyRecoveryStatus, upsertDailyCheckIn } from "./daily-checkin";

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

test("evaluates Yellow recovery when documented caution rules are present", () => {
  const result = evaluateDailyRecoveryStatus({
    ...baseCheckIn,
    sleepHours: 5.8,
    soreness: 6,
    stress: 4,
    energy: 2,
  });

  assert.equal(result.status, "Yellow");
  assert.equal(result.recommendation, "Modify today's training dose.");
  assert.match(result.reasoning, /sleep is between 5 and 6.5 hours/i);
  assert.match(result.reasoning, /soreness is 6-7/i);
  assert.match(result.reasoning, /energy is 2/i);
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
  assert.match(result.reasoning, /sleep is under 5 hours/i);
  assert.match(result.reasoning, /soreness is 8 or higher/i);
});

test("alcohol escalates a borderline day to Yellow but does not hide Red recovery risk", () => {
  assert.equal(evaluateDailyRecoveryStatus({ ...baseCheckIn, alcohol: true }).status, "Yellow");
  assert.equal(evaluateDailyRecoveryStatus({ ...baseCheckIn, alcohol: true, sleepHours: 4.5 }).status, "Red");
});

test("upserts one daily check-in per date and writes a matching body metric", () => {
  const state = {
    user: { id: "user-1" },
    checkIns: [{ ...baseCheckIn, id: "old-check", weight: 234, notes: "old" }],
    bodyMetrics: [{ id: "old-metric", userId: "user-1", date: baseCheckIn.date, weight: 234, notes: "old metric" }],
  } as AppState;

  const next = upsertDailyCheckIn(state, { ...baseCheckIn, id: "new-check", weight: 231.8, notes: "updated" }, "metric-fixed");

  assert.equal(next.checkIns.length, 1);
  assert.equal(next.checkIns[0].id, "new-check");
  assert.equal(next.checkIns[0].runCompleted, true);
  assert.equal(next.bodyMetrics.length, 1);
  assert.deepEqual(next.bodyMetrics[0], {
    id: "metric-fixed",
    userId: "user-1",
    date: baseCheckIn.date,
    weight: 231.8,
    notes: "from daily check-in",
  });
});

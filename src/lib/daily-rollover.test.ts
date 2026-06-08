import test from "node:test";
import * as assert from "node:assert/strict";
import { createInitialState } from "./seed-data";
import type { AppState, DailyCheckIn, NutritionLog, RunLog, WorkoutSession } from "./types";
import { buildDailyRolloverContext, getLocalCalendarDateIso } from "./daily-rollover";

function checkIn(date: string, overrides: Partial<DailyCheckIn> = {}): DailyCheckIn {
  return {
    id: `check-${date}`,
    userId: "user-1",
    date,
    weight: 230,
    sleepHours: 7,
    sleepQuality: 4,
    soreness: 3,
    energy: 7,
    stress: 3,
    hunger: 5,
    motivation: 7,
    alcohol: false,
    steps: 8000,
    restingHr: 58,
    hrv: 60,
    pain: false,
    painLocation: "",
    painSeverity: 0,
    workoutCompleted: false,
    runCompleted: false,
    macrosHit: false,
    notes: "",
    ...overrides,
  };
}

function stateWith(overrides: Partial<AppState>): AppState {
  return { ...createInitialState(), checkIns: [], nutritionLogs: [], runLogs: [], workoutSessions: [], ...overrides };
}

test("getLocalCalendarDateIso uses the local calendar date instead of UTC ISO slicing", () => {
  const lateCentralEvening = new Date("2026-06-08T23:30:00-05:00");

  assert.equal(lateCentralEvening.toISOString().slice(0, 10), "2026-06-09");
  assert.equal(getLocalCalendarDateIso(lateCentralEvening, "en-US", "America/Chicago"), "2026-06-08");
});

test("daily rollover context derives current week from plan start date and local today", () => {
  const state = stateWith({ currentWeek: 1, startDate: "2026-05-24" });

  assert.equal(buildDailyRolloverContext(state, { today: "2026-06-08" }).currentWeek, 3);
  assert.equal(buildDailyRolloverContext(state, { today: "2026-06-09" }).currentWeek, 3);
  assert.equal(buildDailyRolloverContext(state, { today: "2026-06-15" }).currentWeek, 4);
});

test("daily rollover context resolves today check-in first and never reuses a prior-day check-in", () => {
  const state = stateWith({
    checkIns: [checkIn("2026-06-08", { sleepHours: 8, energy: 9, notes: "yesterday" })],
  });

  const dayN = buildDailyRolloverContext(state, { today: "2026-06-08" });
  const dayNPlus1 = buildDailyRolloverContext(state, { today: "2026-06-09" });

  assert.equal(dayN.todayCheckIn?.date, "2026-06-08");
  assert.equal(dayN.recoveryStatus.status, "available");
  assert.equal(dayNPlus1.todayCheckIn, null);
  assert.equal(dayNPlus1.latestPriorCheckIn?.date, "2026-06-08");
  assert.equal(dayNPlus1.recoveryStatus.status, "missing");
  assert.match(dayNPlus1.recoveryStatus.message, /today/i);
});

test("daily rollover context keeps missing nutrition explicit for the current day", () => {
  const nutritionLog: NutritionLog = { id: "nutrition-1", userId: "user-1", date: "2026-06-08", calories: 2200, protein: 210, carbs: 180, fat: 70, fiber: 30, water: 100, sodium: 0, alcohol: 0, notes: "" };
  const state = stateWith({ nutritionLogs: [nutritionLog] });

  assert.equal(buildDailyRolloverContext(state, { today: "2026-06-08" }).nutritionStatus.status, "available");
  assert.equal(buildDailyRolloverContext(state, { today: "2026-06-09" }).nutritionStatus.status, "missing");
});

test("daily rollover context keeps workout and run completion scoped to the current day", () => {
  const runLog: RunLog = { id: "run-1", userId: "user-1", date: "2026-06-08", runType: "easy", plannedDistance: 3, actualDistance: 3, durationMinutes: 30, averagePace: 10, averageHr: 140, maxHr: 155, rpe: 5, zone2Compliance: 90, completed: true, walkBreaks: false, pain: false, painScore: 0, painLocation: "", notes: "" };
  const session: WorkoutSession = { id: "session-1", userId: "user-1", workoutId: "workout-1", workoutTitle: "Lift", mode: "coach", startedAt: "2026-06-08T18:00:00.000Z", endedAt: "2026-06-08T19:00:00.000Z", status: "completed", currentExerciseIndex: 0, currentSetNumber: 1, setLogs: [] };
  const state = stateWith({ runLogs: [runLog], workoutSessions: [session] });

  const dayN = buildDailyRolloverContext(state, { today: "2026-06-08" });
  const dayNPlus1 = buildDailyRolloverContext(state, { today: "2026-06-09" });

  assert.equal(dayN.completionStatus.runCompleted, true);
  assert.equal(dayN.completionStatus.workoutCompleted, true);
  assert.equal(dayNPlus1.completionStatus.runCompleted, false);
  assert.equal(dayNPlus1.completionStatus.workoutCompleted, false);
});

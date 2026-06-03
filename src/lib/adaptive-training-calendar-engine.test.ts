import { test } from "node:test";
import * as assert from "node:assert/strict";
import { evaluateAdaptiveTrainingCalendar, type AdaptiveTrainingCalendarInput } from "./adaptive-training-calendar-engine";

const today = new Date("2026-01-01T00:00:00Z");

type CalendarWeekShape = {
  weekNumber: number;
  phase: string;
  mileageTrend: string;
  targetLongRun: number;
  targetWeeklyMileage: number;
  focus: string;
};

function weeks(): CalendarWeekShape[] {
  return result().calendarWeeks as CalendarWeekShape[];
}

function daysFromToday(days: number): Date {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function result(overrides: Partial<AdaptiveTrainingCalendarInput> = {}) {
  return evaluateAdaptiveTrainingCalendar({
    today,
    raceDate: daysFromToday(112),
    raceType: "HalfMarathon",
    currentLongestRun: 6,
    currentWeeklyMileage: 20,
    targetRacePace: 9,
    predictedRacePace: 9.05,
    ...overrides,
  });
}

test("Calendar generation", () => {
  const evaluated = result();
  assert.equal(evaluated.totalWeeksRemaining, 16);
  assert.equal(evaluated.currentTrainingWeek, 1);
  assert.equal(evaluated.calendarWeeks.length, 16);
});

test("Base phase generation", () => {
  const baseWeeks = weeks().filter((week) => week.phase === "Base");
  assert.equal(baseWeeks.length, 4);
  assert.equal(baseWeeks[0]?.focus, "Aerobic Base");
});

test("Build phase generation", () => {
  const buildWeeks = weeks().filter((week) => week.phase === "Build");
  assert.equal(buildWeeks.length, 5);
  assert.equal(buildWeeks[0]?.focus, "Mileage Development");
});

test("Peak phase generation", () => {
  const peakWeeks = weeks().filter((week) => week.phase === "Peak");
  assert.equal(peakWeeks.length, 4);
  assert.equal(peakWeeks[0]?.focus, "Race Specific Fitness");
});

test("Taper generation", () => {
  const taperWeeks = weeks().filter((week) => week.phase === "Taper");
  assert.equal(taperWeeks.length, 2);
  assert.equal(taperWeeks[0]?.focus, "Recovery + Sharpness");
});

test("Race week generation", () => {
  const raceWeek = weeks().at(-1);
  assert.equal(raceWeek?.phase, "RaceWeek");
  assert.equal(raceWeek?.focus, "Race Execution");
  assert.equal(raceWeek?.targetLongRun, 0);
});

test("Deload insertion", () => {
  const week4 = weeks().find((week) => week.weekNumber === 4);
  assert.equal(week4?.mileageTrend, "Deload");
});

test("Deload every fourth week", () => {
  const deloadWeeks = weeks().filter((week) => week.mileageTrend === "Deload").map((week) => week.weekNumber);
  assert.deepEqual(deloadWeeks, [4, 8, 12]);
});

test("Long run progression", () => {
  const calendarWeeks = weeks();
  assert.equal(calendarWeeks[0]?.targetLongRun, 6);
  assert.equal(calendarWeeks.find((week) => week.phase === "Build")?.targetLongRun, 8);
  assert.equal(calendarWeeks.find((week) => week.phase === "Peak")?.targetLongRun, 10);
  assert.equal(calendarWeeks.find((week) => week.targetLongRun === 13)?.phase, "Peak");
});

test("Mileage progression", () => {
  const calendarWeeks = weeks();
  assert.equal(calendarWeeks[0]?.targetWeeklyMileage, 22);
  assert.ok((calendarWeeks[1]?.targetWeeklyMileage ?? 0) > (calendarWeeks[0]?.targetWeeklyMileage ?? 0));
  const week4 = calendarWeeks.find((week) => week.weekNumber === 4);
  assert.equal(week4?.targetWeeklyMileage, 20);
});

test("Milestone generation", () => {
  assert.equal(result().nextMilestone, "Reach first 10 mile run");
  assert.equal(result({ raceDate: daysFromToday(42), currentLongestRun: 11 }).nextMilestone, "Race taper begins");
});

test("Peak week calculation", () => {
  assert.equal(result().expectedPeakWeek, 13);
});

test("Peak mileage calculation", () => {
  const evaluated = result();
  assert.equal(evaluated.expectedPeakMileage, "30-40 miles");
});

test("Peak long run calculation", () => {
  assert.equal(result().expectedPeakLongRun, 13);
});

test("Summary generation", () => {
  const evaluated = result({ raceDate: daysFromToday(70), currentLongestRun: 8 });
  assert.match(evaluated.summary, /week 7 of a 16 week build/);
  assert.match(evaluated.summary, /Peak phase begins in 3 weeks/);
  assert.match(evaluated.summary, /Next milestone is Reach first 10 mile run/);
});

test("Audit generation", () => {
  const evaluated = result();
  assert.ok(evaluated.auditTrail.some((entry: string) => entry.includes("Phase assignments")));
  assert.ok(evaluated.auditTrail.some((entry: string) => entry.includes("Deload placement")));
  assert.ok(evaluated.auditTrail.some((entry: string) => entry.includes("Mileage targets")));
  assert.ok(evaluated.auditTrail.some((entry: string) => entry.includes("Milestone selected")));
});

test("Missing data handling", () => {
  const evaluated = result({ currentLongestRun: undefined, currentWeeklyMileage: undefined, targetRacePace: undefined, predictedRacePace: undefined });
  assert.equal(evaluated.calendarWeeks[0]?.targetLongRun, 6);
  assert.equal(evaluated.calendarWeeks[0]?.targetWeeklyMileage, 18);
  assert.equal(evaluated.nextMilestone, "Reach first 10 mile run");
});

test("Deterministic output", () => {
  const input: AdaptiveTrainingCalendarInput = { today, raceDate: daysFromToday(112), raceType: "HalfMarathon", currentLongestRun: 6, currentWeeklyMileage: 20 };
  assert.deepEqual(evaluateAdaptiveTrainingCalendar(input), evaluateAdaptiveTrainingCalendar(input));
});

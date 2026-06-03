import { test } from "node:test";
import * as assert from "node:assert/strict";
import { evaluateRaceCalendar, type RaceCalendarEngineInput } from "./race-calendar-engine";

const today = new Date("2026-01-01T00:00:00Z");

function daysFromToday(days: number): Date {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function result(overrides: Partial<RaceCalendarEngineInput> = {}) {
  return evaluateRaceCalendar({
    today,
    raceDate: daysFromToday(70),
    raceType: "HalfMarathon",
    targetPace: 9,
    predictedRacePace: 9.05,
    longRunDistance: 9,
    longestCompletedRun: 8,
    ...overrides,
  });
}

test("Base phase", () => {
  assert.equal(result({ raceDate: daysFromToday(98) }).phase, "Base");
});

test("Build phase", () => {
  assert.equal(result({ raceDate: daysFromToday(70) }).phase, "Build");
});

test("Peak phase", () => {
  assert.equal(result({ raceDate: daysFromToday(42) }).phase, "Peak");
});

test("Taper phase", () => {
  assert.equal(result({ raceDate: daysFromToday(21) }).phase, "Taper");
});

test("Race week", () => {
  const evaluated = result({ raceDate: daysFromToday(5) });
  assert.equal(evaluated.phase, "RaceWeek");
  assert.equal(evaluated.raceCountdownText, "Race week");
});

test("Completed race", () => {
  const evaluated = result({ raceDate: daysFromToday(-1) });
  assert.equal(evaluated.phase, "Completed");
  assert.equal(evaluated.raceCountdownText, "Race completed");
});

test("Ahead readiness", () => {
  assert.equal(result({ targetPace: 9, predictedRacePace: 8.7 }).readiness, "Ahead");
});

test("OnTrack readiness", () => {
  assert.equal(result({ targetPace: 9, predictedRacePace: 9.08 }).readiness, "OnTrack");
});

test("Behind readiness", () => {
  assert.equal(result({ targetPace: 9, predictedRacePace: 9.4 }).readiness, "Behind");
});

test("Unknown readiness", () => {
  assert.equal(result({ predictedRacePace: undefined }).readiness, "Unknown");
});

test("Countdown generation", () => {
  assert.equal(result({ raceDate: daysFromToday(98) }).raceCountdownText, "14 weeks until race");
  assert.equal(result({ raceDate: daysFromToday(42) }).raceCountdownText, "6 weeks until race");
});

test("Long run recommendation", () => {
  assert.equal(result({ raceDate: daysFromToday(70) }).recommendedLongRun, "8-10 miles");
  assert.equal(result({ raceDate: daysFromToday(5) }).recommendedLongRun, "0 miles");
});

test("Pace gap calculation", () => {
  assert.equal(result({ targetPace: 9, predictedRacePace: 9.05 }).paceGap, 0.05);
  assert.equal(result({ targetPace: 9, predictedRacePace: 8.75 }).paceGap, -0.25);
});

test("Summary generation", () => {
  const evaluated = result({ raceDate: daysFromToday(70), targetPace: 9, predictedRacePace: 9.05 });
  assert.match(evaluated.summary, /Build phase with 10 weeks remaining/);
  assert.match(evaluated.summary, /Race readiness is OnTrack/);
  assert.match(evaluated.summary, /Predicted pace is 9:03 versus goal pace 9:00/);
});

test("Audit generation", () => {
  const evaluated = result();
  assert.ok(evaluated.auditTrail.some((entry: string) => entry.includes("Phase selected")));
  assert.ok(evaluated.auditTrail.some((entry: string) => entry.includes("Readiness selected")));
  assert.ok(evaluated.auditTrail.some((entry: string) => entry.includes("Pace comparison")));
  assert.ok(evaluated.auditTrail.some((entry: string) => entry.includes("Long run recommendation")));
});

test("Missing data handling", () => {
  const evaluated = result({ targetPace: undefined, predictedRacePace: undefined, longRunDistance: undefined, longestCompletedRun: undefined });
  assert.equal(evaluated.readiness, "Unknown");
  assert.equal(evaluated.paceGap, undefined);
  assert.equal(evaluated.targetRacePace, undefined);
  assert.equal(evaluated.predictedRacePace, undefined);
  assert.equal(evaluated.longestRun, undefined);
});

test("Deterministic output", () => {
  const input: RaceCalendarEngineInput = { today, raceDate: daysFromToday(70), raceType: "HalfMarathon", targetPace: 9, predictedRacePace: 9.05, longestCompletedRun: 8 };
  assert.deepEqual(evaluateRaceCalendar(input), evaluateRaceCalendar(input));
});

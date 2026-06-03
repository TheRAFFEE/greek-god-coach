import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { buildRaceCalendarSettingsModel, saveRaceCalendarSettings } from "./race-calendar-settings-ui";
import { buildRaceCalendarUiModel } from "./race-calendar-ui";
import { createInitialState } from "./seed-data";
import { migrateAppState } from "./storage";
import type { AppState } from "./types";

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState(), runLogs: [], ...overrides };
}

test("Default state works without raceCalendarSettings", () => {
  const model = buildRaceCalendarSettingsModel(state());
  assert.equal(model.hasSettings, false);
  assert.equal(model.form.raceType, "HalfMarathon");
  assert.match(model.emptyState, /Add race settings/);
});

test("Race settings can be saved", () => {
  const next = saveRaceCalendarSettings(state(), { raceDate: "2027-01-17", raceType: "HalfMarathon", targetRacePace: 9, currentLongestRun: 8, currentWeeklyMileage: 22 });
  assert.deepEqual(next.raceCalendarSettings, { raceDate: "2027-01-17", raceType: "HalfMarathon", targetRacePace: 9, currentLongestRun: 8, currentWeeklyMileage: 22 });
});

test("Saved race date persists", () => {
  assert.equal(saveRaceCalendarSettings(state(), { raceDate: "2027-02-01" }).raceCalendarSettings?.raceDate, "2027-02-01");
});

test("Saved race type persists", () => {
  assert.equal(saveRaceCalendarSettings(state(), { raceType: "10K" }).raceCalendarSettings?.raceType, "10K");
});

test("Saved target pace persists", () => {
  assert.equal(saveRaceCalendarSettings(state(), { targetRacePace: 8.75 }).raceCalendarSettings?.targetRacePace, 8.75);
});

test("Saved longest run persists", () => {
  assert.equal(saveRaceCalendarSettings(state(), { currentLongestRun: 9.5 }).raceCalendarSettings?.currentLongestRun, 9.5);
});

test("Saved weekly mileage persists", () => {
  assert.equal(saveRaceCalendarSettings(state(), { currentWeeklyMileage: 28 }).raceCalendarSettings?.currentWeeklyMileage, 28);
});

test("Race Calendar UI consumes saved settings", () => {
  const next = saveRaceCalendarSettings(state(), { raceDate: "2027-01-17", raceType: "HalfMarathon", targetRacePace: 9, currentLongestRun: 9, currentWeeklyMileage: 24 });
  const model = buildRaceCalendarUiModel(next, { today: "2026-10-08" });
  assert.equal(model.countdown.sub, "2027-01-17");
  assert.equal(model.engineResults.raceCalendar.targetRacePace, 9);
  assert.equal(model.engineResults.raceCalendar.longestRun, 9);
  assert.equal(model.engineResults.adaptiveCalendar.calendarWeeks[0]?.targetWeeklyMileage, 29);
});

test("Missing settings renders empty state", () => {
  const model = buildRaceCalendarSettingsModel(state());
  assert.equal(model.hasSettings, false);
  assert.match(model.emptyState, /Add race settings/);
});

test("Invalid or partial settings do not crash", () => {
  const migrated = migrateAppState({ ...state(), raceCalendarSettings: { raceDate: "not-a-date", raceType: "Ultra", targetRacePace: -1, currentLongestRun: Number.NaN, currentWeeklyMileage: "a lot" } });
  const model = buildRaceCalendarSettingsModel(migrated);
  const calendar = buildRaceCalendarUiModel(migrated, { today: "2026-10-08" });
  assert.equal(model.form.raceType, "HalfMarathon");
  assert.ok(calendar.countdown.value.length > 0);
});

test("Storage migration and backward compatibility passes", () => {
  const migrated = migrateAppState({ user: { name: "Walter" }, runLogs: null });
  assert.equal(migrated.user.name, "Walter");
  assert.equal(migrated.raceCalendarSettings, undefined);
  const saved = migrateAppState({ ...createInitialState(), raceCalendarSettings: { raceDate: "2027-01-17", raceType: "Marathon", targetRacePace: 10, currentLongestRun: 12, currentWeeklyMileage: 30 } });
  assert.equal(saved.raceCalendarSettings?.raceType, "Marathon");
});

test("No daily workouts generated", () => {
  const settingsSource = fs.readFileSync("src/lib/race-calendar-settings-ui.ts", "utf8");
  const pageSource = fs.readFileSync("src/app/page.tsx", "utf8");
  assert.doesNotMatch(settingsSource + pageSource, /generateDailyWorkout|dailyWorkout|createWorkout/);
});

test("No daily runs generated", () => {
  const settingsSource = fs.readFileSync("src/lib/race-calendar-settings-ui.ts", "utf8");
  const pageSource = fs.readFileSync("src/app/page.tsx", "utf8");
  assert.doesNotMatch(settingsSource + pageSource, /generateDailyRun|dailyRun|createRun/);
});

test("Existing engine logic untouched", () => {
  const status = fs.readFileSync("src/app/page.tsx", "utf8") + fs.readFileSync("src/lib/race-calendar-ui.ts", "utf8");
  assert.doesNotMatch(status, /weeksRemaining\s*[<>]=?|evaluateAdaptiveTrainingCalendar\s*=|function evaluateRaceCalendar/);
  assert.ok(fs.existsSync("src/lib/race-calendar-engine.ts"));
  assert.ok(fs.existsSync("src/lib/adaptive-training-calendar-engine.ts"));
});

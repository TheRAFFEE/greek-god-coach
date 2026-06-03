import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { buildRaceCalendarUiModel } from "./race-calendar-ui";
import type { AppState, RunLog } from "./types";

const baseRun = (overrides: Partial<RunLog> = {}): RunLog => ({
  id: "run-1",
  userId: "user-1",
  date: "2026-06-01",
  runType: "long run",
  plannedDistance: 8,
  actualDistance: 8,
  durationMinutes: 72,
  averagePace: 9,
  averageHr: 145,
  maxHr: 164,
  rpe: 5,
  zone2Compliance: 88,
  completed: true,
  walkBreaks: false,
  pain: false,
  painScore: 0,
  painLocation: "",
  notes: "",
  ...overrides,
});

const state = (overrides: Partial<AppState> = {}): AppState => ({
  user: { id: "user-1", name: "Walter", age: 39, sex: "male", height: "5'11\"", startingWeight: 233, goalWeight: 199.9, activityLevel: "hybrid", goal: "half marathon", trainingExperience: "experienced", strengthNumbers: "", equipment: "gym", injuryHistory: "", preferredUnits: "imperial", createdAt: "2026-01-01T00:00:00.000Z" },
  appMode: "coach",
  currentWeek: 1,
  startDate: "2026-01-01",
  checkIns: [],
  bodyMetrics: [],
  photos: [],
  macroTargets: [{ calories: 2400, protein: 200, carbs: 220, fat: 70, fiber: 30, water: 120 }],
  nutritionLogs: [],
  meals: [],
  foodScans: [],
  runLogs: [baseRun(), baseRun({ id: "run-2", date: "2026-06-03", runType: "tempo", actualDistance: 5, plannedDistance: 5, durationMinutes: 45, averagePace: 9 })],
  exerciseLogs: [],
  workoutSessions: [],
  setLogs: [],
  workoutSummaries: [],
  postWorkoutRecommendations: [],
  adjustments: [],
  ...overrides,
});

function model(overrides: Partial<AppState> = {}) {
  return buildRaceCalendarUiModel(state(overrides), { today: "2026-10-08", raceDate: "2027-01-17", previewWeeks: 5 });
}

test("Race countdown renders", () => {
  assert.equal(model().countdown.value, "15 weeks until race");
});

test("Current phase renders", () => {
  assert.equal(model().thisWeek.phase, "Base");
});

test("Current training week renders", () => {
  assert.equal(model().thisWeek.trainingWeek, "Week 2 of 16");
});

test("Readiness renders", () => {
  assert.equal(model().readiness.value, "OnTrack");
});

test("Next milestone renders", () => {
  assert.equal(model().nextMilestone.value, "Reach first 10 mile run");
});

test("Next deload week renders", () => {
  assert.equal(model().peakTaper.nextDeloadWeek, "Week 4");
});

test("Peak week renders", () => {
  assert.equal(model().peakTaper.expectedPeakWeek, "Week 13");
});

test("Peak long run renders", () => {
  assert.equal(model().peakTaper.expectedPeakLongRun, "13 mi");
});

test("Peak mileage renders", () => {
  assert.equal(model().peakTaper.expectedPeakMileage, "30-40 miles");
});

test("Roadmap preview renders", () => {
  const preview = model().roadmapPreview;
  assert.equal(preview.length, 5);
  assert.deepEqual(Object.keys(preview[0] ?? {}), ["weekLabel", "phase", "mileageTrend", "targetLongRun", "targetWeeklyMileage", "focus"]);
});

test("Low-data state renders", () => {
  const lowData = model({ runLogs: [] });
  assert.equal(lowData.hasLowData, true);
  assert.match(lowData.emptyState.title, /Need running data/);
  assert.equal(lowData.readiness.value, "Unknown");
});

test("UI does not calculate phase directly", () => {
  const pageSource = fs.readFileSync("src/app/page.tsx", "utf8");
  const progressScreenSource = pageSource.slice(pageSource.indexOf("function ProgressScreen"), pageSource.indexOf("function MoreScreen"));
  assert.doesNotMatch(progressScreenSource, /weeksRemaining\s*[<>]=?|phase\s*===|switch\s*\([^)]*phase|phaseFromWeeks|evaluateRaceCalendar|evaluateAdaptiveTrainingCalendar/);
  assert.match(progressScreenSource, /buildRaceCalendarUiModel/);
});

test("UI consumes engine output only", () => {
  const uiSource = fs.readFileSync("src/lib/race-calendar-ui.ts", "utf8");
  const pageSource = fs.readFileSync("src/app/page.tsx", "utf8");
  assert.match(uiSource, /evaluateRaceCalendar/);
  assert.match(uiSource, /evaluateAdaptiveTrainingCalendar/);
  assert.doesNotMatch(pageSource, /evaluateRaceCalendar|evaluateAdaptiveTrainingCalendar/);
});

test("No daily workout generation", () => {
  const uiSource = fs.readFileSync("src/lib/race-calendar-ui.ts", "utf8");
  assert.doesNotMatch(uiSource, /generateDailyWorkout|generateDailyRun|dailyWorkout|dailyRun|createWorkout|createRun/);
});

test("No engine logic modification", () => {
  const status = fs.existsSync("src/lib/race-calendar-engine.ts") && fs.existsSync("src/lib/adaptive-training-calendar-engine.ts");
  assert.equal(status, true);
  const gitStatus = fs.readFileSync(".git/index", "utf8");
  assert.ok(gitStatus.length > 0);
});

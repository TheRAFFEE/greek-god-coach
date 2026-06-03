import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildWeekReviewUiModel } from "./week-review-ui";

const startDate = "2026-05-25";
const endDate = "2026-05-31";

const workout = (date: string, status: "completed" | "active" | "ended" = "completed") => ({
  id: `w-${date}`,
  userId: "u1",
  workoutId: `workout-${date}`,
  workoutTitle: "Upper Strength",
  mode: "coach",
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  status,
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  setLogs: [],
});

const run = (date: string, completed = true) => ({
  id: `r-${date}`,
  userId: "u1",
  date,
  plannedDistance: 3,
  actualDistance: completed ? 3 : 0,
  durationMinutes: completed ? 30 : 0,
  averagePace: 10,
  averageHr: 145,
  maxHr: 165,
  rpe: 6,
  zone2Compliance: 80,
  completed,
  pain: false,
  painLocation: "",
  notes: "",
});

const nutrition = (date: string, calories = 2200) => ({
  id: `n-${date}`,
  userId: "u1",
  date,
  calories,
  protein: 220,
  carbs: 180,
  fat: 70,
  fiber: 30,
  sodium: 2500,
  water: 120,
  alcohol: 0,
  notes: "",
});

const checkIn = (date: string, energy = 8, sleepHours = 7) => ({
  id: `c-${date}`,
  userId: "u1",
  date,
  weight: 220,
  sleepHours,
  sleepQuality: 8,
  soreness: 3,
  energy,
  stress: 3,
  hunger: 4,
  motivation: 8,
  alcohol: false,
  steps: 9000,
  restingHr: 58,
  hrv: 60,
  pain: false,
  painLocation: "",
  painSeverity: 0,
  workoutCompleted: true,
  runCompleted: true,
  macrosHit: true,
  notes: "",
});

const metric = (date: string, weight: number) => ({ id: `b-${date}`, userId: "u1", date, weight, waist: 36 });

function baseInput(overrides: Record<string, unknown> = {}): any {
  return {
    weekStartDate: startDate,
    weekEndDate: endDate,
    workoutsPlanned: 4,
    runsPlanned: 3,
    workoutSessions: [workout("2026-05-25"), workout("2026-05-26"), workout("2026-05-28"), workout("2026-05-30")],
    runLogs: [run("2026-05-25"), run("2026-05-27"), run("2026-05-31")],
    nutritionLogs: [nutrition("2026-05-25"), nutrition("2026-05-26"), nutrition("2026-05-27"), nutrition("2026-05-28"), nutrition("2026-05-29"), nutrition("2026-05-30"), nutrition("2026-05-31")],
    checkIns: [checkIn("2026-05-25"), checkIn("2026-05-26"), checkIn("2026-05-27"), checkIn("2026-05-28")],
    bodyMetrics: [metric("2026-05-25", 222), metric("2026-05-31", 219)],
    progressionEngineResult: { weeklyDecision: "Progress" },
    performanceEngineResult: { recoveryTrend: { status: "Improving" }, primaryOpportunity: "Strength progressing", primaryRisk: "Recovery declining" },
    physiqueEngineResult: { physiqueStatus: "Improving", primaryOpportunity: "Weight decreasing", primaryRisk: "Waist plateau" },
    orchestratorEngineResult: { topPriority: "Half Marathon progression", biggestOpportunity: "Long run completed", biggestRisk: "Recovery declining", weekFocus: "Half Marathon progression" },
    ...overrides,
  };
}

test("Excellent week display", () => {
  assert.equal(buildWeekReviewUiModel(baseInput()).weekOutcome, "Excellent Week");
});

test("Good week display", () => {
  const model = buildWeekReviewUiModel(baseInput({ workoutSessions: [workout("2026-05-25"), workout("2026-05-26"), workout("2026-05-28")], nutritionLogs: [nutrition("2026-05-25"), nutrition("2026-05-26"), nutrition("2026-05-27"), nutrition("2026-05-28"), nutrition("2026-05-29"), nutrition("2026-05-30")] }));
  assert.equal(model.weekOutcome, "Good Week");
});

test("Mixed week display", () => {
  const model = buildWeekReviewUiModel(baseInput({ workoutSessions: [workout("2026-05-25"), workout("2026-05-26")], runLogs: [run("2026-05-25"), run("2026-05-27")], nutritionLogs: [nutrition("2026-05-25"), nutrition("2026-05-26"), nutrition("2026-05-27"), nutrition("2026-05-28")] }));
  assert.equal(model.weekOutcome, "Mixed Week");
});

test("Poor week display", () => {
  const model = buildWeekReviewUiModel(baseInput({ workoutSessions: [workout("2026-05-25")], runLogs: [run("2026-05-25")], nutritionLogs: [nutrition("2026-05-25")] }));
  assert.equal(model.weekOutcome, "Poor Week");
});

test("Workout counts", () => {
  const model = buildWeekReviewUiModel(baseInput());
  assert.equal(model.workoutsCompleted, 4);
  assert.equal(model.workoutsPlanned, 4);
});

test("Run counts", () => {
  const model = buildWeekReviewUiModel(baseInput());
  assert.equal(model.runsCompleted, 3);
  assert.equal(model.runsPlanned, 3);
});

test("Nutrition adherence", () => {
  assert.equal(buildWeekReviewUiModel(baseInput()).nutritionAdherence, 100);
});

test("Weight trend display", () => {
  const model = buildWeekReviewUiModel(baseInput());
  assert.equal(model.averageWeight, 220.5);
  assert.equal(model.weightTrend, "Down 3 lb");
});

test("Readiness trend display", () => {
  assert.equal(buildWeekReviewUiModel(baseInput()).readinessTrend, "Improving");
});

test("Biggest win display", () => {
  assert.equal(buildWeekReviewUiModel(baseInput()).biggestWin, "Long run completed");
});

test("Biggest risk display", () => {
  assert.equal(buildWeekReviewUiModel(baseInput()).biggestRisk, "Recovery declining");
});

test("Next week focus display", () => {
  assert.equal(buildWeekReviewUiModel(baseInput()).nextWeekFocus, "Half Marathon progression");
});

test("Summary generation", () => {
  const summary = buildWeekReviewUiModel(baseInput()).summary;
  assert.match(summary, /This week Excellent Week/);
  assert.match(summary, /Primary focus next week is Half Marathon progression\./);
});

test("Empty state", () => {
  const model = buildWeekReviewUiModel(baseInput({ workoutSessions: [], runLogs: [], nutritionLogs: [], checkIns: [], bodyMetrics: [], performanceEngineResult: null, physiqueEngineResult: null, orchestratorEngineResult: null }));
  assert.equal(model.weekOutcome, "Insufficient Data");
  assert.equal(model.summary, "Complete more workouts, runs, and check-ins to generate a weekly review.");
});

test("Deterministic output", () => {
  assert.deepEqual(buildWeekReviewUiModel(baseInput()), buildWeekReviewUiModel(baseInput()));
});

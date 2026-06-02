import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { AppState, DailyCheckIn, NutritionLog, RunLog, WorkoutSession } from "./types";
import { buildWeeklyReviewSummary } from "./weekly-review";

const userId = "user-1";
const date = (day: number) => `2026-06-${String(day).padStart(2, "0")}`;

const checkIn = (day: number, overrides: Partial<DailyCheckIn> = {}): DailyCheckIn => ({
  id: `check-${day}`,
  userId,
  date: date(day),
  weight: 230 - day * 0.2,
  sleepHours: 7,
  sleepQuality: 4,
  soreness: 4,
  energy: 4,
  stress: 2,
  hunger: 3,
  motivation: 4,
  alcohol: false,
  steps: 10000,
  restingHr: 60,
  hrv: 70,
  pain: false,
  painLocation: "",
  painSeverity: 0,
  workoutCompleted: day <= 4,
  runCompleted: [1, 3, 6].includes(day),
  macrosHit: true,
  notes: "",
  ...overrides,
});

const nutrition = (day: number, overrides: Partial<NutritionLog> = {}): NutritionLog => ({
  id: `nutrition-${day}`,
  userId,
  date: date(day),
  calories: 2500,
  protein: 210,
  carbs: 230,
  fat: 70,
  fiber: 30,
  sodium: 0,
  water: 120,
  alcohol: 0,
  notes: "",
  ...overrides,
});

const run = (day: number, overrides: Partial<RunLog> = {}): RunLog => ({
  id: `run-${day}`,
  userId,
  date: date(day),
  runType: "easy",
  plannedDistance: 3,
  actualDistance: 3,
  durationMinutes: 30,
  averagePace: 10,
  averageHr: 145,
  maxHr: 165,
  rpe: 5,
  zone2Compliance: 85,
  completed: true,
  walkBreaks: false,
  pain: false,
  painScore: 0,
  painLocation: "",
  notes: "",
  ...overrides,
});

const lift = (day: number, status: WorkoutSession["status"] = "completed"): WorkoutSession => ({
  id: `lift-${day}`,
  userId,
  workoutId: `workout-${day}`,
  workoutTitle: `Workout ${day}`,
  mode: "manual",
  startedAt: `${date(day)}T10:00:00.000Z`,
  endedAt: status === "completed" ? `${date(day)}T11:00:00.000Z` : undefined,
  status,
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  setLogs: [],
});

const appState = (overrides: Partial<AppState> = {}) => ({
  user: { id: userId, startingWeight: 233, goalWeight: 199.9 },
  checkIns: [1, 2, 3, 4, 5, 6, 7].map((day) => checkIn(day)),
  bodyMetrics: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ id: `metric-${day}`, userId, date: date(day), weight: 230 - day * 0.2 })),
  nutritionLogs: [1, 2, 3, 4, 5, 6, 7].map((day) => nutrition(day)),
  runLogs: [run(1), run(3), run(6, { runType: "long run", plannedDistance: 6, actualDistance: 6, durationMinutes: 66, averagePace: 11, rpe: 6 })],
  workoutSessions: [lift(1), lift(2), lift(4), lift(5)],
  ...overrides,
}) as unknown as AppState;

test("summarizes required weekly review metrics", () => {
  const review = buildWeeklyReviewSummary(appState(), { startDate: date(1), endDate: date(7) });

  assert.equal(review.averageWeight, 229.2);
  assert.equal(review.weightChange, -1.2);
  assert.equal(review.totalWeeklyMiles, 12);
  assert.equal(review.longRunCompleted, true);
  assert.equal(review.liftsCompleted, 4);
  assert.equal(review.averageCalories, 2500);
  assert.equal(review.averageProtein, 210);
  assert.equal(review.averageSleep, 7);
  assert.equal(review.alcoholDays, 0);
  assert.deepEqual(review.painFlags, []);
  assert.equal(review.adherenceScore, 99);
});

test("recommends progress when long run, lifts, recovery, nutrition, and pain are good", () => {
  const review = buildWeeklyReviewSummary(appState(), { startDate: date(1), endDate: date(7) });

  assert.equal(review.nextWeekRecommendation, "Progress");
  assert.match(review.recommendationReason, /Long run was completed/i);
});

test("recommends repeat when the long run is missed", () => {
  const state = appState({ runLogs: [run(1), run(3)] });
  const review = buildWeeklyReviewSummary(state, { startDate: date(1), endDate: date(7) });

  assert.equal(review.longRunCompleted, false);
  assert.equal(review.nextWeekRecommendation, "Repeat");
  assert.match(review.recommendationReason, /Long run was missed/i);
});

test("recommends repeat when Yellow weekly readiness has a major recovery warning", () => {
  const state = appState({ checkIns: [1, 2, 3, 4, 5, 6, 7].map((day) => checkIn(day, { sleepHours: 5.4, soreness: 7 })) });
  const review = buildWeeklyReviewSummary(state, { startDate: date(1), endDate: date(7) });

  assert.equal(review.averageSleep, 5.4);
  assert.equal(review.nextWeekRecommendation, "Repeat");
  assert.match(review.recommendationReason, /major recovery warning/i);
});

test("recommends recovery focus and reports pain flags when high pain appears", () => {
  const state = appState({
    checkIns: [1, 2, 3, 4, 5, 6, 7].map((day) => checkIn(day, day === 5 ? { pain: true, painSeverity: 8, painLocation: "knee" } : {})),
    runLogs: [run(1), run(3), run(6, { runType: "long run", pain: true, painScore: 8, painLocation: "knee" })],
  });
  const review = buildWeeklyReviewSummary(state, { startDate: date(1), endDate: date(7) });

  assert.equal(review.nextWeekRecommendation, "Recovery focus");
  assert.equal(review.painFlags.length, 2);
  assert.match(review.painFlags.join(" "), /knee/i);
});


test("weekly review consumes Running Engine V2 running signals instead of recalculating progression locally", () => {
  const state = appState();
  const review = buildWeeklyReviewSummary(state, { startDate: date(1), endDate: date(7) });

  assert.equal(review.runningProgressionAction, "Progress");
  assert.ok(review.runningRaceReadinessScore >= 50);
  assert.ok(review.runningInjuryRiskScore < 50);
  assert.ok(review.runningConfidenceScore >= 65);
  assert.match(review.runningExplanation, /Running can progress|Running should/i);
});

test("weekly review maps Running Engine V2 Recovery Focus to existing Recovery focus recommendation", () => {
  const state = appState({
    checkIns: [1, 2, 3, 4, 5, 6, 7].map((day) => checkIn(day, day === 6 ? { pain: true, painSeverity: 8, painLocation: "knee" } : {})),
    runLogs: [run(6, { runType: "long run", pain: true, painScore: 8, painLocation: "knee", rpe: 8 })],
  });
  const review = buildWeeklyReviewSummary(state, { startDate: date(1), endDate: date(7) });

  assert.equal(review.runningProgressionAction, "Recovery Focus");
  assert.equal(review.nextWeekRecommendation, "Recovery focus");
  assert.ok(review.runningInjuryRiskScore >= 50);
});

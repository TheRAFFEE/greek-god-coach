import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { AppState, DailyCheckIn, MacroTarget, NutritionLog, RunLog, WorkoutSession } from "./types";
import { buildMvpDashboard } from "./mvp-dashboard";

const userId = "user-1";
const d = (day: number) => `2026-05-${String(day).padStart(2, "0")}`;

const checkIn = (day: number, overrides: Partial<DailyCheckIn> = {}): DailyCheckIn => ({
  id: `check-${day}`,
  userId,
  date: d(day),
  weight: 212 - day * 0.2,
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
  workoutCompleted: true,
  runCompleted: true,
  macrosHit: true,
  notes: "",
  ...overrides,
});

const nutrition = (day: number, overrides: Partial<NutritionLog> = {}): NutritionLog => ({
  id: `nutrition-${day}`,
  userId,
  date: d(day),
  calories: 2520,
  protein: 220,
  carbs: 210,
  fat: 70,
  fiber: 30,
  sodium: 2500,
  water: 120,
  alcohol: 0,
  notes: "",
  ...overrides,
});

const run = (day: number, overrides: Partial<RunLog> = {}): RunLog => ({
  id: `run-${day}`,
  userId,
  date: d(day),
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

const liftSession = (day: number): WorkoutSession => ({
  id: `lift-${day}`,
  userId,
  workoutId: `workout-${day}`,
  workoutTitle: `Lift ${day}`,
  mode: "manual",
  startedAt: `${d(day)}T10:00:00.000Z`,
  endedAt: `${d(day)}T11:00:00.000Z`,
  status: "completed",
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  setLogs: [],
});

const macroTarget: MacroTarget = { id: "macro-1", userId, week: 1, calories: 2550, protein: 220, carbs: 210, fat: 70, fiber: 30, water: 120 };

const state = (overrides: Partial<AppState> = {}) => ({
  user: { id: userId, name: "Walter", age: 39, sex: "male", height: "5'11\"", startingWeight: 212, goalWeight: 196, activityLevel: "hybrid", goal: "half marathon", trainingExperience: "experienced", strengthNumbers: "", equipment: "gym", injuryHistory: "", preferredUnits: "imperial", createdAt: "2026-05-01T00:00:00.000Z" },
  appMode: "coach",
  currentWeek: 1,
  startDate: "2026-05-01",
  checkIns: [18, 19, 20, 21, 22, 23, 24].map((day) => checkIn(day)),
  bodyMetrics: [18, 19, 20, 21, 22, 23, 24].map((day) => ({ id: `metric-${day}`, userId, date: d(day), weight: 212 - day * 0.2 })),
  nutritionLogs: [18, 19, 20, 21, 22, 23, 24].map((day) => nutrition(day)),
  runLogs: [run(20), run(22), run(24, { runType: "long run", actualDistance: 6, plannedDistance: 6, durationMinutes: 66, averagePace: 11, rpe: 6 })],
  workoutSessions: [liftSession(18), liftSession(19), liftSession(21), liftSession(23)],
  macroTargets: [macroTarget],
  adjustments: [],
  photos: [], meals: [], foodScans: [], exerciseLogs: [], setLogs: [], workoutSummaries: [], postWorkoutRecommendations: [],
  ...overrides,
}) as AppState;

test("builds the documented MVP dashboard fields from current app state", () => {
  const dashboard = buildMvpDashboard(state(), {
    today: "2026-06-01",
    currentWorkoutTitle: "Upper Strength + Sprints + Core",
    nextLiftTitle: "Lower Strength",
    nextRunLabel: "3 mile Zone 2 run",
    macroTarget,
  });

  assert.equal(dashboard.recoveryStatus, "No check-in");
  assert.equal(dashboard.currentWeight, 207.2);
  assert.equal(dashboard.sevenDayAverageWeight, 207.8);
  assert.equal(dashboard.weeklyMiles, 12);
  assert.equal(dashboard.nextRun, "3 mile Zone 2 run");
  assert.equal(dashboard.nextLift, "Lower Strength");
  assert.equal(dashboard.caloriesStatus, "2520 / 2550 cal");
  assert.equal(dashboard.proteinStatus, "220 / 220g protein");
  assert.equal(dashboard.halfMarathonCountdown, 230);
  assert.equal(dashboard.currentPlanRecommendation, "Progress");
});

test("keeps the MVP dashboard conservative for poor recovery or missing logs", () => {
  const poorState = state({
    checkIns: [...[18, 19, 20, 21, 22, 23, 24].map((day) => checkIn(day, { sleepHours: 5.2, soreness: 8 })), checkIn(31, { date: "2026-06-01", sleepHours: 5.2, soreness: 8 })],
    nutritionLogs: [],
    runLogs: [run(20)],
    workoutSessions: [],
  });
  const dashboard = buildMvpDashboard(poorState, {
    today: "2026-06-01",
    currentWorkoutTitle: "Upper Strength + Sprints + Core",
    nextLiftTitle: "Lower Strength",
    nextRunLabel: "3 mile Zone 2 run",
    macroTarget,
  });

  assert.equal(dashboard.recoveryStatus, "Red");
  assert.equal(dashboard.weeklyMiles, 0);
  assert.equal(dashboard.caloriesStatus, "No nutrition logged today");
  assert.equal(dashboard.proteinStatus, "No protein logged today");
  assert.equal(dashboard.currentPlanRecommendation, "Recovery focus");
});

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildHomeCommandCenter } from "./home-command-center";
import type { AppState, MacroTarget } from "./types";

const userId = "user-1";
const macroTarget: MacroTarget = { id: "macro-1", userId, week: 1, calories: 2550, protein: 220, carbs: 210, fat: 70, fiber: 30, water: 120 };

const state = (): AppState => ({
  user: { id: userId, name: "Walter", age: 39, sex: "male", height: "5'11\"", startingWeight: 233, goalWeight: 199.9, activityLevel: "hybrid", goal: "half marathon", trainingExperience: "experienced", strengthNumbers: "", equipment: "gym", injuryHistory: "", preferredUnits: "imperial", createdAt: "2026-05-01T00:00:00.000Z" },
  appMode: "coach",
  currentWeek: 1,
  startDate: "2026-05-01",
  checkIns: [],
  bodyMetrics: [
    { id: "metric-1", userId, date: "2026-05-26", weight: 212 },
    { id: "metric-2", userId, date: "2026-05-27", weight: 211.5 },
    { id: "metric-3", userId, date: "2026-05-28", weight: 211 },
    { id: "metric-4", userId, date: "2026-05-29", weight: 210.8 },
    { id: "metric-5", userId, date: "2026-05-30", weight: 210.4 },
    { id: "metric-6", userId, date: "2026-05-31", weight: 210.1 },
    { id: "metric-7", userId, date: "2026-06-01", weight: 209.8 },
  ],
  nutritionLogs: [{ id: "nutrition-1", userId, date: "2026-06-01", calories: 1900, protein: 180, carbs: 160, fat: 60, fiber: 25, sodium: 2500, water: 90, alcohol: 0, notes: "" }],
  runLogs: [{ id: "run-1", userId, date: "2026-05-30", runType: "long run", plannedDistance: 6, actualDistance: 6, durationMinutes: 60, averagePace: 10, averageHr: 145, maxHr: 165, rpe: 6, zone2Compliance: 85, completed: true, walkBreaks: false, pain: false, painScore: 0, painLocation: "", notes: "" }],
  workoutSessions: [],
  macroTargets: [macroTarget],
  adjustments: [],
  photos: [],
  meals: [],
  foodScans: [],
  exerciseLogs: [],
  setLogs: [],
  workoutSummaries: [],
  postWorkoutRecommendations: [],
});

test("builds action-focused Home command center metrics", () => {
  const model = buildHomeCommandCenter(state(), {
    today: "2026-06-01",
    readinessStatus: "Green",
    todaysWorkout: "Upper Strength",
    todaysRun: "Hold: 3 mi",
    macroTarget,
    coachRecommendation: "Do Upper Strength today with controlled reps. This extra explanation should not become a long report.",
  });

  assert.equal(model.readinessStatus, "Green");
  assert.equal(model.todaysWorkout, "Upper Strength");
  assert.equal(model.todaysRun, "Hold: 3 mi");
  assert.equal(model.currentWeight, 209.8);
  assert.equal(model.caloriesRemaining, 650);
  assert.equal(model.weeklyMiles, 6);
  assert.equal(model.daysUntilRace, 230);
});

test("keeps coach recommendation concise for quick mission scanning", () => {
  const model = buildHomeCommandCenter(state(), {
    today: "2026-06-01",
    readinessStatus: "Yellow",
    todaysWorkout: "Lower Strength",
    todaysRun: "Regress: 2 mi",
    macroTarget,
    coachRecommendation: "This is a very long recommendation that should not dominate the command center because Home is not a report screen and the user needs the mission fast without detailed analytics or duplicate explanations that belong in Progress.",
  });

  const sentenceCount = model.coachRecommendation.split(/[.!?]+/).filter(Boolean).length;
  assert.ok(sentenceCount <= 3);
  assert.ok(model.coachRecommendation.includes("Lower Strength"));
  assert.ok(model.coachRecommendation.includes("Regress: 2 mi"));
});

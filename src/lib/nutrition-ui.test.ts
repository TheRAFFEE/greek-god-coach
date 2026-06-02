import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildNutritionUiV2Model, defaultSavedFoodsForNutritionUiV2, mealToMealLogForNutritionUiV2 } from "./nutrition-ui";
import type { AppState, Meal } from "./types";

const userId = "user-1";

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  id: overrides.id ?? "meal-1",
  userId,
  date: overrides.date ?? "2026-06-01",
  category: overrides.category ?? "Breakfast",
  name: overrides.name ?? "Greek yogurt bowl",
  calories: overrides.calories ?? 400,
  protein: overrides.protein ?? 40,
  carbs: overrides.carbs ?? 35,
  fat: overrides.fat ?? 8,
  fiber: overrides.fiber ?? 5,
  sodium: overrides.sodium ?? 150,
  water: overrides.water ?? 12,
  notes: overrides.notes ?? "manual",
  items: overrides.items ?? [],
});

const state = (meals: Meal[]): AppState => ({
  user: { id: userId, name: "Walter", age: 39, sex: "male", height: "5'10\"", startingWeight: 233, goalWeight: 199.9, activityLevel: "active", goal: "Greek God", trainingExperience: "intermediate", strengthNumbers: "", equipment: "gym", injuryHistory: "", preferredUnits: "imperial", createdAt: "2026-01-01" },
  appMode: "coach",
  currentWeek: 1,
  startDate: "2026-06-01",
  checkIns: [],
  bodyMetrics: [],
  photos: [],
  nutritionLogs: [{ id: "nutrition-legacy", userId, date: "2026-06-01", calories: 100, protein: 10, carbs: 10, fat: 2, fiber: 1, sodium: 100, water: 20, alcohol: 0, notes: "legacy water" }],
  meals,
  foodScans: [],
  runLogs: [],
  exerciseLogs: [],
  workoutSessions: [],
  setLogs: [],
  workoutSummaries: [],
  postWorkoutRecommendations: [],
  adjustments: [],
  macroTargets: [{ id: "macro-1", userId, week: 1, calories: 2500, protein: 220, carbs: 250, fat: 70, fiber: 35, water: 120 }],
});

test("Nutrition UI V2 model exposes six daily progress bars with consumed remaining and target using Nutrition V2 progress", () => {
  const model = buildNutritionUiV2Model(state([meal({ category: "Breakfast", calories: 800, protein: 80, carbs: 90, fat: 20, fiber: 10, water: 24 })]), { date: "2026-06-01", macroTarget: state([]).macroTargets[0] });

  assert.deepEqual(model.progress.map((item) => item.key), ["calories", "protein", "carbs", "fat", "fiber", "water"]);
  const calories = model.progress.find((item) => item.key === "calories");
  assert.equal(calories?.consumed, 800);
  assert.equal(calories?.target, 2500);
  assert.equal(calories?.remaining, 1700);
  const water = model.progress.find((item) => item.key === "water");
  assert.equal(water?.consumed, 24);
  assert.equal(water?.target, 120);
});

test("Nutrition UI V2 model creates Breakfast Lunch Dinner and Snack cards from meal logs", () => {
  const model = buildNutritionUiV2Model(state([
    meal({ id: "breakfast", category: "Breakfast", name: "Oats", calories: 500 }),
    meal({ id: "lunch", category: "Lunch", name: "Chicken rice", calories: 700 }),
    meal({ id: "dinner", category: "Dinner", name: "Salmon", calories: 650 }),
    meal({ id: "snack", category: "Snack", name: "Protein shake", calories: 250 }),
  ]), { date: "2026-06-01", macroTarget: state([]).macroTargets[0] });

  assert.deepEqual(model.mealCards.map((card) => card.category), ["Breakfast", "Lunch", "Dinner", "Snack"]);
  assert.equal(model.mealCards.find((card) => card.category === "Lunch")?.calories, 700);
  assert.equal(model.mealCards.find((card) => card.category === "Snack")?.entries[0].name, "Protein shake");
});

test("Nutrition UI V2 model returns Today 7 Day and 30 Day adherence cards", () => {
  const model = buildNutritionUiV2Model(state([meal()]), { date: "2026-06-01", macroTarget: state([]).macroTargets[0] });

  assert.deepEqual(model.adherenceCards.map((card) => card.label), ["Today", "7 Day", "30 Day"]);
  for (const card of model.adherenceCards) {
    assert.equal(typeof card.macroAdherence, "number");
    assert.equal(typeof card.proteinAdherence, "number");
    assert.equal(typeof card.calorieAdherence, "number");
    assert.equal(typeof card.loggingConsistency, "number");
  }
});

test("Nutrition UI V2 supports saved foods without AI scanning", () => {
  assert.ok(defaultSavedFoodsForNutritionUiV2.length >= 4);
  assert.ok(defaultSavedFoodsForNutritionUiV2.every((food) => food.source === "saved-food" || food.source === "manual"));
});

test("mealToMealLogForNutritionUiV2 adapts existing Meal records to Nutrition V2 MealLog", () => {
  const log = mealToMealLogForNutritionUiV2(meal({ category: "Dinner", name: "Steak bowl", calories: 650 }));

  assert.equal(log.mealType, "dinner");
  assert.equal(log.name, "Steak bowl");
  assert.equal(log.calories, 650);
  assert.equal(log.source, "manual");
});

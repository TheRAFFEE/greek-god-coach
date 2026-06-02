import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  calculateCalorieScore,
  calculateDailyNutritionTotals,
  calculateMacroAdherence,
  calculateMacroProgress,
  createMealLogFromSavedFood,
  getNutritionTargetForDate,
  legacyMacroTargetToNutritionTarget,
  mealLogToNutritionLog,
  nutritionLogToMealLog,
  type MealLog,
  type NutritionTarget,
  type SavedFood,
} from "./nutrition-engine";

const baseTarget: NutritionTarget = {
  date: "2026-06-01",
  calories: 2600,
  protein: 220,
  carbs: 250,
  fat: 65,
  fiber: 30,
  water: 120,
  dayType: "training",
  source: "base",
};

const meal = (overrides: Partial<MealLog> = {}): MealLog => ({
  id: "meal-1",
  date: "2026-06-01",
  mealType: "breakfast",
  name: "Greek yogurt bowl",
  calories: 600,
  protein: 50,
  carbs: 65,
  fat: 12,
  fiber: 8,
  sodium: 220,
  confidence: "High",
  source: "manual",
  servings: 1,
  notes: "",
  ...overrides,
});

test("resolves NutritionTarget as the date-specific source of truth with override precedence", () => {
  const target = getNutritionTargetForDate("2026-06-01", {
    baseTarget,
    plannedTargets: [{ ...baseTarget, calories: 2700, source: "base" }],
    adjustedTargets: [{ ...baseTarget, calories: 2500, source: "adjusted" }],
    manualOverrides: [{ ...baseTarget, calories: 2400, source: "manual override" }],
  });

  assert.equal(target.date, "2026-06-01");
  assert.equal(target.calories, 2400);
  assert.equal(target.source, "manual override");
});

test("converts a legacy MacroTarget into a date-specific NutritionTarget", () => {
  const target = legacyMacroTargetToNutritionTarget({ calories: 2550, protein: 220, carbs: 210, fat: 70, fiber: 30, water: 120 }, "2026-06-02", "rest");

  assert.deepEqual(target, {
    date: "2026-06-02",
    calories: 2550,
    protein: 220,
    carbs: 210,
    fat: 70,
    fiber: 30,
    water: 120,
    dayType: "rest",
    source: "base",
  });
});

test("sums MealLog records into daily nutrition totals and confidence summary", () => {
  const totals = calculateDailyNutritionTotals("2026-06-01", [
    meal({ id: "meal-1", calories: 600, protein: 50, carbs: 65, fat: 12, fiber: 8, sodium: 220, confidence: "High" }),
    meal({ id: "meal-2", mealType: "lunch", calories: 800, protein: 60, carbs: 75, fat: 25, fiber: 10, sodium: 500, confidence: "Low", source: "meal-photo-ai" }),
    meal({ id: "other-date", date: "2026-06-02", calories: 999 }),
  ]);

  assert.equal(totals.calories, 1400);
  assert.equal(totals.protein, 110);
  assert.equal(totals.carbs, 140);
  assert.equal(totals.fat, 37);
  assert.equal(totals.fiber, 18);
  assert.equal(totals.sodium, 720);
  assert.equal(totals.loggedMeals, 2);
  assert.equal(totals.confidence, "Medium");
  assert.equal(totals.lowConfidenceCalories, 800);
});

test("calculates macro progress and macro budget remaining for every dashboard macro", () => {
  const progress = calculateMacroProgress({ calories: 1300, protein: 110, carbs: 125, fat: 32.5, fiber: 15, water: 60 }, baseTarget);

  for (const key of ["calories", "protein", "carbs", "fat", "fiber", "water"] as const) {
    assert.equal(progress[key].percentComplete, 50);
    assert.equal(progress[key].remaining, baseTarget[key] / 2);
  }
  assert.deepEqual(progress.carbsProgress, progress.carbs);
  assert.deepEqual(progress.fatProgress, progress.fat);
});

test("uses gradient calorie adherence with warning thresholds", () => {
  assert.equal(calculateCalorieScore(2600, 2600).score, 100);
  assert.equal(calculateCalorieScore(2730, 2600).score, 100);
  assert.equal(calculateCalorieScore(2340, 2600).score, 100);
  assert.equal(calculateCalorieScore(3251, 2600).score, 0);
  assert.equal(calculateCalorieScore(1949, 2600).score, 0);
  assert.equal(calculateCalorieScore(2861, 2600).calorieOverageWarning, true);
  assert.equal(calculateCalorieScore(2079, 2600).calorieOverageWarning, true);
  assert.ok(calculateCalorieScore(3000, 2600).score > 0);
  assert.ok(calculateCalorieScore(3000, 2600).score < 100);
});

test("calculates weekly and monthly macro adherence from MealLog and NutritionTarget data", () => {
  const targets = Array.from({ length: 30 }, (_, index) => ({
    ...baseTarget,
    date: `2026-06-${String(index + 1).padStart(2, "0")}`,
  }));
  const mealLogs = targets.map((target, index) => meal({
    id: `meal-${index + 1}`,
    date: target.date,
    calories: 2500,
    protein: 220,
    carbs: 230,
    fat: 70,
    fiber: 30,
    source: index === 0 ? "meal-photo-ai" : "manual",
    confidence: index === 0 ? "Low" : "High",
  }));

  const weekly = calculateMacroAdherence({ dateRange: { startDate: "2026-06-01", endDate: "2026-06-07" }, mealLogs, nutritionTargets: targets, alcoholDays: 1 });
  const monthly = calculateMacroAdherence({ dateRange: { startDate: "2026-06-01", endDate: "2026-06-30" }, mealLogs, nutritionTargets: targets, alcoholDays: 2 });

  assert.equal(weekly.totalDays, 7);
  assert.equal(weekly.loggedDays, 7);
  assert.equal(weekly.loggingConsistency, 100);
  assert.equal(weekly.weeklyAdherence, weekly.dailyAdherence);
  assert.equal(weekly.alcoholDays, 1);
  assert.equal(monthly.totalDays, 30);
  assert.equal(monthly.loggedDays, 30);
  assert.equal(monthly.monthlyAdherence, monthly.dailyAdherence);
  assert.equal(monthly.alcoholDays, 2);
});

test("creates a MealLog from SavedFood quick add", () => {
  const savedFood: SavedFood = {
    id: "saved-1",
    name: "Protein bar",
    defaultServing: "1 bar",
    calories: 220,
    protein: 20,
    carbs: 24,
    fat: 7,
    fiber: 5,
    sodium: 180,
    source: "saved-food",
    confidence: "High",
  };

  const log = createMealLogFromSavedFood(savedFood, { id: "meal-saved-1", date: "2026-06-01", mealType: "snack", servings: 2 });

  assert.equal(log.name, "Protein bar");
  assert.equal(log.source, "saved-food");
  assert.equal(log.confidence, "High");
  assert.equal(log.calories, 440);
  assert.equal(log.protein, 40);
  assert.equal(log.notes, "Quick Add from saved food: 2 × 1 bar");
});

test("provides backward-compatible NutritionLog wrappers", () => {
  const nutritionLog = mealLogToNutritionLog({ userId: "user-1", date: "2026-06-01", mealLogs: [meal({ calories: 1000, protein: 100 })], existingLog: { id: "nutrition-old", userId: "user-1", date: "2026-06-01", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, water: 80, alcohol: 1, notes: "old" } });
  const mealLog = nutritionLogToMealLog(nutritionLog);

  assert.equal(nutritionLog.id, "nutrition-old");
  assert.equal(nutritionLog.calories, 1000);
  assert.equal(nutritionLog.water, 80);
  assert.equal(nutritionLog.alcohol, 1);
  assert.equal(mealLog.source, "manual");
  assert.equal(mealLog.confidence, "High");
  assert.equal(mealLog.calories, 1000);
});

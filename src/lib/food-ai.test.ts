import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  buildConfirmedFoodAiMealLog,
  buildFoodAiMealFromMealLog,
  buildFoodAiReviewDraft,
  foodAiMealCategoryToMealLogType,
  foodAiMealLogToUiEntrySource,
} from "./food-ai";
import type { FoodScanResult } from "./types";

const scan = (overrides: Partial<FoodScanResult> = {}): FoodScanResult => ({
  id: overrides.id ?? "scan-1",
  mode: overrides.mode ?? "Nutrition Label Scan",
  detectedName: overrides.detectedName ?? "Protein bar",
  servingSize: overrides.servingSize ?? "1 bar",
  servingsEaten: overrides.servingsEaten ?? 1,
  calories: overrides.calories ?? 200,
  protein: overrides.protein ?? 20,
  carbs: overrides.carbs ?? 22,
  fat: overrides.fat ?? 6,
  fiber: overrides.fiber ?? 4,
  sodium: overrides.sodium ?? 150,
  confidence: overrides.confidence ?? 92,
  provider: overrides.provider ?? "mock-deterministic",
  isMock: overrides.isMock ?? true,
  foodsDetected: overrides.foodsDetected,
  portionEstimate: overrides.portionEstimate,
});

test("FOOD_AI_V1 label review draft keeps OCR output reviewable before confirmation and scales by servings eaten", () => {
  const draft = buildFoodAiReviewDraft({ result: scan(), servingsEaten: 1.5 });

  assert.equal(draft.mode, "Nutrition Label Scan");
  assert.equal(draft.servingsEaten, 1.5);
  assert.equal(draft.name, "Protein bar");
  assert.equal(draft.totals.calories, 300);
  assert.equal(draft.totals.protein, 30);
  assert.equal(draft.confirmedConfidence, "High");
  assert.match(draft.reviewWarning, /High Confidence only after user confirmation/);
});

test("FOOD_AI_V1 confirmed nutrition label saves a High Confidence Nutrition V2 MealLog", () => {
  const mealLog = buildConfirmedFoodAiMealLog({
    id: "meal-log-label",
    date: "2026-06-01",
    mealType: "lunch",
    draft: buildFoodAiReviewDraft({ result: scan(), servingsEaten: 2 }),
  });

  assert.equal(mealLog.source, "nutrition-label-scan");
  assert.equal(mealLog.confidence, "High");
  assert.equal(mealLog.calories, 400);
  assert.equal(mealLog.protein, 40);
  assert.equal(mealLog.servings, 2);
});

test("FOOD_AI_V1 confirmed meal photo remains Medium Confidence even after user confirmation", () => {
  const draft = buildFoodAiReviewDraft({
    result: scan({ mode: "Food Photo Scan", detectedName: "Salmon rice bowl", servingSize: "estimated bowl", calories: 620, protein: 42, carbs: 58, fat: 22, fiber: 7, confidence: 74 }),
    edits: { calories: 650, protein: 45, carbs: 60, fat: 24, fiber: 8 },
  });
  const mealLog = buildConfirmedFoodAiMealLog({ id: "meal-log-photo", date: "2026-06-01", mealType: "dinner", draft });

  assert.equal(mealLog.source, "meal-photo-ai");
  assert.equal(mealLog.confidence, "Medium");
  assert.equal(mealLog.calories, 650);
  assert.equal(mealLog.protein, 45);
});

test("FOOD_AI_V1 adapts confirmed MealLog into existing Meal storage without losing scan source", () => {
  const mealLog = buildConfirmedFoodAiMealLog({ id: "meal-log-label", date: "2026-06-01", mealType: "snack", draft: buildFoodAiReviewDraft({ result: scan(), servingsEaten: 1 }) });
  const meal = buildFoodAiMealFromMealLog({ mealLog, id: "meal-1", userId: "user-1" });

  assert.equal(meal.category, "Snack");
  assert.equal(meal.name, "Protein bar");
  assert.equal(meal.calories, 200);
  assert.match(meal.notes, /nutrition-label-scan/);
  assert.equal(foodAiMealLogToUiEntrySource(mealLog), "nutrition-label-scan");
  assert.equal(foodAiMealCategoryToMealLogType("Dinner"), "dinner");
});

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { createInitialState } from "./seed-data";
import { buildFoodAiReviewDraft } from "./food-ai";
import {
  buildFoodAiApiFailureMessage,
  buildFoodAiNoImageGuidance,
  confirmFoodAiDraftForToday,
  foodAiImageInputProps,
} from "./food-ai-nutrition-flow";
import type { FoodScanResult } from "./types";

const scan = (overrides: Partial<FoodScanResult> = {}): FoodScanResult => ({
  id: overrides.id ?? "scan-label-1",
  mode: overrides.mode ?? "Nutrition Label Scan",
  detectedName: overrides.detectedName ?? "Protein cereal",
  servingSize: overrides.servingSize ?? "1 cup",
  servingsEaten: overrides.servingsEaten ?? 1,
  calories: overrides.calories ?? 160,
  protein: overrides.protein ?? 12,
  carbs: overrides.carbs ?? 24,
  fat: overrides.fat ?? 3,
  fiber: overrides.fiber ?? 5,
  sodium: overrides.sodium ?? 140,
  confidence: overrides.confidence ?? 93,
  provider: overrides.provider ?? "mock-deterministic",
  isMock: overrides.isMock ?? true,
});

test("FOOD_AI_V1 no image selected gives clear camera/upload guidance", () => {
  assert.equal(
    buildFoodAiNoImageGuidance("Nutrition Label Scan"),
    "Take a nutrition label photo or choose an image before running label OCR.",
  );
});

test("FOOD_AI_V1 image input accepts camera capture with gallery fallback", () => {
  assert.deepEqual(foodAiImageInputProps("Nutrition Label Scan"), {
    accept: "image/*",
    capture: "environment",
    label: "Take photo / scan label",
    helperText: "Opens the rear camera on supported mobile/PWA browsers; gallery upload remains available as fallback.",
  });
});

test("FOOD_AI_V1 servings multiplier applies once before confirmation", () => {
  const draft = buildFoodAiReviewDraft({ result: scan(), servingsEaten: 1.5 });

  assert.equal(draft.perServing.calories, 160);
  assert.equal(draft.totals.calories, 240);
  assert.equal(draft.totals.protein, 18);
});

test("FOOD_AI_V1 confirmed label scan writes to today's nutrition log only", () => {
  const state = createInitialState();
  const today = "2026-06-08";
  const priorDate = "2026-06-07";
  const priorLog = { id: "nutrition-prior", userId: state.user.id, date: priorDate, calories: 111, protein: 22, carbs: 33, fat: 4, fiber: 5, sodium: 6, water: 70, alcohol: 0, notes: "prior day" };
  const baseState = { ...state, meals: [], nutritionLogs: [...state.nutritionLogs, priorLog] };
  const draft = buildFoodAiReviewDraft({ result: scan(), servingsEaten: 2, imageUrl: "data:image/png;base64,label" });

  const { nextState, mealLog } = confirmFoodAiDraftForToday({
    state: baseState,
    today,
    category: "Lunch",
    draft,
    macroTarget: state.macroTargets[0],
    mealId: "meal-today-label",
    mealLogId: "meal-log-today-label",
  });

  assert.equal(mealLog.date, today);
  assert.equal(mealLog.calories, 320);
  assert.equal(nextState.meals.some((meal) => meal.id === "meal-today-label" && meal.date === today), true);
  const todayLog = nextState.nutritionLogs.find((log) => log.date === today);
  assert.equal(todayLog?.calories, 320);
  assert.equal(todayLog?.protein, 24);
});

test("FOOD_AI_V1 confirmed label scan does not mutate prior-day nutrition", () => {
  const state = createInitialState();
  const priorDate = "2026-06-07";
  const priorLog = { id: "nutrition-prior", userId: state.user.id, date: priorDate, calories: 111, protein: 22, carbs: 33, fat: 4, fiber: 5, sodium: 6, water: 70, alcohol: 0, notes: "prior day" };
  const draft = buildFoodAiReviewDraft({ result: scan(), servingsEaten: 2 });

  const { nextState } = confirmFoodAiDraftForToday({
    state: { ...state, meals: [], nutritionLogs: [...state.nutritionLogs, priorLog] },
    today: "2026-06-08",
    category: "Snack",
    draft,
    macroTarget: state.macroTargets[0],
    mealId: "meal-today-label",
    mealLogId: "meal-log-today-label",
  });

  assert.deepEqual(nextState.nutritionLogs.find((log) => log.date === priorDate), priorLog);
});

test("FOOD_AI_V1 failed OCR/API response shows friendly retry message", () => {
  assert.equal(
    buildFoodAiApiFailureMessage("OpenAI FOOD_AI_V1 scan failed (500): raw provider stack"),
    "Label scan could not read that image. Retake a clearer photo or choose another image, then try again.",
  );
});

import { buildConfirmedFoodAiMealLog, buildFoodAiMealFromMealLog, foodAiMealCategoryToMealLogType, type FoodAiMode, type FoodAiReviewDraft } from "./food-ai";
import { syncNutritionLogFromNutritionUiV2Meals, type NutritionUiMealCategory } from "./nutrition-ui";
import type { AppState, MacroTarget, Meal } from "./types";
import type { MealLog } from "./nutrition-engine";

export interface FoodAiImageInputProps {
  accept: "image/*";
  capture: "environment";
  label: string;
  helperText: string;
}

export function foodAiImageInputProps(mode: FoodAiMode): FoodAiImageInputProps {
  const label = mode === "Nutrition Label Scan" ? "Take photo / scan label" : "Take photo / scan meal";
  return {
    accept: "image/*",
    capture: "environment",
    label,
    helperText: "Opens the rear camera on supported mobile/PWA browsers; gallery upload remains available as fallback.",
  };
}

export function buildFoodAiNoImageGuidance(mode: FoodAiMode): string {
  return mode === "Nutrition Label Scan"
    ? "Take a nutrition label photo or choose an image before running label OCR."
    : "Take a meal photo or choose an image before running meal photo AI.";
}

export function buildFoodAiApiFailureMessage(message?: string): string {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("image") && (normalized.includes("upload") || normalized.includes("missing"))) {
    return "Take a photo or choose an image first, then run the scan.";
  }
  return "Label scan could not read that image. Retake a clearer photo or choose another image, then try again.";
}

export function confirmFoodAiDraftForToday(input: {
  state: AppState;
  today: string;
  category: NutritionUiMealCategory;
  draft: FoodAiReviewDraft;
  macroTarget: MacroTarget;
  mealId: string;
  mealLogId: string;
}): { nextState: AppState; mealLog: MealLog; meal: Meal } {
  const mealLog = buildConfirmedFoodAiMealLog({
    id: input.mealLogId,
    date: input.today,
    mealType: foodAiMealCategoryToMealLogType(input.category),
    draft: input.draft,
  });
  const meal = buildFoodAiMealFromMealLog({ mealLog, id: input.mealId, userId: input.state.user.id });
  const nextMeals = [...(input.state.meals ?? []).filter((entry) => entry.id !== meal.id), meal];
  const existingLog = (input.state.nutritionLogs ?? []).find((log) => log.date === input.today);
  const nextLog = syncNutritionLogFromNutritionUiV2Meals({
    userId: input.state.user.id,
    date: input.today,
    meals: nextMeals,
    existingLog,
    macroTarget: input.macroTarget,
  });
  return {
    mealLog,
    meal,
    nextState: {
      ...input.state,
      meals: nextMeals,
      nutritionLogs: [...(input.state.nutritionLogs ?? []).filter((log) => log.date !== input.today), nextLog],
    },
  };
}

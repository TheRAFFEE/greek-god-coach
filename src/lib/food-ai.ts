import type { FoodScanResult, Meal, MealCategory } from "./types";
import type { MealLog, MealLogType, NutritionConfidence, MealLogSource } from "./nutrition-engine";

export type FoodAiMode = "Nutrition Label Scan" | "Food Photo Scan";
export type FoodAiUiEntrySource = "manual" | "saved-food" | "nutrition-label-scan" | "meal-photo-ai";

export interface FoodAiMacroEdits {
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sodium?: number;
}

export interface FoodAiReviewDraft {
  mode: FoodAiMode;
  scanId: string;
  name: string;
  servingSize: string;
  servingsEaten: number;
  perServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sodium: number;
  };
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sodium: number;
  };
  provider: string;
  providerConfidence: number;
  confirmedConfidence: NutritionConfidence;
  source: Extract<MealLogSource, "nutrition-label-scan" | "meal-photo-ai">;
  reviewWarning: string;
  imageUrl?: string;
}

const round1 = (value: number) => Math.round(Math.max(0, value) * 10) / 10;
const numberOr = (value: number | undefined, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const foodAiMealCategoryToMealLogTypeMap: Record<"Breakfast" | "Lunch" | "Dinner" | "Snack", MealLogType> = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  Dinner: "dinner",
  Snack: "snack",
};

const mealLogTypeToMealCategory: Record<MealLogType, MealCategory> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  "pre-workout": "Pre-workout",
  "post-workout": "Post-workout",
};

export function foodAiMealCategoryToMealLogType(category: "Breakfast" | "Lunch" | "Dinner" | "Snack"): MealLogType {
  return foodAiMealCategoryToMealLogTypeMap[category];
}

export function buildFoodAiReviewDraft(input: { result: FoodScanResult; servingsEaten?: number; edits?: FoodAiMacroEdits; imageUrl?: string }): FoodAiReviewDraft {
  const servings = round1(input.servingsEaten ?? input.result.servingsEaten ?? 1) || 1;
  const name = input.edits?.name?.trim() || input.result.detectedName || (input.result.mode === "Food Photo Scan" ? "AI estimated meal" : "Scanned nutrition label");
  const perServing = {
    calories: round1(numberOr(input.edits?.calories, input.result.calories)),
    protein: round1(numberOr(input.edits?.protein, input.result.protein)),
    carbs: round1(numberOr(input.edits?.carbs, input.result.carbs)),
    fat: round1(numberOr(input.edits?.fat, input.result.fat)),
    fiber: round1(numberOr(input.edits?.fiber, input.result.fiber)),
    sodium: round1(numberOr(input.edits?.sodium, input.result.sodium)),
  };
  const totals = {
    calories: round1(perServing.calories * servings),
    protein: round1(perServing.protein * servings),
    carbs: round1(perServing.carbs * servings),
    fat: round1(perServing.fat * servings),
    fiber: round1(perServing.fiber * servings),
    sodium: round1(perServing.sodium * servings),
  };
  const label = input.result.mode === "Nutrition Label Scan";
  return {
    mode: input.result.mode,
    scanId: input.result.id,
    name,
    servingSize: input.result.servingSize || (label ? "serving" : input.result.portionEstimate || "estimated portion"),
    servingsEaten: servings,
    perServing,
    totals,
    provider: input.result.provider,
    providerConfidence: input.result.confidence,
    confirmedConfidence: label ? "High" : "Medium",
    source: label ? "nutrition-label-scan" : "meal-photo-ai",
    reviewWarning: label ? "Nutrition label scans become High Confidence only after user confirmation." : "Meal photo scans remain Medium Confidence after user confirmation because values are AI estimates.",
    imageUrl: input.imageUrl,
  };
}

export function buildConfirmedFoodAiMealLog(input: { id: string; date: string; mealType: MealLogType; draft: FoodAiReviewDraft }): MealLog {
  return {
    id: input.id,
    date: input.date,
    mealType: input.mealType,
    name: input.draft.name,
    calories: input.draft.totals.calories,
    protein: input.draft.totals.protein,
    carbs: input.draft.totals.carbs,
    fat: input.draft.totals.fat,
    fiber: input.draft.totals.fiber,
    sodium: input.draft.totals.sodium,
    confidence: input.draft.confirmedConfidence,
    source: input.draft.source,
    servings: input.draft.servingsEaten,
    notes: `${input.draft.source} confirmed by user · ${input.draft.servingsEaten} × ${input.draft.servingSize} · provider ${input.draft.provider} · provider confidence ${input.draft.providerConfidence}%`,
    imageUrl: input.draft.imageUrl,
  };
}

export function buildFoodAiMealFromMealLog(input: { mealLog: MealLog; id: string; userId: string }): Meal {
  return {
    id: input.id,
    userId: input.userId,
    date: input.mealLog.date,
    category: mealLogTypeToMealCategory[input.mealLog.mealType] ?? "Snack",
    name: input.mealLog.name,
    calories: input.mealLog.calories,
    protein: input.mealLog.protein,
    carbs: input.mealLog.carbs,
    fat: input.mealLog.fat,
    fiber: input.mealLog.fiber,
    sodium: input.mealLog.sodium,
    water: 0,
    notes: `${input.mealLog.source} · ${input.mealLog.confidence} Confidence · ${input.mealLog.notes}`,
    items: [],
  };
}

export function foodAiMealLogToUiEntrySource(mealLog: Pick<MealLog, "source">): FoodAiUiEntrySource {
  if (mealLog.source === "nutrition-label-scan" || mealLog.source === "meal-photo-ai") return mealLog.source;
  if (mealLog.source === "saved-food") return "saved-food";
  return "manual";
}

export function foodAiUiEntrySourceFromMealNotes(notes: string): FoodAiUiEntrySource {
  const normalized = notes.toLowerCase();
  if (normalized.includes("nutrition-label-scan")) return "nutrition-label-scan";
  if (normalized.includes("meal-photo-ai")) return "meal-photo-ai";
  if (normalized.includes("saved food")) return "saved-food";
  return "manual";
}

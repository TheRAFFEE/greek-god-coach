import type { AppState, MacroTarget, Meal, NutritionLog } from "./types";
import { foodAiUiEntrySourceFromMealNotes, type FoodAiUiEntrySource } from "./food-ai";
import {
  calculateDailyNutritionTotals,
  calculateMacroAdherence,
  calculateMacroProgress,
  createMealLogFromSavedFood,
  legacyMacroTargetToNutritionTarget,
  nutritionLogsToMealLogs,
  type MealLog,
  type MealLogType,
  type NutritionTarget,
  type SavedFood,
} from "./nutrition-engine";

export type NutritionUiProgressKey = "calories" | "protein" | "carbs" | "fat" | "fiber" | "water";
export type NutritionUiMealCategory = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export interface NutritionUiProgressItem {
  key: NutritionUiProgressKey;
  label: string;
  unit: string;
  consumed: number;
  remaining: number;
  target: number;
  percentComplete: number;
}

export interface NutritionUiMealEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
  source: FoodAiUiEntrySource;
}

export interface NutritionUiMealCard {
  category: NutritionUiMealCategory;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
  entries: NutritionUiMealEntry[];
}

export interface NutritionUiAdherenceCard {
  label: "Today" | "7 Day" | "30 Day";
  macroAdherence: number;
  proteinAdherence: number;
  calorieAdherence: number;
  loggingConsistency: number;
}

export interface NutritionUiV2Model {
  date: string;
  target: NutritionTarget;
  totals: ReturnType<typeof calculateDailyNutritionTotals> & { water: number };
  progress: NutritionUiProgressItem[];
  mealCards: NutritionUiMealCard[];
  adherenceCards: NutritionUiAdherenceCard[];
  savedFoods: SavedFood[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const dayMs = 24 * 60 * 60 * 1000;

const mealCategoryToMealLogType: Record<NutritionUiMealCategory, MealLogType> = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  Dinner: "dinner",
  Snack: "snack",
};

const orderedMealCategories: NutritionUiMealCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export const defaultSavedFoodsForNutritionUiV2: SavedFood[] = [
  { id: "saved-greek-yogurt", name: "Greek yogurt + berries", defaultServing: "1 bowl", calories: 320, protein: 34, carbs: 32, fat: 4, fiber: 6, sodium: 110, source: "saved-food", confidence: "High" },
  { id: "saved-chicken-rice", name: "Chicken rice meal prep", defaultServing: "1 container", calories: 610, protein: 55, carbs: 62, fat: 12, fiber: 5, sodium: 520, source: "saved-food", confidence: "High" },
  { id: "saved-protein-shake", name: "Protein shake", defaultServing: "1 shake", calories: 220, protein: 40, carbs: 8, fat: 3, fiber: 1, sodium: 180, source: "saved-food", confidence: "High" },
  { id: "saved-eggs-toast", name: "Eggs + sourdough", defaultServing: "1 plate", calories: 460, protein: 30, carbs: 38, fat: 20, fiber: 4, sodium: 430, source: "saved-food", confidence: "High" },
];

export function mealToMealLogForNutritionUiV2(meal: Meal): MealLog {
  const itemTotals = meal.items.reduce((sum, item) => ({
    calories: sum.calories + item.calories,
    protein: sum.protein + item.protein,
    carbs: sum.carbs + item.carbs,
    fat: sum.fat + item.fat,
    fiber: sum.fiber + item.fiber,
    sodium: sum.sodium + item.sodium,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 });
  const category = orderedMealCategories.includes(meal.category as NutritionUiMealCategory) ? meal.category as NutritionUiMealCategory : "Snack";
  return {
    id: meal.id,
    date: meal.date,
    mealType: mealCategoryToMealLogType[category],
    name: meal.name,
    calories: round1(meal.calories + itemTotals.calories),
    protein: round1(meal.protein + itemTotals.protein),
    carbs: round1(meal.carbs + itemTotals.carbs),
    fat: round1(meal.fat + itemTotals.fat),
    fiber: round1(meal.fiber + itemTotals.fiber),
    sodium: round1(meal.sodium + itemTotals.sodium),
    confidence: "High",
    source: foodAiUiEntrySourceFromMealNotes(meal.notes),
    servings: 1,
    notes: meal.notes,
  };
}

export function nutritionUiV2MealLogsFromState(state: AppState): MealLog[] {
  const mealLogs = (state.meals ?? []).map(mealToMealLogForNutritionUiV2);
  const datesWithMeals = new Set(mealLogs.map((meal) => meal.date));
  const legacyMealLogs = nutritionLogsToMealLogs((state.nutritionLogs ?? []).filter((log) => !datesWithMeals.has(log.date)));
  return [...mealLogs, ...legacyMealLogs];
}

function mealWaterForDate(state: AppState, date: string) {
  const meals = (state.meals ?? []).filter((meal) => meal.date === date);
  if (meals.length) return round1(meals.reduce((sum, meal) => sum + meal.water + meal.items.reduce((itemSum, item) => itemSum + item.water, 0), 0));
  return state.nutritionLogs.find((log) => log.date === date)?.water ?? 0;
}

function nutritionTargetFor(date: string, macroTarget: MacroTarget): NutritionTarget {
  return legacyMacroTargetToNutritionTarget(macroTarget, date, "training", "base");
}

function dateRangeEnding(date: string, days: number) {
  const end = new Date(`${date}T00:00:00.000Z`);
  const start = new Date(end.getTime() - ((days - 1) * dayMs));
  return { startDate: start.toISOString().slice(0, 10), endDate: date };
}

function buildAdherenceCard(label: NutritionUiAdherenceCard["label"], state: AppState, date: string, days: number, mealLogs: MealLog[], target: NutritionTarget): NutritionUiAdherenceCard {
  const range = dateRangeEnding(date, days);
  const targets = Array.from({ length: days }, (_, index) => {
    const d = new Date(`${range.startDate}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + index);
    return { ...target, date: d.toISOString().slice(0, 10) };
  });
  const alcoholDays = (state.nutritionLogs ?? []).filter((log) => log.date >= range.startDate && log.date <= range.endDate && log.alcohol > 0).length;
  const summary = calculateMacroAdherence({ dateRange: range, mealLogs, nutritionTargets: targets, alcoholDays });
  return {
    label,
    macroAdherence: summary.dailyAdherence,
    proteinAdherence: summary.proteinAdherence,
    calorieAdherence: summary.caloriesAdherence,
    loggingConsistency: summary.loggingConsistency,
  };
}

export function buildNutritionUiV2Model(state: AppState, input: { date: string; macroTarget: MacroTarget }): NutritionUiV2Model {
  const target = nutritionTargetFor(input.date, input.macroTarget);
  const mealLogs = nutritionUiV2MealLogsFromState(state);
  const dailyTotals = calculateDailyNutritionTotals(input.date, mealLogs);
  const water = mealWaterForDate(state, input.date);
  const totals = { ...dailyTotals, water };
  const macroProgress = calculateMacroProgress(totals, target);
  const progress: NutritionUiProgressItem[] = [
    ["calories", "Calories", "cal"],
    ["protein", "Protein", "g"],
    ["carbs", "Carbs", "g"],
    ["fat", "Fat", "g"],
    ["fiber", "Fiber", "g"],
    ["water", "Water", "oz"],
  ].map(([key, label, unit]) => {
    const item = macroProgress[key as NutritionUiProgressKey];
    return { key: key as NutritionUiProgressKey, label, unit, consumed: item.consumed, remaining: item.remaining, target: item.target, percentComplete: item.percentComplete };
  });
  const mealsForDate = (state.meals ?? []).filter((meal) => meal.date === input.date);
  const mealCards = orderedMealCategories.map((category): NutritionUiMealCard => {
    const entries = mealsForDate.filter((meal) => meal.category === category).map((meal) => ({
      id: meal.id,
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      fiber: meal.fiber,
      water: meal.water,
      source: foodAiUiEntrySourceFromMealNotes(meal.notes),
    }));
    return {
      category,
      calories: round1(entries.reduce((sum, entry) => sum + entry.calories, 0)),
      protein: round1(entries.reduce((sum, entry) => sum + entry.protein, 0)),
      carbs: round1(entries.reduce((sum, entry) => sum + entry.carbs, 0)),
      fat: round1(entries.reduce((sum, entry) => sum + entry.fat, 0)),
      fiber: round1(entries.reduce((sum, entry) => sum + entry.fiber, 0)),
      water: round1(entries.reduce((sum, entry) => sum + entry.water, 0)),
      entries,
    };
  });
  return {
    date: input.date,
    target,
    totals,
    progress,
    mealCards,
    adherenceCards: [
      buildAdherenceCard("Today", state, input.date, 1, mealLogs, target),
      buildAdherenceCard("7 Day", state, input.date, 7, mealLogs, target),
      buildAdherenceCard("30 Day", state, input.date, 30, mealLogs, target),
    ],
    savedFoods: defaultSavedFoodsForNutritionUiV2,
  };
}

export function createMealFromNutritionUiV2ManualEntry(input: {
  id: string;
  userId: string;
  date: string;
  category: NutritionUiMealCategory;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
  notes?: string;
}): Meal {
  return { ...input, sodium: 0, notes: input.notes ?? "Manual meal entry", items: [] };
}

export function createMealFromNutritionUiV2SavedFood(input: { id: string; userId: string; date: string; category: NutritionUiMealCategory; savedFood: SavedFood; servings: number }): Meal {
  const log = createMealLogFromSavedFood(input.savedFood, { id: input.id, date: input.date, mealType: mealCategoryToMealLogType[input.category], servings: input.servings });
  return {
    id: input.id,
    userId: input.userId,
    date: input.date,
    category: input.category,
    name: log.name,
    calories: log.calories,
    protein: log.protein,
    carbs: log.carbs,
    fat: log.fat,
    fiber: log.fiber,
    sodium: log.sodium,
    water: 0,
    notes: `Saved food · ${log.notes}`,
    items: [],
  };
}

export function syncNutritionLogFromNutritionUiV2Meals(input: { userId: string; date: string; meals: Meal[]; existingLog?: NutritionLog; macroTarget: MacroTarget }): NutritionLog {
  const mealLogs = input.meals.map(mealToMealLogForNutritionUiV2);
  const totals = calculateDailyNutritionTotals(input.date, mealLogs);
  const water = input.meals.filter((meal) => meal.date === input.date).reduce((sum, meal) => sum + meal.water + meal.items.reduce((itemSum, item) => itemSum + item.water, 0), 0);
  return {
    id: input.existingLog?.id ?? `nutrition-${input.date}`,
    userId: input.userId,
    date: input.date,
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fiber: totals.fiber,
    sodium: totals.sodium,
    water: round1(water),
    alcohol: input.existingLog?.alcohol ?? 0,
    notes: input.existingLog?.notes ?? "Synced from Nutrition UI V2 meal cards",
  };
}

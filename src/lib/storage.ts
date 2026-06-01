import type { AppMode, AppState, MacroTarget, Meal, MealCategory, MealItem } from "./types";
import { createInitialState } from "./seed-data";

const key = "greek-god-coach:v1";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const asNumber = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const asString = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const isAppMode = (value: unknown): value is AppMode => value === "coach" || value === "tracker" || value === "manual";
const mealCategories: MealCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout", "Post-workout", "Custom"];
const isMealCategory = (value: unknown): value is MealCategory => typeof value === "string" && mealCategories.includes(value as MealCategory);

function normalizeMacroTargets(value: unknown, defaults: MacroTarget[]): MacroTarget[] {
  const rawTargets = asArray<Partial<MacroTarget>>(value).filter(isRecord);
  const byWeek = new Map<number, MacroTarget>();
  defaults.forEach((target, index) => byWeek.set(target.week ?? index + 1, { ...target }));
  rawTargets.forEach((target, index) => {
    const fallback = defaults[index] ?? defaults[0];
    const week = asNumber(target.week, fallback?.week ?? index + 1);
    byWeek.set(week, {
      ...fallback,
      ...target,
      week,
      calories: asNumber(target.calories, fallback?.calories ?? 0),
      protein: asNumber(target.protein, fallback?.protein ?? 0),
      proteinMax: target.proteinMax === undefined ? fallback?.proteinMax : asNumber(target.proteinMax, fallback?.proteinMax),
      carbs: asNumber(target.carbs, fallback?.carbs ?? 0),
      fat: asNumber(target.fat, fallback?.fat ?? 0),
      fiber: asNumber(target.fiber, fallback?.fiber ?? 0),
      water: asNumber(target.water, fallback?.water ?? 0),
    });
  });
  return Array.from(byWeek.values()).sort((a, b) => (a.week ?? 0) - (b.week ?? 0));
}

function normalizeMealItem(value: unknown, fallbackMealId: string): MealItem | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id, `meal-item-${fallbackMealId}-${Math.random().toString(16).slice(2)}`),
    mealId: asString(value.mealId, fallbackMealId),
    name: asString(value.name, "Food item"),
    calories: asNumber(value.calories),
    protein: asNumber(value.protein),
    carbs: asNumber(value.carbs),
    fat: asNumber(value.fat),
    fiber: asNumber(value.fiber),
    sodium: asNumber(value.sodium),
    water: asNumber(value.water),
    notes: asString(value.notes),
  };
}

function normalizeMeal(value: unknown, defaults: AppState): Meal | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id, `meal-${asString(value.date, todayIso())}-${Math.random().toString(16).slice(2)}`);
  return {
    id,
    userId: asString(value.userId, defaults.user.id),
    date: asString(value.date, todayIso()),
    category: isMealCategory(value.category) ? value.category : "Custom",
    name: asString(value.name, "Migrated meal"),
    calories: asNumber(value.calories),
    protein: asNumber(value.protein),
    carbs: asNumber(value.carbs),
    fat: asNumber(value.fat),
    fiber: asNumber(value.fiber),
    sodium: asNumber(value.sodium),
    water: asNumber(value.water),
    notes: asString(value.notes),
    items: asArray(value.items).map((item) => normalizeMealItem(item, id)).filter((item): item is MealItem => Boolean(item)),
  };
}

export function migrateAppState(raw: unknown): AppState {
  const defaults = createInitialState();
  if (!isRecord(raw)) return defaults;
  const state: AppState = {
    ...defaults,
    ...raw,
    user: isRecord(raw.user) ? { ...defaults.user, ...raw.user } : defaults.user,
    appMode: isAppMode(raw.appMode) ? raw.appMode : "coach",
    currentWeek: asNumber(raw.currentWeek, defaults.currentWeek),
    startDate: asString(raw.startDate, defaults.startDate),
    checkIns: asArray<Partial<import("./types").DailyCheckIn>>(raw.checkIns).map((entry) => ({ ...entry, runCompleted: typeof entry.runCompleted === "boolean" ? entry.runCompleted : false })) as import("./types").DailyCheckIn[],
    bodyMetrics: asArray(raw.bodyMetrics),
    photos: asArray(raw.photos),
    nutritionLogs: asArray(raw.nutritionLogs),
    meals: asArray(raw.meals).map((meal) => normalizeMeal(meal, defaults)).filter((meal): meal is Meal => Boolean(meal)),
    foodScans: asArray(raw.foodScans),
    runLogs: asArray(raw.runLogs),
    exerciseLogs: asArray(raw.exerciseLogs),
    workoutSessions: asArray(raw.workoutSessions),
    setLogs: asArray(raw.setLogs),
    workoutSummaries: asArray(raw.workoutSummaries),
    postWorkoutRecommendations: asArray(raw.postWorkoutRecommendations),
    adjustments: asArray(raw.adjustments),
    macroTargets: normalizeMacroTargets(raw.macroTargets, defaults.macroTargets),
  };
  return state;
}

export function loadState(): AppState {
  if (typeof window === "undefined") return createInitialState();
  const raw = window.localStorage.getItem(key);
  if (!raw) return createInitialState();
  try {
    return migrateAppState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(migrateAppState(state)));
}

export function resetState() {
  if (typeof window !== "undefined") window.localStorage.removeItem(key);
  return createInitialState();
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

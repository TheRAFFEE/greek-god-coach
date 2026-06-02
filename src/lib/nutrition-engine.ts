import type { MacroTarget, NutritionLog } from "./types";

export type NutritionDayType = "training" | "rest" | "long-run" | "race-prep" | "refeed";
export type NutritionTargetSource = "base" | "adjusted" | "manual override";
export type MealLogType = "breakfast" | "lunch" | "dinner" | "snack" | "pre-workout" | "post-workout";
export type NutritionConfidence = "High" | "Medium" | "Low";
export type MealLogSource = "manual" | "nutrition-label-scan" | "meal-photo-ai" | "saved-food";

export interface NutritionTarget {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
  dayType: NutritionDayType;
  source: NutritionTargetSource;
}

export interface MealLog {
  id: string;
  date: string;
  mealType: MealLogType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  confidence: NutritionConfidence;
  source: MealLogSource;
  servings: number;
  notes: string;
  imageUrl?: string;
}

export interface SavedFood {
  id: string;
  name: string;
  defaultServing: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  source: MealLogSource;
  confidence: NutritionConfidence;
}

export interface DailyNutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  loggedMeals: number;
  lowConfidenceCalories: number;
  confidence: NutritionConfidence;
}

export interface MacroProgressBarValue {
  consumed: number;
  target: number;
  remaining: number;
  percentComplete: number;
  overage?: number;
}

export interface DailyMacroProgress {
  calories: MacroProgressBarValue;
  protein: MacroProgressBarValue;
  carbs: MacroProgressBarValue;
  fat: MacroProgressBarValue;
  fiber: MacroProgressBarValue;
  water: MacroProgressBarValue;
  carbsProgress: MacroProgressBarValue;
  fatProgress: MacroProgressBarValue;
}

export interface CalorieScoreResult {
  score: number;
  calorieOverageWarning: boolean;
}

export interface MacroAdherenceInput {
  dateRange: { startDate: string; endDate: string };
  mealLogs: MealLog[];
  nutritionTargets: NutritionTarget[];
  alcoholDays: number;
}

export interface MacroAdherenceSummary {
  startDate: string;
  endDate: string;
  loggedDays: number;
  totalDays: number;
  dailyAdherence: number;
  weeklyAdherence?: number;
  monthlyAdherence?: number;
  caloriesAdherence: number;
  proteinAdherence: number;
  fiberAdherence: number;
  loggingConsistency: number;
  alcoholDays: number;
  calorieOverageWarning: boolean;
  confidence: NutritionConfidence;
  warnings: string[];
}

export interface NutritionTargetContext {
  baseTarget: NutritionTarget;
  plannedTargets?: NutritionTarget[];
  adjustedTargets?: NutritionTarget[];
  manualOverrides?: NutritionTarget[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round0 = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const confidenceValue = (confidence: NutritionConfidence) => {
  if (confidence === "High") return 1;
  if (confidence === "Medium") return 0.8;
  return 0.6;
};

const confidenceFromValue = (value: number): NutritionConfidence => {
  if (value >= 0.9) return "High";
  if (value >= 0.7) return "Medium";
  return "Low";
};

const datesInRange = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
};

export function legacyMacroTargetToNutritionTarget(target: MacroTarget, date: string, dayType: NutritionDayType = "training", source: NutritionTargetSource = "base"): NutritionTarget {
  return {
    date,
    calories: target.calories,
    protein: target.protein,
    carbs: target.carbs,
    fat: target.fat,
    fiber: target.fiber,
    water: target.water,
    dayType,
    source,
  };
}

export function getNutritionTargetForDate(date: string, context: NutritionTargetContext): NutritionTarget {
  const manual = context.manualOverrides?.find((target) => target.date === date);
  if (manual) return manual;
  const adjusted = context.adjustedTargets?.find((target) => target.date === date);
  if (adjusted) return adjusted;
  const planned = context.plannedTargets?.find((target) => target.date === date);
  if (planned) return planned;
  return { ...context.baseTarget, date };
}

export function calculateDailyNutritionTotals(date: string, mealLogs: MealLog[]): DailyNutritionTotals {
  const mealsForDate = mealLogs.filter((meal) => meal.date === date);
  const totals = mealsForDate.reduce((sum, meal) => ({
    calories: sum.calories + meal.calories,
    protein: sum.protein + meal.protein,
    carbs: sum.carbs + meal.carbs,
    fat: sum.fat + meal.fat,
    fiber: sum.fiber + meal.fiber,
    sodium: sum.sodium + meal.sodium,
    loggedMeals: sum.loggedMeals + 1,
    lowConfidenceCalories: sum.lowConfidenceCalories + (meal.confidence === "Low" ? meal.calories : 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, loggedMeals: 0, lowConfidenceCalories: 0 });
  const confidence = mealsForDate.length
    ? confidenceFromValue(average(mealsForDate.map((meal) => confidenceValue(meal.confidence))))
    : "Low";

  return { ...totals, confidence };
}

const progressItem = (consumed: number, target: number, includeOverage = false): MacroProgressBarValue => {
  const item: MacroProgressBarValue = {
    consumed: round1(consumed),
    target: round1(target),
    remaining: round1(Math.max(0, target - consumed)),
    percentComplete: target > 0 ? clamp(round0((consumed / target) * 100), 0, 100) : 0,
  };
  if (includeOverage) item.overage = round1(Math.max(0, consumed - target));
  return item;
};

export function calculateMacroProgress(totals: Pick<DailyNutritionTotals, "calories" | "protein" | "carbs" | "fat" | "fiber"> & { water?: number }, target: NutritionTarget): DailyMacroProgress {
  const carbs = progressItem(totals.carbs, target.carbs);
  const fat = progressItem(totals.fat, target.fat);
  return {
    calories: progressItem(totals.calories, target.calories, true),
    protein: progressItem(totals.protein, target.protein),
    carbs,
    fat,
    fiber: progressItem(totals.fiber, target.fiber),
    water: progressItem(totals.water ?? 0, target.water),
    carbsProgress: carbs,
    fatProgress: fat,
  };
}

export function calculateCalorieScore(consumedCalories: number, targetCalories: number): CalorieScoreResult {
  if (targetCalories <= 0) return { score: 0, calorieOverageWarning: false };
  const lowerGreen = targetCalories * 0.9;
  const upperGreen = targetCalories * 1.05;
  const lowerZero = targetCalories * 0.75;
  const upperZero = targetCalories * 1.25;
  let score = 0;

  if (consumedCalories >= lowerGreen && consumedCalories <= upperGreen) {
    score = 100;
  } else if (consumedCalories > upperGreen && consumedCalories <= upperZero) {
    score = ((upperZero - consumedCalories) / (upperZero - upperGreen)) * 100;
  } else if (consumedCalories < lowerGreen && consumedCalories >= lowerZero) {
    score = ((consumedCalories - lowerZero) / (lowerGreen - lowerZero)) * 100;
  }

  return {
    score: clamp(round0(score), 0, 100),
    calorieOverageWarning: consumedCalories > targetCalories * 1.1 || consumedCalories < targetCalories * 0.8,
  };
}

function scoreDay(date: string, mealLogs: MealLog[], target: NutritionTarget, alcoholPenalty: number) {
  const totals = calculateDailyNutritionTotals(date, mealLogs);
  const calorie = calculateCalorieScore(totals.calories, target.calories);
  const proteinScore = target.protein > 0 ? clamp((totals.protein / target.protein) * 100, 0, 100) : 0;
  const fiberScore = target.fiber > 0 ? clamp((totals.fiber / target.fiber) * 100, 0, 100) : 0;
  const loggingConsistency = totals.loggedMeals > 0 ? 100 : 0;
  const confidenceQuality = confidenceValue(totals.confidence) * 100;
  const score = clamp(round0((calorie.score * 0.35) + (proteinScore * 0.3) + (fiberScore * 0.15) + (loggingConsistency * 0.1) + (confidenceQuality * 0.1) - alcoholPenalty), 0, 100);
  return { totals, score, calorieScore: calorie.score, proteinScore: round0(proteinScore), fiberScore: round0(fiberScore), loggingConsistency, calorieOverageWarning: calorie.calorieOverageWarning };
}

export function calculateMacroAdherence(input: MacroAdherenceInput): MacroAdherenceSummary {
  const dates = datesInRange(input.dateRange.startDate, input.dateRange.endDate);
  const baseTarget = input.nutritionTargets[0];
  const perDay = dates.map((date) => {
    const target = input.nutritionTargets.find((entry) => entry.date === date) ?? (baseTarget ? { ...baseTarget, date } : undefined);
    if (!target) return null;
    const alcoholPenalty = input.alcoholDays > 0 ? Math.min(10, (input.alcoholDays / Math.max(dates.length, 1)) * 5) : 0;
    return scoreDay(date, input.mealLogs, target, alcoholPenalty);
  }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const loggedDays = perDay.filter((day) => day.totals.loggedMeals > 0).length;
  const totalDays = dates.length;
  const loggingConsistency = totalDays > 0 ? round0((loggedDays / totalDays) * 100) : 0;
  const lowConfidenceCalories = perDay.reduce((sum, day) => sum + day.totals.lowConfidenceCalories, 0);
  const totalCalories = perDay.reduce((sum, day) => sum + day.totals.calories, 0);
  const averageConfidence = perDay.length ? confidenceFromValue(average(perDay.map((day) => confidenceValue(day.totals.confidence)))) : "Low";
  const warnings: string[] = [];
  if (totalCalories > 0 && lowConfidenceCalories / totalCalories > 0.4) warnings.push("More than 40% of calories were estimated from low-confidence meals.");
  if (loggingConsistency < 80) warnings.push(`Only ${loggedDays} of ${totalDays} days had nutrition logs.`);
  if (perDay.some((day) => day.calorieOverageWarning)) warnings.push("One or more days are more than 10% over target or more than 20% under target.");

  const summary: MacroAdherenceSummary = {
    startDate: input.dateRange.startDate,
    endDate: input.dateRange.endDate,
    loggedDays,
    totalDays,
    dailyAdherence: round0(average(perDay.map((day) => day.score))),
    caloriesAdherence: round0(average(perDay.map((day) => day.calorieScore))),
    proteinAdherence: round0(average(perDay.map((day) => day.proteinScore))),
    fiberAdherence: round0(average(perDay.map((day) => day.fiberScore))),
    loggingConsistency,
    alcoholDays: input.alcoholDays,
    calorieOverageWarning: perDay.some((day) => day.calorieOverageWarning),
    confidence: averageConfidence,
    warnings,
  };

  if (totalDays === 7) summary.weeklyAdherence = summary.dailyAdherence;
  if (totalDays === 30) summary.monthlyAdherence = summary.dailyAdherence;
  return summary;
}

export function createMealLogFromSavedFood(savedFood: SavedFood, input: { id: string; date: string; mealType: MealLogType; servings?: number; notes?: string }): MealLog {
  const servings = input.servings ?? 1;
  return {
    id: input.id,
    date: input.date,
    mealType: input.mealType,
    name: savedFood.name,
    calories: round1(savedFood.calories * servings),
    protein: round1(savedFood.protein * servings),
    carbs: round1(savedFood.carbs * servings),
    fat: round1(savedFood.fat * servings),
    fiber: round1(savedFood.fiber * servings),
    sodium: round1(savedFood.sodium * servings),
    confidence: savedFood.confidence,
    source: "saved-food",
    servings,
    notes: input.notes ?? `Quick Add from saved food: ${servings} × ${savedFood.defaultServing}`,
  };
}

export function mealLogToNutritionLog(input: { userId: string; date: string; mealLogs: MealLog[]; existingLog?: NutritionLog }): NutritionLog {
  const totals = calculateDailyNutritionTotals(input.date, input.mealLogs);
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
    water: input.existingLog?.water ?? 0,
    alcohol: input.existingLog?.alcohol ?? 0,
    notes: input.existingLog?.notes ?? "Synced from meal logs",
  };
}

export function nutritionLogToMealLog(log: NutritionLog): MealLog {
  return {
    id: `meal-${log.id}`,
    date: log.date,
    mealType: "snack",
    name: "Legacy nutrition log",
    calories: log.calories,
    protein: log.protein,
    carbs: log.carbs,
    fat: log.fat,
    fiber: log.fiber,
    sodium: log.sodium,
    confidence: "High",
    source: "manual",
    servings: 1,
    notes: log.notes,
  };
}

export function nutritionLogsToMealLogs(logs: NutritionLog[]): MealLog[] {
  return logs.map(nutritionLogToMealLog);
}

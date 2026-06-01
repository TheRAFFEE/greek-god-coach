import type { AppState, NutritionLog } from "./types";

export type NutritionLoggerDayType = "training" | "rest";

export interface NutritionLoggerTarget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionLoggerInput {
  id: string;
  userId: string;
  date: string;
  dayType: NutritionLoggerDayType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
  alcohol: boolean;
  notes: string;
}

export interface NutritionLoggerAdherence {
  target: NutritionLoggerTarget;
  calorieAdherencePercent: number;
  proteinAdherencePercent: number;
}

export const nutritionLoggerTargets: Record<NutritionLoggerDayType, NutritionLoggerTarget> = {
  training: { calories: 2600, protein: 220, carbs: 250, fat: 65 },
  rest: { calories: 2200, protein: 220, carbs: 150, fat: 70 },
};

const adherencePercent = (actual: number, target: number) => {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.round((actual / target) * 100));
};

export function getNutritionLoggerTarget(dayType: NutritionLoggerDayType): NutritionLoggerTarget {
  return nutritionLoggerTargets[dayType];
}

export function buildNutritionLogRecord(input: NutritionLoggerInput): NutritionLog {
  return {
    id: input.id,
    userId: input.userId,
    date: input.date,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    fiber: input.fiber,
    sodium: 0,
    water: input.water,
    alcohol: input.alcohol ? 1 : 0,
    notes: input.notes,
  };
}

export function evaluateNutritionLoggerAdherence(log: NutritionLog, dayType: NutritionLoggerDayType): NutritionLoggerAdherence {
  const target = getNutritionLoggerTarget(dayType);
  return {
    target,
    calorieAdherencePercent: adherencePercent(log.calories, target.calories),
    proteinAdherencePercent: adherencePercent(log.protein, target.protein),
  };
}

export function saveNutritionLoggerEntry(state: AppState, input: NutritionLoggerInput): { state: AppState; log: NutritionLog; adherence: NutritionLoggerAdherence } {
  const log = buildNutritionLogRecord(input);
  const adherence = evaluateNutritionLoggerAdherence(log, input.dayType);
  return {
    state: {
      ...state,
      nutritionLogs: [...(state.nutritionLogs ?? []).filter((entry) => entry.date !== log.date), log],
    },
    log,
    adherence,
  };
}

import type { AppState, BodyMetric, DailyCheckIn, NutritionLog, RunLog, WorkoutSession } from "./types";

export type NextWeekRecommendation = "Progress" | "Repeat" | "Deload" | "Recovery focus";

export interface WeeklyReviewWindow {
  startDate: string;
  endDate: string;
}

export interface WeeklyReviewSummary {
  startDate: string;
  endDate: string;
  averageWeight: number | null;
  weightChange: number | null;
  totalWeeklyMiles: number;
  longRunCompleted: boolean;
  liftsCompleted: number;
  averageCalories: number | null;
  averageProtein: number | null;
  averageSleep: number | null;
  alcoholDays: number;
  painFlags: string[];
  adherenceScore: number;
  nextWeekRecommendation: NextWeekRecommendation;
  recommendationReason: string;
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const average = (values: number[]) => values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const inWindow = (date: string, window: WeeklyReviewWindow) => date >= window.startDate && date <= window.endDate;

const getWorkoutDate = (session: WorkoutSession) => (session.endedAt ?? session.startedAt).slice(0, 10);

function summarizePainFlags(checkIns: DailyCheckIn[], runLogs: RunLog[]): string[] {
  const checkInFlags = checkIns
    .filter((entry) => entry.pain || entry.painSeverity >= 4)
    .map((entry) => `${entry.date}: check-in pain ${entry.painSeverity}/10${entry.painLocation ? ` (${entry.painLocation})` : ""}`);
  const runFlags = runLogs
    .filter((entry) => entry.pain || (entry.painScore ?? 0) >= 4)
    .map((entry) => `${entry.date}: run pain ${entry.painScore ?? 7}/10${entry.painLocation ? ` (${entry.painLocation})` : ""}`);
  return [...checkInFlags, ...runFlags];
}

function calorieAdherence(logs: NutritionLog[]): number {
  if (!logs.length) return 0;
  const adherent = logs.filter((log) => log.calories >= 1980 && log.calories <= 2860).length;
  return Math.round((adherent / logs.length) * 100);
}

function buildAdherenceScore(input: {
  nutritionLogs: NutritionLog[];
  checkIns: DailyCheckIn[];
  runLogs: RunLog[];
  workoutSessions: WorkoutSession[];
  longRunCompleted: boolean;
}): number {
  const nutritionScore = input.nutritionLogs.length ? (calorieAdherence(input.nutritionLogs) + Math.min(100, Math.round(((average(input.nutritionLogs.map((log) => log.protein)) ?? 0) / 220) * 100))) / 2 : 0;
  const sleepScore = Math.min(100, Math.round(((average(input.checkIns.map((entry) => entry.sleepHours)) ?? 0) / 7) * 100));
  const liftScore = Math.min(100, Math.round((input.workoutSessions.filter((session) => session.status === "completed").length / 4) * 100));
  const runScore = input.longRunCompleted ? 100 : input.runLogs.length ? 70 : 0;
  const painPenalty = summarizePainFlags(input.checkIns, input.runLogs).some((flag) => /(?:7|8|9|10)\/10/.test(flag)) ? 25 : 0;
  return Math.max(0, Math.round((nutritionScore + sleepScore + liftScore + runScore) / 4 - painPenalty));
}

function chooseRecommendation(input: {
  averageSleep: number | null;
  averageSoreness: number | null;
  painFlags: string[];
  longRunCompleted: boolean;
  longRun?: RunLog;
  liftsCompleted: number;
  adherenceScore: number;
  alcoholDays: number;
}): { nextWeekRecommendation: NextWeekRecommendation; recommendationReason: string } {
  const highPain = input.painFlags.some((flag) => /(?:7|8|9|10)\/10/.test(flag));
  if (highPain) {
    return { nextWeekRecommendation: "Recovery focus", recommendationReason: "High pain was logged, so injury risk takes priority over progression. Reduce running intensity and lower-body lifting until symptoms improve." };
  }

  const poorRecovery = (input.averageSleep !== null && input.averageSleep < 6) || (input.averageSoreness !== null && input.averageSoreness >= 7.5);
  if (poorRecovery) {
    return { nextWeekRecommendation: "Deload", recommendationReason: "Weekly recovery is poor based on sleep or soreness, so hold or reduce training load and avoid aggressive calorie cuts." };
  }

  if (!input.longRunCompleted) {
    return { nextWeekRecommendation: "Repeat", recommendationReason: "Long run was missed, so repeat the current week instead of progressing." };
  }

  if (input.longRun && input.longRun.rpe <= 7 && !input.longRun.pain && (input.longRun.painScore ?? 0) < 4 && input.liftsCompleted >= 3 && input.adherenceScore >= 80) {
    return { nextWeekRecommendation: "Progress", recommendationReason: "Long run was completed with RPE <= 7, pain stayed low, lifting consistency was solid, and adherence supports conservative progression." };
  }

  if (input.alcoholDays >= 2 || input.adherenceScore < 70) {
    return { nextWeekRecommendation: "Repeat", recommendationReason: "Adherence, alcohol, or recovery signals were not strong enough to progress. Repeat the week and improve consistency." };
  }

  return { nextWeekRecommendation: "Repeat", recommendationReason: "Most work was completed, but the safest coach decision is to repeat until recovery and performance clearly support progression." };
}

export function buildWeeklyReviewSummary(state: AppState, window: WeeklyReviewWindow): WeeklyReviewSummary {
  const checkIns = (state.checkIns ?? []).filter((entry) => inWindow(entry.date, window));
  const bodyMetrics = (state.bodyMetrics ?? []).filter((entry: BodyMetric) => inWindow(entry.date, window) && Number.isFinite(entry.weight) && entry.weight > 0).sort((a, b) => a.date.localeCompare(b.date));
  const nutritionLogs = (state.nutritionLogs ?? []).filter((entry) => inWindow(entry.date, window));
  const runLogs = (state.runLogs ?? []).filter((entry) => inWindow(entry.date, window));
  const workoutSessions = (state.workoutSessions ?? []).filter((entry) => inWindow(getWorkoutDate(entry), window));

  const weights = bodyMetrics.map((entry) => entry.weight);
  const averageWeight = average(weights);
  const weightChange = weights.length >= 2 ? round(weights[weights.length - 1] - weights[0]) : null;
  const longRun = runLogs.find((entry) => entry.runType === "long run" || entry.plannedDistance >= 5 || entry.actualDistance >= 5);
  const longRunCompleted = Boolean(longRun?.completed && longRun.actualDistance > 0 && (longRun.painScore ?? 0) < 7);
  const liftsCompleted = workoutSessions.filter((session) => session.status === "completed").length;
  const averageCalories = average(nutritionLogs.map((entry) => entry.calories));
  const averageProtein = average(nutritionLogs.map((entry) => entry.protein));
  const averageSleep = average(checkIns.map((entry) => entry.sleepHours));
  const averageSoreness = average(checkIns.map((entry) => entry.soreness));
  const alcoholDays = Math.max(
    checkIns.filter((entry) => entry.alcohol).length,
    nutritionLogs.filter((entry) => entry.alcohol > 0).length,
  );
  const painFlags = summarizePainFlags(checkIns, runLogs);
  const totalWeeklyMiles = round(runLogs.reduce((sum, entry) => sum + (entry.completed ? entry.actualDistance : 0), 0));
  const adherenceScore = buildAdherenceScore({ nutritionLogs, checkIns, runLogs, workoutSessions, longRunCompleted });
  const recommendation = chooseRecommendation({ averageSleep, averageSoreness, painFlags, longRunCompleted, longRun, liftsCompleted, adherenceScore, alcoholDays });

  return {
    startDate: window.startDate,
    endDate: window.endDate,
    averageWeight,
    weightChange,
    totalWeeklyMiles,
    longRunCompleted,
    liftsCompleted,
    averageCalories,
    averageProtein,
    averageSleep,
    alcoholDays,
    painFlags,
    adherenceScore,
    ...recommendation,
  };
}

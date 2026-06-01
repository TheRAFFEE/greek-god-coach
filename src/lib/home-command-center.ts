import { buildWeightTrendDashboard } from "./weight-trend";
import { buildWeeklyReviewSummary } from "./weekly-review";
import type { AppState, MacroTarget } from "./types";

export interface HomeCommandCenterOptions {
  today: string;
  readinessStatus: "Green" | "Yellow" | "Red" | string;
  todaysWorkout: string;
  todaysRun: string;
  macroTarget: MacroTarget;
  coachRecommendation: string;
}

export interface HomeCommandCenterModel {
  readinessStatus: string;
  todaysWorkout: string;
  todaysRun: string;
  currentWeight: number | null;
  caloriesRemaining: number;
  weeklyWeightChange: number | null;
  weeklyMiles: number;
  daysUntilRace: number;
  coachRecommendation: string;
}

function weekWindow(endDate: string) {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

function daysUntilJan17(today: string) {
  const current = new Date(`${today}T00:00:00.000Z`);
  const year = current.getUTCMonth() === 0 && current.getUTCDate() <= 17 ? current.getUTCFullYear() : current.getUTCFullYear() + 1;
  const race = new Date(`${year}-01-17T00:00:00.000Z`);
  return Math.max(0, Math.ceil((race.getTime() - current.getTime()) / 86_400_000));
}

function conciseRecommendation(input: string, workout: string, run: string) {
  const firstSentence = input.split(/(?<=[.!?])\s+/)[0]?.trim();
  const command = firstSentence && firstSentence.length <= 150 ? firstSentence : `Do ${workout} today.`;
  return `${command} Run plan: ${run}. Keep the mission simple: check in, train, and log nutrition.`;
}

export function buildHomeCommandCenter(state: AppState, options: HomeCommandCenterOptions): HomeCommandCenterModel {
  const weightDashboard = buildWeightTrendDashboard(state.bodyMetrics ?? [], { startingWeight: state.user.startingWeight, goalWeight: state.user.goalWeight });
  const weeklyReview = buildWeeklyReviewSummary(state, weekWindow(options.today));
  const todaysNutrition = (state.nutritionLogs ?? []).find((entry) => entry.date === options.today);
  const caloriesRemaining = Math.max(0, options.macroTarget.calories - (todaysNutrition?.calories ?? 0));

  return {
    readinessStatus: options.readinessStatus,
    todaysWorkout: options.todaysWorkout,
    todaysRun: options.todaysRun,
    currentWeight: weightDashboard.latestWeight,
    caloriesRemaining,
    weeklyWeightChange: weightDashboard.weeklyWeightChange,
    weeklyMiles: weeklyReview.totalWeeklyMiles,
    daysUntilRace: daysUntilJan17(options.today),
    coachRecommendation: conciseRecommendation(options.coachRecommendation, options.todaysWorkout, options.todaysRun),
  };
}

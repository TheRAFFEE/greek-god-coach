import { evaluateDailyRecoveryStatus } from "./daily-checkin";
import { buildWeightTrendDashboard } from "./weight-trend";
import { buildWeeklyReviewSummary } from "./weekly-review";
import type { AppState, MacroTarget } from "./types";

export interface MvpDashboardOptions {
  today: string;
  currentWorkoutTitle: string;
  nextLiftTitle: string;
  nextRunLabel: string;
  macroTarget: MacroTarget;
}

export interface MvpDashboardModel {
  recoveryStatus: "Green" | "Yellow" | "Red" | "No check-in";
  currentWeight: number | null;
  sevenDayAverageWeight: number | null;
  weeklyMiles: number;
  nextRun: string;
  nextLift: string;
  caloriesStatus: string;
  proteinStatus: string;
  halfMarathonCountdown: number;
  currentPlanRecommendation: "Progress" | "Repeat" | "Deload" | "Recovery focus";
  currentWorkoutTitle: string;
}

const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : String(value);

function weekWindow(endDate: string) {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

function countdownToJan17(today: string) {
  const current = new Date(`${today}T00:00:00.000Z`);
  const year = current.getUTCMonth() === 0 && current.getUTCDate() <= 17 ? current.getUTCFullYear() : current.getUTCFullYear() + 1;
  const race = new Date(`${year}-01-17T00:00:00.000Z`);
  return Math.max(0, Math.ceil((race.getTime() - current.getTime()) / 86_400_000));
}

function latestByDate<T extends { date: string }>(entries: T[], today: string): T | undefined {
  return [...entries].filter((entry) => entry.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
}

function latestTrainingDate(state: AppState, today: string) {
  const candidates = [
    ...(state.checkIns ?? []).map((entry) => entry.date),
    ...(state.bodyMetrics ?? []).map((entry) => entry.date),
    ...(state.nutritionLogs ?? []).map((entry) => entry.date),
    ...(state.runLogs ?? []).map((entry) => entry.date),
    ...(state.workoutSessions ?? []).map((entry) => (entry.endedAt ?? entry.startedAt).slice(0, 10)),
  ].filter((date) => date <= today).sort((a, b) => b.localeCompare(a));
  return candidates[0] ?? today;
}

function nutritionStatus(log: { calories: number; protein: number } | undefined, target: MacroTarget) {
  if (!log) return { caloriesStatus: "No nutrition logged today", proteinStatus: "No protein logged today" };
  return {
    caloriesStatus: `${formatNumber(log.calories)} / ${formatNumber(target.calories)} cal`,
    proteinStatus: `${formatNumber(log.protein)} / ${formatNumber(target.protein)}g protein`,
  };
}

export function buildMvpDashboard(state: AppState, options: MvpDashboardOptions): MvpDashboardModel {
  const todaysCheckIn = (state.checkIns ?? []).find((entry) => entry.date === options.today);
  const recoveryStatus = todaysCheckIn ? evaluateDailyRecoveryStatus(todaysCheckIn).status : "No check-in";
  const weightDashboard = buildWeightTrendDashboard(state.bodyMetrics ?? [], { startingWeight: state.user.startingWeight, goalWeight: state.user.goalWeight });
  const dashboardDate = latestTrainingDate(state, options.today);
  const weeklyReview = buildWeeklyReviewSummary(state, weekWindow(dashboardDate));
  const nutritionLog = (state.nutritionLogs ?? []).find((entry) => entry.date === options.today) ?? latestByDate(state.nutritionLogs ?? [], options.today);
  const nutrition = nutritionStatus(nutritionLog, options.macroTarget);

  return {
    recoveryStatus,
    currentWeight: weightDashboard.latestWeight,
    sevenDayAverageWeight: weightDashboard.sevenDayAverage,
    weeklyMiles: weeklyReview.totalWeeklyMiles,
    nextRun: options.nextRunLabel,
    nextLift: options.nextLiftTitle,
    caloriesStatus: nutrition.caloriesStatus,
    proteinStatus: nutrition.proteinStatus,
    halfMarathonCountdown: countdownToJan17(options.today),
    currentPlanRecommendation: weeklyReview.nextWeekRecommendation,
    currentWorkoutTitle: options.currentWorkoutTitle,
  };
}

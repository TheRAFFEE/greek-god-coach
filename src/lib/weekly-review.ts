import type { AppState, BodyMetric, DailyCheckIn, NutritionLog, RunLog, WorkoutSession } from "./types";
import { evaluateReadiness, readinessInputFromWeeklyWindow, type ReadinessEngineResult } from "./readiness-engine";
import { evaluateRunning, type RunningEngineInput, type RunningEngineResult, type RunningProgressionAction } from "./running-engine";
import { evaluateProgression, type ProgressionEngineInput } from "./progression-engine";

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
  runningProgressionAction: RunningProgressionAction;
  runningReadiness: RunningEngineResult["runningReadiness"];
  runningRaceReadinessScore: number;
  runningInjuryRiskScore: number;
  runningConfidenceScore: number;
  runningDataQualityScore: number;
  runningExplanation: string;
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

export function buildRunningEngineInputForWeeklyReview(input: {
  window: WeeklyReviewWindow;
  runLogs: RunLog[];
  checkIns: DailyCheckIn[];
  weeklyReadiness: ReadinessEngineResult;
  totalWeeklyMiles: number;
}): RunningEngineInput {
  const sortedRuns = [...input.runLogs].sort((a, b) => a.date.localeCompare(b.date));
  const completedRuns = sortedRuns.filter((run) => run.completed && run.actualDistance > 0);
  const averageSleep = average(input.checkIns.map((entry) => entry.sleepHours)) ?? undefined;
  const averageSoreness = average(input.checkIns.map((entry) => entry.soreness)) ?? undefined;
  const averageStress = average(input.checkIns.map((entry) => entry.stress)) ?? undefined;
  const averageEnergy = average(input.checkIns.map((entry) => entry.energy)) ?? undefined;
  return {
    generatedAt: `${input.window.endDate}T12:00:00.000Z`,
    evaluationDate: input.window.endDate,
    race: { raceDate: "2027-01-17", targetFinishMinutes: 118, targetPaceSecondsPerMile: 540, distanceMiles: 13.1 },
    runLogs: sortedRuns.map((run) => ({
      id: run.id,
      date: run.date,
      runType: run.runType,
      plannedDistance: run.plannedDistance,
      actualDistance: run.actualDistance,
      durationMinutes: run.durationMinutes,
      averagePace: run.averagePace,
      averagePaceSecondsPerMile: Math.round(run.averagePace * 60),
      averageHr: run.averageHr,
      maxHr: run.maxHr,
      rpe: run.rpe,
      zone2Compliance: run.zone2Compliance,
      completed: run.completed,
      walkBreaks: run.walkBreaks,
      pain: run.pain,
      painScore: run.painScore,
      painLocation: run.painLocation,
      notes: run.notes,
    })),
    currentWeek: {
      startDate: input.window.startDate,
      endDate: input.window.endDate,
      weeklyMileage: input.totalWeeklyMiles,
      rolling7DayMileage: input.totalWeeklyMiles,
      runningDaysPlanned: Math.max(sortedRuns.length, 1),
      runningDaysCompleted: completedRuns.length,
    },
    readiness: {
      status: input.weeklyReadiness.status,
      score: input.weeklyReadiness.score,
      confidence: input.weeklyReadiness.confidence,
      averageSleep,
      averageSoreness,
      averageStress,
      averageEnergy,
    },
  };
}

function chooseRecommendation(input: {
  running: RunningEngineResult;
  weeklyReadiness: ReadinessEngineResult;
  liftsCompleted: number;
  adherenceScore: number;
  alcoholDays: number;
  nutritionLogs: NutritionLog[];
  bodyMetrics: BodyMetric[];
  longRunCompleted: boolean;
}): { nextWeekRecommendation: NextWeekRecommendation; recommendationReason: string } {
  const weights = input.bodyMetrics.map((entry) => entry.weight).filter((weight) => Number.isFinite(weight) && weight > 0);
  const firstWeight = weights[0] ?? null;
  const currentWeight = weights.at(-1) ?? null;
  const weightChange = firstWeight !== null && currentWeight !== null ? round(currentWeight - firstWeight) : null;
  const waists = input.bodyMetrics.map((entry) => entry.waist).filter((waist): waist is number => Number.isFinite(waist));
  const waistTrend = waists.length >= 2 ? round(waists[waists.length - 1] - waists[0]) : null;
  const caloriesAdherence = calorieAdherence(input.nutritionLogs);
  const proteinAdherence = Math.min(100, Math.round(((average(input.nutritionLogs.map((log) => log.protein)) ?? 0) / 220) * 100));
  const macroAdherence = input.nutritionLogs.length ? Math.round((caloriesAdherence + proteinAdherence) / 2) : 0;
  const progressionInput: ProgressionEngineInput = {
    readinessResult: input.weeklyReadiness,
    nutritionResult: {
      macroAdherence,
      caloriesAdherence,
      proteinAdherence,
      loggingConsistency: input.nutritionLogs.length ? Math.min(100, Math.round((input.nutritionLogs.length / 7) * 100)) : 0,
      alcoholDays: input.alcoholDays,
      confidence: input.nutritionLogs.length >= 5 ? "High" : input.nutritionLogs.length >= 3 ? "Medium" : "Low",
    },
    runningResult: input.running,
    workoutResult: {
      overallDecision: input.liftsCompleted >= 3 ? "Progress" : "Repeat",
      strengthProgression: {
        action: input.liftsCompleted >= 3 ? "Progress" : "Repeat",
        exercisesProgressing: input.liftsCompleted >= 3 ? ["weekly lifting consistency"] : [],
        exercisesStalled: input.liftsCompleted >= 3 ? [] : ["weekly lifting consistency"],
        exercisesRegressing: [],
      },
      hypertrophyProgression: { action: input.liftsCompleted >= 3 ? "Progress" : "Repeat" },
      fatigue: { systemicFatigueScore: input.weeklyReadiness.status === "Red" ? 80 : input.weeklyReadiness.status === "Yellow" ? 45 : 20, fatigueStatus: input.weeklyReadiness.status === "Red" ? "severe" : input.weeklyReadiness.status === "Yellow" ? "moderate" : "low" },
      prs: { newPrs: [] },
      confidenceScore: 70,
      dataQualityScore: 70,
    },
    weightTrend: {
      currentWeight,
      goalWeight: 199.9,
      sevenDayAverage: average(weights),
      fourteenDayAverage: average(weights),
      weeklyLossRate: weightChange === null ? null : Math.max(0, -weightChange),
      waistTrend,
    },
    weeklyReviewMetrics: {
      adherenceScore: input.adherenceScore,
      trainingAdherence: Math.min(100, Math.round((input.liftsCompleted / 4) * 100)),
      nutritionAdherence: macroAdherence,
      longRunCompleted: input.longRunCompleted,
      liftsCompleted: input.liftsCompleted,
      plannedLifts: 4,
      missedWorkouts: Math.max(0, 4 - input.liftsCompleted),
      missedRuns: input.longRunCompleted ? 0 : 1,
      missedLogs: Math.max(0, 7 - input.nutritionLogs.length),
      missedCheckIns: 0,
      missingNutritionDays: Math.max(0, 7 - input.nutritionLogs.length),
      missingBodyMetrics: input.bodyMetrics.length ? 0 : 1,
      weeklyFatigue: input.weeklyReadiness.status === "Red" ? "severe" : input.weeklyReadiness.status === "Yellow" ? "moderate" : "low",
      recoveryTrend: input.weeklyReadiness.status === "Red" ? "poor" : input.weeklyReadiness.status === "Yellow" ? "stable" : "improving",
      strengthProgressStalled: input.liftsCompleted < 3,
      weeksFatLossBelowMinimum: weightChange !== null && Math.max(0, -weightChange) < 0.25 ? 3 : 0,
    },
    goalContext: {
      fatLossGoal: { label: "Under 200 lb" },
      physiqueGoal: { label: "Greek God physique" },
      strengthGoal: { label: "Strength progression" },
      halfMarathonGoal: { label: "January 17 half marathon" },
    },
  };
  const progression = evaluateProgression(progressionInput);
  return {
    nextWeekRecommendation: progression.weeklyDecision === "Recovery Focus" ? "Recovery focus" : progression.weeklyDecision,
    recommendationReason: progression.reasons.join(" "),
  };
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
  const alcoholDays = Math.max(
    checkIns.filter((entry) => entry.alcohol).length,
    nutritionLogs.filter((entry) => entry.alcohol > 0).length,
  );
  const painFlags = summarizePainFlags(checkIns, runLogs);
  const totalWeeklyMiles = round(runLogs.reduce((sum, entry) => sum + (entry.completed ? entry.actualDistance : 0), 0));
  const adherenceScore = buildAdherenceScore({ nutritionLogs, checkIns, runLogs, workoutSessions, longRunCompleted });
  const runPainSeverity = runLogs.reduce((max, entry) => Math.max(max, entry.pain || (entry.painScore ?? 0) > 0 ? (entry.painScore ?? 0) : 0), 0) || null;
  const weeklyReadiness = evaluateReadiness(readinessInputFromWeeklyWindow({ checkIns, runPainSeverity }));
  const running = evaluateRunning(buildRunningEngineInputForWeeklyReview({ window, runLogs, checkIns, weeklyReadiness, totalWeeklyMiles }));
  const recommendation = chooseRecommendation({ running, weeklyReadiness, liftsCompleted, adherenceScore, alcoholDays, nutritionLogs, bodyMetrics, longRunCompleted });

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
    runningProgressionAction: running.progression.action,
    runningReadiness: running.runningReadiness,
    runningRaceReadinessScore: running.readiness.raceReadinessScore,
    runningInjuryRiskScore: running.readiness.injuryRiskScore,
    runningConfidenceScore: running.confidenceScore,
    runningDataQualityScore: running.dataQualityScore,
    runningExplanation: running.explanations.map((explanation) => explanation.summary).join(" "),
  };
}

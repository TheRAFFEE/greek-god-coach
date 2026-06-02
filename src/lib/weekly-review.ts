import type { AppState, BodyMetric, DailyCheckIn, NutritionLog, RunLog, WorkoutSession } from "./types";
import { evaluateReadiness, readinessInputFromWeeklyWindow, type ReadinessEngineResult } from "./readiness-engine";
import { evaluateRunning, type RunningEngineInput, type RunningEngineResult, type RunningProgressionAction } from "./running-engine";

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
}): { nextWeekRecommendation: NextWeekRecommendation; recommendationReason: string } {
  const runningAction = input.running.progression.action;
  if (runningAction === "Recovery Focus") {
    return { nextWeekRecommendation: "Recovery focus", recommendationReason: `${input.running.progression.reason} Running Engine V2 injury risk ${input.running.readiness.injuryRiskScore}/100 takes priority over progression.` };
  }
  if (runningAction === "Regress") {
    return { nextWeekRecommendation: "Deload", recommendationReason: `${input.running.progression.reason} Running Engine V2 recommends reducing run load before progressing.` };
  }
  if (input.weeklyReadiness.status === "Red") {
    return { nextWeekRecommendation: "Deload", recommendationReason: `Weekly readiness is Red because ${input.weeklyReadiness.reason}, so hold or reduce training load and avoid aggressive calorie cuts.` };
  }
  if (runningAction === "Hold") {
    const longRunMissed = input.running.longRunStatus.status === "unknown" || input.running.longRunStatus.status === "watch";
    const recoveryWarning = input.weeklyReadiness.status === "Yellow" && input.weeklyReadiness.reasons.some((reason) => reason.severity === "red" || reason.factor === "sleep" || reason.factor === "soreness" || reason.factor === "energy" || reason.factor === "pain");
    const legacyReason = longRunMissed
      ? "Long run was missed, so repeat the current week instead of progressing."
      : recoveryWarning
        ? "Weekly readiness is Yellow with a major recovery warning, so repeat instead of progressing."
        : `${input.running.progression.reason} Repeat the week until Running Engine V2 supports progression.`;
    return { nextWeekRecommendation: "Repeat", recommendationReason: legacyReason };
  }
  if (input.liftsCompleted >= 3 && input.adherenceScore >= 80 && input.alcoholDays < 2) {
    return { nextWeekRecommendation: "Progress", recommendationReason: `Long run was completed. ${input.running.progression.reason} Lifting consistency and adherence also support conservative progression.` };
  }
  return { nextWeekRecommendation: "Repeat", recommendationReason: "Running Engine V2 supports progression, but lifting, nutrition, alcohol, or recovery consistency is not strong enough. Repeat before progressing." };
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
  const recommendation = chooseRecommendation({ running, weeklyReadiness, liftsCompleted, adherenceScore, alcoholDays });

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

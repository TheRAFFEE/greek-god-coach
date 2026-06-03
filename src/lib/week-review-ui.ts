import type { BodyMetric, DailyCheckIn, NutritionLog, RunLog, WorkoutSession } from "./types";
import type { OrchestratorEngineResult } from "./orchestrator-engine";
import type { PerformanceEngineResult } from "./performance-engine";
import type { PhysiqueEngineResult } from "./physique-engine";
import type { ProgressionEngineResult } from "./progression-engine";

export interface WeekReviewUiModel {
  weekOutcome: string;

  workoutsCompleted: number;
  workoutsPlanned: number;

  runsCompleted: number;
  runsPlanned: number;

  nutritionAdherence: number;

  averageWeight?: number;
  weightTrend?: string;

  readinessTrend?: string;
  physiqueTrend?: string;
  recoveryTrend?: string;

  biggestWin?: string;
  biggestRisk?: string;

  nextWeekFocus?: string;

  summary: string;
}

export interface WeekReviewUiInput {
  weekStartDate: string;
  weekEndDate: string;
  workoutsPlanned: number;
  runsPlanned: number;
  workoutSessions?: WorkoutSession[];
  runLogs?: RunLog[];
  nutritionLogs?: NutritionLog[];
  checkIns?: DailyCheckIn[];
  bodyMetrics?: BodyMetric[];
  progressionEngineResult?: Partial<ProgressionEngineResult> | null;
  performanceEngineResult?: Partial<PerformanceEngineResult> | null;
  physiqueEngineResult?: Partial<PhysiqueEngineResult> | null;
  orchestratorEngineResult?: Partial<OrchestratorEngineResult> | null;
}

const EMPTY_SUMMARY = "Complete more workouts, runs, and check-ins to generate a weekly review.";

const round1 = (value: number) => Math.round(value * 10) / 10;
const inWindow = (date: string, startDate: string, endDate: string) => date >= startDate && date <= endDate;
const workoutDate = (session: WorkoutSession) => (session.endedAt ?? session.startedAt).slice(0, 10);
const percent = (completed: number, planned: number) => planned > 0 ? Math.round((completed / planned) * 100) : 0;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function average(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function weightTrend(metrics: BodyMetric[]): string | undefined {
  if (metrics.length < 2) return undefined;
  const first = metrics[0];
  const last = metrics[metrics.length - 1];
  const delta = round1(last.weight - first.weight);
  if (Math.abs(delta) < 0.1) return "Flat";
  const direction = delta < 0 ? "Down" : "Up";
  return `${direction} ${Math.abs(delta)} lb`;
}

function nutritionAdherenceFrom(logs: NutritionLog[]): number {
  if (!logs.length) return 0;
  return Math.round((logs.length / 7) * 100);
}

function weekOutcome(input: { workoutAdherence: number; runAdherence: number; nutritionAdherence: number }) {
  const weakest = Math.min(input.workoutAdherence, input.runAdherence, input.nutritionAdherence);
  if (weakest >= 90) return "Excellent Week";
  if (weakest >= 75) return "Good Week";
  if (weakest >= 50) return "Mixed Week";
  return "Poor Week";
}

function readinessTrendFrom(input: WeekReviewUiInput): string | undefined {
  const performanceTrend = input.performanceEngineResult?.recoveryTrend as { status?: unknown } | undefined;
  const fromPerformance = text(performanceTrend?.status);
  if (fromPerformance) return fromPerformance;

  const checkIns = [...(input.checkIns ?? [])]
    .filter((entry) => inWindow(entry.date, input.weekStartDate, input.weekEndDate))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (checkIns.length < 2) return undefined;
  const first = checkIns[0];
  const last = checkIns[checkIns.length - 1];
  const firstRecovery = first.sleepHours + first.energy - first.soreness - first.stress;
  const lastRecovery = last.sleepHours + last.energy - last.soreness - last.stress;
  if (lastRecovery - firstRecovery >= 1) return "Improving";
  if (firstRecovery - lastRecovery >= 1) return "Declining";
  return "Stable";
}

function deterministicSummary(input: {
  weekOutcome: string;
  workoutAdherence: number;
  runAdherence: number;
  nutritionAdherence: number;
  weightTrend?: string;
  readinessTrend?: string;
  nextWeekFocus?: string;
}) {
  const weight = input.weightTrend ? ` Weight trend: ${input.weightTrend}.` : "";
  const readiness = input.readinessTrend ? ` Recovery trend: ${input.readinessTrend}.` : "";
  const focus = input.nextWeekFocus ? ` Primary focus next week is ${input.nextWeekFocus}.` : "";
  return `This week ${input.weekOutcome}: workout adherence ${input.workoutAdherence}%, run adherence ${input.runAdherence}%, and nutrition adherence ${input.nutritionAdherence}%.${weight}${readiness}${focus}`;
}

export function buildWeekReviewUiModel(input: WeekReviewUiInput): WeekReviewUiModel {
  const workouts = [...(input.workoutSessions ?? [])].filter((session) => inWindow(workoutDate(session), input.weekStartDate, input.weekEndDate));
  const runs = [...(input.runLogs ?? [])].filter((run) => inWindow(run.date, input.weekStartDate, input.weekEndDate));
  const nutritionLogs = [...(input.nutritionLogs ?? [])].filter((log) => inWindow(log.date, input.weekStartDate, input.weekEndDate));
  const bodyMetrics = [...(input.bodyMetrics ?? [])]
    .filter((entry) => inWindow(entry.date, input.weekStartDate, input.weekEndDate))
    .sort((a, b) => a.date.localeCompare(b.date));
  const checkIns = [...(input.checkIns ?? [])].filter((entry) => inWindow(entry.date, input.weekStartDate, input.weekEndDate));

  const hasWeeklyData = workouts.length > 0 || runs.length > 0 || nutritionLogs.length > 0 || checkIns.length > 0;
  if (!hasWeeklyData) {
    return {
      weekOutcome: "Insufficient Data",
      workoutsCompleted: 0,
      workoutsPlanned: input.workoutsPlanned,
      runsCompleted: 0,
      runsPlanned: input.runsPlanned,
      nutritionAdherence: 0,
      summary: EMPTY_SUMMARY,
    };
  }

  const workoutsCompleted = workouts.filter((session) => session.status === "completed").length;
  const runsCompleted = runs.filter((run) => run.completed).length;
  const nutritionAdherence = nutritionAdherenceFrom(nutritionLogs);
  const workoutAdherence = percent(workoutsCompleted, input.workoutsPlanned);
  const runAdherence = percent(runsCompleted, input.runsPlanned);
  const outcome = weekOutcome({ workoutAdherence, runAdherence, nutritionAdherence });
  const readinessTrend = readinessTrendFrom({ ...input, checkIns });
  const nextWeekFocus = text(input.orchestratorEngineResult?.weekFocus) ?? text(input.orchestratorEngineResult?.topPriority) ?? text(input.progressionEngineResult?.weeklyDecision);
  const model: WeekReviewUiModel = {
    weekOutcome: outcome,
    workoutsCompleted,
    workoutsPlanned: input.workoutsPlanned,
    runsCompleted,
    runsPlanned: input.runsPlanned,
    nutritionAdherence,
    summary: deterministicSummary({ weekOutcome: outcome, workoutAdherence, runAdherence, nutritionAdherence, weightTrend: weightTrend(bodyMetrics), readinessTrend, nextWeekFocus }),
  };

  const avgWeight = average(bodyMetrics.map((entry) => entry.weight).filter((value) => Number.isFinite(value)));
  const wTrend = weightTrend(bodyMetrics);
  if (avgWeight !== undefined) model.averageWeight = avgWeight;
  if (wTrend) model.weightTrend = wTrend;
  if (readinessTrend) model.readinessTrend = readinessTrend;
  const physiqueTrend = text(input.physiqueEngineResult?.physiqueStatus);
  if (physiqueTrend) model.physiqueTrend = physiqueTrend;
  if (readinessTrend) model.recoveryTrend = readinessTrend;
  const biggestWin = text(input.orchestratorEngineResult?.biggestOpportunity) ?? text(input.performanceEngineResult?.primaryOpportunity) ?? text(input.physiqueEngineResult?.primaryOpportunity);
  if (biggestWin) model.biggestWin = biggestWin;
  const biggestRisk = text(input.orchestratorEngineResult?.biggestRisk) ?? text(input.performanceEngineResult?.primaryRisk) ?? text(input.physiqueEngineResult?.primaryRisk);
  if (biggestRisk) model.biggestRisk = biggestRisk;
  if (nextWeekFocus) model.nextWeekFocus = nextWeekFocus;

  return model;
}

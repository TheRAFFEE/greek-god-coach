import type { MacroAdherenceSummary } from "./nutrition-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { RunningEngineResult, RunningProgressionAction } from "./running-engine";
import type { WorkoutProgressionDecision } from "./workout-engine";

export type WeeklyProgressDecision = "Progress" | "Repeat" | "Deload" | "Recovery Focus";
export type NutritionProgressDecision = "Increase Calories" | "Maintain Calories" | "Reduce Calories";
export type ProgressionGoalName = "Fat Loss" | "Physique" | "Strength" | "Half Marathon";
export type ProgressionGoalStatus = "On Track" | "At Risk" | "Off Track";
export type ProgressionConfidence = "High" | "Medium" | "Low";
export type ProgressionDecisionPriority = "Safety" | "Recovery" | "Adherence" | "Goal progress" | "Optimization";

export interface ProgressionRunningInputFromRunningEngineV2 {
  progressionAction: RunningProgressionAction;
  injuryRiskScore: number;
  raceReadinessScore: number;
  confidenceScore: number;
  explanations: string[];
}

export interface ProgressionWeightTrendInput {
  currentWeight?: number | null;
  goalWeight?: number | null;
  sevenDayAverage?: number | null;
  fourteenDayAverage?: number | null;
  weeklyLossRate?: number | null;
  waistTrend?: number | null;
}

export interface ProgressionWeeklyReviewMetricsInput {
  adherenceScore?: number | null;
  trainingAdherence?: number | null;
  nutritionAdherence?: number | null;
  longRunCompleted?: boolean | null;
  liftsCompleted?: number | null;
  plannedLifts?: number | null;
  missedWorkouts?: number | null;
  failedWorkouts?: number | null;
  missedRuns?: number | null;
  missedLogs?: number | null;
  missedCheckIns?: number | null;
  missingNutritionDays?: number | null;
  missingRuns?: number | null;
  missingBodyMetrics?: number | null;
  weeklyFatigue?: "low" | "moderate" | "high" | "severe" | string | null;
  recoveryTrend?: "improving" | "stable" | "worsening" | "poor" | "unknown" | string | null;
  strengthProgressStalled?: boolean | null;
  multipleFailedWorkouts?: boolean | null;
  weeksFatLossBelowMinimum?: number | null;
}

export interface ProgressionGoalContextInput {
  fatLossGoal: unknown;
  physiqueGoal: unknown;
  strengthGoal: unknown;
  halfMarathonGoal: unknown;
}

type ProgressionNutritionInput = Partial<MacroAdherenceSummary> & {
  macroAdherence?: number;
  currentCalories?: number;
};

type ProgressionReadinessInput = Partial<ReadinessEngineResult> & {
  status?: "Green" | "Yellow" | "Red";
  score?: number;
  confidence?: ProgressionConfidence;
};

type ProgressionRunningResultInput = {
  progression?: { action?: RunningProgressionAction; reason?: string };
  readiness?: { injuryRiskScore?: number; raceReadinessScore?: number };
  prediction?: { targetFinishGapMinutes?: number | null; targetPaceGapSecondsPerMile?: number | null };
  confidence?: ProgressionConfidence;
  confidenceScore?: number;
  dataQualityScore?: number;
  explanations?: Array<{ summary: string }>;
};

type ProgressionWorkoutResultInput = {
  overallDecision?: WorkoutProgressionDecision;
  strengthProgression?: { action?: WorkoutProgressionDecision; exercisesProgressing?: string[]; exercisesStalled?: string[]; exercisesRegressing?: string[] };
  hypertrophyProgression?: { action?: WorkoutProgressionDecision };
  fatigue?: { systemicFatigueScore?: number; fatigueStatus?: "low" | "moderate" | "high" | "severe" | string };
  prs?: { newPrs?: unknown[] };
  confidenceScore?: number;
  dataQualityScore?: number;
  explanation?: { summary?: string };
};

export interface ProgressionEngineInput {
  readinessResult: ProgressionReadinessInput | null;
  nutritionResult: ProgressionNutritionInput | null;
  runningResult: ProgressionRunningResultInput | null;
  workoutResult: ProgressionWorkoutResultInput | null;
  weightTrend: ProgressionWeightTrendInput;
  weeklyReviewMetrics: ProgressionWeeklyReviewMetricsInput;
  goalContext: ProgressionGoalContextInput;
}

export interface ProgressionDataQuality {
  score: number;
  confidence: ProgressionConfidence;
  missingInputs: string[];
  penalties: string[];
  warnings: string[];
}

export interface ProgressionAuditEntry {
  id: string;
  decisionType: "weekly" | "nutrition" | "goal-status" | "confidence" | "data-quality";
  decision: string;
  engine: "Progression Engine" | "Readiness Engine" | "Nutrition Engine" | "Running Engine" | "Workout Engine";
  whatHappened: string;
  why: string;
  priority: ProgressionDecisionPriority;
  dataUsed: string[];
  confidence: ProgressionConfidence;
  dataQualityScore: number;
}

export interface ProgressionEngineResult {
  weeklyDecision: WeeklyProgressDecision;
  nutritionDecision: NutritionProgressDecision;
  goalStatus: Record<ProgressionGoalName, ProgressionGoalStatus>;
  confidence: ProgressionConfidence;
  dataQuality: ProgressionDataQuality;
  reasons: string[];
  warnings: string[];
  auditEntries: ProgressionAuditEntry[];
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const lower = (value: unknown) => String(value ?? "").toLowerCase();

function confidenceFromScore(score: number): ProgressionConfidence {
  if (score >= 85) return "High";
  if (score >= 65) return "Medium";
  return "Low";
}

function confidenceScore(confidence?: string | null): number {
  if (confidence === "High") return 100;
  if (confidence === "Medium") return 75;
  if (confidence === "Low") return 45;
  return 65;
}

function addAudit(input: {
  entries: ProgressionAuditEntry[];
  decisionType: ProgressionAuditEntry["decisionType"];
  decision: string;
  engine?: ProgressionAuditEntry["engine"];
  whatHappened: string;
  why: string;
  priority: ProgressionDecisionPriority;
  dataUsed: string[];
  confidence: ProgressionConfidence;
  dataQualityScore: number;
}) {
  input.entries.push({
    id: `progression-${input.entries.length + 1}`,
    decisionType: input.decisionType,
    decision: input.decision,
    engine: input.engine ?? "Progression Engine",
    whatHappened: input.whatHappened,
    why: input.why,
    priority: input.priority,
    dataUsed: input.dataUsed,
    confidence: input.confidence,
    dataQualityScore: input.dataQualityScore,
  });
}

function evaluateDataQuality(input: ProgressionEngineInput): ProgressionDataQuality {
  let score = 100;
  const missingInputs: string[] = [];
  const penalties: string[] = [];
  const warnings: string[] = [];
  const penalize = (points: number, reason: string) => {
    score -= points;
    penalties.push(reason);
  };

  (["readinessResult", "nutritionResult", "runningResult", "workoutResult"] as const).forEach((key) => {
    if (!input[key]) {
      missingInputs.push(key);
      penalize(20, `Missing ${key}`);
    }
  });

  const metrics = input.weeklyReviewMetrics ?? {};
  if ((metrics.missedLogs ?? 0) > 0) penalize(Math.min(12, (metrics.missedLogs ?? 0) * 3), `${metrics.missedLogs} missing logs`);
  if ((metrics.missedCheckIns ?? 0) > 0) penalize(Math.min(15, (metrics.missedCheckIns ?? 0) * 3), `${metrics.missedCheckIns} missing check-ins`);
  const missedRuns = metrics.missedRuns ?? metrics.missingRuns ?? 0;
  if (missedRuns > 0) penalize(Math.min(12, missedRuns * 4), `${missedRuns} missing runs`);
  if ((metrics.missingNutritionDays ?? 0) > 0) penalize(Math.min(15, (metrics.missingNutritionDays ?? 0) * 3), `${metrics.missingNutritionDays} missing nutrition days`);
  if ((metrics.missingBodyMetrics ?? 0) > 0) penalize(8, "Missing body metrics");
  if (!isNumber(input.weightTrend?.currentWeight) || !isNumber(input.weightTrend?.weeklyLossRate)) penalize(8, "Incomplete body metric trend");

  const finalScore = clamp(Math.round(score));
  if (finalScore < 70) warnings.push("Data quality is poor enough that progression should be conservative.");
  return { score: finalScore, confidence: confidenceFromScore(finalScore), missingInputs, penalties, warnings };
}

function evaluateConfidence(input: ProgressionEngineInput, dataQuality: ProgressionDataQuality): ProgressionConfidence {
  if (dataQuality.missingInputs.length) return "Low";
  const scores = [
    confidenceScore(input.readinessResult?.confidence),
    confidenceScore(input.nutritionResult?.confidence),
    input.runningResult?.confidenceScore ?? confidenceScore(input.runningResult?.confidence),
    input.workoutResult?.confidenceScore ?? 70,
    dataQuality.score,
  ];
  return confidenceFromScore(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function macroAdherence(input: ProgressionEngineInput): number {
  return input.nutritionResult?.macroAdherence ?? input.nutritionResult?.weeklyAdherence ?? input.weeklyReviewMetrics.nutritionAdherence ?? input.weeklyReviewMetrics.adherenceScore ?? 0;
}

function isRecoveryWorsening(input: ProgressionEngineInput): boolean {
  const trend = lower(input.weeklyReviewMetrics.recoveryTrend);
  return trend === "worsening" || trend === "poor";
}

function evaluateWeeklyDecision(input: ProgressionEngineInput, confidence: ProgressionConfidence, dataQuality: ProgressionDataQuality): { decision: WeeklyProgressDecision; reasons: string[]; warnings: string[]; priority: ProgressionDecisionPriority } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const readinessStatus = input.readinessResult?.status;
  const injuryRisk = input.runningResult?.readiness?.injuryRiskScore ?? 0;
  const workoutDecision = input.workoutResult?.overallDecision;

  if (readinessStatus === "Red" || injuryRisk >= 70 || workoutDecision === "Deload") {
    if (readinessStatus === "Red") reasons.push("Readiness Engine is Red, so safety blocks progression.");
    if (injuryRisk >= 70) reasons.push(`Running Engine injury risk is ${injuryRisk}/100, so safety blocks progression.`);
    if (workoutDecision === "Deload") reasons.push("Workout Engine overall decision is Deload, so safety blocks progression.");
    warnings.push("Safety trigger active: weekly progression is not allowed.");
    return { decision: "Recovery Focus", reasons, warnings, priority: "Safety" };
  }

  const fatigue = lower(input.weeklyReviewMetrics.weeklyFatigue || input.workoutResult?.fatigue?.fatigueStatus);
  const failedWorkouts = input.weeklyReviewMetrics.failedWorkouts ?? 0;
  const multipleFailed = Boolean(input.weeklyReviewMetrics.multipleFailedWorkouts) || failedWorkouts >= 2;
  if (fatigue === "high" || fatigue === "severe" || isRecoveryWorsening(input) || multipleFailed) {
    if (fatigue === "high" || fatigue === "severe") reasons.push("Weekly fatigue is high, so deload before adding stress.");
    if (isRecoveryWorsening(input)) reasons.push("Recovery trend is worsening, so deload takes priority over optimization.");
    if (multipleFailed) reasons.push("Multiple failed workouts indicate accumulated fatigue.");
    return { decision: "Deload", reasons, warnings, priority: "Recovery" };
  }

  const adherence = input.weeklyReviewMetrics.adherenceScore ?? macroAdherence(input);
  const longRunMissed = input.weeklyReviewMetrics.longRunCompleted === false;
  const strengthStalled = Boolean(input.weeklyReviewMetrics.strengthProgressStalled) || lower(input.workoutResult?.strengthProgression?.action) === "repeat";
  const readinessReasons = input.readinessResult?.reasons ?? [];
  const recoveryCaution = input.readinessResult?.status === "Yellow" && readinessReasons.some((reason) => reason.severity === "red" || reason.factor === "sleep" || reason.factor === "soreness" || reason.factor === "energy" || reason.factor === "pain");
  if (adherence < 80 || longRunMissed || strengthStalled || recoveryCaution || dataQuality.score < 70) {
    if (adherence < 80) reasons.push(`Weekly adherence is ${adherence}/100, below the 80% progression floor.`);
    if (longRunMissed) reasons.push("Long run was missed, so repeat before progressing.");
    if (strengthStalled) reasons.push("Strength progress is stalled, so repeat before adding load or volume.");
    if (recoveryCaution) reasons.push("Weekly readiness is Yellow with a major recovery warning, so repeat instead of progressing.");
    if (dataQuality.score < 70) reasons.push(`Data quality is ${dataQuality.score}/100, so repeat until the signal is trustworthy.`);
    return { decision: "Repeat", reasons, warnings, priority: "Adherence" };
  }

  const runningAction = input.runningResult?.progression?.action;
  const workoutAllowsProgress = workoutDecision === "Progress" || workoutDecision === "Repeat";
  const confidenceAllowsProgress = confidence === "High" || confidence === "Medium";
  if (runningAction === "Progress" && workoutAllowsProgress && macroAdherence(input) >= 80 && confidenceAllowsProgress) {
    reasons.push(`${input.weeklyReviewMetrics.longRunCompleted ? "Long run was completed. " : ""}Readiness, running progression, workout progression, macro adherence, and confidence all support progression.`);
    return { decision: "Progress", reasons, warnings, priority: "Optimization" };
  }

  reasons.push("One or more progression gates were not met, so repeat is the safest unified weekly decision.");
  return { decision: "Repeat", reasons, warnings, priority: "Goal progress" };
}

function evaluateNutritionDecision(input: ProgressionEngineInput): { decision: NutritionProgressDecision; reason: string } {
  const lossRate = input.weightTrend.weeklyLossRate;
  const adherence = macroAdherence(input);
  const plateau = isNumber(lossRate) && lossRate < 0.25;

  if (plateau && adherence >= 85) {
    return { decision: "Reduce Calories", reason: "Weight trend is plateaued while macro adherence is at least 85%, so the nutrition progression decision is to reduce calories." };
  }

  if (isNumber(lossRate) && lossRate > 2 && isRecoveryWorsening(input)) {
    return { decision: "Increase Calories", reason: "Weight loss is faster than 2 lb/week while recovery is worsening, so calories should increase to protect training." };
  }

  return { decision: "Maintain Calories", reason: "Weight, adherence, and recovery do not justify a calorie target change." };
}

function fatLossStatus(input: ProgressionEngineInput): ProgressionGoalStatus {
  const lossRate = input.weightTrend.weeklyLossRate;
  if (!isNumber(lossRate)) return "At Risk";
  if (lossRate >= 0.5 && lossRate <= 2) return "On Track";
  if (lossRate >= 0.25 && lossRate < 0.5) return "At Risk";
  if (lossRate < 0.25 && (input.weeklyReviewMetrics.weeksFatLossBelowMinimum ?? 0) >= 3) return "Off Track";
  return "At Risk";
}

function halfMarathonStatus(input: ProgressionEngineInput): ProgressionGoalStatus {
  const score = input.runningResult?.readiness?.raceReadinessScore;
  const finishGap = input.runningResult?.prediction?.targetFinishGapMinutes;
  const paceGap = input.runningResult?.prediction?.targetPaceGapSecondsPerMile;
  if (!isNumber(score)) return "At Risk";
  if (score >= 80 && (!isNumber(finishGap) || finishGap <= 10) && (!isNumber(paceGap) || paceGap <= 45)) return "On Track";
  if (score >= 60 || (isNumber(finishGap) && finishGap <= 25) || (isNumber(paceGap) && paceGap <= 90)) return "At Risk";
  return "Off Track";
}

function strengthStatus(input: ProgressionEngineInput): ProgressionGoalStatus {
  const decision = input.workoutResult?.overallDecision;
  const strength = input.workoutResult?.strengthProgression;
  const prs = input.workoutResult?.prs?.newPrs?.length ?? 0;
  if (decision === "Deload" || strength?.action === "Deload") return "Off Track";
  if (decision === "Reduce" || decision === "Substitute" || (strength?.exercisesRegressing?.length ?? 0) > 0) return "At Risk";
  if (decision === "Progress" || strength?.action === "Progress" || prs > 0) return "On Track";
  if (input.weeklyReviewMetrics.strengthProgressStalled || (strength?.exercisesStalled?.length ?? 0) > 0) return "At Risk";
  return "At Risk";
}

function physiqueStatus(input: ProgressionEngineInput): ProgressionGoalStatus {
  const lossRate = input.weightTrend.weeklyLossRate;
  const waistTrend = input.weightTrend.waistTrend;
  const nutrition = macroAdherence(input);
  const training = input.weeklyReviewMetrics.trainingAdherence ?? input.weeklyReviewMetrics.adherenceScore ?? 0;
  if (isNumber(lossRate) && lossRate >= 0.5 && lossRate <= 2 && (!isNumber(waistTrend) || waistTrend <= 0) && nutrition >= 80 && training >= 80) return "On Track";
  if (nutrition < 60 || training < 60 || (isNumber(waistTrend) && waistTrend > 0.5)) return "Off Track";
  return "At Risk";
}

export function evaluateProgression(input: ProgressionEngineInput): ProgressionEngineResult {
  const dataQuality = evaluateDataQuality(input);
  const confidence = evaluateConfidence(input, dataQuality);
  const auditEntries: ProgressionAuditEntry[] = [];
  const weekly = evaluateWeeklyDecision(input, confidence, dataQuality);
  const nutrition = evaluateNutritionDecision(input);
  const goalStatus: Record<ProgressionGoalName, ProgressionGoalStatus> = {
    "Fat Loss": fatLossStatus(input),
    Physique: physiqueStatus(input),
    Strength: strengthStatus(input),
    "Half Marathon": halfMarathonStatus(input),
  };
  const warnings = [...weekly.warnings, ...dataQuality.warnings];
  const reasons = weekly.reasons.length ? weekly.reasons : ["Progression Engine reconciled all available engine outputs into a conservative weekly decision."];

  addAudit({
    entries: auditEntries,
    decisionType: "weekly",
    decision: weekly.decision,
    whatHappened: `Weekly decision set to ${weekly.decision}.`,
    why: reasons.join(" "),
    priority: weekly.priority,
    dataUsed: ["readinessResult", "runningResult", "workoutResult", "nutritionResult", "weeklyReviewMetrics"],
    confidence,
    dataQualityScore: dataQuality.score,
  });
  addAudit({
    entries: auditEntries,
    decisionType: "nutrition",
    decision: nutrition.decision,
    engine: "Nutrition Engine",
    whatHappened: `Nutrition decision set to ${nutrition.decision}.`,
    why: nutrition.reason,
    priority: "Goal progress",
    dataUsed: ["nutritionResult", "weightTrend", "weeklyReviewMetrics"],
    confidence,
    dataQualityScore: dataQuality.score,
  });
  (Object.entries(goalStatus) as Array<[ProgressionGoalName, ProgressionGoalStatus]>).forEach(([goal, status]) => addAudit({
    entries: auditEntries,
    decisionType: "goal-status",
    decision: `${goal}: ${status}`,
    whatHappened: `${goal} goal status is ${status}.`,
    why: `${goal} status was derived from canonical engine outputs and weekly trend metrics.`,
    priority: "Goal progress",
    dataUsed: goal === "Half Marathon" ? ["runningResult.readiness", "runningResult.prediction"] : goal === "Strength" ? ["workoutResult"] : ["weightTrend", "nutritionResult", "weeklyReviewMetrics"],
    confidence,
    dataQualityScore: dataQuality.score,
  }));
  addAudit({
    entries: auditEntries,
    decisionType: "data-quality",
    decision: `${dataQuality.score}/100`,
    whatHappened: `Data quality scored ${dataQuality.score}/100.`,
    why: dataQuality.penalties.length ? dataQuality.penalties.join("; ") : "No major missing-data penalties were detected.",
    priority: "Adherence",
    dataUsed: ["weeklyReviewMetrics", "required engine inputs"],
    confidence: dataQuality.confidence,
    dataQualityScore: dataQuality.score,
  });

  return {
    weeklyDecision: weekly.decision,
    nutritionDecision: nutrition.decision,
    goalStatus,
    confidence,
    dataQuality,
    reasons,
    warnings,
    auditEntries,
  };
}

export function progressionRunningInputFromRunningEngineV2(result: RunningEngineResult): ProgressionRunningInputFromRunningEngineV2 {
  return {
    progressionAction: result.progression.action,
    injuryRiskScore: result.readiness.injuryRiskScore,
    raceReadinessScore: result.readiness.raceReadinessScore,
    confidenceScore: result.confidenceScore,
    explanations: result.explanations.map((explanation) => explanation.summary),
  };
}

export function goalTrackingSnapshotFromResult(result: {
  overallStatus: string;
  overallScore: number;
  confidence: string;
  priorityGoal: string;
  summary: string;
  warnings: string[];
  goals: {
    fatLoss: { status: string };
    physique: { status: string };
    strength: { status: string };
    halfMarathon: { status: string };
  };
}) {
  return {
    overallStatus: result.overallStatus,
    overallScore: result.overallScore,
    confidence: result.confidence,
    priorityGoal: result.priorityGoal,
    goalStatus: {
      "Fat Loss": result.goals.fatLoss.status,
      Physique: result.goals.physique.status,
      Strength: result.goals.strength.status,
      "Half Marathon": result.goals.halfMarathon.status,
    },
    summary: result.summary,
    warnings: result.warnings,
  };
}

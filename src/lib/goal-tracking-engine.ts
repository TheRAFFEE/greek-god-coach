import type { MacroAdherenceSummary } from "./nutrition-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { RunningEngineResult } from "./running-engine";
import type { BodyMetric, NutritionLog, RunLog, WorkoutSession } from "./types";
import type { WorkoutEngineResult } from "./workout-engine";

export type GoalStatus = "On Track" | "At Risk" | "Off Track" | "Insufficient Data";
export type GoalConfidence = "High" | "Medium" | "Low";
export type GoalDomain = "fat_loss" | "physique" | "strength" | "half_marathon";

export interface GoalTrackingUserGoals {
  startWeight?: number;
  targetWeight?: number;
  targetRaceDate?: string;
  targetRaceDistance?: number;
  targetRaceFinishMinutes?: number;
  targetRacePaceSecondsPerMile?: number;
  physiqueGoalName?: string;
}

export interface GoalTrackingBodyMetricInput extends Partial<BodyMetric> {
  date: string;
  weight?: number;
  waist?: number;
}

export interface GoalTrackingNutritionAdherenceInput extends Partial<MacroAdherenceSummary> {
  macroAdherence?: number;
  proteinAdherence?: number;
  caloriesAdherence?: number;
  loggingConsistency?: number;
  confidence?: GoalConfidence;
}

export interface GoalTrackingWorkoutSummaryInput {
  overallDecision?: WorkoutEngineResult["overallDecision"];
  strengthProgression?: Partial<WorkoutEngineResult["strengthProgression"]>;
  hypertrophyProgression?: Partial<WorkoutEngineResult["hypertrophyProgression"]>;
  prs?: { newPrs?: unknown[] };
  fatigue?: Partial<WorkoutEngineResult["fatigue"]>;
  confidenceScore?: number;
  dataQualityScore?: number;
}

export interface GoalTrackingRunningEngineInput {
  prediction?: Partial<RunningEngineResult["prediction"]>;
  readiness?: Partial<RunningEngineResult["readiness"]>;
  fitnessProfile?: Partial<RunningEngineResult["fitnessProfile"]>;
  longRunStatus?: Partial<RunningEngineResult["longRunStatus"]>;
  weeklyMileageStatus?: Partial<RunningEngineResult["weeklyMileageStatus"]>;
  progression?: Partial<RunningEngineResult["progression"]>;
  confidence?: RunningEngineResult["confidence"];
  confidenceScore?: number;
  dataQualityScore?: number;
}

export interface GoalTrackingEngineInput {
  evaluationDate?: string;
  currentWeek?: number;
  weekStartDate?: string;
  weekEndDate?: string;
  bodyMetrics?: GoalTrackingBodyMetricInput[];
  nutritionAdherence?: GoalTrackingNutritionAdherenceInput;
  nutritionLogs?: NutritionLog[];
  workoutSessions?: WorkoutSession[];
  workoutSummary?: GoalTrackingWorkoutSummaryInput;
  runLogs?: RunLog[];
  runningEngineResult?: GoalTrackingRunningEngineInput;
  progressionEngineResult?: Partial<ProgressionEngineResult>;
  goals?: GoalTrackingUserGoals;
}

export interface GoalAuditEntry {
  domain: GoalDomain;
  decision: GoalStatus;
  score: number;
  reasons: string[];
  dataUsed: string[];
  confidence: GoalConfidence;
  timestamp: string;
}

export interface IndividualGoalResult {
  domain: GoalDomain;
  status: GoalStatus;
  score: number;
  confidence: GoalConfidence;
  currentValue: string;
  targetValue: string;
  trend: string;
  paceNeeded?: string;
  projectedOutcome?: string;
  daysRemaining?: number;
  blockers: string[];
  supportingSignals: string[];
  recommendation: string;
  explanation: string;
}

export interface GoalTrackingEngineResult {
  overallStatus: GoalStatus;
  overallScore: number;
  confidence: GoalConfidence;
  dataQualityScore: number;
  goals: {
    fatLoss: IndividualGoalResult;
    physique: IndividualGoalResult;
    strength: IndividualGoalResult;
    halfMarathon: IndividualGoalResult;
  };
  priorityGoal: GoalDomain;
  summary: string;
  recommendations: string[];
  warnings: string[];
  explanations: string[];
  auditTrail: GoalAuditEntry[];
}

interface WeightTrend {
  count: number;
  currentWeight?: number;
  firstWeight?: number;
  sevenDayAverage?: number;
  priorSevenDayAverage?: number;
  fourteenDayAverage?: number;
  weeklyLossLb?: number;
  weeklyLossPercent?: number;
  waistChange?: number;
  direction: "down" | "flat" | "up" | "unknown";
}

const DEFAULT_START_WEIGHT = 233;
const DEFAULT_TARGET_WEIGHT = 199.9;
const DEFAULT_RACE_DATE = "2027-01-17";
const DEFAULT_RACE_DISTANCE = 13.1;
const DEFAULT_RACE_FINISH_MINUTES = 118;
const DEFAULT_RACE_PACE = 540;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round0 = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
const confidenceFromScore = (score: number): GoalConfidence => score >= 85 ? "High" : score >= 65 ? "Medium" : "Low";

function formatPace(seconds?: number | null): string {
  if (!isNumber(seconds)) return "unknown pace";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}/mile`;
}

function daysBetween(startIso: string, endIso: string): number | undefined {
  const start = Date.parse(`${startIso.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${endIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return Math.ceil((end - start) / 86400000);
}

function weightTrend(metrics: GoalTrackingBodyMetricInput[]): WeightTrend {
  const sorted = [...(metrics ?? [])]
    .filter((entry) => entry.date && isNumber(entry.weight) && (entry.weight ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map((entry) => entry.weight as number);
  const lastSeven = weights.slice(-7);
  const priorSeven = weights.slice(-14, -7);
  const sevenDayAverage = average(lastSeven);
  const priorSevenDayAverage = average(priorSeven);
  const weeklyLossLb = isNumber(sevenDayAverage) && isNumber(priorSevenDayAverage) ? round1(priorSevenDayAverage - sevenDayAverage) : undefined;
  const denominator = priorSevenDayAverage ?? weights[0];
  const weeklyLossPercent = isNumber(weeklyLossLb) && isNumber(denominator) && denominator > 0 ? round1((weeklyLossLb / denominator) * 100) : undefined;
  const waists = sorted.map((entry) => entry.waist).filter(isNumber);
  const waistChange = waists.length >= 2 ? round1(waists[waists.length - 1] - waists[0]) : undefined;
  const direction = !isNumber(weeklyLossLb) ? "unknown" : weeklyLossLb > 0.3 ? "down" : weeklyLossLb < -0.3 ? "up" : "flat";
  return {
    count: weights.length,
    currentWeight: weights.at(-1),
    firstWeight: weights[0],
    sevenDayAverage: isNumber(sevenDayAverage) ? round1(sevenDayAverage) : undefined,
    priorSevenDayAverage: isNumber(priorSevenDayAverage) ? round1(priorSevenDayAverage) : undefined,
    fourteenDayAverage: isNumber(average(weights.slice(-14))) ? round1(average(weights.slice(-14)) as number) : undefined,
    weeklyLossLb,
    weeklyLossPercent,
    waistChange,
    direction,
  };
}

function nutritionSignal(input: GoalTrackingEngineInput) {
  const adherence = input.nutritionAdherence;
  const logs = input.nutritionLogs ?? [];
  const proteinFromLogs = logs.length ? Math.min(100, round0(((average(logs.map((log) => log.protein)) ?? 0) / 220) * 100)) : undefined;
  const macroAdherence = adherence?.macroAdherence ?? adherence?.weeklyAdherence ?? adherence?.dailyAdherence ?? (logs.length ? Math.round(((proteinFromLogs ?? 0) + 85) / 2) : undefined);
  const proteinAdherence = adherence?.proteinAdherence ?? proteinFromLogs;
  const loggingConsistency = adherence?.loggingConsistency ?? (logs.length ? Math.min(100, round0((logs.length / 7) * 100)) : undefined);
  const confidence = adherence?.confidence ?? (logs.length >= 5 ? "High" : logs.length >= 3 ? "Medium" : "Low");
  return { macroAdherence, proteinAdherence, loggingConsistency, confidence };
}

function workoutSignal(input: GoalTrackingEngineInput) {
  const sessions = input.workoutSessions ?? [];
  const completed = sessions.filter((session) => session.status === "completed");
  const usefulRecords = sessions.filter((session) => session.setLogs?.length || session.status === "completed").length;
  const setLogs = sessions.flatMap((session) => session.setLogs ?? []);
  const highRpeSets = setLogs.filter((set) => set.rpe >= 9).length;
  const missedReps = setLogs.filter((set) => {
    const target = Number.parseInt(set.targetReps?.match(/\d+/)?.[0] ?? "0", 10);
    return target > 0 && set.repsCompleted < target;
  }).length;
  const adherence = Math.min(100, round0((completed.length / 3) * 100));
  const summary = input.workoutSummary;
  const progressionAction = summary?.strengthProgression?.action ?? summary?.overallDecision;
  const regressing = summary?.strengthProgression?.exercisesRegressing?.length ?? 0;
  const stalled = summary?.strengthProgression?.exercisesStalled?.length ?? 0;
  const prs = summary?.prs?.newPrs?.length ?? 0;
  return { sessions, completed, usefulRecords, setLogs, highRpeSets, missedReps, adherence, progressionAction, regressing, stalled, prs, summary };
}

function runSignal(input: GoalTrackingEngineInput) {
  const result = input.runningEngineResult;
  const logs = input.runLogs ?? [];
  const completed = logs.filter((run) => run.completed && run.actualDistance > 0);
  const longRuns = logs.filter((run) => run.runType === "long run" || run.plannedDistance >= 6 || run.actualDistance >= 6);
  const longRunCompletion = longRuns.length ? Math.round((longRuns.filter((run) => run.completed && (run.painScore ?? 0) < 7).length / longRuns.length) * 100) : undefined;
  const weeklyMileage = result?.fitnessProfile?.weeklyMileage ?? completed.reduce((sum, run) => sum + run.actualDistance, 0);
  const runningConsistency = result?.fitnessProfile?.runningConsistency ?? (logs.length ? Math.min(100, round0((completed.length / Math.max(3, logs.length)) * 100)) : undefined);
  const injuryRisk = result?.readiness?.injuryRiskScore ?? Math.max(0, ...logs.map((run) => (run.painScore ?? 0) * 10));
  return { result, logs, completed, longRuns, longRunCompletion, weeklyMileage, runningConsistency, injuryRisk };
}

function makeGoal(input: Omit<IndividualGoalResult, "blockers" | "supportingSignals"> & { blockers?: string[]; supportingSignals?: string[] }): IndividualGoalResult {
  return { blockers: [], supportingSignals: [], ...input };
}

function evaluateFatLoss(input: GoalTrackingEngineInput, trend: WeightTrend): IndividualGoalResult {
  const goals = input.goals ?? {};
  const startWeight = goals.startWeight ?? DEFAULT_START_WEIGHT;
  const targetWeight = goals.targetWeight ?? DEFAULT_TARGET_WEIGHT;
  const nutrition = nutritionSignal(input);
  const dataUsed = ["bodyMetrics", "nutritionAdherence"];

  if (trend.count < 3 || !isNumber(trend.currentWeight) || !isNumber(trend.weeklyLossPercent)) {
    return makeGoal({ domain: "fat_loss", status: "Insufficient Data", score: 45, confidence: "Low", currentValue: trend.currentWeight ? `${trend.currentWeight} lb` : "unknown", targetValue: `under ${Math.ceil(targetWeight)} lb`, trend: "unknown", projectedOutcome: "Need at least 3 body metric entries before judging fat-loss pace.", blockers: ["Not enough weight trend data"], supportingSignals: dataUsed, recommendation: "Log weight/body metrics at least 3 times this week.", explanation: "Fat loss status is Insufficient Data because the engine cannot trust a trend yet." });
  }

  let status: GoalStatus = "At Risk";
  let score = 65;
  const blockers: string[] = [];
  const supportingSignals: string[] = [];
  const lossPercent = trend.weeklyLossPercent ?? 0;
  const lossLb = trend.weeklyLossLb ?? 0;

  if (trend.direction === "up") {
    status = "Off Track";
    score = 35;
    blockers.push("Weight is gaining over the last two-week window");
  } else if (trend.direction === "flat" && (nutrition.macroAdherence ?? 0) >= 85) {
    status = "At Risk";
    score = 58;
    blockers.push("Weight plateau despite good macro adherence");
  } else if (lossPercent > 1.25) {
    status = "At Risk";
    score = 62;
    blockers.push("Weight loss is faster than the healthy target range");
  } else if (lossPercent >= 0.5 && lossPercent <= 1.25) {
    status = "On Track";
    score = 88;
    supportingSignals.push("Weight is trending down in the healthy fat-loss range");
  } else if (lossLb > 0 && (trend.waistChange ?? 0) < 0 && (nutrition.macroAdherence ?? 0) >= 75) {
    status = "On Track";
    score = 80;
    supportingSignals.push("Scale is moving down and waist is improving");
  } else {
    status = "At Risk";
    score = 60;
    blockers.push("Fat-loss pace is below the preferred 0.5-1.0% bodyweight/week range");
  }

  const poundsRemaining = Math.max(0, (trend.currentWeight ?? startWeight) - targetWeight);
  const weeksRemaining = lossLb > 0 ? round1(poundsRemaining / lossLb) : undefined;
  const confidence = trend.count >= 10 && isNumber(nutrition.macroAdherence) ? "High" : "Medium";
  return makeGoal({
    domain: "fat_loss",
    status,
    score,
    confidence,
    currentValue: `${trend.currentWeight} lb${trend.sevenDayAverage ? ` (${trend.sevenDayAverage} lb 7-day avg)` : ""}`,
    targetValue: `under ${Math.ceil(targetWeight)} lb`,
    trend: `${trend.direction}; ${lossLb > 0 ? `${lossLb} lb/week loss` : `${Math.abs(lossLb)} lb/week gain or stall`}`,
    projectedOutcome: weeksRemaining ? `About ${weeksRemaining} weeks to target at current pace.` : "Target projection unavailable until loss rate is positive.",
    blockers,
    supportingSignals,
    recommendation: status === "On Track" ? "Keep calories/protein consistent and avoid overcorrecting." : status === "Off Track" ? "Tighten nutrition logging and review calorie target before the next weekly decision." : "Keep logging; if plateau persists with good adherence, adjust calories through the Nutrition/Progression engines.",
    explanation: status === "At Risk" && blockers.some((item) => item.includes("plateau")) ? "Fat loss is At Risk because the trend is plateauing while adherence is good." : "Fat loss status is based on body-weight trend, waist trend when available, and nutrition adherence.",
  });
}

function evaluatePhysique(input: GoalTrackingEngineInput, trend: WeightTrend, fatLoss: IndividualGoalResult): IndividualGoalResult {
  const nutrition = nutritionSignal(input);
  const workout = workoutSignal(input);
  const noHistory = trend.count === 0 && !isNumber(nutrition.proteinAdherence) && workout.usefulRecords === 0;
  if (noHistory) {
    return makeGoal({ domain: "physique", status: "Insufficient Data", score: 45, confidence: "Low", currentValue: "unknown", targetValue: input.goals?.physiqueGoalName ?? "Greek God physique", trend: "unknown", blockers: ["No physique proxy history"], recommendation: "Log measurements, protein, workouts, and progress photos manually.", explanation: "Physique status uses proxy signals only; photo/body-fat AI is not implemented yet." });
  }

  const proteinGood = (nutrition.proteinAdherence ?? 0) >= 80;
  const workoutsGood = workout.adherence >= 75;
  const fatLossReasonable = fatLoss.status === "On Track" || trend.direction === "down";
  const waistDown = isNumber(trend.waistChange) && trend.waistChange < 0;
  const majorRegression = workout.regressing > 0 || workout.progressionAction === "Deload" || workout.progressionAction === "Reduce";
  let status: GoalStatus = "At Risk";
  let score = 65;
  const blockers: string[] = [];
  const supportingSignals: string[] = [];

  if ((fatLossReasonable || waistDown) && proteinGood && workoutsGood && !majorRegression) {
    status = "On Track";
    score = 86;
    supportingSignals.push("fat loss or waist trend is improving", "protein adherence is adequate", "workout adherence is adequate");
  } else if ((trend.direction === "up" || (isNumber(trend.waistChange) && trend.waistChange > 0.5)) && workout.adherence < 60) {
    status = "Off Track";
    score = 35;
    blockers.push("weight/waist worsening while training adherence is poor");
  } else {
    status = "At Risk";
    score = 60;
    if (!proteinGood) blockers.push("protein adherence is poor");
    if (!workoutsGood) blockers.push("workout adherence is poor");
    if (majorRegression) blockers.push("strength regression or deload signal present");
  }

  const confidence: GoalConfidence = trend.count >= 3 && isNumber(nutrition.proteinAdherence) && workout.usefulRecords >= 2 ? "Medium" : "Low";
  return makeGoal({
    domain: "physique",
    status,
    score,
    confidence,
    currentValue: `proxy estimate: waist ${isNumber(trend.waistChange) ? `${trend.waistChange} in` : "unknown"}, protein ${nutrition.proteinAdherence ?? "unknown"}%`,
    targetValue: input.goals?.physiqueGoalName ?? "Greek God physique",
    trend: waistDown ? "waist decreasing" : trend.direction,
    blockers,
    supportingSignals,
    recommendation: status === "On Track" ? "Continue protein consistency and progressive lifting while cutting." : "Protect protein intake and lifting consistency before judging physique progress.",
    explanation: "Physique is a low/medium-confidence proxy based on weight trend, waist trend, workout adherence, strength signal, and protein adherence. It does not pretend photo or body-fat AI exists yet.",
  });
}

function evaluateStrength(input: GoalTrackingEngineInput): IndividualGoalResult {
  const workout = workoutSignal(input);
  if (!workout.summary && workout.usefulRecords < 2) {
    return makeGoal({ domain: "strength", status: "Insufficient Data", score: 45, confidence: "Low", currentValue: `${workout.usefulRecords} useful workout record(s)`, targetValue: "consistent progression or stable strength", trend: "unknown", blockers: ["Fewer than 2 useful workout records"], recommendation: "Complete and log at least two workouts with set/RPE data.", explanation: "Strength needs at least two useful workout records or a Workout Engine result." });
  }

  let status: GoalStatus = "At Risk";
  let score = 65;
  const blockers: string[] = [];
  const supportingSignals: string[] = [];
  let trend = "stable";

  if (workout.completed.length < 2 || workout.highRpeSets >= 2 || workout.missedReps >= 2 || workout.regressing > 0 || workout.progressionAction === "Reduce") {
    status = workout.completed.length === 0 || workout.regressing >= 2 ? "Off Track" : "At Risk";
    score = status === "Off Track" ? 35 : 58;
    if (workout.completed.length < 2) blockers.push("workout adherence is inconsistent");
    if (workout.highRpeSets >= 2) blockers.push("High RPE appears frequently");
    if (workout.missedReps >= 2) blockers.push("missed reps appear in recent sets");
    if (workout.regressing > 0) blockers.push("Workout Engine reports regressing exercises");
    trend = workout.regressing > 0 ? "regressing" : "stalled";
  } else if (workout.progressionAction === "Progress" || workout.prs > 0 || workout.adherence >= 90) {
    status = "On Track";
    score = 88;
    trend = workout.progressionAction === "Progress" || workout.prs > 0 ? "progressing" : "maintaining";
    supportingSignals.push("completed workouts are consistent", "strength markers are progressing or stable");
  } else {
    blockers.push("no clear progression signal yet");
  }

  return makeGoal({
    domain: "strength",
    status,
    score,
    confidence: workout.summary || workout.usefulRecords >= 3 ? "High" : "Medium",
    currentValue: `${workout.completed.length} completed workouts; ${workout.highRpeSets} high-RPE sets; ${workout.missedReps} missed-rep sets`,
    targetValue: "progressing or maintaining strength during fat loss",
    trend,
    blockers,
    supportingSignals,
    recommendation: status === "On Track" ? "Keep progressing conservatively when RPE/form allow." : "Repeat or reduce stress until RPE and rep completion improve.",
    explanation: "Strength status uses workout sessions, Workout Engine result when available, PRs, missed reps, high RPE, and adherence.",
  });
}

function evaluateHalfMarathon(input: GoalTrackingEngineInput): IndividualGoalResult {
  const goals = input.goals ?? {};
  const targetRaceDate = goals.targetRaceDate ?? DEFAULT_RACE_DATE;
  const targetPace = goals.targetRacePaceSecondsPerMile ?? DEFAULT_RACE_PACE;
  const targetFinish = goals.targetRaceFinishMinutes ?? DEFAULT_RACE_FINISH_MINUTES;
  const targetDistance = goals.targetRaceDistance ?? DEFAULT_RACE_DISTANCE;
  const running = runSignal(input);
  const daysRemaining = input.evaluationDate ? daysBetween(input.evaluationDate, targetRaceDate) : undefined;

  if (!running.result && running.logs.length < 2) {
    return makeGoal({ domain: "half_marathon", status: "Insufficient Data", score: 45, confidence: "Low", currentValue: "unknown", targetValue: `${formatPace(targetPace)} for ${targetFinish} min`, trend: "unknown", daysRemaining, blockers: ["Not enough run data and no Running Engine V2 result"], recommendation: "Log runs or supply a Running Engine V2 result before judging the race goal.", explanation: "Half marathon status is Insufficient Data because no reliable running prediction exists." });
  }

  const prediction = running.result?.prediction;
  const predictedPace = prediction?.predictedPaceSecondsPerMile;
  const paceGap = prediction?.targetPaceGapSecondsPerMile;
  const finishGap = prediction?.targetFinishGapMinutes;
  const injuryRisk = running.injuryRisk ?? 0;
  const longRunStatus = running.result?.longRunStatus?.status;
  const consistency = running.runningConsistency ?? 0;
  const blockers: string[] = [];
  const supportingSignals: string[] = [];
  let status: GoalStatus = "At Risk";
  let score = 65;

  if (injuryRisk >= 70 || (isNumber(paceGap) && paceGap > 45) || longRunStatus === "problem" || consistency < 40) {
    status = "Off Track";
    score = 35;
    if (injuryRisk >= 70) blockers.push("high running injury risk");
    if (isNumber(paceGap) && paceGap > 45) blockers.push("predicted pace is more than 45 sec/mile slower than target");
    if (longRunStatus === "problem") blockers.push("long-run status is problematic");
    if (consistency < 40) blockers.push("running consistency is low");
  } else if (isNumber(paceGap) && paceGap <= 15 && (longRunStatus === "strong" || longRunStatus === "adequate") && injuryRisk < 50 && consistency >= 75) {
    status = "On Track";
    score = 88;
    supportingSignals.push("Running Engine V2 prediction is within 15 sec/mile of target", "long-run status is adequate or strong", "injury risk is acceptable");
  } else {
    status = "At Risk";
    score = 62;
    if (isNumber(paceGap) && paceGap > 15) blockers.push("predicted pace is 15-45 sec/mile slower than target");
    if (longRunStatus === "watch") blockers.push("long-run status needs watching");
    if (consistency < 75) blockers.push("weekly mileage or running adherence is inconsistent");
  }

  return makeGoal({
    domain: "half_marathon",
    status,
    score,
    confidence: running.result ? (running.result.confidence ?? confidenceFromScore(running.result.confidenceScore ?? 70)) : "Medium",
    currentValue: isNumber(predictedPace) ? `${formatPace(predictedPace)} predicted` : "prediction unavailable",
    targetValue: `${formatPace(targetPace)} / ${targetFinish} min finish for ${targetDistance} mi`,
    trend: running.result ? `Running Engine V2 pace gap ${isNumber(paceGap) ? `${paceGap} sec/mile` : "unknown"}` : "manual run logs only",
    paceNeeded: formatPace(targetPace),
    projectedOutcome: isNumber(finishGap) ? `${finishGap >= 0 ? "+" : ""}${round1(finishGap)} minutes vs target finish` : undefined,
    daysRemaining,
    blockers,
    supportingSignals,
    recommendation: status === "On Track" ? "Keep long runs consistent and progress conservatively." : injuryRisk >= 70 ? "Address injury risk before chasing pace." : "Keep building long-run consistency and weekly mileage before adding more intensity.",
    explanation: running.result ? "Half marathon status uses Running Engine V2 prediction, pace gap, long-run status, adherence, weekly mileage, and injury risk without recalculating the prediction." : "Half marathon status uses manual run logs because no Running Engine V2 result was supplied.",
  });
}

function auditFor(goal: IndividualGoalResult, timestamp: string): GoalAuditEntry {
  return {
    domain: goal.domain,
    decision: goal.status,
    score: goal.score,
    reasons: [goal.explanation, ...goal.blockers, ...goal.supportingSignals].filter(Boolean),
    dataUsed: goal.domain === "half_marathon" ? ["runningEngineResult", "runLogs"] : goal.domain === "strength" ? ["workoutSessions", "workoutSummary"] : ["bodyMetrics", "nutritionAdherence", "workoutSessions"],
    confidence: goal.confidence,
    timestamp,
  };
}

function dataQuality(input: GoalTrackingEngineInput): number {
  let score = 100;
  if ((input.bodyMetrics ?? []).length < 3) score -= 20;
  if (!input.nutritionAdherence && !(input.nutritionLogs ?? []).length) score -= 20;
  if (!input.workoutSummary && (input.workoutSessions ?? []).length < 2) score -= 20;
  if (!input.runningEngineResult && (input.runLogs ?? []).length < 2) score -= 20;
  if (!input.progressionEngineResult) score -= 5;
  return clamp(score);
}

function overallStatusFrom(score: number, insufficientCount: number, goals: IndividualGoalResult[], warnings: string[]): GoalStatus {
  if (insufficientCount >= 2) return "At Risk";
  if (goals.every((goal) => goal.status === "Insufficient Data")) return "Insufficient Data";
  if (warnings.some((warning) => /high running injury risk/i.test(warning))) return score < 60 ? "Off Track" : "At Risk";
  if (score >= 80 && !goals.some((goal) => goal.status === "Off Track" || goal.status === "At Risk")) return "On Track";
  if (score >= 55) return "At Risk";
  return "Off Track";
}

function priorityGoal(goals: IndividualGoalResult[]): GoalDomain {
  if (goals.every((goal) => goal.status === "On Track")) return "fat_loss";
  const order: GoalDomain[] = ["fat_loss", "half_marathon", "physique", "strength"];
  const sorted = [...goals].sort((a, b) => a.score - b.score || order.indexOf(a.domain) - order.indexOf(b.domain));
  return sorted[0]?.domain ?? "fat_loss";
}

export function evaluateGoalTracking(input: GoalTrackingEngineInput): GoalTrackingEngineResult {
  const evaluationDate = input.evaluationDate ?? new Date().toISOString().slice(0, 10);
  const timestamp = `${evaluationDate}T12:00:00.000Z`;
  const trend = weightTrend(input.bodyMetrics ?? []);
  const fatLoss = evaluateFatLoss(input, trend);
  const physique = evaluatePhysique(input, trend, fatLoss);
  const strength = evaluateStrength(input);
  const halfMarathon = evaluateHalfMarathon(input);
  const goals = [fatLoss, physique, strength, halfMarathon];
  const warnings = goals.flatMap((goal) => goal.blockers.map((blocker) => `${goal.domain}: ${blocker}`));
  if ((input.runningEngineResult?.readiness?.injuryRiskScore ?? 0) >= 70) warnings.push("High running injury risk should downgrade half marathon and overall status.");
  if (input.progressionEngineResult?.weeklyDecision === "Recovery Focus" || input.progressionEngineResult?.weeklyDecision === "Deload") warnings.push(`Progression Engine reports ${input.progressionEngineResult.weeklyDecision}; recovery issues may limit goal progress.`);

  const weightedScore = round0(
    fatLoss.score * 0.3 +
    physique.score * 0.25 +
    halfMarathon.score * 0.25 +
    strength.score * 0.2,
  );
  const insufficientCount = goals.filter((goal) => goal.status === "Insufficient Data").length;
  const overallScore = insufficientCount ? Math.min(weightedScore, 74) : weightedScore;
  const quality = dataQuality(input);
  const confidence: GoalConfidence = insufficientCount >= 2 || quality < 65 ? "Low" : quality >= 85 && goals.every((goal) => goal.confidence !== "Low") ? "High" : "Medium";
  const overallStatus = overallStatusFrom(overallScore, insufficientCount, goals, warnings);
  const priority = priorityGoal(goals);
  const recommendations = goals
    .filter((goal) => goal.status !== "On Track")
    .map((goal) => goal.recommendation)
    .filter((value, index, array) => array.indexOf(value) === index);
  if (!recommendations.length) recommendations.push("Keep executing the current plan; all four major goals are currently on track.");

  const resultGoals = { fatLoss, physique, strength, halfMarathon };
  const explanations = goals.map((goal) => `${goal.domain}: ${goal.explanation}`);
  const auditTrail = goals.map((goal) => auditFor(goal, timestamp));
  return {
    overallStatus,
    overallScore,
    confidence,
    dataQualityScore: quality,
    goals: resultGoals,
    priorityGoal: priority,
    summary: `Goal Tracking Engine V1: overall ${overallStatus} (${overallScore}/100). Priority goal: ${priority}.`,
    recommendations,
    warnings,
    explanations,
    auditTrail,
  };
}

export function progressionGoalTrackingSummary(result: GoalTrackingEngineResult) {
  return {
    status: result.overallStatus,
    score: result.overallScore,
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

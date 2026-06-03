import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { RunningEngineResult } from "./running-engine";
import type { BodyMetric, DailyCheckIn, NutritionLog, RunLog, WorkoutSession } from "./types";
import type { WorkoutEngineResult } from "./workout-engine";

export type PerformanceStatus = "Improving" | "Stable" | "Plateau" | "Declining" | "Insufficient Data";
export type PerformanceConfidence = "High" | "Medium" | "Low";
export type PerformanceDomain = "Strength" | "Running" | "Recovery" | "Nutrition" | "Adherence" | "Weight";

export interface PerformanceEngineInput {
  evaluationDate?: string;
  historicalBodyMetrics: BodyMetric[];
  historicalRunLogs: RunLog[];
  historicalWorkoutSessions: WorkoutSession[];
  historicalNutritionLogs: NutritionLog[];
  historicalCheckIns?: DailyCheckIn[];
  goals?: {
    startWeight?: number;
    targetWeight?: number;
  };
  runningEngineResult?: Partial<RunningEngineResult> | null;
  workoutEngineResult?: Partial<WorkoutEngineResult> | null;
  goalTrackingResult?: Partial<GoalTrackingEngineResult> | null;
  progressionResult?: Partial<ProgressionEngineResult> | null;
}

export interface PerformanceTrendResult {
  domain: PerformanceDomain;
  status: PerformanceStatus;
  score: number;
  confidence: PerformanceConfidence;
  summary: string;
  metrics: Record<string, number | string | boolean | null>;
  reasons: string[];
}

export interface PerformanceAuditEntry {
  id: string;
  domain: PerformanceDomain | "Overall";
  decision: PerformanceStatus;
  score: number;
  reason: string;
  dataUsed: string[];
  confidence: PerformanceConfidence;
}

export interface PerformanceEngineResult {
  overallScore: number;
  overallStatus: PerformanceStatus;
  confidence: PerformanceConfidence;
  dataQualityScore: number;
  strengthTrend: PerformanceTrendResult;
  runningTrend: PerformanceTrendResult;
  recoveryTrend: PerformanceTrendResult;
  nutritionTrend: PerformanceTrendResult;
  adherenceTrend: PerformanceTrendResult;
  weightTrend: PerformanceTrendResult;
  primaryOpportunity: string;
  primaryRisk: string;
  summary: string;
  recommendations: string[];
  warnings: string[];
  auditTrail: PerformanceAuditEntry[];
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round0 = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;
const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const datePart = (value: string) => value.slice(0, 10);
const isFinitePositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

function confidenceFromDataScore(score: number): PerformanceConfidence {
  if (score >= 80) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function scoreForStatus(status: PerformanceStatus): number {
  if (status === "Improving") return 90;
  if (status === "Stable") return 75;
  if (status === "Plateau") return 58;
  if (status === "Declining") return 35;
  return 20;
}

function statusFromScore(score: number, insufficient = false): PerformanceStatus {
  if (insufficient) return "Insufficient Data";
  if (score >= 82) return "Improving";
  if (score >= 68) return "Stable";
  if (score >= 50) return "Plateau";
  return "Declining";
}

function trendDelta(values: number[]): number | null {
  if (values.length < 2) return null;
  const midpoint = Math.floor(values.length / 2);
  const early = avg(values.slice(0, midpoint));
  const recent = avg(values.slice(midpoint));
  return early === null || recent === null ? null : round1(recent - early);
}

function completedWorkouts(input: PerformanceEngineInput) {
  return [...input.historicalWorkoutSessions]
    .filter((session) => session.status === "completed")
    .sort((a, b) => datePart(a.startedAt).localeCompare(datePart(b.startedAt)));
}

function sessionVolume(session: WorkoutSession) {
  return (session.setLogs ?? []).reduce((sum, set) => sum + Math.max(0, set.weightUsed) * Math.max(0, set.repsCompleted), 0);
}

function evaluateStrength(input: PerformanceEngineInput): PerformanceTrendResult {
  const sessions = completedWorkouts(input);
  const volumes = sessions.map(sessionVolume).filter((value) => value > 0);
  const delta = trendDelta(volumes);
  const missed = input.historicalWorkoutSessions.filter((session) => session.status !== "completed").length;
  const engine = input.workoutEngineResult;
  const engineDecision = engine?.overallDecision;
  const prCount = engine?.prs?.newPrs?.length ?? 0;
  const progressing = engine?.strengthProgression?.exercisesProgressing?.length ?? 0;
  const stalled = engine?.strengthProgression?.exercisesStalled?.length ?? 0;
  const regressing = engine?.strengthProgression?.exercisesRegressing?.length ?? 0;
  let status: PerformanceStatus = "Insufficient Data";
  const reasons: string[] = [];
  if (sessions.length < 2 && !engineDecision) reasons.push("Need at least 2 completed workouts.");
  else if (missed >= 2 || regressing > 0 || engineDecision === "Reduce" || engineDecision === "Deload" || (delta !== null && delta < -50)) {
    status = "Declining"; reasons.push("Workout volume, completion, or engine signals are declining.");
  } else if (prCount > 0 || progressing > 0 || engineDecision === "Progress" || (delta !== null && delta > 50)) {
    status = "Improving"; reasons.push("Workout volume, PRs, or progression signals are improving.");
  } else if ((stalled > 0 || engineDecision === "Repeat" || (delta !== null && Math.abs(delta) <= 50)) && sessions.length >= 3) {
    status = "Plateau"; reasons.push("Workout adherence is present but progression is flat.");
  } else {
    status = "Stable"; reasons.push("Completed workout volume is consistent without major regression.");
  }
  return { domain: "Strength", status, score: scoreForStatus(status), confidence: confidenceFromDataScore(Math.min(100, sessions.length * 18 + (engine ? 20 : 0))), summary: `${status}: strength trend from completed workouts and Workout Engine signals.`, metrics: { completedWorkouts: sessions.length, volumeDelta: delta, missedWorkouts: missed, prCount, progressing, stalled, regressing }, reasons };
}

function completedRuns(input: PerformanceEngineInput) {
  return [...input.historicalRunLogs].filter((run) => run.completed && run.actualDistance > 0).sort((a, b) => a.date.localeCompare(b.date));
}

function evaluateRunningTrend(input: PerformanceEngineInput): PerformanceTrendResult {
  const runs = completedRuns(input);
  const mileageDelta = trendDelta(runs.map((run) => run.actualDistance));
  const paceDelta = trendDelta(runs.map((run) => run.averagePace).filter(isFinitePositive));
  const longRuns = runs.filter((run) => /long/i.test(run.runType ?? "") || run.actualDistance >= 5).map((run) => run.actualDistance);
  const longRunDelta = trendDelta(longRuns);
  const injuryRisk = input.runningEngineResult?.readiness?.injuryRiskScore ?? input.runningEngineResult?.runningReadiness?.injuryRiskScore ?? 0;
  const progressionAction = input.runningEngineResult?.progression?.action;
  const predictionGap = input.runningEngineResult?.prediction?.targetPaceGapSecondsPerMile ?? null;
  const painRuns = runs.filter((run) => run.pain || (run.painScore ?? 0) >= 4).length;
  let status: PerformanceStatus = "Insufficient Data";
  const reasons: string[] = [];
  if (runs.length < 2 && !progressionAction) reasons.push("Need at least 2 completed runs.");
  else if (injuryRisk >= 70 || painRuns >= 2 || progressionAction === "Regress" || progressionAction === "Recovery Focus" || (paceDelta !== null && paceDelta > 0.4) || (mileageDelta !== null && mileageDelta < -1)) {
    status = "Declining"; reasons.push("Running consistency, pace, or injury risk is worsening.");
  } else if (progressionAction === "Progress" || (mileageDelta !== null && mileageDelta > 1) || (longRunDelta !== null && longRunDelta > 0.5) || (paceDelta !== null && paceDelta < -0.3) || (predictionGap !== null && predictionGap <= 0)) {
    status = "Improving"; reasons.push("Mileage, long runs, pace, or Running Engine signals are improving.");
  } else if (runs.length >= 3) {
    status = "Plateau"; reasons.push("Running consistency is present but improvement is flat.");
  } else {
    status = "Stable"; reasons.push("Running data is stable without major regression.");
  }
  return { domain: "Running", status, score: scoreForStatus(status), confidence: confidenceFromDataScore(Math.min(100, runs.length * 15 + (input.runningEngineResult ? 20 : 0))), summary: `${status}: running trend from mileage, pace, long runs, and Running Engine signals.`, metrics: { completedRuns: runs.length, mileageDelta, paceDelta, longRunDelta, injuryRisk, painRuns }, reasons };
}

function readinessScore(checkIn: DailyCheckIn) {
  return clamp(checkIn.sleepHours * 10 + checkIn.energy * 7 - checkIn.stress * 5 - checkIn.soreness * 4 - (checkIn.alcohol ? 8 : 0) - (checkIn.pain ? checkIn.painSeverity * 8 : 0));
}

function evaluateRecovery(input: PerformanceEngineInput): PerformanceTrendResult {
  const checkIns = [...(input.historicalCheckIns ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const scores = checkIns.map(readinessScore);
  const delta = trendDelta(scores);
  const recent = avg(scores.slice(-7));
  let status: PerformanceStatus = "Insufficient Data";
  const reasons: string[] = [];
  if (scores.length < 2) reasons.push("Need more readiness check-ins.");
  else if ((delta ?? 0) > 5) { status = "Improving"; reasons.push("Readiness markers are improving."); }
  else if ((delta ?? 0) < -5) { status = "Declining"; reasons.push("Sleep, stress, energy, or soreness are worsening."); }
  else if ((recent ?? 0) < 65) { status = "Plateau"; reasons.push("Recovery is flat below the desired range."); }
  else { status = "Stable"; reasons.push("Recovery is stable."); }
  return { domain: "Recovery", status, score: scoreForStatus(status), confidence: confidenceFromDataScore(Math.min(100, scores.length * 15)), summary: `${status}: recovery trend from readiness check-in markers.`, metrics: { checkIns: scores.length, readinessDelta: delta, recentReadinessAverage: recent === null ? null : round1(recent) }, reasons };
}

function nutritionAdherence(log: NutritionLog) {
  const calorieScore = log.calories >= 1980 && log.calories <= 2860 ? 100 : log.calories >= 1800 && log.calories <= 3100 ? 70 : 35;
  const proteinScore = clamp((log.protein / 220) * 100);
  const waterScore = clamp((log.water / 120) * 100);
  return round0((calorieScore + proteinScore + waterScore) / 3);
}

function evaluateNutritionTrend(input: PerformanceEngineInput): PerformanceTrendResult {
  const logs = [...input.historicalNutritionLogs].sort((a, b) => a.date.localeCompare(b.date));
  const scores = logs.map(nutritionAdherence);
  const delta = trendDelta(scores);
  const recent = avg(scores.slice(-7));
  let status: PerformanceStatus = "Insufficient Data";
  const reasons: string[] = [];
  if (logs.length < 3) reasons.push("Need more meal logs.");
  else if ((delta ?? 0) > 8) { status = "Improving"; reasons.push("Macro, protein, and hydration adherence is rising."); }
  else if ((delta ?? 0) < -8) { status = "Declining"; reasons.push("Macro, protein, or hydration adherence is falling."); }
  else if ((recent ?? 0) < 75) { status = "Plateau"; reasons.push("Nutrition adherence is flat below target."); }
  else { status = "Stable"; reasons.push("Nutrition adherence is consistent."); }
  return { domain: "Nutrition", status, score: scoreForStatus(status), confidence: confidenceFromDataScore(Math.min(100, logs.length * 12)), summary: `${status}: nutrition trend from macro adherence and logging quality.`, metrics: { loggedDays: logs.length, adherenceDelta: delta, recentAdherence: recent === null ? null : round1(recent) }, reasons };
}

function evaluateAdherence(input: PerformanceEngineInput): PerformanceTrendResult {
  const completedWorkoutCount = completedWorkouts(input).length;
  const runCount = completedRuns(input).length;
  const nutritionDays = new Set(input.historicalNutritionLogs.map((log) => log.date)).size;
  const checkIns = new Set((input.historicalCheckIns ?? []).map((entry) => entry.date)).size;
  const workoutAdherence = clamp((completedWorkoutCount / 4) * 100);
  const runAdherence = clamp((runCount / 3) * 100);
  const nutritionAdherenceScore = clamp((nutritionDays / 7) * 100);
  const checkInScore = clamp((checkIns / 7) * 100);
  const adherence = round0((workoutAdherence + runAdherence + nutritionAdherenceScore + checkInScore) / 4);
  const status: PerformanceStatus = adherence >= 85 ? "Improving" : adherence >= 70 ? "Stable" : adherence >= 50 ? "Plateau" : "Declining";
  return { domain: "Adherence", status, score: adherence, confidence: confidenceFromDataScore(Math.min(100, completedWorkoutCount * 12 + runCount * 10 + nutritionDays * 6 + checkIns * 5)), summary: `${status}: adherence is ${adherence}%.`, metrics: { adherence, completedWorkoutCount, completedRunCount: runCount, nutritionDays, checkIns }, reasons: [`Combined workout, run, nutrition, and check-in adherence is ${adherence}%.`] };
}

function movingAverage(values: number[], count: number) {
  return avg(values.slice(-count));
}

function evaluateWeight(input: PerformanceEngineInput): PerformanceTrendResult {
  const metrics = [...input.historicalBodyMetrics].filter((entry) => isFinitePositive(entry.weight)).sort((a, b) => a.date.localeCompare(b.date));
  const weights = metrics.map((entry) => entry.weight);
  const seven = movingAverage(weights, 7);
  const fourteen = movingAverage(weights, 14);
  const twentyEight = movingAverage(weights, 28);
  const priorSeven = avg(weights.slice(-14, -7));
  const weeklyLoss = seven !== null && priorSeven !== null ? round1(priorSeven - seven) : trendDelta(weights) !== null ? round1(-trendDelta(weights)!) : null;
  let status: PerformanceStatus = "Insufficient Data";
  const reasons: string[] = [];
  const targetWeight = input.goals?.targetWeight ?? 199.9;
  const current = weights.at(-1) ?? null;
  const cutting = current === null || current > targetWeight;
  if (weights.length < 3) reasons.push("Need more measurements.");
  else if (cutting && weeklyLoss !== null && weeklyLoss > 0.3) { status = "Improving"; reasons.push("Weight averages are moving toward the goal."); }
  else if (cutting && weeklyLoss !== null && weeklyLoss >= -0.2 && weeklyLoss <= 0.3) { status = "Plateau"; reasons.push("Weight averages are flat."); }
  else if (cutting && weeklyLoss !== null && weeklyLoss < -0.2) { status = "Declining"; reasons.push("Weight is moving away from the goal."); }
  else { status = "Stable"; reasons.push("Weight is stable near the target."); }
  return { domain: "Weight", status, score: scoreForStatus(status), confidence: confidenceFromDataScore(Math.min(100, weights.length * 10)), summary: `${status}: weight trend from 7, 14, and 28 day averages.`, metrics: { currentWeight: current, sevenDayAverage: seven === null ? null : round1(seven), fourteenDayAverage: fourteen === null ? null : round1(fourteen), twentyEightDayAverage: twentyEight === null ? null : round1(twentyEight), weeklyLoss }, reasons };
}

function dataQuality(input: PerformanceEngineInput) {
  let score = 100;
  const warnings: string[] = [];
  const penalize = (points: number, warning: string) => { score -= points; warnings.push(warning); };
  if (completedWorkouts(input).length < 2) penalize(18, "Need more completed workouts for strength trend.");
  if (completedRuns(input).length < 2) penalize(18, "Need more completed runs for running trend.");
  if ((input.historicalCheckIns ?? []).length < 2) penalize(15, "Need more readiness check-ins for recovery trend.");
  if (input.historicalNutritionLogs.length < 3) penalize(15, "Need more meal logs for nutrition trend.");
  if (input.historicalBodyMetrics.length < 3) penalize(15, "Need more body measurements for weight trend.");
  return { score: clamp(score), warnings };
}

function primaryOpportunity(trends: PerformanceTrendResult[]) {
  const candidates = trends.filter((trend) => trend.status !== "Insufficient Data").sort((a, b) => a.score - b.score);
  const lowest = candidates[0];
  if (!lowest) return "Collect enough data to identify opportunities";
  if (lowest.domain === "Nutrition") return "Protein adherence and calorie consistency";
  if (lowest.domain === "Running") return "Running consistency";
  if (lowest.domain === "Recovery") return "Recovery and sleep";
  if (lowest.domain === "Strength") return "Workout adherence and progressive overload";
  if (lowest.domain === "Weight") return "Weight trend consistency";
  return "Daily adherence";
}

function primaryRisk(input: PerformanceEngineInput, trends: PerformanceTrendResult[]) {
  const injuryRisk = input.runningEngineResult?.readiness?.injuryRiskScore ?? input.runningEngineResult?.runningReadiness?.injuryRiskScore ?? 0;
  if (injuryRisk >= 70) return "Injury risk";
  if (trends.some((trend) => trend.domain === "Recovery" && trend.status === "Declining")) return "Recovery deterioration";
  if (trends.some((trend) => trend.domain === "Nutrition" && trend.status === "Declining")) return "Nutrition adherence";
  if (trends.some((trend) => trend.domain === "Adherence" && trend.status === "Declining")) return "Workout and logging adherence";
  const declining = trends.find((trend) => trend.status === "Declining");
  return declining ? `${declining.domain} decline` : "No major performance risk detected";
}

function recommendationFor(opportunity: string, risk: string) {
  const recs = [`Primary opportunity: ${opportunity}.`, `Primary risk to manage: ${risk}.`];
  if (/protein|calorie/i.test(opportunity)) recs.push("Tighten protein and calorie logging before changing targets.");
  if (/running/i.test(opportunity)) recs.push("Keep run completion consistent before chasing pace.");
  if (/recovery|sleep/i.test(opportunity) || /Recovery/i.test(risk)) recs.push("Protect sleep and easy recovery work until readiness stabilizes.");
  return [...new Set(recs)].slice(0, 5);
}

function auditFor(trends: PerformanceTrendResult[], overallStatus: PerformanceStatus, overallScore: number, confidence: PerformanceConfidence): PerformanceAuditEntry[] {
  const entries: PerformanceAuditEntry[] = trends.map((trend, index) => ({ id: `performance-${index + 1}`, domain: trend.domain, decision: trend.status, score: trend.score, reason: trend.reasons.join(" "), dataUsed: Object.keys(trend.metrics), confidence: trend.confidence }));
  entries.push({ id: "performance-overall", domain: "Overall", decision: overallStatus, score: overallScore, reason: "Weighted performance score across strength, running, recovery, nutrition, adherence, and weight.", dataUsed: ["Strength 20%", "Running 20%", "Recovery 15%", "Nutrition 15%", "Adherence 15%", "Weight 15%"], confidence });
  return entries;
}

export function evaluatePerformance(input: PerformanceEngineInput): PerformanceEngineResult {
  const strengthTrend = evaluateStrength(input);
  const runningTrend = evaluateRunningTrend(input);
  const recoveryTrend = evaluateRecovery(input);
  const nutritionTrend = evaluateNutritionTrend(input);
  const adherenceTrend = evaluateAdherence(input);
  const weightTrend = evaluateWeight(input);
  const trends = [strengthTrend, runningTrend, recoveryTrend, nutritionTrend, adherenceTrend, weightTrend];
  const quality = dataQuality(input);
  const insufficientDomains = trends.filter((trend) => trend.status === "Insufficient Data").length;
  const overallScore = round0(strengthTrend.score * 0.2 + runningTrend.score * 0.2 + recoveryTrend.score * 0.15 + nutritionTrend.score * 0.15 + adherenceTrend.score * 0.15 + weightTrend.score * 0.15);
  const overallStatus = statusFromScore(overallScore, insufficientDomains >= 4 || quality.score < 35);
  const confidence = confidenceFromDataScore(quality.score);
  const primaryOpportunityValue = primaryOpportunity(trends);
  const primaryRiskValue = primaryRisk(input, trends);
  const warnings = [...quality.warnings];
  if (confidence === "Low") warnings.push("Low confidence: performance trend data is limited.");
  if (primaryRiskValue !== "No major performance risk detected") warnings.push(primaryRiskValue);
  return {
    overallScore,
    overallStatus,
    confidence,
    dataQualityScore: quality.score,
    strengthTrend,
    runningTrend,
    recoveryTrend,
    nutritionTrend,
    adherenceTrend,
    weightTrend,
    primaryOpportunity: primaryOpportunityValue,
    primaryRisk: primaryRiskValue,
    summary: `${overallStatus}: overall performance score ${overallScore}/100. Opportunity: ${primaryOpportunityValue}. Risk: ${primaryRiskValue}.`,
    recommendations: recommendationFor(primaryOpportunityValue, primaryRiskValue),
    warnings: [...new Set(warnings)],
    auditTrail: auditFor(trends, overallStatus, overallScore, confidence),
  };
}

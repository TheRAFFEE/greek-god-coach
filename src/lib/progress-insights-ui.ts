import type { GoalTrackingEngineResult, GoalStatus } from "./goal-tracking-engine";
import type { PerformanceEngineResult, PerformanceStatus, PerformanceTrendResult } from "./performance-engine";
import type { ProgressionEngineResult, NutritionProgressDecision, WeeklyProgressDecision } from "./progression-engine";

export type ProgressInsightTone = "positive" | "neutral" | "warning" | "negative";

export interface ProgressInsightsInput {
  performanceEngineResult: PerformanceEngineResult;
  goalTrackingEngineResult: GoalTrackingEngineResult;
  progressionEngineResult: ProgressionEngineResult;
}

export interface ProgressInsightOverview {
  score: number;
  scoreLabel: string;
  status: PerformanceStatus;
  confidence: PerformanceEngineResult["confidence"];
  dataQualityScore: number;
  dataQualityLabel: string;
  tone: ProgressInsightTone;
}

export interface ProgressInsightDomainCard {
  label: PerformanceTrendResult["domain"];
  status: PerformanceStatus;
  score: number;
  scoreLabel: string;
  trend: string;
  explanation: string;
  tone: ProgressInsightTone;
}

export interface ProgressInsightGoalCard {
  label: "Fat Loss" | "Physique" | "Strength" | "Half Marathon";
  status: GoalStatus;
  confidence: GoalTrackingEngineResult["confidence"];
  currentValue: string;
  targetValue: string;
  trend: string;
  explanation: string;
  tone: ProgressInsightTone;
}

export interface ProgressInsightWeeklyDecision {
  weeklyDecision: WeeklyProgressDecision;
  nutritionDecision: NutritionProgressDecision;
  confidence: ProgressionEngineResult["confidence"];
  dataQualityScore: number;
  reasons: string[];
  warnings: string[];
}

export interface ProgressInsightAuditEntry {
  id: string;
  domain: string;
  decision: string;
  score: number;
  reason: string;
  confidence: string;
}

export interface ProgressInsightTrendCard {
  label: "Weight trend" | "Running trend" | "Strength trend" | "Nutrition adherence trend";
  status: PerformanceStatus;
  value: string;
  summary: string;
  tone: ProgressInsightTone;
}

export interface ProgressInsightsModel {
  overview: ProgressInsightOverview;
  domains: ProgressInsightDomainCard[];
  primaryOpportunity: { title: string; explanation: string };
  primaryRisk: { title: string; explanation: string };
  goalTracking: ProgressInsightGoalCard[];
  weeklyDecision: ProgressInsightWeeklyDecision;
  auditSnapshot: ProgressInsightAuditEntry[];
  trendCards: ProgressInsightTrendCard[];
  coachSummary: string;
}

function toneForPerformance(status: PerformanceStatus): ProgressInsightTone {
  if (status === "Improving") return "positive";
  if (status === "Stable") return "neutral";
  if (status === "Plateau" || status === "Insufficient Data") return "warning";
  return "negative";
}

function toneForGoal(status: GoalStatus): ProgressInsightTone {
  if (status === "On Track") return "positive";
  if (status === "At Risk" || status === "Insufficient Data") return "warning";
  return "negative";
}

function trendCopy(trend: PerformanceTrendResult): string {
  const metricValues = Object.entries(trend.metrics)
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${value}`);
  return metricValues.length ? metricValues.join(" · ") : trend.status;
}

function domainCard(trend: PerformanceTrendResult): ProgressInsightDomainCard {
  return {
    label: trend.domain,
    status: trend.status,
    score: trend.score,
    scoreLabel: `${trend.score}/100`,
    trend: trendCopy(trend),
    explanation: trend.reasons[0] ?? trend.summary,
    tone: toneForPerformance(trend.status),
  };
}

function goalCard(label: ProgressInsightGoalCard["label"], goal: GoalTrackingEngineResult["goals"][keyof GoalTrackingEngineResult["goals"]], confidence: GoalTrackingEngineResult["confidence"]): ProgressInsightGoalCard {
  return {
    label,
    status: goal.status,
    confidence: goal.confidence ?? confidence,
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    trend: goal.trend,
    explanation: goal.explanation,
    tone: toneForGoal(goal.status),
  };
}

function auditSnapshot(result: PerformanceEngineResult): ProgressInsightAuditEntry[] {
  return [...result.auditTrail].reverse().slice(0, 5).map((entry) => ({
    id: entry.id,
    domain: entry.domain,
    decision: entry.decision,
    score: entry.score,
    reason: entry.reason,
    confidence: entry.confidence,
  }));
}

function trendCards(result: PerformanceEngineResult): ProgressInsightTrendCard[] {
  return [
    { label: "Weight trend", status: result.weightTrend.status, value: result.weightTrend.score.toString(), summary: result.weightTrend.summary, tone: toneForPerformance(result.weightTrend.status) },
    { label: "Running trend", status: result.runningTrend.status, value: result.runningTrend.score.toString(), summary: result.runningTrend.summary, tone: toneForPerformance(result.runningTrend.status) },
    { label: "Strength trend", status: result.strengthTrend.status, value: result.strengthTrend.score.toString(), summary: result.strengthTrend.summary, tone: toneForPerformance(result.strengthTrend.status) },
    { label: "Nutrition adherence trend", status: result.nutritionTrend.status, value: result.nutritionTrend.score.toString(), summary: result.nutritionTrend.summary, tone: toneForPerformance(result.nutritionTrend.status) },
  ];
}

function sentenceStatus(status: PerformanceStatus) {
  return status === "Insufficient Data" ? "insufficient data" : status.toLowerCase();
}

function coachSummary(input: ProgressInsightsInput, domains: ProgressInsightDomainCard[]) {
  const performance = input.performanceEngineResult;
  if (performance.overallStatus === "Insufficient Data") {
    return `Need more data before calling a performance trend. Primary opportunity: ${performance.primaryOpportunity}. Primary risk: ${performance.primaryRisk}.`;
  }
  const positive = domains.filter((domain) => domain.status === "Improving").map((domain) => domain.label.toLowerCase());
  const flatOrRisk = domains.filter((domain) => domain.status === "Plateau" || domain.status === "Declining").map((domain) => domain.label.toLowerCase());
  return `Performance is ${sentenceStatus(performance.overallStatus)}. ${positive.length ? `${positive.join(" and ")} are trending up.` : "No domain is clearly trending up yet."} ${flatOrRisk.length ? `${flatOrRisk.join(" and ")} need attention.` : "No major plateau or decline is showing."} Primary opportunity: ${performance.primaryOpportunity}. Primary risk: ${performance.primaryRisk}. Weekly decision: ${input.progressionEngineResult.weeklyDecision}.`;
}

export function buildProgressInsightsModel(input: ProgressInsightsInput): ProgressInsightsModel {
  const performance = input.performanceEngineResult;
  const domains = [
    domainCard(performance.strengthTrend),
    domainCard(performance.runningTrend),
    domainCard(performance.recoveryTrend),
    domainCard(performance.nutritionTrend),
    domainCard(performance.adherenceTrend),
    domainCard(performance.weightTrend),
  ];
  const goalTracking = input.goalTrackingEngineResult;
  return {
    overview: {
      score: performance.overallScore,
      scoreLabel: `${performance.overallScore}/100`,
      status: performance.overallStatus,
      confidence: performance.confidence,
      dataQualityScore: performance.dataQualityScore,
      dataQualityLabel: `${performance.dataQualityScore}/100`,
      tone: toneForPerformance(performance.overallStatus),
    },
    domains,
    primaryOpportunity: { title: performance.primaryOpportunity, explanation: performance.recommendations[0] ?? performance.summary },
    primaryRisk: { title: performance.primaryRisk, explanation: performance.warnings[0] ?? performance.summary },
    goalTracking: [
      goalCard("Fat Loss", goalTracking.goals.fatLoss, goalTracking.confidence),
      goalCard("Physique", goalTracking.goals.physique, goalTracking.confidence),
      goalCard("Strength", goalTracking.goals.strength, goalTracking.confidence),
      goalCard("Half Marathon", goalTracking.goals.halfMarathon, goalTracking.confidence),
    ],
    weeklyDecision: {
      weeklyDecision: input.progressionEngineResult.weeklyDecision,
      nutritionDecision: input.progressionEngineResult.nutritionDecision,
      confidence: input.progressionEngineResult.confidence,
      dataQualityScore: input.progressionEngineResult.dataQuality.score,
      reasons: input.progressionEngineResult.reasons,
      warnings: input.progressionEngineResult.warnings,
    },
    auditSnapshot: auditSnapshot(performance),
    trendCards: trendCards(performance),
    coachSummary: coachSummary(input, domains),
  };
}

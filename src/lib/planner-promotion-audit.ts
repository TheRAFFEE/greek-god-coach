import { buildDailyTrainingSession, type DailyTrainingSession } from "./training-planner";
import { resolvePrimarySession } from "./primary-session-resolver";
import { workouts as seedWorkouts } from "./seed-data";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { Workout } from "./types";

export type MismatchType =
  | "DAY_TYPE"
  | "PRIMARY_SESSION"
  | "WORKOUT"
  | "RUN"
  | "RUN_DISTANCE"
  | "RUN_DURATION"
  | "BLOCKS"
  | "CLASSIFICATION";

export type MismatchSeverity = "EXPECTED_IMPROVEMENT" | "NEEDS_REVIEW" | "CRITICAL";

export type PromotionRecommendation =
  | "NOT_READY"
  | "SHADOW_MODE_READY"
  | "TRAIN_READY"
  | "HOME_READY"
  | "FULL_PROMOTION_READY";

export interface PromotionAuditDaySnapshot {
  dayType: string;
  workoutTitle: string | null;
  runTitle: string | null;
  runType: string | null;
  runDistance: number | null;
  runDuration: number | null;
  sessionClassification: string;
  primarySession: string;
  blocks: string[];
  hasLift: boolean;
  hasRun: boolean;
  hasMobility: boolean;
  hasCooldown: boolean;
}

export interface PromotionAuditDay {
  id: string;
  week: number;
  dayIndex: number;
  title: string;
  plannerOutput: PromotionAuditDaySnapshot;
  legacyOutput: PromotionAuditDaySnapshot;
}

export interface PromotionAuditMismatch {
  id: string;
  workoutId: string;
  week: number;
  dayIndex: number;
  workoutTitle: string;
  type: MismatchType;
  severity: MismatchSeverity;
  field: string;
  plannerValue: string | number | boolean | string[] | null;
  legacyValue: string | number | boolean | string[] | null;
  explanation: string;
}

export interface PromotionAuditResult {
  totalDaysAudited: number;
  plannerMatchesLegacy: number;
  plannerMismatchesLegacy: number;
  mismatchRate: number;
  mismatches: PromotionAuditMismatch[];
  expectedImprovements: number;
  needsReview: number;
  criticalMismatches: number;
  promotionRecommendation: PromotionRecommendation;
  days: PromotionAuditDay[];
}

export interface AuditPlannerPromotionInput {
  workouts?: Workout[];
  auditDays?: PromotionAuditDay[];
  injectedMismatches?: PromotionAuditMismatch[];
}

const readinessResult: ReadinessEngineResult = {
  score: 90,
  status: "Green",
  confidence: "High",
  reasons: [],
  reason: "Green readiness",
  recommendation: "Train normally",
  recommendationType: "full_training",
  trainingGuidance: "Full session",
  recoveryGuidance: [],
  dataQualityWarnings: [],
};

const progressionResult: ProgressionEngineResult = {
  weeklyDecision: "Progress",
  nutritionDecision: "Maintain Calories",
  goalStatus: { "Fat Loss": "On Track", Physique: "On Track", Strength: "On Track", "Half Marathon": "On Track" },
  confidence: "High",
  dataQuality: { score: 95, confidence: "High", missingInputs: [], penalties: [], warnings: [] },
  reasons: [],
  warnings: [],
  auditEntries: [],
};

const goal = (domain: GoalTrackingEngineResult["goals"]["fatLoss"]["domain"]): GoalTrackingEngineResult["goals"]["fatLoss"] => ({
  domain,
  status: "On Track",
  score: 90,
  confidence: "High",
  currentValue: "ok",
  targetValue: "ok",
  trend: "improving",
  blockers: [],
  supportingSignals: [],
  recommendation: "Continue",
  explanation: "On track",
});

const goalTrackingResult: GoalTrackingEngineResult = {
  overallStatus: "On Track",
  overallScore: 90,
  confidence: "High",
  dataQualityScore: 95,
  goals: {
    fatLoss: goal("fat_loss"),
    physique: goal("physique"),
    strength: goal("strength"),
    halfMarathon: goal("half_marathon"),
  },
  priorityGoal: "half_marathon",
  summary: "Goals on track",
  recommendations: [],
  warnings: [],
  explanations: [],
  auditTrail: [],
};

function auditDate(dayIndex: number): string {
  return `2026-06-0${dayIndex + 1}`;
}

function blockKinds(session: DailyTrainingSession): string[] {
  return session.blocks.map((block) => block.kind);
}

function plannerSnapshot(workout: Workout, plan: Workout[]): PromotionAuditDaySnapshot {
  const session = buildDailyTrainingSession({
    date: auditDate(workout.dayIndex),
    currentWeek: workout.week,
    workouts: plan,
    readinessResult,
    progressionResult,
    goalTrackingResult,
    userPreferences: { includeWarmup: true, includeCooldown: true },
  });
  const primary = resolvePrimarySession(workout);
  const blocks = blockKinds(session);
  return {
    dayType: primary.dayType,
    workoutTitle: session.workout?.title ?? null,
    runTitle: session.run?.title ?? null,
    runType: session.run?.type ?? null,
    runDistance: session.run?.distanceMiles ?? null,
    runDuration: session.run?.durationMinutes ?? null,
    sessionClassification: classificationLabel(blocks),
    primarySession: primary.dayType,
    blocks,
    hasLift: Boolean(session.workout),
    hasRun: Boolean(session.run),
    hasMobility: Boolean(session.mobility),
    hasCooldown: Boolean(session.cooldown),
  };
}

function exerciseText(workout: Workout): string {
  return `${workout.title} ${workout.type} ${workout.notes ?? ""} ${workout.finisher ?? ""} ${workout.exercises.map((exercise) => `${exercise.name} ${exercise.category} ${exercise.prescribedReps}`).join(" ")}`;
}

function isLegacyRun(workout: Workout): boolean {
  const text = exerciseText(workout);
  const titleType = `${workout.title} ${workout.type}`;
  if (/sprint/i.test(titleType) && !/\brun\b|zone\s*2|tempo|threshold|hill|race|long\s+run/i.test(titleType)) return false;
  return typeof workout.longRunMiles === "number" || /\brun\b|zone\s*2|mile|miles|tempo|threshold|hill repeat|race/i.test(text);
}

function isLegacyMobility(workout: Workout): boolean {
  return workout.exercises.some((exercise) => /mobility|stretch|prehab/i.test(`${exercise.name} ${exercise.category}`));
}

function isLegacyConditioning(workout: Workout): boolean {
  const titleType = `${workout.title} ${workout.type}`;
  if (/zone\s*2|long\s+run|recovery/i.test(titleType)) return false;
  return workout.exercises.some((exercise) => {
    const text = `${exercise.name} ${exercise.category} ${exercise.prescribedReps}`;
    if (/\bwalk\b|\brun\b|zone\s*2|mobility|stretch|recovery|core|nutrition/i.test(text)) return false;
    return /conditioning|sprint|plyo|jump|kettlebell|swing|burpee|agility|circuit|power/i.test(text);
  });
}

function isLegacyRecovery(workout: Workout): boolean {
  return /recovery|rest/i.test(`${workout.title} ${workout.type}`);
}

function isLegacyLift(workout: Workout): boolean {
  if (isLegacyRecovery(workout)) return false;
  return workout.exercises.some((exercise) => !/run|mobility|stretch|recovery|walk|nutrition|core|conditioning|sprint|plyo|jump|kettlebell|swing|burpee|agility/i.test(`${exercise.name} ${exercise.category}`));
}

function parseMinutes(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(?:min|minute|minutes)\b/i);
  if (!match) return null;
  return Math.round((Number(match[1]) + Number(match[2] ?? match[1])) / 2);
}

function parseMiles(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/i);
  return match ? Number(match[1]) : null;
}

function fmtMiles(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function legacyRunType(workout: Workout): string | null {
  const text = `${workout.title} ${workout.type} ${workout.notes ?? ""}`;
  if (!isLegacyRun(workout)) return null;
  if (/long/i.test(text)) return "long";
  if (/tempo|threshold/i.test(text)) return "tempo";
  if (/speed|sprint|interval/i.test(text)) return "speed";
  if (/race/i.test(text)) return "race";
  return "easy";
}

function classificationLabel(blocks: string[]): string {
  const training = blocks.filter((block) => !["warmup", "cooldown"].includes(block));
  return training.length ? training.join(" + ") : "Rest";
}

function legacySnapshot(workout: Workout): PromotionAuditDaySnapshot {
  const hasLift = isLegacyLift(workout);
  const hasRun = isLegacyRun(workout);
  const hasMobility = isLegacyMobility(workout);
  const hasConditioning = isLegacyConditioning(workout);
  const recovery = isLegacyRecovery(workout);
  const hasCooldown = hasLift || hasRun || hasMobility || hasConditioning || recovery;
  const blocks = ["warmup", ...(recovery ? ["mobility"] : []), ...(hasLift && !recovery ? ["lift"] : []), ...(hasConditioning && !recovery ? ["conditioning"] : []), ...(hasRun && !recovery ? ["run"] : []), ...(hasMobility && !recovery ? ["mobility"] : []), ...(hasCooldown ? ["cooldown"] : [])];
  const runDistance = typeof workout.longRunMiles === "number" ? workout.longRunMiles : parseMiles(exerciseText(workout));
  const runDuration = runDistance ? null : parseMinutes(exerciseText(workout));
  const runType = legacyRunType(workout);
  const primary = recovery ? "RecoveryDay" : hasLift ? "LiftDay" : hasRun && /long/i.test(`${workout.title} ${workout.type}`) ? "LongRunDay" : hasRun ? "RunDay" : hasMobility ? "MobilityDay" : "UnavailableDay";
  return {
    dayType: primary,
    workoutTitle: hasLift && !recovery ? workout.title : null,
    runTitle: hasRun && !recovery ? (runDistance ? (/long/i.test(`${workout.title} ${workout.type}`) ? `Long Run — ${fmtMiles(runDistance)} mi` : `${workout.title} — ${fmtMiles(runDistance)} mi`) : workout.title) : null,
    runType,
    runDistance: hasRun ? runDistance : null,
    runDuration: hasRun ? runDuration : null,
    sessionClassification: classificationLabel(blocks),
    primarySession: primary,
    blocks,
    hasLift,
    hasRun,
    hasMobility,
    hasCooldown,
  };
}

function arrayEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isSupportRunImprovement(day: PromotionAuditDay, type: MismatchType): boolean {
  return /Zone 2(?: Run)? \+ Mobility \+ Core/i.test(day.title)
    && day.plannerOutput.primarySession === "RunDay"
    && day.legacyOutput.hasLift
    && !day.plannerOutput.hasLift
    && ["DAY_TYPE", "PRIMARY_SESSION", "WORKOUT", "BLOCKS", "CLASSIFICATION"].includes(type);
}

function severityFor(day: PromotionAuditDay, type: MismatchType): MismatchSeverity {
  const legacyScheduledRunPrimary = ["RunDay", "LongRunDay", "RaceDay"].includes(day.legacyOutput.primarySession) || /\b(Zone 2|Long Run|Tempo|Threshold|Race)\b/i.test(day.title);
  if (legacyScheduledRunPrimary && day.legacyOutput.hasRun && !day.plannerOutput.hasRun) return "CRITICAL";
  if (legacyScheduledRunPrimary && day.legacyOutput.runDistance !== null && day.plannerOutput.runDistance === null && day.plannerOutput.runDuration === null) return "CRITICAL";
  if (isSupportRunImprovement(day, type)) return "EXPECTED_IMPROVEMENT";
  if (/Long Run/i.test(day.title) && (day.plannerOutput.hasLift || day.plannerOutput.primarySession !== "LongRunDay")) return "CRITICAL";
  return "NEEDS_REVIEW";
}

function explanationFor(severity: MismatchSeverity, type: MismatchType): string {
  if (severity === "CRITICAL") return "Planner removed or materially changed a scheduled run/long-run obligation; promotion must stop.";
  if (severity === "EXPECTED_IMPROVEMENT") return "Planner intentionally fixes Phase 23D support-work classification so Zone 2 plus mobility/core remains RunDay without a lift block.";
  return `Planner and legacy disagree on ${type.toLowerCase().replace("_", " ")}; manual review is required before promotion.`;
}

function mismatch(day: PromotionAuditDay, index: number, type: MismatchType, field: string, plannerValue: PromotionAuditMismatch["plannerValue"], legacyValue: PromotionAuditMismatch["legacyValue"]): PromotionAuditMismatch {
  const severity = severityFor(day, type);
  return {
    id: `${day.id}-${type}-${index}`,
    workoutId: day.id,
    week: day.week,
    dayIndex: day.dayIndex,
    workoutTitle: day.title,
    type,
    severity,
    field,
    plannerValue,
    legacyValue,
    explanation: explanationFor(severity, type),
  };
}

function compareDay(day: PromotionAuditDay): PromotionAuditMismatch[] {
  const mismatches: PromotionAuditMismatch[] = [];
  const push = (type: MismatchType, field: string, plannerValue: PromotionAuditMismatch["plannerValue"], legacyValue: PromotionAuditMismatch["legacyValue"]) => mismatches.push(mismatch(day, mismatches.length + 1, type, field, plannerValue, legacyValue));
  const p = day.plannerOutput;
  const l = day.legacyOutput;
  if (p.dayType !== l.dayType) push("DAY_TYPE", "day type", p.dayType, l.dayType);
  if (p.primarySession !== l.primarySession) push("PRIMARY_SESSION", "primary session", p.primarySession, l.primarySession);
  if (p.workoutTitle !== l.workoutTitle) push("WORKOUT", "workout title", p.workoutTitle, l.workoutTitle);
  if (p.runTitle !== l.runTitle || p.runType !== l.runType || p.hasRun !== l.hasRun) push("RUN", "run title/type/presence", `${p.runTitle ?? "none"}|${p.runType ?? "none"}|${p.hasRun}`, `${l.runTitle ?? "none"}|${l.runType ?? "none"}|${l.hasRun}`);
  if (p.runDistance !== l.runDistance) push("RUN_DISTANCE", "run distance", p.runDistance, l.runDistance);
  if (p.runDuration !== l.runDuration) push("RUN_DURATION", "run duration", p.runDuration, l.runDuration);
  if (!arrayEqual(p.blocks, l.blocks) || p.hasLift !== l.hasLift || p.hasMobility !== l.hasMobility || p.hasCooldown !== l.hasCooldown) push("BLOCKS", "blocks/presence", p.blocks, l.blocks);
  if (p.sessionClassification !== l.sessionClassification) push("CLASSIFICATION", "session classification", p.sessionClassification, l.sessionClassification);
  return mismatches;
}

function recommendationFor(mismatches: PromotionAuditMismatch[]): PromotionRecommendation {
  const critical = mismatches.filter((mismatch) => mismatch.severity === "CRITICAL").length;
  const needsReview = mismatches.filter((mismatch) => mismatch.severity === "NEEDS_REVIEW").length;
  const expected = mismatches.filter((mismatch) => mismatch.severity === "EXPECTED_IMPROVEMENT").length;
  if (critical > 0) return "NOT_READY";
  if (needsReview === 0 && expected === 0) return "TRAIN_READY";
  if (needsReview <= 5) return "SHADOW_MODE_READY";
  return "NOT_READY";
}

function buildAuditDays(workouts: Workout[]): PromotionAuditDay[] {
  return workouts.map((workout) => ({
    id: workout.id,
    week: workout.week,
    dayIndex: workout.dayIndex,
    title: workout.title,
    plannerOutput: plannerSnapshot(workout, workouts),
    legacyOutput: legacySnapshot(workout),
  }));
}

export function auditPlannerPromotion(input: AuditPlannerPromotionInput = {}): PromotionAuditResult {
  const days = input.auditDays ?? buildAuditDays(input.workouts ?? seedWorkouts);
  const generatedMismatches = days.flatMap(compareDay);
  const mismatches = [...generatedMismatches, ...(input.injectedMismatches ?? [])];
  const mismatchedDayIds = new Set(mismatches.map((mismatch) => mismatch.workoutId));
  const totalDaysAudited = days.length;
  const expectedImprovements = mismatches.filter((mismatch) => mismatch.severity === "EXPECTED_IMPROVEMENT").length;
  const needsReview = mismatches.filter((mismatch) => mismatch.severity === "NEEDS_REVIEW").length;
  const criticalMismatches = mismatches.filter((mismatch) => mismatch.severity === "CRITICAL").length;
  return {
    totalDaysAudited,
    plannerMatchesLegacy: totalDaysAudited - mismatchedDayIds.size,
    plannerMismatchesLegacy: mismatches.length,
    mismatchRate: totalDaysAudited === 0 ? 0 : mismatchedDayIds.size / totalDaysAudited,
    mismatches,
    expectedImprovements,
    needsReview,
    criticalMismatches,
    promotionRecommendation: recommendationFor(mismatches),
    days,
  };
}

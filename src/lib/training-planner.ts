import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import { resolvePrimarySession, type PrimarySessionResolution, type PrimarySessionType } from "./primary-session-resolver";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { RunningEngineResult } from "./running-engine";
import type { Exercise, RunLog, RunningRecommendation, RunType, Workout, WorkoutSession } from "./types";

export type DailyTrainingStatus = "Normal" | "Modified" | "Recovery" | "Rest";
export type DailyTrainingConfidence = "High" | "Medium" | "Low";
export type DailyTrainingBlockKind = "warmup" | "lift" | "conditioning" | "run" | "mobility" | "walk" | "recovery" | "cooldown" | "summary";
export type DailyTrainingSource = "Training Planner" | "Readiness Engine" | "Workout Engine" | "Running Engine" | "Progression Engine" | "Goal Tracking Engine";
export type DailyRunPrescriptionMode = "distance" | "duration" | "recovery";
export type DailyRunType = "easy" | "long" | "tempo" | "speed" | "race" | "walk";
export type DailyTrainingWarningSeverity = "info" | "warning" | "critical";
export type DailyTrainingSupportKind = "Core";

export interface BuildDailyTrainingSessionInput {
  date: string;
  currentWeek: number;
  workouts: Workout[];
  readinessResult: ReadinessEngineResult;
  progressionResult: ProgressionEngineResult;
  goalTrackingResult: GoalTrackingEngineResult;
  runningEngineResult?: RunningEngineResult | null;
  runningRecommendation?: RunningRecommendation | null;
  userPreferences?: {
    includeWarmup?: boolean;
    includeCooldown?: boolean;
    preferredOrder?: Array<"lift" | "run" | "mobility" | "recovery">;
    availableMinutes?: number | null;
  } | null;
  completedWorkoutSessions?: WorkoutSession[];
  completedRunLogs?: RunLog[];
}

export interface DailyTrainingBlock {
  id: string;
  kind: DailyTrainingBlockKind;
  order: number;
  title: string;
  description: string;
  items: string[];
  estimatedMinutes: number;
  source: DailyTrainingSource;
  executionTarget?: {
    type: "workout" | "run" | "none";
    sourceWorkoutId?: string;
    sourceRunId?: string;
    logDate: string;
  };
}

export interface DailyWorkoutPrescription {
  sourceWorkoutId: string;
  title: string;
  type: string;
  exercises: Exercise[];
  estimatedMinutes: number;
  readinessAdjusted: boolean;
  executionRequired: boolean;
  loggingTarget: {
    workoutId: string;
    workoutTitle: string;
    date: string;
  };
}

export interface DailyRunPrescription {
  sourceWorkoutId?: string;
  title: string;
  type: DailyRunType;
  prescriptionMode: DailyRunPrescriptionMode;
  durationRange?: {
    source: string;
    minMinutes: number;
    maxMinutes: number;
    resolvedMinutes: number;
  };
  durationResolved?: number;
  distanceMiles: number | null;
  durationMinutes: number | null;
  required: boolean;
  estimatedMinutes: number;
  runningRecommendationAction?: RunningRecommendation["action"];
  executionRequired: boolean;
  loggingTarget: {
    date: string;
    plannedDistance: number | null;
    plannedDurationMinutes: number | null;
    runType: RunType;
  };
}

export interface DailyMobilityPrescription {
  sourceWorkoutId?: string;
  title: string;
  items: string[];
  estimatedMinutes: number;
}

export interface DailyRecoveryPrescription {
  title: string;
  items: string[];
  estimatedMinutes: number;
  reason: string;
}

export interface DailyTrainingSupportItem {
  kind: DailyTrainingSupportKind;
  title: string;
  items: string[];
  sourceWorkoutId?: string;
}

export interface DailyTrainingLoadEstimate {
  estimatedDurationMinutes: number;
  modalityCount: number;
  hasLift: boolean;
  hasRun: boolean;
  hasConditioning: boolean;
  hasPlyometricsOrSprints: boolean;
  lowerBodyStress: "None" | "Low" | "Moderate" | "High";
  sessionStress: "Low" | "Moderate" | "High" | "Recovery";
  overloadFlags: string[];
}

export interface DailyTrainingModification {
  source: "Readiness Engine" | "Progression Engine" | "Training Planner";
  reason: string;
  action: string;
}

export interface DailyTrainingWarning {
  message: string;
  source: DailyTrainingSource;
  severity: DailyTrainingWarningSeverity;
}

export interface DailyTrainingGoal {
  label: string;
  priority: "Safety" | "Recovery" | "Training" | "Nutrition" | "Goals";
  source: DailyTrainingSource | "Nutrition Engine";
}

export interface DailyTrainingAuditEntry {
  id: string;
  event: string;
  message: string;
  source: DailyTrainingSource;
}

export interface DailyTrainingSession {
  id: string;
  date: string;
  currentWeek: number;
  dayIndex: number;
  sourcePlan: {
    source: "seed-workouts-v1" | "future-race-calendar" | "manual-override";
    sourceWorkoutId?: string;
    sourceWorkoutTitle?: string;
    sourceWorkoutType?: string;
    sourceWorkoutDeload?: boolean;
    resolvedSessionType: PrimarySessionType;
  };
  sessionType: PrimarySessionType;
  metadata: {
    deload: boolean;
  };
  status: DailyTrainingStatus;
  readinessStatus: ReadinessEngineResult["status"];
  confidence: DailyTrainingConfidence;
  summary: {
    title: string;
    primaryAction: string;
    workoutName: string | null;
    runName: string | null;
    estimatedDurationMinutes: number;
    completionStatus: "Not Started" | "Partially Completed" | "Completed" | "Not Scheduled";
  };
  blocks: DailyTrainingBlock[];
  workout: DailyWorkoutPrescription | null;
  run: DailyRunPrescription | null;
  mobility: DailyMobilityPrescription | null;
  recovery: DailyRecoveryPrescription | null;
  support: DailyTrainingSupportItem[];
  warmup: DailyTrainingBlock | null;
  cooldown: DailyTrainingBlock | null;
  estimatedDurationMinutes: number;
  combinedLoad: DailyTrainingLoadEstimate;
  modifications: DailyTrainingModification[];
  warnings: DailyTrainingWarning[];
  todayGoals: DailyTrainingGoal[];
  auditTrail: DailyTrainingAuditEntry[];
}

type Classification = {
  primarySession: PrimarySessionResolution;
  liftExercises: Exercise[];
  conditioningExercises: Exercise[];
  mobilityExercises: Exercise[];
  recoveryExercises: Exercise[];
  coreExercises: Exercise[];
  runExercises: Exercise[];
  hasConditioning: boolean;
  hasPlyometricsOrSprints: boolean;
  hasLowerBody: boolean;
  isRecoveryDay: boolean;
};

const round = (value: number) => Math.round(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmtMiles = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");

function planDayIndex(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function addAudit(entries: DailyTrainingAuditEntry[], event: string, message: string, source: DailyTrainingSource = "Training Planner") {
  entries.push({ id: `audit-${entries.length + 1}`, event, message, source });
}

function confidence(input: BuildDailyTrainingSessionInput): DailyTrainingConfidence {
  const values = [input.readinessResult.confidence, input.progressionResult.confidence, input.goalTrackingResult.confidence];
  if (values.includes("Low") || input.progressionResult.dataQuality.score < 60 || input.goalTrackingResult.dataQualityScore < 60) return "Low";
  if (values.includes("Medium") || input.progressionResult.dataQuality.score < 80 || input.goalTrackingResult.dataQualityScore < 75) return "Medium";
  return "High";
}

function parseMinutes(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(?:min|minute|minutes)\b/i);
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2] ?? match[1]);
  return round((low + high) / 2);
}

function parseDurationRange(text: string): DailyRunPrescription["durationRange"] | null {
  const match = text.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(?:min|minute|minutes)\b/i);
  if (!match) return null;
  const minMinutes = Number(match[1]);
  const maxMinutes = Number(match[2] ?? match[1]);
  return {
    source: match[0],
    minMinutes,
    maxMinutes,
    resolvedMinutes: round((minMinutes + maxMinutes) / 2),
  };
}

function parseMiles(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/i);
  return match ? Number(match[1]) : null;
}

function isRunExercise(exercise: Exercise) {
  const text = `${exercise.name} ${exercise.category} ${exercise.prescribedReps}`;
  return /\brun\b|jog|interval/i.test(text) && (/mi|mile|miles|min|minute/i.test(text) || /run|zone/i.test(exercise.category));
}

function isMobilityExercise(exercise: Exercise) {
  const text = `${exercise.name} ${exercise.category}`;
  return exercise.category === "mobility" || /mobility|stretch|t-spine|thoracic mobility|hip mobility|shoulder mobility/i.test(text);
}

function isRecoveryExercise(exercise: Exercise) {
  return /recovery|meal prep|nutrition|hydration|sleep/i.test(`${exercise.name} ${exercise.category}`) || exercise.category === "recovery";
}

function isLowerBodyExercise(exercise: Exercise) {
  return /lower|squat|deadlift|rdl|lunge|leg|split squat|hamstring|quad|glute|jump/i.test(`${exercise.name} ${exercise.category}`);
}

function isConditioningExercise(exercise: Exercise) {
  const text = `${exercise.name} ${exercise.category} ${exercise.prescribedReps}`;
  if (/\bwalk\b/i.test(text) && exercise.category !== "conditioning") return false;
  if (isRunExercise(exercise) || isMobilityExercise(exercise) || isRecoveryExercise(exercise)) return false;
  return /conditioning|sprint|plyo|jump|kettlebell|swing|burpee|agility|circuit|finisher/i.test(text);
}

function isCoreExercise(exercise: Exercise) {
  const text = `${exercise.name} ${exercise.category} ${exercise.prescribedReps}`;
  return /\bcore\b|trunk|brace|bracing|anti-rotation|anti-extension|pallof|side plank|plank|hanging leg raises?|leg raises?|cable crunch(?:es)?|crunch(?:es)?|ab wheel|loaded carr(?:y|ies)|farmer carr(?:y|ies)|carry|carries/i.test(text);
}

function classifyWorkout(workout: Workout | undefined): Classification {
  const primarySession = resolvePrimarySession(workout);
  if (!workout) return { primarySession, liftExercises: [], conditioningExercises: [], mobilityExercises: [], recoveryExercises: [], coreExercises: [], runExercises: [], hasConditioning: false, hasPlyometricsOrSprints: false, hasLowerBody: false, isRecoveryDay: false };
  const isRecoveryDay = primarySession.dayType === "RecoveryDay";
  const mobilityExercises = workout.exercises.filter(isMobilityExercise);
  const recoveryExercises = workout.exercises.filter(isRecoveryExercise);
  const coreExercises = workout.exercises.filter(isCoreExercise);
  const runExercises = workout.exercises.filter(isRunExercise);
  const liftAllowed = primarySession.allowedBlocks.includes("lift") && !primarySession.forbiddenBlocks.includes("lift");
  const conditioningAllowed = primarySession.allowedBlocks.includes("conditioning") && !primarySession.forbiddenBlocks.includes("conditioning");
  const conditioningExercises = conditioningAllowed && !isRecoveryDay ? workout.exercises.filter(isConditioningExercise) : [];
  const liftExercises = !liftAllowed || isRecoveryDay ? [] : workout.exercises.filter((exercise) => !isRunExercise(exercise) && !isMobilityExercise(exercise) && !isRecoveryExercise(exercise) && !isCoreExercise(exercise) && !isConditioningExercise(exercise) && !/nutrition|core|breathing|prehab|warmup|cooldown/i.test(exercise.category));
  const conditioningText = `${workout.type} ${workout.title} ${workout.notes} ${workout.finisher ?? ""} ${workout.exercises.map((exercise) => `${exercise.name} ${exercise.category}`).join(" ")}`;
  const explicitConditioning = conditioningAllowed && conditioningExercises.length > 0;
  return {
    primarySession,
    liftExercises,
    conditioningExercises,
    mobilityExercises,
    recoveryExercises,
    coreExercises,
    runExercises,
    hasConditioning: explicitConditioning || /conditioning|circuit|finisher|burpee|kettlebell|swing|carry|agility|sprint/i.test(conditioningText),
    hasPlyometricsOrSprints: /sprint|plyo|jump|broad jump|box jump/i.test(conditioningText),
    hasLowerBody: /lower|leg|squat|deadlift|rdl|lunge|split squat|jump/i.test(conditioningText) || liftExercises.some(isLowerBodyExercise),
    isRecoveryDay,
  };
}

function buildSupport(workout: Workout | undefined, classification: Classification): DailyTrainingSupportItem[] {
  if (!workout || classification.isRecoveryDay || !classification.coreExercises.length) return [];
  return [{
    kind: "Core",
    title: "Core",
    items: classification.coreExercises.map((exercise) => `${exercise.order}. ${exercise.name}: ${exercise.prescribedSets} x ${exercise.prescribedReps}`),
    sourceWorkoutId: workout.id,
  }];
}

function runType(workout: Workout, runExercise?: Exercise): DailyRunType {
  const primaryText = `${workout.type} ${workout.title} ${runExercise?.name ?? ""}`;
  const text = `${primaryText} ${workout.notes}`;
  if (/long/i.test(text)) return "long";
  if (/race/i.test(primaryText)) return "race";
  if (/tempo|threshold/i.test(text)) return "tempo";
  if (/speed|sprint|interval/i.test(text)) return "speed";
  if (/walk/i.test(text)) return "walk";
  return "easy";
}

function toRunLogType(type: DailyRunType): RunType {
  if (type === "long") return "long run";
  if (type === "tempo") return "tempo";
  if (type === "speed") return "speed";
  if (type === "race") return "race";
  return "easy";
}

function buildRunPrescription(workout: Workout, classification: Classification, input: BuildDailyTrainingSessionInput): DailyRunPrescription | null {
  const runAllowed = classification.primarySession.allowedBlocks.includes("run") && !classification.primarySession.forbiddenBlocks.includes("run");
  if (!runAllowed) return null;
  const runExercise = classification.runExercises[0];
  const distanceFromWorkout = typeof workout.longRunMiles === "number" && workout.longRunMiles > 0 ? workout.longRunMiles : null;
  const distanceFromExercise = classification.runExercises.map((exercise) => parseMiles(`${exercise.prescribedReps} ${exercise.name}`)).find((value): value is number => typeof value === "number" && value > 0) ?? null;
  const durationRange = classification.runExercises.map((exercise) => parseDurationRange(`${exercise.prescribedReps} ${exercise.name} ${workout.notes}`)).find((value): value is NonNullable<DailyRunPrescription["durationRange"]> => Boolean(value)) ?? parseDurationRange(workout.notes);
  const duration = durationRange?.resolvedMinutes ?? parseMinutes(workout.notes);
  const distance = distanceFromWorkout ?? distanceFromExercise;
  if (!distance && !duration) return null;
  const type = runType(workout, runExercise);
  const recommendedDistance = input.runningRecommendation?.recommendedDistance && input.runningRecommendation.recommendedDistance > 0 ? input.runningRecommendation.recommendedDistance : null;
  const finalDistance = recommendedDistance ?? distance;
  const prescriptionMode: DailyRunPrescriptionMode = finalDistance ? "distance" : "duration";
  const estimatedMinutes = duration ?? (finalDistance ? clamp(round(finalDistance * (type === "long" ? 11 : 10)), 20, 120) : 0);
  return {
    sourceWorkoutId: workout.id,
    title: prescriptionMode === "distance" ? (type === "long" ? `Long Run — ${fmtMiles(finalDistance ?? 0)} mi` : `${workout.title} — ${fmtMiles(finalDistance ?? 0)} mi`) : workout.title,
    type,
    prescriptionMode,
    durationRange: durationRange ?? undefined,
    durationResolved: durationRange?.resolvedMinutes,
    distanceMiles: finalDistance ?? null,
    durationMinutes: prescriptionMode === "duration" ? estimatedMinutes : duration,
    required: !/optional/i.test(`${workout.type} ${workout.title} ${workout.notes}`),
    estimatedMinutes,
    runningRecommendationAction: input.runningRecommendation?.action,
    executionRequired: true,
    loggingTarget: {
      date: input.date,
      plannedDistance: finalDistance ?? null,
      plannedDurationMinutes: prescriptionMode === "duration" ? estimatedMinutes : duration,
      runType: toRunLogType(type),
    },
  };
}

function estimateWorkoutMinutes(exercises: Exercise[], modified: boolean) {
  if (!exercises.length) return 0;
  const base = clamp(30 + exercises.reduce((sum, exercise) => sum + exercise.prescribedSets * 4, 0), 40, 80);
  return modified ? round(base * 0.75) : base;
}

function buildWorkoutPrescription(workout: Workout, classification: Classification, modified: boolean, date: string): DailyWorkoutPrescription | null {
  const liftAllowed = classification.primarySession.allowedBlocks.includes("lift") && !classification.primarySession.forbiddenBlocks.includes("lift");
  if (!liftAllowed || !classification.liftExercises.length) return null;
  return {
    sourceWorkoutId: workout.id,
    title: modified ? `${workout.title} — Modified` : workout.title,
    type: workout.type,
    exercises: classification.liftExercises,
    estimatedMinutes: estimateWorkoutMinutes(classification.liftExercises, modified),
    readinessAdjusted: modified,
    executionRequired: true,
    loggingTarget: {
      workoutId: workout.id,
      workoutTitle: workout.title,
      date,
    },
  };
}

function buildMobilityPrescription(workout: Workout | undefined, classification: Classification): DailyMobilityPrescription | null {
  const mobilityAllowed = classification.primarySession.allowedBlocks.includes("mobility") || classification.primarySession.allowedBlocks.includes("recovery");
  if (!mobilityAllowed) return null;
  const prescribedItems = classification.isRecoveryDay
    ? [...classification.recoveryExercises, ...classification.mobilityExercises].sort((a, b) => a.order - b.order)
    : classification.mobilityExercises;
  const items = prescribedItems.map((exercise) => `${exercise.name}: ${exercise.prescribedSets} x ${exercise.prescribedReps}`);
  if (!items.length) return null;
  const estimatedMinutes = prescribedItems.reduce((sum, exercise) => sum + (parseMinutes(exercise.prescribedReps) ?? (exercise.category === "nutrition" ? 10 : 20)), 0);
  return { sourceWorkoutId: workout?.id, title: classification.isRecoveryDay ? "Recovery" : "Mobility", items, estimatedMinutes };
}

function buildRecoveryPrescription(reason: string): DailyRecoveryPrescription {
  return {
    title: "Recovery Session",
    items: ["20–30 minutes easy walking", "10–15 minutes pain-free mobility", "Hydrate early", "Prioritize sleep tonight"],
    estimatedMinutes: 45,
    reason,
  };
}

function block(id: string, kind: DailyTrainingBlockKind, title: string, description: string, items: string[], estimatedMinutes: number, source: DailyTrainingSource, executionTarget?: DailyTrainingBlock["executionTarget"]): DailyTrainingBlock {
  return { id, kind, order: 0, title, description, items, estimatedMinutes, source, executionTarget };
}

function workoutBlock(workout: DailyWorkoutPrescription, date: string): DailyTrainingBlock {
  return block(
    "block-lift",
    "lift",
    workout.title,
    workout.readinessAdjusted ? "Lift with Yellow-readiness volume reduction; keep RPE controlled." : "Execute the scheduled lift.",
    workout.exercises.map((exercise) => `${exercise.order}. ${exercise.name}: ${exercise.prescribedSets} x ${exercise.prescribedReps}`),
    workout.estimatedMinutes,
    "Workout Engine",
    { type: "workout", sourceWorkoutId: workout.sourceWorkoutId, logDate: date },
  );
}

function runBlock(run: DailyRunPrescription, date: string): DailyTrainingBlock {
  const items = run.prescriptionMode === "distance"
    ? [`Planned distance: ${fmtMiles(run.distanceMiles ?? 0)} mi`, "Stay conversational unless prescribed otherwise", "Log distance, duration, RPE, pain, and notes"]
    : [`Planned duration: ${run.durationMinutes} minutes`, "Distance is optional for this prescription", "Log duration, RPE, pain, and notes"];
  return block("block-run", "run", run.title, "Execute and log today’s run prescription.", items, run.estimatedMinutes, "Running Engine", { type: "run", sourceWorkoutId: run.sourceWorkoutId, logDate: date });
}

function conditioningBlock(workout: Workout, classification: Classification, date: string): DailyTrainingBlock | null {
  const conditioningAllowed = classification.primarySession.allowedBlocks.includes("conditioning") && !classification.primarySession.forbiddenBlocks.includes("conditioning");
  if (!conditioningAllowed || !classification.conditioningExercises.length) return null;
  const estimatedMinutes = clamp(classification.conditioningExercises.reduce((sum, exercise) => sum + exercise.prescribedSets * 3, 0), 8, 25);
  return block(
    "block-conditioning",
    "conditioning",
    "Conditioning / Power Exposure",
    "Execute explicitly programmed sprint, plyometric, or conditioning work without creating a run logging target.",
    classification.conditioningExercises.map((exercise) => `${exercise.order}. ${exercise.name}: ${exercise.prescribedSets} x ${exercise.prescribedReps}`),
    estimatedMinutes,
    "Training Planner",
    { type: "none", sourceWorkoutId: workout.id, logDate: date },
  );
}

function buildBlocks(input: { date: string; sourceWorkout: Workout | undefined; classification: Classification; workout: DailyWorkoutPrescription | null; run: DailyRunPrescription | null; mobility: DailyMobilityPrescription | null; recovery: DailyRecoveryPrescription | null; includeWarmup: boolean; includeCooldown: boolean; }): { blocks: DailyTrainingBlock[]; warmup: DailyTrainingBlock | null; cooldown: DailyTrainingBlock | null } {
  const blocks: DailyTrainingBlock[] = [];
  const conditioning = input.sourceWorkout && !input.recovery ? conditioningBlock(input.sourceWorkout, input.classification, input.date) : null;
  const hasTraining = Boolean(input.workout || conditioning || input.run || input.mobility || input.recovery);
  const warmup = input.includeWarmup && hasTraining ? block("block-warmup", "warmup", input.recovery ? "Recovery Warmup" : "Warmup", "Prepare for today’s prescribed training.", ["5 minutes easy cardio or brisk walk", "Dynamic mobility for hips, ankles, shoulders, and T-spine", ...(input.workout ? ["Ramp-up sets before first lift"] : []), ...(input.run ? ["Easy jog/walk before the run"] : [])], input.recovery ? 6 : 8, "Training Planner", { type: "none", logDate: input.date }) : null;
  const cooldown = input.includeCooldown && hasTraining ? block("block-cooldown", "cooldown", input.recovery ? "Recovery Cooldown" : "Cooldown", "Downshift before closing the session.", ["5 minutes easy walk", "Breathing cooldown", "Light stretching/mobility", "Post-session notes"], input.recovery ? 7 : 7, "Training Planner", { type: "none", logDate: input.date }) : null;
  if (warmup) blocks.push(warmup);
  if (input.recovery) blocks.push(block("block-recovery", "recovery", input.recovery.title, input.recovery.reason, input.recovery.items, input.recovery.estimatedMinutes, "Readiness Engine", { type: "none", logDate: input.date }));
  else {
    if (input.workout) blocks.push(workoutBlock(input.workout, input.date));
    if (conditioning) blocks.push(conditioning);
    if (input.run) blocks.push(runBlock(input.run, input.date));
    if (input.mobility) blocks.push(block("block-mobility", "mobility", input.mobility.title, "Pain-free mobility; this is time-based, not reps-based.", input.mobility.items, input.mobility.estimatedMinutes, "Training Planner", { type: "none", sourceWorkoutId: input.mobility.sourceWorkoutId, logDate: input.date }));
  }
  if (cooldown) blocks.push(cooldown);
  return { blocks: blocks.map((item, index) => ({ ...item, order: index + 1 })), warmup, cooldown };
}

function buildCombinedLoad(input: { status: DailyTrainingStatus; workout: DailyWorkoutPrescription | null; run: DailyRunPrescription | null; mobility: DailyMobilityPrescription | null; recovery: DailyRecoveryPrescription | null; classification: Classification; estimatedDurationMinutes: number; }): DailyTrainingLoadEstimate {
  const hasLift = Boolean(input.workout);
  const hasRun = Boolean(input.run);
  const hardTrainingBlocked = input.status === "Recovery" || Boolean(input.recovery);
  const hasConditioning = !hardTrainingBlocked && input.classification.hasConditioning;
  const hasPlyometricsOrSprints = !hardTrainingBlocked && input.classification.hasPlyometricsOrSprints;
  const overloadFlags: string[] = [];
  if (hasLift && hasRun) overloadFlags.push("lift + run combined session");
  if (hasRun && input.classification.hasLowerBody) overloadFlags.push("high lower-body stress from lower body + run");
  if (hasConditioning || hasPlyometricsOrSprints) overloadFlags.push("sprint/plyometric/conditioning stress present");
  if (input.estimatedDurationMinutes > 90) overloadFlags.push("duration >90 min");
  const modalityCount = [hasLift, hasRun, Boolean(input.mobility), Boolean(input.recovery)].filter(Boolean).length;
  const hasLowerBodyTraining = !hardTrainingBlocked && input.classification.hasLowerBody;
  const lowerBodyStress = hasRun && hasLowerBodyTraining ? "High" : hasLowerBodyTraining ? "Moderate" : hasRun ? "Low" : "None";
  const sessionStress = input.status === "Recovery" ? "Recovery" : overloadFlags.some((flag) => /lower-body|>90/.test(flag)) ? "High" : overloadFlags.length ? "Moderate" : "Low";
  return { estimatedDurationMinutes: input.estimatedDurationMinutes, modalityCount, hasLift, hasRun, hasConditioning, hasPlyometricsOrSprints, lowerBodyStress, sessionStress, overloadFlags };
}

function completionStatus(input: BuildDailyTrainingSessionInput, workout: DailyWorkoutPrescription | null, run: DailyRunPrescription | null): DailyTrainingSession["summary"]["completionStatus"] {
  const liftDone = !workout || (input.completedWorkoutSessions ?? []).some((session) => session.workoutId === workout.sourceWorkoutId && session.status === "completed" && (session.endedAt ?? session.startedAt).slice(0, 10) === input.date);
  const runDone = !run || (input.completedRunLogs ?? []).some((entry) => entry.date === input.date && entry.completed);
  if (!workout && !run) return "Not Scheduled";
  if (liftDone && runDone) return "Completed";
  if ((workout && liftDone) || (run && runDone)) return "Partially Completed";
  return "Not Started";
}

function buildGoals(input: BuildDailyTrainingSessionInput, status: DailyTrainingStatus, workout: DailyWorkoutPrescription | null, run: DailyRunPrescription | null, recovery: DailyRecoveryPrescription | null): DailyTrainingGoal[] {
  const goals: DailyTrainingGoal[] = [];
  if (status === "Recovery") goals.push({ label: input.readinessResult.recommendation || recovery?.reason || "Prioritize recovery", priority: "Safety", source: "Readiness Engine" });
  if (workout) goals.push({ label: `Complete ${workout.title}`, priority: "Training", source: "Workout Engine" });
  if (run) goals.push({ label: `Complete ${run.title}`, priority: "Training", source: "Running Engine" });
  if (recovery) goals.push({ label: "Complete recovery mobility/walk", priority: "Recovery", source: "Training Planner" });
  goals.push({ label: "Hit protein goal", priority: "Nutrition", source: "Nutrition Engine" });
  if (input.goalTrackingResult.overallStatus !== "On Track") goals.push({ label: `Protect ${input.goalTrackingResult.priorityGoal.replace("_", " ")} goal status`, priority: "Goals", source: "Goal Tracking Engine" });
  goals.push({ label: "Sleep target tonight", priority: "Recovery", source: "Readiness Engine" });
  return goals.filter((goal, index, list) => list.findIndex((candidate) => candidate.label === goal.label) === index).slice(0, 5);
}

export function buildDailyTrainingSession(input: BuildDailyTrainingSessionInput): DailyTrainingSession {
  const auditTrail: DailyTrainingAuditEntry[] = [];
  const dayIndex = planDayIndex(input.date);
  addAudit(auditTrail, "dayIndex", `${input.date} resolved to dayIndex ${dayIndex}.`);
  const sourceWorkout = input.workouts.find((workout) => workout.week === input.currentWeek && workout.dayIndex === dayIndex);
  if (sourceWorkout) addAudit(auditTrail, "source workout", `Selected source workout ${sourceWorkout.id}: ${sourceWorkout.title} (${sourceWorkout.type}).`);
  else addAudit(auditTrail, "source workout", `No workout found for week ${input.currentWeek}, dayIndex ${dayIndex}; returning safe unavailable rest session.`);

  const classification = classifyWorkout(sourceWorkout);
  addAudit(auditTrail, "classification", `Primary session ${classification.primarySession.dayType}: ${classification.primarySession.primaryStimulus}. Allowed blocks=${classification.primarySession.allowedBlocks.join(", ")}; forbidden blocks=${classification.primarySession.forbiddenBlocks.join(", ") || "none"}. Parsed lift=${classification.liftExercises.length > 0}, run=${classification.runExercises.length > 0 || Boolean(sourceWorkout?.longRunMiles)}, mobility=${classification.mobilityExercises.length > 0}, recovery=${classification.isRecoveryDay}, conditioning=${classification.hasConditioning}.`);

  const resultConfidence = confidence(input);
  const recoveryOverride = input.readinessResult.status === "Red" || input.progressionResult.weeklyDecision === "Recovery Focus";
  const modified = input.readinessResult.status === "Yellow" && !recoveryOverride;
  const modifications: DailyTrainingModification[] = [];
  if (input.readinessResult.status === "Red") modifications.push({ source: "Readiness Engine", reason: "Red readiness", action: "Replace hard training with recovery session." });
  if (input.progressionResult.weeklyDecision === "Recovery Focus") modifications.push({ source: "Progression Engine", reason: "Recovery Focus progression decision", action: "Replace planned hard training with recovery session." });
  if (modified) modifications.push({ source: "Readiness Engine", reason: "Yellow readiness", action: "Mark session modified once and reduce intensity/volume guidance." });
  addAudit(auditTrail, "readiness/progression", `Readiness ${input.readinessResult.status}; weekly decision ${input.progressionResult.weeklyDecision}; recoveryOverride=${recoveryOverride}; modified=${modified}.`, input.readinessResult.status === "Red" ? "Readiness Engine" : "Training Planner");

  const workout = sourceWorkout && !recoveryOverride ? buildWorkoutPrescription(sourceWorkout, classification, modified, input.date) : null;
  const run = sourceWorkout && !recoveryOverride ? buildRunPrescription(sourceWorkout, classification, input) : null;
  if (run) addAudit(auditTrail, "run prescription", `Run parsed as ${run.prescriptionMode}: distance=${run.distanceMiles ?? "none"}, duration=${run.durationMinutes ?? "none"}.`, "Running Engine");
  else addAudit(auditTrail, "run prescription", "No valid run prescription parsed for this date.", "Running Engine");

  const mobility = sourceWorkout && !recoveryOverride ? buildMobilityPrescription(sourceWorkout, classification) : null;
  const recovery = recoveryOverride ? buildRecoveryPrescription(input.readinessResult.status === "Red" ? "Red readiness blocks hard training today." : "Progression decision is Recovery Focus.") : null;
  const support = !recoveryOverride ? buildSupport(sourceWorkout, classification) : [];
  const deload = Boolean(sourceWorkout?.deload) || /(?:^|\s)Deload:/i.test(sourceWorkout?.notes ?? "");
  const missingSourceRest = !sourceWorkout;
  const recoveryDayRest = Boolean(sourceWorkout && classification.isRecoveryDay && !workout && !run && !recoveryOverride);
  const status: DailyTrainingStatus = recoveryOverride ? "Recovery" : modified ? "Modified" : missingSourceRest || recoveryDayRest || (!workout && !run && !mobility) ? "Rest" : "Normal";
  const sessionType: PrimarySessionType = recovery ? "RecoveryDay" : classification.primarySession.dayType;

  const { blocks, warmup, cooldown } = buildBlocks({ date: input.date, sourceWorkout, classification, workout, run, mobility, recovery, includeWarmup: input.userPreferences?.includeWarmup !== false, includeCooldown: input.userPreferences?.includeCooldown !== false });
  const estimatedDurationMinutes = blocks.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const combinedLoad = buildCombinedLoad({ status, workout, run, mobility, recovery, classification, estimatedDurationMinutes });
  addAudit(auditTrail, "combined load", `Combined load: stress=${combinedLoad.sessionStress}; flags=${combinedLoad.overloadFlags.join("; ") || "none"}.`);

  const warnings: DailyTrainingWarning[] = [];
  if (input.readinessResult.status === "Red") warnings.push({ message: "Red readiness: hard training blocked today.", source: "Readiness Engine", severity: "critical" });
  if (modified) warnings.push({ message: "Yellow readiness: reduce volume and keep intensity controlled.", source: "Readiness Engine", severity: "warning" });
  if (input.progressionResult.weeklyDecision === "Recovery Focus") warnings.push({ message: "Progression decision is Recovery Focus; today becomes recovery work.", source: "Progression Engine", severity: "critical" });
  for (const flag of combinedLoad.overloadFlags) warnings.push({ message: flag, source: "Training Planner", severity: /lower-body|>90/.test(flag) ? "warning" : "info" });
  for (const warning of input.progressionResult.warnings ?? []) warnings.push({ message: warning, source: /injury/i.test(warning) ? "Running Engine" : "Progression Engine", severity: /injury|pain|risk/i.test(warning) ? "critical" : "warning" });
  for (const warning of input.goalTrackingResult.warnings ?? []) warnings.push({ message: warning, source: "Goal Tracking Engine", severity: "warning" });

  const title = recovery ? recovery.title : workout && run ? `${workout.title} + ${run.title}` : workout?.title ?? run?.title ?? mobility?.title ?? (missingSourceRest ? "Training Unavailable — Rest" : "Rest Day");
  const primaryAction = recovery ? "Recover" : workout ? "Start lift" : run ? "Start run" : mobility ? "Do mobility" : "Rest";
  const todayGoals = buildGoals(input, status, workout, run, recovery);

  return {
    id: `daily-training-${input.date}`,
    date: input.date,
    currentWeek: input.currentWeek,
    dayIndex,
    sourcePlan: {
      source: "seed-workouts-v1",
      sourceWorkoutId: sourceWorkout?.id,
      sourceWorkoutTitle: sourceWorkout?.title,
      sourceWorkoutType: sourceWorkout?.type,
      sourceWorkoutDeload: deload || undefined,
      resolvedSessionType: sessionType,
    },
    sessionType,
    metadata: {
      deload,
    },
    status,
    readinessStatus: input.readinessResult.status,
    confidence: resultConfidence,
    summary: {
      title,
      primaryAction,
      workoutName: workout?.title ?? null,
      runName: run?.title ?? null,
      estimatedDurationMinutes,
      completionStatus: completionStatus(input, workout, run),
    },
    blocks,
    workout,
    run,
    mobility,
    recovery,
    support,
    warmup,
    cooldown,
    estimatedDurationMinutes,
    combinedLoad,
    modifications,
    warnings,
    todayGoals,
    auditTrail,
  };
}

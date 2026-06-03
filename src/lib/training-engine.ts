import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { Workout } from "./types";

export type TrainingBlockKind = "warmup" | "workout" | "run" | "cooldown" | "mobility" | "walk";
export type TrainingStatus = "Normal" | "Modified" | "Recovery" | "Rest";
export type TrainingConfidence = "High" | "Medium" | "Low";
export type TrainingWarningSeverity = "info" | "warning" | "critical";
export type TrainingPrioritySource = "Training Engine" | "Readiness Engine" | "Progression Engine" | "Goal Tracking Engine" | "Nutrition Engine" | "Running Engine" | "Workout Engine";

export interface TrainingRunPrescription {
  type: string;
  title?: string;
  distanceMiles: number;
  notes?: string;
  estimatedMinutes?: number;
}

export interface TrainingEngineInput {
  currentDate: string;
  trainingPlan: unknown;
  selectedWeek: number;
  selectedDay: number;
  readinessResult: ReadinessEngineResult;
  progressionResult: ProgressionEngineResult;
  goalTrackingResult: GoalTrackingEngineResult;
  scheduledWorkout?: Workout | null;
  scheduledRun?: TrainingRunPrescription | null;
  availableMinutes?: number | null;
  userPreferences?: {
    includeWarmup?: boolean;
    includeCooldown?: boolean;
    preferredOrder?: Array<"workout" | "run">;
  } | null;
}

export interface TrainingBlock {
  kind: TrainingBlockKind;
  title: string;
  description: string;
  items: string[];
  estimatedMinutes: number;
  source: TrainingPrioritySource;
}

export interface TrainingPriority {
  label: string;
  source: TrainingPrioritySource;
  priority: "Safety" | "Recovery" | "Training" | "Goals" | "Nutrition";
}

export interface TrainingWarning {
  message: string;
  source: TrainingPrioritySource;
  severity: TrainingWarningSeverity;
}

export interface TrainingDurationEstimate {
  warmupMinutes: number;
  workoutMinutes: number;
  runMinutes: number;
  cooldownMinutes: number;
  mobilityMinutes: number;
  walkMinutes: number;
  totalEstimatedMinutes: number;
}

export interface TrainingEngineResult {
  todayPlan: TrainingBlock[];
  warmup: TrainingBlock | null;
  workout: TrainingBlock | null;
  run: TrainingBlock | null;
  cooldown: TrainingBlock | null;
  sessionOrder: TrainingBlockKind[];
  estimatedDuration: TrainingDurationEstimate;
  priorityActions: TrainingPriority[];
  warnings: TrainingWarning[];
  trainingStatus: TrainingStatus;
  confidence: TrainingConfidence;
  auditTrail: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const hasLift = (workout?: Workout | null) => Boolean(workout?.exercises?.some((exercise) => !/run|jog|walk|sprint|interval/i.test(exercise.name)));
const round = (value: number) => Math.round(value);

function runDistance(input: TrainingEngineInput): number {
  if (input.scheduledRun?.distanceMiles && input.scheduledRun.distanceMiles > 0) return input.scheduledRun.distanceMiles;
  if (input.scheduledWorkout?.longRunMiles && input.scheduledWorkout.longRunMiles > 0) return input.scheduledWorkout.longRunMiles;
  return 0;
}

function runType(input: TrainingEngineInput): string {
  return input.scheduledRun?.type ?? (input.scheduledWorkout?.longRunMiles ? "long" : "easy");
}

function estimateWorkoutMinutes(workout?: Workout | null, modified = false): number {
  if (!hasLift(workout)) return 0;
  const liftExercises = workout?.exercises.filter((exercise) => !/run|jog|walk|sprint|interval/i.test(exercise.name)) ?? [];
  const base = clamp(30 + liftExercises.reduce((sum, exercise) => sum + exercise.prescribedSets * 4, 0), 45, 75);
  return modified ? round(base * 0.75) : base;
}

function estimateRunMinutes(distanceMiles: number, type: string, modified = false): number {
  if (distanceMiles <= 0) return 0;
  const minutesPerMile = /long/i.test(type) ? 11 : /interval|tempo/i.test(type) ? 10 : 10;
  const base = clamp(round(distanceMiles * minutesPerMile), 20, 90);
  return modified ? Math.max(20, round(base * 0.75)) : base;
}

function confidence(input: TrainingEngineInput): TrainingConfidence {
  const values = [input.readinessResult.confidence, input.progressionResult.confidence, input.goalTrackingResult.confidence];
  if (values.includes("Low") || input.progressionResult.dataQuality.score < 60 || input.goalTrackingResult.dataQualityScore < 60) return "Low";
  if (values.includes("Medium") || input.progressionResult.dataQuality.score < 80 || input.goalTrackingResult.dataQualityScore < 75) return "Medium";
  return "High";
}

function addUniquePriority(priorities: TrainingPriority[], priority: TrainingPriority) {
  if (!priorities.some((item) => item.label === priority.label)) priorities.push(priority);
}

function buildWarnings(input: TrainingEngineInput, resultConfidence: TrainingConfidence, recoveryOverride: boolean): TrainingWarning[] {
  const warnings: TrainingWarning[] = [];
  if (input.readinessResult.status === "Red") warnings.push({ message: "Red readiness: hard training blocked today.", source: "Readiness Engine", severity: "critical" });
  if (input.readinessResult.status === "Yellow") warnings.push({ message: "Yellow readiness: reduce volume and keep intensity controlled.", source: "Readiness Engine", severity: "warning" });
  if (recoveryOverride) warnings.push({ message: "Progression decision is Recovery Focus; today becomes recovery work.", source: "Progression Engine", severity: "critical" });
  const progressionWarnings = input.progressionResult.warnings ?? [];
  for (const warning of progressionWarnings) {
    warnings.push({ message: warning, source: /injury/i.test(warning) ? "Running Engine" : "Progression Engine", severity: /injury|risk|pain/i.test(warning) ? "critical" : "warning" });
  }
  for (const warning of input.goalTrackingResult.warnings ?? []) warnings.push({ message: warning, source: "Goal Tracking Engine", severity: "warning" });
  for (const warning of input.readinessResult.dataQualityWarnings ?? []) warnings.push({ message: warning, source: "Readiness Engine", severity: "warning" });
  for (const warning of input.progressionResult.dataQuality.warnings ?? []) warnings.push({ message: warning, source: "Progression Engine", severity: "warning" });
  for (const missing of input.progressionResult.dataQuality.missingInputs ?? []) warnings.push({ message: humanizeMissingInput(missing), source: "Progression Engine", severity: "warning" });
  if (resultConfidence === "Low") warnings.push({ message: "Low confidence: missing or limited training data for today’s prescription.", source: "Training Engine", severity: "warning" });
  return warnings;
}

function humanizeMissingInput(value: string) {
  if (/runningResult/i.test(value)) return "Need at least 2 recent runs";
  if (/workoutResult/i.test(value)) return "Need more completed workouts";
  if (/nutritionResult/i.test(value)) return "Need more meal logs";
  return value;
}

function buildRecoveryResult(input: TrainingEngineInput, resultConfidence: TrainingConfidence, recoveryOverride: boolean): TrainingEngineResult {
  const warmup: TrainingBlock = { kind: "warmup", title: "Recovery Warmup", description: "Easy preparation only — no hard training today.", items: ["5 minutes easy walk", "Gentle breathing reset"], estimatedMinutes: 6, source: "Training Engine" };
  const mobility: TrainingBlock = { kind: "mobility", title: "Mobility", description: "Pain-free mobility and tissue prep.", items: ["Hips, ankles, T-spine, shoulders", "Move slowly and stop before pain"], estimatedMinutes: 12, source: "Training Engine" };
  const walk: TrainingBlock = { kind: "walk", title: "Recovery Walk", description: "Zone 1 walk only.", items: ["20–30 minutes conversational walking", "Nasal-breathing easy pace"], estimatedMinutes: 25, source: "Training Engine" };
  const cooldown: TrainingBlock = { kind: "cooldown", title: "Recovery Cooldown", description: "Downshift and prepare to recover.", items: ["5 minutes breathing", "Hydrate", "Sleep target tonight"], estimatedMinutes: 7, source: "Training Engine" };
  const todayPlan = [warmup, mobility, walk, cooldown];
  const estimatedDuration = { warmupMinutes: 6, workoutMinutes: 0, runMinutes: 0, cooldownMinutes: 7, mobilityMinutes: 12, walkMinutes: 25, totalEstimatedMinutes: 50 };
  return {
    todayPlan,
    warmup,
    workout: null,
    run: null,
    cooldown,
    sessionOrder: todayPlan.map((block) => block.kind),
    estimatedDuration,
    priorityActions: buildPriorities(input, null, null, "Recovery"),
    warnings: buildWarnings(input, resultConfidence, recoveryOverride),
    trainingStatus: "Recovery",
    confidence: resultConfidence,
    auditTrail: ["Training Engine selected recovery day from readiness/progression inputs.", "No canonical engine decisions were recalculated."],
  };
}

function buildPriorities(input: TrainingEngineInput, workoutBlock: TrainingBlock | null, runBlock: TrainingBlock | null, status: TrainingStatus): TrainingPriority[] {
  const priorities: TrainingPriority[] = [];
  if (input.readinessResult.status === "Red") addUniquePriority(priorities, { label: input.readinessResult.recommendation || "Block hard training and prioritize safety", priority: "Safety", source: "Readiness Engine" });
  if (status === "Recovery") addUniquePriority(priorities, { label: "Complete recovery walk", priority: "Recovery", source: "Training Engine" });
  if (input.readinessResult.status !== "Green") addUniquePriority(priorities, { label: input.readinessResult.recoveryGuidance[0] ?? "Protect recovery today", priority: "Recovery", source: "Readiness Engine" });
  if (runBlock?.title && /long/i.test(runBlock.title)) addUniquePriority(priorities, { label: "Complete long run", priority: "Training", source: "Training Engine" });
  else if (workoutBlock?.title) addUniquePriority(priorities, { label: `Complete ${workoutBlock.title}`, priority: "Training", source: "Training Engine" });
  if (runBlock && !/long/i.test(runBlock.title)) addUniquePriority(priorities, { label: `Complete ${runBlock.title}`, priority: "Training", source: "Training Engine" });
  if (input.goalTrackingResult.overallStatus !== "On Track") addUniquePriority(priorities, { label: `Protect ${input.goalTrackingResult.priorityGoal.replace("_", " ")} goal status`, priority: "Goals", source: "Goal Tracking Engine" });
  addUniquePriority(priorities, { label: "Hit protein goal", priority: "Nutrition", source: "Nutrition Engine" });
  if (input.progressionResult.weeklyDecision !== "Progress") addUniquePriority(priorities, { label: `Respect weekly decision: ${input.progressionResult.weeklyDecision}`, priority: "Goals", source: "Progression Engine" });
  addUniquePriority(priorities, { label: "Hydration target", priority: "Nutrition", source: "Nutrition Engine" });
  addUniquePriority(priorities, { label: "Sleep target tonight", priority: "Recovery", source: "Readiness Engine" });
  return priorities.slice(0, 5);
}

export function evaluateTraining(input: TrainingEngineInput): TrainingEngineResult {
  const resultConfidence = confidence(input);
  const recoveryOverride = input.progressionResult.weeklyDecision === "Recovery Focus";
  if (input.readinessResult.status === "Red" || recoveryOverride) return buildRecoveryResult(input, resultConfidence, recoveryOverride);

  const modified = input.readinessResult.status === "Yellow";
  const scheduledLift = hasLift(input.scheduledWorkout);
  const distance = runDistance(input);
  const type = runType(input);
  const runScheduled = distance > 0;
  const warmupMinutes = input.userPreferences?.includeWarmup === false ? 0 : 8;
  const cooldownMinutes = input.userPreferences?.includeCooldown === false ? 0 : 7;
  const workoutMinutes = estimateWorkoutMinutes(input.scheduledWorkout, modified);
  const runMinutes = estimateRunMinutes(distance, type, modified);

  const warmup: TrainingBlock | null = warmupMinutes ? {
    kind: "warmup",
    title: "Warmup",
    description: "Prepare for today’s prescribed training.",
    items: ["5 minutes easy cardio or brisk walk", "Dynamic mobility for hips, ankles, shoulders, and T-spine", ...(scheduledLift ? ["Ramp-up sets before first lift"] : []), ...(runScheduled ? ["Easy jog/walk before the run"] : [])],
    estimatedMinutes: warmupMinutes,
    source: "Training Engine",
  } : null;
  const workoutBlock: TrainingBlock | null = scheduledLift && input.scheduledWorkout ? {
    kind: "workout",
    title: input.scheduledWorkout.title,
    description: modified ? "Lift with reduced volume from Yellow readiness." : "Execute the scheduled lift.",
    items: input.scheduledWorkout.exercises.filter((exercise) => !/run|jog|walk|sprint|interval/i.test(exercise.name)).map((exercise) => `${exercise.order}. ${exercise.name}: ${exercise.prescribedSets} x ${exercise.prescribedReps}${modified ? " (reduce 1 set if needed)" : ""}`),
    estimatedMinutes: workoutMinutes,
    source: "Workout Engine",
  } : null;
  const runBlock: TrainingBlock | null = runScheduled ? {
    kind: "run",
    title: input.scheduledRun?.title ?? (/long/i.test(type) ? `Long Run — ${distance} mi` : `Run — ${distance} mi`),
    description: modified ? "Run with reduced volume from Yellow readiness." : "Execute and log today’s run.",
    items: [`Planned distance: ${distance} mi`, "Stay conversational unless prescribed otherwise", "Log distance, duration, RPE, pain, and notes"],
    estimatedMinutes: runMinutes,
    source: "Running Engine",
  } : null;
  const cooldown: TrainingBlock | null = cooldownMinutes ? {
    kind: "cooldown",
    title: "Cooldown",
    description: "Downshift after training before closing the session.",
    items: ["5 minutes easy walk", "Breathing cooldown", "Light stretching/mobility", "Post-session notes"],
    estimatedMinutes: cooldownMinutes,
    source: "Training Engine",
  } : null;

  const todayPlan = [warmup, workoutBlock, runBlock, cooldown].filter((block): block is TrainingBlock => Boolean(block));
  const estimatedDuration: TrainingDurationEstimate = {
    warmupMinutes,
    workoutMinutes,
    runMinutes,
    cooldownMinutes,
    mobilityMinutes: 0,
    walkMinutes: 0,
    totalEstimatedMinutes: warmupMinutes + workoutMinutes + runMinutes + cooldownMinutes,
  };
  const trainingStatus: TrainingStatus = modified ? "Modified" : todayPlan.some((block) => block.kind === "workout" || block.kind === "run") ? "Normal" : "Rest";
  return {
    todayPlan,
    warmup,
    workout: workoutBlock,
    run: runBlock,
    cooldown,
    sessionOrder: todayPlan.map((block) => block.kind),
    estimatedDuration,
    priorityActions: buildPriorities(input, workoutBlock, runBlock, trainingStatus),
    warnings: buildWarnings(input, resultConfidence, false),
    trainingStatus,
    confidence: resultConfidence,
    auditTrail: ["Training Engine composed session order, warmup, cooldown, duration, priorities, and warnings.", "Readiness, progression, and goal status were consumed as inputs, not recalculated."],
  };
}

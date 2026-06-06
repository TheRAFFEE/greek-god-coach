import { runPlannerShadowComparison, type PlannerShadowComparableOutput, type PlannerShadowResult } from "./planner-shadow-mode";
import type { DailyTrainingSession } from "./training-planner";
import type { TrainingEngineResult } from "./training-engine";

export interface PlannerDebugActivationInput {
  queryDebugPlanner?: boolean;
  localStoragePlannerDebug?: boolean;
  developerToggle?: boolean;
}

export interface PlannerShadowObservabilityRuntimeOutput {
  homeOutput?: unknown;
  trainOutput?: unknown;
  logOutput?: unknown;
  recommendations?: unknown;
  runtimeState?: unknown;
}

export interface PlannerShadowObservabilityInput {
  debug: PlannerDebugActivationInput;
  plannerSession: DailyTrainingSession;
  legacy: PlannerShadowComparableOutput;
  timestamp?: string;
  runtimeOutputs?: PlannerShadowObservabilityRuntimeOutput;
}

export interface PlannerShadowObservabilityRow {
  label:
    | "Legacy Session Type"
    | "Planner Session Type"
    | "Match"
    | "Legacy Workout"
    | "Planner Workout"
    | "Legacy Run"
    | "Planner Run"
    | "Mismatch Count"
    | "Critical Count"
    | "Warning Count"
    | "Timestamp";
  value: string;
}

export interface PlannerShadowObservabilityPanel {
  visible: boolean;
  developerOnly: true;
  readOnly: true;
  title: "Planner Shadow Comparison";
  rows: PlannerShadowObservabilityRow[];
  comparison: PlannerShadowResult | null;
}

export function isPlannerDebugEnabled(input: PlannerDebugActivationInput): boolean {
  return input.queryDebugPlanner === true || input.developerToggle === true;
}

function inferLegacySessionType(training: TrainingEngineResult): PlannerShadowComparableOutput["sessionType"] {
  if (/Recovery/i.test(training.trainingStatus) || training.sessionOrder.includes("walk")) return "RecoveryDay";
  if (training.run?.title && /race/i.test(training.run.title)) return "RaceDay";
  if (training.run?.title && /long/i.test(training.run.title)) return "LongRunDay";
  if (training.run) return "RunDay";
  if (training.workout?.title && /deload/i.test(training.workout.title)) return "DeloadDay";
  if (training.workout) return "LiftDay";
  if (training.sessionOrder.includes("mobility")) return "MobilityDay";
  return "UnavailableDay";
}

function inferLegacyStress(training: TrainingEngineResult): PlannerShadowComparableOutput["sessionStress"] {
  if (/Recovery/i.test(training.trainingStatus)) return "Recovery";
  if (training.estimatedDuration.totalEstimatedMinutes >= 75 || training.warnings.some((warning) => warning.severity === "critical")) return "High";
  if (training.estimatedDuration.totalEstimatedMinutes >= 40 || training.workout || training.run) return "Moderate";
  return "Low";
}

export function toLegacyComparableFromTrainingEngine(training: TrainingEngineResult): PlannerShadowComparableOutput {
  return {
    sessionType: inferLegacySessionType(training),
    workoutTitle: training.workout?.title ?? null,
    runTitle: training.run?.title ?? null,
    hasRunLoggingTarget: Boolean(training.run),
    hasWorkoutLoggingTarget: Boolean(training.workout),
    estimatedDurationMinutes: training.estimatedDuration.totalEstimatedMinutes,
    sessionStress: inferLegacyStress(training),
    recoveryOverrideActive: training.trainingStatus === "Recovery",
  };
}

function text(value: string | number | boolean | null): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function rowsFromComparison(comparison: PlannerShadowResult, timestamp: string): PlannerShadowObservabilityRow[] {
  return [
    { label: "Legacy Session Type", value: comparison.legacy.sessionType },
    { label: "Planner Session Type", value: comparison.planner.sessionType },
    { label: "Match", value: comparison.match ? "Yes" : "No" },
    { label: "Legacy Workout", value: text(comparison.legacy.workoutTitle) },
    { label: "Planner Workout", value: text(comparison.planner.workoutTitle) },
    { label: "Legacy Run", value: text(comparison.legacy.runTitle) },
    { label: "Planner Run", value: text(comparison.planner.runTitle) },
    { label: "Mismatch Count", value: String(comparison.mismatches.length) },
    { label: "Critical Count", value: String(comparison.criticalCount) },
    { label: "Warning Count", value: String(comparison.warningCount) },
    { label: "Timestamp", value: timestamp },
  ];
}

export function buildPlannerShadowObservabilityPanel(input: PlannerShadowObservabilityInput): PlannerShadowObservabilityPanel {
  if (!isPlannerDebugEnabled(input.debug)) {
    return {
      visible: false,
      developerOnly: true,
      readOnly: true,
      title: "Planner Shadow Comparison",
      rows: [],
      comparison: null,
    };
  }

  const timestamp = input.timestamp ?? new Date().toISOString();
  const comparison = runPlannerShadowComparison({
    plannerSession: input.plannerSession,
    legacy: input.legacy,
    runtimeGuards: {
      state: input.runtimeOutputs?.runtimeState,
      logs: input.runtimeOutputs?.runtimeState,
      recommendations: input.runtimeOutputs?.recommendations,
      homeOutput: input.runtimeOutputs?.homeOutput,
      trainOutput: input.runtimeOutputs?.trainOutput,
      logOutput: input.runtimeOutputs?.logOutput,
    },
  });

  return {
    visible: true,
    developerOnly: true,
    readOnly: true,
    title: "Planner Shadow Comparison",
    rows: rowsFromComparison(comparison, timestamp),
    comparison,
  };
}

export function renderPlannerShadowPanelText(panel: PlannerShadowObservabilityPanel): string {
  if (!panel.visible) return "";
  return [panel.title, ...panel.rows.map((row) => `${row.label}: ${row.value}`)].join("\n");
}

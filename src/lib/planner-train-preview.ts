import type { DailyTrainingBlock, DailyTrainingSession } from "./training-planner";
import { isPlannerDebugEnabled, type PlannerDebugActivationInput } from "./planner-shadow-observability";

export type PlannerTrainPreviewSessionType = "LiftDay" | "RunDay" | "LongRunDay" | "RecoveryDay" | "MobilityDay" | "RaceDay" | "DeloadDay" | "HybridDay" | "UnavailableDay";

export interface PlannerTrainPreviewRuntimeGuards {
  state?: unknown;
  logs?: unknown;
  recommendations?: unknown;
  readiness?: unknown;
  progression?: unknown;
  homeOutput?: unknown;
  trainOutput?: unknown;
  logOutput?: unknown;
}

export interface PlannerTrainPreview {
  sessionType: PlannerTrainPreviewSessionType;
  primarySession: PlannerTrainPreviewSessionType;
  allowedBlocks: string[];
  workoutTarget: string;
  runTarget: string;
  conditioningTarget: string;
  mobilityTarget: string;
  coreTarget: string;
  deload: boolean;
  estimatedDuration: string;
  stressRating: DailyTrainingSession["combinedLoad"]["sessionStress"];
  warnings: string[];
  confidence: DailyTrainingSession["confidence"];
  runLogging: "Required" | "None";
  liftLogging: "Required" | "None";
  timestamp: string;
}

export interface PlannerTrainPreviewPanel {
  visible: boolean;
  developerOnly: true;
  readOnly: true;
  advisoryOnly: true;
  title: "Planner Train Preview";
  preview: PlannerTrainPreview | null;
  rows: Array<{ label: string; value: string }>;
  runtimeMutationAttempted: boolean;
  affectsHome: false;
  affectsTrain: false;
  affectsLog: false;
  affectsLogs: false;
  affectsRecommendations: false;
  affectsProgression: false;
  affectsReadiness: false;
}

export interface BuildPlannerTrainPreviewPanelInput {
  debug: PlannerDebugActivationInput;
  plannerSession: DailyTrainingSession;
  timestamp?: string;
  runtimeGuards?: PlannerTrainPreviewRuntimeGuards;
}

const NONE = "None";

function fingerprint(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function titleCaseBlock(kind: DailyTrainingBlock["kind"]): string {
  if (kind === "lift") return "Lift";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function inferSessionType(session: DailyTrainingSession): PlannerTrainPreviewSessionType {
  if (["LiftDay", "RunDay", "LongRunDay", "RecoveryDay", "MobilityDay", "RaceDay", "DeloadDay", "HybridDay", "UnavailableDay"].includes(session.sessionType)) return session.sessionType as PlannerTrainPreviewSessionType;
  if (/race/i.test(session.sourcePlan.sourceWorkoutTitle ?? "") || session.run?.type === "race") return "RaceDay";
  if (/recovery/i.test(`${session.sourcePlan.sourceWorkoutTitle ?? ""} ${session.sourcePlan.sourceWorkoutType ?? ""}`) || session.recovery || session.status === "Recovery" || session.blocks.some((block) => block.kind === "recovery" || block.kind === "walk")) return "RecoveryDay";
  if (session.run?.type === "long") return "LongRunDay";
  if (session.run && session.workout) return "HybridDay";
  if (session.run) return "RunDay";
  if (session.workout) return "LiftDay";
  if (session.mobility) return "MobilityDay";
  return "UnavailableDay";
}

function formatRunTarget(session: DailyTrainingSession): string {
  const run = session.run;
  if (!run) return NONE;
  const prescription = run.prescriptionMode === "duration"
    ? `${run.durationMinutes ?? run.estimatedMinutes} min`
    : run.prescriptionMode === "distance" && run.distanceMiles !== null
      ? `${run.distanceMiles} mi`
      : `${run.estimatedMinutes} min`;
  return `${prescription} ${run.title}`;
}

function formatConditioningTarget(session: DailyTrainingSession): string {
  const block = session.blocks.find((item) => item.kind === "conditioning");
  if (!block) return NONE;
  return block.items.length ? `${block.title}: ${block.items.join(", ")}` : block.title;
}

function formatMobilityTarget(session: DailyTrainingSession): string {
  if (session.mobility) return `${session.mobility.title}: ${session.mobility.items.join(", ")}`;
  const block = session.blocks.find((item) => item.kind === "mobility");
  if (!block) return NONE;
  return block.items.length ? `${block.title}: ${block.items.join(", ")}` : block.title;
}

function formatCoreTarget(session: DailyTrainingSession): string {
  const core = session.support.find((item) => item.kind === "Core");
  if (!core) return NONE;
  return core.items.length ? `${core.title}: ${core.items.join(", ")}` : core.title;
}

function rowsFromPreview(preview: PlannerTrainPreview): PlannerTrainPreviewPanel["rows"] {
  return [
    { label: "Session Type", value: preview.sessionType },
    { label: "Primary Session", value: preview.primarySession },
    { label: "Allowed Blocks", value: preview.allowedBlocks.join(", ") || NONE },
    { label: "Workout Target", value: preview.workoutTarget },
    { label: "Run Target", value: preview.runTarget },
    { label: "Conditioning Target", value: preview.conditioningTarget },
    { label: "Mobility Target", value: preview.mobilityTarget },
    { label: "Core Target", value: preview.coreTarget },
    { label: "Deload", value: String(preview.deload) },
    { label: "Run Logging", value: preview.runLogging },
    { label: "Lift Logging", value: preview.liftLogging },
    { label: "Estimated Duration", value: preview.estimatedDuration },
    { label: "Stress Rating", value: preview.stressRating },
    { label: "Warnings", value: preview.warnings.length ? preview.warnings.join(" | ") : NONE },
    { label: "Confidence", value: preview.confidence },
    { label: "Timestamp", value: preview.timestamp },
  ];
}

function hiddenPanel(runtimeMutationAttempted = false): PlannerTrainPreviewPanel {
  return {
    visible: false,
    developerOnly: true,
    readOnly: true,
    advisoryOnly: true,
    title: "Planner Train Preview",
    preview: null,
    rows: [],
    runtimeMutationAttempted,
    affectsHome: false,
    affectsTrain: false,
    affectsLog: false,
    affectsLogs: false,
    affectsRecommendations: false,
    affectsProgression: false,
    affectsReadiness: false,
  };
}

export function buildPlannerTrainPreview(session: DailyTrainingSession, timestamp = new Date().toISOString()): PlannerTrainPreview {
  const sessionType = inferSessionType(session);
  const stressRating = sessionType === "RecoveryDay" ? "Recovery" : session.combinedLoad.sessionStress;
  return {
    sessionType,
    primarySession: sessionType,
    allowedBlocks: session.blocks.map((block) => titleCaseBlock(block.kind)),
    workoutTarget: session.workout?.title ?? NONE,
    runTarget: formatRunTarget(session),
    conditioningTarget: formatConditioningTarget(session),
    mobilityTarget: formatMobilityTarget(session),
    coreTarget: formatCoreTarget(session),
    deload: session.metadata.deload,
    estimatedDuration: `${session.estimatedDurationMinutes} min`,
    stressRating,
    warnings: session.warnings.map((warning) => warning.message),
    confidence: session.confidence,
    runLogging: session.run?.loggingTarget ? "Required" : "None",
    liftLogging: session.workout?.loggingTarget ? "Required" : "None",
    timestamp,
  };
}

export function buildPlannerTrainPreviewPanel(input: BuildPlannerTrainPreviewPanelInput): PlannerTrainPreviewPanel {
  const before = fingerprint(input.runtimeGuards);
  if (!isPlannerDebugEnabled(input.debug)) return hiddenPanel(fingerprint(input.runtimeGuards) !== before);

  const preview = buildPlannerTrainPreview(input.plannerSession, input.timestamp ?? new Date().toISOString());
  const after = fingerprint(input.runtimeGuards);
  return {
    visible: true,
    developerOnly: true,
    readOnly: true,
    advisoryOnly: true,
    title: "Planner Train Preview",
    preview,
    rows: rowsFromPreview(preview),
    runtimeMutationAttempted: before !== after,
    affectsHome: false,
    affectsTrain: false,
    affectsLog: false,
    affectsLogs: false,
    affectsRecommendations: false,
    affectsProgression: false,
    affectsReadiness: false,
  };
}

export function renderPlannerTrainPreviewText(panel: PlannerTrainPreviewPanel): string {
  if (!panel.visible) return "";
  return [panel.title, ...panel.rows.map((row) => `${row.label}: ${row.value}`)].join("\n");
}

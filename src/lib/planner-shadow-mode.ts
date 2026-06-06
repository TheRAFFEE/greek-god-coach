import { buildDailyTrainingSession, type BuildDailyTrainingSessionInput, type DailyTrainingSession } from "./training-planner";

export type PlannerShadowSessionType =
  | "LiftDay"
  | "RunDay"
  | "LongRunDay"
  | "RecoveryDay"
  | "MobilityDay"
  | "RaceDay"
  | "DeloadDay"
  | "UnavailableDay";

export type PlannerShadowSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface PlannerShadowComparableOutput {
  sessionType: PlannerShadowSessionType;
  workoutTitle: string | null;
  runTitle: string | null;
  hasRunLoggingTarget: boolean;
  hasWorkoutLoggingTarget: boolean;
  estimatedDurationMinutes: number;
  sessionStress: DailyTrainingSession["combinedLoad"]["sessionStress"];
  recoveryOverrideActive: boolean;
}

export interface PlannerShadowMismatch {
  id: string;
  field:
    | "sessionType"
    | "workoutTitle"
    | "runTitle"
    | "runLoggingTarget"
    | "workoutLoggingTarget"
    | "estimatedDurationMinutes"
    | "sessionStress"
    | "recoveryOverride";
  severity: PlannerShadowSeverity;
  plannerValue: string | number | boolean | null;
  legacyValue: string | number | boolean | null;
  explanation: string;
}

export interface PlannerShadowRuntimeGuards {
  state?: unknown;
  logs?: unknown;
  recommendations?: unknown;
  homeOutput?: unknown;
  trainOutput?: unknown;
  logOutput?: unknown;
}

export interface RunPlannerShadowComparisonInput {
  plannerInput?: BuildDailyTrainingSessionInput;
  plannerSession?: DailyTrainingSession;
  legacy: PlannerShadowComparableOutput;
  runtimeGuards?: PlannerShadowRuntimeGuards;
}

export interface PlannerShadowResult {
  advisoryOnly: true;
  plannerShownToUser: false;
  affectsRecommendations: false;
  affectsLogs: false;
  affectsProgression: false;
  affectsReadiness: false;
  affectsHome: false;
  affectsTrain: false;
  affectsLog: false;
  runtimeMutationAttempted: boolean;
  planner: PlannerShadowComparableOutput;
  legacy: PlannerShadowComparableOutput;
  mismatches: PlannerShadowMismatch[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  match: boolean;
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.keys(item as Record<string, unknown>).sort().reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = (item as Record<string, unknown>)[key];
      return sorted;
    }, {});
  });
}

function guardsFingerprint(guards: PlannerShadowRuntimeGuards | undefined): string {
  return stableSerialize({
    state: guards?.state,
    logs: guards?.logs,
    recommendations: guards?.recommendations,
    homeOutput: guards?.homeOutput,
    trainOutput: guards?.trainOutput,
    logOutput: guards?.logOutput,
  });
}

function deriveSessionType(session: DailyTrainingSession): PlannerShadowSessionType {
  const sourceText = `${session.sourcePlan.sourceWorkoutTitle ?? ""} ${session.sourcePlan.sourceWorkoutType ?? ""} ${session.summary.title}`;
  if (/race/i.test(sourceText)) return "RaceDay";
  if (/deload/i.test(sourceText)) return "DeloadDay";
  if (session.recovery || session.status === "Recovery") return "RecoveryDay";
  if (session.run?.type === "long") return "LongRunDay";
  if (session.run) return "RunDay";
  if (session.workout) return "LiftDay";
  if (session.mobility) return "MobilityDay";
  return "UnavailableDay";
}

function snapshotPlannerSession(session: DailyTrainingSession): PlannerShadowComparableOutput {
  return {
    sessionType: deriveSessionType(session),
    workoutTitle: session.workout?.title ?? null,
    runTitle: session.run?.title ?? null,
    hasRunLoggingTarget: Boolean(session.run?.loggingTarget),
    hasWorkoutLoggingTarget: Boolean(session.workout?.loggingTarget),
    estimatedDurationMinutes: session.estimatedDurationMinutes,
    sessionStress: session.combinedLoad.sessionStress,
    recoveryOverrideActive: session.status === "Recovery" || Boolean(session.recovery),
  };
}

function severityFor(input: {
  field: PlannerShadowMismatch["field"];
  planner: PlannerShadowComparableOutput;
  legacy: PlannerShadowComparableOutput;
}): PlannerShadowSeverity {
  const { field, planner, legacy } = input;
  if (field === "runLoggingTarget" && legacy.hasRunLoggingTarget && !planner.hasRunLoggingTarget) return "CRITICAL";
  if (field === "workoutLoggingTarget" && legacy.hasWorkoutLoggingTarget && !planner.hasWorkoutLoggingTarget) return "CRITICAL";
  if (field === "sessionType") {
    if (legacy.sessionType === "LongRunDay" && planner.sessionType !== "LongRunDay") return "CRITICAL";
    if (legacy.sessionType === "RunDay" && !["RunDay", "LongRunDay", "RaceDay"].includes(planner.sessionType)) return "CRITICAL";
    if (legacy.sessionType === "LiftDay" && planner.sessionType !== "LiftDay") return "CRITICAL";
    if (["RecoveryDay", "DeloadDay"].includes(legacy.sessionType) && !["RecoveryDay", "DeloadDay", "MobilityDay"].includes(planner.sessionType)) return "CRITICAL";
    return "WARNING";
  }
  if (field === "recoveryOverride" && legacy.recoveryOverrideActive && !planner.recoveryOverrideActive) return "CRITICAL";
  if (field === "estimatedDurationMinutes" || field === "sessionStress" || field === "workoutTitle" || field === "runTitle") return "WARNING";
  return "INFO";
}

function explanationFor(field: PlannerShadowMismatch["field"], severity: PlannerShadowSeverity): string {
  if (severity === "CRITICAL") {
    if (field === "runLoggingTarget") return "Planner shadow output removed a legacy run logging target.";
    if (field === "workoutLoggingTarget") return "Planner shadow output removed a legacy workout logging target.";
    if (field === "recoveryOverride") return "Planner shadow output changed a legacy recovery override into a harder session.";
    return "Planner shadow output changed a protected legacy training category.";
  }
  if (severity === "WARNING") return "Planner shadow output differs from legacy output, but the difference is advisory-only.";
  return "Planner shadow output differs only in non-runtime metadata.";
}

function addMismatch(
  mismatches: PlannerShadowMismatch[],
  field: PlannerShadowMismatch["field"],
  plannerValue: PlannerShadowMismatch["plannerValue"],
  legacyValue: PlannerShadowMismatch["legacyValue"],
  planner: PlannerShadowComparableOutput,
  legacy: PlannerShadowComparableOutput,
): void {
  if (plannerValue === legacyValue) return;
  const severity = severityFor({ field, planner, legacy });
  mismatches.push({
    id: `shadow-${String(mismatches.length + 1).padStart(2, "0")}-${field}`,
    field,
    severity,
    plannerValue,
    legacyValue,
    explanation: explanationFor(field, severity),
  });
}

function buildPlannerSession(input: RunPlannerShadowComparisonInput): DailyTrainingSession {
  if (input.plannerSession) return input.plannerSession;
  if (input.plannerInput) return buildDailyTrainingSession(input.plannerInput);
  throw new Error("runPlannerShadowComparison requires plannerSession or plannerInput.");
}

export function runPlannerShadowComparison(input: RunPlannerShadowComparisonInput): PlannerShadowResult {
  const before = guardsFingerprint(input.runtimeGuards);
  const planner = snapshotPlannerSession(buildPlannerSession(input));
  const legacy = { ...input.legacy };
  const mismatches: PlannerShadowMismatch[] = [];

  addMismatch(mismatches, "sessionType", planner.sessionType, legacy.sessionType, planner, legacy);
  addMismatch(mismatches, "workoutTitle", planner.workoutTitle, legacy.workoutTitle, planner, legacy);
  addMismatch(mismatches, "runTitle", planner.runTitle, legacy.runTitle, planner, legacy);
  addMismatch(mismatches, "runLoggingTarget", planner.hasRunLoggingTarget, legacy.hasRunLoggingTarget, planner, legacy);
  addMismatch(mismatches, "workoutLoggingTarget", planner.hasWorkoutLoggingTarget, legacy.hasWorkoutLoggingTarget, planner, legacy);
  addMismatch(mismatches, "estimatedDurationMinutes", planner.estimatedDurationMinutes, legacy.estimatedDurationMinutes, planner, legacy);
  addMismatch(mismatches, "sessionStress", planner.sessionStress, legacy.sessionStress, planner, legacy);
  addMismatch(mismatches, "recoveryOverride", planner.recoveryOverrideActive, legacy.recoveryOverrideActive, planner, legacy);

  const after = guardsFingerprint(input.runtimeGuards);
  const criticalCount = mismatches.filter((mismatch) => mismatch.severity === "CRITICAL").length;
  const warningCount = mismatches.filter((mismatch) => mismatch.severity === "WARNING").length;
  const infoCount = mismatches.filter((mismatch) => mismatch.severity === "INFO").length;

  return {
    advisoryOnly: true,
    plannerShownToUser: false,
    affectsRecommendations: false,
    affectsLogs: false,
    affectsProgression: false,
    affectsReadiness: false,
    affectsHome: false,
    affectsTrain: false,
    affectsLog: false,
    runtimeMutationAttempted: before !== after,
    planner,
    legacy,
    mismatches,
    criticalCount,
    warningCount,
    infoCount,
    match: mismatches.length === 0,
  };
}

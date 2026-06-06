import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { PrimarySessionType } from "./primary-session-resolver";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { DailyTrainingSession, DailyTrainingSupportItem } from "./training-planner";
import type { RunLog, RunningRecommendation, WorkoutSession } from "./types";

export type HomeAdapterStatus = "PASS" | "WARNING" | "BLOCKER";

export interface HomeAdapterDiagnostic {
  severity: HomeAdapterStatus;
  code: string;
  message: string;
  field?: string;
  source?: "Home Adapter" | "Training Planner" | "Readiness Engine" | "Progression Engine" | "Recommendation Pipeline" | "Persistence" | "Audit";
}

export interface HomeAdapterValidationResult {
  status: HomeAdapterStatus;
  diagnostics: HomeAdapterDiagnostic[];
}

export interface HomeAdapterRecommendationInput {
  coachRecommendation: string;
  runningRecommendation: RunningRecommendation | null;
}

export interface HomeAdapterProvenance {
  source: string;
  plannerVersion?: string;
  adapterVersion?: string;
  [key: string]: unknown;
}

export interface BuildHomeTrainingModelInput {
  mode: "developer-only" | "pilot";
  requestDate: string;
  session: DailyTrainingSession | null;
  readinessResult: ReadinessEngineResult | null;
  progressionResult: ProgressionEngineResult | null;
  goalTrackingResult: GoalTrackingEngineResult | null;
  recommendation: HomeAdapterRecommendationInput | null;
  workoutSessions?: WorkoutSession[];
  runLogs?: RunLog[];
  auditHash: string | null;
  provenance: HomeAdapterProvenance | null;
}

export type HomeTrainingItemStatus = "Completed" | "Not Completed" | "Not Scheduled" | "Unavailable";

export interface HomeTrainingModelItem {
  name: string;
  estimatedDurationMinutes: number;
  status: HomeTrainingItemStatus;
  sourceSessionId: string;
  sourceWorkoutId: string | null;
  required: boolean;
  loggingRequired: boolean;
  loggingTarget: Record<string, unknown> | null;
}

export interface HomeTrainingModelSupportItem {
  kind: DailyTrainingSupportItem["kind"];
  title: string;
  items: string[];
  sourceWorkoutId: string | null;
}

export interface HomeTrainingModel {
  source: "Planner Home Adapter V1";
  mode: "developer-only" | "pilot";
  sessionId: string;
  date: string;
  currentWeek: number;
  dayIndex: number;
  sessionType: PrimarySessionType;
  primaryObjective: string;
  title: string;
  primaryAction: string;
  deload: boolean;
  workout: HomeTrainingModelItem;
  run: HomeTrainingModelItem;
  recovery: HomeTrainingModelItem | null;
  mobility: HomeTrainingModelItem | null;
  support: HomeTrainingModelSupportItem[];
  estimatedDurationMinutes: number;
  durationMetadata: {
    summaryEstimatedDurationMinutes: number;
    combinedLoadEstimatedDurationMinutes: number;
  };
  loggingRequirements: {
    workoutLoggingRequired: boolean;
    runLoggingRequired: boolean;
  };
  readiness: {
    status: ReadinessEngineResult["status"];
    confidence: ReadinessEngineResult["confidence"];
    source: "Readiness Engine";
  };
  progression: {
    weeklyDecision: ProgressionEngineResult["weeklyDecision"];
    confidence: ProgressionEngineResult["confidence"];
    source: "Progression Engine";
  };
  recommendation: {
    coachRecommendation: string;
    runningRecommendation: RunningRecommendation | null;
    source: "Recommendation Pipeline";
  };
  audit: {
    auditHash: string;
    provenance: HomeAdapterProvenance;
    plannerAuditTrailIds: string[];
  };
  diagnostics: HomeAdapterDiagnostic[];
}

export interface HomeAdapterResult {
  status: HomeAdapterStatus;
  model: HomeTrainingModel | null;
  diagnostics: HomeAdapterDiagnostic[];
}

function diagnostic(input: HomeAdapterDiagnostic): HomeAdapterDiagnostic {
  return input;
}

function statusFromDiagnostics(diagnostics: HomeAdapterDiagnostic[]): HomeAdapterStatus {
  if (diagnostics.some((item) => item.severity === "BLOCKER")) return "BLOCKER";
  if (diagnostics.some((item) => item.severity === "WARNING")) return "WARNING";
  return "PASS";
}

function result(diagnostics: HomeAdapterDiagnostic[]): HomeAdapterValidationResult {
  return { status: statusFromDiagnostics(diagnostics), diagnostics };
}

function isIsoDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const SUPPORTED_SESSION_TYPES = new Set<string>([
  "LiftDay",
  "RunDay",
  "LongRunDay",
  "RecoveryDay",
  "MobilityDay",
  "HybridDay",
  "RaceDay",
  "TestDay",
  "UnavailableDay",
]);

const APPROVED_PROVENANCE_SOURCES = new Set<string>([
  "test",
  "home-adapter-parity-test",
  "home-adapter-contract-hardening",
  "home-adapter-pilot",
]);

function hasValidDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function expectedAuditHashes(session: DailyTrainingSession): string[] {
  const lastAuditId = session.auditTrail?.at(-1)?.id;
  return [
    `audit-hash-${session.id}`,
    ...(lastAuditId?.startsWith("audit-") ? [`audit-hash-${lastAuditId.slice("audit-".length)}`] : []),
  ];
}

function requiresWorkout(sessionType: PrimarySessionType) {
  return sessionType === "LiftDay" || sessionType === "HybridDay" || sessionType === "TestDay";
}

function requiresRun(sessionType: PrimarySessionType) {
  return sessionType === "RunDay" || sessionType === "LongRunDay" || sessionType === "HybridDay" || sessionType === "RaceDay";
}

export function validateDailyTrainingSession(session: DailyTrainingSession | null, requestDate: string): HomeAdapterValidationResult {
  const diagnostics: HomeAdapterDiagnostic[] = [];

  if (!session) {
    diagnostics.push(diagnostic({ severity: "BLOCKER", code: "SESSION_MISSING", message: "Home Adapter requires a DailyTrainingSession and must not fabricate one.", field: "session", source: "Training Planner" }));
    return result(diagnostics);
  }

  if (!session.id) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "SESSION_ID_MISSING", message: "DailyTrainingSession.id is required.", field: "session.id", source: "Training Planner" }));
  if (!isIsoDate(session.date)) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "INVALID_DATE", message: "DailyTrainingSession.date must be an ISO YYYY-MM-DD date.", field: "session.date", source: "Training Planner" }));
  if (session.date !== requestDate) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "REQUEST_DATE_MISMATCH", message: "DailyTrainingSession.date must match the Home request date.", field: "session.date", source: "Home Adapter" }));
  if (!Number.isInteger(session.currentWeek) || session.currentWeek <= 0) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "INVALID_WEEK", message: "DailyTrainingSession.currentWeek must be a positive integer.", field: "session.currentWeek", source: "Training Planner" }));
  if (!Number.isInteger(session.dayIndex) || session.dayIndex < 0 || session.dayIndex > 6) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "INVALID_DAY_INDEX", message: "DailyTrainingSession.dayIndex must be an integer from 0 to 6.", field: "session.dayIndex", source: "Training Planner" }));
  if (!session.sourcePlan?.source) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "SOURCE_PLAN_MISSING", message: "DailyTrainingSession.sourcePlan.source is required.", field: "session.sourcePlan.source", source: "Training Planner" }));
  if (!session.sessionType) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "SESSION_TYPE_MISSING", message: "DailyTrainingSession.sessionType is required.", field: "session.sessionType", source: "Training Planner" }));
  if (session.sessionType && !SUPPORTED_SESSION_TYPES.has(session.sessionType)) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "INVALID_SESSION_TYPE", message: "DailyTrainingSession.sessionType is not approved for Home Adapter consumption.", field: "session.sessionType", source: "Training Planner" }));
  if (session.sourcePlan?.resolvedSessionType && !SUPPORTED_SESSION_TYPES.has(session.sourcePlan.resolvedSessionType)) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "INVALID_SESSION_TYPE", message: "sourcePlan.resolvedSessionType is not approved for Home Adapter consumption.", field: "session.sourcePlan.resolvedSessionType", source: "Training Planner" }));
  if (session.sessionType === "DeloadDay") diagnostics.push(diagnostic({ severity: "BLOCKER", code: "DELOAD_DAY_FORBIDDEN", message: "Deload must remain metadata and must not become DeloadDay.", field: "session.sessionType", source: "Training Planner" }));
  if (session.sourcePlan?.resolvedSessionType && session.sourcePlan.resolvedSessionType !== session.sessionType) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "SESSION_TYPE_MISMATCH", message: "sourcePlan.resolvedSessionType must match sessionType.", field: "session.sourcePlan.resolvedSessionType", source: "Training Planner" }));
  if (session.sourcePlan?.resolvedSessionType === "RecoveryDay" && session.sessionType === "MobilityDay") diagnostics.push(diagnostic({ severity: "BLOCKER", code: "RECOVERY_COLLAPSED_TO_MOBILITY", message: "RecoveryDay must never collapse into MobilityDay.", field: "session.sessionType", source: "Training Planner" }));

  if (!session.metadata || typeof session.metadata.deload !== "boolean") diagnostics.push(diagnostic({ severity: "BLOCKER", code: "DELOAD_METADATA_MISSING", message: "DailyTrainingSession.metadata.deload must be present as boolean metadata.", field: "session.metadata.deload", source: "Training Planner" }));
  if (!session.summary?.title) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "TITLE_MISSING", message: "DailyTrainingSession.summary.title is required.", field: "session.summary.title", source: "Training Planner" }));
  if (!session.summary?.primaryAction) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "PRIMARY_ACTION_MISSING", message: "DailyTrainingSession.summary.primaryAction is required.", field: "session.summary.primaryAction", source: "Training Planner" }));

  if (requiresWorkout(session.sessionType) && !session.workout) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "REQUIRED_WORKOUT_MISSING", message: "This session type requires a workout prescription.", field: "session.workout", source: "Training Planner" }));
  if (requiresRun(session.sessionType) && !session.run) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "REQUIRED_RUN_MISSING", message: "This session type requires a run prescription.", field: "session.run", source: "Training Planner" }));
  if (session.workout?.executionRequired && !session.workout.loggingTarget) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "WORKOUT_LOGGING_TARGET_MISSING", message: "Workout execution requires an explicit workout logging target.", field: "session.workout.loggingTarget", source: "Training Planner" }));
  if (session.run?.executionRequired && !session.run.loggingTarget) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "RUN_LOGGING_TARGET_MISSING", message: "Run execution requires an explicit run logging target.", field: "session.run.loggingTarget", source: "Training Planner" }));
  if (session.sessionType === "RecoveryDay" && !session.recovery) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "REQUIRED_RECOVERY_MISSING", message: "RecoveryDay requires a recovery prescription so it is not represented as mobility only.", field: "session.recovery", source: "Training Planner" }));
  if (session.sessionType === "MobilityDay" && !session.mobility) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "REQUIRED_MOBILITY_MISSING", message: "MobilityDay requires a mobility prescription.", field: "session.mobility", source: "Training Planner" }));

  if (!hasValidDuration(session.estimatedDurationMinutes) || !hasValidDuration(session.summary?.estimatedDurationMinutes) || !hasValidDuration(session.combinedLoad?.estimatedDurationMinutes)) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "INVALID_DURATION_METADATA", message: "DailyTrainingSession duration metadata must be finite non-negative numbers before Home Adapter can emit a model.", field: "session.durationMetadata", source: "Training Planner" }));

  const supportCategories = new Set<string>();
  const supportItems = new Set<string>();
  for (const supportItem of session.support ?? []) {
    if (supportCategories.has(supportItem.kind)) diagnostics.push(diagnostic({ severity: "WARNING", code: "DUPLICATE_SUPPORT_CATEGORY", message: "Duplicate support category detected; mapping is preserved and only diagnostics are emitted.", field: "session.support.kind", source: "Training Planner" }));
    supportCategories.add(supportItem.kind);
    for (const item of supportItem.items) {
      const normalized = item.trim().toLowerCase();
      if (supportItems.has(normalized)) diagnostics.push(diagnostic({ severity: "WARNING", code: "DUPLICATE_SUPPORT_ITEM", message: "Duplicate support item detected; mapping is preserved and only diagnostics are emitted.", field: "session.support.items", source: "Training Planner" }));
      supportItems.add(normalized);
    }
  }
  if (!session.auditTrail?.length) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "AUDIT_TRAIL_MISSING", message: "Planner audit trail is required for Home Adapter pilot preparation.", field: "session.auditTrail", source: "Training Planner" }));

  return result(diagnostics);
}

export function validateDomainInputs(input: {
  session: DailyTrainingSession | null;
  readinessResult: ReadinessEngineResult | null;
  progressionResult: ProgressionEngineResult | null;
  goalTrackingResult: GoalTrackingEngineResult | null;
  recommendation: HomeAdapterRecommendationInput | null;
}): HomeAdapterValidationResult {
  const diagnostics: HomeAdapterDiagnostic[] = [];

  if (!input.readinessResult) {
    diagnostics.push(diagnostic({ severity: "BLOCKER", code: "READINESS_MISSING", message: "Home Adapter must receive real readiness and must not fabricate it.", field: "readinessResult", source: "Readiness Engine" }));
  } else if (input.session && input.readinessResult.status !== input.session.readinessStatus) {
    diagnostics.push(diagnostic({ severity: "BLOCKER", code: "READINESS_MISMATCH", message: "Readiness result status must match DailyTrainingSession.readinessStatus.", field: "readinessResult.status", source: "Readiness Engine" }));
  }

  if (!input.progressionResult) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "PROGRESSION_MISSING", message: "Home Adapter must receive real progression and must not fabricate it.", field: "progressionResult", source: "Progression Engine" }));
  if (!input.goalTrackingResult) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "GOAL_TRACKING_MISSING", message: "Home Adapter must receive real goal tracking for pilot-safe Home context and must not fabricate it.", field: "goalTrackingResult", source: "Home Adapter" }));
  if (!input.recommendation || !input.recommendation.coachRecommendation) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "RECOMMENDATION_MISSING", message: "Home Adapter must receive recommendation copy and must not fabricate it.", field: "recommendation", source: "Recommendation Pipeline" }));

  if (input.session?.run && !input.recommendation?.runningRecommendation) {
    diagnostics.push(diagnostic({ severity: "BLOCKER", code: "RUN_RECOMMENDATION_MISSING", message: "Run sessions require a real running recommendation for this developer-only Home adapter preparation path.", field: "recommendation.runningRecommendation", source: "Recommendation Pipeline" }));
  }

  return result(diagnostics);
}

export function validateAuditAndProvenance(input: { session: DailyTrainingSession | null; auditHash: string | null; provenance: HomeAdapterProvenance | null }): HomeAdapterValidationResult {
  const diagnostics: HomeAdapterDiagnostic[] = [];
  if (!input.auditHash) {
    diagnostics.push(diagnostic({ severity: "BLOCKER", code: "AUDIT_HASH_MISSING", message: "Home Adapter requires audit hash and must not fabricate it.", field: "auditHash", source: "Audit" }));
  } else if (input.session && !expectedAuditHashes(input.session).includes(input.auditHash)) {
    diagnostics.push(diagnostic({ severity: "BLOCKER", code: "AUDIT_HASH_MISMATCH", message: "Audit hash must match the validated planner session/audit trail.", field: "auditHash", source: "Audit" }));
  }

  if (!input.provenance?.source) {
    diagnostics.push(diagnostic({ severity: "BLOCKER", code: "PROVENANCE_MISSING", message: "Home Adapter requires provenance and must not fabricate it.", field: "provenance", source: "Audit" }));
  } else if (!APPROVED_PROVENANCE_SOURCES.has(input.provenance.source)) {
    diagnostics.push(diagnostic({ severity: "BLOCKER", code: "PROVENANCE_MISMATCH", message: "Provenance source is not approved for this developer-only Home Adapter contract.", field: "provenance.source", source: "Audit" }));
  }

  if (input.session && !input.session.auditTrail?.length) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "AUDIT_TRAIL_MISSING", message: "Planner audit trail is required for audit metadata preservation.", field: "session.auditTrail", source: "Training Planner" }));
  return result(diagnostics);
}

export function validatePersistenceInputs(input: { workoutSessions?: WorkoutSession[]; runLogs?: RunLog[] }): HomeAdapterValidationResult {
  const diagnostics: HomeAdapterDiagnostic[] = [];
  if (!Array.isArray(input.workoutSessions)) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "WORKOUT_LOGS_MISSING", message: "Home Adapter requires real workout session history and must not fabricate it.", field: "workoutSessions", source: "Persistence" }));
  if (!Array.isArray(input.runLogs)) diagnostics.push(diagnostic({ severity: "BLOCKER", code: "RUN_LOGS_MISSING", message: "Home Adapter requires real run log history and must not fabricate it.", field: "runLogs", source: "Persistence" }));
  return result(diagnostics);
}

function completedWorkoutToday(workoutSessions: WorkoutSession[], session: DailyTrainingSession): boolean {
  const target = session.workout?.loggingTarget.workoutId;
  if (!target) return false;
  return workoutSessions.some((workoutSession) => workoutSession.workoutId === target && workoutSession.status === "completed" && workoutSession.startedAt.slice(0, 10) === session.date);
}

function completedRunToday(runLogs: RunLog[], session: DailyTrainingSession): boolean {
  return runLogs.some((runLog) => runLog.date === session.date && runLog.completed);
}

function notScheduledItem(session: DailyTrainingSession, name: string): HomeTrainingModelItem {
  return {
    name,
    estimatedDurationMinutes: 0,
    status: "Not Scheduled",
    sourceSessionId: session.id,
    sourceWorkoutId: null,
    required: false,
    loggingRequired: false,
    loggingTarget: null,
  };
}

function mapWorkoutItem(session: DailyTrainingSession, workoutSessions: WorkoutSession[]): HomeTrainingModelItem {
  if (!session.workout) return notScheduledItem(session, "No lift scheduled");
  return {
    name: session.workout.title,
    estimatedDurationMinutes: session.workout.estimatedMinutes,
    status: completedWorkoutToday(workoutSessions, session) ? "Completed" : "Not Completed",
    sourceSessionId: session.id,
    sourceWorkoutId: session.workout.sourceWorkoutId,
    required: session.workout.executionRequired,
    loggingRequired: session.workout.executionRequired,
    loggingTarget: { ...session.workout.loggingTarget },
  };
}

function mapRunItem(session: DailyTrainingSession, runLogs: RunLog[]): HomeTrainingModelItem {
  if (!session.run) return notScheduledItem(session, "No run scheduled");
  return {
    name: session.run.title,
    estimatedDurationMinutes: session.run.estimatedMinutes,
    status: completedRunToday(runLogs, session) ? "Completed" : "Not Completed",
    sourceSessionId: session.id,
    sourceWorkoutId: session.run.sourceWorkoutId ?? null,
    required: session.run.required,
    loggingRequired: session.run.executionRequired,
    loggingTarget: { ...session.run.loggingTarget },
  };
}

function mapRecoveryItem(session: DailyTrainingSession): HomeTrainingModelItem | null {
  if (!session.recovery) return null;
  return {
    name: session.recovery.title,
    estimatedDurationMinutes: session.recovery.estimatedMinutes,
    status: "Not Completed",
    sourceSessionId: session.id,
    sourceWorkoutId: session.sourcePlan.sourceWorkoutId ?? null,
    required: session.sessionType === "RecoveryDay",
    loggingRequired: false,
    loggingTarget: null,
  };
}

function mapMobilityItem(session: DailyTrainingSession): HomeTrainingModelItem | null {
  if (!session.mobility) return null;
  return {
    name: session.mobility.title,
    estimatedDurationMinutes: session.mobility.estimatedMinutes,
    status: "Not Completed",
    sourceSessionId: session.id,
    sourceWorkoutId: session.mobility.sourceWorkoutId ?? null,
    required: session.sessionType === "MobilityDay",
    loggingRequired: false,
    loggingTarget: null,
  };
}

function mapSupportItems(support: DailyTrainingSupportItem[]): HomeTrainingModelSupportItem[] {
  return support.map((item) => ({
    kind: item.kind,
    title: item.title,
    items: [...item.items],
    sourceWorkoutId: item.sourceWorkoutId ?? null,
  }));
}

function mapPlannerToHome(input: Required<Pick<BuildHomeTrainingModelInput, "workoutSessions" | "runLogs">> & BuildHomeTrainingModelInput & {
  session: DailyTrainingSession;
  readinessResult: ReadinessEngineResult;
  progressionResult: ProgressionEngineResult;
  recommendation: HomeAdapterRecommendationInput;
  auditHash: string;
  provenance: HomeAdapterProvenance;
}, diagnostics: HomeAdapterDiagnostic[]): HomeTrainingModel {
  const workout = mapWorkoutItem(input.session, input.workoutSessions);
  const run = mapRunItem(input.session, input.runLogs);
  return {
    source: "Planner Home Adapter V1",
    mode: input.mode,
    sessionId: input.session.id,
    date: input.session.date,
    currentWeek: input.session.currentWeek,
    dayIndex: input.session.dayIndex,
    sessionType: input.session.sessionType,
    primaryObjective: input.session.summary.primaryAction,
    title: input.session.summary.title,
    primaryAction: input.session.summary.primaryAction,
    deload: input.session.metadata.deload,
    workout,
    run,
    recovery: mapRecoveryItem(input.session),
    mobility: mapMobilityItem(input.session),
    support: mapSupportItems(input.session.support),
    estimatedDurationMinutes: input.session.estimatedDurationMinutes,
    durationMetadata: {
      summaryEstimatedDurationMinutes: input.session.summary.estimatedDurationMinutes,
      combinedLoadEstimatedDurationMinutes: input.session.combinedLoad.estimatedDurationMinutes,
    },
    loggingRequirements: {
      workoutLoggingRequired: workout.loggingRequired,
      runLoggingRequired: run.loggingRequired,
    },
    readiness: { status: input.readinessResult.status, confidence: input.readinessResult.confidence, source: "Readiness Engine" },
    progression: { weeklyDecision: input.progressionResult.weeklyDecision, confidence: input.progressionResult.confidence, source: "Progression Engine" },
    recommendation: { coachRecommendation: input.recommendation.coachRecommendation, runningRecommendation: input.recommendation.runningRecommendation, source: "Recommendation Pipeline" },
    audit: { auditHash: input.auditHash, provenance: input.provenance, plannerAuditTrailIds: input.session.auditTrail.map((entry) => entry.id) },
    diagnostics,
  };
}

export function buildHomeTrainingModel(input: BuildHomeTrainingModelInput): HomeAdapterResult {
  const validationResults = [
    validateDailyTrainingSession(input.session, input.requestDate),
    validateDomainInputs({ session: input.session, readinessResult: input.readinessResult, progressionResult: input.progressionResult, goalTrackingResult: input.goalTrackingResult, recommendation: input.recommendation }),
    validatePersistenceInputs({ workoutSessions: input.workoutSessions, runLogs: input.runLogs }),
    validateAuditAndProvenance({ session: input.session, auditHash: input.auditHash, provenance: input.provenance }),
  ];
  const diagnostics = validationResults.flatMap((item) => item.diagnostics);
  const status = statusFromDiagnostics(diagnostics);
  if (status === "BLOCKER" || !input.session || !input.readinessResult || !input.progressionResult || !input.recommendation || !input.auditHash || !input.provenance || !input.workoutSessions || !input.runLogs) {
    return { status: "BLOCKER", model: null, diagnostics };
  }

  return { status, model: mapPlannerToHome(input as Parameters<typeof mapPlannerToHome>[0], diagnostics), diagnostics };
}

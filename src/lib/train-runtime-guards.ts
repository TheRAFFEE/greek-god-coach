import type { AppState, WorkoutSession } from "./types";
import type { ReadinessEngineResult } from "./readiness-engine";
import { resolveActiveWorkoutForToday } from "./active-workout-rollover";

export type TrainReadinessFallback = ReadinessEngineResult;

export const missingCheckInTrainReadiness: TrainReadinessFallback = {
  status: "Yellow",
  score: 55,
  confidence: "Low",
  reasons: [{ factor: "data_quality", severity: "yellow", points: 0, message: "No Daily Check-In has been saved for today." }],
  reason: "No Daily Check-In has been saved for today.",
  recommendation: "Use the prescribed workout conservatively and complete Daily Check-In for personalized coaching.",
  recommendationType: "modified_training",
  trainingGuidance: "Use the prescribed workout conservatively until today's readiness is available.",
  recoveryGuidance: ["Complete Daily Check-In for personalized recovery guidance."],
  dataQualityWarnings: ["Today’s Daily Check-In is missing."],
};

export interface TrainRuntimeInput {
  state: AppState;
  workout?: { id?: string | null; title?: string; exercises?: unknown[] } | null;
  readiness?: Partial<TrainReadinessFallback> | null;
  today: string;
  activeSessionId?: string | null;
}

export interface TrainRuntimeStatus {
  readiness: TrainReadinessFallback;
  tone: "green" | "yellow" | "red";
  workoutId: string | null;
  hasPrescribedWorkout: boolean;
  activeSession: WorkoutSession | null;
  canStartTodayPrescription: boolean;
  liftCompleted: boolean | null;
  emptyState: { title: string; copy: string } | null;
}

export function normalizeTrainReadiness(readiness?: Partial<TrainReadinessFallback> | null): TrainReadinessFallback {
  const status = readiness?.status === "Green" || readiness?.status === "Yellow" || readiness?.status === "Red" ? readiness.status : missingCheckInTrainReadiness.status;
  return {
    ...missingCheckInTrainReadiness,
    ...readiness,
    status,
    score: typeof readiness?.score === "number" && Number.isFinite(readiness.score) ? readiness.score : missingCheckInTrainReadiness.score,
    reason: readiness?.reason || missingCheckInTrainReadiness.reason,
    recommendation: readiness?.recommendation || missingCheckInTrainReadiness.recommendation,
    confidence: readiness?.confidence ?? missingCheckInTrainReadiness.confidence,
    reasons: readiness?.reasons ?? missingCheckInTrainReadiness.reasons,
    recommendationType: readiness?.recommendationType ?? missingCheckInTrainReadiness.recommendationType,
    trainingGuidance: readiness?.trainingGuidance ?? missingCheckInTrainReadiness.trainingGuidance,
    recoveryGuidance: readiness?.recoveryGuidance ?? missingCheckInTrainReadiness.recoveryGuidance,
    dataQualityWarnings: readiness?.dataQualityWarnings ?? missingCheckInTrainReadiness.dataQualityWarnings,
  };
}

function trainTone(status: TrainReadinessFallback["status"]): TrainRuntimeStatus["tone"] {
  if (status === "Green") return "green";
  if (status === "Yellow") return "yellow";
  return "red";
}

function safeDatePrefix(value: unknown): string | null {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : null;
}

export function buildTrainRuntimeStatus(input: TrainRuntimeInput): TrainRuntimeStatus {
  const readiness = normalizeTrainReadiness(input.readiness);
  const workoutId = typeof input.workout?.id === "string" && input.workout.id.length > 0 ? input.workout.id : null;
  const hasPrescribedWorkout = Boolean(workoutId);
  const activeWorkoutRollover = workoutId
    ? resolveActiveWorkoutForToday(input.state, { workoutId, today: input.today, preferredSessionId: input.activeSessionId ?? null })
    : null;
  const activeSession = activeWorkoutRollover?.resumableSession ?? null;
  const liftCompleted = workoutId
    ? (input.state.workoutSessions ?? []).some((session) => {
        if (session.workoutId !== workoutId || session.status !== "completed") return false;
        const sessionDate = safeDatePrefix(session.date) ?? safeDatePrefix(session.startedAt);
        const endedDate = safeDatePrefix(session.endedAt);
        return sessionDate === input.today || endedDate === input.today;
      })
    : null;

  return {
    readiness,
    tone: trainTone(readiness.status),
    workoutId,
    hasPrescribedWorkout,
    activeSession,
    canStartTodayPrescription: Boolean(workoutId && !activeSession),
    liftCompleted,
    emptyState: hasPrescribedWorkout ? null : {
      title: "No prescribed workout found for today",
      copy: "Train could not find a lift prescription for this date. Home, Log, and Progress remain available; choose another week/day or check the training plan seed data.",
    },
  };
}

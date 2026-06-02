import type { AppState, BodyMetric, DailyCheckIn, ReadinessStatus } from "./types";
import { evaluateReadiness, readinessInputFromDailyCheckIn } from "./readiness-engine";

export interface DailyRecoveryStatus {
  status: ReadinessStatus;
  recommendation: string;
  reasoning: string;
  reasons: string[];
}

export function evaluateDailyRecoveryStatus(checkIn: DailyCheckIn): DailyRecoveryStatus {
  const readiness = evaluateReadiness(readinessInputFromDailyCheckIn(checkIn));
  const reasons = readiness.reasons.length ? readiness.reasons.map((reason) => reason.message) : ["Recovery markers support normal training"];

  if (readiness.status === "Red") {
    return {
      status: "Red",
      recommendation: "Prioritize recovery, mobility, and walking only.",
      reasons,
      reasoning: `${reasons.join("; ")}. The unified readiness engine says Red days take priority when severe recovery risk appears.`,
    };
  }

  if (readiness.status === "Yellow") {
    return {
      status: "Yellow",
      recommendation: "Modify today's training dose.",
      reasons,
      reasoning: `${reasons.join("; ")}. Keep consistency, but reduce volume or intensity.`,
    };
  }

  return {
    status: "Green",
    recommendation: "Follow the plan as written.",
    reasons: ["Recovery markers support normal training"],
    reasoning: "Recovery markers support normal training: sleep is adequate, soreness is manageable, stress is controlled, energy is acceptable, and no high-risk pain was logged.",
  };
}

export interface DailyCompletionStatus {
  workoutCompleted: boolean;
  runCompleted: boolean;
}

function isoDate(value?: string) {
  return value?.slice(0, 10) ?? "";
}

export function deriveDailyCompletionStatus(state: AppState, date: string): DailyCompletionStatus {
  const workoutCompleted = (state.workoutSessions ?? []).some((session) =>
    isoDate(session.startedAt) === date || isoDate(session.endedAt) === date || session.setLogs.some((set) => isoDate(set.completedAt) === date)
  );
  const runCompleted = (state.runLogs ?? []).some((run) => run.date === date);

  return { workoutCompleted, runCompleted };
}

export function upsertDailyCheckIn(state: AppState, checkIn: DailyCheckIn, bodyMetricId: string): AppState {
  const completion = deriveDailyCompletionStatus(state, checkIn.date);
  const derivedCheckIn: DailyCheckIn = { ...checkIn, ...completion };
  const bodyMetric: BodyMetric = {
    id: bodyMetricId,
    userId: state.user.id,
    date: derivedCheckIn.date,
    weight: derivedCheckIn.weight,
    notes: "from daily check-in",
  };

  return {
    ...state,
    checkIns: [...state.checkIns.filter((entry) => entry.date !== derivedCheckIn.date), derivedCheckIn].sort((a, b) => a.date.localeCompare(b.date)),
    bodyMetrics: [...state.bodyMetrics.filter((metric) => metric.date !== derivedCheckIn.date), bodyMetric].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

import type { AppState, BodyMetric, DailyCheckIn, ReadinessStatus } from "./types";

export interface DailyRecoveryStatus {
  status: ReadinessStatus;
  recommendation: string;
  reasoning: string;
  reasons: string[];
}

function isRedRecovery(checkIn: DailyCheckIn): string[] {
  const reasons: string[] = [];
  if (checkIn.sleepHours < 5) reasons.push("sleep is under 5 hours");
  if (checkIn.soreness >= 8) reasons.push("soreness is 8 or higher");
  if (checkIn.stress >= 5) reasons.push("stress is 5 or higher");
  if (checkIn.energy <= 1) reasons.push("energy is 1");
  if (checkIn.pain && checkIn.painSeverity >= 7) reasons.push("pain severity is 7 or higher");
  return reasons;
}

function isYellowRecovery(checkIn: DailyCheckIn): string[] {
  const reasons: string[] = [];
  if (checkIn.sleepHours >= 5 && checkIn.sleepHours < 6.5) reasons.push("sleep is between 5 and 6.5 hours");
  if (checkIn.soreness >= 6 && checkIn.soreness <= 7) reasons.push("soreness is 6-7");
  if (checkIn.stress === 4) reasons.push("stress is 4");
  if (checkIn.energy === 2) reasons.push("energy is 2");
  if (checkIn.pain && checkIn.painSeverity >= 4 && checkIn.painSeverity <= 6) reasons.push("pain severity is 4-6");
  if (checkIn.alcohol) reasons.push("alcohol was logged");
  return reasons;
}

export function evaluateDailyRecoveryStatus(checkIn: DailyCheckIn): DailyRecoveryStatus {
  const redReasons = isRedRecovery(checkIn);
  if (redReasons.length) {
    return {
      status: "Red",
      recommendation: "Prioritize recovery, mobility, and walking only.",
      reasons: redReasons,
      reasoning: `${redReasons.join("; ")}. The adjustment rules say Red days take priority when severe recovery risk appears.`,
    };
  }

  const yellowReasons = isYellowRecovery(checkIn);
  if (yellowReasons.length) {
    return {
      status: "Yellow",
      recommendation: "Modify today's training dose.",
      reasons: yellowReasons,
      reasoning: `${yellowReasons.join("; ")}. Keep consistency, but reduce volume or intensity.`,
    };
  }

  return {
    status: "Green",
    recommendation: "Follow the plan as written.",
    reasons: ["Recovery markers support normal training"],
    reasoning: "Recovery markers support normal training: sleep is adequate, soreness is manageable, stress is controlled, energy is acceptable, and no high-risk pain was logged.",
  };
}

export function upsertDailyCheckIn(state: AppState, checkIn: DailyCheckIn, bodyMetricId: string): AppState {
  const bodyMetric: BodyMetric = {
    id: bodyMetricId,
    userId: state.user.id,
    date: checkIn.date,
    weight: checkIn.weight,
    notes: "from daily check-in",
  };

  return {
    ...state,
    checkIns: [...state.checkIns.filter((entry) => entry.date !== checkIn.date), checkIn].sort((a, b) => a.date.localeCompare(b.date)),
    bodyMetrics: [...state.bodyMetrics.filter((metric) => metric.date !== checkIn.date), bodyMetric].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

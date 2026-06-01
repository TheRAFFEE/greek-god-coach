import type { AppState, RunLog, RunType } from "./types";

export type NextRunDecision = "progress" | "repeat" | "deload";

export interface RunLoggerInput {
  id: string;
  userId: string;
  date: string;
  runType: RunType;
  distance: number;
  durationMinutes: number;
  averagePace?: number;
  averageHeartRate: number;
  rpe: number;
  walkBreaks: boolean;
  painScore: number;
  notes: string;
}

export interface RunLoggerResult {
  runSummary: {
    date: string;
    runType: RunType;
    distance: number;
    durationMinutes: number;
    averagePace: number;
    averageHeartRate: number;
    rpe: number;
    walkBreaks: boolean;
    painScore: number;
  };
  summary: string;
  nextRunDecision: NextRunDecision;
  recommendation: string;
  painWarning: string | null;
  reasons: string[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function calculatedPace(distance: number, durationMinutes: number) {
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  return round1(durationMinutes / distance);
}

export function buildRunLoggerRecord(input: RunLoggerInput): RunLog {
  const averagePace = input.averagePace && input.averagePace > 0 ? round1(input.averagePace) : calculatedPace(input.distance, input.durationMinutes);
  return {
    id: input.id,
    userId: input.userId,
    date: input.date,
    runType: input.runType,
    plannedDistance: round1(input.distance),
    actualDistance: round1(input.distance),
    durationMinutes: round1(input.durationMinutes),
    averagePace,
    averageHr: Math.round(input.averageHeartRate),
    maxHr: Math.round(input.averageHeartRate),
    rpe: input.rpe,
    zone2Compliance: input.rpe <= 6 ? 85 : input.rpe === 7 ? 75 : 60,
    completed: input.distance > 0 && input.durationMinutes > 0,
    walkBreaks: input.walkBreaks,
    pain: input.painScore > 0,
    painScore: input.painScore,
    painLocation: "",
    notes: input.notes,
  };
}

export function evaluateRunLoggerResult(run: RunLog): RunLoggerResult {
  const runType = run.runType ?? "easy";
  const painScore = run.painScore ?? (run.pain ? 7 : 0);
  const walkBreaks = run.walkBreaks ?? false;
  const reasons: string[] = [];
  let nextRunDecision: NextRunDecision = "progress";

  if (painScore >= 7) {
    nextRunDecision = "deload";
    reasons.push("Pain score is high, so injury prevention overrides progression.");
  } else if (!run.completed || run.rpe >= 8 || walkBreaks || painScore >= 4) {
    nextRunDecision = "repeat";
    if (!run.completed) reasons.push("Run was not completed.");
    if (run.rpe >= 8) reasons.push("RPE was high.");
    if (walkBreaks) reasons.push("Walk breaks were used; hold progression until continuous running improves.");
    if (painScore >= 4) reasons.push("Pain was moderate.");
  } else {
    if (runType === "long run") reasons.push("Long run was completed with RPE <= 7 and no high pain.");
    else reasons.push("Run was completed with controlled effort and no limiting pain.");
  }

  const painWarning = painScore >= 7 ? `Pain score is ${painScore}/10. Deload running and avoid speed work; choose rest, mobility, walking, or easy running only if symptoms settle.` : null;
  const actionCopy = nextRunDecision === "progress"
    ? "Progress the next run conservatively."
    : nextRunDecision === "repeat"
      ? "Repeat the next run instead of progressing."
      : "Deload the next run and avoid hard running.";

  return {
    runSummary: {
      date: run.date,
      runType,
      distance: run.actualDistance,
      durationMinutes: run.durationMinutes,
      averagePace: run.averagePace,
      averageHeartRate: run.averageHr,
      rpe: run.rpe,
      walkBreaks,
      painScore,
    },
    summary: `${run.actualDistance} mi ${runType} in ${run.durationMinutes} min at ${run.averagePace} min/mi, RPE ${run.rpe}${walkBreaks ? ", with walk breaks" : ", no walk breaks"}.`,
    nextRunDecision,
    recommendation: actionCopy,
    painWarning,
    reasons,
  };
}

export function saveRunLoggerEntry(state: AppState, run: RunLog): { state: AppState; result: RunLoggerResult } {
  const result = evaluateRunLoggerResult(run);
  return {
    state: {
      ...state,
      runLogs: [...(state.runLogs ?? []).filter((entry) => entry.date !== run.date), run].sort((a, b) => a.date.localeCompare(b.date)),
    },
    result,
  };
}

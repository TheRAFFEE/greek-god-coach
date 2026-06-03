import type { AppState, RunLog, RunType, Workout } from "./types";
import { evaluateRunning, type RunningEngineInput, type RunningProgressionAction } from "./running-engine";

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

export type TrainSessionBlockKind = "warm-up" | "lift" | "run" | "cooldown" | "summary";

export interface TrainSessionBlock {
  kind: TrainSessionBlockKind;
  title: string;
  description: string;
  items: string[];
}

export interface BuildTrainSessionBlocksInput {
  workout: Workout;
  plannedRunDistance: number;
  forceRun?: boolean;
}

export interface TrainRunLogInput {
  id: string;
  userId: string;
  date: string;
  runType: RunType;
  plannedDistance: number;
  actualDistance: number;
  durationMinutes: number;
  averagePace?: number;
  averageHeartRate: number;
  rpe: number;
  pain: boolean;
  painScore?: number;
  notes: string;
  walkBreaks?: boolean;
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

export function buildRunningEngineInputForRunLogger(run: RunLog): RunningEngineInput {
  const painScore = run.painScore ?? (run.pain ? 7 : 0);
  const engineRun = {
    id: run.id,
    date: run.date,
    runType: run.runType,
    plannedDistance: run.plannedDistance,
    actualDistance: run.actualDistance,
    durationMinutes: run.durationMinutes,
    averagePace: run.averagePace,
    averagePaceSecondsPerMile: Math.round(run.averagePace * 60),
    averageHr: run.averageHr,
    maxHr: run.maxHr,
    rpe: run.rpe,
    zone2Compliance: run.zone2Compliance,
    completed: run.completed,
    walkBreaks: run.walkBreaks,
    pain: run.pain,
    painScore,
    painLocation: run.painLocation,
    notes: run.notes,
  };
  const baselineRun = {
    ...engineRun,
    id: `${run.id}-compat-baseline`,
    date: "2026-01-01",
    rpe: Math.min(run.rpe, 6),
    pain: false,
    painScore: 0,
    walkBreaks: false,
  };
  const cleanEnoughForLegacyProgress = run.completed && run.rpe <= 7 && painScore < 4 && !run.walkBreaks;
  const runLogs = cleanEnoughForLegacyProgress ? [baselineRun, engineRun] : [engineRun];
  return {
    generatedAt: `${run.date}T12:00:00.000Z`,
    evaluationDate: run.date,
    race: { raceDate: "2027-01-17", targetFinishMinutes: 118, targetPaceSecondsPerMile: 540, distanceMiles: 13.1 },
    runLogs,
    currentWeek: {
      startDate: run.date,
      endDate: run.date,
      weeklyMileage: run.completed ? run.actualDistance : 0,
      rolling7DayMileage: run.completed ? run.actualDistance : 0,
      previousWeeklyMileage: cleanEnoughForLegacyProgress ? (run.completed ? run.actualDistance : 0) : undefined,
      runningDaysPlanned: cleanEnoughForLegacyProgress ? 2 : 1,
      runningDaysCompleted: cleanEnoughForLegacyProgress ? 2 : run.completed ? 1 : 0,
    },
    readiness: {
      status: painScore >= 7 ? "Red" : painScore >= 4 || run.rpe >= 8 || run.walkBreaks ? "Yellow" : "Green",
      score: painScore >= 7 ? 35 : painScore >= 4 || run.rpe >= 8 || run.walkBreaks ? 62 : 82,
      confidence: "Medium",
    },
  };
}

function legacyDecisionFromRunningAction(action: RunningProgressionAction): NextRunDecision {
  if (action === "Progress") return "progress";
  if (action === "Hold") return "repeat";
  return "deload";
}

export function evaluateRunLoggerResult(run: RunLog): RunLoggerResult {
  const runType = run.runType ?? "easy";
  const painScore = run.painScore ?? (run.pain ? 7 : 0);
  const walkBreaks = run.walkBreaks ?? false;
  const engine = evaluateRunning(buildRunningEngineInputForRunLogger(run));
  const nextRunDecision = legacyDecisionFromRunningAction(engine.progression.action);
  const painWarning = painScore >= 7 ? `Pain score is ${painScore}/10. Deload running and avoid speed work; choose rest, mobility, walking, or easy running only if symptoms settle.` : null;
  const actionCopy = nextRunDecision === "progress"
    ? "Progress the next run conservatively."
    : nextRunDecision === "repeat"
      ? "Repeat the next run instead of progressing."
      : engine.progression.action === "Recovery Focus"
        ? "Recovery focus: deload the next run and avoid hard running."
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
    reasons: [
      `Running Engine V2 action: ${engine.progression.action}.`,
      engine.progression.reason,
      ...engine.progression.explanation.primaryDrivers,
      ...(walkBreaks ? ["Walk breaks were used; hold progression until continuous running improves."] : []),
      ...(run.rpe >= 8 ? ["RPE was high."] : []),
      ...(painScore >= 4 ? ["Pain was moderate."] : []),
      ...(!run.completed ? ["Run was not completed."] : []),
    ],
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

function workoutHasLift(workout: Workout) {
  if (!workout.exercises.length) return false;
  if (/run|race|zone|cardio/i.test(workout.type) && workout.exercises.every((exercise) => /run|jog|walk|sprint|interval/i.test(exercise.name))) return false;
  return workout.exercises.some((exercise) => !/run|jog|walk|sprint|interval/i.test(exercise.name));
}

function workoutHasRun(input: BuildTrainSessionBlocksInput) {
  if (input.forceRun) return input.plannedRunDistance > 0;
  if (input.workout.longRunMiles && input.workout.longRunMiles > 0) return true;
  if (/run|race|zone|cardio/i.test(input.workout.type)) return true;
  return input.workout.exercises.some((exercise) => /run|jog|walk|sprint|interval/i.test(exercise.name));
}

export function buildTrainSessionBlocks(input: BuildTrainSessionBlocksInput): TrainSessionBlock[] {
  const liftScheduled = workoutHasLift(input.workout);
  const runScheduled = workoutHasRun(input);
  const blocks: TrainSessionBlock[] = [
    {
      kind: "warm-up",
      title: "Warm-up",
      description: "Prepare for today’s training before logging work.",
      items: [
        "5 minutes easy cardio or brisk walk",
        "Dynamic mobility for hips, ankles, shoulders, and T-spine",
        ...(liftScheduled ? ["Ramp-up sets before the first lift"] : []),
        ...(runScheduled ? ["Easy jog/walk warm-up before the run"] : []),
      ],
    },
  ];

  if (liftScheduled) {
    blocks.push({
      kind: "lift",
      title: input.workout.title,
      description: "Execute and log lifting sets here in Train.",
      items: input.workout.exercises.filter((exercise) => !/run|jog|walk|sprint|interval/i.test(exercise.name)).map((exercise) => `${exercise.order}. ${exercise.name}: ${exercise.prescribedSets} x ${exercise.prescribedReps}`),
    });
  }

  if (runScheduled) {
    const distance = input.workout.longRunMiles ?? input.plannedRunDistance;
    blocks.push({
      kind: "run",
      title: distance > 0 ? `Run — ${distance} mi planned` : "Run",
      description: "Log today’s run here in Train after completion.",
      items: ["Capture actual distance, duration, pace if known, RPE, pain, and notes."],
    });
  }

  blocks.push(
    {
      kind: "cooldown",
      title: "Cooldown",
      description: "Downshift after training before closing the session.",
      items: ["5 minutes easy walk", "Breathing cooldown", "Light stretching/mobility", "Post-session notes"],
    },
    {
      kind: "summary",
      title: "Session summary",
      description: "Review lift/run completion, readiness used, warnings, and next recommended action.",
      items: [],
    },
  );

  return blocks;
}

export function saveTrainRunLog(state: AppState, input: TrainRunLogInput): { state: AppState; result: RunLoggerResult; run: RunLog } {
  const record = buildRunLoggerRecord({
    id: input.id,
    userId: input.userId,
    date: input.date,
    runType: input.runType,
    distance: input.actualDistance,
    durationMinutes: input.durationMinutes,
    averagePace: input.averagePace,
    averageHeartRate: input.averageHeartRate,
    rpe: input.rpe,
    walkBreaks: input.walkBreaks ?? false,
    painScore: input.pain ? input.painScore ?? 1 : 0,
    notes: input.notes,
  });
  const run: RunLog = {
    ...record,
    plannedDistance: input.plannedDistance,
    actualDistance: input.actualDistance,
    completed: input.actualDistance > 0 && input.durationMinutes > 0,
    pain: input.pain || (input.painScore ?? 0) > 0,
    painScore: input.pain ? input.painScore ?? 1 : input.painScore ?? 0,
  };
  const saved = saveRunLoggerEntry(state, run);
  return { ...saved, run };
}

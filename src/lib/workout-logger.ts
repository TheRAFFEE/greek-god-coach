import type { AppState, PostWorkoutRecommendation, SetLog, WorkoutSession, WorkoutSummary } from "./types";

export type WorkoutLoggerType = "upper strength" | "lower strength" | "Greek god hypertrophy" | "recovery";
export type WorkoutProgressionAction = "progress" | "repeat" | "reduce-volume";

export interface WorkoutLoggerExerciseInput {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  rpe: number;
  painNotes: string;
  completed: boolean;
}

export interface WorkoutLoggerInput {
  id: string;
  userId: string;
  date: string;
  workoutType: WorkoutLoggerType;
  exercises: WorkoutLoggerExerciseInput[];
  completed: boolean;
  sorenessLevel: number;
  sleepHours: number;
}

export interface RecoveryContext {
  sorenessLevel: number;
  sleepHours: number;
}

export interface WorkoutLoggerResult {
  summary: WorkoutSummary;
  nextProgression: PostWorkoutRecommendation;
  volumeWarning: { reductionPercent: number; message: string; reason: string } | null;
}

const round0 = (value: number) => Math.round(value);
const safeSets = (sets: number) => Math.max(0, Math.floor(sets));

export function buildWorkoutLoggerSession(input: WorkoutLoggerInput): WorkoutSession {
  const setLogs: SetLog[] = input.exercises.flatMap((exercise) => {
    const count = safeSets(exercise.sets);
    return Array.from({ length: count }, (_, index) => ({
      id: `${input.id}-${exercise.id}-set-${index + 1}`,
      sessionId: input.id,
      userId: input.userId,
      workoutId: input.id,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: index + 1,
      targetReps: String(exercise.reps),
      targetRpe: 8,
      weightUsed: exercise.weight,
      repsCompleted: exercise.completed ? exercise.reps : Math.max(0, exercise.reps - 1),
      rpe: exercise.rpe,
      pain: exercise.painNotes.trim().length > 0,
      formQuality: exercise.completed ? "solid" : "missed",
      completedAt: `${input.date}T12:00:00.000Z`,
      notes: exercise.painNotes,
    }));
  });

  return {
    id: input.id,
    userId: input.userId,
    workoutId: input.id,
    workoutTitle: input.workoutType,
    mode: "manual",
    startedAt: `${input.date}T12:00:00.000Z`,
    endedAt: `${input.date}T13:00:00.000Z`,
    status: input.completed ? "completed" : "ended",
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    setLogs,
  };
}

export function evaluateWorkoutLoggerResult(session: WorkoutSession, recovery: RecoveryContext): WorkoutLoggerResult {
  const setLogs = session.setLogs;
  const uniqueExercises = new Set(setLogs.map((set) => set.exerciseId));
  const highRpeFlags = setLogs.filter((set) => set.rpe > 8);
  const missedRepFlags = setLogs.filter((set) => set.formQuality === "missed");
  const painFlags = setLogs.filter((set) => set.pain);
  const estimatedVolume = round0(setLogs.reduce((sum, set) => sum + set.weightUsed * set.repsCompleted, 0));
  const totalReps = setLogs.reduce((sum, set) => sum + set.repsCompleted, 0);
  const prescribedReps = setLogs.reduce((sum, set) => sum + Number(set.targetReps || 0), 0);
  const completionPercentage = prescribedReps > 0 ? Math.min(100, round0((totalReps / prescribedReps) * 100)) : session.status === "completed" ? 100 : 0;

  let action: WorkoutProgressionAction = "progress";
  let message = "Increase load next time if form stays clean: 5-10 lb for barbell work or 2.5-5 lb for dumbbells.";
  let reason = "All logged sets were completed with RPE <= 8 and no pain flags.";

  if (painFlags.length || highRpeFlags.length || missedRepFlags.length || session.status !== "completed") {
    action = "repeat";
    message = "Repeat the same weight next time until all reps are completed with RPE <= 8 and no pain.";
    reason = "Reps were missed, RPE was high, pain was noted, or the workout was not fully completed.";
  }

  let volumeWarning: WorkoutLoggerResult["volumeWarning"] = null;
  if (recovery.sorenessLevel >= 8 || recovery.sleepHours < 6) {
    const reductionPercent = recovery.sorenessLevel >= 9 || recovery.sleepHours < 5 || (recovery.sorenessLevel >= 8 && recovery.sleepHours < 6) ? 30 : 20;
    volumeWarning = {
      reductionPercent,
      message: `Reduce lifting volume by ${reductionPercent}% before the next workout.`,
      reason: "High soreness or sleep under 6 hours increases recovery risk.",
    };
    if (action === "progress") {
      action = "reduce-volume";
      message = volumeWarning.message;
      reason = volumeWarning.reason;
    }
  }

  const recommendation: PostWorkoutRecommendation = {
    sessionId: session.id,
    workoutId: session.workoutId,
    action,
    message,
    reason,
    createdAt: session.endedAt ?? new Date().toISOString(),
  };

  return {
    summary: {
      sessionId: session.id,
      workoutId: session.workoutId,
      workoutTitle: session.workoutTitle,
      completedAt: session.endedAt ?? session.startedAt,
      completionPercentage,
      exercisesCompleted: uniqueExercises.size,
      totalExercises: uniqueExercises.size,
      totalSets: setLogs.length,
      prescribedSets: setLogs.length,
      totalReps,
      prescribedReps,
      estimatedVolume,
      highRpeFlags,
      missedRepFlags,
      painFlags,
      poorFormFlags: missedRepFlags,
      bestSets: [...setLogs].sort((a, b) => (b.weightUsed * b.repsCompleted) - (a.weightUsed * a.repsCompleted)).slice(0, 3),
      coachSummary: `${session.workoutTitle}: ${setLogs.length} sets, ${totalReps} reps, ${estimatedVolume} lb estimated volume.`,
      nextSessionRecommendations: [recommendation],
    },
    nextProgression: recommendation,
    volumeWarning,
  };
}

export function saveWorkoutLoggerEntry(state: AppState, session: WorkoutSession, recovery: RecoveryContext): { state: AppState; result: WorkoutLoggerResult } {
  const result = evaluateWorkoutLoggerResult(session, recovery);
  const date = session.startedAt.slice(0, 10);
  return {
    state: {
      ...state,
      workoutSessions: [...(state.workoutSessions ?? []).filter((entry) => entry.startedAt.slice(0, 10) !== date), session],
      setLogs: [...(state.setLogs ?? []).filter((entry) => entry.completedAt.slice(0, 10) !== date), ...session.setLogs],
      workoutSummaries: [...(state.workoutSummaries ?? []).filter((entry) => entry.completedAt.slice(0, 10) !== date), result.summary],
      postWorkoutRecommendations: [...(state.postWorkoutRecommendations ?? []).filter((entry) => entry.sessionId !== session.id), result.nextProgression],
    },
    result,
  };
}

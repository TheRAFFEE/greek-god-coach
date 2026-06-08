import type { AppState, WorkoutSession } from "./types";
import { getLocalCalendarDateIso } from "./daily-rollover";

export interface ActiveWorkoutRolloverOptions {
  workoutId: string;
  today?: string;
  now?: Date;
  locale?: string;
  timeZone?: string;
  preferredSessionId?: string | null;
}

export interface ActiveWorkoutProgressSnapshot {
  currentExerciseIndex: number;
  currentSetNumber: number;
  completedSetCount: number;
}

export interface ActiveWorkoutRolloverResult {
  today: string;
  todayWorkoutId: string;
  resumableSession: WorkoutSession | null;
  staleSessions: WorkoutSession[];
  history: WorkoutSession[];
  resumeProgress: ActiveWorkoutProgressSnapshot | null;
  canStartTodayPrescription: boolean;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function sessionDate(session: WorkoutSession, options: Pick<ActiveWorkoutRolloverOptions, "locale" | "timeZone">): string {
  if (session.date && isoDatePattern.test(session.date)) return session.date;
  const parsed = new Date(session.startedAt);
  if (Number.isNaN(parsed.getTime())) return session.startedAt.slice(0, 10);
  return getLocalCalendarDateIso(parsed, options.locale, options.timeZone);
}

function sortNewestFirst(a: WorkoutSession, b: WorkoutSession) {
  return (b.startedAt ?? "").localeCompare(a.startedAt ?? "");
}

export function resolveActiveWorkoutForToday(state: AppState, options: ActiveWorkoutRolloverOptions): ActiveWorkoutRolloverResult {
  const today = options.today ?? getLocalCalendarDateIso(options.now, options.locale, options.timeZone);
  const sessions = [...(state.workoutSessions ?? [])];
  const activeSessions = sessions.filter((session) => session.status === "active");
  const staleSessions = activeSessions
    .filter((session) => sessionDate(session, options) !== today)
    .sort(sortNewestFirst);
  const todayActiveSessions = activeSessions
    .filter((session) => session.workoutId === options.workoutId && sessionDate(session, options) === today)
    .sort(sortNewestFirst);

  const preferred = options.preferredSessionId
    ? todayActiveSessions.find((session) => session.id === options.preferredSessionId) ?? null
    : null;
  const resumableSession = preferred ?? todayActiveSessions[0] ?? null;

  return {
    today,
    todayWorkoutId: options.workoutId,
    resumableSession,
    staleSessions,
    history: sessions,
    resumeProgress: resumableSession
      ? {
          currentExerciseIndex: resumableSession.currentExerciseIndex,
          currentSetNumber: resumableSession.currentSetNumber,
          completedSetCount: resumableSession.setLogs.length,
        }
      : null,
    canStartTodayPrescription: !resumableSession,
  };
}

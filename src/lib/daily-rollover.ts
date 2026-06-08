import type { AppState, DailyCheckIn, NutritionLog } from "./types";
import { deriveDailyCompletionStatus } from "./daily-checkin";

export type DailyBoundaryStatus = "available" | "missing";

export interface DailyRolloverBoundary<T = unknown> {
  status: DailyBoundaryStatus;
  date: string;
  record: T | null;
  message: string;
}

export interface DailyRolloverContext {
  today: string;
  currentWeek: number;
  dayIndex: number;
  planStartDate: string;
  todayCheckIn: DailyCheckIn | null;
  latestPriorCheckIn: DailyCheckIn | null;
  todayNutrition: NutritionLog | null;
  recoveryStatus: DailyRolloverBoundary<DailyCheckIn>;
  nutritionStatus: DailyRolloverBoundary<NutritionLog>;
  completionStatus: { workoutCompleted: boolean; runCompleted: boolean };
  effectiveState: AppState;
}

export interface DailyRolloverOptions {
  now?: Date;
  today?: string;
  locale?: string;
  timeZone?: string;
  maxWeeks?: number;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseIsoDateUtc(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export function getLocalCalendarDateIso(now = new Date(), locale = "en-US", timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return now.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

export function derivePlanDayIndex(today: string): number {
  const day = parseIsoDateUtc(today).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export function deriveCurrentWeekFromPlanStart(startDate: string, today: string, maxWeeks = 12): number {
  if (!isoDatePattern.test(startDate) || !isoDatePattern.test(today)) return 1;
  const start = parseIsoDateUtc(startDate);
  const current = parseIsoDateUtc(today);
  const diff = current.getTime() - start.getTime();
  if (!Number.isFinite(diff)) return 1;
  const days = Math.floor(diff / MS_PER_DAY);
  return clamp(Math.floor(Math.max(0, days) / 7) + 1, 1, maxWeeks);
}

function findTodayCheckIn(state: AppState, today: string): DailyCheckIn | null {
  return (state.checkIns ?? []).find((entry) => entry.date === today) ?? null;
}

function findLatestPriorCheckIn(state: AppState, today: string): DailyCheckIn | null {
  return [...(state.checkIns ?? [])]
    .filter((entry) => entry.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1) ?? null;
}

function findTodayNutrition(state: AppState, today: string): NutritionLog | null {
  return (state.nutritionLogs ?? []).find((entry) => entry.date === today) ?? null;
}

export function buildDailyRolloverContext(state: AppState, options: DailyRolloverOptions = {}): DailyRolloverContext {
  const today = options.today ?? getLocalCalendarDateIso(options.now, options.locale, options.timeZone);
  const planStartDate = isoDatePattern.test(state.startDate) ? state.startDate : today;
  const currentWeek = deriveCurrentWeekFromPlanStart(planStartDate, today, options.maxWeeks ?? 12);
  const dayIndex = derivePlanDayIndex(today);
  const todayCheckIn = findTodayCheckIn(state, today);
  const latestPriorCheckIn = findLatestPriorCheckIn(state, today);
  const todayNutrition = findTodayNutrition(state, today);
  const completionStatus = deriveDailyCompletionStatus(state, today);

  return {
    today,
    currentWeek,
    dayIndex,
    planStartDate,
    todayCheckIn,
    latestPriorCheckIn,
    todayNutrition,
    recoveryStatus: todayCheckIn
      ? { status: "available", date: today, record: todayCheckIn, message: "Today's recovery check-in is available." }
      : { status: "missing", date: today, record: null, message: "Today's recovery check-in is missing. Complete Daily Check-In before treating recovery as current." },
    nutritionStatus: todayNutrition
      ? { status: "available", date: today, record: todayNutrition, message: "Today's nutrition log is available." }
      : { status: "missing", date: today, record: null, message: "Today's nutrition log is missing. Log meals for the current day." },
    completionStatus,
    effectiveState: state.currentWeek === currentWeek ? state : { ...state, currentWeek },
  };
}

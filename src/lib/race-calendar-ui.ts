import { evaluateAdaptiveTrainingCalendar, type AdaptiveCalendarWeek, type AdaptiveTrainingCalendarResult } from "./adaptive-training-calendar-engine";
import { evaluateRaceCalendar, type RaceCalendarEngineResult, type RaceType } from "./race-calendar-engine";
import type { AppState, RunLog } from "./types";

export interface RaceCalendarUiOptions {
  today: string;
  raceDate?: string;
  raceType?: RaceType;
  previewWeeks?: number;
  targetRacePace?: number;
  currentLongestRun?: number;
  currentWeeklyMileage?: number;
}

export interface RaceCalendarRoadmapPreviewItem {
  weekLabel: string;
  phase: string;
  mileageTrend: string;
  targetLongRun: string;
  targetWeeklyMileage: string;
  focus: string;
}

export interface RaceCalendarUiModel {
  countdown: { label: "Race countdown"; value: string; sub: string };
  thisWeek: { title: "This week"; trainingWeek: string; phase: string; focus: string; targetLongRun: string; targetWeeklyMileage: string };
  readiness: { label: "Race readiness"; value: string; sub: string };
  nextMilestone: { label: "Next milestone"; value: string; sub: string };
  peakTaper: { title: "Peak/Taper"; nextDeloadWeek: string; expectedPeakWeek: string; expectedPeakLongRun: string; expectedPeakMileage: string };
  roadmapPreview: RaceCalendarRoadmapPreviewItem[];
  hasLowData: boolean;
  emptyState: { title: string; copy: string };
  summaries: { race: string; roadmap: string };
  auditTrail: string[];
  engineResults: { raceCalendar: RaceCalendarEngineResult; adaptiveCalendar: AdaptiveTrainingCalendarResult };
}

const DEFAULT_RACE_DATE = "2027-01-17";
const DEFAULT_TARGET_RACE_PACE = 9;

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function completedRuns(state: AppState): RunLog[] {
  return [...(state.runLogs ?? [])].filter((run) => run.completed && run.actualDistance > 0);
}

function longestCompletedRun(state: AppState): number | undefined {
  const distances = completedRuns(state).map((run) => run.actualDistance).filter((distance) => Number.isFinite(distance));
  return distances.length ? Math.max(...distances) : undefined;
}

function weeklyMileage(state: AppState, today: string): number | undefined {
  const end = toDate(today);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  const startIso = start.toISOString().slice(0, 10);
  const total = completedRuns(state)
    .filter((run) => run.date >= startIso && run.date <= today)
    .reduce((sum, run) => sum + run.actualDistance, 0);
  return total > 0 ? Math.round(total) : undefined;
}

function predictedRacePace(state: AppState): number | undefined {
  const runs = completedRuns(state).filter((run) => run.durationMinutes > 0 && run.actualDistance > 0);
  if (!runs.length) return undefined;
  const bestLongRun = [...runs].sort((a, b) => b.actualDistance - a.actualDistance || a.averagePace - b.averagePace)[0];
  if (!bestLongRun) return undefined;
  return Math.round(bestLongRun.averagePace * 100) / 100;
}

function formatMiles(value: number): string {
  return `${value} mi`;
}

function formatWeek(value?: number): string {
  return value === undefined ? "Need roadmap data" : `Week ${value}`;
}

function formatRoadmapWeek(week: AdaptiveCalendarWeek): RaceCalendarRoadmapPreviewItem {
  return {
    weekLabel: `Week ${week.weekNumber}`,
    phase: week.phase,
    mileageTrend: week.mileageTrend,
    targetLongRun: formatMiles(week.targetLongRun),
    targetWeeklyMileage: `${week.targetWeeklyMileage} mi/week`,
    focus: week.focus,
  };
}

export function buildRaceCalendarUiModel(state: AppState, options: RaceCalendarUiOptions): RaceCalendarUiModel {
  const savedSettings = state.raceCalendarSettings;
  const raceDate = options.raceDate ?? savedSettings?.raceDate ?? DEFAULT_RACE_DATE;
  const raceType = options.raceType ?? savedSettings?.raceType ?? "HalfMarathon";
  const previewWeeks = options.previewWeeks ?? 5;
  const longestRun = options.currentLongestRun ?? savedSettings?.currentLongestRun ?? longestCompletedRun(state);
  const currentWeeklyMileage = options.currentWeeklyMileage ?? savedSettings?.currentWeeklyMileage ?? weeklyMileage(state, options.today);
  const predictedPace = predictedRacePace(state);
  const targetRacePace = options.targetRacePace ?? savedSettings?.targetRacePace ?? DEFAULT_TARGET_RACE_PACE;

  const raceCalendar = evaluateRaceCalendar({
    today: toDate(options.today),
    raceDate: toDate(raceDate),
    raceType,
    targetPace: targetRacePace,
    predictedRacePace: predictedPace,
    longestCompletedRun: longestRun,
  });
  const adaptiveCalendar = evaluateAdaptiveTrainingCalendar({
    today: toDate(options.today),
    raceDate: toDate(raceDate),
    raceType,
    currentLongestRun: longestRun,
    currentWeeklyMileage,
    targetRacePace,
    predictedRacePace: predictedPace,
  });

  const thisWeek = adaptiveCalendar.calendarWeeks[0];
  const roadmapPreview = adaptiveCalendar.calendarWeeks.slice(0, Math.max(1, Math.min(6, previewWeeks))).map(formatRoadmapWeek);
  const hasLowData = longestRun === undefined || currentWeeklyMileage === undefined || predictedPace === undefined || raceCalendar.readiness === "Unknown";

  return {
    countdown: { label: "Race countdown", value: raceCalendar.raceCountdownText, sub: raceDate },
    thisWeek: {
      title: "This week",
      trainingWeek: `Week ${raceCalendar.trainingWeek} of ${raceCalendar.totalTrainingWeeks}`,
      phase: raceCalendar.phase,
      focus: thisWeek?.focus ?? "Need roadmap data",
      targetLongRun: thisWeek ? formatMiles(thisWeek.targetLongRun) : "Need roadmap data",
      targetWeeklyMileage: thisWeek ? `${thisWeek.targetWeeklyMileage} mi/week` : "Need roadmap data",
    },
    readiness: { label: "Race readiness", value: raceCalendar.readiness, sub: raceCalendar.paceGap === undefined ? "Need recent completed runs for a prediction" : `${raceCalendar.paceGap >= 0 ? "+" : ""}${raceCalendar.paceGap} min/mi vs target` },
    nextMilestone: { label: "Next milestone", value: adaptiveCalendar.nextMilestone, sub: adaptiveCalendar.summary },
    peakTaper: {
      title: "Peak/Taper",
      nextDeloadWeek: formatWeek(adaptiveCalendar.nextDeloadWeek),
      expectedPeakWeek: `Week ${adaptiveCalendar.expectedPeakWeek}`,
      expectedPeakLongRun: formatMiles(adaptiveCalendar.expectedPeakLongRun),
      expectedPeakMileage: adaptiveCalendar.expectedPeakMileage,
    },
    roadmapPreview,
    hasLowData,
    emptyState: {
      title: hasLowData ? "Need running data for calendar confidence" : "Race calendar ready",
      copy: hasLowData ? "Log recent completed runs with distance and duration to improve race readiness and roadmap confidence." : "Race countdown and adaptive roadmap are available from the calendar engines.",
    },
    summaries: { race: raceCalendar.summary, roadmap: adaptiveCalendar.summary },
    auditTrail: [...raceCalendar.auditTrail, ...adaptiveCalendar.auditTrail],
    engineResults: { raceCalendar, adaptiveCalendar },
  };
}

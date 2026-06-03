import type { RaceType } from "./race-calendar-engine";

export type CalendarWeekPhase = "Base" | "Build" | "Peak" | "Taper" | "RaceWeek";
export type MileageTrend = "Increase" | "Maintain" | "Deload";

export interface AdaptiveTrainingCalendarInput {
  raceDate: Date;
  today: Date;
  raceType: RaceType;
  currentLongestRun?: number;
  currentWeeklyMileage?: number;
  targetRacePace?: number;
  predictedRacePace?: number;
}

export interface AdaptiveCalendarWeek {
  weekNumber: number;
  phase: CalendarWeekPhase;
  mileageTrend: MileageTrend;
  targetLongRun: number;
  targetWeeklyMileage: number;
  focus: string;
}

export interface AdaptiveTrainingCalendarResult {
  totalWeeksRemaining: number;
  currentTrainingWeek: number;
  calendarWeeks: AdaptiveCalendarWeek[];
  nextMilestone: string;
  nextDeloadWeek?: number;
  expectedPeakWeek: number;
  expectedPeakLongRun: number;
  expectedPeakMileage: string;
  summary: string;
  auditTrail: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HALF_MARATHON_TOTAL_WEEKS = 16;

function dateOnlyUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysBetween(today: Date, raceDate: Date): number {
  return Math.ceil((dateOnlyUtc(raceDate) - dateOnlyUtc(today)) / MS_PER_DAY);
}

function roundMileage(value: number): number {
  return Math.round(value);
}

function totalPlanWeeks(raceType: RaceType): number {
  if (raceType === "HalfMarathon") return HALF_MARATHON_TOTAL_WEEKS;
  if (raceType === "Marathon") return 20;
  if (raceType === "10K") return 12;
  if (raceType === "5K") return 8;
  return 12;
}

function phaseForProgramWeek(weekNumber: number, totalWeeks: number, raceType: RaceType): CalendarWeekPhase {
  if (weekNumber >= totalWeeks) return "RaceWeek";
  if (raceType === "HalfMarathon" && totalWeeks === HALF_MARATHON_TOTAL_WEEKS) {
    if (weekNumber <= 4) return "Base";
    if (weekNumber <= 9) return "Build";
    if (weekNumber <= 13) return "Peak";
    if (weekNumber <= 15) return "Taper";
    return "RaceWeek";
  }

  const weeksToRace = totalWeeks - weekNumber + 1;
  if (weeksToRace <= 1) return "RaceWeek";
  if (weeksToRace <= 3) return "Taper";
  if (weeksToRace <= 7) return "Peak";
  if (weeksToRace <= 12) return "Build";
  return "Base";
}

function focusForPhase(phase: CalendarWeekPhase): string {
  if (phase === "Base") return "Aerobic Base";
  if (phase === "Build") return "Mileage Development";
  if (phase === "Peak") return "Race Specific Fitness";
  if (phase === "Taper") return "Recovery + Sharpness";
  return "Race Execution";
}

function interpolate(weekNumber: number, startWeek: number, endWeek: number, startValue: number, endValue: number): number {
  if (startWeek === endWeek) return endValue;
  const ratio = (weekNumber - startWeek) / (endWeek - startWeek);
  return Math.round(startValue + ratio * (endValue - startValue));
}

function halfMarathonLongRun(weekNumber: number): number {
  if (weekNumber <= 4) return interpolate(weekNumber, 1, 4, 6, 8);
  if (weekNumber <= 9) return interpolate(weekNumber, 5, 9, 8, 10);
  if (weekNumber <= 13) return interpolate(weekNumber, 10, 13, 10, 13);
  if (weekNumber <= 15) return interpolate(weekNumber, 14, 15, 8, 6);
  return 0;
}

function targetLongRunFor(weekNumber: number, raceType: RaceType, totalWeeks: number): number {
  if (raceType === "HalfMarathon" && totalWeeks === HALF_MARATHON_TOTAL_WEEKS) return halfMarathonLongRun(weekNumber);
  const phase = phaseForProgramWeek(weekNumber, totalWeeks, raceType);
  if (phase === "RaceWeek") return 0;
  if (raceType === "Marathon") {
    if (phase === "Base") return 12;
    if (phase === "Build") return 16;
    if (phase === "Peak") return 20;
    return 10;
  }
  if (raceType === "10K") {
    if (phase === "Base") return 5;
    if (phase === "Build") return 6;
    if (phase === "Peak") return 8;
    return 4;
  }
  if (raceType === "5K") {
    if (phase === "Base") return 4;
    if (phase === "Build") return 5;
    if (phase === "Peak") return 6;
    return 3;
  }
  if (phase === "Base") return 6;
  if (phase === "Build") return 8;
  if (phase === "Peak") return 10;
  return 6;
}

function mileageTrendFor(weekNumber: number, phase: CalendarWeekPhase): MileageTrend {
  if (phase !== "RaceWeek" && weekNumber % 4 === 0) return "Deload";
  if (phase === "Peak" || phase === "Taper" || phase === "RaceWeek") return "Maintain";
  return "Increase";
}

function targetMileageFor(weekNumber: number, phase: CalendarWeekPhase, baselineMileage: number, hasCurrentMileage: boolean): number {
  if (phase === "RaceWeek") return 0;
  if (!hasCurrentMileage && weekNumber === 1) return roundMileage(baselineMileage);
  if (weekNumber % 4 === 0) return roundMileage(baselineMileage * 1.0);
  if (phase === "Base") return roundMileage(baselineMileage * (1 + 0.1 * weekNumber));
  if (phase === "Build") return roundMileage(baselineMileage * (1.2 + 0.05 * (weekNumber - 4)));
  if (phase === "Peak") return roundMileage(Math.min(40, Math.max(30, baselineMileage * 1.5)));
  return roundMileage(Math.max(0, baselineMileage * 0.8));
}

function expectedPeakMileageFor(raceType: RaceType): string {
  if (raceType === "HalfMarathon") return "30-40 miles";
  if (raceType === "Marathon") return "40-55 miles";
  if (raceType === "10K") return "20-30 miles";
  if (raceType === "5K") return "15-25 miles";
  return "20-30 miles";
}

function expectedPeakLongRunFor(raceType: RaceType): number {
  if (raceType === "HalfMarathon") return 13;
  if (raceType === "Marathon") return 22;
  if (raceType === "10K") return 8;
  if (raceType === "5K") return 6;
  return 10;
}

function firstWeekOfPhase(calendarWeeks: AdaptiveCalendarWeek[], phase: CalendarWeekPhase): number | undefined {
  return calendarWeeks.find((week) => week.phase === phase)?.weekNumber;
}

function selectMilestone(calendarWeeks: AdaptiveCalendarWeek[], currentLongestRun: number): string {
  if (currentLongestRun < 10 && calendarWeeks.some((week) => week.targetLongRun >= 10)) return "Reach first 10 mile run";
  if (calendarWeeks[0]?.phase === "Peak" || calendarWeeks[0]?.phase === "Taper") return calendarWeeks.some((week) => week.phase === "Taper") ? "Race taper begins" : "Race week begins";
  if (calendarWeeks.some((week) => week.phase === "Peak")) return "Enter Peak phase";
  if (calendarWeeks.some((week) => week.phase === "Taper")) return "Race taper begins";
  if (calendarWeeks.some((week) => week.phase === "RaceWeek")) return "Race week begins";
  return "Maintain training consistency";
}

function weeksUntilPhase(calendarWeeks: AdaptiveCalendarWeek[], phase: CalendarWeekPhase): number | undefined {
  const first = firstWeekOfPhase(calendarWeeks, phase);
  const current = calendarWeeks[0]?.weekNumber;
  if (first === undefined || current === undefined) return undefined;
  return Math.max(0, first - current);
}

function buildSummary(result: Omit<AdaptiveTrainingCalendarResult, "summary" | "auditTrail">, totalWeeks: number): string {
  const peakBeginsIn = weeksUntilPhase(result.calendarWeeks, "Peak");
  const phaseSentence = peakBeginsIn === undefined
    ? "Peak phase is not in the remaining roadmap."
    : `Peak phase begins in ${peakBeginsIn} weeks.`;
  return `You are in week ${result.currentTrainingWeek} of a ${totalWeeks} week build. ${phaseSentence} Next milestone is ${result.nextMilestone}.`;
}

export function evaluateAdaptiveTrainingCalendar(input: AdaptiveTrainingCalendarInput): AdaptiveTrainingCalendarResult {
  const totalWeeks = totalPlanWeeks(input.raceType);
  const daysRemaining = daysBetween(input.today, input.raceDate);
  const totalWeeksRemaining = Math.max(0, Math.ceil(daysRemaining / 7));
  const currentTrainingWeek = totalWeeksRemaining === 0
    ? totalWeeks
    : Math.max(1, Math.min(totalWeeks, totalWeeks - totalWeeksRemaining + 1));
  const weeksToGenerate = totalWeeksRemaining === 0 ? 0 : Math.min(totalWeeks - currentTrainingWeek + 1, totalWeeksRemaining);
  const baselineMileage = input.currentWeeklyMileage ?? 18;
  const hasCurrentMileage = input.currentWeeklyMileage !== undefined;
  const baselineLongestRun = input.currentLongestRun ?? 6;

  const calendarWeeks: AdaptiveCalendarWeek[] = Array.from({ length: weeksToGenerate }, (_, index) => {
    const weekNumber = currentTrainingWeek + index;
    const phase = phaseForProgramWeek(weekNumber, totalWeeks, input.raceType);
    return {
      weekNumber,
      phase,
      mileageTrend: mileageTrendFor(weekNumber, phase),
      targetLongRun: targetLongRunFor(weekNumber, input.raceType, totalWeeks),
      targetWeeklyMileage: targetMileageFor(weekNumber, phase, baselineMileage, hasCurrentMileage),
      focus: focusForPhase(phase),
    };
  });

  const nextMilestone = selectMilestone(calendarWeeks, baselineLongestRun);
  const expectedPeakLongRun = expectedPeakLongRunFor(input.raceType);
  const expectedPeakMileage = expectedPeakMileageFor(input.raceType);
  const expectedPeakWeek = input.raceType === "HalfMarathon" ? 13 : firstWeekOfPhase(calendarWeeks, "Peak") ?? totalWeeks;
  const nextDeloadWeek = calendarWeeks.find((week) => week.mileageTrend === "Deload")?.weekNumber;

  const resultWithoutNarrative = {
    totalWeeksRemaining,
    currentTrainingWeek,
    calendarWeeks,
    nextMilestone,
    nextDeloadWeek,
    expectedPeakWeek,
    expectedPeakLongRun,
    expectedPeakMileage,
  };

  const auditTrail = [
    `Phase assignments: generated ${calendarWeeks.length} roadmap weeks using ${input.raceType} phase boundaries.`,
    `Deload placement: every fourth week is marked Deload unless RaceWeek; next deload week is ${nextDeloadWeek ?? "none"}.`,
    `Mileage targets: baseline weekly mileage is ${baselineMileage}; Base increases, Build increases gradually, Peak maintains, Deload reduces load.`,
    `Milestone selected: ${nextMilestone}. Current longest run is ${baselineLongestRun}.`,
  ];

  return {
    ...resultWithoutNarrative,
    summary: buildSummary(resultWithoutNarrative, totalWeeks),
    auditTrail,
  };
}

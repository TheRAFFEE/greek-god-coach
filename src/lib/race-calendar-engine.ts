export type RaceType = "HalfMarathon" | "Marathon" | "10K" | "5K" | "Other";
export type TrainingPhase = "Base" | "Build" | "Peak" | "Taper" | "RaceWeek" | "Completed";
export type RaceReadiness = "Ahead" | "OnTrack" | "Behind" | "Unknown";

export interface RaceCalendarEngineInput {
  today: Date;
  raceDate: Date;
  raceType: RaceType;
  targetPace?: number;
  predictedRacePace?: number;
  longRunDistance?: number;
  longestCompletedRun?: number;
}

export interface RaceCalendarEngineResult {
  daysRemaining: number;
  weeksRemaining: number;
  trainingWeek: number;
  totalTrainingWeeks: number;
  phase: TrainingPhase;
  readiness: RaceReadiness;
  targetRacePace?: number;
  predictedRacePace?: number;
  paceGap?: number;
  longestRun?: number;
  recommendedLongRun: string;
  raceCountdownText: string;
  summary: string;
  auditTrail: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateOnlyUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysBetween(today: Date, raceDate: Date): number {
  return Math.ceil((dateOnlyUtc(raceDate) - dateOnlyUtc(today)) / MS_PER_DAY);
}

function totalTrainingWeeksFor(raceType: RaceType): number {
  if (raceType === "Marathon") return 20;
  if (raceType === "HalfMarathon") return 16;
  if (raceType === "10K") return 12;
  if (raceType === "5K") return 8;
  return 12;
}

function phaseFromWeeks(daysRemaining: number, weeksRemaining: number): TrainingPhase {
  if (daysRemaining < 0) return "Completed";
  if (weeksRemaining <= 1) return "RaceWeek";
  if (weeksRemaining <= 3) return "Taper";
  if (weeksRemaining <= 7) return "Peak";
  if (weeksRemaining <= 12) return "Build";
  return "Base";
}

function readinessFromPaces(targetPace?: number, predictedRacePace?: number): RaceReadiness {
  if (targetPace === undefined || predictedRacePace === undefined) return "Unknown";
  const gap = predictedRacePace - targetPace;
  if (gap <= -0.15) return "Ahead";
  if (Math.abs(gap) <= 0.15) return "OnTrack";
  return "Behind";
}

function recommendedLongRunFor(raceType: RaceType, phase: TrainingPhase): string {
  if (phase === "Completed") return "0 miles";
  if (raceType === "HalfMarathon") {
    if (phase === "Base") return "6-8 miles";
    if (phase === "Build") return "8-10 miles";
    if (phase === "Peak") return "10-13 miles";
    if (phase === "Taper") return "6-8 miles";
    return "0 miles";
  }
  if (phase === "RaceWeek") return "0 miles";
  if (raceType === "Marathon") {
    if (phase === "Base") return "10-14 miles";
    if (phase === "Build") return "14-18 miles";
    if (phase === "Peak") return "18-22 miles";
    return "8-12 miles";
  }
  if (raceType === "10K") {
    if (phase === "Base") return "4-5 miles";
    if (phase === "Build") return "5-6 miles";
    if (phase === "Peak") return "6-8 miles";
    return "3-5 miles";
  }
  if (raceType === "5K") {
    if (phase === "Base") return "3-4 miles";
    if (phase === "Build") return "4-5 miles";
    if (phase === "Peak") return "5-6 miles";
    return "2-4 miles";
  }
  if (phase === "Base") return "4-6 miles";
  if (phase === "Build") return "6-8 miles";
  if (phase === "Peak") return "8-10 miles";
  return "4-6 miles";
}

function countdownText(daysRemaining: number, weeksRemaining: number): string {
  if (daysRemaining < 0) return "Race completed";
  if (weeksRemaining <= 1) return "Race week";
  return `${weeksRemaining} weeks until race`;
}

function formatPace(pace: number): string {
  const totalSeconds = Math.round(pace * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function summaryFor(result: Omit<RaceCalendarEngineResult, "summary" | "auditTrail">): string {
  const parts = [
    `You are currently in the ${result.phase} phase with ${result.weeksRemaining} weeks remaining.`,
    `Race readiness is ${result.readiness}.`,
  ];
  if (result.targetRacePace !== undefined && result.predictedRacePace !== undefined) {
    parts.push(`Predicted pace is ${formatPace(result.predictedRacePace)} versus goal pace ${formatPace(result.targetRacePace)}.`);
  }
  return parts.join(" ");
}

export function evaluateRaceCalendar(input: RaceCalendarEngineInput): RaceCalendarEngineResult {
  const daysRemaining = daysBetween(input.today, input.raceDate);
  const weeksRemaining = daysRemaining < 0 ? 0 : Math.ceil(daysRemaining / 7);
  const totalTrainingWeeks = totalTrainingWeeksFor(input.raceType);
  const phase = phaseFromWeeks(daysRemaining, weeksRemaining);
  const readiness = readinessFromPaces(input.targetPace, input.predictedRacePace);
  const paceGap = input.targetPace !== undefined && input.predictedRacePace !== undefined ? round2(input.predictedRacePace - input.targetPace) : undefined;
  const longestRun = input.longestCompletedRun ?? input.longRunDistance;
  const trainingWeek = phase === "Completed"
    ? totalTrainingWeeks
    : Math.max(1, Math.min(totalTrainingWeeks, totalTrainingWeeks - weeksRemaining + 1));
  const resultWithoutNarrative = {
    daysRemaining,
    weeksRemaining,
    trainingWeek,
    totalTrainingWeeks,
    phase,
    readiness,
    targetRacePace: input.targetPace,
    predictedRacePace: input.predictedRacePace,
    paceGap,
    longestRun,
    recommendedLongRun: recommendedLongRunFor(input.raceType, phase),
    raceCountdownText: countdownText(daysRemaining, weeksRemaining),
  };
  const auditTrail = [
    `Phase selected: ${phase}. Weeks remaining is ${weeksRemaining}, days remaining is ${daysRemaining}.`,
    `Readiness selected: ${readiness}. Prediction ${input.predictedRacePace ?? "missing"}, target ${input.targetPace ?? "missing"}.`,
    `Pace comparison: ${paceGap === undefined ? "missing prediction or target" : `${paceGap} minutes per mile gap`}.`,
    `Long run recommendation: ${resultWithoutNarrative.recommendedLongRun} for ${input.raceType} in ${phase} phase.`,
  ];

  return {
    ...resultWithoutNarrative,
    summary: summaryFor(resultWithoutNarrative),
    auditTrail,
  };
}

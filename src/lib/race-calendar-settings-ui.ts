import type { AppState, RaceCalendarSettings } from "./types";

const raceTypes: NonNullable<RaceCalendarSettings["raceType"]>[] = ["HalfMarathon", "Marathon", "10K", "5K", "Other"];
const DEFAULT_FORM: Required<RaceCalendarSettings> = {
  raceDate: "",
  raceType: "HalfMarathon",
  targetRacePace: 9,
  currentLongestRun: 0,
  currentWeeklyMileage: 0,
};

export interface RaceCalendarSettingsForm {
  raceDate: string;
  raceType: NonNullable<RaceCalendarSettings["raceType"]>;
  targetRacePace: number;
  currentLongestRun: number;
  currentWeeklyMileage: number;
}

export interface RaceCalendarSettingsModel {
  hasSettings: boolean;
  form: RaceCalendarSettingsForm;
  summary: Array<{ label: string; value: string }>;
  emptyState: string;
  caveat: string;
}

function isRaceType(value: unknown): value is NonNullable<RaceCalendarSettings["raceType"]> {
  return typeof value === "string" && raceTypes.includes(value as NonNullable<RaceCalendarSettings["raceType"]>);
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function validDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) ? "" : value;
}

function normalizeForm(settings?: RaceCalendarSettings): RaceCalendarSettingsForm {
  return {
    raceDate: validDate(settings?.raceDate) || DEFAULT_FORM.raceDate,
    raceType: isRaceType(settings?.raceType) ? settings.raceType : DEFAULT_FORM.raceType,
    targetRacePace: positiveNumber(settings?.targetRacePace, DEFAULT_FORM.targetRacePace),
    currentLongestRun: positiveNumber(settings?.currentLongestRun, DEFAULT_FORM.currentLongestRun),
    currentWeeklyMileage: positiveNumber(settings?.currentWeeklyMileage, DEFAULT_FORM.currentWeeklyMileage),
  };
}

function displayPace(pace: number): string {
  if (!pace) return "Not set";
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}/mi`;
}

function displayMiles(value: number): string {
  return value > 0 ? `${value} mi` : "Not set";
}

export function buildRaceCalendarSettingsModel(state: AppState): RaceCalendarSettingsModel {
  const form = normalizeForm(state.raceCalendarSettings);
  const hasSettings = Boolean(form.raceDate && state.raceCalendarSettings);
  return {
    hasSettings,
    form,
    summary: [
      { label: "Race date", value: form.raceDate || "Not set" },
      { label: "Race type", value: form.raceType },
      { label: "Target pace", value: displayPace(form.targetRacePace) },
      { label: "Current longest run", value: displayMiles(form.currentLongestRun) },
      { label: "Current weekly mileage", value: displayMiles(form.currentWeeklyMileage) },
    ],
    emptyState: hasSettings ? "Race settings saved." : "Add race settings to personalize the calendar countdown and training roadmap.",
    caveat: "Calendar guidance is planning support only and is not medical advice.",
  };
}

export function saveRaceCalendarSettings(state: AppState, input: Partial<RaceCalendarSettings>): AppState {
  const existing = state.raceCalendarSettings ?? {};
  const merged = { ...existing, ...input };
  const form = normalizeForm(merged);
  const nextSettings: RaceCalendarSettings = {
    ...(form.raceDate ? { raceDate: form.raceDate } : {}),
    raceType: form.raceType,
    ...(form.targetRacePace > 0 ? { targetRacePace: form.targetRacePace } : {}),
    ...(form.currentLongestRun > 0 ? { currentLongestRun: form.currentLongestRun } : {}),
    ...(form.currentWeeklyMileage > 0 ? { currentWeeklyMileage: form.currentWeeklyMileage } : {}),
  };
  return { ...state, raceCalendarSettings: nextSettings };
}

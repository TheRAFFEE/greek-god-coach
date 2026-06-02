import type { AppState } from "./types";

export type FoodScanProviderKind = "mock" | "openai" | "error" | "idle";

export type FoodScanProviderLabel = {
  kind: FoodScanProviderKind;
  label: string;
  detail: string;
};

export type DataConfidenceFocus = "readiness" | "nutrition" | "running" | "workout" | "weekly-review";

export type DataConfidenceNote = {
  label: string;
  confidence: "High" | "Medium" | "Low";
  missingData: string[];
};

const dayMs = 24 * 60 * 60 * 1000;

function inLastDays(date: string | undefined, today: string, days: number) {
  if (!date) return false;
  const current = new Date(`${today}T00:00:00.000Z`).getTime();
  const candidate = new Date(`${date.slice(0, 10)}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(candidate)) return false;
  return candidate >= current - (days - 1) * dayMs && candidate <= current;
}

export function buildFoodScanProviderLabel(input: { provider?: string; error?: string; hasDraft?: boolean; scanning?: boolean }): FoodScanProviderLabel {
  if (input.error) {
    return { kind: "error", label: "Error state", detail: input.error };
  }
  const provider = input.provider?.toLowerCase() ?? "";
  if (provider.includes("openai")) {
    return { kind: "openai", label: "OpenAI / real AI mode", detail: "FOOD_AI_V1 is using the OpenAI vision provider. Review values before saving." };
  }
  if (provider.includes("mock")) {
    return { kind: "mock", label: "Mock mode", detail: "FOOD_AI_V1 is using deterministic mock scan data for safe local testing." };
  }
  if (input.scanning) {
    return { kind: "idle", label: "Scanning", detail: "Provider mode will appear when the scan returns." };
  }
  if (input.hasDraft) {
    return { kind: "idle", label: "Review mode", detail: "Review the scanned values and servings before saving." };
  }
  return { kind: "idle", label: "Ready", detail: "Upload an image and run a label or meal-photo scan." };
}

export function buildAppStateBackupPayload(state: AppState, exportedAt: string) {
  return {
    exportedAt,
    storageKey: "greek-god-coach:v1",
    appStateVersion: 1,
    appState: state,
  };
}

export function buildDataConfidenceNote(state: AppState, focus: DataConfidenceFocus, today: string): DataConfidenceNote {
  const recentCheckIns = state.checkIns.filter((entry) => inLastDays(entry.date, today, 7));
  const recentNutrition = state.nutritionLogs.filter((entry) => inLastDays(entry.date, today, 7));
  const recentRuns = (state.runLogs ?? []).filter((entry) => inLastDays(entry.date, today, 7));
  const recentWorkoutLogs = [
    ...(state.exerciseLogs ?? []).filter((entry) => inLastDays(entry.date, today, 7)),
    ...(state.workoutSessions ?? []).filter((entry) => inLastDays(entry.startedAt, today, 7)),
  ];

  const missingByFocus: Record<DataConfidenceFocus, string[]> = {
    readiness: [
      recentCheckIns.length < 3 ? "fewer than 3 recent check-ins" : "",
      recentCheckIns.some((entry) => !entry.sleepHours) ? "sleep missing in recent check-ins" : "",
    ].filter(Boolean),
    nutrition: [
      recentNutrition.length < 3 ? "fewer than 3 nutrition log days" : "",
      recentNutrition.some((entry) => !entry.calories || !entry.protein) ? "calories/protein missing on logged days" : "",
    ].filter(Boolean),
    running: [
      recentRuns.length < 2 ? "fewer than 2 recent run logs" : "",
      recentRuns.some((entry) => !entry.actualDistance || !entry.durationMinutes) ? "distance/duration missing on recent runs" : "",
    ].filter(Boolean),
    workout: [
      recentWorkoutLogs.length < 2 ? "fewer than 2 recent workout records" : "",
      recentCheckIns.length < 3 ? "readiness context is sparse" : "",
    ].filter(Boolean),
    "weekly-review": [
      recentCheckIns.length < 5 ? "fewer than 5 check-ins this week" : "",
      recentNutrition.length < 5 ? "fewer than 5 nutrition log days this week" : "",
      recentRuns.length < 1 ? "no run log this week" : "",
      recentWorkoutLogs.length < 2 ? "fewer than 2 workout records this week" : "",
    ].filter(Boolean),
  };

  const missingData = missingByFocus[focus];
  const confidence = missingData.length === 0 ? "High" : missingData.length <= 2 ? "Medium" : "Low";
  return {
    label: missingData.length ? "Data confidence / missing data" : "Data confidence",
    confidence,
    missingData,
  };
}

import type { HomeAdapterResult, HomeTrainingModel } from "./home-adapter";

export interface HomeAdapterPilotActivationInput {
  search?: string;
  localStorageValue?: string | null;
}

export type HomeAdapterPilotPreviewState =
  | { enabled: false; state: "off"; rows: []; warnings: [] }
  | { enabled: true; state: "unavailable"; title: "Adapter Preview Unavailable"; message: "Use legacy Home only"; rows: []; warnings: [] }
  | { enabled: true; state: "preview"; title: "Developer Preview"; rows: HomeAdapterPilotPreviewRow[]; warnings: string[] };

export interface HomeAdapterPilotPreviewRow {
  label:
    | "Session Type"
    | "Primary Objective"
    | "Workout Summary"
    | "Run Summary"
    | "Support Work"
    | "Duration"
    | "Deload Metadata"
    | "Logging Requirements"
    | "Warnings";
  value: string;
}

export function isHomeAdapterPilotEnabled(input: HomeAdapterPilotActivationInput): boolean {
  return new URLSearchParams(input.search ?? "").get("homeAdapterPilot") === "true";
}

function formatMinutes(minutes: number): string {
  return `${minutes} min`;
}

function formatScheduledItem(item: HomeTrainingModel["workout"]): string {
  if (item.status === "Not Scheduled") return item.name;
  const required = item.required ? "Required" : "Optional";
  const logging = item.loggingRequired ? "logging required" : "no logging required";
  return `${item.name} · ${formatMinutes(item.estimatedDurationMinutes)} · ${item.status} · ${required} · ${logging}`;
}

function formatSupport(model: HomeTrainingModel): string {
  if (!model.support.length) return "None scheduled";
  return model.support.map((item) => `${item.title}: ${item.items.join(", ")}`).join("; ");
}

function formatLogging(model: HomeTrainingModel): string {
  const workout = model.loggingRequirements.workoutLoggingRequired ? "Workout log required" : "Workout log not required";
  const run = model.loggingRequirements.runLoggingRequired ? "Run log required" : "Run log not required";
  return `${workout}; ${run}`;
}

function formatWarnings(result: HomeAdapterResult): string[] {
  return result.diagnostics.filter((diagnostic) => diagnostic.severity === "WARNING").map((diagnostic) => diagnostic.message);
}

export function buildHomeAdapterPilotPreview(input: { enabled: boolean; adapterResult: HomeAdapterResult | null }): HomeAdapterPilotPreviewState {
  if (!input.enabled) return { enabled: false, state: "off", rows: [], warnings: [] };
  if (!input.adapterResult || input.adapterResult.status === "BLOCKER" || !input.adapterResult.model) {
    return { enabled: true, state: "unavailable", title: "Adapter Preview Unavailable", message: "Use legacy Home only", rows: [], warnings: [] };
  }

  const model = input.adapterResult.model;
  const warnings = formatWarnings(input.adapterResult);
  return {
    enabled: true,
    state: "preview",
    title: "Developer Preview",
    warnings,
    rows: [
      { label: "Session Type", value: model.sessionType },
      { label: "Primary Objective", value: model.primaryObjective },
      { label: "Workout Summary", value: formatScheduledItem(model.workout) },
      { label: "Run Summary", value: formatScheduledItem(model.run) },
      { label: "Support Work", value: formatSupport(model) },
      { label: "Duration", value: `${formatMinutes(model.estimatedDurationMinutes)} total · summary ${formatMinutes(model.durationMetadata.summaryEstimatedDurationMinutes)} · combined load ${formatMinutes(model.durationMetadata.combinedLoadEstimatedDurationMinutes)}` },
      { label: "Deload Metadata", value: model.deload ? "deload=true" : "deload=false" },
      { label: "Logging Requirements", value: formatLogging(model) },
      { label: "Warnings", value: warnings.length ? warnings.join("; ") : "None" },
    ],
  };
}

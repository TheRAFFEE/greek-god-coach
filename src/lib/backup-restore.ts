import type { AppState } from "./types";
import { createInitialState } from "./seed-data";

export const CURRENT_BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_APP_VERSION = "0.1.0";
export const STORAGE_KEY = "greek-god-coach:v1";
export const LAST_BACKUP_DATE_KEY = "greek-god-coach:last-backup-date";
export const PRE_RESTORE_BACKUP_KEY = "greek-god-coach:pre_restore_backup";
export const SNAPSHOT_KEYS = {
  current: "greek-god-coach:snapshot:current",
  previous: "greek-god-coach:snapshot:previous",
  previousPrevious: "greek-god-coach:snapshot:previous_previous",
} as const;

export type BackupValidationStatus = "VALID" | "WARNING" | "INVALID";
export type BackupHealthStatus = "GREEN" | "YELLOW" | "RED";

export type AppStateCounts = {
  workouts: number;
  runs: number;
  meals: number;
  bodyMetrics: number;
  photos: number;
};

export type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  appState: AppState;
};

export type BackupValidationResult = {
  status: BackupValidationStatus;
  messages: string[];
  payload?: BackupPayload;
  summary?: AppStateCounts;
};

export type RestoreResult = {
  status: "restored" | "failed";
  state: AppState;
  expectedCounts: AppStateCounts;
  restoredCounts: AppStateCounts;
  messages: string[];
};

export type BackupDashboardModel = {
  title: "Data Protection";
  schemaVersion: number;
  lastBackupDate: string | null;
  backupStatus: string;
  health: { status: BackupHealthStatus; message: string };
  counts: AppStateCounts;
};

const requiredArraySections: Array<keyof AppState> = [
  "checkIns",
  "bodyMetrics",
  "photos",
  "nutritionLogs",
  "meals",
  "foodScans",
  "runLogs",
  "exerciseLogs",
  "workoutSessions",
  "setLogs",
  "workoutSummaries",
  "postWorkoutRecommendations",
  "adjustments",
  "macroTargets",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isValidIsoLike(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function coerceBackupAppState(raw: unknown): AppState {
  const defaults = createInitialState();
  if (!isRecord(raw)) return defaults;
  const state = raw as Partial<AppState>;
  return {
    ...defaults,
    ...state,
    user: isRecord(state.user) ? { ...defaults.user, ...state.user } : defaults.user,
    appMode: state.appMode === "coach" || state.appMode === "tracker" || state.appMode === "manual" ? state.appMode : defaults.appMode,
    currentWeek: typeof state.currentWeek === "number" ? state.currentWeek : defaults.currentWeek,
    startDate: typeof state.startDate === "string" ? state.startDate : defaults.startDate,
    checkIns: Array.isArray(state.checkIns) ? state.checkIns : defaults.checkIns,
    bodyMetrics: Array.isArray(state.bodyMetrics) ? state.bodyMetrics : defaults.bodyMetrics,
    photos: Array.isArray(state.photos) ? state.photos : defaults.photos,
    nutritionLogs: Array.isArray(state.nutritionLogs) ? state.nutritionLogs : defaults.nutritionLogs,
    meals: Array.isArray(state.meals) ? state.meals : defaults.meals,
    foodScans: Array.isArray(state.foodScans) ? state.foodScans : defaults.foodScans,
    runLogs: Array.isArray(state.runLogs) ? state.runLogs : defaults.runLogs,
    exerciseLogs: Array.isArray(state.exerciseLogs) ? state.exerciseLogs : defaults.exerciseLogs,
    workoutSessions: Array.isArray(state.workoutSessions) ? state.workoutSessions : defaults.workoutSessions,
    setLogs: Array.isArray(state.setLogs) ? state.setLogs : defaults.setLogs,
    workoutSummaries: Array.isArray(state.workoutSummaries) ? state.workoutSummaries : defaults.workoutSummaries,
    postWorkoutRecommendations: Array.isArray(state.postWorkoutRecommendations) ? state.postWorkoutRecommendations : defaults.postWorkoutRecommendations,
    adjustments: Array.isArray(state.adjustments) ? state.adjustments : defaults.adjustments,
    macroTargets: Array.isArray(state.macroTargets) ? state.macroTargets : defaults.macroTargets,
  };
}

export function appStateCounts(state: AppState): AppStateCounts {
  return {
    workouts: (state.workoutSessions ?? []).length,
    runs: (state.runLogs ?? []).length,
    meals: (state.meals ?? []).length + (state.nutritionLogs ?? []).length,
    bodyMetrics: (state.bodyMetrics ?? []).length,
    photos: (state.photos ?? []).length,
  };
}

export function createBackupPayload(state: AppState, exportedAt = new Date().toISOString()): BackupPayload {
  return {
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt,
    appVersion: BACKUP_APP_VERSION,
    appState: state,
  };
}

export function validateBackupPayload(value: unknown): BackupValidationResult {
  const messages: string[] = [];
  if (!isRecord(value)) return { status: "INVALID", messages: ["Backup must be a JSON object."] };

  const schemaVersion = value.schemaVersion;
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    messages.push("schemaVersion exists and must be a number.");
  } else if (schemaVersion > CURRENT_BACKUP_SCHEMA_VERSION) {
    messages.push(`Backup uses a future schema version (${schemaVersion}); this app supports ${CURRENT_BACKUP_SCHEMA_VERSION}.`);
  } else if (schemaVersion < CURRENT_BACKUP_SCHEMA_VERSION) {
    messages.push("Backup is from an older schema; migration will be attempted before restore.");
  }

  if (!isValidIsoLike(value.exportedAt)) messages.push("exportedAt must be a valid date string.");
  if (typeof value.appVersion !== "string" || !value.appVersion.trim()) messages.push("appVersion must be present.");
  if (!isRecord(value.appState)) messages.push("appState must be present.");

  const rawAppState = value.appState;
  if (isRecord(rawAppState)) {
    if (!isRecord(rawAppState.user)) messages.push("Missing required AppState section: user.");
    if (typeof rawAppState.appMode !== "string") messages.push("Missing required AppState section: appMode.");
    if (typeof rawAppState.currentWeek !== "number") messages.push("Missing required AppState section: currentWeek.");
    if (typeof rawAppState.startDate !== "string") messages.push("Missing required AppState section: startDate.");
    requiredArraySections.forEach((section) => {
      if (!Array.isArray(rawAppState[section])) messages.push(`Missing required AppState section: ${section}.`);
    });
  }

  const hasHardError = messages.some((message) =>
    message.includes("future schema") ||
    message.includes("must be present") ||
    message.includes("must be a JSON object") ||
    message.includes("schemaVersion exists") ||
    message.includes("required AppState section")
  );
  if (hasHardError) return { status: "INVALID", messages };

  const payload: BackupPayload = {
    schemaVersion: schemaVersion as number,
    exportedAt: value.exportedAt as string,
    appVersion: value.appVersion as string,
    appState: coerceBackupAppState(rawAppState),
  };
  return {
    status: messages.length ? "WARNING" : "VALID",
    messages: messages.length ? messages : ["Backup is valid."],
    payload,
    summary: appStateCounts(payload.appState),
  };
}

export function parseAndValidateBackupJson(json: string): BackupValidationResult {
  try {
    return validateBackupPayload(JSON.parse(json));
  } catch {
    return { status: "INVALID", messages: ["Backup file must contain valid JSON."] };
  }
}

export function verifyRestoreCounts(expected: AppStateCounts, restored: AppStateCounts) {
  const messages = (Object.keys(expected) as Array<keyof AppStateCounts>)
    .filter((key) => expected[key] !== restored[key])
    .map((key) => `${key} count mismatch: expected ${expected[key]}, restored ${restored[key]}.`);
  return { ok: messages.length === 0, messages: messages.length ? messages : ["Restore counts match imported backup."] };
}

export function rotateSnapshots<T>(existing: { current: T | null; previous: T | null; previousPrevious: T | null }, next: T) {
  return {
    current: next,
    previous: existing.current,
    previousPrevious: existing.previous,
  };
}

function readCurrentStateFromStorage(): AppState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return coerceBackupAppState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writePreRestoreBackup(exportedAt = new Date().toISOString()): BackupPayload | null {
  if (typeof window === "undefined") return null;
  const currentState = readCurrentStateFromStorage();
  if (!currentState) return null;
  const backup = createBackupPayload(currentState, exportedAt);
  window.localStorage.setItem(PRE_RESTORE_BACKUP_KEY, JSON.stringify(backup));
  return backup;
}

export function restoreBackupPayload(payload: BackupPayload, options: { persist?: boolean } = {}): RestoreResult {
  const state = coerceBackupAppState(payload.appState);
  const expectedCounts = appStateCounts(payload.appState);
  const restoredCounts = appStateCounts(state);
  const verification = verifyRestoreCounts(expectedCounts, restoredCounts);
  if (!verification.ok) return { status: "failed", state, expectedCounts, restoredCounts, messages: verification.messages };

  if (options.persist && typeof window !== "undefined") {
    writePreRestoreBackup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  return { status: "restored", state, expectedCounts, restoredCounts, messages: verification.messages };
}

export function buildBackupDashboardModel(state: AppState, lastBackupDate: string | null, now = new Date().toISOString()): BackupDashboardModel {
  let status: BackupHealthStatus = "RED";
  let message = "Never backed up";
  if (lastBackupDate) {
    const ageMs = new Date(now).getTime() - new Date(lastBackupDate).getTime();
    const ageDays = Number.isFinite(ageMs) ? Math.floor(ageMs / (24 * 60 * 60 * 1000)) : Number.POSITIVE_INFINITY;
    if (ageDays <= 30) {
      status = "GREEN";
      message = "Backup exists";
    } else {
      status = "YELLOW";
      message = "No backup in last 30 days";
    }
  }

  return {
    title: "Data Protection",
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    lastBackupDate,
    backupStatus: message,
    health: { status, message },
    counts: appStateCounts(state),
  };
}

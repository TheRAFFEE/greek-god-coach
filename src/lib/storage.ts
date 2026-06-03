import type { AppMode, AppState, MacroTarget, Meal, MealCategory, MealItem, RaceCalendarSettings } from "./types";
import { createInitialState } from "./seed-data";
import { createBackupPayload, LAST_BACKUP_DATE_KEY, PRE_RESTORE_BACKUP_KEY, SNAPSHOT_KEYS, STORAGE_KEY, type BackupPayload } from "./backup-restore";

const key = STORAGE_KEY;

export { LAST_BACKUP_DATE_KEY, PRE_RESTORE_BACKUP_KEY, SNAPSHOT_KEYS, STORAGE_KEY };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const asNumber = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const asString = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const isAppMode = (value: unknown): value is AppMode => value === "coach" || value === "tracker" || value === "manual";
const mealCategories: MealCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout", "Post-workout", "Custom"];
const isMealCategory = (value: unknown): value is MealCategory => typeof value === "string" && mealCategories.includes(value as MealCategory);
const raceTypes: NonNullable<RaceCalendarSettings["raceType"]>[] = ["HalfMarathon", "Marathon", "10K", "5K", "Other"];
const isRaceType = (value: unknown): value is NonNullable<RaceCalendarSettings["raceType"]> => typeof value === "string" && raceTypes.includes(value as NonNullable<RaceCalendarSettings["raceType"]>);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const asOptionalPositiveNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

function normalizeRaceCalendarSettings(value: unknown): RaceCalendarSettings | undefined {
  if (!isRecord(value)) return undefined;
  const settings: RaceCalendarSettings = {};
  if (typeof value.raceDate === "string" && isoDatePattern.test(value.raceDate) && !Number.isNaN(Date.parse(`${value.raceDate}T00:00:00.000Z`))) settings.raceDate = value.raceDate;
  if (isRaceType(value.raceType)) settings.raceType = value.raceType;
  settings.targetRacePace = asOptionalPositiveNumber(value.targetRacePace);
  settings.currentLongestRun = asOptionalPositiveNumber(value.currentLongestRun);
  settings.currentWeeklyMileage = asOptionalPositiveNumber(value.currentWeeklyMileage);
  return Object.keys(settings).length ? settings : undefined;
}

function normalizeMacroTargets(value: unknown, defaults: MacroTarget[]): MacroTarget[] {
  const rawTargets = asArray<Partial<MacroTarget>>(value).filter(isRecord);
  const byWeek = new Map<number, MacroTarget>();
  defaults.forEach((target, index) => byWeek.set(target.week ?? index + 1, { ...target }));
  rawTargets.forEach((target, index) => {
    const fallback = defaults[index] ?? defaults[0];
    const week = asNumber(target.week, fallback?.week ?? index + 1);
    byWeek.set(week, {
      ...fallback,
      ...target,
      week,
      calories: asNumber(target.calories, fallback?.calories ?? 0),
      protein: asNumber(target.protein, fallback?.protein ?? 0),
      proteinMax: target.proteinMax === undefined ? fallback?.proteinMax : asNumber(target.proteinMax, fallback?.proteinMax),
      carbs: asNumber(target.carbs, fallback?.carbs ?? 0),
      fat: asNumber(target.fat, fallback?.fat ?? 0),
      fiber: asNumber(target.fiber, fallback?.fiber ?? 0),
      water: asNumber(target.water, fallback?.water ?? 0),
    });
  });
  return Array.from(byWeek.values()).sort((a, b) => (a.week ?? 0) - (b.week ?? 0));
}

function normalizeMealItem(value: unknown, fallbackMealId: string): MealItem | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id, `meal-item-${fallbackMealId}-${Math.random().toString(16).slice(2)}`),
    mealId: asString(value.mealId, fallbackMealId),
    name: asString(value.name, "Food item"),
    calories: asNumber(value.calories),
    protein: asNumber(value.protein),
    carbs: asNumber(value.carbs),
    fat: asNumber(value.fat),
    fiber: asNumber(value.fiber),
    sodium: asNumber(value.sodium),
    water: asNumber(value.water),
    notes: asString(value.notes),
  };
}

function normalizeMeal(value: unknown, defaults: AppState): Meal | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id, `meal-${asString(value.date, todayIso())}-${Math.random().toString(16).slice(2)}`);
  return {
    id,
    userId: asString(value.userId, defaults.user.id),
    date: asString(value.date, todayIso()),
    category: isMealCategory(value.category) ? value.category : "Custom",
    name: asString(value.name, "Migrated meal"),
    calories: asNumber(value.calories),
    protein: asNumber(value.protein),
    carbs: asNumber(value.carbs),
    fat: asNumber(value.fat),
    fiber: asNumber(value.fiber),
    sodium: asNumber(value.sodium),
    water: asNumber(value.water),
    notes: asString(value.notes),
    items: asArray(value.items).map((item) => normalizeMealItem(item, id)).filter((item): item is MealItem => Boolean(item)),
  };
}

export function migrateAppState(raw: unknown): AppState {
  const defaults = createInitialState();
  if (!isRecord(raw)) return defaults;
  const state: AppState = {
    ...defaults,
    ...raw,
    user: isRecord(raw.user) ? { ...defaults.user, ...raw.user } : defaults.user,
    appMode: isAppMode(raw.appMode) ? raw.appMode : "coach",
    currentWeek: asNumber(raw.currentWeek, defaults.currentWeek),
    startDate: asString(raw.startDate, defaults.startDate),
    checkIns: asArray<Partial<import("./types").DailyCheckIn>>(raw.checkIns).map((entry) => ({ ...entry, runCompleted: typeof entry.runCompleted === "boolean" ? entry.runCompleted : false })) as import("./types").DailyCheckIn[],
    bodyMetrics: asArray(raw.bodyMetrics),
    photos: asArray(raw.photos),
    nutritionLogs: asArray(raw.nutritionLogs),
    meals: asArray(raw.meals).map((meal) => normalizeMeal(meal, defaults)).filter((meal): meal is Meal => Boolean(meal)),
    foodScans: asArray(raw.foodScans),
    runLogs: asArray(raw.runLogs),
    exerciseLogs: asArray(raw.exerciseLogs),
    workoutSessions: asArray(raw.workoutSessions),
    setLogs: asArray(raw.setLogs),
    workoutSummaries: asArray(raw.workoutSummaries),
    postWorkoutRecommendations: asArray(raw.postWorkoutRecommendations),
    adjustments: asArray(raw.adjustments),
    macroTargets: normalizeMacroTargets(raw.macroTargets, defaults.macroTargets),
    raceCalendarSettings: normalizeRaceCalendarSettings(raw.raceCalendarSettings),
  };
  return state;
}

export type StateLoadResult =
  | { status: "ready"; state: AppState; recoveryOptions: { hasSnapshot: boolean; hasPreRestoreBackup: boolean } }
  | { status: "empty"; state: AppState; recoveryOptions: { hasSnapshot: boolean; hasPreRestoreBackup: boolean } }
  | { status: "corrupt"; state: null; recoveryOptions: { hasSnapshot: boolean; hasPreRestoreBackup: boolean }; message: string };

function hasStoredRecoveryBackup(storage: Storage, recoveryKey: string) {
  return Boolean(storage.getItem(recoveryKey));
}

function recoveryOptions(storage: Storage) {
  return {
    hasSnapshot: hasStoredRecoveryBackup(storage, SNAPSHOT_KEYS.current),
    hasPreRestoreBackup: hasStoredRecoveryBackup(storage, PRE_RESTORE_BACKUP_KEY),
  };
}

function readBackupPayload(storage: Storage, backupKey: string): BackupPayload | null {
  const raw = storage.getItem(backupKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BackupPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.appState) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadStateWithRecovery(): StateLoadResult {
  if (typeof window === "undefined") return { status: "empty", state: createInitialState(), recoveryOptions: { hasSnapshot: false, hasPreRestoreBackup: false } };
  const storage = window.localStorage;
  const raw = storage.getItem(key);
  const options = recoveryOptions(storage);
  if (!raw) return { status: "empty", state: createInitialState(), recoveryOptions: options };
  try {
    return { status: "ready", state: migrateAppState(JSON.parse(raw)), recoveryOptions: options };
  } catch {
    return { status: "corrupt", state: null, recoveryOptions: options, message: "Saved app data is corrupted. Restore a backup or continue with fresh state." };
  }
}

export function loadState(): AppState {
  const result = loadStateWithRecovery();
  return result.state ?? createInitialState();
}

export function loadRecoveryBackup(kind: "snapshot" | "pre_restore_backup"): AppState | null {
  if (typeof window === "undefined") return null;
  const payload = readBackupPayload(window.localStorage, kind === "snapshot" ? SNAPSHOT_KEYS.current : PRE_RESTORE_BACKUP_KEY);
  return payload ? migrateAppState(payload.appState) : null;
}

export function rotateStoredSnapshots(state: AppState, exportedAt = new Date().toISOString()) {
  if (typeof window === "undefined") return;
  const storage = window.localStorage;
  const previousCurrent = storage.getItem(SNAPSHOT_KEYS.current);
  const previous = storage.getItem(SNAPSHOT_KEYS.previous);
  if (previous) storage.setItem(SNAPSHOT_KEYS.previousPrevious, previous);
  if (previousCurrent) storage.setItem(SNAPSHOT_KEYS.previous, previousCurrent);
  storage.setItem(SNAPSHOT_KEYS.current, JSON.stringify(createBackupPayload(state, exportedAt)));
}

export function saveState(state: AppState) {
  if (typeof window !== "undefined") {
    const migrated = migrateAppState(state);
    window.localStorage.setItem(key, JSON.stringify(migrated));
    rotateStoredSnapshots(migrated);
  }
}

export function resetState() {
  if (typeof window !== "undefined") window.localStorage.removeItem(key);
  return createInitialState();
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

# STATE PERSISTENCE AUDIT

Audit date: 2026-06-03

Scope: audit only. This document reflects implemented code in the current repository state. No app code, UI code, engine code, or tests were modified for this audit.

Files inspected directly:

- `src/app/page.tsx`
- `src/lib/types.ts`
- `src/lib/navigation.ts`
- `src/lib/home-command-center.ts`
- `src/lib/log-tab-ui.ts`
- `src/lib/weekly-review.ts`
- `src/lib/run-logger.ts`
- `src/lib/workout-logger.ts`
- `src/lib/nutrition-engine.ts`
- `src/lib/nutrition-ui.ts`
- `src/lib/goal-tracking-engine.ts`
- `src/lib/progression-engine.ts`

Additional persistence-relevant files found and inspected:

- `src/lib/storage.ts`
- `src/lib/seed-data.ts`
- `src/lib/daily-checkin.ts`
- `src/lib/nutrition-logger.ts`
- `src/lib/supabase-persistence.ts`
- `src/lib/pre-test-cleanup-ui.ts`
- `src/lib/supabase-client.ts`

Repository searches performed for:

- `localStorage`
- `JSON.stringify`
- `JSON.parse`
- `persist`
- `storage`
- `save`
- `load`
- `hydrate`
- `backup`
- `restore`
- `export`
- `import`

---

## 1. Executive Summary

- Is persistence implemented? **YES**
  - `src/lib/storage.ts` implements `loadState()`, `saveState(state)`, `resetState()`, and `migrateAppState(raw)`.
  - `src/app/page.tsx` loads state on mount and saves state whenever React `state` changes.

- Is persistence localStorage-based? **YES**
  - The active browser persistence key is `greek-god-coach:v1`.
  - `saveState()` writes the full migrated `AppState` with `window.localStorage.setItem(key, JSON.stringify(migrateAppState(state)))`.
  - `loadState()` reads that same key and returns `migrateAppState(JSON.parse(raw))`.
  - Supabase sync exists, but even Supabase mode calls `saveState(state)` after sync. Supabase is not the active restore/hydration source in the inspected app shell.

- Can state survive browser refresh? **YES**
  - On client mount, `src/app/page.tsx` runs `useEffect(() => setState(loadState()), [])`.
  - After edits, `useEffect(..., [state, persistenceContext])` saves the whole `AppState` to localStorage if local mode, or saves after Supabase sync/fallback.

- Can state survive browser restart? **PARTIAL**
  - It can survive a normal browser restart if the same browser profile keeps localStorage intact.
  - It does not survive localStorage clearing, private/incognito session disposal, storage quota eviction, browser profile loss, or parse corruption.
  - No restore/import path exists to rebuild localStorage from the exported JSON.

- Is backup currently implemented? **PARTIAL**
  - A manual export exists: `downloadAppStateBackup(state)` in `src/app/page.tsx` creates a JSON Blob using `buildAppStateBackupPayload(state, exportedAt)` and downloads `greek-god-coach-app-state-YYYY-MM-DD.json`.
  - This is an export only. There is no validation, schema version enforcement beyond a literal `appStateVersion: 1`, no restore round trip, no corruption detection, and no photo strategy.

- Is restore currently implemented? **NO**
  - Searches found no implemented import/restore UI or function that reads a backup file and writes `greek-god-coach:v1`.
  - `resetState()` removes the key and returns seed data; it is not a restore feature.

- Is app currently safe for one-year use? **PARTIAL**
  - The core single-browser, same-profile localStorage path can preserve workouts, runs, meals, check-ins, body metrics, photos references, macros, and adjustments across refresh/restart.
  - It is not one-year safe without Backup/Restore Hardening because a corrupted localStorage string silently falls back to seed data, there is no import, photos are only text URL/reference fields or data URLs stored in the same JSON, and localStorage quota/browser cleanup can erase the single source of truth.

---

## 2. Current Persistence Ownership

### Saving owner

Primary saving owner: `src/lib/storage.ts`

Actual functions:

```ts
export function saveState(state: AppState) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(migrateAppState(state)));
}
```

Secondary caller/orchestrator: `src/app/page.tsx`

Actual save trigger:

```ts
useEffect(() => {
  if (!state) return;
  if (!persistenceContext || persistenceContext.mode === "localStorage") {
    saveState(state);
    setPersistenceStatus("localStorage fallback");
    return;
  }
  void syncAppStateToSupabase(state, persistenceContext)
    .then((result) => setPersistenceStatus(result.mode === "supabase" ? `Supabase sync: ${result.syncedTables.length} tables` : "localStorage fallback"))
    .catch(() => { saveState(state); setPersistenceStatus("localStorage fallback after sync error"); });
}, [state, persistenceContext]);
```

Supabase sync owner: `src/lib/supabase-persistence.ts`

Actual behavior:

```ts
export async function syncAppStateToSupabase(state: AppState, context: AuthPersistenceContext): Promise<{ mode: PersistenceMode; syncedTables: string[] }> {
  if (context.mode !== "supabase" || !context.client || !context.databaseUserId) {
    saveState(state);
    return { mode: "localStorage", syncedTables: [] };
  }
  ...upsert tables...
  saveState(state);
  return { mode: "supabase", syncedTables };
}
```

### Loading owner

Primary loading owner: `src/lib/storage.ts`

Actual function:

```ts
export function loadState(): AppState {
  if (typeof window === "undefined") return createInitialState();
  const raw = window.localStorage.getItem(key);
  if (!raw) return createInitialState();
  try {
    return migrateAppState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}
```

### Hydration owner

Hydration owner: `src/app/page.tsx`

Actual function/useEffect:

```ts
const [state, setState] = useState<AppState | null>(null);
useEffect(() => setState(loadState()), []);
```

There is no Supabase load/hydrate path in the inspected app shell. Supabase is write/sync only from current `AppState`.

---

## 3. AppState Audit

Actual `AppState` structure in `src/lib/types.ts`:

```ts
export interface AppState {
  user: UserProfile;
  appMode: AppMode;
  currentWeek: number;
  startDate: string;
  checkIns: DailyCheckIn[];
  bodyMetrics: BodyMetric[];
  photos: ProgressPhoto[];
  nutritionLogs: NutritionLog[];
  meals: Meal[];
  foodScans: FoodScanLog[];
  runLogs: RunLog[];
  exerciseLogs: ExerciseLog[];
  workoutSessions: WorkoutSession[];
  setLogs: SetLog[];
  workoutSummaries: WorkoutSummary[];
  postWorkoutRecommendations: PostWorkoutRecommendation[];
  adjustments: PlanAdjustment[];
  macroTargets: MacroTarget[];
}
```

Category audit:

- `user`
  - Persisted? **YES** in master AppState key.
  - Reconstructed? **PARTIAL** from `createInitialState()` defaults if missing/corrupt; merged with defaults in `migrateAppState()` if `raw.user` is an object.
  - Derived? **NO**.
  - Temporary only? **NO**.

- `appMode`
  - Persisted? **YES**.
  - Reconstructed? **YES** to default `coach` if invalid.
  - Derived? **NO**.
  - Temporary only? **NO**.

- `currentWeek`
  - Persisted? **YES**.
  - Reconstructed? **YES** from defaults if invalid/missing.
  - Derived? **NO**.
  - Temporary only? **NO**.

- `startDate`
  - Persisted? **YES**.
  - Reconstructed? **YES** from defaults if invalid/missing.
  - Derived? **NO**.
  - Temporary only? **NO**.

- Daily check-ins: `checkIns`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL** by `migrateAppState()` as an array. It adds `runCompleted: false` to older entries missing that boolean.
  - Derived? **PARTIAL**: `workoutCompleted` and `runCompleted` are recomputed when saving check-ins through `upsertDailyCheckIn()` using workout/run logs.
  - Temporary only? **NO**.

- Body metrics: `bodyMetrics`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL** as array only; no detailed metric validation beyond array shape.
  - Derived? **PARTIAL**: Daily Check-In save writes a weight-only `BodyMetric` for the same date. Body Metrics UI also writes direct measurement records.
  - Temporary only? **NO**.

- Photos: `photos`
  - Persisted? **YES**, as `ProgressPhoto[]` in AppState.
  - Reconstructed? **PARTIAL** as array only; no validation of URLs/data URLs.
  - Derived? **NO**.
  - Temporary only? **NO**, but the stored values are only string URL/reference fields.

- Nutrition logs: `nutritionLogs`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL** as array only.
  - Derived? **PARTIAL**: Nutrition UI V2 syncs a per-date `NutritionLog` from `meals` via `syncNutritionLogFromNutritionUiV2Meals()`.
  - Temporary only? **NO**.

- Meals: `meals`
  - Persisted? **YES**.
  - Reconstructed? **YES/PARTIAL**: `migrateAppState()` normalizes meal records and meal items with fallback IDs, categories, numeric values, and defaults.
  - Derived? **NO** for stored meals; Nutrition UI derives `MealLog` views from them.
  - Temporary only? **NO**.

- Food scans: `foodScans`
  - Persisted? **YES** as an AppState array.
  - Reconstructed? **PARTIAL** as array only.
  - Derived? **NO**.
  - Temporary only? **NO**, although current FOOD_AI_V1 confirm path saves a `Meal`; this audit did not find a current `updateState` append to `foodScans` in `page.tsx`.

- Runs: `runLogs`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL** as array only.
  - Derived? **NO** for stored logs; running engines derive recommendations/trends from them.
  - Temporary only? **NO**.

- Exercise logs: `exerciseLogs`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL** as array only.
  - Derived? **NO**. Current Train path primarily uses `workoutSessions` and `setLogs`; `exerciseLogs` appears legacy/available but not the main current logger path.
  - Temporary only? **NO**.

- Workout sessions: `workoutSessions`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL** as array only.
  - Derived? **NO** for stored sessions; summaries can be generated from sessions.
  - Temporary only? **NO**.

- Set logs: `setLogs`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL** as array only.
  - Derived? **PARTIAL**: each active workout session also stores `session.setLogs`; top-level `setLogs` duplicates set records for global history/recommendations.
  - Temporary only? **NO**.

- Workout summaries: `workoutSummaries`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL**: Active workout UI can generate a summary if a completed session exists and no stored summary exists, then persists it through `updateState()`.
  - Derived? **YES**, from completed workout sessions.
  - Temporary only? **NO**, once persisted.

- Post-workout recommendations: `postWorkoutRecommendations`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL**: generated from completed workout summaries during active workout completion flow.
  - Derived? **YES**, from workout analysis.
  - Temporary only? **NO**, once persisted.

- Adjustments / coach decisions: `adjustments`
  - Persisted? **YES**.
  - Reconstructed? **PARTIAL**: auto decisions are created in `page.tsx` from daily prescription/readiness/run recommendation, set-by-set decisions, and post-workout summaries. There is duplicate-protection for daily auto decisions.
  - Derived? **YES/PARTIAL** from current state and user actions.
  - Temporary only? **NO**, once persisted.

- Macro targets: `macroTargets`
  - Persisted? **YES**.
  - Reconstructed? **YES/PARTIAL** via `normalizeMacroTargets(raw.macroTargets, defaults.macroTargets)`.
  - Derived? **PARTIAL** from `seed-data.ts` defaults if missing.
  - Temporary only? **NO**.

- Weekly review
  - Persisted? **NO** as a distinct AppState field.
  - Reconstructed? **YES/PARTIAL** by `buildWeeklyReviewSummary(state, { startDate, endDate })` from check-ins, body metrics, run logs, workout sessions, nutrition logs, and engines.
  - Derived? **YES**.
  - Temporary only? **YES** as a computed UI model, not stored.

- Navigation UI state: `active`, `selectedWeek`, `selectedDay`, `activeLogSection`
  - Persisted? **NO**.
  - Reconstructed? **NO**; defaults are `Home`, `1`, `0`, and `checkin` on reload.
  - Derived? **NO**.
  - Temporary only? **YES**.

- Food AI draft/image selection UI state
  - Persisted? **NO** before confirmation.
  - Reconstructed? **NO**.
  - Derived? **NO**.
  - Temporary only? **YES** until confirmed as a meal.

---

## 4. localStorage Audit

Only one implemented `window.localStorage` key was found in app code:

### Key: `greek-god-coach:v1`

- Owner file: `src/lib/storage.ts`
- Declaration:

```ts
const key = "greek-god-coach:v1";
```

- Save path:
  - `src/app/page.tsx` state effect calls `saveState(state)`.
  - `src/lib/supabase-persistence.ts` also calls `saveState(state)` after local fallback or after Supabase sync.
  - `src/lib/storage.ts` writes:

```ts
window.localStorage.setItem(key, JSON.stringify(migrateAppState(state)))
```

- Load path:
  - `src/app/page.tsx` hydration effect calls `loadState()`.
  - `src/lib/storage.ts` reads:

```ts
const raw = window.localStorage.getItem(key);
return migrateAppState(JSON.parse(raw));
```

- Reset path:

```ts
window.localStorage.removeItem(key)
```

- Data stored:
  - One full migrated `AppState` object with the exact shape listed in section 3.

- Master key structure:

```ts
{
  user,
  appMode,
  currentWeek,
  startDate,
  checkIns,
  bodyMetrics,
  photos,
  nutritionLogs,
  meals,
  foodScans,
  runLogs,
  exerciseLogs,
  workoutSessions,
  setLogs,
  workoutSummaries,
  postWorkoutRecommendations,
  adjustments,
  macroTargets
}
```

No other runtime localStorage key was found in `src` app code.

---

## 5. Workout Persistence Audit

- Workout sessions saved? **YES**
  - Starting a lift/workout in `TrainingPlan` creates a `WorkoutSession` and appends it to `state.workoutSessions`:

```ts
updateState({ ...state, workoutSessions: [...state.workoutSessions, session] });
```

- Workout completion saved? **YES**
  - Active workout progression calls `persistSession(nextSession, ...)`.
  - `skipExercise()` can set `status: "completed"` and `endedAt`.
  - `endWorkout()` saves `status: "ended"` and `endedAt`.
  - Completed/ended session state is persisted through top-level `saveState()` effect.

- Set logs saved? **YES**
  - `completeSet()` creates a `SetLog` with `weightUsed`, `repsCompleted`, `rpe`, `pain`, `formQuality`, and `completedAt`.
  - `getNextWorkoutStep(session, workout, setLog, now)` updates the session.
  - `persistSession(nextSession, setLog, ...)` writes both:
    - `workoutSessions`: updated session
    - `setLogs`: appended top-level set log

- Readiness used saved? **PARTIAL**
  - `TrainingPlan` receives current readiness and displays `Readiness used` in Session Summary.
  - Set-level coach decision logs include `triggerData` with `readinessStatus`.
  - Daily auto adjustments include readiness status/score in `triggerData`.
  - The `WorkoutSession` type itself does not contain a dedicated persisted `readinessUsed` field. Readiness context is persisted indirectly in `adjustments` and set-level coach decisions, not as a session snapshot.

- Survives refresh? **YES/PARTIAL**
  - Saved sessions/set logs survive because they are in AppState and written to localStorage.
  - `activeSessionId` itself is not persisted. After refresh, `TrainingPlan` attempts to recover the active session by finding the latest active session for the displayed workout:

```ts
[...state.workoutSessions].reverse().find((session) => session.workoutId === displayedWorkout.id && session.status === "active")
```

  - This is safe if the app reloads on the same selected workout/week/day context. `selectedWeek` and `selectedDay` are not persisted, so an active session for another displayed workout may not be immediately surfaced until selecting that workout.

- Additional helper path:
  - `src/lib/workout-logger.ts` has `saveWorkoutLoggerEntry(state, session, recovery)`, which saves `workoutSessions`, `setLogs`, `workoutSummaries`, and `postWorkoutRecommendations`. Current Phase 6 UI ownership moved visible workout logging to Train; this helper remains available and tested.

---

## 6. Run Persistence Audit

- Run logs saved? **YES**
  - Train Run Logger in `src/app/page.tsx` calls:

```ts
const saved = saveTrainRunLog(state, form);
updateState(saved.state);
```

  - `saveTrainRunLog()` in `src/lib/run-logger.ts` builds a `RunLog`, then calls `saveRunLoggerEntry(state, run)`.

- Run completion saved? **YES**
  - `saveTrainRunLog()` sets:

```ts
completed: input.actualDistance > 0 && input.durationMinutes > 0
```

- Pace data saved? **YES**
  - `buildRunLoggerRecord()` calculates or rounds `averagePace`.
  - `RunLog` stores `averagePace`.
  - `saveTrainRunLog()` stores `plannedDistance`, `actualDistance`, `durationMinutes`, `averagePace`, `averageHr`, `maxHr`, `rpe`, `zone2Compliance`, `walkBreaks`, `pain`, `painScore`, and notes.

- HR data saved? **YES/PARTIAL**
  - `averageHeartRate` is saved as `averageHr`.
  - `maxHr` is set to the same rounded value as average HR in `buildRunLoggerRecord()`.
  - There is no separate max-HR input in the current Train Run Logger path.

- Survives refresh? **YES**
  - Run logs are stored in `state.runLogs` and then written under `greek-god-coach:v1`.
  - Train uses `state.runLogs.find((run) => run.date === today && run.completed)` to identify today's completed run after reload.

- Exact save path:
  - `TrainRunLogger.save()` in `page.tsx`
  - `saveTrainRunLog()` in `run-logger.ts`
  - `saveRunLoggerEntry()` in `run-logger.ts`
  - `updateState(saved.state)` in `page.tsx`
  - top-level `saveState(state)` effect in `page.tsx`
  - `localStorage["greek-god-coach:v1"]`

---

## 7. Nutrition Persistence Audit

- Meals saved? **YES**
  - Manual meals are created with `createMealFromNutritionUiV2ManualEntry()`.
  - Saved foods are converted to meals with `createMealFromNutritionUiV2SavedFood()`.
  - Confirmed Food AI meals are built with `buildFoodAiMealFromMealLog()`.
  - All three paths call `syncStateWithMeals(nextMeals)`.

- Nutrition logs saved? **YES**
  - `syncStateWithMeals(nextMeals)` computes:

```ts
const nextLog = syncNutritionLogFromNutritionUiV2Meals({ userId: state.user.id, date, meals: nextMeals, existingLog, macroTarget });
updateState({ ...state, meals: nextMeals, nutritionLogs: [...state.nutritionLogs.filter((log) => log.date !== date), nextLog] });
```

- Saved foods saved? **NO/PARTIAL**
  - `defaultSavedFoodsForNutritionUiV2` is a hard-coded list in `src/lib/nutrition-ui.ts`.
  - The selected saved-food entries become persisted `Meal` records when logged.
  - The saved food library itself is not persisted or user-editable in AppState.

- Food scans saved? **PARTIAL**
  - `AppState` includes `foodScans: FoodScanLog[]`, and Supabase sync maps `state.foodScans` to `food_scan_logs`.
  - The inspected current `page.tsx` FOOD_AI_V1 confirm path saves a confirmed meal, but no `updateState` append to `state.foodScans` was found in the current file.
  - Temporary scan draft/image state is not persisted until confirmed as a meal.

- Adherence history reconstructable? **YES/PARTIAL**
  - `buildNutritionUiV2Model()` derives Today / 7 Day / 30 Day adherence from current `state.meals` plus legacy `state.nutritionLogs`.
  - If meals exist for a date, legacy nutrition logs for that date are excluded from `nutritionUiV2MealLogsFromState()` to avoid duplication.
  - Alcohol day counts come from `state.nutritionLogs`.

- Exact save path:
  - Nutrition UI actions in `page.tsx`
  - `syncNutritionLogFromNutritionUiV2Meals()` in `nutrition-ui.ts`
  - `updateState({ ...state, meals, nutritionLogs })`
  - top-level `saveState(state)` effect
  - `localStorage["greek-god-coach:v1"]`

---

## 8. Body Metrics Persistence Audit

- Weight saved? **YES**
  - Daily Check-In `upsertDailyCheckIn()` writes weight into a body metric for that date.
  - Body Metrics form saves direct metric records.

- Waist saved? **YES/PARTIAL**
  - Body Metrics form includes `waist` and saves it to `state.bodyMetrics`.
  - Daily Check-In generated body metrics only include `weight` and notes, not waist.

- Neck saved? **PARTIAL**
  - Phase 6 UI initializes and saves a `neck` field in `BodyMetrics` by adding the full `metric` object to `state.bodyMetrics`.
  - Current `BodyMetric` type in `src/lib/types.ts` does not declare `neck`.
  - Because localStorage stores raw object properties through JSON, the runtime value can persist if present, but TypeScript schema does not formally include it.

- Body measurements saved? **YES/PARTIAL**
  - The Body Metrics UI fields are `date`, `weight`, `waist`, `neck`, `hips`, `chest`, `arms`, `thighs`, and `notes`.
  - Type supports `weight`, `waist`, `chest`, `arms`, `thighs`, `hips`, and `notes`; `neck` is not typed.
  - `migrateAppState()` only checks that `bodyMetrics` is an array and does not validate metric shape.

- Trend reconstruction possible? **YES/PARTIAL**
  - `buildBodyMetricsSummary(metrics)` can compute current weight, weight change 7 days, and waist change 7 days from stored metrics.
  - `buildWeightTrendDashboard()` and weekly review use body metric history.
  - If only Daily Check-In records exist, waist/other measurement trends are missing because daily check-in body metric upserts are weight-only.

- Exact save paths:
  - Daily Check-In: `DailyCheckInForm.save()` -> `upsertDailyCheckIn(state, entry, uid("metric"))` -> `checkIns` and weight-only `bodyMetrics` -> `saveState()`.
  - Body Metrics: `BodyMetrics.save()` -> `updateState({ ...state, bodyMetrics: [...state.bodyMetrics.filter((m) => m.date !== metric.date), metric] })` -> `saveState()`.

---

## 9. Progress Photo Persistence Audit

- Photos saved? **YES**
  - `ProgressPhotos.save()` in `src/app/page.tsx` appends a `ProgressPhoto` object:

```ts
const save = () => updateState({ ...state, photos: [...state.photos, photo] });
```

- Photos stored as URLs? **YES/PARTIAL**
  - `ProgressPhoto` fields are string fields:
    - `frontPhotoUrl?: string`
    - `sidePhotoUrl?: string`
    - `backPhotoUrl?: string`
  - The UI placeholder says `saved picture reference`.
  - The section copy says `Upload or paste saved-picture references`, but the current inputs are `type="text"`, not file upload controls.

- Photos stored as data URLs? **POSSIBLE/PARTIAL**
  - The photo fields are plain text and can contain a data URL if pasted manually.
  - There is no implemented file reader in the Progress Photos section to convert selected images to data URLs.

- Binary upload? **NO**
  - Progress Photos uses text inputs, not binary upload.
  - No Supabase Storage/photo bucket upload is wired into the Progress Photos flow.

- Survives refresh? **YES/PARTIAL**
  - Text values in `state.photos` survive localStorage refresh.
  - If text values reference external files/URLs, survival depends on those references remaining valid.

- Survives browser restart? **YES/PARTIAL**
  - Same as refresh if localStorage survives.
  - Large pasted data URLs increase localStorage quota risk.
  - Local file paths or temporary blob URLs would not reliably survive restart.

- Actual implementation:
  - `src/lib/types.ts` declares optional photo URL fields.
  - `src/lib/log-tab-ui.ts` summarizes latest photo URLs and latest upload date.
  - `src/app/page.tsx` stores the `ProgressPhoto` object in `state.photos`.

---

## 10. State Reconstruction Audit

After refresh, can app rebuild these areas from persisted data?

- Home: **SAFE**
  - `Home` derives readiness, current workout, weight trend, run trends, daily prescription, home command center, and weekly review from persisted `AppState` plus seed workout templates.
  - Caveat: selected week/day UI state is not persisted and returns to defaults.

- Train: **PARTIAL**
  - Stored `workoutSessions`, `setLogs`, `runLogs`, `workoutSummaries`, `postWorkoutRecommendations`, and `adjustments` survive.
  - Active session recovery exists only by looking for an active session for the currently displayed workout.
  - `activeSessionId`, `selectedWeek`, and `selectedDay` are temporary UI state and are not restored.

- Log: **SAFE**
  - Daily Check-In, Nutrition, Body Metrics, and Progress Photos all read/write persisted AppState arrays.
  - Caveat: `activeLogSection` is not persisted and defaults to `checkin` after reload.

- Progress: **SAFE/PARTIAL**
  - Progress derives charts/reviews/goals from persisted body metrics, nutrition logs, meals, runs, workout sessions, set logs, macro targets, and adjustments.
  - Weekly review and goal/progression outputs are computed, not stored. This is acceptable if source data is intact.
  - Any data omitted from AppState or corrupted in localStorage cannot be reconstructed.

---

## 11. Backup Readiness Audit

- Readiness: **READY/PARTIAL**
  - Source data is `checkIns` and is included in full AppState export.
  - Engine outputs are derived and do not need export if source data is valid.
  - Partial because corrupted/missing check-in fields are only lightly migrated.

- Nutrition: **READY/PARTIAL**
  - `nutritionLogs` and `meals` are included in AppState export.
  - Saved food library is hard-coded, not user-persisted.
  - Food scan logs are included if present, but current UI path does not clearly append them.

- Workouts: **READY/PARTIAL**
  - `workoutSessions`, `setLogs`, `workoutSummaries`, and `postWorkoutRecommendations` are exported.
  - Workout plan templates come from `seed-data.ts`, not AppState. Backup assumes the same app version/template IDs are available on restore.
  - Session-level readiness snapshot is not explicit.

- Runs: **READY**
  - `runLogs` include run type, planned/actual distance, duration, pace, HR fields, RPE, completed, walk breaks, pain, and notes.

- Body metrics: **READY/PARTIAL**
  - `bodyMetrics` are exported.
  - Neck can persist in raw JSON but is not declared in `BodyMetric` type.
  - Daily Check-In generated metrics are weight-only.

- Photos: **PARTIAL**
  - `photos` are exported as strings.
  - No binary/photo storage export strategy exists.
  - Pasted data URLs could bloat localStorage/export; external URL/reference fields can break independently.

- Goals: **PARTIAL**
  - Goal engine outputs are derived from source data and user/default goal context.
  - There is no separate persisted user goals object beyond `user.goal`, `user.startingWeight`, `user.goalWeight`, macro targets, and source logs.

- Adjustments / coach decisions: **READY/PARTIAL**
  - `adjustments` are exported.
  - Supabase sync maps them to `coach_decision_logs`.
  - Corruption/shape validation is light.

- Full app export: **PARTIAL**
  - `buildAppStateBackupPayload()` wraps current `state` with `exportedAt`, `storageKey`, and `appStateVersion: 1`.
  - There is no import, validation, checksum, preview, or restore verification.

---

## 12. Risks Before Phase 7

- **CRITICAL — No restore/import implementation**
  - Verified by search: export exists, but no function/UI reads a backup file and writes validated AppState back to localStorage.
  - A backup download cannot currently recover the app after data loss without manual developer intervention.

- **CRITICAL — Corrupt localStorage silently resets to seed data**
  - `loadState()` catches JSON parse/migration failure and returns `createInitialState()`.
  - There is no user warning, quarantine copy, backup prompt, or recovery workflow.

- **HIGH — Single localStorage key is the browser source of truth**
  - All domains live under `greek-god-coach:v1`.
  - Clearing browser data, private mode disposal, profile loss, storage quota eviction, or accidental reset can lose everything.

- **HIGH — Progress photos are only string references/data strings, not durable managed files**
  - Progress Photos has text fields, not binary upload.
  - External references may break; blob URLs/local file paths do not survive; data URLs can consume localStorage quota.

- **HIGH — Supabase sync is not a restore/hydration path**
  - Current app shell hydrates only from `loadState()` localStorage.
  - `syncAppStateToSupabase()` upserts selected tables and then saves localStorage, but there is no implemented Supabase-to-AppState load.

- **MEDIUM — AppState migration validates only some domains deeply**
  - Meals and macro targets have normalization.
  - Most arrays (`bodyMetrics`, `photos`, `nutritionLogs`, `foodScans`, `runLogs`, `workoutSessions`, `setLogs`, `workoutSummaries`, `postWorkoutRecommendations`, `adjustments`) are accepted as arrays without item-level schema validation.

- **MEDIUM — Duplicated/derived nutrition storage can drift**
  - `meals` and `nutritionLogs` both persist.
  - Nutrition UI syncs them on UI actions, but imported/restored data would need validation to ensure per-date nutrition logs match meals.

- **MEDIUM — Duplicated/derived workout storage can drift**
  - Set logs exist both inside `WorkoutSession.setLogs` and top-level `setLogs`.
  - Workout summaries and post-workout recommendations are derived but also persisted.
  - Restore needs consistency checks.

- **MEDIUM — `neck` exists in current UI save object but not in `BodyMetric` type**
  - Raw JSON can persist it, but schema/type and restore validation would miss it unless Phase 7 accounts for it.

- **LOW — Navigation/session UI state is not persisted**
  - `active`, `selectedWeek`, `selectedDay`, and `activeLogSection` reset on refresh.
  - This does not lose domain data, but can hide an active workout until the user selects the matching workout.

---

## 13. Phase 7 Requirements

Based only on the verified findings above, minimum Backup/Restore Hardening requirements are:

1. Export capability
   - Keep full AppState export, but harden it.
   - Export should include `storageKey`, explicit schema version, exported app/build version if available, exported timestamp, and the full AppState payload.
   - Export should preserve all current AppState domains: user, check-ins, body metrics including neck if present, photos, nutrition logs, meals, food scans, runs, exercise logs, workout sessions, set logs, workout summaries, post-workout recommendations, adjustments, macro targets.

2. Import capability
   - Add a real restore/import path that reads a backup JSON file, validates it, migrates it, previews what will be restored, writes it to `greek-god-coach:v1`, and hydrates app state from the restored payload.
   - Must not require developer console/manual localStorage editing.

3. Backup validation
   - Validate top-level payload shape.
   - Validate `storageKey` and `appStateVersion`.
   - Validate required `AppState` arrays and required user fields.
   - Validate item-level shapes for high-value domains: check-ins, body metrics, meals/items, nutrition logs, run logs, workout sessions, set logs, photos, adjustments, macro targets.

4. Schema versioning
   - Replace the current passive `appStateVersion: 1` export literal with an explicit versioned schema/migration policy.
   - Restore should know how to migrate supported older versions or reject unsupported versions with a user-facing reason.

5. Corruption detection
   - Do not silently reset to seed data on corrupted localStorage.
   - Detect parse failure and surface a recovery state.
   - Preserve/quarantine the raw corrupted value where possible before overwriting.
   - Provide user choices: download corrupted raw data, restore from backup, or intentionally reset.

6. Restore verification
   - After import, verify the restored AppState can rebuild Home, Train, Log, and Progress minimum models without throwing.
   - Verify key counts before/after restore: check-ins, body metrics, meals, nutrition logs, run logs, workout sessions, set logs, photos, adjustments.
   - Verify `loadState()` after writing restore returns the same migrated state.

7. Photo handling strategy
   - Decide and document whether Progress Photos are URL/reference-only, data URL, or managed file storage.
   - If URL/reference-only, restore validation should warn that backup preserves references but not external files.
   - If data URLs are allowed, check size/quota and warn before export/import.
   - If managed storage is added later, backup must include photo metadata and a durable storage mapping.

8. Recovery workflow
   - Add a user-facing recovery flow for:
     - corrupted localStorage
     - backup file invalid
     - backup schema unsupported
     - restore validation failure
     - restore success with verification summary
   - Include a pre-restore safety export of the current state before overwriting localStorage.
   - Include an intentional reset path that is separate from failed parse fallback.

Recommendation from this audit: proceed to Phase 7, but treat it as required hardening before relying on the app for one-year daily use.

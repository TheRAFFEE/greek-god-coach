# DAILY_STATE_AUDIT_V1

## Phase

PHASE 27N — Daily State Rollover Audit

## Scope

Audit only. No fixes, UI changes, source-of-truth changes, or runtime behavior changes were implemented.

This audit investigates whether Home state, week calculation, daily check-ins, nutrition values, recovery values, and logging status correctly advance when the calendar date changes.

## Evidence inspected

- `src/app/page.tsx`
- `src/lib/types.ts`
- `src/lib/storage.ts`
- `src/lib/seed-data.ts`
- `src/lib/daily-checkin.ts`
- `src/lib/home-command-center.ts`
- `src/lib/home-daily-dashboard.ts`
- `src/lib/app-chrome.ts`
- `src/lib/nutrition-ui.ts`
- `src/lib/run-logger.ts`
- `src/lib/weekly-review.ts`
- `package.json`

Pre-audit git state:

```text
Branch: main
Status short: clean
Recent commit: 5273e5a feat: add developer-only planner and home adapter pilot
```

Live environment timestamp captured during audit:

```text
Local: 2026-06-08 08:19:39 CDT -0500
```

## Executive verdict

Daily records are mostly date-keyed and can represent multiple days, but the app does not have a true daily rollover system.

Current behavior is a mix of:

1. Live date-derived selectors using `todayIso()`.
2. Persisted historical arrays keyed by `date`.
3. A persisted `state.currentWeek` seeded as `1` and never recalculated.
4. A header/week label driven by local React `selectedWeek`, initialized to `1`, not by date.
5. Recovery and Home readiness driven by the most recent check-in, not strictly today's check-in.
6. Date utilities based on UTC ISO slicing, not the user's local calendar date.

Result: day-of-week progression partially advances, daily log buckets can be created per date, but Week label/current week does not automatically advance and Home can continue using stale recovery/check-in values after a new calendar day begins.

## How Week label is calculated

### Current source

`src/app/page.tsx` initializes:

```ts
const [selectedWeek, setSelectedWeek] = useState(1);
const [selectedDay, setSelectedDay] = useState(0);
```

After state loads, the header model is built with:

```ts
const appChrome = buildCompactAppChrome({ currentWeek: selectedWeek });
```

`src/lib/app-chrome.ts` then clamps and formats the label:

```ts
const week = Math.max(1, Math.min(12, Math.round(input.currentWeek || 1)));
subtitle: `Week ${week}`
```

### Answers to requested questions

- Is Week 1 hardcoded?
  - Effectively yes for initial header/Train selector state. `selectedWeek` starts at `1`, and `buildCompactAppChrome()` falls back to `1`.
- Derived from seed plan?
  - Partially. The persisted app state starts with `currentWeek: 1` from `src/lib/seed-data.ts`, but the visible header uses `selectedWeek`, not `state.currentWeek`.
- Derived from current date?
  - No. There is no calculation from today's date to week number.
- Derived from app start date?
  - No. `AppState.startDate` exists and seed state sets `startDate: "2026-05-24"`, but no inspected runtime path derives current week from it.
- Derived from training cycle?
  - No. Workouts are selected with week/day values, but the week value itself is not derived from the cycle.

### Important split

There are two week concepts in runtime:

1. Header / Train manual selector week:
   - `selectedWeek`, local React state, initialized to `1`.
   - Used by app chrome subtitle and Train's editable Week dropdown.

2. Home/training model week:
   - `state.currentWeek`, persisted in `AppState`, seeded as `1`.
   - Used by Home to select today's workout/run and by engines/adapters.

Neither advances automatically when calendar date changes.

## How training day progression is calculated

`src/app/page.tsx` computes:

```ts
const today = todayIso();
const todayPlanDayIndex = useMemo(() => {
  const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}, [today]);
```

This maps:

- Monday -> `0`
- Tuesday -> `1`
- Wednesday -> `2`
- Thursday -> `3`
- Friday -> `4`
- Saturday -> `5`
- Sunday -> `6`

Home's daily workout source:

```ts
todayWorkout = getWorkoutForWeekDay(state?.currentWeek ?? selectedWeek, todayPlanDayIndex)
```

Home's run source:

```ts
getTodayRunForDate({ today, currentWeek: state.currentWeek, workouts, ... })
```

`src/lib/home-command-center.ts` repeats the same UTC day-index logic in `planDayIndex(today)` and then finds:

```ts
workouts.find(candidate => candidate.week === input.currentWeek && candidate.dayIndex === dayIndex)
```

### Verdict

- Day-of-week progression advances based on `todayIso()` and `getUTCDay()`.
- Week progression does not advance.
- Therefore, Home can move from Monday to Tuesday within Week 1, but it does not move from Week 1 to Week 2/3/etc. unless `state.currentWeek` or `selectedWeek` is manually changed elsewhere.

## How daily rollover currently works

### Event that triggers new day creation

There is no explicit daily rollover event.

No inspected code path creates a new daily state record just because the calendar date changed. New records are created only when a user saves something for a date:

- Save Daily Check-In.
- Add meal / saved food / FOOD_AI meal to Nutrition UI.
- Save Train run log.
- Start/complete workout session.
- Save Body Metrics.
- Save Progress Photos.

### Is there a `lastUpdatedDate` field?

No app-level `lastUpdatedDate` field was found in the inspected runtime state.

`AppState` has `currentWeek` and `startDate`, plus date-keyed arrays, but no global daily rollover marker.

### Is date comparison performed?

Yes, but only in specific selectors/upserts:

- Daily check-in lookup: `entry.date === currentDate`.
- Nutrition log lookup: `log.date === date`.
- Meal cards: `meal.date === input.date`.
- Run completion: `run.date === today && run.completed`.
- Workout completion: `startedAt` / `endedAt` date slice equals today.
- Weekly review windows: `date >= startDate && date <= endDate`.

### Is timezone considered?

No local timezone policy is implemented.

The central helper is:

```ts
export const todayIso = () => new Date().toISOString().slice(0, 10);
```

This returns the UTC date, not the user's local calendar date. In US Central time, for example, late evening local time can already be tomorrow in UTC. Several selectors also parse dates as midnight UTC via `new Date(`${date}T00:00:00.000Z`)`.

### Rollover verdict

Daily rollover is implicit and incomplete:

- The displayed `today` value changes when React rerenders after `todayIso()` changes.
- There is no timer/listener to update at midnight.
- There is no `lastUpdatedDate` migration/rollover pass.
- There is no automatic creation of a new `DailyCheckIn`, `NutritionLog`, or daily status object.
- Existing component-local form state can stay mounted with the old date until the component remounts or user changes date manually.

## User-entered value behavior

### Sleep

- Storage field: `DailyCheckIn.sleepHours`, date-keyed by `DailyCheckIn.date`.
- Current default for a new day: copied from latest check-in if no today entry exists.
- Current persistence: one check-in per date once saved.
- Should: create a new daily record; should not silently persist as today's actual sleep without explicit save.
- Risk: new day form prepopulates yesterday's sleep, and Home readiness can use latest prior sleep before today's check-in exists.

### Calories

- Storage field: `NutritionLog.calories`, plus `Meal` records by date.
- Current default for a new dashboard date: 0 calories if no log/meals exist for that date.
- Current persistence: one nutrition log per date, synchronized from meals.
- Should: create/update a daily nutrition record when meals are logged; prior days persist forever as history.
- Risk: Nutrition Logger component initializes `date` with `todayIso()` once; if mounted across midnight, it may stay on the old date.

### Weight

- Storage fields: `DailyCheckIn.weight` and `BodyMetric.weight`.
- Current Daily Check-In default: copied from latest check-in or user starting weight.
- Current Body Metrics default: `trend.current7DayAverage || state.user.startingWeight`.
- Current persistence: date-keyed upsert for check-in/body metric; body metrics save replaces same date.
- Should: weight should persist as historical record per date when saved; new day should create a new daily measurement record if entered.
- Risk: same weight prepopulates on new day; this may be acceptable as a convenience only if clearly treated as editable default, not actual logged data.

### Recovery

- Storage fields: not stored as a separate daily recovery record; derived from check-in fields.
- Home source: `latestCheckIn = state?.checkIns.at(-1)` and `readiness = calculateReadiness(latestCheckIn, baseline)`.
- Home Command Center fallback: `mostRecentCheckIn(state, today)` returns the newest check-in with `entry.date <= today`.
- Current behavior: recovery persists from the latest previous check-in until a new check-in is saved.
- Should: recovery should be derived from today's check-in if present; if missing, Home should show missing/stale-readiness state rather than treating yesterday as today's recovery.
- Risk: stale recovery status becomes user-visible after date rollover.

### Daily check-in fields

Fields include weight, sleep, sleepQuality, soreness, energy, stress, hunger, motivation, alcohol, steps, restingHr, hrv, pain, painLocation, painSeverity, workoutCompleted, runCompleted, macrosHit, notes.

- Current default for new day: most fields copy from latest check-in; notes reset to empty; completion booleans derive from logs for current date.
- Current persistence: `upsertDailyCheckIn()` replaces exact-date check-in and body metric.
- Should: create a new daily record per date; prior days persist forever; volatile daily fields should not be treated as already completed/logged unless saved for the new date.
- Risk: copied daily fields blur yesterday vs today.

### Workout completion

- Storage fields: `WorkoutSession.startedAt`, `WorkoutSession.endedAt`, `SetLog.completedAt`; `DailyCheckIn.workoutCompleted` can also store a boolean.
- Current source for display:
  - Daily Check-In card uses `deriveDailyCompletionStatus(state, form.date)`.
  - Train session summary uses today's `workoutSessions` for the displayed workout id.
  - Home Command Center uses `completedWorkoutToday()` requiring `session.status === "completed"` and date match.
- Current persistence: workout sessions persist forever; completion is derived by date for current UI surfaces.
- Should: workout session logs should persist forever; daily completion status should be derived for that date or recorded as a daily receipt, not copied forward.
- Risk: `DailyCheckIn.workoutCompleted` may become stale if treated as source elsewhere, because completion is only synchronized into check-in when the check-in is saved.

### Run completion

- Storage field: `RunLog.date`, `RunLog.completed`.
- Current source for display:
  - Daily Check-In card derives `runCompleted` by exact date.
  - Train summary finds `run.date === today && run.completed`.
  - Home Command Center checks any completed run for `today`.
- Current persistence: one run log per date because `saveRunLoggerEntry()` filters out existing logs with the same date before inserting.
- Should: run logs should persist forever; daily completion status should derive by date.
- Risk: one-log-per-date means multiple runs on one day are not supported; old `DailyCheckIn.runCompleted` booleans can lag until check-in is saved.

## Day N / Day N+1 simulation

Simulation command output used these implemented formulas:

- `todayIso`-style date strings.
- `planDayIndex` UTC day mapping.
- Header week from `selectedWeek = 1`.
- Persisted `state.currentWeek = 1`.
- Seed `startDate = 2026-05-24`.

```text
{
  "date": "2026-06-08",
  "headerWeek": "Week 1",
  "stateCurrentWeek": 1,
  "derivedWeekFromStartDate": 3,
  "planDayIndex": 0,
  "hasCheckIn": true,
  "hasNutrition": true,
  "runCompleted": true,
  "workoutCompleted": true
}
{
  "date": "2026-06-09",
  "headerWeek": "Week 1",
  "stateCurrentWeek": 1,
  "derivedWeekFromStartDate": 3,
  "planDayIndex": 1,
  "hasCheckIn": false,
  "hasNutrition": false,
  "runCompleted": false,
  "workoutCompleted": false
}
```

### What changes from Day N to Day N+1

- `today` changes if the component rerenders and `todayIso()` returns a new UTC date.
- `todayPlanDayIndex` changes from Monday index `0` to Tuesday index `1` in the simulation.
- Home's selected workout/run day can change within the same `state.currentWeek`.
- Nutrition totals for the new date become 0 if no meals/log exist for that date.
- Run/workout completion derives false for the new date if no logs exist.

### What remains stale / unchanged

- Header stays `Week 1` because `selectedWeek` remains `1`.
- `state.currentWeek` stays `1` because no code recalculates it.
- `AppState.startDate` remains unused for week progression.
- Latest check-in remains available and can drive Home readiness/recovery even if it is yesterday's record.
- Component-local forms initialized before midnight can remain pointed at the old date until remount/user change.

## Home screen progression verification

### Home training day progression

Partial pass.

Home's day-of-week selection is date-aware through `todayPlanDayIndex` and `getTodayRunForDate()`. When `today` changes from Monday to Tuesday, Home can select Tuesday's workout/run within the current week.

### Week number progression

Fail.

Week does not advance automatically. The visible header uses local `selectedWeek`, initialized to 1. Home and engines use `state.currentWeek`, seeded as 1. Neither is derived from date/startDate/training cycle.

### Daily state staleness

Partial fail.

Nutrition and completion values are mostly date-keyed and become empty/false on a new date. Recovery/readiness does not strictly reset to a missing-today state; Home can reuse the latest prior check-in.

## ROOT CAUSE

1. No canonical daily clock/rollover owner exists.
   - The app has `todayIso()`, but no daily lifecycle state such as `lastUpdatedDate`, no rollover reducer, and no midnight refresh effect.

2. Week ownership is split and static.
   - `state.currentWeek` is persisted and seeded as `1`.
   - `selectedWeek` is local UI state and initialized to `1`.
   - `startDate` exists but is not used to derive week.
   - Header uses `selectedWeek`; Home uses `state.currentWeek`.

3. Date handling uses UTC as an implicit policy.
   - `todayIso()` slices `new Date().toISOString()`, which is UTC.
   - Day-index and weekly windows use UTC midnight.
   - There is no user/local timezone setting.

4. Recovery uses latest/prior check-in as if it can stand in for today.
   - `latestCheckIn` and `mostRecentCheckIn(state, today)` make Home usable with old data but also allow stale recovery status after a new day starts.

5. Daily form defaults copy previous daily values.
   - Sleep, stress, soreness, energy, pain, alcohol, steps, and macrosHit can prefill from latest check-in on a new date.
   - This is useful as UI convenience but unsafe as state if not clearly stale/unconfirmed.

6. Completion has duplicate representations.
   - Workout/run completion can be stored in `DailyCheckIn`, but current surfaces mostly derive from session/run logs.
   - The stored check-in booleans are only refreshed when a check-in is saved.

## User-visible impact

- Header can show `Week 1` indefinitely.
- Home can continue prescribing Week 1 workouts/runs even when the calendar is later in the plan.
- The day-of-week can advance while the training week does not, producing wrong plan day selection after Week 1.
- Readiness/recovery may look current even when today's check-in is missing.
- Sleep/stress/soreness/energy/pain fields may appear prefilled on a new day with yesterday's values.
- Calories/nutrition on a new date correctly appear empty only if the Nutrition Logger has remounted or its date state is current.
- Workout/run completion status is mostly safe by date, but stored check-in completion booleans can lag.
- Around local midnight, UTC date behavior can roll the app to tomorrow before the user considers it a new day.

## Recommended fixes

No fixes were implemented in this phase. Recommended next phase should be tightly scoped and adapter-first.

1. Create a canonical local-date helper.
   - Replace or wrap `todayIso()` with an explicit local calendar date policy.
   - Consider user timezone/configurable timezone if the app is used across devices.
   - Add tests for evening local time vs UTC date.

2. Add a derived week function.
   - Example rule: `currentWeek = clamp(1, 12, floor(daysBetween(localToday, state.startDate) / 7) + 1)`.
   - Decide whether `startDate` is plan start date, user onboarding date, or training-cycle start date.
   - Do not keep `currentWeek` as an independently stale persisted source unless it is explicitly a manual override.

3. Unify header/Home/Train week ownership.
   - Header should display the same effective week used by Home's daily prescription.
   - Train's manual `selectedWeek` should either initialize from effective current week or be clearly a manual preview selector.

4. Add daily rollover detection.
   - Store a lightweight `lastSeenDate` / `lastUpdatedDate` or equivalent app-session marker.
   - On load/focus/interval, compare canonical local today to prior date.
   - On date change, refresh derived current day/week and reset mounted forms to today's date if no unsaved edits exist.

5. Separate stale recovery from today's recovery.
   - Home should prefer today's check-in.
   - If missing, show a clear missing/stale-readiness state and call to complete Daily Check-In.
   - Prior check-in may be used as historical context, not as today's recovery truth.

6. Treat daily form carry-forward values as draft defaults only.
   - Mark copied values as unsaved/defaulted.
   - Reset notes and volatile fields by default unless product intentionally wants carry-forward.
   - Never count copied fields as today's logged check-in until saved.

7. Make completion source explicit.
   - Prefer deriving workout/run completion from durable `workoutSessions` and `runLogs`.
   - If `DailyCheckIn.workoutCompleted/runCompleted` remain, treat them as denormalized snapshots and update or deprecate them intentionally.

8. Add Day N / Day N+1 regression coverage.
   - Week derived from start date advances correctly.
   - Home/Train/header agree on effective week.
   - Missing today's check-in yields stale/missing recovery warning.
   - Nutrition new day starts empty.
   - Workout/run completion does not carry forward.
   - UTC/local timezone edge case is covered.

## Value policy recommendation

- Persist forever:
  - Historical check-ins after save.
  - Body metrics after save.
  - Nutrition logs/meals after save.
  - Workout sessions/set logs/summaries.
  - Run logs.
  - Photos.

- Persist until edited:
  - User profile.
  - Macro targets.
  - Race calendar settings.
  - Manual training preview selectors, if intentionally treated as user-selected preview controls.

- Reset daily / become unconfirmed draft:
  - Sleep.
  - Soreness.
  - Energy.
  - Stress.
  - Hunger.
  - Motivation.
  - Alcohol yesterday.
  - Steps yesterday.
  - Pain flags.
  - Notes.
  - Macros hit.

- Create a new daily record:
  - Daily Check-In.
  - NutritionLog / Meals for the selected date.
  - BodyMetric if user logs weight/measurements that day.
  - RunLog for a completed run date.
  - WorkoutSession for a workout execution date.

## Validation notes

This phase intentionally did not run implementation tests because no runtime code was changed. Verification should confirm:

- The audit document exists.
- Required sections are present.
- Git status only shows `DAILY_STATE_AUDIT_V1.md` as a new documentation artifact.
- No source files were modified by this audit.

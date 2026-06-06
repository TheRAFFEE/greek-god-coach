# Phase X: Training Planner Architecture V1

## Goal

Create a canonical `DailyTrainingSession` source of truth for the app's daily training prescription.

This is an architecture document only.

## Scope Boundaries

This phase must not change runtime behavior.

Non-goals:

- No UI changes.
- No feature additions.
- No dashboard additions.
- No implementation code in this phase.
- No commits in this phase unless explicitly requested later.

The purpose of this document is to define the architecture that a later implementation phase can follow.

## Summary Verdict

The current app has a useful `TrainingEngineResult`, but it is not yet the canonical daily training prescription source of truth. Current workout, run, daily prescription, Home display, and Train execution paths still originate from multiple recommendation sources and adapters.

`DailyTrainingSession` should become the one object that answers:

> For this date, this user state, and this plan context, what is the single training session to do today?

It should own the ordered session blocks, source IDs, safety/readiness modifications, run prescription, workout prescription, estimated duration, combined session load/stress metadata, completion targets, and audit trail.

---

# 1. Current Recommendation Sources

## 1.1 Static training plan source

Source file:

- `src/lib/seed-data.ts`

Current ownership:

- `templateForDay(week, dayIndex)` creates the planned daily template.
- `workouts` expands 12 weeks x 7 days into `Workout[]`.
- `getWorkoutForWeekDay(week, dayIndex)` selects one `Workout` by week/day.

Current output:

- `Workout` objects containing mixed modalities:
  - lifting
  - sprints
  - Zone 2 running
  - long runs
  - athletic conditioning
  - mobility
  - recovery
  - nutrition tasks such as meal prep

Important current behavior:

- The source plan stores all modalities inside a single `Workout` shape.
- Later consumers infer whether a `Workout` means lift/run/recovery using names, type strings, `longRunMiles`, and regexes.
- This is the root source of many downstream split-path issues.

## 1.2 Today workout selection

Source file:

- `src/app/page.tsx`

Current flow:

```text
todayIso()
  -> todayPlanDayIndex
  -> getWorkoutForWeekDay(state.currentWeek, todayPlanDayIndex)
  -> todayWorkout
  -> adjustWorkoutForReadiness(todayWorkout, readiness.status)
  -> adjustedTodayWorkout
```

Relevant current lines:

- `src/app/page.tsx:147-157`

Current output:

- `todayWorkout`
- `adjustedTodayWorkout`

Current consumers:

- `generateDailyPrescription()` receives `todayWorkout`.
- `buildHomeCommandCenter()` receives `adjustedTodayWorkout` as `scheduledWorkout`.

## 1.3 Selected workout / Train selection source

Source file:

- `src/app/page.tsx`

Current flow:

```text
selectedWeek + selectedDay
  -> getWorkoutForWeekDay(selectedWeek, selectedDay)
  -> currentWorkout
  -> adjustWorkoutForReadiness(currentWorkout, readiness.status)
  -> adjustedWorkout
  -> TrainScreen / TrainingPlan
```

Relevant current lines:

- `src/app/page.tsx:154-157`
- `src/app/page.tsx:276`
- `src/app/page.tsx:653-709`

Current output:

- `currentWorkout`
- `adjustedWorkout`
- `displayedWorkout` inside `TrainingPlan()`

Current consumers:

- Train preview receives `workout={adjustedWorkout}`.
- `TrainingPlan.startWorkout()` creates `WorkoutSession` records from `displayedWorkout.id` and `displayedWorkout.title`.
- `ActiveWorkout()` receives `workout={displayedWorkout}`.

Architectural issue:

- This selected workout path can differ from the date-aware `todayWorkout` path.

## 1.4 Today run display source

Source file:

- `src/lib/home-command-center.ts`

Current owner:

- `getTodayRunForDate(input)`

Current flow:

```text
today + currentWeek + workouts[]
  -> planDayIndex(today)
  -> find workout by currentWeek + dayIndex
  -> isRunWorkout(workout)
  -> milesFromWorkout(workout)
  -> estimatedMinutesFromWorkout(workout, distanceMiles)
  -> TodayRunDisplay | null
```

Relevant current lines:

- `src/lib/home-command-center.ts:150-233`
- `src/app/page.tsx:170`

Current output:

- `TodayRunDisplay | null`

Important current behavior:

- Minute-based runs can produce `distanceMiles: 0` with positive `estimatedMinutes`.
- Example: a `Zone 2 Run` with `35-45 min` can be detected as a run display item, but it has no mileage.

## 1.5 Running recommendation source

Source files:

- `src/app/page.tsx`
- `src/lib/coach-engine.ts`
- `src/lib/running-engine.ts`

Current flow:

```text
todayRunDisplay.distanceMiles
  -> plannedRunDistance
  -> if plannedRunDistance > 0: generateRunningRecommendation(...)
  -> buildRunningEngineInputForRecommendation(...)
  -> evaluateRunning(...)
  -> runningEngineResultToLegacyRecommendation(...)
  -> RunningRecommendation
```

Relevant current lines:

- `src/app/page.tsx:171-173`
- `src/lib/coach-engine.ts:388-492`
- `src/lib/running-engine.ts:691-730`

Current output:

- `RunningRecommendation | null`
- `nextRunLabel`

Important current behavior:

- The running recommendation does not run when `plannedRunDistance <= 0`.
- Minute-based runs are therefore not evaluated by Running Engine through this path.

## 1.6 Scheduled run adapter source

Source file:

- `src/lib/home-command-center.ts`

Current owner:

- `getScheduledRunForTraining(todayRun, titleOverride, distanceOverride)`

Current flow:

```text
TodayRunDisplay + nextRunLabel + recommendedDistance
  -> if !todayRun or todayRun.distanceMiles <= 0: null
  -> TrainingRunPrescription
```

Relevant current lines:

- `src/lib/home-command-center.ts:225-233`
- `src/app/page.tsx:174`

Current output:

- `TrainingRunPrescription | null`

Important current behavior:

- The adapter drops minute-based runs with no mileage.

## 1.7 Daily prescription source

Source file:

- `src/lib/coach-engine.ts`

Current owner:

- `generateDailyPrescription(input)`

Current flow:

```text
readiness + checkIn + todayWorkout + macroTarget + nutrition/body metrics + training adherence + runningRecommendation
  -> nutrition adherence and macro adjustment
  -> readiness modification / recovery replacement
  -> cardioRecommendation
  -> workoutModifications
  -> DailyPrescription
```

Relevant current lines:

- `src/app/page.tsx:175`
- `src/lib/coach-engine.ts:746-861`

Current output:

- `DailyPrescription`
  - `trainingDecision`
  - `exactWorkoutRecommendation`
  - `workoutModifications`
  - `cardioRecommendation`
  - `nutritionTarget`
  - `recoveryTasks`
  - `warnings`
  - `explanation`

Important current behavior:

- It is a separate recommendation surface from `TrainingEngineResult`.
- It uses `todayWorkout`, not necessarily the selected Train workout.
- It can produce cardio text independently of `TrainingRunPrescription` / `TrainingEngineResult.run`.

## 1.8 Training Engine composition source

Source file:

- `src/lib/training-engine.ts`

Current owner:

- `evaluateTraining(input)`

Current flow:

```text
scheduledWorkout + scheduledRun + readinessResult + progressionResult + goalTrackingResult
  -> warmup block
  -> workout block
  -> run block
  -> cooldown block
  -> estimatedDuration
  -> priorityActions
  -> warnings
  -> TrainingEngineResult
```

Relevant current lines:

- `src/lib/training-engine.ts:20-82`
- `src/lib/training-engine.ts:88-110`
- `src/lib/training-engine.ts:186-259`
- `src/lib/home-command-center.ts:423-435`

Current output:

- `TrainingEngineResult`
  - `todayPlan`
  - `warmup`
  - `workout`
  - `run`
  - `cooldown`
  - `sessionOrder`
  - `estimatedDuration`
  - `priorityActions`
  - `warnings`
  - `trainingStatus`
  - `confidence`
  - `auditTrail`

Important current behavior:

- It is a composer of already-selected inputs.
- It does not own canonical date-aware selection of workout/run source plan.
- It has a second internal run fallback from `scheduledWorkout.longRunMiles`.

## 1.9 Home Command Center display model source

Source file:

- `src/lib/home-command-center.ts`

Current owner:

- `buildHomeCommandCenter(state, options)`

Current flow:

```text
state + options from page.tsx
  -> readiness/progression/goalTracking/performance
  -> evaluateTraining(...)
  -> HomeCommandCenterModel
```

Relevant current lines:

- `src/lib/home-command-center.ts:388-521`

Current output:

- `HomeCommandCenterModel`
  - `todaysWorkout`
  - `todaysRun`
  - `training.workout`
  - `training.run`
  - `trainingEngineResult`
  - `todaysGoals`
  - `coachRecommendation`

Important current behavior:

- It passes `scheduledWorkout` and `scheduledRun` into `evaluateTraining()`.
- It also stores raw `todaysWorkout` and `todaysRun` labels.
- It falls back to those labels if Training Engine does not provide a block.

## 1.10 Train execution source

Source file:

- `src/app/page.tsx`

Current owners:

- `TrainingPlan()`
- `ActiveWorkout()`
- `TrainRunLogger()`

Current flow:

```text
Train tab
  -> TrainingPlan receives workout + scheduledRun + trainingEngineResult
  -> displays trainingEngineResult blocks
  -> startWorkout() creates WorkoutSession from displayedWorkout
  -> ActiveWorkout logs sets
  -> TrainRunLogger logs run if runScheduled
```

Relevant current lines:

- `src/app/page.tsx:653-730`

Current output:

- `WorkoutSession`
- `SetLog[]`
- `RunLog`
- post-workout summaries/recommendations via downstream helpers

Important current behavior:

- Train display can come from `trainingEngineResult`.
- Lift execution still uses `displayedWorkout` from the selected workout prop.
- Run logging is tied to `scheduledRun` / `trainingEngineResult.run`.

---

# 2. Current Duplicate Paths

## 2.1 Date-aware workout vs selected workout

Duplicate path:

```text
todayWorkout = getWorkoutForWeekDay(state.currentWeek, todayPlanDayIndex)
currentWorkout = getWorkoutForWeekDay(selectedWeek, selectedDay)
```

Files:

- `src/app/page.tsx:154-157`

Risk:

- Home can prescribe one workout while Train executes/logs another if selected week/day differs from today's date-aware day.

Desired V1 resolution:

- `DailyTrainingSession` owns `scheduledWorkout` and its source workout ID.
- Train executes from `dailyTrainingSession.blocks`, not from independent selected week/day state.

## 2.2 Adjusted today workout vs adjusted selected workout

Duplicate path:

```text
adjustedTodayWorkout = adjustWorkoutForReadiness(todayWorkout, readiness.status)
adjustedWorkout = adjustWorkoutForReadiness(currentWorkout, readiness.status)
```

Files:

- `src/app/page.tsx:156-157`
- `src/lib/coach-engine.ts:864-874`

Risk:

- Readiness adjustment can be applied to two different workouts in the same render.

Desired V1 resolution:

- Readiness adjustment is represented once in `DailyTrainingSession.modifications` and applied to the session's canonical training blocks.

## 2.3 Run display vs scheduled run

Duplicate path:

```text
getTodayRunForDate(...) -> TodayRunDisplay
getScheduledRunForTraining(...) -> TrainingRunPrescription | null
```

Files:

- `src/lib/home-command-center.ts:201-233`
- `src/app/page.tsx:170-174`

Risk:

- A run can exist as a display object but not exist as a Training Engine run block.
- Minute-based Zone 2 runs are the clearest example.

Desired V1 resolution:

- `DailyTrainingSession` supports both mileage-based and duration-based run prescriptions.
- Run presence is not determined by distance alone.

## 2.4 Running recommendation vs DailyPrescription cardio recommendation

Duplicate path:

```text
generateRunningRecommendation(...) -> RunningRecommendation
generateDailyPrescription(...) -> cardioRecommendation
```

Files:

- `src/lib/coach-engine.ts:481-492`
- `src/lib/coach-engine.ts:746-861`

Risk:

- Running Engine can recommend a run distance/action while DailyPrescription emits separate cardio text.
- DailyPrescription can say cardio is planned based on workout regex even if Training Engine has no run block.

Desired V1 resolution:

- `DailyTrainingSession.run` owns the canonical run prescription.
- `DailyPrescription` may summarize or explain it but must not independently prescribe a different cardio plan.

## 2.5 Training Engine run fallback from workout.longRunMiles

Duplicate path:

```text
runDistance(input):
  scheduledRun.distanceMiles
  OR scheduledWorkout.longRunMiles
```

Files:

- `src/lib/training-engine.ts:88-95`

Risk:

- Run distance can come from `scheduledRun` or from `scheduledWorkout.longRunMiles`.
- This works for long runs but creates a second source of truth inside the composer.

Desired V1 resolution:

- `DailyTrainingSession.run` should be the only run prescription consumed by Training Engine/Train.
- `scheduledWorkout.longRunMiles` may be used only by the planner adapter to construct the canonical run block.

## 2.6 Home display fallbacks

Duplicate path:

```text
training.workout.name = trainingEngine.workout?.title ?? options.todaysWorkout
training.run.name = trainingEngine.run?.title ?? options.todaysRun
```

Files:

- `src/lib/home-command-center.ts:484-492`

Risk:

- Home can display a workout/run label even when Training Engine did not produce that block.

Desired V1 resolution:

- Home reads from `DailyTrainingSession.summary` and block list only.
- No raw label fallback for training prescription.

## 2.7 Home goals injected outside Training Engine

Duplicate path:

```text
trainingEngine.priorityActions
  -> homeTrainingGoals
  -> maybe inject Complete ${options.todaysWorkout}
```

Files:

- `src/lib/home-command-center.ts:447-457`

Risk:

- Home can create an extra training goal that was not produced by the canonical training session.

Desired V1 resolution:

- `DailyTrainingSession.todayGoals` owns training-related goals.
- Home may display them but not synthesize new training prescription goals.

## 2.8 Train displays one source and logs another

Duplicate path:

```text
Display: trainingEngineResult.workout?.title
Logging: displayedWorkout.id/title
```

Files:

- `src/app/page.tsx:653-730`

Risk:

- Train card can show the date-aware Training Engine result while `startWorkout()` logs the selected workout object.

Desired V1 resolution:

- Train logs using `DailyTrainingSession.blocks[].sourceWorkoutId` / `executionTarget` only.

## 2.9 Train fallback recomposes training

Duplicate path:

```text
providedTrainingEngineResult ?? evaluateTraining({ scheduledWorkout: displayedWorkout, scheduledRun })
```

Files:

- `src/app/page.tsx:658-670`

Risk:

- If the provided result is missing, Train recomposes with selected workout fallback inputs and low-confidence fake progression/goal results.

Desired V1 resolution:

- Train should require a `DailyTrainingSession` or show a safe unavailable state.
- It should not silently compose a separate prescription.

## 2.10 Legacy train session block builder

Duplicate path:

```text
buildTrainSessionBlocks(input)
```

File:

- `src/lib/run-logger.ts:224-283`

Risk:

- Separate run/workout ordering logic remains available outside `TrainingEngineResult`.

Desired V1 resolution:

- Mark as deprecated or route through `DailyTrainingSession` during implementation.

---

# 3. Proposed DailyTrainingSession Model

## 3.1 Ownership rule

`DailyTrainingSession` becomes the canonical output of the Training Planner.

All UI and logging surfaces should consume the session. No UI screen should independently decide what workout or run is scheduled today.

Proposed source file for future implementation:

- `src/lib/training-planner.ts`

Proposed tests:

- `src/lib/training-planner.test.ts`

The current `src/lib/training-engine.ts` may either:

1. Be refactored into the planner, or
2. Remain as a lower-level composition helper called only by `training-planner.ts`.

Preferred V1 architecture:

```text
training-planner.ts
  owns date-aware plan resolution + canonical DailyTrainingSession

training-engine.ts
  becomes internal composition helper or is folded into planner
```

## 3.2 Canonical API

Proposed future API:

```ts
export function buildDailyTrainingSession(input: BuildDailyTrainingSessionInput): DailyTrainingSession;
```

## 3.3 Proposed input type

```ts
export interface BuildDailyTrainingSessionInput {
  date: string;
  currentWeek: number;
  workouts: Workout[];
  readinessResult: ReadinessEngineResult;
  progressionResult: ProgressionEngineResult;
  goalTrackingResult: GoalTrackingEngineResult;
  runningEngineResult?: RunningEngineResult | null;
  runningRecommendation?: RunningRecommendation | null;
  userPreferences?: {
    includeWarmup?: boolean;
    includeCooldown?: boolean;
    preferredOrder?: Array<"lift" | "run" | "mobility" | "recovery">;
    availableMinutes?: number | null;
  } | null;
  completedWorkoutSessions?: WorkoutSession[];
  completedRunLogs?: RunLog[];
}
```

Design notes:

- `date` is required.
- `currentWeek` is required.
- `workouts[]` remains the initial source plan for V1 migration.
- The planner, not page.tsx, resolves day index and source workout.
- The planner receives canonical engine outputs but does not recalculate their domain decisions.

## 3.4 Proposed output type

```ts
export interface DailyTrainingSession {
  id: string;
  date: string;
  currentWeek: number;
  dayIndex: number;
  sourcePlan: {
    source: "seed-workouts-v1" | "future-race-calendar" | "manual-override";
    sourceWorkoutId?: string;
    sourceWorkoutTitle?: string;
    sourceWorkoutType?: string;
  };
  status: "Normal" | "Modified" | "Recovery" | "Rest";
  readinessStatus: ReadinessStatus;
  confidence: "High" | "Medium" | "Low";
  summary: {
    title: string;
    primaryAction: string;
    workoutName: string | null;
    runName: string | null;
    estimatedDurationMinutes: number;
    completionStatus: "Not Started" | "Partially Completed" | "Completed" | "Not Scheduled";
  };
  blocks: DailyTrainingBlock[];
  workout: DailyWorkoutPrescription | null;
  run: DailyRunPrescription | null;
  mobility: DailyMobilityPrescription | null;
  recovery: DailyRecoveryPrescription | null;
  combinedLoad: DailyTrainingLoadEstimate;
  modifications: DailyTrainingModification[];
  warnings: DailyTrainingWarning[];
  todayGoals: DailyTrainingGoal[];
  auditTrail: DailyTrainingAuditEntry[];
}
```

## 3.5 Proposed block type

```ts
export type DailyTrainingBlockKind =
  | "warmup"
  | "lift"
  | "run"
  | "mobility"
  | "walk"
  | "cooldown"
  | "summary";

export interface DailyTrainingBlock {
  id: string;
  kind: DailyTrainingBlockKind;
  order: number;
  title: string;
  description: string;
  items: string[];
  estimatedMinutes: number;
  source: "Training Planner" | "Readiness Engine" | "Workout Engine" | "Running Engine" | "Progression Engine" | "Goal Tracking Engine";
  executionTarget?: {
    type: "workout" | "run" | "none";
    sourceWorkoutId?: string;
    sourceRunId?: string;
    logDate: string;
  };
}
```

## 3.6 Proposed workout prescription type

```ts
export interface DailyWorkoutPrescription {
  sourceWorkoutId: string;
  title: string;
  type: string;
  exercises: Exercise[];
  estimatedMinutes: number;
  readinessAdjusted: boolean;
  executionRequired: boolean;
  loggingTarget: {
    workoutId: string;
    workoutTitle: string;
    date: string;
  };
}
```

## 3.7 Proposed run prescription type

```ts
export interface DailyRunPrescription {
  sourceWorkoutId?: string;
  title: string;
  type: "easy" | "long" | "tempo" | "speed" | "race" | "walk";
  prescriptionMode: "distance" | "duration" | "recovery";
  distanceMiles: number | null;
  durationMinutes: number | null;
  required: boolean;
  estimatedMinutes: number;
  runningRecommendationAction?: "Progress" | "Hold" | "Regress" | "Recovery Focus";
  executionRequired: boolean;
  loggingTarget: {
    date: string;
    plannedDistance: number | null;
    plannedDurationMinutes: number | null;
    runType: RunType;
  };
}
```

Important V1 change:

- A run may be valid with `durationMinutes` even when `distanceMiles` is null or 0.
- `distanceMiles > 0` must no longer be the only definition of a scheduled run.

## 3.8 Proposed combined load estimate

V1 should define a conservative load estimate without pretending to be a full sports-science model.

```ts
export interface DailyTrainingLoadEstimate {
  estimatedDurationMinutes: number;
  modalityCount: number;
  hasLift: boolean;
  hasRun: boolean;
  hasConditioning: boolean;
  hasPlyometricsOrSprints: boolean;
  lowerBodyStress: "None" | "Low" | "Moderate" | "High";
  sessionStress: "Low" | "Moderate" | "High" | "Recovery";
  overloadFlags: string[];
}
```

V1 purpose:

- Detect obvious combined-session risk.
- Do not replace Running Engine or Workout Engine.
- Do not add advanced TSS/HRV modeling yet.

Suggested V1 stress rules:

- `Recovery` if readiness is Red or progression is Recovery Focus.
- `High` if lower-body strength/plyometrics/conditioning occurs within the same session as a run.
- `High` if estimated duration is over 90 minutes.
- `Moderate` if lift + run occur together but not lower-body heavy.
- `Moderate` if session has sprints, jumps, burpees, kettlebell swings, or loaded carries.
- `Low` for mobility/walk/recovery-only sessions.

## 3.9 Proposed planner algorithm

```text
buildDailyTrainingSession(input)
  1. Resolve dayIndex from input.date.
  2. Resolve sourceWorkout from input.workouts by currentWeek + dayIndex.
  3. Classify sourceWorkout into modalities:
       lift, run, mobility, walk, recovery, conditioning.
  4. Build canonical workout prescription if sourceWorkout has lift content.
  5. Build canonical run prescription if sourceWorkout has run content:
       - mileage run if longRunMiles or reps contain miles
       - duration run if reps/notes contain minutes
       - recovery walk if recovery/walk only and intended as recovery
  6. Apply readiness/progression safety overrides once:
       - Red or Recovery Focus -> recovery session
       - Yellow -> modified session
       - Green -> normal session
  7. Compose ordered blocks:
       warmup -> lift/run/mobility/walk -> cooldown
       default order: lift before run unless run-only day or preference says otherwise.
  8. Calculate duration and V1 combined load estimate.
  9. Create canonical todayGoals from blocks and safety needs.
  10. Attach warnings and audit trail.
  11. Return DailyTrainingSession.
```

## 3.10 Invariants

The implementation must enforce these invariants:

1. One date produces one `DailyTrainingSession`.
2. Home and Train read the same session object.
3. Train logs from `DailyTrainingSession.executionTarget`, not selected dropdown state.
4. A run can be distance-based or duration-based.
5. If `DailyTrainingSession.run` is null, no run should be displayed as scheduled.
6. If `DailyTrainingSession.workout` is null, no lift/workout should be startable.
7. Readiness modifications are applied once.
8. Recovery override blocks hard training across all consumers.
9. Home may display `todayGoals` but may not synthesize separate training goals.
10. DailyPrescription may summarize/explain the session but may not create an independent workout/run prescription.

---

# 4. Files That Would Consume It

## 4.1 New or refactored source file

Proposed create in implementation phase:

- `src/lib/training-planner.ts`

Proposed responsibilities:

- Own `BuildDailyTrainingSessionInput`.
- Own `DailyTrainingSession` types or export from a colocated type file.
- Resolve `date -> dayIndex`.
- Resolve source workout.
- Classify modalities.
- Convert seed `Workout` into canonical workout/run/mobility/recovery blocks.
- Apply readiness/progression safety overrides.
- Produce one canonical session object.

Alternative if avoiding a new file:

- Refactor `src/lib/training-engine.ts` into the canonical planner.

Preferred path:

- Create `src/lib/training-planner.ts` and keep `training-engine.ts` temporarily as a compatibility/composition helper.

## 4.2 `src/app/page.tsx`

Future consumption changes:

- Replace independent `todayWorkout`, `adjustedTodayWorkout`, `todayRunDisplay`, `scheduledRunForTraining`, and Train selected workout prescription with one `dailyTrainingSession` object.
- Keep selected week/day dropdown behavior unchanged initially if needed, but do not let it define today's session execution.
- Pass `dailyTrainingSession` to Home and Train consumers.

Do not change UI in this architecture phase.

Future non-UI behavior goal:

```text
page.tsx
  -> buildDailyTrainingSession(...)
  -> buildHomeCommandCenter(... dailyTrainingSession ...)
  -> TrainScreen(... dailyTrainingSession ...)
```

## 4.3 `src/lib/home-command-center.ts`

Future consumption changes:

- Accept `dailyTrainingSession` in `HomeCommandCenterOptions`.
- Stop accepting raw `todaysWorkout`, `todaysRun`, `scheduledWorkout`, and `scheduledRun` as independent prescription sources once migration is complete.
- Continue to build Home model, but derive all training-specific display fields from `dailyTrainingSession`.

Future target:

```ts
interface HomeCommandCenterOptions {
  today: string;
  readinessStatus: ReadinessStatus;
  macroTarget: MacroTarget;
  coachRecommendation: string;
  dailyTrainingSession: DailyTrainingSession;
  // temporary legacy fields allowed during migration only
}
```

## 4.4 `src/lib/training-engine.ts`

Future consumption options:

Option A — internal helper:

- Keep `evaluateTraining()` temporarily.
- `training-planner.ts` calls it after canonical workout/run resolution.
- It no longer receives arbitrary `scheduledWorkout`/`scheduledRun` from page.tsx.

Option B — absorbed into planner:

- Move block composition logic into `buildDailyTrainingSession()`.
- Deprecate `TrainingEngineInput` and `TrainingEngineResult` after consumers migrate.

Recommended V1:

- Option A first for lower risk.
- Later cleanup can fold or rename once tests prove behavior is stable.

## 4.5 `src/lib/coach-engine.ts`

Future consumption changes:

- `generateDailyPrescription()` should receive `dailyTrainingSession` or a session summary.
- It should use the session's canonical workout/run blocks to produce explanation text.
- It should not independently decide cardio/lift prescription.

Future target input addition:

```ts
generateDailyPrescription({
  ...legacyInputs,
  dailyTrainingSession,
})
```

Migration note:

- During transition, keep legacy fields but prefer session-derived fields.

## 4.6 `src/lib/home-daily-dashboard.ts`

Future consumption changes:

- Continue receiving Home model.
- Home model's `training.workout`, `training.run`, and goals should be session-derived.
- No direct planner import required if Home Command Center remains the adapter.

## 4.7 Train components inside `src/app/page.tsx`

Future consumption changes:

- `TrainingPlan()` should receive `dailyTrainingSession`.
- `trainBlocks` should be `dailyTrainingSession.blocks`.
- `liftScheduled` should derive from `dailyTrainingSession.workout`.
- `runScheduled` should derive from `dailyTrainingSession.run`.
- `startWorkout()` should use `dailyTrainingSession.workout.loggingTarget`.
- `TrainRunLogger` should use `dailyTrainingSession.run.loggingTarget`.

Important:

- This does not require a UI redesign.
- It is wiring/source-of-truth migration only.

## 4.8 Tests that currently consume old paths

Likely consumers to update/add in implementation phase:

- `src/lib/training-engine.test.ts`
- `src/lib/home-command-center.test.ts`
- `src/lib/train-execution.test.ts`
- potential new `src/lib/training-planner.test.ts`

Existing tests should be preserved where they verify compatibility behavior, but new planner tests should own canonical session behavior.

---

# 5. Migration Strategy

## Phase X.1 — Architecture only

Current document.

Deliverable:

- `TRAINING_PLANNER_ARCHITECTURE_V1.md`

Allowed changes:

- Documentation only.

Not allowed:

- Code changes.
- UI changes.
- Feature additions.

## Phase X.2 — Add planner types and pure planner function behind tests

Goal:

- Introduce `DailyTrainingSession` without changing UI behavior.

Likely files:

- Create: `src/lib/training-planner.ts`
- Create: `src/lib/training-planner.test.ts`

Implementation rules:

- Pure deterministic function.
- No React imports.
- No localStorage/persistence calls.
- No UI changes.
- No page wiring changes yet unless explicitly approved.

Tests first:

- Date resolves to correct day index.
- Week/day source workout selected correctly.
- Lift-only day produces lift block and no run.
- Distance run day produces run block.
- Duration run day produces run block even when distance is null/0.
- Red readiness produces recovery session.
- Yellow readiness marks modified session once.
- Combined load flags obvious lift+run/lower+run risks.

## Phase X.3 — Home Command Center compatibility adapter

Goal:

- Allow Home Command Center to consume `DailyTrainingSession` while preserving current UI shape.

Likely files:

- Modify: `src/lib/home-command-center.ts`
- Modify: `src/lib/home-command-center.test.ts`

Implementation rules:

- Home UI output remains same shape.
- Training display derives from session.
- Raw label fallbacks remain only as backward-compatible temporary code paths.
- Tests prove Home no longer displays a run unless session has a run.

## Phase X.4 — Page-level single construction

Goal:

- `src/app/page.tsx` builds `dailyTrainingSession` once and passes it to Home/Train adapters.

Likely files:

- Modify: `src/app/page.tsx`
- Modify/add tests if page-level model logic exists in extracted helpers.

Implementation rules:

- No UI redesign.
- Remove duplicate today-vs-selected prescription ownership.
- Keep week/day dropdown if needed for browsing, but do not let it define today's canonical execution session.

## Phase X.5 — Train consumes session execution targets

Goal:

- Train execution/logging uses session block targets.

Likely files:

- Modify: `src/app/page.tsx`
- Modify: `src/lib/train-execution.test.ts` or create planner-driven Train tests.

Implementation rules:

- Start workout from `dailyTrainingSession.workout.loggingTarget`.
- Log run from `dailyTrainingSession.run.loggingTarget`.
- Do not silently recompose with fallback `evaluateTraining()` using selected workout.

## Phase X.6 — DailyPrescription becomes explanatory only for training

Goal:

- `generateDailyPrescription()` stops independently creating conflicting training/cardio prescription text.

Likely files:

- Modify: `src/lib/coach-engine.ts`
- Modify: `src/lib/coach-engine.test.ts`

Implementation rules:

- It can summarize `DailyTrainingSession`.
- It can add nutrition/recovery recommendations.
- It should not create an independent workout/run source of truth.

## Phase X.7 — Deprecate legacy duplicate helpers

Goal:

- Remove or quarantine duplicate helpers after all consumers are migrated.

Likely files:

- `src/lib/home-command-center.ts`
- `src/lib/run-logger.ts`
- `src/lib/training-engine.ts`
- related tests

Potential deprecations:

- `getScheduledRunForTraining()` as a public prescription source.
- raw Home `todaysWorkout`/`todaysRun` prescription fallbacks.
- Train fallback `evaluateTraining()` recomposition.
- `buildTrainSessionBlocks()` if not routed through planner.

---

# 6. Tests Required

## 6.1 New canonical planner tests

Create in future implementation phase:

- `src/lib/training-planner.test.ts`

Required test cases:

### Date and source selection

- Monday date maps to dayIndex 0.
- Sunday date maps to dayIndex 6.
- `currentWeek + dayIndex` selects the correct `Workout`.
- Missing workout returns a safe Rest/Unavailable session or documented fallback, not an unrelated workout silently.

### Lift-only sessions

- Upper/lower strength day produces:
  - warmup
  - lift block
  - cooldown
  - no run block
  - `workout.loggingTarget.workoutId` equals the source workout ID

### Distance-based run sessions

- Long run day with `longRunMiles` produces:
  - run block
  - `prescriptionMode: "distance"`
  - `distanceMiles` populated
  - `durationMinutes` optional/null or estimated
  - no lift block when no lift exists

### Duration-based run sessions

- Zone 2 day with `35-45 min` produces:
  - run block
  - `prescriptionMode: "duration"`
  - `durationMinutes` populated
  - `distanceMiles` null or 0
  - no dropping from canonical session because distance is absent

### Embedded conditioning classification

- Sprint/plyometric/conditioning exercises are captured as conditioning stress.
- They do not accidentally become a separate run unless planner rules explicitly classify them as run.

### Recovery day classification

- Recovery day produces recovery/mobility/walk blocks.
- It does not create a normal lift block just because `Mobility Flow` or `Meal Prep` are exercises.

### Readiness overrides

- Red readiness produces recovery session and blocks hard lift/run.
- Yellow readiness produces modified session and applies modification once.
- Green readiness preserves planned session.

### Progression override

- `progressionResult.weeklyDecision === "Recovery Focus"` produces recovery session.

### Combined load estimate

- Lift + run day flags `modalityCount >= 2`.
- Lower-body strength + run flags high lower-body stress.
- Sprint/plyometric/conditioning day flags conditioning stress.
- Recovery day produces sessionStress `Recovery` or `Low`.

### Audit trail

- Session contains audit entries showing:
  - date -> dayIndex resolution
  - source workout ID/title
  - modality classification
  - readiness/progression override decision
  - run distance/duration parsing
  - combined load flags

## 6.2 Home Command Center tests

File:

- `src/lib/home-command-center.test.ts`

Required cases after migration:

- Home workout name comes from `DailyTrainingSession.summary.workoutName`.
- Home run name comes from `DailyTrainingSession.summary.runName`.
- Home does not show a run when `DailyTrainingSession.run` is null.
- Duration-based run appears as a run even with no distance.
- Home goals are session-derived and not duplicated by raw `todaysWorkout` fallback.
- Existing stale `Hold: 3 mi` regression tests remain covered by planner session source.

## 6.3 Training Engine compatibility tests

File:

- `src/lib/training-engine.test.ts`

Required cases if `training-engine.ts` remains as helper:

- `evaluateTraining()` is only called with planner-built scheduled workout/run in integration tests.
- No direct fallback from `scheduledWorkout.longRunMiles` is used as public source once planner owns run extraction.
- Recovery and warning behavior remains unchanged.

## 6.4 Train execution tests

Files:

- `src/lib/train-execution.test.ts`
- or new extracted Train model tests if execution logic is moved out of `page.tsx`

Required cases:

- Start lift logs the `DailyTrainingSession.workout.loggingTarget.workoutId`.
- Train display title and logged workout title match.
- Run logger uses `DailyTrainingSession.run.loggingTarget`.
- Duration-based run can be logged without requiring planned distance.
- Train does not recompute a fallback prescription from selected dropdown state.

## 6.5 Coach Engine / DailyPrescription tests

File:

- `src/lib/coach-engine.test.ts`

Required cases:

- `generateDailyPrescription()` summarizes the canonical session.
- It does not create a separate cardio recommendation that contradicts `DailyTrainingSession.run`.
- Red readiness explanation matches session recovery override.
- Yellow readiness explanation does not double-apply volume reductions.

## 6.6 Page integration or adapter tests

If app-level model extraction exists, add tests that prove:

- One date creates one `DailyTrainingSession`.
- Home and Train receive the same session object/source IDs.
- Selected week/day browsing does not change today's canonical execution session unless explicitly intended.

## 6.7 Regression tests from recent bugfixes

Maintain coverage for:

- No stale `Hold: 3 mi` every day.
- No manufactured run when no date-aware run exists.
- No stale run label converted into `scheduledRun`.
- Train and Home share the same run source of truth.

---

# Acceptance Criteria for a Future Implementation Phase

A future implementation phase should be accepted only if:

1. There is exactly one canonical `DailyTrainingSession` for today.
2. Home workout/run display derives from that session.
3. Train workout/run display derives from that session.
4. Train logging targets derive from that session.
5. Minute-based runs are preserved as run blocks.
6. Recovery days are not misclassified as normal lift days.
7. Readiness/progression overrides apply once.
8. Combined load flags exist for obvious overload cases.
9. Existing tests pass.
10. New planner tests cover date mapping, source resolution, run duration/mileage modes, duplicate-path prevention, and logging-target consistency.

---

# Inspected Evidence for This Architecture Document

Source files inspected:

- `src/app/page.tsx`
- `src/lib/seed-data.ts`
- `src/lib/home-command-center.ts`
- `src/lib/training-engine.ts`
- `src/lib/coach-engine.ts`
- `src/lib/running-engine.ts`
- `src/lib/run-logger.ts`
- `src/lib/types.ts`

Existing architecture/audit docs inspected:

- `MASTER_SYSTEM_ARCHITECTURE.md`
- `TRAIN_EXECUTION_AUDIT.md`

Pre-existing git status before creating this document:

```text
M src/app/page.tsx
M src/lib/home-command-center.test.ts
M src/lib/home-command-center.ts
```

This Phase X document intentionally creates/updates documentation only.

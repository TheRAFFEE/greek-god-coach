# TRAIN EXECUTION AUDIT

## Purpose

This audit determines the current workout/run execution and logging ownership before Phase 5: Train-only workout/run execution.

Scope is audit-only:

- No code changes.
- No UI changes.
- One documentation artifact only: `TRAIN_EXECUTION_AUDIT.md`.

The key Phase 5 objective should be to make **Train** the canonical consumer for workout and run execution/logging while leaving canonical engines intact.

## Exact Files Inspected

Primary implementation files:

- `src/app/page.tsx`
- `src/lib/navigation.ts`
- `src/lib/types.ts`
- `src/lib/seed-data.ts`
- `src/lib/daily-checkin.ts`
- `src/lib/workout-logger.ts`
- `src/lib/run-logger.ts`
- `src/lib/coach-engine.ts`
- `src/lib/workout-engine.ts`
- `src/lib/running-engine.ts`
- `src/lib/progression-engine.ts`
- `MASTER_SYSTEM_ARCHITECTURE.md`

Relevant test files/search hits inspected for behavior expectations:

- `src/lib/workout-logger.test.ts`
- `src/lib/run-logger.test.ts`
- `src/lib/home-command-center.test.ts`
- `src/lib/goal-tracking-engine.test.ts`
- `src/lib/mvp-dashboard.test.ts`

## Current Execution Flow

### Workout execution: current flow

Current workout execution is mostly implemented inside `src/app/page.tsx`, not in a dedicated Train execution module.

Flow:

```text
Home / nav
  -> active === "Train"
  -> TrainScreen
  -> TrainingPlan
  -> Start Training button
  -> creates WorkoutSession in state.workoutSessions
  -> ActiveWorkout
  -> user logs one set at a time
  -> completeSet()
  -> generateNextSetRecommendation()
  -> getNextWorkoutStep()
  -> rest timer / next set
  -> completed session
  -> generatePostWorkoutAnalysis()
  -> workoutSummaries + postWorkoutRecommendations + adjustments
```

Current ownership by file/function:

- `src/app/page.tsx`
  - `TrainScreen()` is a thin wrapper around `TrainingPlan()`.
  - `TrainingPlan()` owns the current Train preview and creates `WorkoutSession` records.
  - `ActiveWorkout()` owns set-by-set execution UI, set logging, rest timer state, session completion, post-workout summary persistence, and on-screen coach cues.
  - `coachingCue()` owns simple text cues by exercise name.
  - `formatSeconds()` owns timer display formatting.

- `src/lib/coach-engine.ts`
  - `generateNextSetRecommendation()` adapts a completed set into Workout Engine V2 and returns a `CoachDecision`.
  - `getNextWorkoutStep()` advances `WorkoutSession.currentSetNumber`, `currentExerciseIndex`, and marks session `completed` when the final prescribed set is completed.
  - `generatePostWorkoutAnalysis()` builds the post-workout `WorkoutSummary` and `PostWorkoutRecommendation[]` from the completed `WorkoutSession` and `Workout`.
  - `getRecommendedStartingWeight()` selects the last successful working weight from prior `SetLog[]`.

- `src/lib/workout-engine.ts`
  - Canonical Workout Engine V2 owns workout/exercise/set evaluation, progression, deload/substitution guidance, PRs, confidence, and audit trail.
  - It is consumed indirectly through `coach-engine.ts` wrappers during active set-by-set training and through `workout-logger.ts` during manual workout logging.

Current workout execution details:

1. `TrainingPlan.startWorkout()` creates a `WorkoutSession` with:
   - `mode: "coach"`
   - `status: "active"` if the adjusted workout has exercises
   - `status: "completed"` immediately if the adjusted workout has no exercises
   - empty `setLogs`
   - `currentExerciseIndex: 0`
   - `currentSetNumber: 1`
2. `ActiveWorkout.completeSet()` builds a `SetLog` from local form state:
   - weight used
   - reps completed
   - RPE
   - pain flag
   - form quality
3. `completeSet()` calls `generateNextSetRecommendation()`.
4. `generateNextSetRecommendation()` calls Workout Engine V2 through `evaluateWorkout()` after adapting the current set.
5. `completeSet()` attaches the returned `CoachDecision` to the `SetLog`.
6. `getNextWorkoutStep()` appends the set to the session and either:
   - increments set number,
   - moves to the next exercise, or
   - marks the session `completed` and sets `endedAt`.
7. `ActiveWorkout.persistSession()` updates:
   - `state.workoutSessions`
   - `state.setLogs`
   - `state.adjustments` for important set decisions
8. When the session is completed, `ActiveWorkout` calls `generatePostWorkoutAnalysis()` and persists:
   - `state.workoutSummaries`
   - `state.postWorkoutRecommendations`
   - `state.adjustments`

### Run execution: current flow

Current run execution is **not** implemented as a real Train execution flow.

Flow currently visible in Train:

```text
Home / nav
  -> active === "Train"
  -> TrainScreen
  -> TrainingPlan
  -> Today’s run preview card
  -> no Start Run execution state
  -> no in-Train run completion action
  -> no in-Train run logging form
```

Current run logging flow exists in Log, not Train:

```text
Log
  -> LogScreen section === "run"
  -> Running component
  -> RunLoggerInput form
  -> buildRunLoggerRecord()
  -> saveRunLoggerEntry()
  -> state.runLogs
```

Current run preview ownership:

- `src/app/page.tsx`
  - `TrainingPlan()` displays a Today’s run card with `runningRecommendation` and `plannedRunDistance`.
  - It does not execute, time, complete, or persist runs.

- `src/lib/coach-engine.ts`
  - `generateRunningRecommendation()` adapts run logs/readiness/planned distance into Running Engine V2.
  - `calculateRunTrends()` calculates simple legacy trend arrays for UI/recommendation context.

- `src/lib/running-engine.ts`
  - Canonical Running Engine V2 owns running prediction, pace-zone guidance, progression action, long-run status, injury risk, goal status, confidence, and audit trail.

Current run execution gap:

- Train shows today’s run recommendation but cannot complete/log the run.
- Runs are logged only through the Log tab’s `Running()` component.
- There is no run timer, run phase state, warm-up/cooldown for runs, post-run summary card in Train, or Train-side `saveRunLoggerEntry()` call.

## Current Logging Flow

### Workout logging locations

There are two workout logging paths today.

#### Location 1: Train active workout execution

File/function:

- `src/app/page.tsx`
  - `TrainingPlan()`
  - `ActiveWorkout()`

State mutations:

- `workoutSessions`
- `setLogs`
- `workoutSummaries`
- `postWorkoutRecommendations`
- `adjustments`

Important code responsibilities:

- `TrainingPlan.startWorkout()` creates the session.
- `ActiveWorkout.completeSet()` creates individual set logs.
- `ActiveWorkout.persistSession()` writes active/completed sessions and set logs.
- `ActiveWorkout` completion effect writes post-workout summaries/recommendations.

This is the closest current implementation to the desired canonical Train workflow.

#### Location 2: Log tab manual workout logger

File/function:

- `src/app/page.tsx`
  - `LogScreen()` section `"workout"`
  - `WorkoutLogger()`
- `src/lib/workout-logger.ts`
  - `buildWorkoutLoggerSession()`
  - `evaluateWorkoutLoggerResult()`
  - `saveWorkoutLoggerEntry()`

State mutations:

- `workoutSessions`
- `setLogs`
- `workoutSummaries`
- `postWorkoutRecommendations`

Important behavior:

- `WorkoutLogger()` creates a manual form with default exercises Bench Press and Row.
- `buildWorkoutLoggerSession()` converts simplified exercise inputs into a complete `WorkoutSession` and synthetic `SetLog[]`.
- `saveWorkoutLoggerEntry()` replaces workout sessions and set logs for the same date.

This is a duplicate workout logging path and should be removed from Log in Phase 5 or Phase 6 after Train has equivalent/better coverage.

### Run logging locations

There is one actual run logging path today, and it is in the wrong screen.

#### Location 1: Log tab run logger

File/function:

- `src/app/page.tsx`
  - `LogScreen()` section `"run"`
  - `Running()`
- `src/lib/run-logger.ts`
  - `buildRunLoggerRecord()`
  - `evaluateRunLoggerResult()`
  - `saveRunLoggerEntry()`

State mutations:

- `runLogs`

Important behavior:

- `Running()` creates a manual run form with planned distance, duration, pace, HR, RPE, walk breaks, pain score, and notes.
- `buildRunLoggerRecord()` maps form fields into a canonical-ish `RunLog`.
- `evaluateRunLoggerResult()` calls Running Engine V2 and returns summary/recommendation/pain warning.
- `saveRunLoggerEntry()` replaces a run log for the same date and sorts logs by date.

Current issue:

- Run logging exists only in Log, but the master architecture says Train must own all workout/run execution and logging.

### Daily check-in derived completion

File/function:

- `src/lib/daily-checkin.ts`
  - `deriveDailyCompletionStatus()`
  - `upsertDailyCheckIn()`

Behavior:

- `workoutCompleted` is derived from `state.workoutSessions` and session/set dates.
- `runCompleted` is derived from the existence of any `state.runLogs` entry on that date.
- Daily check-in fields `workoutCompleted` and `runCompleted` are overwritten from logs on save.

Implication:

- The long-term source of truth for workout/run completion should be logs/sessions, not manual daily check-in booleans.
- This is good, but it makes duplicate logging dangerous because the same date can be marked complete from different paths.

## Ownership Answers Required by Task

### 1. How workouts are currently executed

Workouts are executed in `src/app/page.tsx` through `TrainingPlan()` and `ActiveWorkout()`.

Execution is set-by-set:

- Start Training creates a `WorkoutSession`.
- ActiveWorkout logs actual set values.
- Each set calls Workout Engine V2 indirectly through `generateNextSetRecommendation()`.
- `getNextWorkoutStep()` advances the session.
- Completion triggers `generatePostWorkoutAnalysis()` and persistence of workout summary/recommendations.

### 2. How runs are currently executed

Runs are not truly executed in Train.

Current state:

- Train displays a run preview/recommendation.
- Log contains a manual run form.
- No in-Train run execution, completion, timer, cue flow, or post-run summary exists.

### 3. Where workout logging occurs

Workout logging occurs in two places:

1. `src/app/page.tsx` / `ActiveWorkout()` inside Train.
2. `src/app/page.tsx` / `WorkoutLogger()` inside Log, backed by `src/lib/workout-logger.ts`.

### 4. Where run logging occurs

Run logging occurs in one place:

1. `src/app/page.tsx` / `Running()` inside Log, backed by `src/lib/run-logger.ts`.

Train displays run guidance but does not log runs.

### 5. Which files own timers

Current timer ownership:

- `src/app/page.tsx`
  - `ActiveWorkout()` owns rest timer state: `rest`, `secondsRemaining`, `paused`.
  - `ActiveWorkout()` owns the `window.setInterval()` countdown effect.
  - `formatSeconds()` formats timer display.
  - Timer controls are inline in the ActiveWorkout render: pause/resume, add 30 seconds, skip rest/start next set.

No separate timer module exists.

### 6. Which files own coach cues

Current coach cue ownership:

- `src/app/page.tsx`
  - `coachingCue(exercise)` owns simple exercise-name keyword cues for bench/press, squat/deadlift, run/sprint, mobility/walk, and a default cue.

- `src/lib/coach-engine.ts`
  - `workoutEngineResultToCoachDecision()` sets a generic `cue` on `CoachDecision`: `Keep reps crisp, stop before grinders, and prioritize pain-free form.`
  - `generateDailyPrescription()` produces recovery tasks and training guidance copy.

Current issue:

- Cues are split between inline UI keyword logic and engine/adaptor decision output.
- The visible active workout cue uses `page.tsx` `coachingCue()` rather than the `CoachDecision.cue` generated from Workout Engine V2 adapters.

### 7. Which files own workout completion

Current workout completion ownership:

- `src/lib/coach-engine.ts`
  - `getNextWorkoutStep()` is the main completion state machine. It marks a session `completed` and sets `endedAt` when final prescribed set is logged.

- `src/app/page.tsx`
  - `ActiveWorkout.skipExercise()` can mark a session `completed` when skipping past the last exercise.
  - `ActiveWorkout.endWorkout()` marks a session `ended`.
  - `ActiveWorkout` completion effect persists summary/recommendations after `session.status === "completed"`.
  - `TrainingPlan.startWorkout()` can create an immediately `completed` session for an adjusted workout with zero exercises.

- `src/lib/workout-logger.ts`
  - `buildWorkoutLoggerSession()` independently sets `WorkoutSession.status` to `completed` or `ended` from a manual form.
  - `saveWorkoutLoggerEntry()` persists manual completed/ended sessions.

Current issue:

- Completion is duplicated between Train active execution, manual Log workout logger, and helper state transitions.

### 8. Which files own run completion

Current run completion ownership:

- `src/lib/run-logger.ts`
  - `buildRunLoggerRecord()` sets `completed` to `input.distance > 0 && input.durationMinutes > 0`.
  - `saveRunLoggerEntry()` persists the run.

- `src/lib/daily-checkin.ts`
  - `deriveDailyCompletionStatus()` treats any run log for the date as `runCompleted`, regardless of the `RunLog.completed` boolean.

- `src/lib/running-engine.ts`
  - Running Engine V2 interprets `completed` for progression/long-run status, but it does not own logging or state mutation.

Current issue:

- Completion detection is inconsistent:
  - `RunLog.completed` means distance and duration are positive.
  - Daily check-in treats existence of any run log on date as completed.
- There is no Train run completion action.

### 9. Which files should become canonical Train consumers

Phase 5 should make these canonical Train consumers:

- `src/app/page.tsx`
  - Still acceptable for Phase 5 if the project is intentionally single-page for now, but Train-specific logic is already large and should be isolated later.
  - For Phase 5 only, this is likely the main UI file to modify.

- `src/lib/run-logger.ts`
  - Should be consumed by Train for run logging persistence.
  - Do not duplicate run-record mapping inside UI.
  - Use `buildRunLoggerRecord()` and `saveRunLoggerEntry()` from Train until/unless a future Training Engine replaces it.

- `src/lib/workout-logger.ts`
  - Should not remain a separate Log consumer.
  - Could remain as a compatibility wrapper/tested manual adapter, but Train should not need its simplified manual workout form if active set execution is canonical.

- `src/lib/coach-engine.ts`
  - Existing Train execution currently depends on `generateNextSetRecommendation()`, `getNextWorkoutStep()`, and `generatePostWorkoutAnalysis()`.
  - These can remain compatibility consumers of Workout Engine V2 in Phase 5, as long as engine logic is not changed.

- `src/lib/workout-engine.ts`
  - Canonical engine consumed indirectly via `coach-engine.ts` wrappers.
  - Do not modify engine logic in Phase 5.

- `src/lib/running-engine.ts`
  - Canonical engine consumed indirectly via `run-logger.ts` / `coach-engine.ts` wrappers.
  - Do not modify engine logic in Phase 5.

- `src/lib/daily-checkin.ts`
  - Completion derivation should continue to consume canonical session/run logs.
  - Phase 5 may need tests around completion derivation, but avoid changing readiness logic.

## Duplicate Responsibilities

### Duplicate workout logging

Duplicate locations:

1. Train active execution:
   - `src/app/page.tsx` / `ActiveWorkout()`
2. Log manual workout logging:
   - `src/app/page.tsx` / `WorkoutLogger()`
   - `src/lib/workout-logger.ts`

Why this matters:

- Two screens can create/replace workout sessions for the same date.
- Train logs set-by-set against the planned workout.
- Log creates synthetic manual sessions from simplified exercise inputs.
- Both write `workoutSessions`, `setLogs`, `workoutSummaries`, and `postWorkoutRecommendations`.

Recommendation:

- Phase 5 should make Train the only user-facing workout logging surface.
- `workout-logger.ts` may remain temporarily for tests/compatibility, but Log should stop exposing `WorkoutLogger()` after Train has the required execution/logging flow.

### Duplicate workout completion

Duplicate locations:

- `src/lib/coach-engine.ts` / `getNextWorkoutStep()`
- `src/app/page.tsx` / `ActiveWorkout.skipExercise()`
- `src/app/page.tsx` / `ActiveWorkout.endWorkout()`
- `src/lib/workout-logger.ts` / `buildWorkoutLoggerSession()`

Recommendation:

- Canonical active-session completion should be Train execution state.
- Helper functions may remain, but only one user-facing screen should be able to complete training.

### Duplicate coach cue ownership

Duplicate locations:

- `src/app/page.tsx` / `coachingCue()`
- `src/lib/coach-engine.ts` / `workoutEngineResultToCoachDecision()` `cue`
- `src/lib/coach-engine.ts` / `generateDailyPrescription()` recovery/training copy

Recommendation:

- In Phase 5, keep simple cues if necessary but route visible set-specific cue copy from the active Train session/decision where possible.
- Longer-term Training Engine should own session-step cues by composing Workout/Running outputs.

### Duplicate/incorrect run responsibility

Current mismatch:

- Train owns run preview only.
- Log owns actual run logging.
- Running Engine owns run evaluation/progression.

Recommendation:

- Phase 5 should move user-facing run logging into Train.
- Log should eventually remove Run Logging entirely.
- `run-logger.ts` should remain the adapter for mapping Train run forms to `RunLog` and invoking Running Engine V2.

### Completion derivation inconsistency

Files:

- `src/lib/run-logger.ts`
- `src/lib/daily-checkin.ts`

Current issue:

- `RunLog.completed` requires positive distance and duration.
- `deriveDailyCompletionStatus()` treats any run log for the date as completed.

Recommendation:

- Phase 5 should avoid creating incomplete run logs unless there is an explicit missed-run record model.
- If missed-run logging is added later, daily completion derivation must check `run.completed === true`.

## Files to Modify in Phase 5

Likely Phase 5 files:

- `src/app/page.tsx`
  - Add Train-only run execution/logging UI.
  - Update Train to show ordered session blocks: warm-up, lift, run, cooldown.
  - Route all workout/run execution through Train.
  - Remove or hide duplicate workout/run logger UI from Log after Train has replacement coverage.

- `src/lib/run-logger.ts`
  - Likely no engine logic changes required.
  - May be consumed from Train.
  - Only modify if a small adapter/test seam is needed for Train run execution input.

- `src/lib/run-logger.test.ts`
  - Add/adjust tests if `run-logger.ts` behavior changes.

- `src/lib/daily-checkin.ts`
  - Only modify if Phase 5 explicitly fixes run completion derivation to require `run.completed`.
  - If modified, add/adjust tests.

- `src/lib/daily-checkin.test.ts`
  - Add coverage for Train-created run logs and completion derivation if completion logic changes.

- `src/lib/navigation.ts`
  - Possibly update `screenGroups.Log` to remove `Workout logging` and `Run logging` after Log cleanup.
  - If Phase 5 only hides UI inside `page.tsx`, this may be deferred to Phase 6.

- New tests may be appropriate in existing files or a new pure model file if Phase 5 extracts a Train model.

Recommended optional extraction if Phase 5 scope permits:

- `src/lib/train-execution.ts`
  - Pure model/state helpers for ordered training blocks, run input defaults, and phase completion.
  - This would reduce `page.tsx` growth.
  - However, user’s Phase 5 prompt should explicitly allow a new file before creating it.

## Files NOT to Modify in Phase 5

Do not modify canonical engine logic in Phase 5 unless a later prompt explicitly changes scope:

- `src/lib/readiness-engine.ts`
- `src/lib/nutrition-engine.ts`
- `src/lib/running-engine.ts`
- `src/lib/workout-engine.ts`
- `src/lib/progression-engine.ts`
- `src/lib/goal-tracking-engine.ts`

Avoid modifying unrelated surfaces:

- Nutrition UI/logging internals, except not relevant to Train.
- Progress analytics, except if a test import requires no behavior change.
- Backup/restore, More settings, food AI APIs.
- Supabase persistence mappings unless new persisted fields are introduced, which Phase 5 should avoid.

Avoid deleting compatibility wrappers in Phase 5 unless acceptance criteria explicitly says so:

- `src/lib/workout-logger.ts`
- `src/lib/run-logger.ts`

Phase 5 should focus on user-facing ownership and safe migration, not a big-bang cleanup.

## Proposed Migration Order

### Step 1: Lock current behavior with tests

Add tests before implementation for:

- Train shows both workout and run when the current day includes both.
- Train shows workout-only for lift-only days.
- Train shows run-only / long-run execution for long-run days.
- Log no longer exposes workout/run logging once Train owns both.
- Existing `Daily Check-In`, `Nutrition`, `Body metrics`, and `Progress photos` remain in Log.

### Step 2: Define Train session order without engine rewrites

Use current data sources:

- Planned workout from `getWorkoutForWeekDay()`.
- Adjusted workout from existing readiness adjustment path.
- Run recommendation from existing Running Engine V2 adapter path.

Represent the user-facing order:

```text
Warm-up
  -> Lift, if workout has lift/non-run exercises
  -> Run, if today includes run/conditioning/long run
  -> Cooldown
  -> Post-session summary
```

Do not create new Training Engine logic unless explicitly asked. In Phase 5, this can be a UI/consumer composition.

### Step 3: Add Train run logging

Use existing tested run adapter:

```text
Train run form/action
  -> RunLoggerInput
  -> buildRunLoggerRecord()
  -> saveRunLoggerEntry()
  -> state.runLogs
  -> run summary display
```

Requirements:

- Run logs created in Train must be date-based and avoid duplicates by date, consistent with `saveRunLoggerEntry()`.
- Run completion should feed `deriveDailyCompletionStatus()` through `state.runLogs`.
- Run summary should display the `evaluateRunLoggerResult()` result from `saveRunLoggerEntry()` if possible.

### Step 4: Keep active workout execution as canonical Train lift path

Preserve current set-by-set execution:

- `ActiveWorkout.completeSet()`
- `generateNextSetRecommendation()`
- `getNextWorkoutStep()`
- rest timer
- post-workout summary

Do not rewrite Workout Engine V2.

### Step 5: Remove duplicate user-facing workout/run logging from Log

After Train has workout/run execution/logging:

- Remove `Workout logging` option from Log UI.
- Remove `Run logging` option from Log UI.
- Keep Log options:
  - Daily check-in
  - Nutrition logging
  - Body metrics logging
  - Progress photos when present/currently in Progress until later cleanup

Note: MASTER_SYSTEM_ARCHITECTURE says Log should keep progress photos, but current implementation has progress photos in Progress. If Phase 5 prompt is narrowly Train-only, moving photos should wait for a later Log cleanup phase.

### Step 6: Verify completion and no duplicate logging

Manual/smoke scenarios:

- Complete a lift in Train; check daily check-in shows workout completed.
- Log a run in Train; check daily check-in shows run completed.
- Log tab no longer offers workout/run logging.
- Existing nutrition/body/daily check-in flows still work.

### Step 7: Run full validation

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Risk Assessment

### Risk: `page.tsx` is already too large

Current evidence:

- `src/app/page.tsx` contains Home, Train, Log, Progress, More, workout execution, run logging, nutrition logging, body metrics, photos, and settings in one file.

Impact:

- Phase 5 changes could make regressions easier and type errors harder to isolate.

Mitigation:

- Prefer a pure helper/model extraction if the Phase 5 prompt allows a new file.
- Otherwise keep edits tightly scoped inside existing Train/Log components.
- Do not touch engine logic.

### Risk: duplicate workout/run logs corrupt progress signals

Current evidence:

- Train and Log can both create workout session data.
- Log can create run data while Train only previews runs.

Impact:

- Goal Tracking, Progression, Daily Check-In, and Progress can receive misleading completion/adherence signals.

Mitigation:

- Make Train the only user-facing workout/run logging place.
- Use existing save helpers that replace same-date entries where possible.
- Add tests for no Log workout/run logging controls.

### Risk: run completion semantics are inconsistent

Current evidence:

- `RunLog.completed` requires positive distance/duration.
- Daily check-in currently treats any run log on a date as run complete.

Impact:

- A future missed-run record could incorrectly count as completed.

Mitigation:

- In Phase 5, only save completed run logs from Train unless explicitly implementing missed-run records.
- Later, update `deriveDailyCompletionStatus()` to check `run.completed === true` if missed-run records become supported.

### Risk: run execution becomes only another form, not a Train experience

Current evidence:

- Existing `Running()` is just a manual form in Log.

Impact:

- Phase 5 could technically move the form to Train without satisfying the desired UX of warm-up, ordered lift/run, cooldown, cues, and summary.

Mitigation:

- Train should present runs as execution blocks with clear order, not just a generic logger.
- Include planned distance, recommended distance/action, RPE/pain/walk-break fields, and post-run summary.

### Risk: timers remain workout-only

Current evidence:

- Current timer state exists only for rest between lifting sets.

Impact:

- Warm-up/cooldown/run timing requirements may remain incomplete.

Mitigation:

- Phase 5 minimum should preserve rest timer and add visible warm-up/cooldown blocks.
- Dedicated warm-up/cooldown timers can be later if scope is tight, but acceptance should clearly state what is implemented.

### Risk: cue logic remains duplicated and simplistic

Current evidence:

- UI `coachingCue()` uses exercise-name keyword matching.
- `CoachDecision.cue` exists from coach-engine adapter but is not the main displayed cue.

Impact:

- Cues may be generic or inconsistent with engine decision context.

Mitigation:

- For Phase 5, do not invent a new cue engine.
- Prefer displaying `CoachDecision.message/reason/cue` after set completion and simple pre-set cues before completion.

### Risk: removing Log controls breaks old manual workflows before replacement is complete

Current evidence:

- Log currently exposes both workout and run forms.

Impact:

- If Train run logging is incomplete, removing Log run logging would block run entry.

Mitigation:

- Only remove/hide Log workout/run logging after Train can log both workout and run.
- Keep logger helper modules for compatibility and tests.

## Acceptance Criteria for Phase 5

Phase 5 should be accepted only if all are true:

1. **Train is the only visible place to execute/log workouts and runs.**
   - No visible `Workout logging` option in Log.
   - No visible `Run logging` option in Log.

2. **Train shows ordered training for the day.**
   - Warm-up block.
   - Lift block when applicable.
   - Run block when applicable.
   - Cooldown block.
   - Post-session or post-block summary after logging.

3. **If today includes lift + run, Train shows both in order.**
   - The user should not need to visit Log to finish the training day.

4. **Workout execution still works.**
   - Start Training creates/continues an active `WorkoutSession`.
   - Set logging persists `SetLog[]`.
   - Rest timer still works.
   - Workout completion produces a summary/recommendations.

5. **Run logging works from Train.**
   - Train can create a `RunLog` through existing `run-logger.ts` helpers.
   - Saved run updates `state.runLogs`.
   - Duplicate same-date run entries are avoided/replaced by existing save behavior.

6. **Daily check-in completion is fed by canonical logs.**
   - Workout completion comes from `workoutSessions`/`setLogs`.
   - Run completion comes from `runLogs`.

7. **No canonical engine logic changes.**
   - No changes to Readiness, Nutrition, Running, Workout, Progression, or Goal Tracking engine logic unless explicitly scoped by a future prompt.

8. **Validation passes.**
   - `pnpm test`
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm build`

## Files to Modify in Phase 5: Short List

Recommended likely changes:

- `src/app/page.tsx`
  - Main Train and Log UI/consumer changes.

- `src/lib/run-logger.ts`
  - Only if a tiny adapter is needed for Train run defaults/summary; otherwise consume as-is.

- `src/lib/run-logger.test.ts`
  - If run logger behavior changes.

- `src/lib/daily-checkin.ts`
  - Only if fixing run completion semantics.

- `src/lib/daily-checkin.test.ts`
  - If completion semantics change.

- `src/lib/navigation.ts`
  - If updating screen group metadata for Log/Train.

Potentially create only if explicitly allowed:

- `src/lib/train-execution.ts`
- `src/lib/train-execution.test.ts`

## Files NOT to Modify in Phase 5: Short List

Do not modify engine logic:

- `src/lib/readiness-engine.ts`
- `src/lib/nutrition-engine.ts`
- `src/lib/running-engine.ts`
- `src/lib/workout-engine.ts`
- `src/lib/progression-engine.ts`
- `src/lib/goal-tracking-engine.ts`

Do not modify unrelated systems:

- Food AI API routes.
- Nutrition Engine/UI behavior except preserving it in Log.
- Backup/restore behavior.
- Supabase persistence unless new persisted fields are introduced, which should be avoided.
- Progress analytics except if tests need updated labels after Log cleanup.

## Canonical Train Ownership Recommendation

Recommended canonical model:

```text
Train screen owns user-facing execution.
Workout Engine owns lift/set/workout decisions.
Running Engine owns run progression/risk decisions.
run-logger.ts owns RunLog adapter/persistence until Training Engine exists.
coach-engine.ts owns current compatibility adapters for set-by-set and post-workout summaries until Training Engine exists.
Daily check-in derives completion from logs; it does not own completion.
Log owns only non-training logging.
```

Practical Phase 5 recommendation:

1. Keep current `ActiveWorkout()` as the canonical lift execution path.
2. Add Train-side run execution/logging using `buildRunLoggerRecord()` and `saveRunLoggerEntry()`.
3. Remove the user-facing Log workout/run sections after Train has both paths.
4. Keep `workout-logger.ts` and `run-logger.ts` as compatibility/helper modules for now.
5. Do not change canonical engine logic.
6. Consider extracting Train execution helpers only if explicitly permitted to create new files.

## Duplicate Logging Locations

Exact duplicate user-facing logging locations found:

- Workout logging:
  - `src/app/page.tsx` / `ActiveWorkout()` in Train.
  - `src/app/page.tsx` / `WorkoutLogger()` in Log.
  - `src/lib/workout-logger.ts` backing the Log manual workout logger.

- Run logging:
  - `src/app/page.tsx` / `Running()` in Log.
  - `src/lib/run-logger.ts` backing the Log manual run logger.

Important nuance:

- Run logging is not duplicated between Train and Log yet because Train has no run logging. The duplicate responsibility is architectural: Train is supposed to own it, but Log currently owns it.

## Verification Notes

Audit-only validation target:

- `TRAIN_EXECUTION_AUDIT.md` created.
- No source code intentionally modified by this audit.
- No UI modified by this audit.
- Final verification should compare git status before/after and distinguish pre-existing uncommitted Phase 2/3/4 work from this new documentation file.

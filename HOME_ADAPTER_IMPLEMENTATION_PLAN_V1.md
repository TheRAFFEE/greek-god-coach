# HOME_ADAPTER_IMPLEMENTATION_PLAN_V1

**Phase:** 27E — Home Adapter Implementation Plan V1  
**Mode:** Design / documentation only  
**Status:** Implementation blueprint only; no source code, tests, UI, runtime behavior, adapters, wiring, source-of-truth ownership, or planner promotion changed  
**Planner status:** Developer-only, advisory-only, read-only, not promoted

## Authoritative inputs

This implementation plan uses the following documents as policy and contract inputs:

- `TRAINING_POLICY_DECISIONS_V1.md`
- `MECHANICAL_POLICY_RECONCILIATION_PLAN_V1.md`
- `PLANNER_PROMOTION_CONTRACT_V1.md`
- `PLANNER_INPUT_CONTRACT_V1.md`
- `HOME_ADAPTER_CONTRACT_V1.md`

## Scope boundary

This document is a future implementation blueprint. It does **not** authorize implementation in this phase.

Do not change in Phase 27E:

- source code
- tests
- UI
- Home runtime behavior
- Train runtime behavior
- Log runtime behavior
- Recommendation behavior
- Readiness behavior
- Progression behavior
- Persistence behavior
- planner runtime behavior
- source-of-truth ownership
- adapter wiring
- planner promotion

---

# 1. EXECUTIVE SUMMARY

## Purpose of the Home Adapter

The future Home Adapter is a pure, validation-first bridge that converts a production-validated `DailyTrainingSession` into a Home-safe training display model.

Its purpose is to let Home consume planner-composed daily training information without letting the planner fabricate or take ownership of domain signals that are still owned elsewhere.

## What it converts

The Home Adapter converts:

```text
DailyTrainingSession
+ real readiness result
+ real progression result
+ real recommendation outputs
+ real persistence completion evidence
+ audit hash
+ provenance
  ->
HomeTrainingModel
```

The adapter does not convert raw `AppState` directly into planner output. That remains the responsibility of a production-safe planner input adapter defined separately by `PLANNER_INPUT_CONTRACT_V1.md`.

## Why it exists

Home currently receives a composite `HomeCommandCenterModel` produced from legacy runtime orchestration. The planner path exists only as developer-only shadow/advisory output. A future Home pilot needs a safe middle layer so Home can inspect planner-composed training prescriptions without:

- replacing legacy Home by accident
- double-applying readiness
- fabricating readiness/progression/recommendation values
- confusing prescriptions with completed logs
- changing Train, Log, or persistence behavior
- promoting planner output prematurely

The Home Adapter exists to make that boundary explicit and testable.

## What it does NOT own

The Home Adapter does **not** own:

- readiness calculations
- progression calculations
- goal tracking calculations
- daily coach recommendations
- running recommendations
- running engine outputs
- historical workout logs
- historical run logs
- persistence writes
- source workout generation
- Train execution models
- Log submission models
- UI presentation components
- source-of-truth promotion

The adapter is a pure mapper and validator only.

---

# 2. CURRENT STATE ARCHITECTURE

## Current runtime path

Current Home runtime path:

```text
source workouts / AppState / latest check-in / macro target / run logs
  |
  v
src/app/page.tsx orchestration
  |
  |-- getWorkoutForWeekDay(...)
  |-- adjustWorkoutForReadiness(...)
  |-- getTodayRunForDate(...)
  |-- generateRunningRecommendation(...)
  |-- generateDailyPrescription(...)
  |
  v
buildHomeCommandCenter(...)
  |
  |-- readinessFromState(...) or supplied readinessResult
  |-- evaluateProgression(...)
  |-- evaluateGoalTracking(...)
  |-- evaluateTraining(...)
  |-- evaluatePerformance(...)
  |
  v
HomeCommandCenterModel
  |
  v
buildHomeDailyDashboard(...)
  |
  v
Dashboard / Home UI
```

## Exact current functions and files

### Source workouts

- `src/lib/seed-data.ts`
  - `workouts`
  - `getWorkoutForWeekDay(...)`
  - `createInitialState(...)`

### Page-level Home orchestration

- `src/app/page.tsx`
  - derives `today`
  - derives `todayPlanDayIndex`
  - derives `latestCheckIn`
  - computes compatibility readiness through `calculateReadiness(...)`
  - resolves `todayWorkout` with `getWorkoutForWeekDay(...)`
  - applies `adjustWorkoutForReadiness(...)`
  - derives `todayRunDisplay` with `getTodayRunForDate(...)`
  - derives `runningRecommendation` with `generateRunningRecommendation(...)`
  - derives `dailyPrescription` with `generateDailyPrescription(...)`
  - calls `buildHomeCommandCenter(...)`
  - passes `homeCommandCenter` into `Dashboard(...)`

### Current Home command center model

- `src/lib/home-command-center.ts`
  - `buildHomeCommandCenter(state, options): HomeCommandCenterModel`
  - `getTodayRunForDate(...)`
  - `getScheduledRunForTraining(...)`
  - `readinessFromState(...)`
  - `weeklyProgressionInput(...)`
  - `nutritionSummary(...)`
  - `completedWorkoutToday(...)`
  - `completedRunToday(...)`
  - `compactDataQuality(...)`
  - `firstRecoveryWarning(...)`
  - `conciseRecommendation(...)`

### Current legacy engines used by Home

- `src/lib/readiness-engine.ts`
  - `evaluateReadiness(...)`
  - `readinessInputFromDailyCheckIn(...)`
- `src/lib/progression-engine.ts`
  - `evaluateProgression(...)`
- `src/lib/goal-tracking-engine.ts`
  - `evaluateGoalTracking(...)`
- `src/lib/training-engine.ts`
  - `evaluateTraining(...)`
- `src/lib/performance-engine.ts`
  - `evaluatePerformance(...)`
- `src/lib/coach-engine.ts`
  - `calculateReadiness(...)`
  - `adjustWorkoutForReadiness(...)`
  - `generateDailyPrescription(...)`
  - `generateRunningRecommendation(...)`

### Current Home rendering pipeline

- `src/lib/home-daily-dashboard.ts`
  - `buildHomeDailyDashboard(...)`
  - consumes `HomeCommandCenterModel`
- `src/lib/mission-control-ui.ts`
  - `buildMissionControlUiModel(...)`
- `src/app/page.tsx`
  - `Dashboard(...)`
  - reads `dailyDashboard.sections`
  - renders today's workout, today's run, nutrition focus, recovery status, primary mission, and CTA

### Current developer-only planner path

- `src/lib/training-planner.ts`
  - `buildDailyTrainingSession(...)`
  - `DailyTrainingSession`
- `src/lib/training-planner-adapter.ts`
  - `buildDailyTrainingSessionInputFromAppState(...)`
  - `buildPlannerSessionFromAppState(...)`
  - current shadow-only fallback functions:
    - `fallbackReadiness()`
    - `fallbackProgression()`
    - `fallbackGoalTracking()`
- `src/lib/planner-shadow-observability.ts`
  - developer-only planner-vs-legacy comparison
- `src/lib/planner-train-preview.ts`
  - developer-only Train preview model
- `src/lib/planner-train-screen-v1.ts`
  - developer-only Train screen preview model
- `src/app/page.tsx`
  - `plannerDebugEnabled`
  - developer panels only

## Current architecture risks relevant to Home Adapter

1. Home currently has no `HomeTrainingModel` adapter boundary.
2. `buildHomeCommandCenter(...)` can recompute readiness/progression/goal tracking internally when not supplied.
3. `page.tsx` currently applies `adjustWorkoutForReadiness(...)` before Home command center creation.
4. Planner adapter fallbacks are shadow-safe only and forbidden for a production Home pilot.
5. Completion status currently depends on persisted `WorkoutSession[]` and `RunLog[]`; planner status cannot replace those receipts.
6. Developer planner output is not persisted, audit-hashed, or provenance-bound.

---

# 3. TARGET STATE ARCHITECTURE

## Future target path

Future developer-only Home pilot path:

```text
source workouts / source plan provider
  |
  v
Production-safe planner input adapter
  |  requires real date, currentWeek, source workouts,
  |  readiness, progression, goal tracking,
  |  recommendations, logs, provenance inputs
  v
DailyTrainingSession
  |  planner owns session composition only
  v
Home Adapter
  |  validateDailyTrainingSession(...)
  |  createHomeBlockers(...)
  |  mapPlannerToHome(...)
  |  createHomeWarnings(...)
  v
HomeTrainingModel
  |  training slice only; no fabricated domain signals
  v
Developer-only Home pilot renderer or bridge
  |  behind feature flag; blocked if diagnostics contain BLOCKER
  v
Home
```

## Target architecture diagram

```text
                        ┌─────────────────────────────┐
                        │ AppState / source providers │
                        │ - source workouts           │
                        │ - check-ins                 │
                        │ - workout sessions          │
                        │ - run logs                  │
                        │ - macro targets             │
                        └──────────────┬──────────────┘
                                       │
                                       v
┌──────────────────────┐   ┌──────────────────────────────┐
│ Readiness Engine V2  │   │ Progression Engine V1         │
│ owns readiness       │   │ owns weekly/nutrition decision│
└──────────┬───────────┘   └──────────────┬───────────────┘
           │                              │
           v                              v
┌──────────────────────┐   ┌──────────────────────────────┐
│ Recommendation paths │   │ Persistence/log history       │
│ own daily/run copy   │   │ owns completion receipts      │
└──────────┬───────────┘   └──────────────┬───────────────┘
           │                              │
           └──────────────┬───────────────┘
                          v
        ┌──────────────────────────────────────┐
        │ Production-safe planner input adapter│
        │ - rejects forbidden fallbacks        │
        │ - validates ownership boundaries     │
        └──────────────────┬───────────────────┘
                           v
        ┌──────────────────────────────────────┐
        │ DailyTrainingSession                 │
        │ - sessionType                        │
        │ - prescriptions                      │
        │ - support                            │
        │ - deload metadata                    │
        │ - logging targets                    │
        │ - audit trail                        │
        └──────────────────┬───────────────────┘
                           v
        ┌──────────────────────────────────────┐
        │ Home Adapter                         │
        │ - validate                           │
        │ - block unsafe pilot output          │
        │ - map to HomeTrainingModel           │
        │ - preserve rollback                  │
        └──────────────────┬───────────────────┘
                           v
        ┌──────────────────────────────────────┐
        │ HomeTrainingModel                    │
        │ - training display slice             │
        │ - diagnostics                        │
        │ - audit hash/provenance references   │
        └──────────────────┬───────────────────┘
                           v
        ┌──────────────────────────────────────┐
        │ Home developer-only pilot            │
        │ Existing Home remains default        │
        └──────────────────────────────────────┘
```

## Target state boundaries

- `DailyTrainingSession` becomes the planner-composed daily prescription object only when future phases approve runtime pilot work.
- `HomeTrainingModel` is a Home-safe training slice, not a full replacement for `HomeCommandCenterModel`.
- Existing Home command center remains default until explicit promotion.
- Any adapter `BLOCKER` keeps legacy Home active.

---

# 4. ADAPTER OWNERSHIP CONTRACT

## Planner owns

The planner owns daily session composition only:

- session composition
- source plan resolution for the date
- `sessionType`
- primary objective
- ordered blocks
- workout/run/mobility/recovery/support prescriptions
- support work, including `Support: Core`
- logging targets and completion targets as prescriptions/references
- duration metadata
- load metadata
- deload metadata
- planner warnings
- planner audit trail

Planner policy locks:

- `RecoveryDay` remains distinct.
- Mobility may appear inside recovery but must not collapse recovery into `MobilityDay`.
- Core/trunk work appears as support only.
- Deload remains metadata only.
- No standalone `DeloadDay`.

## Readiness owns

Readiness owns:

- readiness calculations
- readiness score
- readiness status
- readiness confidence
- readiness reasons
- readiness recommendation
- training/recovery guidance
- readiness data-quality warnings

Home Adapter responsibility:

- require real `ReadinessEngineResult`
- cross-check `DailyTrainingSession.readinessStatus`
- block pilot if missing or mismatched
- never call planner shadow fallback readiness

## Progression owns

Progression owns:

- progression calculations
- weekly decision
- nutrition decision
- progression confidence
- progression reasons
- progression warnings
- progression data-quality signal
- progression audit entries

Home Adapter responsibility:

- require real `ProgressionEngineResult`
- pass through only validated progression fields
- block pilot if missing
- never default to `Repeat`

## Recommendation owns

Recommendation pipelines own:

- daily coach recommendation copy
- exact workout recommendation copy
- run action/distance recommendation
- recommendation safety language
- recommendation risk explanations

Home Adapter responsibility:

- consume recommendation outputs as inputs
- include recommendation labels only when supplied by the recommendation owner
- block if a required recommendation is missing
- never invent coach copy or run distances

## Persistence owns

Persistence owns:

- saved history
- `WorkoutSession[]`
- `RunLog[]`
- `DailyCheckIn[]`
- `NutritionLog[]`
- `BodyMetric[]`
- user profile/macro target persistence
- localStorage/Supabase sync
- backup/restore
- future audit hash storage
- future provenance storage

Home Adapter responsibility:

- compute completion display only from real logs
- never mutate state
- never create synthetic logs
- require audit hash and provenance before pilot

## Home owns

Home owns presentation only:

- card layout
- labels
- visual hierarchy
- CTA rendering
- collapsed/expanded sections
- developer-only pilot display selection

Home does not own training prescription semantics and should not recalculate planner session composition.

---

# 5. REQUIRED INPUTS

The future Home Adapter should receive one explicit input object, proposed as `BuildHomeTrainingModelInput`.

## Required input fields

| Field | Source owner | Validation rule | Fallback behavior | Promotion risk if missing |
|---|---|---|---|---|
| `mode` | Runtime/pilot flag owner | Must be `developer-only` or `pilot`; Phase 27F should use developer-only only | No fallback | Blocker |
| `requestDate` | Runtime orchestration | ISO `YYYY-MM-DD`; must equal `session.date` | No fallback | Blocker |
| `session` | Planner | Must be a complete `DailyTrainingSession` | No fallback | Blocker |
| `session.id` | Planner | Non-empty stable string | No fallback | Blocker |
| `session.date` | Planner/runtime | ISO date; equals request date | No fallback | Blocker |
| `session.currentWeek` | AppState/training calendar | Positive integer; matches canonical week policy | No fallback | Blocker |
| `session.dayIndex` | Planner from date | Integer 0-6 | No fallback | Blocker |
| `session.sourcePlan.source` | Source plan/planner | Known source enum or explicit approved source | No fallback | Blocker |
| `session.sourcePlan.resolvedSessionType` | Planner resolver | Must match `session.sessionType` unless future override audit exists | No fallback | Blocker |
| `session.sessionType` | Planner | Valid `PrimarySessionType`; no `DeloadDay` | No fallback | Blocker |
| `session.metadata.deload` | Planner/source workout | Boolean; metadata only | Default `false` only if source explicitly lacks deload | Warning/Blocker if source unknown |
| `session.summary.title` | Planner | Non-empty for pilot | No silent fallback | Blocker |
| `session.summary.primaryAction` | Planner | Non-empty for pilot | No silent fallback | Blocker |
| `session.workout` | Planner | Required when session type includes lift/workout primary | Null only if no workout scheduled | Blocker if required |
| `session.run` | Planner | Required when session type includes run/long run primary | Null only if no run scheduled | Blocker if required |
| `session.recovery` | Planner | Required for `RecoveryDay` or recovery override | Null only for non-recovery sessions | Blocker if RecoveryDay |
| `session.support` | Planner | Array; Core support preserved when source contains core work | Empty allowed only when source has no support | Warning/Blocker by source evidence |
| `session.estimatedDurationMinutes` | Planner | Finite non-negative number; expected >0 for active sessions | No silent fallback in pilot | Warning/Blocker by type |
| `session.auditTrail` | Planner | Non-empty for pilot | No fallback | Blocker |
| `readinessResult` | Readiness engine | Complete `ReadinessEngineResult`; status matches `session.readinessStatus` | No fallback | Blocker |
| `progressionResult` | Progression engine | Complete `ProgressionEngineResult` | No fallback | Blocker |
| `goalTrackingResult` | Goal tracking engine | Complete result if Home/Mission Control uses goal fields | No fabricated fallback | Blocker for full Home pilot |
| `dailyRecommendation` | Recommendation pipeline | Non-empty copy if Home should show recommendation-derived priority/copy | No fabricated fallback | Blocker when required |
| `runningRecommendation` | Recommendation pipeline | Required when session has run and policy requires recommendation | `null` allowed only for no-run or approved source-plan-only policy | Blocker/Warning |
| `workoutSessions` | Persistence | Real persisted `WorkoutSession[]` | No synthetic logs | Blocker |
| `runLogs` | Persistence | Real persisted `RunLog[]` | No synthetic logs | Blocker |
| `auditHash` | Audit/persistence adapter | Non-empty stable hash covering input/output/provenance | No fallback | Blocker |
| `provenance` | Audit/persistence adapter | Non-empty source/engine/session provenance | No fallback | Blocker |
| `adapterVersion` | Adapter implementation | Exact version string, e.g. `home-adapter-v1` | Hardcoded version allowed | Blocker |

## Required input shape draft

```ts
interface BuildHomeTrainingModelInput {
  mode: "developer-only" | "pilot";
  requestDate: string;
  session: DailyTrainingSession;
  readinessResult: ReadinessEngineResult;
  progressionResult: ProgressionEngineResult;
  goalTrackingResult: GoalTrackingEngineResult;
  dailyRecommendation: {
    coachRecommendation: string;
    exactWorkoutRecommendation?: string | null;
    source: "Recommendation Pipeline";
  };
  runningRecommendation: RunningRecommendation | null;
  workoutSessions: WorkoutSession[];
  runLogs: RunLog[];
  auditHash: string;
  provenance: HomeAdapterProvenance;
  adapterVersion: "home-adapter-v1";
}
```

---

# 6. OPTIONAL INPUTS

| Optional field | Owner | Behavior if absent |
|---|---|---|
| `runningEngineResult` | Running engine | If no run is scheduled, emit `INFO: NO_RUN_SCHEDULED`. If run is scheduled and running engine context is required, emit `BLOCKER`; otherwise emit `WARNING: RUNNING_ENGINE_MISSING_SOURCE_PLAN_ONLY`. |
| `performanceEngineResult` | Performance engine | Do not fabricate performance. Home training model can omit performance fields; Mission Control remains legacy owner. |
| `physiqueEngineResult` | Physique engine | Do not fabricate physique. Not needed for training slice. |
| `raceCalendarEngineResult` | Race calendar engine | Do not fabricate race status. Not needed for core training slice unless Home pilot explicitly includes race context. |
| `userPreferences` | Runtime/user preferences | If absent, adapter must not infer broad user preferences. It may display planner-computed warmup/cooldown as already present on session. |
| `legacyHomeModel` | Existing Home command center | Optional for developer-only parity comparison. If absent, skip parity diagnostics. |
| `legacyTrainingEngineResult` | Training engine | Optional for shadow comparison. If absent, skip training-engine parity diagnostics. |
| `sourceWorkout` | Source plan provider | Optional only if `session.sourcePlan.sourceWorkoutId` and provenance are sufficient. If source support validation requires raw source workout, absence may downgrade support validation to warning. |
| `renderContext` | Home/UI orchestration | Optional for future pilot display labels only. Absence must not change training semantics. |

Optional means the adapter may safely emit `null`, `[]`, `INFO`, or `WARNING` under explicit policy. Optional never means fabricated.

---

# 7. FORBIDDEN INPUTS

The Home Adapter must never generate these values internally.

## Forbidden generated domain inputs

- readiness score
- readiness status
- readiness confidence
- readiness recommendation
- readiness training/recovery guidance
- progression weekly decision
- progression nutrition decision
- progression confidence
- progression data quality
- recommendation copy
- exact workout recommendation
- run recommendation action
- run recommendation distance
- goal tracking status
- goal tracking priority goal
- historical workout logs
- historical run logs
- running engine outputs
- current week from implicit clock
- canonical request date from implicit clock in pilot mode
- source workouts
- persisted source IDs
- audit hash
- provenance

## Forbidden planner/Home transformations

- `RecoveryDay -> MobilityDay`
- `deload=true -> DeloadDay`
- `Support: Core -> LiftDay`
- `Support: Core -> HybridDay`
- support work changing run logging targets
- support work changing lift logging targets
- planner status changing completion status without logs
- planner warnings replacing readiness/progression warnings
- Home display labels becoming source-of-truth values

---

# 8. ADAPTER FUNCTION INVENTORY

The functions below are expected in a future implementation phase. Do **not** implement them in Phase 27E.

## 8.1 `buildHomeTrainingModel(...)`

### Inputs

- `BuildHomeTrainingModelInput`

### Outputs

- `HomeAdapterResult`

Proposed shape:

```ts
interface HomeAdapterResult {
  ok: boolean;
  model: HomeTrainingModel | null;
  diagnostics: HomeAdapterDiagnostic[];
}
```

### Responsibilities

- orchestrate validation
- collect blockers/warnings/info
- return blocked result if any `BLOCKER` exists
- call mapping only when safe
- remain pure and read-only
- avoid mutation of `AppState`
- avoid calls to readiness/progression/recommendation engines

## 8.2 `validateDailyTrainingSession(...)`

### Inputs

- `DailyTrainingSession`
- `requestDate`
- optional validation policy object

### Outputs

- `HomeAdapterDiagnostic[]`

### Responsibilities

- validate session identity
- validate date/week/day index
- validate source plan metadata
- validate `sessionType`
- reject `DeloadDay`
- enforce `RecoveryDay` preservation
- validate deload metadata semantics
- validate required prescriptions by session type
- validate audit trail presence

## 8.3 `validateDomainInputs(...)`

### Inputs

- `readinessResult`
- `progressionResult`
- `goalTrackingResult`
- `dailyRecommendation`
- `runningRecommendation`
- `runningEngineResult?`
- `session`

### Outputs

- `HomeAdapterDiagnostic[]`

### Responsibilities

- block missing readiness
- block missing progression
- block missing required recommendation
- block missing goal tracking for full Home pilot
- warn/block missing running engine context by run policy
- cross-check readiness status against session

## 8.4 `validatePersistenceInputs(...)`

### Inputs

- `workoutSessions`
- `runLogs`
- `session`

### Outputs

- `HomeAdapterDiagnostic[]`

### Responsibilities

- verify real arrays are supplied
- compute whether workout completion can be evaluated
- compute whether run completion can be evaluated
- block synthetic or absent logs
- prevent planner status from becoming completion receipt

## 8.5 `validateAuditAndProvenance(...)`

### Inputs

- `auditHash`
- `provenance`
- `adapterVersion`
- `session`

### Outputs

- `HomeAdapterDiagnostic[]`

### Responsibilities

- require non-empty audit hash
- require non-empty provenance
- require adapter version
- ensure planner audit trail is referenced
- ensure source plan and domain engine provenance are represented

## 8.6 `mapPlannerToHome(...)`

### Inputs

- validated `BuildHomeTrainingModelInput`

### Outputs

- `HomeTrainingModel`

### Responsibilities

- map session title/action/type/deload
- map workout/run/recovery/mobility items
- map Core support as support only
- map duration metadata
- map real readiness/progression/recommendation summaries
- compute completion from persisted logs
- include audit/provenance references
- include adapter diagnostics

## 8.7 `createHomeWarnings(...)`

### Inputs

- `session`
- domain inputs
- validation diagnostics

### Outputs

- `string[]` or `HomeAdapterDiagnostic[]`

### Responsibilities

- convert safe planner warnings to Home warning copy
- convert load flags to display-safe warnings
- include low-confidence warnings from real domain inputs
- avoid exposing raw internal/debug-only messages in user-facing Home copy

## 8.8 `createHomeBlockers(...)`

### Inputs

- validation diagnostics

### Outputs

- `HomeAdapterDiagnostic[]`

### Responsibilities

- filter blockers
- produce stable blocker codes for tests
- provide rollback reason text
- ensure any blocker prevents pilot rendering

## 8.9 `mapWorkoutItem(...)`

### Inputs

- `DailyTrainingSession`
- `WorkoutSession[]`

### Outputs

- `HomeTrainingModelItem`

### Responsibilities

- map workout name/duration/source IDs
- compute required flag
- compute completion from `WorkoutSession[]`
- return `Not Scheduled` only when no workout exists
- block missing required workout elsewhere in validation

## 8.10 `mapRunItem(...)`

### Inputs

- `DailyTrainingSession`
- `RunLog[]`
- `RunningRecommendation | null`

### Outputs

- `HomeTrainingModelItem`

### Responsibilities

- map run name/duration/source IDs
- compute required flag
- compute completion from `RunLog[]`
- preserve run recommendation owner boundary
- return `Not Scheduled` only when no run exists

## 8.11 `mapSupportItems(...)`

### Inputs

- `DailyTrainingSession.support`

### Outputs

- `HomeTrainingModel.support`

### Responsibilities

- preserve `Support: Core`
- preserve item text
- preserve source workout ID
- never change primary session type
- never change logging targets

## 8.12 `toHomeCommandCenterTrainingBridge(...)`

### Inputs

- `HomeTrainingModel`
- existing `HomeCommandCenterModel`

### Outputs

- either a training slice compatible with `HomeCommandCenterModel.training` or a developer-only comparison object

### Responsibilities

- only for future pilot wiring
- preserve existing Home default
- avoid changing non-training Home fields
- keep Mission Control/readiness/progression/recommendation owners intact

---

# 9. FILE INVENTORY

## NEW FILES

Expected future implementation files:

- `src/lib/home-adapter.ts`
  - pure adapter implementation
  - `buildHomeTrainingModel(...)`
  - validation/mapping helpers

- `src/lib/home-adapter.types.ts` or colocated types in `src/lib/home-adapter.ts`
  - only create separate file if type volume justifies it

- `src/lib/home-adapter.test.ts`
  - unit tests for adapter validation and mapping

- `src/lib/home-adapter-parity.test.ts`
  - parity tests against current Home training slice, if kept separate

- `src/lib/home-adapter-pilot.test.ts`
  - developer-only pilot gate tests, if pilot wiring is added in the same future phase

## MODIFIED FILES

Expected future implementation files that may need changes, depending on approved phase scope:

- `src/app/page.tsx`
  - only if a developer-only Home pilot flag or non-rendered debug bridge is explicitly approved
  - must preserve legacy Home default and rollback

- `src/lib/home-command-center.ts`
  - only if adding a bridge or adapter-compatible training slice is explicitly approved
  - must not change default Home behavior

- `src/lib/home-daily-dashboard.ts`
  - only if future pilot renderer consumes `HomeTrainingModel` directly
  - should not change current Home rendering in adapter-only implementation

- `src/lib/training-planner-adapter.ts`
  - only if future phase separates production-safe adapter input path from shadow fallback path
  - must not remove shadow behavior unless separately approved

- `src/lib/planner-shadow-observability.ts`
  - only if future parity diagnostics compare `HomeTrainingModel` to legacy Home output

## TEST FILES

Expected future test coverage:

- `src/lib/home-adapter.test.ts`
- `src/lib/home-adapter-parity.test.ts`
- `src/lib/home-adapter-pilot.test.ts`
- possible additions to `src/lib/home-command-center.test.ts` only if the future implementation touches command-center bridging
- possible additions to `src/app/page.test.tsx` only if future UI/pilot rendering tests exist; current project may not have that test structure

## Files that should NOT change for pure adapter implementation

- `src/lib/readiness-engine.ts`
- `src/lib/progression-engine.ts`
- `src/lib/goal-tracking-engine.ts`
- `src/lib/coach-engine.ts` recommendation logic
- `src/lib/run-logger.ts`
- `src/lib/workout-logger.ts`
- persistence modules
- seed workouts/source plan data
- Train UI/components
- Log UI/components

---

# 10. VALIDATION STRATEGY

## Diagnostic severity levels

### BLOCKER

A `BLOCKER` prevents the Home pilot model from rendering or being treated as runtime output. Existing Home remains active.

BLOCKER conditions:

- missing readiness
- readiness status mismatch
- missing progression
- missing required recommendation
- missing required running recommendation for a run day when policy requires it
- missing goal tracking for full Home/Mission Control pilot
- missing workout logs
- missing run logs
- missing audit hash
- missing provenance
- missing session ID
- invalid date
- invalid current week
- invalid day index
- missing source plan identity
- missing session type
- `RecoveryDay` collapsed into `MobilityDay`
- standalone `DeloadDay`
- required workout missing
- required run missing
- required recovery prescription missing for `RecoveryDay`
- support changed primary session type
- support changed logging target

### WARNING

A `WARNING` allows developer diagnostics but marks the output as not promotion-ready.

WARNING conditions:

- duration range unavailable
- zero duration for a session where zero may be suspicious but not impossible
- source-plan-only run with no running engine context under approved policy
- low confidence from real readiness/progression/goal inputs
- support validation cannot inspect raw source workout
- deload metadata absent or unknown when source workout identity is incomplete
- optional mobility/support details absent
- planner warnings include overload flags

### INFO

`INFO` communicates expected absence or non-blocking trace.

INFO conditions:

- deload metadata absent/false on non-deload source workout
- no run scheduled
- no lift scheduled
- no support work in source workout
- warmup omitted by preference
- cooldown omitted by preference
- no planner modifications applied
- legacy parity comparison skipped because legacy model was not provided

## Validation sequence

1. Validate adapter mode and request context.
2. Validate `DailyTrainingSession` structural fields.
3. Validate policy locks:
   - RecoveryDay preservation
   - Deload metadata only
   - Core support remains support
4. Validate domain inputs:
   - readiness
   - progression
   - goal tracking
   - recommendation
   - running context
5. Validate persistence inputs:
   - workout sessions
   - run logs
6. Validate audit hash and provenance.
7. If any `BLOCKER`, return blocked result with `model: null`.
8. If no blockers, map `DailyTrainingSession -> HomeTrainingModel`.
9. Attach warnings/info diagnostics.
10. Keep output read-only.

---

# 11. HOME PILOT STRATEGY

## Developer-only pilot

The first Home Adapter runtime use must be developer-only.

Pilot characteristics:

- hidden behind explicit feature flag
- separate from current `plannerDebugEnabled` unless a future phase intentionally reuses it
- read-only
- advisory-only
- no writes
- no source-of-truth replacement
- no Train/Log/Recommendation behavior change
- existing Home remains default

## Feature flag requirements

Future flag examples:

- `plannerHomePilotEnabled`
- `homeAdapterPilotEnabled`

Required behavior:

- default `false`
- available only in developer/debug context
- if false, current Home path renders exactly as before
- if true and adapter has `BLOCKER`, current Home path still renders
- if true and adapter has no blocker, pilot may render as clearly labeled developer-only output

## Rollback path

Rollback must be immediate:

- disable feature flag
- no data migration needed
- no persisted writes to undo
- no log schema changes
- no source plan mutation
- legacy Home remains intact

## Legacy Home preserved

The future implementation must preserve:

- `buildHomeCommandCenter(...)`
- `HomeCommandCenterModel`
- `buildHomeDailyDashboard(...)`
- existing `Dashboard(...)` rendering
- current Train path
- current Log path
- current recommendation path

## Shadow comparison preserved

Existing planner shadow comparison should remain available:

- `buildPlannerShadowObservabilityPanel(...)`
- `toLegacyComparableFromTrainingEngine(...)`
- planner train preview panels
- planner train screen V1 developer panel

Home Adapter pilot should add diagnostics without removing current shadow tooling.

---

# 12. TEST STRATEGY

No tests are implemented in Phase 27E. The following tests are expected in a future implementation phase.

## Unit tests

File: `src/lib/home-adapter.test.ts`

Expected tests:

1. `buildHomeTrainingModel returns blocked result when readiness is missing`
2. `buildHomeTrainingModel returns blocked result when progression is missing`
3. `buildHomeTrainingModel returns blocked result when recommendation is missing`
4. `buildHomeTrainingModel returns blocked result when audit hash is missing`
5. `buildHomeTrainingModel returns blocked result when provenance is missing`
6. `RecoveryDay maps as RecoveryDay and not MobilityDay`
7. `deload true maps as deload metadata and does not create DeloadDay`
8. `Core support maps to support array without changing session type`
9. `Core support does not alter workout status or run status`
10. `workout completion is computed from WorkoutSession logs only`
11. `run completion is computed from RunLog logs only`
12. `no run scheduled maps to Not Scheduled with INFO diagnostic`
13. `required run missing produces BLOCKER`
14. `required workout missing produces BLOCKER`
15. `required recovery missing for RecoveryDay produces BLOCKER`

## Integration tests

Expected tests:

1. Build a real planner session from seed workouts and map it to HomeTrainingModel with fully supplied real domain inputs.
2. Verify a lift day preserves workout display fields.
3. Verify a run day preserves run display fields.
4. Verify a long run day preserves run display fields and does not require lift.
5. Verify a recovery day preserves `RecoveryDay` and does not collapse into mobility.
6. Verify a deload lift/run/long-run day keeps original session type with `deload=true`.
7. Verify source IDs flow into Home model items.
8. Verify audit/provenance fields appear in output.

## Parity tests

Expected tests:

1. Compare `HomeTrainingModel.workout.name` to current `HomeCommandCenterModel.training.workout.name` for representative source days.
2. Compare `HomeTrainingModel.run.name` to current `HomeCommandCenterModel.training.run.name` for representative source days.
3. Compare duration totals within approved tolerance.
4. Confirm differences are reported as diagnostics and not silently hidden.
5. Confirm legacy Home remains default when pilot flag is off.

## Failure tests

Expected tests:

1. Missing readiness blocks.
2. Missing progression blocks.
3. Missing recommendation blocks when required.
4. Missing workout logs blocks completion-safe pilot.
5. Missing run logs blocks completion-safe pilot.
6. Missing audit hash blocks.
7. Missing provenance blocks.
8. Invalid date blocks.
9. Invalid day index blocks.
10. `DeloadDay` blocks.
11. `RecoveryDay` collapse blocks.
12. Support-changing-primary-type blocks.
13. Support-changing-logging blocks.

## Command-level validation expected in future implementation

Future implementation phase should run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

All must pass before any developer-only Home pilot is reported as complete.

---

# 13. PROMOTION IMPACT ANALYSIS

## What becomes easier after Home Adapter exists

After the Home Adapter exists, the app will have:

- a clear bridge from planner output to Home training display
- a testable validation boundary
- explicit ownership separation between planner and domain engines
- blocker/warning/info diagnostics for pilot safety
- a safe place to enforce RecoveryDay, deload, and Core support policies
- a way to compare planner-derived Home training fields against legacy Home fields
- a rollback-safe developer-only pilot path
- groundwork for later Train/Log/Recommendation adapter contracts

## What blockers remain after Home Adapter exists

Even after the Home Adapter is implemented, these blockers remain before promotion:

1. Production-safe planner input adapter must exist.
2. Readiness must be connected exactly once.
3. Progression must be connected exactly once.
4. Recommendation ownership/pass-through must be connected.
5. Goal tracking must be connected for full Home/Mission Control pilot.
6. Persistence completion evidence must be connected.
7. Audit hash generation/storage must exist.
8. Provenance generation/storage must exist.
9. Train adapter must be designed and implemented before Train promotion.
10. Log adapter must be designed and implemented before Log promotion.
11. Recommendation adapter must be designed before planner output can drive recommendation copy.
12. Backup/restore and Supabase/localStorage impact must be assessed before persistent planner sessions.
13. Existing readiness adjustment path must not double-apply to planner output.
14. Home pilot must complete shadow/parity testing successfully.

## Promotion impact summary

The Home Adapter is necessary but not sufficient for planner promotion. It enables a safe Home pilot, but it does not replace source-of-truth ownership, persistence, Train execution, Log receipts, or recommendation engines.

---

# 14. GO / NO-GO CHECKLIST

## Go / No-Go checklist for future developer-only Home pilot

- [ ] readiness connected
- [ ] progression connected
- [ ] recommendation connected
- [ ] persistence connected
- [ ] audit hash present
- [ ] provenance present
- [ ] rollback path exists
- [ ] parity tests pass
- [ ] shadow tests pass
- [ ] Home pilot successful

## Expanded checklist

- [ ] `HomeTrainingModel` type exists.
- [ ] `HomeAdapterDiagnostic` type exists.
- [ ] `buildHomeTrainingModel(...)` exists and is pure.
- [ ] `validateDailyTrainingSession(...)` blocks invalid sessions.
- [ ] `mapPlannerToHome(...)` preserves session policy locks.
- [ ] Missing readiness returns `BLOCKER`.
- [ ] Missing progression returns `BLOCKER`.
- [ ] Missing recommendation returns `BLOCKER` when required.
- [ ] Missing logs return `BLOCKER` for completion-safe pilot.
- [ ] Missing audit hash returns `BLOCKER`.
- [ ] Missing provenance returns `BLOCKER`.
- [ ] `RecoveryDay` remains `RecoveryDay`.
- [ ] `MobilityDay` remains separate from `RecoveryDay`.
- [ ] Deload remains metadata only.
- [ ] No `DeloadDay` exists.
- [ ] Core support appears as support only.
- [ ] Core support does not change run logging.
- [ ] Core support does not change lift logging.
- [ ] Existing Home remains default when feature flag is off.
- [ ] Any blocker suppresses pilot rendering.
- [ ] Developer-only label is visible for any pilot output.
- [ ] No adapter writes to `AppState`.
- [ ] No adapter writes to persistence.
- [ ] No Train behavior changes.
- [ ] No Log behavior changes.
- [ ] No Recommendation behavior changes.
- [ ] No Readiness behavior changes.
- [ ] No Progression behavior changes.

---

# 15. RECOMMENDED FUTURE IMPLEMENTATION TASKS

These tasks are for the future implementation phase only. They are intentionally not executed in Phase 27E.

## Task 1 — Create adapter type skeleton

Files:

- Create: `src/lib/home-adapter.ts`
- Create: `src/lib/home-adapter.test.ts`

Goal:

- Define `HomeAdapterDiagnostic`, `HomeTrainingModel`, `BuildHomeTrainingModelInput`, and `HomeAdapterResult`.
- Export no runtime wiring.

Verification:

- Typecheck passes.
- Existing Home behavior unchanged.

## Task 2 — Add validation-only blocked result

Files:

- Modify: `src/lib/home-adapter.ts`
- Modify: `src/lib/home-adapter.test.ts`

Goal:

- Implement `buildHomeTrainingModel(...)` returning `model: null` if blockers exist.
- Add missing readiness/progression/recommendation/audit/provenance tests.

Verification:

- Unit tests prove blockers suppress model output.

## Task 3 — Validate DailyTrainingSession policy locks

Files:

- Modify: `src/lib/home-adapter.ts`
- Modify: `src/lib/home-adapter.test.ts`

Goal:

- Implement `validateDailyTrainingSession(...)`.
- Cover RecoveryDay, Deload, Core support, required workout/run/recovery prescriptions.

Verification:

- Policy-lock tests pass.

## Task 4 — Map planner fields to HomeTrainingModel

Files:

- Modify: `src/lib/home-adapter.ts`
- Modify: `src/lib/home-adapter.test.ts`

Goal:

- Implement `mapPlannerToHome(...)`, `mapWorkoutItem(...)`, `mapRunItem(...)`, `mapSupportItems(...)`.

Verification:

- Mapping tests pass for lift/run/long-run/recovery/deload/support cases.

## Task 5 — Add persistence-derived completion mapping

Files:

- Modify: `src/lib/home-adapter.ts`
- Modify: `src/lib/home-adapter.test.ts`

Goal:

- Compute workout/run status from real logs only.

Verification:

- Tests prove planner status alone cannot mark completion.

## Task 6 — Add parity diagnostics

Files:

- Create: `src/lib/home-adapter-parity.test.ts`
- Modify: `src/lib/home-adapter.ts` if parity helpers are colocated

Goal:

- Compare adapter output against current Home training slice for representative days.

Verification:

- Parity tests pass or produce expected diagnostics.

## Task 7 — Add developer-only non-rendered pilot bridge

Files:

- Modify only if explicitly approved:
  - `src/app/page.tsx`
  - `src/lib/home-command-center.ts`

Goal:

- Prepare pilot data behind feature flag without replacing Home.

Verification:

- Flag off: existing Home unchanged.
- Flag on with blocker: existing Home still renders.
- Flag on without blocker: developer-only pilot data available.

---

# 16. PHASE 27E VALIDATION STATEMENT

This Phase 27E document creates the implementation blueprint only.

Confirmed intended scope:

- no code changes
- no test changes
- no UI changes
- no runtime behavior changes
- no planner promotion
- no source-of-truth replacement
- no adapters created
- no adapters wired

Requested validation commands for this documentation-only phase:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The command results should be recorded in the Phase 27E completion response.

---

# 17. RECOMMENDED NEXT PHASE

Recommended next phase:

```text
PHASE 27F — Developer-Only Home Adapter Implementation V1
```

Phase 27F should implement only the pure adapter and tests unless the user explicitly expands scope to include a developer-only Home pilot flag. The safest Phase 27F scope is:

- create `src/lib/home-adapter.ts`
- create `src/lib/home-adapter.test.ts`
- implement pure validation and mapping
- do not wire Home UI yet
- do not promote planner
- do not change Train/Log/Recommendation/Readiness/Progression/Persistence behavior

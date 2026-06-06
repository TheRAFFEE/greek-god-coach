# PLANNER_INPUT_CONTRACT_V1

**Phase:** 27C — Production Planner Input Contract & Adapter Design V1  
**Mode:** Design / contract only  
**Status:** Documentation only; no code, tests, UI, source-of-truth, or adapter implementation changed  
**Planner status:** Developer-only, advisory-only, read-only, not promoted

## Scope boundary

This document defines the production-safe input contract required before Home adapter implementation. It does not promote the planner, implement adapters, change runtime behavior, change tests, or modify source-of-truth data.

## Files reviewed

- `src/lib/training-planner.ts`
- `src/lib/training-planner-adapter.ts`
- `src/lib/training-engine.ts`
- `src/lib/coach-engine.ts`
- `src/lib/readiness-engine.ts`
- `src/lib/progression-engine.ts`
- `src/lib/home-command-center.ts`
- `src/app/page.tsx`
- `src/lib/types.ts`

---

# 1. Canonical planner input schema

Current planner entry point:

```ts
buildDailyTrainingSession(input: BuildDailyTrainingSessionInput): DailyTrainingSession
```

Current TypeScript input shape from `training-planner.ts`:

```ts
interface BuildDailyTrainingSessionInput {
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

## Required production planner inputs

For runtime promotion, these must be treated as required by the production adapter:

1. `date`
2. `currentWeek`
3. `workouts`
4. `readinessResult`
5. `progressionResult`
6. `goalTrackingResult`
7. historical completion evidence:
   - `completedWorkoutSessions`
   - `completedRunLogs`

## Optional production planner inputs

These may be absent only under explicit, validated policy:

1. `runningEngineResult`
   - Optional only when no run is planned or when Home adapter does not need running-engine-specific risk/progression metadata for the session.

2. `runningRecommendation`
   - Optional only when no run is planned, when the run prescription is intentionally source-plan-only, or when recommendation generation is explicitly deferred to the recommendation adapter.

3. `userPreferences`
   - Optional with bounded defaults for display/execution preferences only.
   - Planner may default `includeWarmup` and `includeCooldown` in a production-safe adapter if the defaults are declared and versioned.

## Forbidden planner-generated runtime values

In runtime mode, the planner or planner input adapter must not fabricate:

- readiness score/status/confidence/recommendation
- progression weekly decision/confidence/data quality
- goal tracking status/confidence/priority goal
- source workout plan data
- run recommendation distances/actions
- historical workout/run completion logs
- current week/date values from an implicit clock when a caller-supplied canonical date is required
- user identity or persisted source IDs

Current `training-planner-adapter.ts` contains shadow-safe fallback functions:

- `fallbackReadiness()`
- `fallbackProgression()`
- `fallbackGoalTracking()`

These are acceptable only for developer-only shadow/advisory output. They are forbidden in production planner runtime ownership.

---

# 2. Ownership matrix

## 2.1 `date`

- **Current source:** `input.date ?? todayIso()` in `training-planner-adapter.ts`; `todayIso()` in `page.tsx`; explicit `today` passed from page debug panels.
- **Current owner:** UI/page orchestration and storage date helper.
- **Production owner:** App runtime orchestration layer, not planner internals. A canonical request context must provide the date.
- **Required validation:** ISO date string `YYYY-MM-DD`; must be timezone-normalized; must match the Home adapter request date; must not be empty or include time.
- **Missing-data behavior:** Block runtime planner generation or require caller to create an explicit request date before calling the adapter.
- **Fallback behavior:** Developer shadow mode may use `todayIso()`; production adapter must not silently use implicit current date if Home/Train/Log are requesting a specific date.
- **May planner fabricate values?** No.
- **Runtime promotion safe?** Promotion Risk. Current defaulting to `todayIso()` is safe for shadow diagnostics but unsafe for replay, persistence, and Home parity.
- **Classification:** Promotion Risk.

## 2.2 `currentWeek`

- **Current source:** `selectedWeek ?? currentWeek ?? state.currentWeek` in `training-planner-adapter.ts`; `state.currentWeek` in `page.tsx` and `home-command-center.ts`.
- **Current owner:** `AppState.currentWeek`, with UI selected week able to override in debug/preview contexts.
- **Production owner:** AppState/source-of-truth training calendar owner.
- **Required validation:** Positive integer; within source plan supported range; must match the canonical date-to-plan-week policy.
- **Missing-data behavior:** Block promotion path; do not infer from selected UI week unless the request is explicitly a preview, not runtime Home.
- **Fallback behavior:** None in runtime. Shadow may use `state.currentWeek`.
- **May planner fabricate values?** No.
- **Runtime promotion safe?** Promotion Risk. Current adapter can prefer `selectedWeek`, which is acceptable for preview but not canonical Home runtime.
- **Classification:** Promotion Risk.

## 2.3 `workouts`

- **Current source:** `input.workouts ?? seedWorkouts` in `training-planner-adapter.ts`; seed plan from `seed-data`; selected workouts via `getWorkoutForWeekDay()` in legacy UI.
- **Current owner:** Seed training plan data in `seed-data`; planner adapter defaults to seed workouts.
- **Production owner:** Canonical training plan source-of-truth provider. Until a new source replaces it, seed workouts remain the source plan owner.
- **Required validation:** Non-empty array; every workout has `id`, `week`, `dayIndex`, `title`, `type`, `exercises`; `week/dayIndex` uniqueness policy; day index 0-6; exercises have IDs and categories; deload metadata preserved; source IDs stable.
- **Missing-data behavior:** Return explicit safe unavailable/rest session only if source plan lookup fails for the requested day; missing entire plan blocks promotion.
- **Fallback behavior:** Runtime adapter may not silently import seed workouts when caller intended a different source plan. It may use seed workouts only when the source plan provenance explicitly says `seed-workouts-v1`.
- **May planner fabricate values?** No. Planner may classify and compose; it may not invent source workouts.
- **Runtime promotion safe?** Promotion Risk. Current default to `seedWorkouts` is acceptable if seed plan remains canonical, unsafe if source plan becomes external/user-specific.
- **Classification:** Promotion Risk.

## 2.4 `readinessResult`

- **Current source:** In runtime page, `calculateReadiness(latestCheckIn, baseline)` returns compatibility `ReadinessScore`; debug planner reconstructs `plannerReadiness`; `home-command-center.ts` can recompute full readiness via `readinessFromState`; adapter falls back to `fallbackReadiness()`.
- **Current owner:** `readiness-engine.ts` is the canonical calculation engine; `coach-engine.ts` provides compatibility wrapper; page currently owns active runtime derivation.
- **Production owner:** `readiness-engine.ts` producing full `ReadinessEngineResult` from canonical check-in/baseline inputs.
- **Required validation:** Must include score 0-100, status `Green|Yellow|Red`, confidence, reasons, reason, recommendation, recommendationType, trainingGuidance, recoveryGuidance, dataQualityWarnings. Date/source context must match planner date.
- **Missing-data behavior:** Runtime policy must block hard training. Either block planner generation for Home promotion or emit explicit safe recovery/unavailable state outside fabricated readiness. Do not call `fallbackReadiness()` in production.
- **Fallback behavior:** Shadow-only fallback allowed; runtime fallback forbidden.
- **May planner fabricate values?** No.
- **Runtime promotion safe?** Promotion Blocker until full readiness result is passed once and legacy `adjustWorkoutForReadiness()` is not also applied.
- **Classification:** Promotion Blocker.

## 2.5 `progressionResult`

- **Current source:** `home-command-center.ts` computes `evaluateProgression(weeklyProgressionInput(...))` when not supplied; `weeklyProgressionInput()` currently passes `runningResult: null` and `workoutResult: null`; adapter falls back to `fallbackProgression()`.
- **Current owner:** `progression-engine.ts`; Home command center currently orchestrates its inputs.
- **Production owner:** `progression-engine.ts` fed by production-quality readiness, nutrition, running, workout, weekly review, and weight trend inputs.
- **Required validation:** Must include `weeklyDecision`, `nutritionDecision`, goal status map, confidence, data quality object, reasons, warnings, audit entries. If dataQuality score is low, planner may produce low-confidence output but must not hide missing domain signals.
- **Missing-data behavior:** Runtime promotion must block or generate explicitly low-confidence non-promoted/advisory Home model. It must not fabricate `Repeat` as if safe.
- **Fallback behavior:** Shadow-only `fallbackProgression()` allowed; runtime fallback forbidden.
- **May planner fabricate values?** No.
- **Runtime promotion safe?** Promotion Blocker. Current fallback and incomplete Home progression inputs are not production-safe for planner runtime ownership.
- **Classification:** Promotion Blocker.

## 2.6 `goalTrackingResult`

- **Current source:** `home-command-center.ts` computes `evaluateGoalTracking(...)` when not supplied; adapter falls back to `fallbackGoalTracking()`.
- **Current owner:** `goal-tracking-engine.ts` via Home command center orchestration.
- **Production owner:** Goal tracking engine, with planner consuming the result.
- **Required validation:** Must include overall status/score/confidence, data quality score, goals map, priority goal, summary, recommendations, warnings, explanations, audit trail.
- **Missing-data behavior:** Planner may continue with low confidence only if a real goal engine result says insufficient data. Planner may not fabricate goal tracking in runtime mode.
- **Fallback behavior:** Shadow-only fallback allowed; runtime fallback forbidden.
- **May planner fabricate values?** No.
- **Runtime promotion safe?** Promotion Risk. Less safety-critical than readiness/progression, but Home priorities and goals can become misleading if fabricated.
- **Classification:** Promotion Risk.

## 2.7 `runningEngineResult`

- **Current source:** Optional input in adapter; currently often absent/null in planner debug calls from `page.tsx`. `progression-engine.ts` has a mapper from running engine result, but the planner itself does not currently use this field directly.
- **Current owner:** `running-engine.ts` domain engine.
- **Production owner:** Running engine, consumed by progression and/or recommendation adapter.
- **Required validation:** If provided, must correspond to same date/week/log window as planner request; must be consistent with running recommendation and planned run.
- **Missing-data behavior:** If no run is planned, null is safe. If a run is planned, missing running engine result is allowed only if `runningRecommendation` and source run prescription are explicitly sufficient for Home adapter scope.
- **Fallback behavior:** Runtime adapter may pass null with explicit reason; it may not fabricate a running engine result.
- **May planner fabricate values?** No.
- **Runtime promotion safe?** Promotion Risk. Not directly used by current planner, but required for future Home safety and progression consistency.
- **Classification:** Promotion Risk.

## 2.8 `runningRecommendation`

- **Current source:** `page.tsx` calls `generateRunningRecommendation()` only when `todayRunDisplay` exists and `plannedRunDistance > 0`; adapter otherwise passes null.
- **Current owner:** `coach-engine.ts` compatibility API wrapping `running-engine.ts`.
- **Production owner:** Recommendation adapter/running engine pair. Planner consumes recommendation action/distance only when policy allows.
- **Required validation:** If present, recommended distance must be finite and non-negative; action must be compatible with planned run type; date and planned distance context must match source run; recovery/regression must not contradict Red readiness.
- **Missing-data behavior:** If no run is planned, null is safe. If distance-based run is planned, missing recommendation can be safe only under a declared source-plan-only policy. If duration-only run is planned, missing recommendation must be explicitly expected because current recommendation API is distance-centric.
- **Fallback behavior:** Do not fabricate action or distance. Use source workout run prescription as the plan, and mark recommendation unavailable/deferred.
- **May planner fabricate values?** No. Planner may ignore null and preserve source run prescription.
- **Runtime promotion safe?** Promotion Risk. For Home adapter, planner can show source-plan run, but recommendation copy must not imply an evaluated recommendation exists.
- **Classification:** Promotion Risk.

## 2.9 `userPreferences.includeWarmup`

- **Current source:** Adapter default `{ includeWarmup: true }`; `page.tsx` passes implicit defaults to training engine and planner debug paths.
- **Current owner:** UI/runtime session preference policy.
- **Production owner:** User/session preference provider or fixed product default.
- **Required validation:** Boolean when present.
- **Missing-data behavior:** Default to `true` may be acceptable if declared in planner version policy.
- **Fallback behavior:** Production-safe declared default allowed.
- **May planner fabricate values?** Yes, only as a documented display/execution preference default, not a training prescription signal.
- **Runtime promotion safe?** Promotion Safe if versioned.
- **Classification:** Promotion Safe.

## 2.10 `userPreferences.includeCooldown`

- **Current source:** Adapter default `{ includeCooldown: true }`; `page.tsx` passes implicit defaults.
- **Current owner:** UI/runtime session preference policy.
- **Production owner:** User/session preference provider or fixed product default.
- **Required validation:** Boolean when present.
- **Missing-data behavior:** Default to `true` may be acceptable if declared in planner version policy.
- **Fallback behavior:** Production-safe declared default allowed.
- **May planner fabricate values?** Yes, only as documented default.
- **Runtime promotion safe?** Promotion Safe if versioned.
- **Classification:** Promotion Safe.

## 2.11 `userPreferences.preferredOrder`

- **Current source:** Optional and not actively supplied in reviewed runtime/debug calls.
- **Current owner:** Not established.
- **Production owner:** User preference/session policy if implemented.
- **Required validation:** Array containing only `lift`, `run`, `mobility`, `recovery`; no duplicate entries unless policy permits; must not violate safety/order constraints.
- **Missing-data behavior:** Use planner default block order.
- **Fallback behavior:** Safe to omit.
- **May planner fabricate values?** No. Planner may apply default ordering rules but should not claim a user preference exists.
- **Runtime promotion safe?** Promotion Safe as optional.
- **Classification:** Promotion Safe.

## 2.12 `userPreferences.availableMinutes`

- **Current source:** Optional in planner input; legacy `evaluateTraining()` is often called with `availableMinutes: 90` in `page.tsx`.
- **Current owner:** UI/session availability policy.
- **Production owner:** User preference, schedule/calendar input, or explicit product default.
- **Required validation:** Null or finite positive number; if provided, must be within allowed bounds such as 10-180 minutes.
- **Missing-data behavior:** Planner may estimate duration without time-boxing; Home must label it as estimate, not optimized to availability.
- **Fallback behavior:** Do not silently use `90` unless that is a declared product default.
- **May planner fabricate values?** No, except a documented null/unknown state.
- **Runtime promotion safe?** Promotion Risk because legacy runtime uses a hardcoded 90-minute default.
- **Classification:** Promotion Risk.

## 2.13 `completedWorkoutSessions`

- **Current source:** `input.state.workoutSessions ?? []` copied in adapter.
- **Current owner:** `AppState.workoutSessions`, written by `ActiveWorkout()` in `page.tsx` and persisted by `storage.ts`/Supabase sync.
- **Production owner:** Durable log/persistence layer. Planner consumes as completion evidence only.
- **Required validation:** Array; session IDs stable; `workoutId`, `status`, `startedAt`, optional `endedAt` valid; records belong to same user/context; date matching policy explicit.
- **Missing-data behavior:** Empty array is safe only when logs are genuinely absent/unknown and data quality labels reflect this. Missing log array due to load failure is a blocker.
- **Fallback behavior:** Runtime adapter may default undefined to empty only after AppState migration guarantees arrays are normalized.
- **May planner fabricate values?** No.
- **Runtime promotion safe?** Promotion Risk. Current fallback to empty is acceptable for initialized AppState but unsafe if persistence failed.
- **Classification:** Promotion Risk.

## 2.14 `completedRunLogs`

- **Current source:** `input.state.runLogs ?? []` copied in adapter.
- **Current owner:** `AppState.runLogs`, written by `saveTrainRunLog()`/run loggers and persisted by `storage.ts`/Supabase sync.
- **Production owner:** Durable log/persistence layer. Planner consumes as completion evidence only.
- **Required validation:** Array; dates valid; completed boolean present; planned/actual distances finite when present; run type valid; records belong to same user/context.
- **Missing-data behavior:** Empty array is safe only when logs are genuinely absent/unknown and data quality labels reflect this. Missing due to persistence/load failure is a blocker.
- **Fallback behavior:** Runtime adapter may default undefined to empty only after AppState migration guarantees arrays are normalized.
- **May planner fabricate values?** No.
- **Runtime promotion safe?** Promotion Risk.
- **Classification:** Promotion Risk.

---

# 3. Validation rules

## 3.1 Adapter-level validation rules

Before calling `buildDailyTrainingSession()` in runtime mode, the production adapter must validate:

1. `date` is canonical `YYYY-MM-DD`.
2. `currentWeek` is a positive integer and within source plan range.
3. `workouts` is the approved source plan and has explicit provenance.
4. Exactly one source workout exists for `currentWeek + dayIndex`, or the no-workout case is classified as explicit unavailable/rest.
5. `readinessResult` is present and complete.
6. `progressionResult` is present and complete.
7. `goalTrackingResult` is present and complete or explicitly real `Insufficient Data` from the goal engine.
8. `runningRecommendation` is present, null, or deferred under a declared policy matching the run plan.
9. Historical logs are normalized arrays from successfully loaded AppState.
10. User preferences are either validated or set to declared defaults.

## 3.2 Cross-input validation rules

The production adapter must also validate consistency:

- The planner date equals Home adapter date.
- The planner current week equals the source plan selection policy.
- The selected source workout week/dayIndex matches the planner date/dayIndex.
- Readiness/progression/goal results were produced for the same evaluation date or accepted window.
- A `runningRecommendation.recommendedDistance` must not override a duration-only source run unless a duration-to-distance policy exists.
- Red readiness and `Recovery Focus` progression must not be applied again by legacy `adjustWorkoutForReadiness()` after planner output.
- `workouts` source IDs used by planner must remain usable by lift logging and completion checks.
- Completed logs must be same-user/same-state logs, not global/unscoped arrays.

## 3.3 Output validation required before Home adapter

A Home adapter consuming `DailyTrainingSession` must validate:

- `DailyTrainingSession.id` stable for date/currentWeek/version/provenance.
- `sessionType` is one of approved primary session types.
- `metadata.deload` is metadata only.
- `RecoveryDay` remains distinct.
- `support` does not alter Home primary session type.
- `summary.title`, `primaryAction`, and estimated duration are present.
- If `run` exists, logging target has date and either planned distance or duration.
- If `workout` exists, logging target has source workout ID/title/date.
- Warnings preserve readiness/progression critical safety messages.

---

# 4. Runtime safety rules

## 4.1 Missing readiness policy

- **Runtime planner may not fabricate readiness.**
- If readiness is missing in production mode:
  - Do not generate a normal training prescription.
  - Do not call `fallbackReadiness()`.
  - Home adapter should receive either no planner session or an explicit safe unavailable/recovery state produced outside fabricated readiness.
  - The UI must tell the user to complete Daily Check-In or indicate insufficient readiness data.
- **Classification:** Promotion Blocker.

## 4.2 Missing progression policy

- **Runtime planner may not fabricate progression.**
- If progression is missing:
  - Do not silently default to `Repeat`.
  - Either block planner runtime output or produce a low-confidence source-plan-only advisory state that cannot be promoted as canonical.
  - Home adapter must surface progression unavailable if it affects session safety or weekly deload/recovery decisions.
- **Classification:** Promotion Blocker.

## 4.3 Missing recommendation policy

- Missing `runningRecommendation` is not always a blocker.
- Safe cases:
  - no run planned
  - source-plan-only run display explicitly accepted
  - recommendation adapter will generate copy later without mutating planner session type
- Unsafe cases:
  - planned distance run where Home copy implies progression/regression was evaluated
  - duration-only run where recommendation is accidentally skipped but displayed as normal
  - Red readiness or Recovery Focus where recommendation contradicts safety override
- **Classification:** Promotion Risk.

## 4.4 Missing run-plan policy

- If source workout has no run and planner classification finds no run, this is safe.
- If source workout includes run intent but parser cannot extract distance or duration:
  - Home adapter must not display a fabricated run.
  - Planner audit trail must mark run parse failure.
  - Production adapter should classify this as a validation warning or blocker depending on source workout type.
- Long-run source days with missing run extraction are blockers.
- **Classification:** Promotion Risk to Promotion Blocker depending on source day.

## 4.5 Missing workout-plan policy

- If no source workout exists for the requested week/day:
  - Current planner emits safe unavailable/rest behavior.
  - Production Home adapter may display `Training Unavailable — Rest` only with explicit provenance and warning.
- If a source workout exists but exercises are missing on a lift day:
  - Do not fabricate exercises.
  - Treat as source-plan validation failure.
- **Classification:** Promotion Risk; blocker for planned lift days.

## 4.6 Missing historical-log policy

- Empty logs are safe when AppState loaded successfully and arrays are normalized.
- Missing logs due to persistence failure are unsafe.
- Historical logs must not be fabricated to mark completion or to clear warnings.
- Home adapter must distinguish `Not Started` from `Unknown due to data load failure` if persistence status is not ready.
- **Classification:** Promotion Risk.

## 4.7 Runtime fallback policy

Allowed runtime fallbacks:

- declared warmup/cooldown defaults
- null optional user preferences
- source-plan no-workout rest/unavailable result with warning
- empty log arrays after successful AppState normalization

Forbidden runtime fallbacks:

- readiness fallback
- progression fallback
- goal tracking fallback presented as real
- fabricated running recommendation
- fabricated workout/source plan
- fabricated historical completion logs
- implicit date fallback for persisted/replay contexts

---

# 5. Required planner inputs

## Required for any Home adapter pilot

- `date`
- `currentWeek`
- `workouts`
- `readinessResult`
- `progressionResult`
- `goalTrackingResult`
- `completedWorkoutSessions`
- `completedRunLogs`
- declared planner input provenance
- declared planner version

## Required for run days

- source workout run intent extractable from source plan
- run type
- distance or duration
- nullable running recommendation policy
- run logging target

## Required for lift days

- source workout ID
- source workout title/type
- exercise list
- exercise IDs/categories/order
- lift logging target

## Required for recovery days

- source recovery day classification or readiness/progression recovery override reason
- `sessionType: RecoveryDay`
- recovery reason and warnings
- proof that mobility is not primary session type unless source classification is actually mobility

## Required for deload days

- source `workout.deload` or approved note-derived deload metadata
- `metadata.deload: true`
- primary session type unchanged
- no `DeloadDay`

---

# 6. Optional planner inputs

Optional inputs are allowed only if their absence does not create false confidence or incorrect execution.

- `runningEngineResult`: optional for non-run days; risk for run days.
- `runningRecommendation`: optional under declared source-plan-only/deferred recommendation policy.
- `userPreferences.includeWarmup`: optional with declared default.
- `userPreferences.includeCooldown`: optional with declared default.
- `userPreferences.preferredOrder`: optional; default planner order applies.
- `userPreferences.availableMinutes`: optional; session duration remains estimate, not time-boxed optimization.

---

# 7. Input classification summary

## Promotion Safe

- `userPreferences.includeWarmup`, if default is declared/versioned
- `userPreferences.includeCooldown`, if default is declared/versioned
- `userPreferences.preferredOrder`, if omitted and planner default order is used

## Promotion Risk

- `date`
- `currentWeek`
- `workouts`
- `goalTrackingResult`
- `runningEngineResult`
- `runningRecommendation`
- `userPreferences.availableMinutes`
- `completedWorkoutSessions`
- `completedRunLogs`

## Promotion Blocker

- `readinessResult`
- `progressionResult`

Readiness and progression are blockers because current adapter can fabricate them for shadow mode and because runtime page/Home paths can apply or recompute these signals separately.

---

# 8. DailyTrainingSession versioning requirements

Before Home adapter implementation, every production planner session must have version metadata sufficient to explain how it was produced.

Required versioning fields or equivalent persisted/audit metadata:

```ts
plannerVersion: "planner-input-contract-v1" | string;
plannerSchemaVersion: number;
classificationPolicyVersion: string;
sourcePlanVersion: string;
readinessPolicyVersion: string;
progressionPolicyVersion: string;
recommendationPolicyVersion?: string;
createdAt: string;
```

Versioning rules:

1. Version must change when session classification policy changes.
2. Version must change when run parsing or support extraction changes.
3. Version must change when readiness/progression override semantics change.
4. Version must change when deload metadata semantics change.
5. Version must be available to Home adapter, shadow comparison, persistence, and rollback reports.
6. Version must distinguish developer shadow output from production runtime output.

Current blocker:

- `DailyTrainingSession` currently has no explicit planner version field.
- Current `sourcePlan.source` is `seed-workouts-v1`, but this is not enough to version planner logic.

---

# 9. DailyTrainingSession audit hash requirements

Promotion requires reproducibility or explainability. A planner audit hash should bind the session to the inputs and policies that produced it.

## Required hash inputs

A stable audit hash should include:

- planner version
- planner schema version
- classification policy version
- source plan version
- date
- current week
- source workout ID/title/type/dayIndex/week
- source workout deload flag
- normalized exercise IDs/names/categories/orders
- readiness result hash or normalized snapshot
- progression result hash or normalized snapshot
- goal tracking result hash or normalized snapshot
- running recommendation hash or explicit null reason
- running engine result hash or explicit null reason
- user preferences snapshot
- completed workout session completion evidence hash
- completed run log completion evidence hash

## Hash rules

1. Hash must be deterministic for the same inputs.
2. Hash must ignore volatile UI-only fields.
3. Hash must distinguish missing input from explicit null policy.
4. Hash must be available to persistence/backup/restore once planner state is stored.
5. Hash must allow comparing a Home-displayed planner session to Train/Log planner references.

Current blocker:

- Current `auditTrail` is human-readable but no deterministic audit hash exists.

---

# 10. DailyTrainingSession provenance requirements

Production planner sessions must explicitly state where every critical input came from.

Required provenance fields or equivalent audit/provenance map:

```ts
provenance: {
  mode: "developer-shadow" | "runtime-pilot" | "runtime-canonical";
  sourcePlan: { source: string; version: string; workoutId?: string };
  dateSource: "runtime-request" | "developer-preview" | "implicit-today";
  weekSource: "app-state" | "developer-preview" | "calendar-derived";
  readinessSource: "readiness-engine" | "missing";
  progressionSource: "progression-engine" | "missing";
  goalTrackingSource: "goal-tracking-engine" | "missing";
  runningRecommendationSource: "running-engine" | "coach-engine" | "deferred" | "not-applicable";
  logSource: "app-state" | "missing";
}
```

Provenance rules:

1. Runtime mode may not use `implicit-today` for persisted/replay contexts.
2. Runtime mode may not mark fallback readiness/progression/goal values as engine-owned.
3. Runtime mode must record whether recommendation is evaluated, deferred, or not applicable.
4. Home adapter must preserve provenance enough to show data-quality and safety messages.
5. Shadow mode must remain clearly labeled as developer/advisory.

Current blocker:

- Current `DailyTrainingSession.sourcePlan` has partial provenance only: source workout identifiers and resolved session type.
- It does not record input-source provenance for readiness/progression/goal/recommendation/logs.

---

# 11. Adapter requirements for Home

The Home adapter must not directly wire current planner output into production UI until input contract validation exists.

## 11.1 Required Home adapter inputs

Home adapter must receive:

- validated `DailyTrainingSession`
- planner validation result
- planner version/provenance/audit hash
- readiness result used by the planner
- progression result used by the planner
- goal tracking result used by the planner
- Home data-quality model
- AppState completion/log context

## 11.2 Required Home adapter outputs

The Home adapter must produce Home-safe fields:

- today training title
- primary action
- workout display item
- run display item
- recovery display item when applicable
- estimated duration
- completion status
- warnings and blockers
- confidence/data-quality label
- deload metadata label
- support/core metadata label
- source/provenance label for developer or pilot mode

## 11.3 Required Home adapter safety behavior

Home adapter must:

1. Refuse to display planner as canonical when validation has blockers.
2. Preserve legacy Home output unless feature flag/pilot flag is active.
3. Never call fallback readiness/progression/goal functions.
4. Never recompute readiness/progression independently after planner session is built.
5. Never apply `adjustWorkoutForReadiness()` to planner output.
6. Display `RecoveryDay` distinctly.
7. Display deload as metadata only.
8. Display support/core as support, not primary session type.
9. Preserve source workout/run IDs for Train handoff planning.
10. Surface missing recommendation state honestly.

## 11.4 Required compatibility bridge

During pilot, Home adapter should create a compatibility model that can feed existing Home surfaces without changing all UI at once:

```text
DailyTrainingSession
  -> PlannerHomeTrainingModel
  -> HomeCommandCenter-compatible training fields
  -> existing Home UI
```

The bridge must be read-only and feature-flagged.

---

# 12. Critical blockers

1. **Runtime adapter currently fabricates readiness/progression/goal results in shadow mode.**
   - These fallbacks must be forbidden for production Home adapter runtime.

2. **Full `ReadinessEngineResult` is not consistently the active runtime input.**
   - Page uses `calculateReadiness()` compatibility output and reconstructs planner readiness in debug paths.

3. **Progression input quality is incomplete.**
   - Home command center progression currently passes `runningResult: null` and `workoutResult: null` into `evaluateProgression()`.

4. **No planner version/audit hash/provenance contract exists in session output.**
   - Home adapter cannot safely claim canonical source-of-truth without reproducibility metadata.

5. **Readiness/progression double-application risk remains.**
   - Legacy `adjustWorkoutForReadiness()` can still modify workouts separately from planner readiness/progression logic.

6. **Runtime date/week ownership is not canonicalized.**
   - Current adapter can use `todayIso()`, selectedWeek, currentWeek, or state current week depending on caller.

---

# 13. Major blockers

1. **Running recommendation is distance-centric.**
   - `page.tsx` generates it only when planned run distance is greater than zero, while planner supports duration-only runs.

2. **Historical log absence is not differentiated from persistence/load failure.**
   - Adapter defaults arrays to empty; Home adapter needs data-load status.

3. **Source plan provenance is partial.**
   - `sourcePlan.source` exists in planner output but lacks source plan version and input source mode.

4. **Goal tracking fallback can create misleading Home priorities.**
   - It is lower safety risk than readiness/progression but still not production-safe as canonical Home input.

5. **User preferences are not centrally owned.**
   - Warmup/cooldown defaults are acceptable, but available minutes and preferred order lack source ownership.

6. **Planner completion status is derived only from legacy logs.**
   - Safe for shadow; risky for promoted Home completion cards without planner references.

---

# 14. Recommended Home adapter implementation plan

## Step 1 — Contract-only validation model

Create a future validation design before implementation:

- `PlannerRuntimeInputValidationResult`
- `PlannerRuntimeInputBlocker`
- `PlannerRuntimeInputWarning`
- `PlannerInputProvenance`

No runtime wiring yet.

## Step 2 — Production input adapter design

Design a strict adapter mode:

```text
AppState + canonical date + engine results + source plan
  -> validate
  -> BuildDailyTrainingSessionInput
```

Strict mode must reject fallback readiness/progression/goal generation.

## Step 3 — Version/provenance/audit hash design

Add design for:

- planner version
- source plan version
- policy versions
- input hash
- provenance map

Do this before Home consumes planner output.

## Step 4 — Home adapter shape design

Define `PlannerHomeTrainingModel` before UI changes:

- session type
- title/action
- workout/run/recovery/support cards
- duration
- completion
- safety warnings
- confidence/provenance

## Step 5 — Read-only Home adapter implementation behind flag

Future implementation phase only:

- Build adapter as pure function.
- Keep legacy Home output unchanged by default.
- Add developer/pilot comparison.

## Step 6 — Home parity and safety tests

Future test phase only:

- Green/Yellow/Red readiness
- Recovery Focus progression
- RecoveryDay
- LiftDay
- RunDay
- LongRunDay
- duration-only run
- deload metadata
- core support
- missing source workout
- missing recommendation
- missing logs

## Step 7 — Pilot decision gate

Only after validation/provenance/tests pass:

- enable Home adapter under hard feature flag
- keep planner advisory/read-only until Train/Log/Recommendation/Persistence adapters exist

---

# 15. Final contract statement

The planner may not become a Home runtime input until the production adapter can prove that every critical `BuildDailyTrainingSessionInput` field is engine-owned, source-owned, validated, and provenance-labeled.

For Phase 27C, the required conclusion is:

```text
Home adapter implementation is not yet safe.
Next safe step is a production input validation/provenance design or pure adapter implementation behind a developer-only flag.
```

Planner remains:

- developer-only
- advisory-only
- read-only
- not promoted

# MECHANICAL_POLICY_RECONCILIATION_PLAN_V1

## Scope Boundary

- Phase: 26C — Mechanical Policy Reconciliation Plan V1
- Purpose: translate the approved Phase 26B policies in `TRAINING_POLICY_DECISIONS_V1.md` into an implementation plan.
- Inputs reviewed:
  - `TRAINING_POLICY_DECISIONS_V1.md`
  - `REAL_WORLD_SHADOW_TRIAL_V1.md`
  - current resolver implementation
  - current planner implementation
  - current Train Preview / Planner Train Screen V1 implementation
  - current planner-related tests
- Deliverable: planning/documentation only.
- No code, tests, UI, planner outputs, source-of-truth behavior, recommendations, readiness, progression, persistence, logging, Home, Train, or Log behavior changed in this phase.
- Planner remains developer-only, advisory-only, read-only, and not promoted.

## Policy Inputs Summary

From `TRAINING_POLICY_DECISIONS_V1.md`:

- Phase 26A evaluated 84 seed-plan days.
- 56 passed.
- 28 required review.
- 12 review-required outputs were Sunday recovery seed days presenting as `MobilityDay`.
- 16 review-required outputs were core/trunk support visibility issues.
- No incorrect logging, stress-rating, or duration issues were recorded as policy blockers.

Approved policies to reconcile mechanically:

1. `RecoveryDay` remains distinct.
2. Core support visibility should be explicit when the source day contains meaningful core/trunk work.
3. Deload should be metadata on top of the normal primary session, not a replacement primary session type in ordinary deload weeks.

---

# 1. Recovery Mapping

## Current Files Involved

- `src/lib/types.ts`
  - Defines `Workout.deload?: boolean`, `Workout.type`, `Workout.title`, `Workout.notes`, `Workout.exercises`.
  - Does not define a dedicated source-plan `sessionType` field.
- `src/lib/seed-data.ts`
  - Creates Sunday seed days with `title: "Recovery"`, `type: "recovery"`, and recovery/mobility/nutrition exercises.
- `src/lib/primary-session-resolver.ts`
  - Resolves source `Workout` intent into `PrimarySessionResolution.dayType`.
- `src/lib/training-planner.ts`
  - Converts source workouts into `DailyTrainingSession` objects.
  - Does not persist `PrimarySessionResolution.dayType` directly onto `DailyTrainingSession`.
- `src/lib/planner-train-preview.ts`
  - Infers a `PlannerTrainPreviewSessionType` from `DailyTrainingSession` after planner construction.
- `src/lib/planner-train-screen-v1.ts`
  - Builds developer-only Train preview UI model from planner session and preview session type.
- `src/app/page.tsx`
  - Wires developer-only planner panels and Train screen preview behind `plannerDebugEnabled`.

## Current Enums / Types Involved

- `PrimarySessionType` in `src/lib/primary-session-resolver.ts`:
  - Includes `RecoveryDay` and `MobilityDay` as distinct values.
- `DailyTrainingStatus` in `src/lib/training-planner.ts`:
  - `"Normal" | "Modified" | "Recovery" | "Rest"`
  - This is status, not primary session type.
- `DailyTrainingBlockKind` in `src/lib/training-planner.ts`:
  - Includes `mobility`, `walk`, and `recovery` block kinds.
- `PlannerTrainPreviewSessionType` in `src/lib/planner-train-preview.ts`:
  - Includes `RecoveryDay` and `MobilityDay`.
- `PlannerTrainScreenV1SessionType` in `src/lib/planner-train-screen-v1.ts`:
  - Includes `RecoveryDay` and `MobilityDay`.

## Current Resolver Logic

Responsible functions in `src/lib/primary-session-resolver.ts`:

- `textFor(workout)`
- `isSupportExercise(exercise)`
- `hasMobilityStimulus(workout)`
- `supportOnly(workout)`
- `resolvePrimarySession(workout)`

Important current behavior:

- `resolvePrimarySession(...)` already has an explicit recovery branch:
  - If `workout.title` or `workout.type` contains `recovery` or `rest`, it returns:
    - `dayType: "RecoveryDay"`
    - `primaryStimulus: "Recovery / walk / mobility"`
    - `allowedBlocks: ["mobility", "recovery"]`
    - `forbiddenBlocks: ["lift", "run", "conditioning", "sprint"]`
    - `sessionStress: "Recovery"`
- Therefore, the resolver itself already supports distinct `RecoveryDay` classification.

## Current Planner Logic

Responsible functions in `src/lib/training-planner.ts`:

- `classifyWorkout(workout)`
- `isMobilityExercise(exercise)`
- `isRecoveryExercise(exercise)`
- `buildMobilityPrescription(workout, classification)`
- `buildRecoveryPrescription(reason)`
- `buildBlocks(input)`
- `buildCombinedLoad(input)`
- `buildDailyTrainingSession(input)`

Important current behavior:

- `classifyWorkout(...)` calls `resolvePrimarySession(...)` and receives `RecoveryDay` for Sunday recovery workouts.
- `classifyWorkout(...)` sets `isRecoveryDay = primarySession.dayType === "RecoveryDay"`.
- Sunday seed recovery days contain both recovery and mobility exercises.
- `buildMobilityPrescription(...)` allows mobility when `allowedBlocks` includes `mobility` or `recovery`.
- `buildMobilityPrescription(...)` extracts mobility exercises and returns a mobility prescription when mobility exercises exist.
- `buildRecoveryPrescription(...)` is only used for readiness/progression overrides, not for source-plan recovery days.
- In `buildDailyTrainingSession(...)`:
  - `recoveryOverride = input.readinessResult.status === "Red" || input.progressionResult.weeklyDecision === "Recovery Focus"`
  - `recovery = recoveryOverride ? buildRecoveryPrescription(...) : null`
  - For a planned Sunday recovery day under Green readiness, `recoveryOverride` is false, so `recovery` remains null.
  - `mobility = buildMobilityPrescription(...)` returns a mobility prescription.
  - `recoveryDayRest = Boolean(sourceWorkout && classification.isRecoveryDay && !workout && !run && !recoveryOverride)` becomes true.
  - `status` becomes `Rest` because `recoveryDayRest` is true.
  - `title` becomes `mobility?.title` because there is no `recovery` object.
  - `primaryAction` becomes `Do mobility` because `mobility` exists and `recovery` does not.
- The planner does not expose `classification.primarySession.dayType` in `DailyTrainingSession.sourcePlan` or a dedicated `sessionType` field. Downstream consumers that infer type from `session.mobility` can classify the day as `MobilityDay` even though the resolver returned `RecoveryDay`.

## Current Train Preview Logic

Responsible functions in `src/lib/planner-train-preview.ts`:

- `inferSessionType(session)`
- `buildPlannerTrainPreview(session, timestamp)`
- `buildPlannerTrainPreviewPanel(input)`
- `renderPlannerTrainPreviewText(panel)`

Important current behavior:

- `inferSessionType(...)` is a post-planner inference function.
- It currently checks source-plan recovery text before checking `session.mobility`:
  - source title/type containing `recovery`
  - `session.recovery`
  - `session.status === "Recovery"`
  - `session.blocks` containing `recovery` or `walk`
- If this current function is used, a Sunday source title `Recovery` should infer `RecoveryDay`.
- However, this is not because the planner core preserved resolver output. It is a secondary inference heuristic.

Responsible functions in `src/lib/planner-train-screen-v1.ts`:

- `buildPlannerTrainScreenV1(input)`
- `makePrimary(session, sessionType)`
- `supportFromBlocks(session, primary)`
- `makeLogging(session, sessionType)`
- `renderPlannerTrainScreenV1Text(screen)`

Important current behavior:

- `buildPlannerTrainScreenV1(...)` relies on `buildPlannerTrainPreview(...)` for `sessionType`.
- `makePrimary(...)` maps `RecoveryDay` to a recovery primary with no required training log.
- If a downstream consumer sees only `DailyTrainingSession` without preview inference, the core planner object still presents the source recovery day as `status: Rest`, `mobility` present, `recovery: null`, `summary.title: Mobility`, and `summary.primaryAction: Do mobility`.

## Current Tests

Relevant current tests:

- `src/lib/primary-session-resolver.test.ts`
  - `Recovery resolves to RecoveryDay`
  - `Mobility only resolves to MobilityDay`
  - `Core only does not resolve to LiftDay`
  - resolver/planner support-work classification tests
- `src/lib/training-planner.test.ts`
  - `Recovery day creates recovery/mobility block, not lift`
  - `Mobility does not become reps`
  - recovery override tests for Red readiness and Recovery Focus progression
- `src/lib/training-planner-classification-audit.test.ts`
  - mobility/core/run/lift/long-run classification audit tests
- `src/lib/planner-train-preview.test.ts`
  - `Recovery preview is RecoveryDay`
- `src/lib/planner-train-screen-v1.test.ts`
  - `Recovery renders Recovery and no logging`

## Why Sunday Recovery Days Become MobilityDay

Mechanically, the cause is not the resolver. The resolver already returns `RecoveryDay`.

The cause is the planner session shape and source-plan recovery handling:

1. `resolvePrimarySession(...)` returns `RecoveryDay` for Sunday seed recovery workouts.
2. `classifyWorkout(...)` stores that inside a private `Classification` object.
3. `buildDailyTrainingSession(...)` does not persist that resolved day type onto the returned `DailyTrainingSession`.
4. Planned source recovery days do not call `buildRecoveryPrescription(...)`; that function is reserved for Red readiness or Recovery Focus overrides.
5. Planned source recovery days with mobility exercises call `buildMobilityPrescription(...)` and produce `session.mobility`.
6. The returned session therefore has mobility work but no recovery prescription object.
7. Any consumer or trial code that infers primary type from the returned planner session by checking `session.mobility` after no run/lift exists will produce `MobilityDay`.

Exact responsible functions:

- `resolvePrimarySession(...)` — correctly identifies `RecoveryDay` but only returns it locally to planner classification.
- `classifyWorkout(...)` — captures `primarySession.dayType` privately.
- `buildMobilityPrescription(...)` — emits mobility for source recovery days because recovery allows mobility/recovery blocks.
- `buildRecoveryPrescription(...)` — not used for planned source recovery days.
- `buildDailyTrainingSession(...)` — returns a session with `mobility` present, `recovery` null, `status: Rest`, `summary.title` from mobility, and no persisted primary session type.
- `inferSessionType(...)` or any comparable inference layer — responsible for whether the UI/trial reclassifies that mobility-shaped session back to `RecoveryDay`.

---

# 2. Core Support Visibility Mapping

## Current Files Involved

- `src/lib/seed-data.ts`
  - Source seed plan contains core/trunk work in workout titles, exercise categories, and finishers.
- `src/lib/primary-session-resolver.ts`
  - Treats core as support, not a lift/run primary.
- `src/lib/training-planner.ts`
  - Filters core out of lift prescriptions and does not build a dedicated core/support block.
- `src/lib/planner-train-screen-v1.ts`
  - Attempts to surface `Support: Core` from source/block text.
- `src/app/page.tsx`
  - Displays developer-only support work cards on the planner Train screen.

## Where Support Work Is Extracted

Resolver-level extraction in `src/lib/primary-session-resolver.ts`:

- `SUPPORT_CATEGORIES`
- `SUPPORT_TEXT`
- `isSupportExercise(exercise)`
- `isResistanceExercise(exercise)`
- `resolvePrimarySession(workout)`

Planner-level extraction in `src/lib/training-planner.ts`:

- `isMobilityExercise(exercise)` extracts mobility/stretching support.
- `isRecoveryExercise(exercise)` extracts recovery/walk/nutrition-style recovery support.
- `isConditioningExercise(exercise)` extracts sprint/plyo/circuit/finisher-style conditioning support.
- `classifyWorkout(workout)` creates arrays for lift, conditioning, mobility, recovery, and run exercises.

Train Screen V1 extraction in `src/lib/planner-train-screen-v1.ts`:

- `itemHasCore(text)` detects explicit core terms in visible text.
- `sourceHasCore(session)` checks source title/type plus block titles/items.
- `supportFromBlocks(session, primary)` creates support items from existing blocks, then optionally adds `Support: Core` if `sourceHasCore(session)` is true.

## Where Support Work Is Displayed

- `src/lib/planner-train-screen-v1.ts`
  - `renderPlannerTrainScreenV1Text(...)` renders lines such as `Support: Core — Core`.
- `src/app/page.tsx`
  - `PlannerTrainScreenV1DeveloperPanel(...)` renders support cards with `Support: {item.kind}`.
- Existing planner preview in `src/lib/planner-train-preview.ts` displays only target rows:
  - Workout Target
  - Run Target
  - Conditioning Target
  - Mobility Target
  - It does not have a dedicated Core Target row.

## Where Support Work Is Omitted

Core/trunk support is omitted at the planner-core block level:

- `src/lib/training-planner.ts`
  - `Classification` has no `coreExercises` or `supportExercises` array.
  - `DailyTrainingBlockKind` has no `core` or generic `support` kind.
  - `classifyWorkout(...)` filters core out of lift exercises via:
    - `!/nutrition|core|breathing|prehab|warmup|cooldown/i.test(exercise.category)`
  - `buildWorkoutPrescription(...)` receives only `classification.liftExercises`, so core exercises are excluded from the lift block.
  - `buildMobilityPrescription(...)` only uses `classification.mobilityExercises`, not core.
  - `conditioningBlock(...)` only uses `classification.conditioningExercises`, not core unless the text also qualifies as conditioning.
  - `buildBlocks(...)` has no core/support block builder.

Because core is intentionally prevented from becoming lift and no replacement core/support block exists, core is protected from wrong primary classification but can disappear from planner output.

## Specific Core/Trunk Investigations

### Loaded Carries

Source location:

- `src/lib/seed-data.ts`, phase 2 lower-strength Tuesday:
  - `Loaded Carries`, category `core`

Current behavior:

- Resolver treats category `core` as support via `isSupportExercise(...)`.
- Planner excludes category `core` from `liftExercises` in `classifyWorkout(...)`.
- No `coreExercises` collection exists.
- `sourceHasCore(...)` can detect the category or block text only if core text remains in source/block-derived text.
- Since excluded core exercises do not appear in blocks, Train Screen V1 may fall back to a generic `Core support work` instead of listing `Loaded Carries` exactly.

### Farmer Carries

Source location:

- `src/lib/seed-data.ts`, athletic conditioning Friday finisher:
  - `farmer carry 1 min`

Current behavior:

- The finisher text contributes to conditioning detection through `classifyWorkout(...)` because `conditioningText` includes `workout.finisher` and has `/carry/` in the conditioning regex.
- `itemHasCore(...)` does not include `carry` / `carries` / `farmer carry`, so Train Screen V1 does not classify farmer carry text as `Support: Core` unless another explicit core token is present in title/type/blocks.
- Farmer carry is therefore more likely to appear as conditioning context or disappear from explicit core support visibility.

### Ab Wheel

Current behavior:

- `itemHasCore(...)` includes `ab wheel`.
- If `Ab Wheel` appears in existing block items or source text passed into `sourceHasCore(...)`, Train Screen V1 can emit `Support: Core`.
- Planner core still has no `coreExercises`, so exact exercise preservation depends on whether the text survives into blocks. If it is filtered out of lift and not added to another block, exact item visibility can still be lost.

### Trunk Stability Work

Current behavior:

- `itemHasCore(...)` does not include `trunk`, `stability`, `brace`, `bracing`, `carry`, `carries`, or `loaded carry` as explicit core markers.
- Resolver support regex sees `core` but not general trunk-stability terminology.
- Planner core has no dedicated trunk/core support extractor.
- Result: trunk stability work is not reliably emitted as `Support: Core`.

### Dedicated Core Circuits

Current behavior:

- `primary-session-resolver.ts` includes `circuit` in `LIFT_TEXT` and `EXPLICIT_HYBRID_TEXT` avoids accidental hybrid unless explicitly stated.
- `training-planner.ts` treats `circuit`/`finisher` as conditioning when allowed.
- Dedicated core circuits may be interpreted as support by resolver if category/name includes `core`; however planner core still lacks a core-support block.
- Train Screen V1 can emit a generic core support item if `sourceHasCore(...)` sees explicit core text, but exact circuit contents may not be preserved.

## Why Core Is Not Emitted as `Support: Core`

Exact responsible functions:

- `isSupportExercise(...)` in `primary-session-resolver.ts`
  - Correctly prevents core from becoming lift/run primary but does not create output blocks.
- `isResistanceExercise(...)` in `primary-session-resolver.ts`
  - Excludes support/core from resistance stimulus.
- `classifyWorkout(...)` in `training-planner.ts`
  - Does not define `coreExercises`.
  - Filters `core` out of `liftExercises`.
- `buildWorkoutPrescription(...)` in `training-planner.ts`
  - Builds lift prescription only from filtered lift exercises.
- `buildMobilityPrescription(...)` in `training-planner.ts`
  - Builds only mobility items, not core support.
- `conditioningBlock(...)` in `training-planner.ts`
  - Builds only conditioning items, not core support.
- `buildBlocks(...)` in `training-planner.ts`
  - Has no core/support block path.
- `itemHasCore(...)` in `planner-train-screen-v1.ts`
  - Core detection vocabulary is incomplete for loaded carries/farmer carries/trunk stability.
- `sourceHasCore(...)` in `planner-train-screen-v1.ts`
  - Attempts late recovery of core visibility from source/block text, but cannot reliably list exact core exercises once planner core has omitted them from blocks.
- `supportFromBlocks(...)` in `planner-train-screen-v1.ts`
  - Emits `Support: Core` as a display-layer reconstruction, not from a first-class planner support block.

---

# 3. Deload Metadata Mapping

## Current Deload Representation

Current source-level representation:

- `src/lib/types.ts`
  - `Workout.deload?: boolean`
- `src/lib/seed-data.ts`
  - `const deload = [4, 8, 12].includes(week)`
  - Deload weeks add note text:
    - `Deload: reduce lifting volume 30-40%, keep movement quality, avoid max effort.`
  - Seed workouts include `deload` on most deload-week workouts.
  - Exercise set counts are reduced for deload lifting work:
    - `t.deload && category !== "conditioning" && category !== "recovery" ? Math.max(1, Math.floor(sets * 0.65)) : sets`
  - Long run entries include `deload` and already follow deload-week mileage behavior through the mileage table.

Current planner-level representation:

- `src/lib/training-planner.ts`
  - `DailyTrainingSession.sourcePlan` includes source workout id/title/type only.
  - It does not include `sourceWorkoutDeload` or `deload` metadata.
  - `DailyTrainingSession` has no `deload` field.
  - `DailyTrainingBlock` has no deload metadata.

Current resolver-level representation:

- `src/lib/primary-session-resolver.ts`
  - Detects deload via title/type text only:
    - `const deload = DELOAD_TEXT.test(`${workout.title} ${workout.type}`)`
  - Does not inspect `workout.deload`.
  - For run days with `deload` text, returns `DeloadDay` instead of `RunDay`.
  - For lift days with `deload` text, returns `DeloadDay` instead of `LiftDay`.

Current preview-level representation:

- `src/lib/planner-train-preview.ts`
  - `inferSessionType(...)` checks title/type text for `deload` and returns `DeloadDay` before run/lift inference.
  - It does not inspect `Workout.deload` because that metadata is not present in `DailyTrainingSession.sourcePlan`.
- `src/lib/planner-train-screen-v1.ts`
  - `PlannerTrainScreenV1SessionType` includes `DeloadDay`, but primary rendering does not have a deload metadata field.

## Current Seed Flags

- Source workouts already have `Workout.deload?: boolean` available.
- Deload flag is created in `src/lib/seed-data.ts` for weeks 4, 8, and 12.
- The current planner loses this flag when it builds `DailyTrainingSession.sourcePlan`.

## Current Planner Interpretation

- Planner currently benefits from deload indirectly because seed exercise set counts have already been reduced in `seed-data.ts`.
- Planner does not expose deload as planner metadata.
- Resolver text-based `DeloadDay` support exists, but it is not aligned with the approved policy because it replaces the primary session type rather than preserving `sessionType + deload=true`.
- In current seed data, title/type generally remain `upper-strength`, `lower-strength`, `zone-2`, `long-run`, etc.; deload appears in notes and `workout.deload`, not title/type. Therefore current preview may produce no `DeloadDay` despite deload-week behavior existing in source data.

## Current Train Preview Interpretation

- Train Preview can represent `DeloadDay` as a session type, but not `RunDay + deload=true` or `LiftDay + deload=true`.
- Train Screen V1 can display `DeloadDay` as a top-card session type, but has no separate deload badge/metadata.
- Neither preview nor Train Screen has a `deload` boolean in the model.

## Does Current Architecture Support `sessionType + deload=true`?

Partially at source level only.

Already supported:

- `Workout.deload?: boolean` exists.
- Seed plan sets `deload` for deload weeks.
- Seed plan mechanically reduces lifting sets during deload weeks.

Additional plumbing required:

- Add deload metadata to planner session output, likely under `DailyTrainingSession.sourcePlan` or a dedicated session metadata field.
- Preserve normal primary type from resolver (`RunDay`, `LiftDay`, `LongRunDay`, etc.) while exposing `deload: true` separately.
- Update preview/screen models to display deload metadata without turning primary session type into `DeloadDay` for ordinary deload weeks.
- Update tests to prove deload weeks preserve primary stimulus and expose metadata.

Current architecture does not fully support `sessionType + deload=true` as a planner-visible concept because the source flag is dropped before preview/screen layers.

---

# 4. Implementation Impact Analysis

## Policy 1 — `RecoveryDay` Distinct

Expected modifications:

- `src/lib/training-planner.ts`
  - Persist resolver day type into returned planner session, or construct planned source recovery as a recovery prescription instead of mobility-primary output.
  - Ensure source recovery days preserve recovery as primary while mobility/walk/nutrition remain support.
- `src/lib/planner-train-preview.ts`
  - Prefer planner-provided primary session type over post-hoc inference.
  - Keep recovery stress override if needed.
- `src/lib/planner-train-screen-v1.ts`
  - Use explicit planner session type/metadata rather than reconstructing from session shape.
  - Ensure support work still shows mobility, stretching, breathing, cooldown, and possibly recovery walk.
- `src/app/page.tsx`
  - Only if type/model field names change for preview/screen wiring.

Tests requiring modification/addition:

- `src/lib/training-planner.test.ts`
  - Planned Sunday recovery emits a first-class recovery primary/session type.
  - Planned recovery does not require run/lift logging.
  - Planned recovery may include mobility as support.
- `src/lib/primary-session-resolver.test.ts`
  - Existing recovery resolver test should remain.
- `src/lib/planner-train-preview.test.ts`
  - Preview reads explicit planner type rather than relying only on source text inference.
- `src/lib/planner-train-screen-v1.test.ts`
  - Recovery day renders recovery primary with mobility support and no logging.
- `src/lib/training-planner-classification-audit.test.ts`
  - Add/adjust Sunday seed audit to require `RecoveryDay` as planner-facing output.

Risk level: MEDIUM

Reason:

- Domain policy is clear and resolver already supports it.
- Main risk is that `DailyTrainingSession` currently uses `status`/`mobility`/`recovery` shape rather than explicit primary session type, so adding the field can affect multiple consumers if done carelessly.
- Must avoid changing production Train/Home/Log behavior unless intentionally scoped in a later implementation phase.

Expected validation strategy:

- Unit tests for resolver unchanged behavior.
- Unit tests for planner session output for all 12 Sunday seed recovery days.
- Preview/screen tests verifying developer-only read-only advisory behavior unchanged.
- Shadow trial regenerated after implementation to confirm 12 recovery reviews convert to PASS.
- Full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Policy 2 — Core Support Visibility

Expected modifications:

- `src/lib/training-planner.ts`
  - Add explicit extraction for core/trunk support, such as `isCoreExercise(...)` and `coreExercises` / `supportExercises` in `Classification`.
  - Add a planner block or support model for core without converting it to lift.
  - Preserve exact core exercise names/reps where possible.
- `src/lib/planner-train-screen-v1.ts`
  - Prefer first-class planner core support block/items over late text heuristics.
  - Expand fallback vocabulary for loaded carries, farmer carries, trunk stability, bracing, anti-rotation, anti-extension.
- `src/lib/planner-train-preview.ts`
  - Optional: add a `supportTarget` or `coreTarget` row if preview scope includes support visibility.
- `src/app/page.tsx`
  - Only if UI model fields change for developer-only display.

Tests requiring modification/addition:

- `src/lib/training-planner.test.ts`
  - Core support remains non-lift and non-run but appears in support output.
  - Loaded Carries emitted as core support.
  - Farmer carry emitted as core/trunk support if policy wants finisher text surfaced.
  - Ab Wheel emitted as core support.
  - Trunk stability / bracing work emitted as core support.
  - Dedicated core circuits emitted as core support without creating lift logging.
- `src/lib/planner-train-screen-v1.test.ts`
  - Support cards display exact core support items, not only generic fallback.
- `src/lib/primary-session-resolver.test.ts`
  - Core support still does not create LiftDay/HybridDay.
- `src/lib/training-planner-classification-audit.test.ts`
  - Seed-plan core/trunk support visibility audit.

Risk level: MEDIUM

Reason:

- The main implementation must thread support visibility without changing primary classification or logging.
- Risk is higher than a display-only vocabulary patch because exact visibility requires planner-core extraction before exercises are filtered away.
- Need to avoid making core circuits look like lift prescriptions or required lift logs.

Expected validation strategy:

- Targeted tests for each named support case.
- Snapshot/text tests for Train Screen V1 support display.
- Shadow trial regenerated to confirm 16 core support review items convert to PASS.
- Full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Policy 3 — Deload Metadata

Expected modifications:

- `src/lib/training-planner.ts`
  - Preserve `sourceWorkout.deload` in planner output.
  - Add a dedicated planner-visible deload metadata field.
- `src/lib/primary-session-resolver.ts`
  - Stop treating ordinary deload as primary session replacement for policy-aligned paths.
  - Use normal day type plus metadata. If `DeloadDay` remains, reserve it for true deload-only days or future policy-defined cases.
  - Consider inspecting `workout.deload` if resolver needs awareness, but do not collapse the primary day type.
- `src/lib/planner-train-preview.ts`
  - Add deload metadata display while preserving primary `RunDay`/`LiftDay`/`LongRunDay`/etc.
  - Avoid `DeloadDay` for ordinary deload-week run/lift/long-run days.
- `src/lib/planner-train-screen-v1.ts`
  - Add developer-only deload badge/metadata if in implementation scope.
- `src/app/page.tsx`
  - Only if preview/screen props or display fields change.

Tests requiring modification/addition:

- `src/lib/training-planner.test.ts`
  - Week 4/8/12 seed days expose `deload: true` metadata.
  - Primary type remains `LiftDay`, `RunDay`, or `LongRunDay` as appropriate.
- `src/lib/primary-session-resolver.test.ts`
  - Deload flag/text does not replace normal primary type for ordinary training days.
- `src/lib/planner-train-preview.test.ts`
  - Preview displays deload metadata without returning `DeloadDay` for ordinary deload weeks.
- `src/lib/planner-train-screen-v1.test.ts`
  - Developer screen displays deload metadata without changing logging targets.
- `src/lib/training-planner-classification-audit.test.ts`
  - Full seed deload-week audit.

Risk level: MEDIUM

Reason:

- Source data already has `deload`; implementation is mostly metadata plumbing.
- Risk comes from current type unions containing `DeloadDay`, which may encourage replacing primary session type. Tests must lock `sessionType + deload=true`.

Expected validation strategy:

- Unit tests for deload weeks across run/lift/long-run days.
- Assert no production logging changes.
- Assert no accidental source-of-truth changes.
- Full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

---

# 5. Risk Analysis

## Low-Risk Areas

- Resolver already distinguishes `RecoveryDay` and `MobilityDay`.
- Source data already carries deload flags.
- Developer-only Train Screen V1 already has a support work display concept.
- Existing tests already guard advisory-only/read-only/no-mutation behavior.

## Medium-Risk Areas

- Planner output does not currently preserve explicit primary session type.
- Source recovery days are represented as mobility sessions plus rest status rather than recovery-primary sessions.
- Core support is filtered out before planner blocks are built.
- Deload metadata is dropped from planner session output.
- Preview and Train Screen V1 currently reconstruct meaning from the planner session shape rather than consuming first-class metadata.

## High-Risk Areas

No approved policy requires a high-risk implementation if scope remains developer-only/advisory-only and planner output remains non-source-of-truth during the next phase.

Potential high-risk escalation would occur only if a later phase promoted planner output into Home, Train, Log, recommendations, readiness, progression, persistence, or logging behavior before shadow validation is clean.

---

# 6. Recommended Implementation Order

1. Add explicit planner-facing primary session metadata without changing production behavior.
   - Preserve resolver output on `DailyTrainingSession` or a nested planner metadata object.
   - Keep it advisory/developer-only initially.

2. Reconcile `RecoveryDay` using that explicit metadata.
   - Planned recovery should remain `RecoveryDay`.
   - Mobility/walk/stretching stay support.
   - No run/lift logging.

3. Add first-class core support extraction.
   - Add core/trunk support classifier.
   - Preserve exact items.
   - Keep core out of lift/run logging.

4. Add deload metadata plumbing.
   - Preserve `sourceWorkout.deload`.
   - Display `sessionType + deload=true` in developer-only surfaces.
   - Avoid ordinary `DeloadDay` replacement semantics.

5. Regenerate the real-world shadow trial.
   - Confirm the 28 current review items are resolved or explicitly reduced to any remaining true policy exceptions.

---

# 7. Recommended Validation Order

1. Resolver unit validation
   - Recovery vs mobility distinction.
   - Core/trunk support does not change primary type.
   - Deload does not replace normal primary type under ordinary deload-week training.

2. Planner unit validation
   - `DailyTrainingSession` preserves primary session metadata.
   - Sunday recovery days output `RecoveryDay` metadata and no run/lift logging.
   - Core support items are emitted as support.
   - Deload weeks preserve primary type plus `deload: true`.

3. Preview / Train Screen V1 validation
   - Developer-only preview consumes explicit planner metadata.
   - `Support: Core` is shown for loaded carries, farmer carries, ab wheel, trunk stability, and core circuits.
   - Deload appears as metadata, not primary replacement.
   - Advisory/read-only/no-mutation guards remain true.

4. Full seed-plan audit
   - Re-run the shadow-trial evaluator across all 84 days.
   - Verify expected pass count improvements.
   - Confirm no incorrect logging, stress-rating, or duration regressions.

5. Standard validation suite
   - `pnpm test`
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm build`

---

# 8. Recommended Next Phase

Recommended next phase: **Phase 26D — Developer-Only Mechanical Policy Implementation V1**.

Suggested scope:

- Implement only metadata/plumbing needed for:
  - `RecoveryDay` distinct planner-facing output
  - explicit core support visibility
  - `sessionType + deload=true`
- Keep planner developer-only, advisory-only, read-only, and not promoted.
- Do not change Home, Train, Log, recommendations, readiness, progression, persistence, or source-of-truth behavior.
- Add/adjust tests first for the approved policies, then implement the minimum code needed to pass them.
- Regenerate real-world shadow-trial evidence after implementation.

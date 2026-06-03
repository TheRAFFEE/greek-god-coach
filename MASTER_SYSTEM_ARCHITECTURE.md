# MASTER SYSTEM ARCHITECTURE

## 1. Purpose

This document is the governing architecture document for future Hermes prompts for the macro-workout-coach app.

Its purpose is to reconcile three sources of truth:

1. The app as currently implemented in code.
2. The user's desired final UX for one year of self-use.
3. The remaining must-have and nice-to-have systems required to make the app reliable, coherent, and practical.

Future implementation prompts should treat this file as the master product/architecture source of truth unless a later architecture document explicitly replaces it. When future prompts conflict with older architecture files, this master architecture should win unless the user explicitly says otherwise.

This file is not an implementation phase. It does not change code, UI, engines, state, or persistence. It defines the intended final ownership model, UX model, build order, risks, and acceptance criteria.

## 2. Current System Summary

Current implemented state based on the existing architecture docs and inspected source files:

- **Readiness V2 is implemented.** `src/lib/readiness-engine.ts` is the canonical readiness engine with `evaluateReadiness()`, `readinessInputFromDailyCheckIn()`, and `readinessInputFromWeeklyWindow()`.
- **Nutrition V2 is implemented.** `src/lib/nutrition-engine.ts` owns canonical nutrition targets, meal logs, macro totals, macro progress, adherence, saved foods, and compatibility adapters.
- **Running Engine V2 is implemented.** `src/lib/running-engine.ts` owns canonical running evaluation, running progression action, running goal status, confidence, injury-risk-oriented warnings, pace guidance, and audit entries.
- **Workout Engine V2 is implemented.** `src/lib/workout-engine.ts` owns canonical workout/exercise/set evaluation, progression decisions, deload/substitution guidance, PR detection, confidence, and audit entries.
- **Progression Engine is currently thin/partial.** `src/lib/progression-engine.ts` currently exposes only a small adapter from Running Engine V2 output. The full cross-domain Progression Engine described in `PROGRESSION_ENGINE_V1_ARCHITECTURE.md` is not yet implemented.
- **UI exists but still has legacy/adapters.** `src/app/page.tsx` already uses the five primary screens from `src/lib/navigation.ts`: Home, Train, Log, Progress, and More. However, screen responsibilities are not yet fully aligned with the desired UX. Log still contains workout/run logging, Home still uses a Start Day button that routes to Log, and Home still displays multiple data confidence/missing-data style cards instead of a cleaner Today's Goals model.
- **Food AI is partial/mock/OpenAI depending on environment.** The app has food AI scanner workflows and API routes, but default behavior may be deterministic mock unless the environment enables OpenAI. This should remain a nutrition logging aid, not a source of independent calorie-target logic.
- **Persistence is localStorage-oriented.** Active runtime persistence is still centered on localStorage fallback with optional Supabase sync context. For the current one-year self-use goal, local reliable backup/restore is required before broader production persistence work.
- **No Apple Health integration.** Apple Health / wearable integration is not required for now. Manual entry is acceptable and should remain a supported first-class path.

## 3. Product Vision

The final app is a one-year self-use coach for Walter to improve:

- Fat loss: cut from the current bodyweight toward under 200 lb without crashing training quality.
- Greek God physique: improve visible shape, shoulder/chest/back/arm development, waist reduction, and consistency with measurements/photos.
- Strength progression: progress lifts intelligently while managing recovery, pain, and fatigue.
- Half marathon endurance: build running capacity toward the January 17 half marathon with the goal of running the full race without walking and ideally approaching 9:00/mile pace.
- Consistency: make the daily path obvious so the user knows exactly what to do today, what to log, and whether the plan is working.

The app should feel like a practical daily command center, not a dashboard dump. It should answer:

1. What should I do today?
2. Am I ready to train normally, modify, or recover?
3. What is my workout/run order today?
4. What should I eat and how adherent am I?
5. Am I on track for physique, fat loss, strength, endurance, and consistency goals?
6. Why did the coach make this recommendation?
7. Is my data safe enough to trust this app for a full year?

Apple Health and wearable sync are explicitly out of scope for now. Manual check-ins, manual nutrition logs, manual body metrics, manual progress photo uploads, and manual workout/run execution must be good enough for sustained daily use.

## 4. Non-Negotiable Ownership Rules

Each domain must have one canonical owner. UI components, wrappers, and adapters may transform data into or out of canonical engines, but they must not independently duplicate engine decisions.

Required ownership model:

- **Readiness Engine owns recovery/readiness score.** It owns readiness score, readiness status, confidence, readiness reasons, training guidance, recovery guidance, and readiness data-quality warnings.
- **Nutrition Engine owns macro targets, meal logs, macro progress, and adherence.** It owns calorie/macronutrient targets, daily meal logs, daily totals, macro progress, adherence scoring, saved food normalization, and nutrition confidence.
- **Running Engine owns running prediction, pace zones, running progression, and injury risk.** It owns running progression/regression/hold decisions, long-run readiness, pace guidance, trend assessment, running goal status, and injury-risk warnings.
- **Workout Engine owns exercise/set/workout progression and substitutions.** It owns per-exercise progression, set guidance, deload/reduction decisions, substitutions, PR detection, and post-workout workout analysis.
- **Progression Engine owns weekly cross-domain decisions.** It reconciles readiness, workout, running, nutrition, body metrics, adherence, and goals into one weekly progression decision set.
- **Training Engine owns daily training session composition and order.** It decides the sequence for today: check-in result, warm-up, lift, run, cooldown, session cues, and post-session summary. It composes outputs from Readiness, Workout, Running, and Progression; it does not reinvent their logic.
- **Performance Engine owns trend analysis across strength, running, endurance, and recovery.** It detects trends and plateaus across logged performance over time. It informs Progression and Goal Tracking but does not own prescriptions.
- **Goal Tracking Engine owns whether the user is on track for goals.** It classifies goals as on track, at risk, or off track using canonical outputs and trend data.
- **Backup/Restore owns data safety.** It owns export, import, restore, validation, versioning, and restore confidence for local self-use.
- **Audit Dashboard displays decisions; it does not make decisions.** It aggregates engine audit trails and recommendation explanations without introducing new recommendation logic.
- **Physique Engine analyzes measurements/photos; it does not own calorie targets.** It may estimate body fat/muscle trends and provide physique analysis labels, but Nutrition Engine retains calorie/macro ownership.
- **Race Calendar Engine owns race-date-aware periodization.** It owns event dates, race countdown, race phase, and race-aware training context. It informs Training/Progression but does not directly log runs.
- **AI Coach Chat explains decisions; it does not independently override engines.** It can summarize, explain, and answer questions using engine outputs and audit trails. It cannot invent a separate plan or silently override canonical recommendations.

Explicit duplication rules:

- **No duplicate progression logic.** Weekly progression must live in Progression Engine, not page components, weekly review UI, coach chat, or logger utilities.
- **No duplicate nutrition target logic.** Macro/calorie targets must come from Nutrition Engine only.
- **No duplicate workout/run logging.** Train must become the only place to execute/log workouts and runs. Log must not keep redundant workout/run logging once Train V2 is implemented.
- **Compatibility wrappers may remain temporarily but must route to canonical engines.** Wrappers are allowed only as migration tools and should be removed once consumers are migrated.

## 5. Engine Map

| Engine | File | Current status | Canonical API | Inputs | Outputs | Consumers | Gaps |
|---|---|---|---|---|---|---|---|
| Readiness V2 | `src/lib/readiness-engine.ts` | Implemented | `evaluateReadiness(input)`, `readinessInputFromDailyCheckIn()`, `readinessInputFromWeeklyWindow()` | Sleep, soreness, stress, energy, alcohol, pain, pain severity, resting HR, HRV, baseline, daily/weekly mode | Score, Green/Yellow/Red status, confidence, reasons, recommendation type, training guidance, recovery guidance, data quality warnings | Daily check-in wrapper, weekly review, coach-engine wrapper, page UI | Needs cleaner direct UI ownership and one concise Home warning/confidence area |
| Nutrition V2 | `src/lib/nutrition-engine.ts` | Implemented with legacy bridges | `getNutritionTargetForDate()`, `calculateDailyNutritionTotals()`, `calculateMacroProgress()`, `calculateMacroAdherence()` and adapters | Base/planned/adjusted/manual targets, meal logs, saved foods, date, day type | Nutrition target, meal log normalization, totals, macro progress, adherence, confidence | Nutrition UI, nutrition logger, food AI, coach-engine, page UI | App state still has legacy MacroTarget/Meal/NutritionLog bridges; adherence needs better Progress visualization |
| Running V2 | `src/lib/running-engine.ts` | Implemented | `evaluateRunning(input)` | Recent runs, planned run, readiness, pain, weekly mileage, previous mileage, race/goal context | Progress/Hold/Regress/Recovery Focus action, recommended distance, pace guidance, goal status, warnings, confidence, audit | Run logger, weekly review, coach-engine, progression adapter | Needs Train-only run execution and race-calendar-aware inputs later |
| Workout V2 | `src/lib/workout-engine.ts` | Implemented | `evaluateWorkout(input)` | Planned workout, exercise definitions/history, set logs, readiness/recovery context, pain context | Exercise decisions, workout decision, substitutions, deload/reduce guidance, PRs, confidence, audit | Workout logger, coach-engine next-set/post-workout logic | Needs Train-only workout execution with warm-up/cooldown/rest timers/cues as first-class UX |
| Progression Engine | `src/lib/progression-engine.ts` | Thin/partial | Current: `progressionRunningInputFromRunningEngineV2(result)`; intended: full weekly `evaluateProgression()` | Readiness summary, workout performance, running performance, nutrition adherence, body metrics/photos, goal status, race context | Weekly cross-domain decisions, next-week plan adjustments, recommendation audit entries, confidence | Currently only tests/adapter; future Training, Progress, Goal Tracking | Full cross-domain implementation missing |
| Training Engine | Future likely `src/lib/training-engine.ts` | Not implemented as canonical engine | Intended: `composeTodayTrainingSession()` / `evaluateTrainingDay()` | Daily check-in/readiness, plan, workout engine output, running engine output, race calendar, progression guidance | Ordered daily session: warm-up, lift, run, cooldown, timers, cues, post-session summary | Future Home and Train | Does not exist; current composition is spread across `page.tsx`, seed data, coach-engine, running/workout loggers |
| Performance Engine | Future likely `src/lib/performance-engine.ts` | Not implemented | Intended: `evaluatePerformanceTrends()` | Workout logs, run logs, readiness history, body metrics, nutrition adherence | Strength trends, running trends, endurance trends, recovery trends, plateaus, performance warnings | Future Progress, Progression, Goal Tracking | Trend logic exists in scattered helpers/UI but no unified engine |
| Goal Tracking Engine | Future likely `src/lib/goal-tracking-engine.ts` | Not implemented | Intended: `evaluateGoalStatus()` | Goals, body metrics, weight trend, running trends, strength trends, adherence, race date, progression outputs | On Track / At Risk / Off Track per goal, reasons, next focus | Future Home, Progress, Progression, AI Coach Chat | No single goal status source currently |
| Backup/Restore | Existing helpers plus future hardening, likely `src/lib/backup-restore.ts` | Partial/local export helpers only | Intended: `createBackup()`, `validateBackup()`, `restoreBackup()`, `verifyRoundTrip()` | Full AppState, schema version, timestamp, local snapshots, imported payload | Versioned backup file/payload, validation result, restore result, rollback snapshot | Future More screen, possibly storage layer | Needs reliable one-year local self-use hardening, import verification, corruption handling |
| Audit Dashboard | Future likely `src/lib/audit-dashboard.ts` plus Progress/More UI | Not implemented as unified surface | Intended: `buildAuditDashboardModel()` | Audit entries from Readiness, Running, Workout, Nutrition, Progression, Goal Tracking | Human-readable decision history and explanations | Future Progress or More | Per-engine audit exists, but no consolidated product-level audit display |
| Physique Engine | Future likely `src/lib/physique-engine.ts` | Not implemented | Intended: `evaluatePhysiqueTrend()` / `analyzePhysiqueEstimate()` | Body measurements, weight, progress photos, dates, optional user-supplied labels | Measurement/photo trend, estimated body-fat/muscle labels, confidence, caveats | Future Progress and weekly review | Progress photos are URL/data oriented; upload/storage and Analyze Me estimate flow missing |
| Race Calendar Engine | Future likely `src/lib/race-calendar-engine.ts` | Not implemented as engine | Intended: `evaluateRaceCalendar()` | Race dates, current date, target race, training phase, recent running load | Race countdown, phase, periodization context, long-run constraints | Future Training, Running, Progression, Goal Tracking, Home | Current race countdown exists in UI helper path; no canonical race-date-aware periodization engine |
| AI Coach Chat | Future likely API/UI plus `src/lib/ai-coach-chat.ts` | Not implemented as canonical chat | Intended: `answerCoachQuestion()` constrained by engine outputs | User question, engine outputs, audit trails, app state summary | Explanation, grounded recommendations, caveats, links to source decisions | Future More/Home/Progress | Must be constrained to explain decisions, not create independent plans or override engines |

## 6. Final UX Ownership Model

Final screen responsibilities must be simple and non-overlapping.

**Home** owns mission control only:

- Today's coach brief.
- Today's goals.
- Goal status.
- Daily Check-In button.
- Start Workout button.
- Sunday check-in prompt for body measurements/photos.
- One concise warning/confidence area.

Home must not become a dense analytics dashboard. It should say what matters today and route the user to the right action.

**Train** owns all training execution:

- Warm-up.
- Lift.
- Run.
- Cooldown.
- Rest timers.
- Coach cues.
- All workout/run logging.
- Post-session summary.

If today includes lift + run, Train must show both in order. Train is the only place to execute and log workouts and runs.

**Log** owns non-training logging:

- Daily check-in.
- Nutrition.
- Body metrics.
- Progress photos.
- No workout logging.
- No run logging.

Daily Check-In can be reached from Home, but the logging surface belongs to Log unless a future UX embeds the form in a modal. Nutrition logging, body metrics, and photo uploads belong here.

**Progress** owns results and trends:

- Weight trends.
- Measurement trends.
- Photo trends.
- Nutrition adherence.
- Training adherence.
- Running trends.
- Strength trends.
- Performance trends.
- Goal tracking.

Nutrition adherence analytics should move here and be visualized. Progress should answer whether results are happening, not just list logs.

**More** owns settings and administration:

- Settings.
- Backup/export/import/restore.
- App info.

More should be the safe place for operational controls, not daily execution.

## 7. Final Data Flow

A. Daily start flow:

```text
Home
  -> Daily Check-In
  -> Readiness Engine
  -> Training Engine
  -> Today's Goals
  -> Train
```

Meaning:

- Home prompts the user to complete Daily Check-In if today's readiness is missing.
- Daily Check-In sends canonical input into Readiness Engine.
- Readiness Engine returns status, score, reasons, confidence, and guidance.
- Training Engine composes today's ordered training session using readiness plus workout/run plan context.
- Home displays Today's Goals and enables Start Workout.
- Start Workout routes to Train with today's ordered session.

B. Training flow:

```text
Train
  -> warm-up
  -> lift/run
  -> Workout Engine / Running Engine
  -> session summary
  -> state update
  -> Progression Engine
```

Meaning:

- Train presents warm-up, lift/run order, rest timers, cues, and cooldown.
- Lift execution sends set/exercise/session data to Workout Engine.
- Run execution sends run data to Running Engine.
- Train creates a post-session summary.
- State updates are persisted locally.
- Progression Engine consumes session outcomes later for weekly cross-domain decisions.

C. Nutrition flow:

```text
Log
  -> meal/manual/saved/scan
  -> Nutrition Engine
  -> macro progress
  -> Progress adherence
```

Meaning:

- User logs nutrition manually, from saved foods, or from scan/photo assistance.
- Nutrition Engine normalizes logs, resolves targets, calculates totals, and computes macro progress/adherence.
- Log shows today's logging workflow.
- Progress visualizes adherence over time.

D. Weekly review flow:

```text
Sunday prompt
  -> body metrics/photos
  -> Physique Engine
  -> Progression Engine
  -> Goal Tracking Engine
  -> next week plan
```

Meaning:

- Home prompts every Sunday for body measurements/photos.
- Log collects measurements/photos.
- Physique Engine analyzes measurement/photo trends and optional estimates.
- Progression Engine reconciles training, nutrition, readiness, running, and physique signals.
- Goal Tracking Engine classifies whether goals are on track/at risk/off track.
- The next-week plan is adjusted through canonical weekly decisions.

E. Backup flow:

```text
State mutation
  -> local snapshot
  -> manual export
  -> restore/import verification
```

Meaning:

- Every meaningful state mutation must remain locally persisted.
- Backup/Restore creates a versioned local snapshot/export payload.
- Manual export gives the user a durable backup file.
- Restore/import validates schema, required fields, and round-trip integrity before replacing active state.

## 8. Build Order

### Phase 1: MASTER_SYSTEM_ARCHITECTURE only

- **Purpose:** Create this governing architecture document and do not modify code.
- **Files likely changed:** `MASTER_SYSTEM_ARCHITECTURE.md` only.
- **Required tests:** No app test run required for documentation-only phase; verification should confirm file exists, sections exist, no code files changed, and `git status` reflects only the new doc.
- **Acceptance criteria:** Master architecture exists, has all 13 required sections, reconciles current implementation with desired UX and remaining systems, and recommends Phase 2.
- **What not to change:** No code, UI, engine files, tests, package files, storage schemas, or existing docs unless explicitly requested.

### Phase 2: Implement full Progression Engine

- **Purpose:** Replace the thin Progression Engine adapter with a full cross-domain weekly decision engine.
- **Files likely changed:** `src/lib/progression-engine.ts`, `src/lib/progression-engine.test.ts` or new tests, possibly `src/lib/weekly-review.ts` only as a consumer adapter if needed.
- **Required tests:** Unit tests for weekly progression decisions, cross-domain conflict resolution, confidence/data-quality handling, and adapter compatibility. Then `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- **Acceptance criteria:** Progression Engine produces one reconciled weekly recommendation set for training, running, nutrition, recovery, and goals; consumers do not duplicate progression logic; existing running adapter behavior remains compatible.
- **What not to change:** Do not redesign Home/Train/Log UX in this phase. Do not add Goal Tracking UI. Do not change persistence shape unless explicitly approved.

### Phase 3: Implement Goal Tracking Engine

- **Purpose:** Create a canonical engine that classifies goals as on track, at risk, or off track.
- **Files likely changed:** New `src/lib/goal-tracking-engine.ts`, tests, and small type/helper additions if needed.
- **Required tests:** Goal status cases for fat loss, race readiness, consistency, strength progression, and physique-related proxy goals. Then full validation commands.
- **Acceptance criteria:** Each major goal has status, reasons, confidence, and next focus; Progression Engine can consume the status without duplicating goal logic.
- **What not to change:** Do not rebuild Progress UI yet. Do not implement AI Coach Chat. Do not override Nutrition/Running/Workout decisions inside Goal Tracking.

### Phase 4: Implement UX V2 Home

- **Purpose:** Make Home mission control instead of a data dump.
- **Files likely changed:** `src/app/page.tsx`, possibly `src/lib/home-command-center.ts`, `src/lib/navigation.ts`, and tests if UI/model tests exist.
- **Required tests:** Model tests for Today's Goals if extracted; scenario checks for missing check-in, completed check-in, Sunday prompt, and warning/confidence display. Then full validation commands.
- **Acceptance criteria:** Home shows Today's coach brief, Today's Goals, goal status, Daily Check-In button, Start Workout button, Sunday body metrics/photos prompt, and one concise warning/confidence area. Stacked Data Confidence / Missing Data cards are replaced.
- **What not to change:** Do not move workout/run logging yet. Do not implement Backup/Restore. Do not add new engine logic into page components.

### Phase 5: Implement Train-only workout/run execution

- **Purpose:** Make Train the only place to execute and log workouts/runs.
- **Files likely changed:** `src/app/page.tsx`, future `src/lib/training-engine.ts`, Training UI helpers/components if split, `src/lib/workout-logger.ts`, `src/lib/run-logger.ts` as adapters, tests.
- **Required tests:** Lift-only day, run-only day, lift+run day in order, red pain day modifications, rest timer/cue model, post-session summary, state mutation. Then full validation commands.
- **Acceptance criteria:** Train includes warm-up, workout/run, cooldown, rest timers, coach cues, all workout/run logging, and post-session summary. If today includes lift + run, both appear in order.
- **What not to change:** Do not delete Log tab entirely. Do not change nutrition/body metric logging. Do not create duplicate Workout/Running Engine logic inside Training Engine.

### Phase 6: Clean Log tab

- **Purpose:** Remove redundant workout/run logging from Log after Train execution is complete.
- **Files likely changed:** `src/app/page.tsx`, `src/lib/navigation.ts`, possibly tests/snapshots.
- **Required tests:** Log contains daily check-in, nutrition, body metrics, progress photos; no workout logging and no run logging. Then full validation commands.
- **Acceptance criteria:** Log has no workout/run logging entry points; existing workout/run historical state remains intact; Daily Check-In and nutrition/body/photo flows still work.
- **What not to change:** Do not alter canonical engine behavior. Do not delete historical log data. Do not change backup format in this phase.

### Phase 7: Implement Backup/Restore hardening

- **Purpose:** Make local data reliable enough for one year of self-use.
- **Files likely changed:** New or existing backup helper file such as `src/lib/backup-restore.ts`, storage helpers in `src/lib/storage.ts`, More screen in `src/app/page.tsx`, tests.
- **Required tests:** Export payload creation, schema/version validation, corrupted import rejection, restore round trip, rollback/snapshot behavior. Then full validation commands.
- **Acceptance criteria:** User can export, import, validate, and restore local data with clear success/failure messages; backup includes version/timestamp and does not silently overwrite with invalid data.
- **What not to change:** Do not migrate away from localStorage unless explicitly planned. Do not require Supabase or Apple Health.

### Phase 8: Implement Performance Engine

- **Purpose:** Centralize trend analysis across strength, running, endurance, and recovery.
- **Files likely changed:** New `src/lib/performance-engine.ts`, tests, small consumer adapters in Progress/Progression.
- **Required tests:** Strength trend, running trend, endurance trend, recovery trend, plateau detection, insufficient-data confidence. Then full validation commands.
- **Acceptance criteria:** Performance trends are canonical and consumable by Progression and Goal Tracking; Progress can visualize them without recalculating.
- **What not to change:** Do not make Performance Engine own prescriptions. Do not duplicate Goal Tracking classifications.

### Phase 9: Implement Physique Engine

- **Purpose:** Analyze measurements/photos for physique trend tracking and future Analyze Me estimates.
- **Files likely changed:** New `src/lib/physique-engine.ts`, progress photo/body metric UI, tests, storage helpers if needed for uploaded photos.
- **Required tests:** Measurement trend, photo entry handling, estimate labeling, low-confidence/missing-data behavior. Then full validation commands.
- **Acceptance criteria:** Progress photos are uploaded from saved pictures rather than URL-based entry; body/photo analysis is clearly labeled as an estimate; calorie targets remain owned by Nutrition Engine.
- **What not to change:** Do not implement fake precise body-fat claims. Do not let Physique Engine change calorie targets directly.

### Phase 10: Implement Race Calendar Engine

- **Purpose:** Make race-date-aware periodization canonical.
- **Files likely changed:** New `src/lib/race-calendar-engine.ts`, tests, Home/Progress/Training/Running adapters.
- **Required tests:** Race countdown, phase classification, long-run context, missed long run near race, taper/race-prep context. Then full validation commands.
- **Acceptance criteria:** January 17 half marathon context is represented by a canonical engine; Running/Training/Progression can consume race phase without duplicating date math.
- **What not to change:** Do not replace Running Engine progression logic. Do not require external calendar integration.

### Phase 11: Implement Audit Dashboard

- **Purpose:** Display why recommendations were made across engines.
- **Files likely changed:** New `src/lib/audit-dashboard.ts`, Progress or More UI, tests.
- **Required tests:** Aggregates audit entries from multiple engines, sorts by date/domain, displays reasons/confidence, handles missing entries. Then full validation commands.
- **Acceptance criteria:** User can inspect decisions and understand why they happened; Audit Dashboard displays decisions only and does not create recommendations.
- **What not to change:** Do not add new decision logic. Do not let audit display mutate plans.

### Phase 12: Implement AI Coach Chat

- **Purpose:** Add a constrained explanatory chat layer over canonical engine outputs and audit trails.
- **Files likely changed:** New chat helper/API/UI files, tests/mocks, prompt constraints.
- **Required tests:** Chat cites engine outputs, refuses to override engines independently, handles missing data, labels uncertainty, avoids hallucinated plans. Then full validation commands.
- **Acceptance criteria:** AI Coach Chat explains decisions and helps the user understand the plan without inventing independent recommendations.
- **What not to change:** Do not make chat the owner of progression, nutrition targets, workout logging, run logging, goal status, or backup.

## 9. Testing Strategy

After each implementation phase, run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Each phase should also include targeted tests for the system changed in that phase. Documentation-only phases should still verify that only the intended documentation file changed.

Required scenario tests across the full architecture:

- **Green readiness day:** User has good sleep, low soreness/stress, high energy, no pain. App should recommend normal training and clear Today's Goals.
- **Red pain day:** User reports significant pain. Readiness should cap red, Training should modify or replace training, Running/Workout should avoid unsafe progression, and explanations should be clear.
- **Missed workout:** Progression/Goal Tracking should account for missed lift and avoid pretending adherence is high.
- **Missed run:** Running/Progression/Goal Tracking should identify impact on endurance/race readiness.
- **Low protein week:** Nutrition adherence should flag protein risk; Progression should reconcile without duplicating nutrition target logic.
- **Calorie overage week:** Nutrition adherence and Goal Tracking should show fat-loss risk and suggested focus.
- **Strong training week:** Performance/Progression should recognize strength/training success without reckless load jumps.
- **Weight plateau:** Goal Tracking should classify fat-loss status correctly using trend context and adherence data.
- **Long run completed:** Running/Goal Tracking should reflect positive endurance progress.
- **Long run missed:** Running/Progression should adjust safely without overcompensating.
- **Sunday body metric prompt:** Home should prompt for measurements/photos on Sunday and route to the correct logging flow.
- **Backup restore round trip:** Export, validate, import/restore, and verify restored state equals expected state.

Testing rules:

- Engine tests should validate deterministic logic with direct inputs.
- UI/model tests should validate screen ownership and button routing where feasible.
- Scenario tests should avoid relying on Apple Health or wearable data.
- Tests must protect against duplicate logging paths, duplicate progression logic, and duplicate nutrition target logic.

## 10. Migration Strategy

Migration should be phased and adapter-safe.

- Keep old wrappers temporarily.
- Each old wrapper must call the new canonical engine.
- Migrate screen by screen.
- Avoid big-bang rewrite.
- Never break existing working flows without replacement.
- Preserve localStorage state shape until migration is explicitly planned.

Practical migration rules:

1. Add/complete canonical engines first.
2. Add compatibility adapters from old state/UI shapes to canonical engine inputs.
3. Move one screen or consumer at a time.
4. Keep tests for both canonical engine output and adapter compatibility.
5. Remove redundant UI paths only after the replacement path is working and tested.
6. Do not change persisted localStorage shape casually. If a state migration is needed, create an explicit migration plan with backup/restore safeguards first.
7. Prefer thin page components that call model builders/engines rather than putting business logic directly in `src/app/page.tsx`.

## 11. Risk Register

| Risk | Why it matters | Mitigation |
|---|---|---|
| Duplicate logic | Conflicting recommendations destroy trust and make bugs hard to trace. | Enforce single engine ownership. Wrappers must route to canonical engines. Add tests that compare consumer outputs to engine outputs. |
| `page.tsx` becoming too large | Current `src/app/page.tsx` already owns substantial UI and orchestration; adding more logic there will make future phases fragile. | Move decision logic into engines/model builders. Keep page components thin. Split UI helpers only when needed and within phase scope. |
| localStorage data loss | One-year self-use requires data survival across browser/session issues. | Implement versioned backup/export/import, local snapshots, validation, restore round trip tests, and clear user instructions. |
| Scan/photo storage fragility | Data URLs/URL fields can be brittle for long-term progress photos and food scans. | Use explicit upload/import from saved pictures, validate stored photo records, include backup coverage, and avoid URL-only progress photo entry. |
| AI hallucination in coach chat | Chat could invent unsafe or conflicting plans. | Constrain AI Coach Chat to explain canonical engine outputs and audit trails. It must not override engines independently. Label uncertainty. |
| Fake precision in physique estimates | Body-fat/muscle estimates from photos can look more accurate than they are. | Label all estimates clearly, include confidence/caveats, prioritize trends over exact numbers, and never let estimates directly own calorie targets. |
| Running injury risk | Aggressive mileage/pace progression can cause injury and derail race prep. | Running Engine owns mileage/progression/injury warnings; red pain and missed-run scenarios must be tested; race-aware phase context should be added later. |
| Calorie target confusion | Multiple macro/calorie target sources create contradictory nutrition advice. | Nutrition Engine is the only owner of targets. Remove/route legacy target logic through canonical target resolution. |
| Conflicting recommendations | Readiness, running, workout, nutrition, and goal systems may disagree. | Progression Engine reconciles weekly cross-domain decisions; Training Engine composes daily sessions without overriding canonical engines; Audit Dashboard explains conflicts. |

## 12. Acceptance Criteria for “100% Functionality”

For this project, 100% functionality without Apple Health means:

- The app is usable for one year of local self-use without major reliability issues.
- Manual data entry works for readiness, nutrition, body metrics, progress photos, workouts, and runs.
- There is no redundant workout/run logging.
- Backup/restore works with validation and a successful round-trip path.
- Engines produce one reconciled recommendation instead of conflicting domain recommendations.
- Home tells the user exactly what to do today.
- Train executes all training, including warm-up, lift/run order, cooldown, rest timers, coach cues, workout/run logging, and post-session summary.
- Progress shows whether results are happening across weight, measurements, photos, nutrition adherence, training adherence, running, strength, performance, and goals.
- Goal Tracking says whether each major goal is on track, at risk, or off track.
- Audit trail explains why decisions were made.
- Nutrition adherence analytics are visualized in Progress.
- Sunday body metrics/photo prompts exist and route to the correct workflow.
- Progress photos are uploaded from saved pictures rather than manually entered URL strings.
- Physique estimates, if present, are labeled as estimates and do not pretend to be precise diagnostics.
- Apple Health/wearable integration is not required for this 100% definition.

## 13. Immediate Next Prompt Recommendation

The next recommended Hermes prompt after this document is:

> Implement Phase 2: Full Progression Engine V1.

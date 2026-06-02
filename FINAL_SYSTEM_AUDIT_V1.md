# FINAL SYSTEM AUDIT V1

Technical audit of the current application as implemented in code after the completed work in this repository. This document describes the system that exists today. It is not an architecture proposal, future-state design, or roadmap.

Verification basis:
- Engine/source files read: `src/lib/readiness-engine.ts`, `src/lib/daily-checkin.ts`, `src/lib/nutrition-engine.ts`, `src/lib/nutrition-ui.ts`, `src/lib/food-ai.ts`, `src/lib/food-ai-api.ts`, `src/lib/running-engine.ts`, `src/lib/run-logger.ts`, `src/lib/workout-engine.ts`, `src/lib/workout-logger.ts`, `src/lib/weekly-review.ts`, `src/lib/progression-engine.ts`, `src/lib/coach-engine.ts`, `src/lib/navigation.ts`, `src/app/page.tsx`, `src/app/api/food-ai/label/route.ts`, `src/app/api/food-ai/photo/route.ts`.
- Architecture docs read: `READINESS_V2_ARCHITECTURE.md`, `NUTRITION_V2_ARCHITECTURE.md`, `RUNNING_ENGINE_V2_ARCHITECTURE.md`, `PROGRESSION_ENGINE_V1_ARCHITECTURE.md`, `WORKOUT_ENGINE_V2_ARCHITECTURE.md`, `SYSTEM_ARCHITECTURE_AUDIT.md`.
- Validation run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` passed with 148 tests, TypeScript, ESLint, and production build all successful.

## 1. Executive Summary

### What currently works

- Readiness V2 is implemented as a canonical engine in `src/lib/readiness-engine.ts` via `evaluateReadiness()` and adapters `readinessInputFromDailyCheckIn()` / `readinessInputFromWeeklyWindow()`.
- Daily check-in readiness and weekly review readiness route through Readiness V2.
- Nutrition V2 engine is implemented in `src/lib/nutrition-engine.ts` with canonical `NutritionTarget`, `MealLog`, macro progress, calorie scoring, macro adherence, confidence, saved food, and backward-compatible wrappers.
- Nutrition UI V2 is implemented in `src/lib/nutrition-ui.ts` and consumed by `NutritionLogger()` in `src/app/page.tsx`.
- Meal logging works for manual meals and saved foods; meals are synced back into legacy `NutritionLog` shape with `syncNutritionLogFromNutritionUiV2Meals()`.
- FOOD_AI_V1 scanner workflow exists in code: UI file upload, API routes, mock/OpenAI provider handling, review draft creation, serving scaling, user confirmation, and confirmed `MealLog` creation.
- Running Engine V2 is implemented as the canonical running engine in `src/lib/running-engine.ts` via `evaluateRunning()`.
- Run logger, daily running recommendation, weekly review running logic, and Progression Engine V1 adapter now consume Running Engine V2 outputs rather than recalculating running progression independently.
- Workout Engine V2 is implemented in `src/lib/workout-engine.ts` via `evaluateWorkout()` with exercise decisions, volume, fatigue, deload, substitutions, PRs, confidence, data quality, explanation, and audit trail.
- Set-by-set coaching and post-workout analysis in `src/lib/coach-engine.ts` consume Workout Engine V2 while preserving legacy UI shapes.
- Workout logger in `src/lib/workout-logger.ts` consumes Workout Engine V2 through an adapter.
- Weekly Review exists in `src/lib/weekly-review.ts` and displays in the Progress screen through `WeeklyReviewPanel()` in `src/app/page.tsx`.
- Primary UI is organized into the five screens in `src/lib/navigation.ts`: Home, Train, Log, Progress, More.

### What is partially implemented

- Progression Engine V1 is only a thin implemented adapter in `src/lib/progression-engine.ts`. It extracts running progression data from Running Engine V2 but does not yet evaluate full cross-domain progression.
- Nutrition target ownership exists in `NutritionTarget`, but most UI consumers still adapt from legacy `MacroTarget` through `legacyMacroTargetToNutritionTarget()` rather than storing date-specific targets as first-class persisted records.
- FOOD_AI_V1 exists, but its default provider is deterministic mock unless environment enables OpenAI. The code supports OpenAI vision, but the current default app behavior is mock-based.
- Recommendation audit trails exist inside Running Engine V2 and Workout Engine V2; they are not yet exposed as a unified user-facing audit history across all domains.
- Apple Health / wearables are represented as settings copy and typed data fields, but there is no implemented HealthKit integration.
- Progress photos are implemented as URL fields in UI state; actual native storage/upload is not wired in this UI.

### What is still architecture only

- Full Progression Engine V1 described in `PROGRESSION_ENGINE_V1_ARCHITECTURE.md` is architecture only except for `progressionRunningInputFromRunningEngineV2()`.
- Full cross-domain progression decisions for training, running, nutrition, body weight, race goals, and physique goals are not implemented as a single canonical engine.
- Production persistence / Supabase wiring is not the active runtime path in the current app UI; settings copy says MVP persists to localStorage and Supabase schema is included for later wiring.
- Wearables / Apple Health integrations are not implemented.
- Native camera capture and image/object storage are not fully implemented as production workflows; image upload uses browser file input and data URLs.

### Biggest remaining gaps

1. No full cross-domain Progression Engine implementation.
2. Nutrition still has a legacy/current split: `NutritionTarget` and `MealLog` are canonical in engine code, but app state still stores `MacroTarget`, `Meal`, and `NutritionLog` for UI compatibility.
3. FOOD_AI_V1 UI has implemented scanner controls, but there is stale UI copy at `src/app/page.tsx` line 703 saying AI scanning is intentionally not enabled yet.
4. Audit trails are per-engine, not consolidated into a product-level recommendation history.
5. Persistence is still localStorage-oriented in active UI; production DB/storage integration is not the primary runtime path.
6. Wearables and Apple Health are not connected.

## 2. Current Sources of Truth

| Domain | Source-of-truth file | Canonical API | Consumers | Adapters / compatibility |
|---|---|---|---|---|
| Readiness | `src/lib/readiness-engine.ts` | `evaluateReadiness(input: ReadinessEngineInput)` | `src/lib/daily-checkin.ts`, `src/lib/weekly-review.ts`, `src/lib/coach-engine.ts` wrapper, `src/app/page.tsx` via legacy wrappers | `readinessInputFromDailyCheckIn()`, `readinessInputFromWeeklyWindow()`, `calculateReadiness()` in `src/lib/coach-engine.ts`, `evaluateDailyRecoveryStatus()` in `src/lib/daily-checkin.ts` |
| Nutrition | `src/lib/nutrition-engine.ts` | `NutritionTarget`, `MealLog`, `calculateDailyNutritionTotals()`, `calculateMacroProgress()`, `calculateMacroAdherence()` | `src/lib/nutrition-ui.ts`, `src/lib/nutrition-logger.ts`, `src/lib/coach-engine.ts`, `src/lib/food-ai.ts`, `src/app/page.tsx` | `legacyMacroTargetToNutritionTarget()`, `nutritionLogToMealLog()`, `nutritionLogsToMealLogs()`, `mealLogToNutritionLog()`, `mealToMealLogForNutritionUiV2()` |
| Running | `src/lib/running-engine.ts` | `evaluateRunning(input: RunningEngineInput)` | `src/lib/run-logger.ts`, `src/lib/weekly-review.ts`, `src/lib/coach-engine.ts`, `src/lib/progression-engine.ts` | `buildRunningEngineInputForRunLogger()`, `buildRunningEngineInputForWeeklyReview()`, `buildRunningEngineInputForRecommendation()`, `runningEngineResultToLegacyRecommendation()`, `legacyDecisionFromRunningAction()` |
| Workout | `src/lib/workout-engine.ts` | `evaluateWorkout(input: WorkoutEngineInput)` | `src/lib/workout-logger.ts`, `src/lib/coach-engine.ts` next-set and post-workout analysis | `buildWorkoutEngineInputFromSession()`, `buildWorkoutEngineInputForWorkoutLogger()`, `buildWorkoutEngineInputForNextSet()`, `workoutEngineResultToCoachDecision()` |
| Progression | `src/lib/progression-engine.ts` | `progressionRunningInputFromRunningEngineV2(result)` only | `src/lib/progression-engine.test.ts` | Thin adapter only; full V1 remains in `PROGRESSION_ENGINE_V1_ARCHITECTURE.md` |

## 3. Readiness Engine Audit

### Actual readiness inputs

Canonical type: `ReadinessEngineInput` in `src/lib/readiness-engine.ts`.

Implemented input fields:
- `date?: string`
- `mode?: "daily" | "weekly"`
- `sleep: number | null`
- `soreness: number | null`
- `stress: number | null`
- `energy: number | null`
- `alcohol: boolean | number | null`
- `pain: boolean | null`
- `painSeverity: number | null`
- `restingHr: number | null`
- `hrv: number | null`
- `baseline?: { restingHr?: number | null; hrv?: number | null }`

Adapters:
- `readinessInputFromDailyCheckIn(checkIn, baseline)` maps `DailyCheckIn` to canonical input.
- `readinessInputFromWeeklyWindow({ checkIns, runPainSeverity, baseline })` averages check-in fields and merges run pain into weekly readiness.

### Actual readiness outputs

Canonical type: `ReadinessEngineResult` in `src/lib/readiness-engine.ts`.

Implemented output fields:
- `score`
- `status`
- `confidence`
- `reasons`
- `reason`
- `recommendation`
- `recommendationType`
- `trainingGuidance`
- `recoveryGuidance`
- `dataQualityWarnings`

### Readiness scoring

Implemented in `evaluateReadiness()`:
- Starts at 100.
- Sleep deductions:
  - `<5h`: -30 red
  - `<6h`: -20 yellow
  - `<7h`: -10 yellow
- Soreness deductions:
  - `>=8`: -25 red
  - `>=6`: -10 yellow
- Stress deductions:
  - `>=8`: -15 red
  - `>=6`: -10 yellow
- Energy deductions:
  - `<=2`: -25 red
  - `<=5`: -10 yellow
- Alcohol:
  - weekly mode: `>=4` alcohol days -20 red; `>=2` alcohol days -10 yellow
  - daily mode: `true` -5 yellow
- Pain:
  - pain without severity: -10 yellow plus data quality warning
  - severity `>=7`: -40 red
  - severity `>=6`: -35 red
  - severity `>=4`: -15 yellow
- Resting HR:
  - if current resting HR is more than baseline + 8: -15 yellow
- HRV:
  - if current HRV is below 80% of baseline: -15 yellow

### Readiness status thresholds

Implemented in `evaluateReadiness()`:
- `redCap` is true when significant pain exists (`pain === true` and `painSeverity >= 6`) or sleep is under 5 and energy is 2 or lower.
- If `redCap` is true, final score is capped at 59.
- Status:
  - `Red` if `redCap` or final score `<60`
  - `Green` if final score `>=80`
  - `Yellow` otherwise

### Confidence scoring

Implemented in `confidenceFor()`:
- Missing any key subjective data (`sleep`, `soreness`, `stress`, `energy`, `pain status`) returns `Low` confidence and data quality warning.
- Missing biometrics (`resting HR`, `HRV`) returns `Medium` confidence and warning.
- Complete subjective + biometric data returns `High` confidence.

### Missing data handling

- Missing subjective data lowers confidence to `Low`; the engine still returns a score and status.
- Missing resting HR / HRV lowers confidence to `Medium`; it does not block scoring.
- Pain without severity creates a data quality warning and a conservative yellow deduction.
- Weekly adapter uses averages and `null` when no values exist.

### Files using readiness

- `src/lib/daily-checkin.ts`: `evaluateDailyRecoveryStatus()` calls `evaluateReadiness(readinessInputFromDailyCheckIn(checkIn))`.
- `src/lib/weekly-review.ts`: `buildWeeklyReviewSummary()` calls `evaluateReadiness(readinessInputFromWeeklyWindow(...))`.
- `src/lib/coach-engine.ts`: `calculateReadiness()` is a wrapper over Readiness V2.
- `src/app/page.tsx`: Home/log UI uses `calculateReadiness()` and `evaluateDailyRecoveryStatus()` wrappers.
- `src/lib/mvp-dashboard.ts`: uses `evaluateDailyRecoveryStatus()`.

### Files still using legacy wrappers

- `src/lib/coach-engine.ts`: `calculateReadiness()` remains as a compatibility wrapper.
- `src/lib/daily-checkin.ts`: `evaluateDailyRecoveryStatus()` remains as compatibility UI API.
- `src/app/page.tsx`: imports and uses those compatibility functions.

## 4. Nutrition Engine Audit

### NutritionTarget source of truth

Canonical type: `NutritionTarget` in `src/lib/nutrition-engine.ts`.

Fields:
- `date`
- `calories`
- `protein`
- `carbs`
- `fat`
- `fiber`
- `water`
- `dayType`
- `source`

Resolution API:
- `getNutritionTargetForDate(date, context)` applies precedence:
  1. `manualOverrides`
  2. `adjustedTargets`
  3. `plannedTargets`
  4. `baseTarget`

Current UI bridge:
- `src/lib/nutrition-ui.ts` creates date-specific targets using `legacyMacroTargetToNutritionTarget(macroTarget, date, "training", "base")`.
- This means the engine has a canonical `NutritionTarget`, but current app state still largely begins from legacy `MacroTarget`.

### MealLog source of truth

Canonical type: `MealLog` in `src/lib/nutrition-engine.ts`.

Fields:
- `id`, `date`, `mealType`, `name`
- `calories`, `protein`, `carbs`, `fat`, `fiber`, `sodium`
- `confidence`
- `source`
- `servings`
- `notes`
- optional `imageUrl`

Sources supported by type:
- `manual`
- `nutrition-label-scan`
- `meal-photo-ai`
- `saved-food`

Current state bridge:
- UI persists meals in legacy `Meal` records and syncs same-day totals back to `NutritionLog` through `syncNutritionLogFromNutritionUiV2Meals()`.
- Existing `NutritionLog` records can be adapted to `MealLog` through `nutritionLogToMealLog()` / `nutritionLogsToMealLogs()`.

### Macro progress calculations

Implemented in `calculateMacroProgress()`:
- Calculates consumed, target, remaining, percent complete for calories, protein, carbs, fat, fiber, water.
- Calories include `overage`.
- Percent complete is capped from 0 to 100.
- `NutritionUiV2Model.progress` exposes six progress bars: calories, protein, carbs, fat, fiber, water.

### Adherence calculations

Implemented in `calculateMacroAdherence()`:
- Builds dates from date range.
- Scores each day using calorie score, protein score, fiber score, logging consistency, confidence quality, and alcohol penalty.
- Daily score formula in `scoreDay()`:
  - calorie score: 35%
  - protein score: 30%
  - fiber score: 15%
  - logging consistency: 10%
  - confidence quality: 10%
  - minus alcohol penalty
- Returns daily, weekly if 7 days, monthly if 30 days, calories, protein, fiber, logging consistency, alcohol days, warnings, confidence.

### Confidence calculations

Implemented in `nutrition-engine.ts`:
- `NutritionConfidence` values: `High`, `Medium`, `Low`.
- `confidenceValue()` maps High = 1, Medium = 0.8, Low = 0.6.
- `confidenceFromValue()` maps average confidence:
  - `>=0.9`: High
  - `>=0.7`: Medium
  - otherwise Low
- `calculateDailyNutritionTotals()` averages meal confidence for a day.
- `calculateMacroAdherence()` averages daily confidence and warns when more than 40% of calories are low confidence.

### Calorie scoring

Implemented in `calculateCalorieScore()`:
- Target <= 0 returns score 0.
- Green range: 90% to 105% of target = 100.
- Lower zero boundary: 75% of target.
- Upper zero boundary: 125% of target.
- Scores decline linearly outside green range.
- Overage warning when consumed calories are `>110%` of target or `<80%` of target.

### Implemented

- Progress bars: `buildNutritionUiV2Model()` and `NutritionLogger()` render calories, protein, carbs, fat, fiber, water.
- Adherence tracking: `calculateMacroAdherence()` plus Today / 7 Day / 30 Day cards in `NutritionLogger()`.
- Meal logging: manual entry via `createMealFromNutritionUiV2ManualEntry()` and UI save path.
- Saved foods: `defaultSavedFoodsForNutritionUiV2` and `createMealFromNutritionUiV2SavedFood()`.
- Nutrition label scan workflow: implemented in `src/app/page.tsx`, `src/lib/food-ai.ts`, `src/lib/food-ai-api.ts`, and `src/app/api/food-ai/label/route.ts`.
- Meal photo scan workflow: implemented in `src/app/page.tsx`, `src/lib/food-ai.ts`, `src/lib/food-ai-api.ts`, and `src/app/api/food-ai/photo/route.ts`.

### Not implemented / not production-complete

- Native camera capture is not implemented; current UI uses browser file upload (`input type="file" accept="image/*"`).
- Production object storage for scan images is not implemented; image data is carried as data URL in UI flow.
- Real AI scan behavior requires environment configuration. Default provider is mock in `handleFoodAiScanRequest()` via `getScanProviderConfig(process.env)`.
- There is stale UI text in `src/app/page.tsx` line 703 stating: `AI scanning is intentionally not enabled yet.` This conflicts with the implemented scanner UI below it.

## 5. Running Engine Audit

### RunningEngineInput

Canonical type: `RunningEngineInput` in `src/lib/running-engine.ts`.

Top-level fields:
- `generatedAt`
- `evaluationDate`
- `race`
- `runLogs`
- `currentWeek`
- `readiness`
- optional `trends`
- optional `userContext`

Run log fields used by the engine:
- `id`, `date`, `runType`, `plannedDistance`, `actualDistance`, `durationMinutes`
- `averagePace`, `averagePaceSecondsPerMile`, `averageHr`, `maxHr`
- `rpe`, `zone2Compliance`, `completed`, `walkBreaks`
- `pain`, `painScore`, `painLocation`, `notes`

### RunningEngineResult

Canonical type: `RunningEngineResult` in `src/lib/running-engine.ts`.

Implemented output groups:
- `fitnessProfile`
- `readiness`
- `progression`
- `goalStatus`
- `prediction`
- `paceZones`
- `currentPredictedFinishTime`
- `currentPredictedPace`
- `targetPaceGap`
- `targetFinishGap`
- `longRunStatus`
- `weeklyMileageStatus`
- aliases: `runningReadiness`, `runningConfidenceScore`, `runningDataQualityScore`
- `confidence`, `confidenceScore`, `dataQualityScore`
- `explanations`
- `auditTrail`

### Race prediction logic

Implemented in `calculatePredictedHalfMarathonTime()`:
- Uses target finish default 118 minutes and target pace default 540 seconds/mile if input omits values.
- Prediction hierarchy:
  1. recent race / time trial: Riegel-style projection with exponent 1.06; High confidence if distance >= 6, otherwise Medium
  2. tempo / threshold: tempo pace + 10 sec/mile; Medium confidence
  3. long run: long-run pace, adjusted faster by 30 sec/mile if long run >= 8 miles; Medium or Low confidence
  4. easy-run adjusted: average easy pace - 60 sec/mile; Low confidence
  5. insufficient data: null prediction
- Returns predicted finish, pace labels, target gaps, basis, and confidence.

### Pace zone logic

Implemented in `calculatePaceZones()`:
- Uses race pace, default 540 sec/mile if absent.
- Zones:
  - Zone 2: race pace +90 to +150 sec/mile
  - Tempo: race pace +20 to +45
  - Threshold: race pace -5 to +15
  - Race Pace: race pace -5 to +5
  - VO2: race pace -45 to -20

### Readiness logic

Implemented in `calculateRunningReadiness()`:
- Starts from readiness input score or status fallback.
- Penalizes score based on injury risk above 45.
- Blocks aggressive progression when injury risk >= 50.
- Severe injury risk >= 70 or Red readiness returns Red.
- Green requires score >= 70 and input readiness not Yellow.
- Confidence comes from input readiness confidence or engine confidence score.

### Injury risk logic

Implemented in `calculateInjuryRisk()`:
- Combines:
  - pain severity and recurring pain: 35%
  - mileage jump: 20%
  - RPE / poor runs: 15%
  - heart-rate / pace drift: 10%
  - readiness status: 10%
  - consistency gap: 10%
- Severe pain and large mileage jumps are heavily weighted.

### Progression logic

Implemented in `chooseProgression()`:
- `Recovery Focus` if max pain >= 7, Red readiness, or injury risk >= 70.
- `Regress` if long run is problem, latest poor runs >= 2, injury risk >= 50, or mileage jump >20% with declining RPE trend.
- `Hold` if long run watch/unknown, Yellow readiness, mileage jump >10%, running consistency <70, data quality <65, or pace trend unknown.
- `Progress` if long run is strong/adequate and above blockers are absent.
- Progress caps weekly mileage to the lower of +10% or +2 miles and long run to +1 mile if current long run >=5 or +0.5 if lower.

### Running Engine V2 consumer migration

Files now routing through `evaluateRunning()`:
- `src/lib/run-logger.ts`: `evaluateRunLoggerResult()` calls `evaluateRunning(buildRunningEngineInputForRunLogger(run))`.
- `src/lib/weekly-review.ts`: `buildWeeklyReviewSummary()` calls `evaluateRunning(buildRunningEngineInputForWeeklyReview(...))`.
- `src/lib/coach-engine.ts`: `generateRunningRecommendation()` builds a Running Engine input and calls `evaluateRunning()`.
- `src/lib/progression-engine.ts`: `progressionRunningInputFromRunningEngineV2()` consumes `RunningEngineResult`.

Files still containing legacy compatibility wrappers:
- `src/lib/run-logger.ts`: maps Running Engine V2 actions to legacy `NextRunDecision` through `legacyDecisionFromRunningAction()`.
- `src/lib/coach-engine.ts`: returns legacy `RunningRecommendation` through `runningEngineResultToLegacyRecommendation()`.
- `src/lib/weekly-review.ts`: maps Running Engine actions to existing weekly recommendation labels (`Progress`, `Repeat`, `Deload`, `Recovery focus`).

## 6. Progression Engine Audit

### Current implementation status

Current implemented file: `src/lib/progression-engine.ts`.

Implemented API:
- `progressionRunningInputFromRunningEngineV2(result: RunningEngineResult)`.

Returned fields:
- `progressionAction`
- `injuryRiskScore`
- `raceReadinessScore`
- `confidenceScore`
- `explanations`

### Current source of truth

- Running progression source of truth is currently Running Engine V2 (`src/lib/running-engine.ts`), not a complete Progression Engine.
- Full cross-domain progression source of truth is not implemented yet.

### What domains are connected

- Connected: Running, through `RunningEngineResult` adapter.

### What domains are not connected

- Not connected in `src/lib/progression-engine.ts`: nutrition, readiness, workout, weight loss, physique goal, race goal scoring, and unified weekly goal progression.

### Implemented / partially implemented / architecture only

- Implemented: thin running adapter from Running Engine V2.
- Partially implemented: integration test proves the adapter consumes Running Engine output.
- Architecture only: full Progression Engine V1 described in `PROGRESSION_ENGINE_V1_ARCHITECTURE.md`.

## 7. Workout System Audit

### Current workout logic

Canonical engine: `src/lib/workout-engine.ts`.

Primary API:
- `evaluateWorkout(input: WorkoutEngineInput): WorkoutEngineResult`

Current workout engine evaluates:
- exercise-level decisions
- muscle group volume
- rolling 4-week volume
- hypertrophy progression
- strength progression
- fatigue
- deload need
- substitutions
- exercise history
- PRs
- confidence and data quality
- explanations and audit trail

### Progression logic

Implemented exercise progression in `exerciseDecisions()`:
- Pain -> `Substitute`
- Severe fatigue -> `Deload`
- Missed reps, poor form, or RPE >= 9 -> `Reduce`
- Clean/easy sets with history -> `Progress`
- Clean sets without sufficient history -> `Repeat`

Overall decision in `overall()`:
- Any substitute -> `Substitute`
- Severe fatigue or excessive volume -> `Deload`
- Majority reduce or high fatigue -> `Reduce`
- Any progress -> `Progress`
- otherwise `Repeat`

### Set-by-set coaching

Implemented in `src/lib/coach-engine.ts`:
- `buildWorkoutEngineInputForNextSet()` adapts a single set into Workout Engine V2 input.
- `generateNextSetRecommendation()` calls `evaluateWorkout()`.
- `workoutEngineResultToCoachDecision()` maps V2 decisions to legacy `CoachDecision` actions:
  - Red readiness or Deload -> `stop`
  - Substitute -> `stop`
  - Reduce, missed reps, poor form, RPE >=9 -> `reduce`
  - Yellow readiness or RPE >7 -> `repeat`
  - Progress -> `increase`

### Post-workout analysis

Implemented in `src/lib/coach-engine.ts`:
- `generatePostWorkoutAnalysis()` calculates completion percentage, exercises completed, total sets/reps, volume, high RPE flags, missed reps, pain flags, poor form flags, best sets.
- It then calls `evaluateWorkout()` and maps `WorkoutExerciseDecision` values to `PostWorkoutRecommendation[]`.
- Coach summary explicitly reports `Workout Engine V2 recommends ...`.

### What is legacy

- UI-facing shapes remain legacy: `WorkoutSession`, `SetLog`, `CoachDecision`, `WorkoutSummary`, `PostWorkoutRecommendation` in `src/lib/types.ts` and consumers.
- `src/lib/coach-engine.ts` still contains older workout-related helpers such as `adjustWorkoutForReadiness()` and `getRecommendedStartingWeight()`.
- `src/lib/workout-logger.ts` preserves the legacy logger result shape while using V2 internally.

### What is V2

- Source-of-truth engine: `src/lib/workout-engine.ts`.
- Workout logger adapter: `src/lib/workout-logger.ts`.
- Next-set coaching adapter: `src/lib/coach-engine.ts`.
- Post-workout analysis adapter: `src/lib/coach-engine.ts`.

### What is not yet migrated

- The UI still renders legacy-compatible state and result objects.
- There is no unified Progression Engine pulling Workout Engine V2 results into cross-domain progression decisions.
- Workout prescription generation still lives in `src/lib/coach-engine.ts` and is not fully replaced by `src/lib/workout-engine.ts`.

## 8. UI Audit

### Home

Current component: `Dashboard()` in `src/app/page.tsx`.

Current data sources:
- `buildHomeCommandCenter()` model from current `AppState`.
- Latest readiness status from `calculateReadiness()` wrapper.
- Macro target from `state.macroTargets`.
- Weight from body metrics / state.

Engines consumed:
- Readiness V2 indirectly through `calculateReadiness()` wrapper.
- Nutrition progress indirectly through home command model.

Legacy code still present:
- Home uses legacy wrapper and model shapes rather than directly rendering `ReadinessEngineResult`.

Missing functionality:
- No detailed audit trail display.
- No wearable live data.

### Train

Current component: `TrainScreen()` delegates to `TrainingPlan` in `src/app/page.tsx`.

Current data sources:
- `AppState`
- selected week/day
- readiness wrapper result
- selected workout and adjusted workout
- running recommendation

Engines consumed:
- Readiness V2 through wrappers.
- Running Engine V2 through `generateRunningRecommendation()` in `src/lib/coach-engine.ts`.
- Workout adjustment still uses `adjustWorkoutForReadiness()` in `src/lib/coach-engine.ts`.

Legacy code still present:
- Training plan still uses legacy workout objects and adjusted workout shape.
- Daily prescription / workout selection logic still lives in `src/lib/coach-engine.ts`.

Missing functionality:
- Does not directly expose Workout Engine V2 audit trail.
- Does not directly expose Running Engine V2 audit trail.

### Log

Current component: `LogScreen()` in `src/app/page.tsx`.

Subsections:
- Daily check-in
- Workout logging
- Run logging
- Nutrition logging
- Body metrics logging

Current data sources:
- `AppState` local state.
- Forms in `src/app/page.tsx`.

Engines consumed:
- Daily check-in: Readiness V2 through `evaluateDailyRecoveryStatus()`.
- Workout logging: Workout Engine V2 through `src/lib/workout-logger.ts`.
- Run logging: Running Engine V2 through `src/lib/run-logger.ts`.
- Nutrition logging: Nutrition V2 through `buildNutritionUiV2Model()`, `syncNutritionLogFromNutritionUiV2Meals()`, and FOOD_AI_V1 helpers.

Legacy code still present:
- Log screen stores records in legacy `AppState` collections (`meals`, `nutritionLogs`, `workoutSessions`, `runLogs`) and uses adapters.
- Nutrition scanner image is stored as data URL during flow, not production file storage.

Missing functionality:
- Wearable auto-import.
- Production persistence as active runtime.
- Stale Nutrition dashboard copy says AI scanning is not enabled even though scanner UI exists.

### Progress

Current component: `ProgressScreen()` in `src/app/page.tsx`.

Subsections:
- Weight trends
- Pace trends / mileage trends
- Weekly review
- Progress photos
- Race countdown
- Adherence metrics

Current data sources:
- `bodyMetrics`
- `runLogs`
- `weeklyReview` from `buildWeeklyReviewSummary()`
- `photos`
- `buildHomeCommandCenter()` for race countdown

Engines consumed:
- Weekly Review consumes Readiness V2 and Running Engine V2.
- Weight trends use `buildWeightTrendDashboard()`.
- Run trends use `calculateRunTrends()`.

Legacy code still present:
- Weekly Review recommendation labels preserve existing product labels.
- Progress photos are URL records, not uploaded/stored files.

Missing functionality:
- Unified goal progress engine.
- Full recommendation audit timeline.
- Apple Health / wearables.

### More

Current component: `MoreScreen()` in `src/app/page.tsx`.

Current data sources:
- `Settings()` and `Onboarding()` using `AppState.user`.

Engines consumed:
- None directly.

Legacy code still present:
- Settings text describes future Apple Health fields and Supabase schema rather than active integrations.

Missing functionality:
- Actual integrations setup UI.
- Active account/database/wearables connection state beyond static copy.

## 9. Feature Completion Matrix

| Feature | Status | Percent Complete |
|---|---:|---:|
| Readiness Engine | Implemented | 90% |
| Nutrition Engine | Implemented | 80% |
| Running Engine | Implemented | 90% |
| Workout Engine | Implemented | 85% |
| Progression Engine | Partial | 15% |
| Macro Dashboard | Implemented | 85% |
| Meal Logging | Implemented | 85% |
| Nutrition Label Scan | Partial | 70% |
| Meal Photo AI | Partial | 65% |
| Race Prediction | Implemented | 80% |
| Pace Zones | Implemented | 90% |
| Recommendation Audit Trail | Partial | 45% |
| Goal Tracking | Partial | 50% |
| Wearables | Architecture Only | 10% |
| Apple Health | Not Started | 0% |
| Weekly Review | Implemented | 85% |
| Saved Foods | Implemented | 75% |
| Progress Photos | Partial | 35% |
| Production persistence | Partial | 30% |

## 10. Stress Testing Checklist

### Readiness

- [ ] Green day: sleep >=7, low soreness, low stress, high energy, no pain.
- [ ] Yellow day from sleep 6-7 hours.
- [ ] Yellow day from soreness >=6.
- [ ] Yellow day from stress >=6.
- [ ] Yellow day from energy <=5.
- [ ] Red day from pain severity >=7.
- [ ] Red cap from pain severity >=6 even with otherwise good markers.
- [ ] Red day from sleep <5 and energy <=2.
- [ ] Missing HRV/resting HR produces Medium confidence but still returns score.
- [ ] Missing subjective field produces Low confidence warning.

### Weight loss

- [ ] Add body metrics across multiple dates and verify 7-day / 14-day averages.
- [ ] Verify under-200 progress bar from 233 lb to 199.9 lb.
- [ ] Test weight increase week and confirm tone/warnings.
- [ ] Test fewer than 7 entries and fewer than 14 entries.

### Macro adherence

- [ ] Log a day within 90-105% calorie target and verify calorie adherence.
- [ ] Log under 80% target and verify warning.
- [ ] Log over 110% target and verify warning.
- [ ] Log low protein and verify protein adherence drop.
- [ ] Log alcohol and verify adherence penalty.
- [ ] Verify Today, 7 Day, and 30 Day cards.

### Workout progression

- [ ] Clean sets at RPE <=7 and prior history -> Progress.
- [ ] Clean sets at RPE 8 -> Repeat/hold as appropriate.
- [ ] RPE >=9 -> Reduce.
- [ ] Missed reps -> Reduce.
- [ ] Poor form -> Reduce.
- [ ] Pain -> Substitute/stop.
- [ ] Red readiness -> stop/deload.
- [ ] Excessive volume -> Deload.

### Running progression

- [ ] Clean long run, Green readiness, low injury risk -> Progress.
- [ ] Yellow readiness -> Hold.
- [ ] Missed long run -> Hold/Repeat in weekly review.
- [ ] Pain score >=7 -> Recovery Focus.
- [ ] Two poor recent runs -> Regress.
- [ ] Mileage jump >10% -> Hold.
- [ ] Mileage jump >20% plus bad trend -> Regress.

### Race prediction

- [ ] Recent race/time trial >=3 miles produces recent-race basis.
- [ ] Tempo run produces tempo basis.
- [ ] Long run produces long-run basis.
- [ ] Easy runs only produce easy-run-adjusted basis.
- [ ] No useful runs produces insufficient-data basis.
- [ ] Verify target pace gap and target finish gap display.

### Recovery focus

- [ ] High pain in daily check-in blocks heavy training.
- [ ] High pain in run log forces Running Engine Recovery Focus.
- [ ] Weekly review maps Running Engine Recovery Focus to `Recovery focus`.

### Deload scenarios

- [ ] Red weekly readiness recommends Deload.
- [ ] Workout Engine severe fatigue recommends Deload.
- [ ] Running Engine Regress maps to weekly Deload.

### Missed workout scenarios

- [ ] No completed workout sessions lowers lifts completed.
- [ ] Weekly review with low lifts and otherwise good running repeats instead of progressing.

### Missed run scenarios

- [ ] No long run in window sets long run completed to No.
- [ ] Long run with <90% planned distance triggers watch/problem.
- [ ] Weekly review repeats when long run is missed.

### Pain scenarios

- [ ] Check-in pain severity 4 creates pain flag and readiness warning.
- [ ] Run pain score 4 creates pain flag.
- [ ] Run pain score 7 creates Recovery Focus.
- [ ] Workout set pain triggers Substitute.

### Nutrition edge cases

- [ ] Manual meal with zero calories does not crash progress/adherence.
- [ ] Saved food with fractional servings scales macros.
- [ ] Label scan with servings eaten >1 scales totals once.
- [ ] Meal photo scan remains Medium confidence after confirmation.
- [ ] Label scan becomes High confidence only after confirmation.
- [ ] Existing `NutritionLog` with no `Meal` adapts into a legacy meal log.

### Data quality edge cases

- [ ] Running with no runs returns low/unknown prediction but no crash.
- [ ] Workout with missing catalog lowers data quality.
- [ ] Readiness missing biometrics lowers confidence but remains usable.
- [ ] Nutrition low-confidence calories over 40% creates warning.
- [ ] FOOD_AI_V1 OpenAI provider failure returns API error, not saved meal.

## 11. Known Technical Debt

- Legacy readiness wrappers remain: `calculateReadiness()` and `evaluateDailyRecoveryStatus()`.
- Legacy running recommendation wrappers remain: `runningEngineResultToLegacyRecommendation()` and `legacyDecisionFromRunningAction()`.
- Legacy workout UI shapes remain: `CoachDecision`, `WorkoutSummary`, `PostWorkoutRecommendation`.
- Nutrition V2 still adapts from `MacroTarget`, `Meal`, and `NutritionLog` rather than persisting only canonical `NutritionTarget` and `MealLog`.
- `syncNutritionLogFromNutritionUiV2Meals()` maintains duplicated nutrition totals in `NutritionLog` for compatibility.
- `src/app/page.tsx` line 703 contains stale copy saying AI scanning is not enabled while scanner UI/API are implemented.
- FOOD_AI_V1 defaults to mock provider; real OpenAI scan requires environment setup.
- Image scan data is handled as data URL, not durable storage URL.
- `Progression Engine V1` is mostly architecture-only.
- Running and Workout audit trails are engine-local and not surfaced in a unified UI.
- Supabase/production persistence is not active runtime according to current settings copy.
- Apple Health/wearables are only described as future fields in settings.
- `src/lib/coach-engine.ts` remains large and owns many compatibility responsibilities across readiness, nutrition, running, and workout.
- UI file `src/app/page.tsx` contains many screen implementations in one file, making consumer ownership hard to isolate.

## 12. Final Verdict

### Is the app ready for user testing?

Yes, for controlled user testing of the local MVP. The app builds successfully, 148 tests pass, and the main implemented workflows are present: readiness, daily check-in, training plan, workout logging, run logging, Nutrition UI V2, saved foods, FOOD_AI_V1 scanner review/confirm flow, body metrics, weekly review, and progress views.

### Is the app ready for self-use?

Yes, for self-use with known limitations. It is usable as a daily local coach/logging app if the user accepts:
- localStorage-oriented persistence,
- adapter/legacy layers,
- mock FOOD_AI_V1 by default unless OpenAI env is configured,
- no Apple Health/wearable import,
- no production image storage.

### What percentage complete is the overall vision?

Current estimated completion of the final product vision: **72%**.

Reasoning:
- Core coaching engines are largely implemented for readiness, nutrition, running, and workout.
- Weekly review and daily UI workflows are implemented.
- Major remaining vision pieces are cross-domain progression, production persistence, unified audit trail, wearables/Apple Health, durable scan/photo storage, and cleanup of legacy compatibility layers.

### Highest ROI next builds

1. Implement full Progression Engine V1 in `src/lib/progression-engine.ts` so weekly progression, nutrition adjustment, workout progression, running progression, and goal status have one cross-domain source of truth.
2. Add unified recommendation audit trail UI fed by Running Engine V2, Workout Engine V2, Readiness V2, Nutrition V2, and future Progression Engine V1.
3. Clean up stale Nutrition UI copy and make FOOD_AI_V1 provider state explicit: mock vs OpenAI.
4. Promote `NutritionTarget` and `MealLog` from adapter-only canonical types to first-class persisted state, reducing duplicate `Meal` / `NutritionLog` calculations.
5. Wire durable persistence and backup/restore path before heavier daily use.
6. Add Apple Health / wearable imports for sleep, HRV, resting HR, runs, steps, and workouts.
7. Split `src/app/page.tsx` into screen components to reduce UI coupling and make migrations easier.

## Current estimated completion percentage of final product vision

**72% complete.**

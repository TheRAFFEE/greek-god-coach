# PROGRESSION ENGINE IMPLEMENTATION AUDIT

## 1. Executive Summary

**Is Progression Engine currently the canonical progression authority?**

**Answer: Partially.**

Based on current implemented code, `src/lib/progression-engine.ts` now contains a real canonical cross-domain weekly progression evaluator via `evaluateProgression(input: ProgressionEngineInput): ProgressionEngineResult`. It owns the final weekly decision labels:

- `Progress`
- `Repeat`
- `Deload`
- `Recovery Focus`

It also owns a cross-domain nutrition adjustment decision, goal-status classifications, confidence, data-quality assessment, reasons, warnings, and audit entries.

However, the implementation is only **partially** the single progression authority across the full app because several other current files still contain domain-level or legacy progression paths:

- `src/lib/running-engine.ts` still owns running-specific progression actions through `chooseProgression()`.
- `src/lib/workout-engine.ts` still owns workout/exercise progression through `exerciseDecisions()` and `overall()`.
- `src/lib/coach-engine.ts` still contains legacy helper logic including `recommendMacroAdjustment()`, `recommendWorkoutAdjustment()`, `recommendProgression()`, `generateWeeklyReview()`, and daily prescription logic.
- `src/lib/run-logger.ts` and `src/lib/workout-logger.ts` map canonical engine decisions into legacy UI shapes.
- `src/app/page.tsx` consumes Weekly Review indirectly, but Home and Train do not directly consume Progression Engine output.

The most important finding is that **Weekly Review now routes its final next-week recommendation through `evaluateProgression()`**, but the app still has meaningful technical debt in legacy compatibility helpers and domain-specific progression engines. The Progression Engine is implemented, but it is not yet universally consumed by Home, Train, or all planning paths.

---

## 2. Progression Decision Ownership

### Progress

- **File:** `src/lib/progression-engine.ts`
- **Function:** `evaluateWeeklyDecision()`
- **Source of truth:** Progression Engine for the cross-domain weekly decision.
- **Implemented condition:** Returns `Progress` when running action is `Progress`, workout decision allows progress (`Progress` or `Repeat`), macro adherence is at least 80, and confidence is `High` or `Medium`.
- **Consumers:** `evaluateProgression()` returns this as `weeklyDecision`; `src/lib/weekly-review.ts` maps it to `nextWeekRecommendation`.

Other occurrences:

- `src/lib/running-engine.ts`, `chooseProgression()` returns running-specific `Progress`.
  - Classification: **domain signal**, not the app-wide weekly source of truth.
- `src/lib/workout-engine.ts`, `exerciseDecisions()` and `overall()` return workout-specific `Progress`.
  - Classification: **domain signal**, not the app-wide weekly source of truth.
- `src/lib/coach-engine.ts`, `recommendProgression()` returns exercise next-weight text.
  - Classification: **technical debt / duplicate exercise progression helper** because Workout Engine V2 now owns this domain.
- `src/lib/coach-engine.ts`, `generatePostWorkoutAnalysis()` maps Workout Engine decisions into post-workout recommendations.
  - Classification: **compatibility adapter**.

### Repeat

- **File:** `src/lib/progression-engine.ts`
- **Function:** `evaluateWeeklyDecision()`
- **Source of truth:** Progression Engine for the cross-domain weekly decision.
- **Implemented conditions:** Returns `Repeat` for low adherence, missed long run, stalled strength, poor data quality, Yellow readiness with major recovery warning, or otherwise conservative fallback when progress gates are not met.

Other occurrences:

- `src/lib/workout-engine.ts`, `exerciseDecisions()` and `overall()` return workout-specific `Repeat`.
  - Classification: **domain signal**.
- `src/lib/run-logger.ts`, `legacyDecisionFromRunningAction()` maps Running Engine `Hold` to legacy `repeat`.
  - Classification: **harmless compatibility wrapper**.
- `src/lib/workout-logger.ts`, `workoutEngineDecisionToLegacyAction()` maps Workout Engine `Repeat` to legacy `repeat`.
  - Classification: **harmless compatibility wrapper**.
- `src/lib/coach-engine.ts`, next-set and post-workout mapping can emit repeat-oriented messages.
  - Classification: mostly **compatibility adapter**, with some **technical debt** in older helper logic.

### Deload

- **File:** `src/lib/progression-engine.ts`
- **Function:** `evaluateWeeklyDecision()`
- **Source of truth:** Progression Engine for the cross-domain weekly decision.
- **Implemented conditions:** Returns `Deload` for high/severe weekly fatigue, worsening or poor recovery trend, workout high/severe fatigue, or multiple failed workouts.

Other occurrences:

- `src/lib/workout-engine.ts`, `exerciseDecisions()` and `overall()` produce workout-specific `Deload`; `evaluateWorkout()` produces `deload` detail.
  - Classification: **domain signal** and canonical Workout Engine ownership.
- `src/lib/run-logger.ts`, Running Engine non-progress actions can map to legacy `deload`.
  - Classification: **compatibility wrapper**, though label compression from running `Regress`/`Recovery Focus` into `deload` can be confusing.
- `src/lib/workout-logger.ts`, Workout Engine `Deload` maps to legacy `reduce-volume`.
  - Classification: **compatibility wrapper**.
- `src/lib/coach-engine.ts`, set guidance and post-workout analysis map Workout Engine `Deload` to stop/reduce-volume copy.
  - Classification: **compatibility adapter**.

### Recovery Focus

- **File:** `src/lib/progression-engine.ts`
- **Function:** `evaluateWeeklyDecision()`
- **Source of truth:** Progression Engine for the cross-domain weekly decision.
- **Implemented conditions:** Returns `Recovery Focus` immediately when readiness is `Red`, running injury risk is `>= 70`, or Workout Engine overall decision is `Deload`.

Other occurrences:

- `src/lib/running-engine.ts`, `chooseProgression()` returns running-specific `Recovery Focus` for max pain >= 7, Red readiness, or injury risk >= 70.
  - Classification: **domain signal**.
- `src/lib/run-logger.ts`, legacy output copy maps Running Engine `Recovery Focus` into recovery/deload wording.
  - Classification: **compatibility wrapper**.
- `src/lib/coach-engine.ts`, daily prescription uses Red readiness to choose recovery replacement.
  - Classification: **daily training safety logic**, but a future Training Engine should own this composition.

### Duplicate decision logic conclusion

There is no longer duplicate final Weekly Review decision logic after Phase 2. Weekly Review builds a Progression Engine input and delegates the final next-week recommendation to `evaluateProgression()`.

There are still duplicate or overlapping progression-like paths outside Progression Engine:

- Acceptable domain ownership: Running Engine and Workout Engine produce domain progression signals.
- Compatibility wrappers: run/workout loggers and UI mappers translate domain outputs to legacy shapes.
- Technical debt: old helper functions in `src/lib/coach-engine.ts` still contain independent nutrition, workout, exercise, and weekly recommendation logic that should be retired or routed in future phases.

---

## 3. Weekly Review Audit

### Complete current flow

```text
src/app/page.tsx
  -> useMemo() builds weeklyReview
  -> buildWeeklyReviewSummary(state, { startDate, endDate })

src/lib/weekly-review.ts
  -> buildWeeklyReviewSummary()
  -> filters AppState into weekly window
  -> computes checkIns, nutritionLogs, bodyMetrics, runLogs, workoutSessions
  -> evaluates weekly readiness with evaluateReadiness(readinessInputFromWeeklyWindow(...))
  -> evaluates running with evaluateRunning(buildRunningEngineInputForWeeklyReview(...))
  -> computes adherence/lifts/miles/long-run helper metrics
  -> chooseRecommendation(...)

src/lib/weekly-review.ts
  -> chooseRecommendation()
  -> builds ProgressionEngineInput
  -> calls evaluateProgression(progressionInput)

src/lib/progression-engine.ts
  -> evaluateProgression()
  -> evaluateDataQuality()
  -> evaluateConfidence()
  -> evaluateWeeklyDecision()
  -> evaluateNutritionDecision()
  -> fatLossStatus()
  -> halfMarathonStatus()
  -> strengthStatus()
  -> physiqueStatus()
  -> returns ProgressionEngineResult

src/lib/weekly-review.ts
  -> maps progression.weeklyDecision
     - "Recovery Focus" -> "Recovery focus"
     - otherwise unchanged
  -> returns nextWeekRecommendation and recommendationReason

src/app/page.tsx
  -> ProgressScreen receives weeklyReview
  -> WeeklyReviewPanel displays review.nextWeekRecommendation and review.recommendationReason
```

### Does Weekly Review independently decide progression anywhere?

**No for the final next-week recommendation.**

Current `src/lib/weekly-review.ts` does not independently select the final `Progress` / `Repeat` / `Deload` / `Recovery focus` recommendation. It calls `evaluateProgression()` in `chooseRecommendation()` and maps the returned `weeklyDecision` to the existing UI label.

### Important caveat

`src/lib/weekly-review.ts` still builds proxy inputs before calling Progression Engine. In `chooseRecommendation()` it synthesizes a `workoutResult` from weekly lift count:

- `overallDecision: input.liftsCompleted >= 3 ? "Progress" : "Repeat"`
- `strengthProgression.action: input.liftsCompleted >= 3 ? "Progress" : "Repeat"`
- `hypertrophyProgression.action: input.liftsCompleted >= 3 ? "Progress" : "Repeat"`

This is not the final weekly decision, but it is an adapter-level approximation because Weekly Review does not yet receive a full canonical weekly Workout Engine result.

Classification: **technical debt / integration gap**, not final duplicate weekly-decision ownership.

---

## 4. Running Engine Audit

### Does Running Engine still decide progression?

**Yes, but only for the running domain.**

`src/lib/running-engine.ts` owns running-specific progression through:

- **Function:** `chooseProgression()`
- **Return type:** `RunningProgressionDecision`
- **Actions:** `Progress`, `Hold`, `Regress`, `Recovery Focus`

This is consistent with the architecture rule that Running Engine owns running prediction, pace zones, running progression, and injury risk. It should not be considered duplicate cross-domain weekly logic as long as Progression Engine consumes it as a signal.

### Running Engine outputs consumed by Progression Engine

Current `ProgressionEngineInput.runningResult` shape in `src/lib/progression-engine.ts` consumes these fields:

- `progression.action`
- `progression.reason`
- `readiness.injuryRiskScore`
- `readiness.raceReadinessScore`
- `prediction.targetFinishGapMinutes`
- `prediction.targetPaceGapSecondsPerMile`
- `confidence`
- `confidenceScore`
- `dataQualityScore`
- `explanations[].summary`

Actual usage in Progression Engine:

- **Progression action:** Used in `evaluateWeeklyDecision()` to gate `Progress`; `Progress` is required for cross-domain weekly `Progress`.
- **Injury risk:** Used in `evaluateWeeklyDecision()`; `injuryRiskScore >= 70` forces `Recovery Focus`.
- **Race readiness score:** Used in `halfMarathonStatus()` to classify Half Marathon goal status.
- **Target finish gap / pace gap:** Used in `halfMarathonStatus()` to identify race risk.
- **Confidence / confidenceScore:** Used in `evaluateConfidence()`.
- **Data quality score:** Used in `evaluateDataQuality()`.
- **Explanations:** Used in `evaluateDataQuality()` as a signal that running explanations exist.

### Verdict

Running Engine still decides running progression, but Progression Engine now consumes that output to decide the broader weekly plan. This is correct domain ownership, not duplicate app-wide progression ownership.

---

## 5. Workout Engine Audit

### Does Workout Engine still independently decide weekly progression?

**No for cross-domain weekly progression. Yes for workout/exercise progression.**

`src/lib/workout-engine.ts` owns workout-level and exercise-level decisions through:

- `exerciseDecisions()`
- `overall()`
- `evaluateWorkout()`

Workout Engine outputs decisions such as:

- `Progress`
- `Repeat`
- `Reduce`
- `Deload`
- `Substitute`

Those are canonical for workout execution, set/exercise guidance, fatigue, deload, and substitutions. They are not the final app-wide weekly decision.

### Workout outputs consumed by Progression Engine

Current `ProgressionEngineInput.workoutResult` shape consumes:

- `overallDecision`
- `strengthProgression.action`
- `strengthProgression.exercisesProgressing`
- `strengthProgression.exercisesStalled`
- `strengthProgression.exercisesRegressing`
- `hypertrophyProgression.action`
- `fatigue.systemicFatigueScore`
- `fatigue.fatigueStatus`
- `prs.newPrs`
- `confidenceScore`
- `dataQualityScore`
- `explanation.summary`

Actual usage in Progression Engine:

- `overallDecision === "Deload"` forces weekly `Recovery Focus`.
- `overallDecision` of `Progress` or `Repeat` can allow weekly `Progress` if all other domains are clean.
- `fatigue.fatigueStatus` of `high` or `severe` contributes to weekly `Deload`.
- `strengthProgression.action`, stalled/regressing exercise lists, and `weeklyReviewMetrics.strengthProgressStalled` affect `Repeat`, `Strength` goal status, and `Physique` goal status.
- `prs.newPrs` supports `Strength` goal status.
- `confidenceScore` and `dataQualityScore` influence Progression Engine confidence/data quality.
- `explanation.summary` is included as data-quality support.

### Verdict

Workout Engine is still the canonical owner of workout progression. Progression Engine consumes its output for weekly reconciliation. The major gap is that Weekly Review currently sends a proxy workout result derived from lift count, not a true weekly `evaluateWorkout()` aggregate.

---

## 6. Nutrition Audit

### What nutrition metrics currently influence Progression Engine?

Current `ProgressionEngineInput.nutritionResult` is a partial `MacroAdherenceSummary` plus optional compatibility fields.

Actual implemented nutrition fields available to Progression Engine:

- `macroAdherence`
- `dailyAdherence`
- `weeklyAdherence`
- `caloriesAdherence`
- `proteinAdherence`
- `fiberAdherence`
- `loggingConsistency`
- `alcoholDays`
- `calorieOverageWarning`
- `confidence`
- `warnings`

Actual usage:

- `macroAdherence()` helper chooses `macroAdherence`, then `weeklyAdherence`, then `dailyAdherence`, defaulting to 0.
- `evaluateWeeklyDecision()` uses macro adherence:
  - `< 70` contributes to `Repeat`.
  - `>= 80` is required for weekly `Progress`.
- `evaluateNutritionDecision()` uses:
  - `weeklyReviewMetrics.weeksFatLossBelowMinimum`
  - macro adherence `>= 85`
  - `weeklyReviewMetrics.weightLossRate`
  - `isRecoveryWorsening()`
  - returns `Reduce Calories`, `Increase Calories`, or `Maintain Calories`.
- `evaluateDataQuality()` uses presence of nutrition result and nutrition warnings.
- `evaluateConfidence()` uses nutrition confidence.
- `fatLossStatus()` uses macro adherence and weight loss metrics.
- `physiqueStatus()` uses macro adherence and strength/weight trend.

### Weekly Review nutrition input builder

`src/lib/weekly-review.ts` currently builds Progression Engine nutrition input from legacy `NutritionLog[]`:

- Calculates calorie adherence from average percent error against a hard-coded `2550` calorie target.
- Calculates protein adherence from average protein against a hard-coded `220g` target.
- Computes `macroAdherence` as the rounded average of calorie and protein adherence.
- Supplies `loggingConsistency` from nutrition log count in the window.
- Supplies `alcoholDays` from nutrition logs.
- Supplies `confidence: "Medium"`.
- Supplies warnings when no nutrition logs exist.

### Verdict

Nutrition affects Progression Engine materially, especially adherence and calorie decisions. But the Weekly Review adapter still builds nutrition inputs from legacy `NutritionLog` data and hard-coded targets instead of a persisted canonical Nutrition V2 weekly result. That is an integration gap, not a failure of Progression Engine itself.

---

## 7. Readiness Audit

### Readiness V2 outputs that influence Progression Engine

Current `ProgressionEngineInput.readinessResult` consumes:

- `status`
- `score`
- `confidence`
- `reason`
- `reasons`
- `dataQualityWarnings`

Actual usage:

- `status === "Red"` in `evaluateWeeklyDecision()` forces `Recovery Focus`.
- `status === "Yellow"` plus major recovery warning contributes to `Repeat`.
- `score` influences `evaluateConfidence()` when score is missing? Specifically, the score is required as a presence signal; missing score reduces confidence.
- `confidence` is converted by `confidenceScore()` and influences overall Progression Engine confidence.
- `reason` / `reasons` are not deeply parsed for scoring, but the readiness presence and warnings affect data quality.
- `dataQualityWarnings` reduce Progression Engine data quality.

### Weekly Review readiness input path

`src/lib/weekly-review.ts` builds weekly readiness through:

```text
readinessInputFromWeeklyWindow({ checkIns, runPainSeverity })
  -> evaluateReadiness(...)
  -> weeklyReadiness
  -> chooseRecommendation(...)
  -> ProgressionEngineInput.readinessResult
  -> evaluateProgression(...)
```

### Verdict

Readiness V2 is an actual input to Progression Engine. Red readiness is a hard safety override. Yellow readiness is softer and affects repeat decisions when paired with major warning conditions.

---

## 8. Remaining Duplicate Logic

Search basis: current source files under `src`, including requested files and broad searches for `evaluateProgression`, `chooseProgression`, `chooseRecommendation`, `generateWeeklyReview`, `recommendProgression`, `Progress`, `Repeat`, `Deload`, and `Recovery Focus`.

### 1. `src/lib/running-engine.ts` — `chooseProgression()`

- **Decision labels:** `Progress`, `Hold`, `Regress`, `Recovery Focus`
- **Reason it exists:** Running Engine owns running progression and injury-risk-aware mileage/long-run decisions.
- **Classification:** **harmless domain engine signal**.
- **Bug risk:** Low, as long as app-wide weekly progression remains owned by Progression Engine.

### 2. `src/lib/workout-engine.ts` — `exerciseDecisions()` and `overall()`

- **Decision labels:** `Progress`, `Repeat`, `Reduce`, `Deload`, `Substitute`
- **Reason it exists:** Workout Engine owns exercise/set/workout progression, deload, substitutions, fatigue, and PR guidance.
- **Classification:** **harmless domain engine signal**.
- **Bug risk:** Low to medium; the same words overlap with weekly progression labels, but ownership is clear in code when consumed through Progression Engine.

### 3. `src/lib/weekly-review.ts` — `chooseRecommendation()` input proxy

- **Decision labels:** proxy workout `Progress` / `Repeat`; final mapping from Progression Engine `Recovery Focus` to UI `Recovery focus`.
- **Reason it exists:** Weekly Review builds a compatibility `ProgressionEngineInput` from current legacy AppState and existing Weekly Review metrics.
- **Classification:** **technical debt / integration gap**.
- **Bug risk:** Medium; synthesized workout result can underrepresent true Workout Engine state until a canonical weekly workout result is wired in.

### 4. `src/lib/run-logger.ts` — `legacyDecisionFromRunningAction()` and `evaluateRunLoggerResult()` copy

- **Decision labels:** legacy `progress`, `repeat`, `deload`, recovery/deload copy.
- **Reason it exists:** Preserves old run logger output shape while consuming Running Engine V2.
- **Classification:** **harmless compatibility wrapper**.
- **Bug risk:** Low to medium; label compression can blur the distinction between Running Engine `Regress` and `Recovery Focus`.

### 5. `src/lib/workout-logger.ts` — `workoutEngineDecisionToLegacyAction()` and logger recommendation mapping

- **Decision labels:** legacy `progress`, `repeat`, `reduce-volume`, `substitute`.
- **Reason it exists:** Preserves old workout logger result shape while consuming Workout Engine V2.
- **Classification:** **harmless compatibility wrapper**.
- **Bug risk:** Low; output reason names Workout Engine V2.

### 6. `src/lib/coach-engine.ts` — `recommendProgression()`

- **Decision labels / behavior:** independently calculates next exercise weight/recommendation from exercise log completion, RPE, pain, and previous weight.
- **Reason it exists:** Older exercise progression helper predating full Workout Engine V2 migration.
- **Classification:** **duplicate logic / technical debt**.
- **Bug risk:** Medium to high if any active UI path still calls it or future code uses it instead of Workout Engine V2.

### 7. `src/lib/coach-engine.ts` — `recommendMacroAdjustment()`

- **Decision labels / behavior:** independently recommends calorie changes: improve adherence first, reduce calories, increase calories, move carbs, refeed, keep calories.
- **Reason it exists:** Older daily prescription nutrition helper.
- **Classification:** **duplicate nutrition/progression-adjacent logic** relative to Progression Engine nutrition decision and Nutrition Engine ownership.
- **Bug risk:** Medium; daily prescriptions can differ from Progression Engine weekly nutrition decisions.

### 8. `src/lib/coach-engine.ts` — `recommendWorkoutAdjustment()` / `adjustWorkoutForReadiness()` / `generateDailyPrescription()`

- **Decision labels / behavior:** chooses recovery replacement, modified workout, full workout, reductions, substitutions, cardio recommendation, and nutrition target wording from readiness, pain, and running recommendation.
- **Reason it exists:** Current daily prescription/training composition before a canonical Training Engine exists.
- **Classification:** **technical debt / migration bridge**.
- **Bug risk:** Medium; future Training Engine should absorb this composition and consume canonical engine outputs.

### 9. `src/lib/coach-engine.ts` — `generateWeeklyReview()`

- **Decision labels / behavior:** returns a legacy `WeeklyReview.recommendation` using independent nutrition/weight/fatigue/strength rules.
- **Reason it exists:** Older coach-engine weekly review API.
- **Classification:** **duplicate logic / technical debt**.
- **Bug risk:** High if still used by UI or future code. Current `src/app/page.tsx` uses `buildWeeklyReviewSummary()` from `src/lib/weekly-review.ts`, not this function, but the function remains in code.

### 10. `src/lib/mvp-dashboard.ts` — `currentPlanRecommendation`

- **Decision labels:** `Progress`, `Repeat`, `Deload`, `Recovery focus`
- **Reason it exists:** Dashboard model exposes Weekly Review output.
- **Classification:** **indirect consumer**, not duplicate logic.
- **Bug risk:** Low.

### 11. `src/app/page.tsx` — `WeeklyReviewPanel()` recommendation tone

- **Decision labels:** reads `review.nextWeekRecommendation` and maps tone.
- **Reason it exists:** UI display.
- **Classification:** **display logic only**.
- **Bug risk:** Low.

---

## 9. Consumer Map

### Weekly Review

- **Status:** **Direct consumer**.
- **Files/functions:** `src/lib/weekly-review.ts`, `chooseRecommendation()` calls `evaluateProgression()`.
- **Notes:** Final next-week recommendation comes from Progression Engine. Input builder still has adapter/proxy debt.

### Home

- **Status:** **Indirect consumer / partially connected**.
- **Files/functions:** `src/app/page.tsx` builds `weeklyReview`; `src/lib/mvp-dashboard.ts` uses `buildWeeklyReviewSummary()` for `currentPlanRecommendation`.
- **Notes:** Home does not directly call `evaluateProgression()` and current Home command center appears driven by daily prescription/readiness/running recommendation rather than Progression Engine as a first-class source.

### Train

- **Status:** **Not connected for Progression Engine; connected to domain engines.**
- **Files/functions:** `src/app/page.tsx` `TrainScreen()` / `TrainingPlan()` use readiness, adjusted workout, and running recommendation; `coach-engine.ts` uses Running/Workout engines.
- **Notes:** Train does not consume Progression Engine weekly output directly.

### Progress

- **Status:** **Indirect consumer**.
- **Files/functions:** `src/app/page.tsx`, `ProgressScreen()` receives `weeklyReview`; `WeeklyReviewPanel()` displays `nextWeekRecommendation` and reason.
- **Notes:** Progress displays the Progression Engine result only through Weekly Review, not as a rich canonical Progression Engine audit/result model.

### Log

- **Status:** **Not connected**.
- **Files/functions:** `src/app/page.tsx`, `LogScreen()`; `run-logger.ts`; `workout-logger.ts`; nutrition/check-in loggers.
- **Notes:** Log mutates source data that eventually informs Weekly Review/Progression, but does not consume Progression Engine.

### Other current consumers

- **`src/lib/mvp-dashboard.ts`:** indirect consumer through Weekly Review.
- **Tests:** `src/lib/progression-engine.test.ts` directly tests `evaluateProgression()` and adapter compatibility.

---

## 10. Remaining Integration Gaps

### 1. Home does not directly use Progression Engine as mission-control input

- **Files:** `src/app/page.tsx`, `src/lib/home-command-center.ts`, `src/lib/mvp-dashboard.ts`
- **Gap:** Home should eventually show Today's Goals and goal status using canonical Progression/Goal Tracking outputs. Current Home uses daily prescription and home command models, with weekly review only indirectly available.

### 2. Train does not consume Progression Engine or a Training Engine

- **Files:** `src/app/page.tsx`, `src/lib/coach-engine.ts`
- **Gap:** Train currently uses legacy workout/readiness/running recommendation composition. There is no canonical Training Engine to order lift + run + warm-up + cooldown using Progression context.

### 3. Weekly Review uses proxy Workout Engine input instead of canonical weekly Workout Engine aggregate

- **File:** `src/lib/weekly-review.ts`
- **Gap:** `chooseRecommendation()` synthesizes workout result from `liftsCompleted >= 3` instead of consuming a true aggregated Workout Engine result.

### 4. Weekly Review nutrition input still uses legacy NutritionLog calculations and hard-coded targets

- **File:** `src/lib/weekly-review.ts`
- **Gap:** Progression Engine gets a constructed nutrition result rather than a canonical weekly Nutrition V2 adherence object from persisted `NutritionTarget` / `MealLog` data.

### 5. Goal Tracking is still embedded in Progression Engine

- **File:** `src/lib/progression-engine.ts`
- **Gap:** Progression Engine returns `goalStatus`, but the architecture calls for a separate Goal Tracking Engine to own goal status.

### 6. Daily prescription logic still duplicates planning decisions

- **File:** `src/lib/coach-engine.ts`
- **Gap:** `generateDailyPrescription()` independently composes training, nutrition, steps, and recovery actions. Future Training Engine and Goal Tracking should reduce this duplication.

### 7. Legacy coach-engine weekly review remains

- **File:** `src/lib/coach-engine.ts`
- **Gap:** `generateWeeklyReview()` still has independent weekly recommendation logic. It appears not to be the active `page.tsx` weekly review path, but it remains a future bug risk.

### 8. Progression audit entries are not surfaced as a product audit dashboard

- **Files:** `src/lib/progression-engine.ts`, `src/app/page.tsx`
- **Gap:** Progression Engine creates audit entries, but UI only shows the summarized Weekly Review recommendation and reason.

### 9. Backup/Restore remains insufficient for one-year reliability

- **Files:** `src/lib/storage.ts`, `src/lib/pre-test-cleanup-ui.ts`, `src/app/page.tsx`
- **Gap:** Architecture requires hardened export/import/restore verification. That is not part of Progression Engine, but it is required before one-year self-use confidence.

---

## 11. Risk Assessment

### Duplicate progression decisions: MEDIUM

Progression Engine now owns the final Weekly Review recommendation, but duplicate or overlapping logic remains in `src/lib/coach-engine.ts` and domain engines. Domain engines are acceptable, but old helper functions are still callable and could produce conflicting behavior.

### Conflicting recommendations: MEDIUM

The most likely conflict path is daily prescription logic in `src/lib/coach-engine.ts` versus weekly Progression Engine output. For example, `recommendMacroAdjustment()` can recommend calorie movement independently from `evaluateProgression()` nutrition decisions. Running and Workout domain outputs may also be compressed into legacy labels differently by logger adapters.

### Hidden progression paths: MEDIUM

Hidden paths remain because `src/lib/coach-engine.ts` is large and contains older helpers that are not obviously deprecated. `generateWeeklyReview()` is especially risky because it can independently produce a weekly recommendation if reused.

### Migration risk: MEDIUM

The implementation uses compatibility wrappers and legacy state shapes, which is appropriate for phased migration. The risk is that future UI phases may accidentally build on old helpers instead of canonical Progression Engine outputs. Keeping adapters thin and adding tests for consumer-to-engine alignment will reduce this risk.

---

## 12. Final Verdict

### 1. Is Progression Engine V1 truly implemented?

**Yes.**

`src/lib/progression-engine.ts` now implements `evaluateProgression()` with cross-domain weekly decision logic, nutrition decision logic, goal status, confidence, data quality, warnings, reasons, and audit entries.

### 2. Is it the single progression authority?

**Partially.**

It is the single authority for the current Weekly Review final next-week recommendation. It is not yet the single universally consumed progression authority across Home, Train, daily prescription logic, and all legacy coach helpers.

### 3. Can Home safely consume it next?

**Yes, with adapter discipline.**

Home can safely consume Progression Engine output next if it uses the existing Weekly Review path or a dedicated model builder that calls `evaluateProgression()` rather than recreating rules in `page.tsx`.

### 4. Can Train safely consume it next?

**Not as the immediate next step.**

Train can eventually consume Progression Engine context, but Train V2 needs a Training Engine/session composition layer. Current Train logic still depends on `coach-engine.ts` daily prescription and legacy workout/run flow. Building Train before Goal Tracking/Home risks adding more orchestration into `page.tsx`.

### 5. What exact phase should be built next?

**Recommended next phase: Goal Tracking Engine.**

Justification:

- The master architecture lists Goal Tracking Engine immediately after Progression Engine.
- Progression Engine currently contains embedded goal status helpers (`fatLossStatus()`, `halfMarathonStatus()`, `strengthStatus()`, `physiqueStatus()`), which is useful for Phase 2 but violates the final ownership model long-term.
- Extracting Goal Tracking next will clarify ownership before Home UX V2 displays goal status.
- Home UX V2 should then consume canonical Goal Tracking + Progression outputs instead of inventing goal logic in UI.
- Train V2 should wait until Home/Goal Tracking ownership is cleaner and a Training Engine phase is explicitly scoped.

Chosen option: **Goal Tracking Engine**.

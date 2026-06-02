# PROGRESSION ENGINE V1 ARCHITECTURE

Goal: create one unified progression engine that determines training, running, nutrition, and goal-status decisions from the same weekly data snapshot.

This is an architecture document only. Do not implement until explicitly approved.

---

## 1. Current Problem

The app currently has progression logic scattered across multiple modules and screens:

- `src/lib/weekly-review.ts`
  - Chooses `Progress`, `Repeat`, `Deload`, or `Recovery focus` for next week.
  - Uses weekly readiness, long run completion, lifts completed, adherence score, alcohol days, and pain flags.
  - Has its own adherence calculation and recommendation thresholds.

- `src/lib/workout-logger.ts`
  - Produces post-workout progression suggestions.
  - Uses completed reps, prescribed sets, RPE, soreness, sleep, and pain.
  - Uses lower-case action labels such as `progress`, `repeat`, and `reduce-volume`.

- `src/lib/coach-engine.ts`
  - Contains workout adjustment logic.
  - Contains set-by-set progression logic.
  - Contains running progression/regression logic.
  - Contains macro adjustment logic.
  - Generates daily prescription copy that may imply plan progression, nutrition changes, or running changes.

- `src/lib/nutrition-engine.ts`
  - Calculates macro adherence, calorie adherence, protein adherence, fiber adherence, logging consistency, alcohol days, and confidence/data-quality warnings.

- `src/lib/readiness-engine.ts`
  - Calculates readiness status and confidence from sleep, soreness, stress, energy, pain, HRV, and resting HR.

Current risk:

```text
Weekly Review says Progress
Workout logger says Repeat
Run progression says Hold or Regress
Nutrition adjustment says Reduce calories
Daily Prescription copy says train hard
```

These decisions can disagree because there is no single arbiter that evaluates the complete signal set together.

---

## 2. New Source of Truth

Progression V1 introduces one canonical engine:

```text
src/lib/progression-engine.ts
```

The engine owns final weekly decisions for:

1. Training progression
2. Running progression
3. Nutrition progression
4. Goal progress status
5. Confidence scoring
6. Data quality scoring
7. Recommendation audit trail

Every consumer should ask the progression engine for the decision instead of re-deriving progression independently.

Canonical API:

```ts
evaluateProgression(input: ProgressionEngineInput): ProgressionEngineResult
```

Non-goals for V1:

- Do not redesign UI.
- Do not replace the nutrition engine.
- Do not replace the readiness engine.
- Do not replace workout logging.
- Do not replace run logging.
- Do not implement new camera/AI features.
- Do not make irreversible plan changes without explicit user confirmation.

---

## 3. Decision Vocabulary

### 3.1 Training decision vocabulary

```ts
export type WeeklyProgressDecisionAction =
  | "Progress"
  | "Repeat"
  | "Deload"
  | "Recovery Focus";
```

Meaning:

- `Progress`
  - Increase training stimulus conservatively.
  - Only allowed when recovery, pain, adherence, and completion signals support it.

- `Repeat`
  - Keep the same training week/load structure.
  - Used when work was mostly completed but the signal is not strong enough to progress.

- `Deload`
  - Reduce strength volume/load and/or conditioning stress for one week.
  - Used when fatigue, soreness, poor sleep, missed reps, high RPE, or declining performance suggest accumulated fatigue.

- `Recovery Focus`
  - Prioritize pain management, low-intensity movement, sleep, and recovery.
  - Used when pain or readiness risk overrides progression.

### 3.2 Running decision vocabulary

```ts
export type RunningProgressDecisionAction =
  | "Progress"
  | "Hold"
  | "Regress"
  | "Recovery Focus";
```

Meaning:

- `Progress`
  - Increase mileage or long-run distance conservatively.

- `Hold`
  - Keep weekly mileage/long run unchanged.

- `Regress`
  - Reduce mileage, long-run distance, intensity, or run frequency.

- `Recovery Focus`
  - Replace runs with rest, walking, bike, elliptical, or other low-impact work if pain/recovery requires it.

### 3.3 Nutrition decision vocabulary

```ts
export type NutritionProgressDecisionAction =
  | "Increase calories"
  | "Maintain calories"
  | "Reduce calories";
```

Meaning:

- `Increase calories`
  - Use when weight loss is too fast or recovery/performance is deteriorating with good adherence.

- `Maintain calories`
  - Use when trends are acceptable or data quality is too low to justify a change.

- `Reduce calories`
  - Use when weight/fat-loss trend is stalled despite good nutrition adherence and enough data.

### 3.4 Goal status vocabulary

```ts
export type GoalStatus = "On Track" | "At Risk" | "Off Track";
```

Goal statuses must be produced for:

- Under 200 lb
- Greek God physique
- Jan 17 half marathon
- 1:58 half marathon pace goal

---

## 4. Canonical Types

### 4.1 Shared scoring/support types

```ts
export type ProgressionConfidence = "High" | "Medium" | "Low";

export interface ProgressionDataQuality {
  score: number; // 0-100
  confidence: ProgressionConfidence;
  missingFields: string[];
  staleFields: string[];
  warnings: string[];
}

export interface ProgressionExplanation {
  summary: string;
  primaryDrivers: string[];
  blockers: string[];
  supportingSignals: string[];
  tradeoffs: string[];
}

export interface RecommendationAuditEntry {
  id: string;
  timestamp: string;
  decisionType:
    | "training"
    | "running"
    | "nutrition"
    | "goal-status";
  action: string;
  previousAction?: string;
  reason: string;
  dataUsed: string[];
  thresholdsApplied: string[];
  confidence: ProgressionConfidence;
  dataQualityScore: number;
}
```

### 4.2 Input type

```ts
export interface ProgressionEngineInput {
  generatedAt: string;
  evaluationWindow: {
    startDate: string;
    endDate: string;
    days: number;
  };

  goals: {
    targetWeight: number; // under 200 lb target should use 199.9 or lower
    currentWeight?: number;
    goalDate?: string;
    raceDate: string; // Jan 17
    halfMarathonGoalTimeMinutes: number; // 1:58 = 118 minutes
    halfMarathonGoalPaceSecondsPerMile: number; // ~540 sec/mi
  };

  weight: {
    entries: Array<{ date: string; weight: number; waist?: number }>;
    currentWeight?: number;
    average7Day?: number;
    average14Day?: number;
    change7Day?: number;
    change14Day?: number;
    weeklyLossRate?: number;
    waistChange14Day?: number;
  };

  nutrition: {
    macroAdherence?: number;
    caloriesAdherence?: number;
    proteinAdherence?: number;
    fiberAdherence?: number;
    loggingConsistency?: number;
    alcoholDays?: number;
    averageCalories?: number;
    currentCalories?: number;
    calorieOverageWarning?: boolean;
    warnings?: string[];
    confidence?: ProgressionConfidence;
  };

  recovery: {
    readinessStatus?: "Green" | "Yellow" | "Red";
    readinessScore?: number;
    readinessConfidence?: ProgressionConfidence;
    averageSleep?: number;
    averageSoreness?: number;
    averageStress?: number;
    averageEnergy?: number;
    painFlags: Array<{
      date: string;
      source: "check-in" | "run" | "workout";
      location?: string;
      severity: number;
      note?: string;
    }>;
  };

  strength: {
    plannedLifts?: number;
    completedLifts?: number;
    workoutCompletion?: number; // 0-100
    progressionRecommendations: Array<{
      date: string;
      workoutId?: string;
      action: "progress" | "repeat" | "reduce-volume" | "deload" | "unknown";
      message: string;
    }>;
    missedReps?: number;
    highRpeSets?: number;
    averageRpe?: number;
    performanceTrend?: "improving" | "stable" | "declining" | "unknown";
  };

  running: {
    weeklyMileage?: number;
    previousWeeklyMileage?: number;
    longRunCompleted?: boolean;
    plannedLongRunDistance?: number;
    actualLongRunDistance?: number;
    paceTrend?: "improving" | "stable" | "declining" | "unknown";
    rpeTrend?: "improving" | "stable" | "declining" | "unknown";
    averageRunRpe?: number;
    painFlags: Array<{
      date: string;
      location?: string;
      severity: number;
      runType?: string;
    }>;
    recentRuns: Array<{
      date: string;
      runType: string;
      plannedDistance: number;
      actualDistance: number;
      completed: boolean;
      averagePaceSecondsPerMile?: number;
      rpe?: number;
      pain?: boolean;
      painScore?: number;
    }>;
  };

  priorDecision?: ProgressionEngineResult;
}
```

### 4.3 Output type

```ts
export interface ProgressionEngineResult {
  generatedAt: string;
  evaluationWindow: {
    startDate: string;
    endDate: string;
    days: number;
  };

  training: WeeklyProgressDecision;
  running: RunningProgressDecision;
  nutrition: NutritionProgressDecision;
  goals: GoalProgressDecision[];

  overallRecommendation: {
    summary: string;
    nextWeekFocus: string[];
    doNotDo: string[];
  };

  confidence: ProgressionConfidence;
  confidenceScore: number; // 0-100
  dataQuality: ProgressionDataQuality;
  explanations: ProgressionExplanation[];
  auditTrail: RecommendationAuditEntry[];
}
```

### 4.4 Training decision type

```ts
export interface WeeklyProgressDecision {
  action: WeeklyProgressDecisionAction;
  volumeMultiplier: number;
  loadGuidance: "increase" | "hold" | "reduce" | "avoid-heavy-loading";
  conditioningGuidance: "increase" | "hold" | "reduce" | "zone-2-only";
  reason: string;
  explanation: ProgressionExplanation;
  confidence: ProgressionConfidence;
  dataQualityScore: number;
}
```

### 4.5 Running decision type

```ts
export interface RunningProgressDecision {
  action: RunningProgressDecisionAction;
  recommendedWeeklyMileage?: number;
  recommendedLongRunDistance?: number;
  intensityGuidance: "normal" | "hold-intensity" | "reduce-intensity" | "zone-2-only" | "no-running";
  reason: string;
  explanation: ProgressionExplanation;
  confidence: ProgressionConfidence;
  dataQualityScore: number;
}
```

### 4.6 Nutrition decision type

```ts
export interface NutritionProgressDecision {
  action: NutritionProgressDecisionAction;
  currentCalories?: number;
  recommendedCalories?: number;
  calorieDelta: number;
  carbDelta?: number;
  reason: string;
  explanation: ProgressionExplanation;
  confidence: ProgressionConfidence;
  dataQualityScore: number;
}
```

### 4.7 Goal progress decision type

```ts
export type GoalId =
  | "under-200-lb"
  | "greek-god-physique"
  | "jan-17-half-marathon"
  | "1-58-half-marathon-pace";

export interface GoalProgressDecision {
  goalId: GoalId;
  label: string;
  status: GoalStatus;
  score: number; // 0-100
  currentSignal: string;
  targetSignal: string;
  reason: string;
  confidence: ProgressionConfidence;
  dataQualityScore: number;
  explanation: ProgressionExplanation;
}
```

---

## 5. Evaluation Inputs and Derived Signals

### 5.1 Weight signals

The engine should evaluate:

- 7-day average weight
- 14-day average weight
- 7-day change
- 14-day change
- weekly rate of loss
- waist trend when available

Recommended derivation:

```text
average7Day = average(valid weights from last 7 calendar days)
average14Day = average(valid weights from last 14 calendar days)
change14Day = average7Day - prior7DayAverage
weeklyLossRate = abs(change14Day / 2)
```

Weight interpretation:

- Good fat-loss signal:
  - weekly loss rate roughly `0.5-1.5 lb/week`
  - waist stable/down
  - performance not declining

- Too slow/stalled:
  - 14-day average loss less than about `0.2 lb`
  - waist not improving
  - nutrition adherence high enough to trust the signal

- Too fast:
  - loss greater than about `2 lb/week`
  - especially if sleep, readiness, energy, running pace, or strength trend is worsening

### 5.2 Nutrition signals

The engine should consume Nutrition V2 outputs instead of recalculating macro adherence itself:

- macro adherence
- calories adherence
- protein adherence
- fiber adherence
- logging consistency
- alcohol days
- calorie overage/undereating warnings
- confidence and data quality warnings

Interpretation:

- Do not reduce calories if nutrition adherence or logging consistency is low.
- Do not increase calories unless weight loss is too fast or recovery/performance signals are deteriorating with adequate adherence.
- Maintain calories when data quality is weak.
- Alcohol days should reduce confidence in aggressive progression and may support `Repeat`.

### 5.3 Recovery signals

The engine should consume Readiness V2 outputs and weekly subjective averages:

- readiness status
- readiness score
- readiness confidence
- average sleep
- average soreness
- average stress
- average energy
- pain flags

Recovery override priority:

1. High pain overrides progression.
2. Red readiness blocks aggressive training/running progression.
3. Yellow readiness usually supports `Repeat` or `Hold`, not progression, unless all other signals are strong and pain is absent.
4. Green readiness allows progression only when adherence and completion criteria also pass.

### 5.4 Strength signals

The engine should evaluate:

- workout completion
- completed lifts
- planned lifts
- progression recommendations
- missed reps
- high RPE sets
- average RPE
- performance trend

Interpretation:

- Strength can progress when lifts are completed, RPE is controlled, missed reps are low, pain is absent, and readiness is Green.
- Repeat when work was mostly completed but signal is mixed.
- Deload when high RPE, missed reps, soreness, or performance decline suggests fatigue.
- Recovery Focus when pain or Red readiness dominates.

### 5.5 Running signals

The engine should evaluate:

- weekly mileage
- previous weekly mileage
- long run completion
- planned vs actual long run distance
- pace trend
- RPE trend
- running pain
- recent run completion

Interpretation:

- Running can progress when long run is completed, pain is low/absent, RPE is controlled, and readiness is acceptable.
- Hold when long run is missed or RPE/pace signal is mixed.
- Regress when pain, failed runs, declining pace at higher RPE, or excessive fatigue appears.
- Recovery Focus when pain severity or readiness requires replacing runs.

---

## 6. Decision Rules

### 6.1 Safety-first order of operations

The engine should apply decisions in this order:

1. Data quality and missing-data scoring
2. Pain and recovery safety overrides
3. Running-specific safety checks
4. Strength/training completion and fatigue checks
5. Nutrition/weight trend checks
6. Goal status scoring
7. Overall recommendation synthesis
8. Audit trail generation

Safety override principle:

```text
When signals conflict, choose the more conservative decision unless confidence is high and the risk signal is weak.
```

### 6.2 Training decision rules

Return `Recovery Focus` if any of these are true:

- pain severity `>= 7`
- multiple pain flags with severity `>= 5`
- readiness status is `Red` with pain, sleep, or soreness as a primary driver
- recent workout pain blocks normal movement

Return `Deload` if any of these are true:

- readiness status is `Red` without high pain
- average sleep below about `6 hours`
- soreness high and persistent
- high RPE sets are frequent
- missed reps are elevated
- strength performance trend is declining

Return `Repeat` if any of these are true:

- readiness status is `Yellow`
- workout completion is moderate but not excellent
- completed lifts are below target
- long run was missed but pain is not high
- nutrition/logging consistency is too low to trust progression

Return `Progress` only if all are true:

- readiness status is `Green` or high-quality `Yellow` without major recovery warnings
- no meaningful pain flags
- workout completion is high
- completed lifts meet the weekly target
- missed reps are low
- high RPE sets are low
- nutrition adherence supports recovery

### 6.3 Running decision rules

Return `Recovery Focus` if any of these are true:

- run pain severity `>= 7`
- readiness is `Red` with pain or severe fatigue
- lower-body pain makes running unsafe

Return `Regress` if any of these are true:

- pain is recurring or severity `>= 5`
- long run failed because of pain or excessive RPE
- pace trend is declining while RPE trend is worsening
- weekly mileage jumped too much and recovery is worsening

Return `Hold` if any of these are true:

- long run was missed
- RPE trend is mixed
- pace trend is flat/unknown
- readiness is Yellow
- nutrition/logging consistency is poor

Return `Progress` only if all are true:

- long run completed
- pain is absent or very low
- RPE is controlled
- pace trend is stable/improving or the run was intentionally easy
- weekly mileage progression is conservative
- readiness does not block progression

### 6.4 Nutrition decision rules

Return `Maintain calories` if:

- nutrition adherence is below `80`
- logging consistency is below `80`
- data quality is Low
- weight data is insufficient
- goal signals conflict

Return `Reduce calories` if all are true:

- 14-day weight trend is stalled or too slow
- waist is not improving when available
- macro adherence is high enough to trust the signal
- logging consistency is high enough to trust the signal
- readiness is not Red
- performance is not clearly declining

Recommended adjustment:

```text
calorieDelta = -150 to -200/day
carbDelta = about -25 to -40g/day if carbs are the easiest lever
```

Return `Increase calories` if all are true:

- weekly loss rate is too fast, roughly `>2 lb/week`
- recovery or performance is worsening
- adherence is high enough to trust the deficit signal

Recommended adjustment:

```text
calorieDelta = +100 to +200/day
carbDelta = +25 to +50g/day, especially around runs/lower-body days
```

---

## 7. Goal Progress Scoring

### 7.1 Under 200 lb

Goal:

```text
currentWeight < 200 lb
```

Signals:

- current weight
- 7-day average
- 14-day average
- weekly loss rate
- adherence quality
- projected time to under 200

Status rules:

- `On Track`
  - weight trend moving down at a sustainable rate
  - adherence is adequate
  - projected timeline is plausible

- `At Risk`
  - trend is flat for 14+ days despite good adherence
  - adherence/logging quality is inconsistent
  - loss rate is too fast and recovery is worsening

- `Off Track`
  - weight is moving up or clearly stalled for multiple windows
  - adherence is poor and no reliable deficit exists

### 7.2 Greek God physique

Goal:

```text
lean, muscular, broad-shouldered aesthetic with visible waist reduction and maintained/improving strength
```

Signals:

- waist trend
- weight trend
- strength completion
- progressive overload signal
- protein adherence
- sleep/recovery
- pain/injury status

Status rules:

- `On Track`
  - waist/weight trend improving
  - strength stable or improving
  - protein adherence strong
  - recovery adequate

- `At Risk`
  - weight is dropping but strength/recovery is declining
  - protein adherence is inconsistent
  - soreness/pain is limiting training quality

- `Off Track`
  - strength is declining, adherence is low, and recovery is poor
  - pain blocks consistent lifting

### 7.3 Jan 17 half marathon

Goal:

```text
complete the Jan 17 half marathon without walking if possible
```

Signals:

- long run completion
- weekly mileage
- running consistency
- pain
- RPE trend
- recovery
- weeks until race

Status rules:

- `On Track`
  - long run is completed consistently
  - weekly mileage is progressing conservatively
  - pain is low/absent
  - RPE is controlled

- `At Risk`
  - long run missed
  - mileage is flat or inconsistent
  - RPE is high
  - minor pain is recurring

- `Off Track`
  - running pain is high
  - long runs repeatedly fail
  - mileage is regressing close to race day

### 7.4 1:58 half marathon pace goal

Goal:

```text
1:58 half marathon = 118 minutes total
required pace ≈ 9:00 per mile
```

Signals:

- recent pace trend
- long run pace/RPE relationship
- weekly mileage
- workout consistency
- pain
- recovery

Status rules:

- `On Track`
  - pace trend improving or stable at lower RPE
  - long run distance is building
  - no meaningful pain

- `At Risk`
  - endurance completion is improving but pace is not yet near goal
  - RPE remains high at slower paces
  - fatigue limits quality work

- `Off Track`
  - pace trend is declining
  - long run completion is poor
  - pain/recovery prevents running consistency

Important:

The engine should distinguish between:

```text
finish-the-race goal status
```

and

```text
1:58 performance goal status
```

The user can be `On Track` to finish the race but `At Risk` for the 1:58 pace goal.

---

## 8. Confidence Scoring

### 8.1 Confidence levels

```ts
export type ProgressionConfidence = "High" | "Medium" | "Low";
```

Recommended mapping:

```text
High   = confidenceScore >= 85
Medium = confidenceScore >= 65 and < 85
Low    = confidenceScore < 65
```

### 8.2 Confidence score inputs

Confidence should combine:

- data quality score
- number of logged days
- availability of weight data
- availability of nutrition adherence data
- availability of readiness data
- availability of workout data
- availability of running data
- agreement between signals

Recommended formula:

```text
confidenceScore =
  dataQualityScore * 0.60 +
  signalAgreementScore * 0.25 +
  recencyScore * 0.15
```

Signal agreement examples:

- High agreement:
  - Green readiness + completed long run + good lifts + good adherence = Progress likely valid

- Mixed agreement:
  - weight stalled but nutrition logging poor = Maintain calories, Low/Medium confidence

- Low agreement:
  - run pace improving but pain worsening = conservative running decision, lower confidence

---

## 9. Data Quality Scoring

### 9.1 Required fields by domain

Weight quality requires:

- at least 4 valid weights in the last 7 days for a useful 7-day average
- at least 8 valid weights in the last 14 days for a useful 14-day average

Nutrition quality requires:

- macro adherence
- logging consistency
- calories/protein adherence
- alcohol days

Recovery quality requires:

- readiness status
- average sleep
- soreness/stress/energy where available
- pain flags

Strength quality requires:

- completed lifts
- planned lifts or expected weekly lift count
- missed reps/high RPE when available
- workout completion

Running quality requires:

- weekly mileage
- long run completion
- recent run RPE
- pain flags
- pace trend when available

### 9.2 Data quality scoring shape

Recommended scoring:

```text
weightDataQuality:    20 points
nutritionDataQuality: 20 points
recoveryDataQuality:  20 points
strengthDataQuality:  20 points
runningDataQuality:   20 points
```

Total:

```text
dataQualityScore = sum(domain scores)
```

Confidence mapping:

```text
High   = 85-100
Medium = 65-84
Low    = 0-64
```

### 9.3 Missing data handling

Missing data should not crash the engine.

Rules:

- Missing weight trend -> do not reduce calories based on weight.
- Missing nutrition adherence -> maintain calories and lower confidence.
- Missing readiness -> avoid aggressive progression and lower confidence.
- Missing running data -> hold running rather than progress.
- Missing workout data -> repeat training rather than progress.

---

## 10. Explanation Fields

Every decision should include an explanation object:

```ts
interface ProgressionExplanation {
  summary: string;
  primaryDrivers: string[];
  blockers: string[];
  supportingSignals: string[];
  tradeoffs: string[];
}
```

Examples:

Training `Progress` explanation:

```text
summary: Long run and lifting were completed with controlled pain and good adherence, so training can progress conservatively.
primaryDrivers: completed lifts, completed long run, Green readiness
blockers: none
supportingSignals: macro adherence above 85, average sleep above 7h
tradeoffs: progress should still be conservative during fat loss
```

Running `Hold` explanation:

```text
summary: Long run was missed, so running should hold even though weekly readiness is not Red.
primaryDrivers: missed long run
blockers: incomplete long run signal
supportingSignals: pain remained low
tradeoffs: holding protects the race build from overreaching
```

Nutrition `Maintain calories` explanation:

```text
summary: Weight trend is unclear and logging consistency is below threshold, so calories should stay unchanged.
primaryDrivers: low logging consistency
blockers: insufficient data quality for calorie change
supportingSignals: protein trend acceptable
tradeoffs: improving logging is more valuable than changing calories now
```

---

## 11. Recommendation Audit Trail

Every engine run should emit audit entries.

Audit trail goals:

- make recommendations explainable
- support debugging conflicting recommendations
- allow future UI to show “why did the coach say this?”
- preserve thresholds used at decision time

Required audit fields:

```ts
interface RecommendationAuditEntry {
  id: string;
  timestamp: string;
  decisionType: "training" | "running" | "nutrition" | "goal-status";
  action: string;
  previousAction?: string;
  reason: string;
  dataUsed: string[];
  thresholdsApplied: string[];
  confidence: ProgressionConfidence;
  dataQualityScore: number;
}
```

Example audit entry:

```ts
{
  id: "progression-2026-06-07-running",
  timestamp: "2026-06-07T12:00:00.000Z",
  decisionType: "running",
  action: "Hold",
  reason: "Long run was missed, so running progression is held.",
  dataUsed: ["longRunCompleted", "weeklyMileage", "runPainFlags", "readinessStatus"],
  thresholdsApplied: ["longRunCompleted must be true to progress", "pain severity >= 7 forces Recovery Focus"],
  confidence: "High",
  dataQualityScore: 88
}
```

---

## 12. Consumer Integration Plan

### 12.1 Weekly Review

Current owner:

```text
src/lib/weekly-review.ts
```

Future role:

- Build weekly summary metrics.
- Call `evaluateProgression()`.
- Display `result.training.action` as the next-week recommendation.
- Keep old `WeeklyReviewSummary.nextWeekRecommendation` as a compatibility projection.

Mapping:

```text
ProgressionEngineResult.training.action -> WeeklyReviewSummary.nextWeekRecommendation
```

Compatibility note:

- Existing Weekly Review spelling uses `Recovery focus`.
- Engine vocabulary should use `Recovery Focus`.
- A wrapper can map capitalization for existing UI if needed.

### 12.2 Workout progression

Current owners:

```text
src/lib/workout-logger.ts
src/lib/coach-engine.ts
```

Future role:

- Workout logger keeps per-session details.
- Progression engine owns weekly training progression.
- Per-exercise progression can remain local, but it should feed `strength.progressionRecommendations` into the engine.

### 12.3 Running progression

Current owner:

```text
src/lib/coach-engine.ts
```

Future role:

- Existing run trend functions can remain as calculators.
- Progression engine owns final `Progress`, `Hold`, `Regress`, or `Recovery Focus` decision.
- Daily prescription should consume this decision instead of making independent running progression calls.

### 12.4 Nutrition adjustment

Current owner:

```text
src/lib/coach-engine.ts
```

Future role:

- Nutrition engine calculates adherence.
- Progression engine decides `Increase calories`, `Maintain calories`, or `Reduce calories`.
- Daily prescription should consume the nutrition decision rather than independently choosing calorie changes.

### 12.5 Daily Prescription

Current owner:

```text
src/lib/coach-engine.ts
```

Future role:

- Use progression engine result as a constraint layer.
- If progression says `Recovery Focus`, daily prescription must not recommend aggressive workout/running progression.
- If nutrition says `Maintain calories`, daily prescription must not separately suggest a cut.

---

## 13. Implementation File Plan

Do not implement yet. When approved, likely files are:

New files:

```text
src/lib/progression-engine.ts
src/lib/progression-engine.test.ts
```

Likely modified non-UI files:

```text
src/lib/weekly-review.ts
src/lib/weekly-review.test.ts
src/lib/coach-engine.ts
src/lib/coach-engine.test.ts
src/lib/workout-logger.ts
src/lib/workout-logger.test.ts
src/lib/types.ts // optional only if shared app-wide types are promoted
```

Should not change during foundation implementation unless explicitly approved:

```text
src/app/page.tsx
src/app/api/scan-food/route.ts
```

---

## 14. Test Plan for Future Implementation

Core tests for `src/lib/progression-engine.test.ts`:

1. Training Progress
   - Green readiness
   - no pain
   - completed lifts meet target
   - missed reps low
   - high RPE low
   - good adherence
   - expect `training.action = "Progress"`

2. Training Repeat
   - Yellow readiness or missed long run
   - no high pain
   - expect `training.action = "Repeat"`

3. Training Deload
   - Red readiness or high fatigue
   - missed reps/high RPE elevated
   - expect `training.action = "Deload"`

4. Training Recovery Focus
   - pain severity `>= 7`
   - expect `training.action = "Recovery Focus"`

5. Running Progress
   - long run completed
   - pain low
   - RPE controlled
   - mileage progression conservative
   - expect `running.action = "Progress"`

6. Running Hold
   - long run missed
   - no high pain
   - expect `running.action = "Hold"`

7. Running Regress
   - pain recurring or pace declining while RPE worsens
   - expect `running.action = "Regress"`

8. Running Recovery Focus
   - run pain severity `>= 7`
   - expect `running.action = "Recovery Focus"`

9. Nutrition Maintain
   - low logging consistency or low macro adherence
   - expect `nutrition.action = "Maintain calories"`

10. Nutrition Reduce
    - weight stalled
    - waist not improving
    - adherence high
    - recovery acceptable
    - expect `nutrition.action = "Reduce calories"`

11. Nutrition Increase
    - loss rate >2 lb/week
    - recovery/performance declining
    - adherence high
    - expect `nutrition.action = "Increase calories"`

12. Goal statuses
    - separate statuses for under 200 lb, Greek God physique, Jan 17 half marathon, and 1:58 half marathon pace.
    - verify user can be `On Track` for race completion but `At Risk` for 1:58 pace.

13. Confidence/data quality
    - missing nutrition data lowers confidence and blocks calorie reduction.
    - missing running data results in running `Hold`, not `Progress`.
    - missing workout data results in training `Repeat`, not `Progress`.

14. Audit trail
    - every decision emits an audit entry with data used, thresholds, confidence, and data quality.

---

## 15. Acceptance Criteria

Architecture acceptance:

- One progression engine is defined as the final arbiter.
- `ProgressionEngineInput` is defined.
- `ProgressionEngineResult` is defined.
- `WeeklyProgressDecision` is defined.
- `RunningProgressDecision` is defined.
- `NutritionProgressDecision` is defined.
- `GoalProgressDecision` is defined.
- Engine evaluates weight signals:
  - 7-day average
  - 14-day average
  - rate of loss
- Engine evaluates nutrition signals:
  - macro adherence
  - logging consistency
- Engine evaluates recovery signals:
  - readiness
  - sleep
  - soreness
  - stress
  - pain
- Engine evaluates strength signals:
  - workout completion
  - completed lifts
  - progression recommendations
  - missed reps
  - high RPE
- Engine evaluates running signals:
  - weekly mileage
  - long run completion
  - pace trend
  - RPE trend
  - pain
- Outputs include:
  - Training: `Progress`, `Repeat`, `Deload`, `Recovery Focus`
  - Running: `Progress`, `Hold`, `Regress`, `Recovery Focus`
  - Nutrition: `Increase calories`, `Maintain calories`, `Reduce calories`
  - Goal statuses: `On Track`, `At Risk`, `Off Track`
- Confidence scoring is defined.
- Data quality scoring is defined.
- Explanation fields are defined.
- Recommendation audit trail is defined.

Product acceptance:

- Weekly Review, workout progression, run progression, nutrition adjustment, and daily prescription no longer need to make independent conflicting final progression decisions.
- The engine can explain why it chose a conservative decision when signals conflict.
- The engine can separately assess fat-loss, physique, race completion, and race pace goals.
- The engine distinguishes “finish the half marathon” from “run 1:58.”

---

## 16. Explicit Non-Code Scope

This document does not implement the engine.

Do not code yet.

Do not modify UI yet.

Do not change daily prescription behavior yet.

Do not change camera or AI scan behavior.

Do not remove existing progression logic until wrappers and tests are implemented in a later approved phase.

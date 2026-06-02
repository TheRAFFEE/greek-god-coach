# RUNNING ENGINE V2 ARCHITECTURE

Goal: create the canonical running engine for the app.

This document is architecture only. Do not implement code until explicitly approved.

---

## 1. Purpose

Running Engine V2 becomes the single source of truth for:

1. Half marathon progression
2. Mileage progression
3. Pace progression
4. Long-run progression
5. Running readiness
6. Running injury prevention
7. Running performance prediction

Current race goal:

```text
Race: January 17 Half Marathon
Target finish: 1:58
Target pace: 9:00/mile
Distance: 13.1 miles
```

The engine should turn raw run logs, readiness, pain, heart-rate, RPE, and consistency data into one canonical running decision that can be consumed by Weekly Review, Daily Prescription, Progression Engine V1, and future Progress screens.

---

## 2. Current Problem

Running logic currently exists in multiple places:

- `src/lib/coach-engine.ts`
  - `calculateRunTrends()` calculates distance, pace, RPE, long-run progression, and weekly mileage.
  - `generateRunningRecommendation()` decides `Progress`, `Hold`, or `Regress` from recent runs, readiness, pain, zone 2 compliance, HR/pace relationship, and weekly mileage increase.
  - Daily prescription can embed running guidance.

- `src/lib/run-logger.ts`
  - `evaluateRunLoggerResult()` produces local next-run decisions: `progress`, `repeat`, or `deload`.
  - It uses run completion, RPE, walk breaks, and pain score.

- `src/lib/weekly-review.ts`
  - Weekly review checks long-run completion and run pain.
  - It can influence `Progress`, `Repeat`, `Deload`, or `Recovery focus`.

- `src/lib/types.ts`
  - Existing `RunningRecommendationAction = "Progress" | "Hold" | "Regress"` lacks `Recovery Focus`.

Current risk:

```text
Run Logger says progress
Coach Engine says hold
Weekly Review says repeat
Progression Engine says recovery focus
```

Running Engine V2 should eliminate this by producing one authoritative running result.

---

## 3. New Source of Truth

Canonical module:

```text
src/lib/running-engine.ts
```

Canonical API:

```ts
evaluateRunning(input: RunningEngineInput): RunningEngineResult
```

Consumers should not independently decide running progression after V2. They should consume `RunningEngineResult`.

V2 scope:

- Architecture defines canonical types, formulas, thresholds, and integration path.
- Implementation should be separate and explicitly approved later.

Non-goals:

- Do not redesign UI.
- Do not change camera/AI features.
- Do not replace Progression Engine V1.
- Do not generate a full race training plan yet.
- Do not auto-change workouts without user-visible explanation.

---

## 4. Decision Vocabulary

### 4.1 Running progression action

```ts
export type RunningProgressionAction =
  | "Progress"
  | "Hold"
  | "Regress"
  | "Recovery Focus";
```

Meaning:

- `Progress`
  - Increase running stimulus conservatively.
  - Usually means +0.5 to +1.0 mile on long run or controlled weekly mileage increase.

- `Hold`
  - Keep next week’s running volume and long run stable.
  - Used when data is mixed, long run is missed, readiness is Yellow, or confidence is not high enough to progress.

- `Regress`
  - Reduce mileage, long run, intensity, or run frequency.
  - Used when pain, poor recovery, failed runs, pace/HR worsening, or excessive RPE suggests overreaching.

- `Recovery Focus`
  - Temporarily prioritize rest, walking, bike, elliptical, mobility, or medical evaluation if needed.
  - Used when pain severity or readiness risk overrides running.

### 4.2 Running goal status

```ts
export type RunningGoalStatusLabel = "On Track" | "At Risk" | "Off Track";
```

Goal statuses should be produced separately for:

- race completion
- 1:58 finish target
- 9:00/mile pace target
- long-run build
- weekly mileage build
- injury-risk status

---

## 5. Canonical Types

### 5.1 Shared support types

```ts
export type RunningConfidence = "High" | "Medium" | "Low";
export type RunningTrend = "improving" | "stable" | "declining" | "unknown";

export interface RunningExplanation {
  summary: string;
  primaryDrivers: string[];
  blockers: string[];
  supportingSignals: string[];
  tradeoffs: string[];
}

export interface RunningAuditEntry {
  id: string;
  timestamp: string;
  decisionType:
    | "running-readiness"
    | "progression"
    | "prediction"
    | "injury-risk"
    | "pace-zone"
    | "goal-status";
  action: string;
  reason: string;
  dataUsed: string[];
  thresholdsApplied: string[];
  confidence: RunningConfidence;
  dataQualityScore: number;
}
```

### 5.2 Input type

```ts
export interface RunningEngineInput {
  generatedAt: string;
  evaluationDate: string;

  race: {
    raceDate: string; // January 17
    targetFinishMinutes: number; // 1:58 = 118
    targetPaceSecondsPerMile: number; // 9:00/mile = 540
    distanceMiles: number; // 13.1
  };

  runLogs: Array<{
    id: string;
    date: string;
    runType?: "easy" | "long run" | "tempo" | "interval" | "recovery" | "race" | string;
    plannedDistance: number;
    actualDistance: number;
    durationMinutes: number;
    averagePace?: number; // existing app value in min/mi
    averagePaceSecondsPerMile?: number; // preferred V2 canonical field
    averageHr?: number;
    maxHr?: number;
    rpe: number;
    zone2Compliance?: number;
    completed: boolean;
    walkBreaks?: boolean;
    pain?: boolean;
    painScore?: number;
    painLocation?: string;
    notes?: string;
  }>;

  currentWeek: {
    startDate: string;
    endDate: string;
    weeklyMileage?: number;
    rolling7DayMileage?: number;
    plannedWeeklyMileage?: number;
    previousWeeklyMileage?: number;
    runningDaysPlanned?: number;
    runningDaysCompleted?: number;
  };

  readiness: {
    status?: "Green" | "Yellow" | "Red";
    score?: number;
    confidence?: RunningConfidence;
    averageSleep?: number;
    averageSoreness?: number;
    averageStress?: number;
    averageEnergy?: number;
  };

  trends?: {
    paceTrend?: RunningTrend;
    heartRateTrend?: RunningTrend;
    rpeTrend?: RunningTrend;
    painTrend?: RunningTrend;
    mileageTrend?: RunningTrend;
    longRunTrend?: RunningTrend;
  };

  userContext?: {
    age?: number;
    bodyWeight?: number;
    experienceLevel?: "beginner" | "intermediate" | "advanced";
    injuryHistory?: string;
  };
}
```

Required input concepts:

- weekly mileage
- rolling 7-day mileage
- long run completion
- pace trend
- heart rate trend
- RPE trend
- pain trend
- readiness status
- race date
- running consistency

### 5.3 Result type

```ts
export interface RunningEngineResult {
  generatedAt: string;
  evaluationDate: string;

  fitnessProfile: RunningFitnessProfile;
  readiness: RunningReadiness;
  progression: RunningProgressionDecision;
  goalStatus: RunningGoalStatus;
  prediction: RunningPrediction;

  paceZones: RunningPaceZones;

  currentPredictedFinishTime: string;
  currentPredictedPace: string;
  targetPaceGap: string;
  targetFinishGap: string;
  longRunStatus: RunningStatusSummary;
  weeklyMileageStatus: RunningStatusSummary;
  runningReadiness: RunningReadiness;
  runningConfidenceScore: number;
  runningDataQualityScore: number;

  confidence: RunningConfidence;
  confidenceScore: number;
  dataQualityScore: number;
  explanations: RunningExplanation[];
  auditTrail: RunningAuditEntry[];
}
```

---

## 6. Required Output Types

### 6.1 RunningFitnessProfile

```ts
export interface RunningFitnessProfile {
  weeklyMileage: number;
  rolling7DayMileage: number;
  previousWeeklyMileage?: number;
  mileageChangePercent?: number;
  longestRecentRunMiles: number;
  longRunCompletionRate: number;
  runningConsistency: number; // 0-100
  recentAveragePaceSecondsPerMile?: number;
  recentAverageHr?: number;
  recentAverageRpe?: number;
  paceTrend: RunningTrend;
  heartRateTrend: RunningTrend;
  rpeTrend: RunningTrend;
  painTrend: RunningTrend;
}
```

### 6.2 RunningReadiness

```ts
export interface RunningReadiness {
  status: "Green" | "Yellow" | "Red";
  score: number; // 0-100
  reasons: string[];
  blockers: string[];
  injuryRiskScore: number; // 0-100, higher = more risk
  raceReadinessScore: number; // 0-100, higher = more ready
  confidence: RunningConfidence;
}
```

### 6.3 RunningProgressionDecision

```ts
export interface RunningProgressionDecision {
  action: RunningProgressionAction;
  recommendedWeeklyMileage?: number;
  recommendedLongRunDistance?: number;
  recommendedRunFrequency?: number;
  intensityGuidance:
    | "normal"
    | "zone-2-only"
    | "hold-intensity"
    | "reduce-intensity"
    | "no-running";
  paceGuidance: string;
  reason: string;
  explanation: RunningExplanation;
  confidence: RunningConfidence;
  dataQualityScore: number;
}
```

### 6.4 RunningGoalStatus

```ts
export interface RunningGoalStatus {
  raceCompletion: RunningGoalStatusItem;
  targetFinishTime: RunningGoalStatusItem;
  targetPace: RunningGoalStatusItem;
  longRunBuild: RunningGoalStatusItem;
  mileageBuild: RunningGoalStatusItem;
  injuryPrevention: RunningGoalStatusItem;
}

export interface RunningGoalStatusItem {
  status: RunningGoalStatusLabel;
  score: number; // 0-100
  currentSignal: string;
  targetSignal: string;
  reason: string;
  confidence: RunningConfidence;
}
```

### 6.5 RunningPrediction

```ts
export interface RunningPrediction {
  predictedFinishMinutes: number | null;
  predictedFinishTime: string | null; // HH:MM or H:MM
  predictedPaceSecondsPerMile: number | null;
  predictedPaceLabel: string | null; // MM:SS/mile
  targetFinishMinutes: number;
  targetFinishTime: string; // 1:58
  targetPaceSecondsPerMile: number;
  targetPaceLabel: string; // 9:00/mile
  targetFinishGapMinutes: number | null;
  targetFinishGapLabel: string | null;
  targetPaceGapSecondsPerMile: number | null;
  targetPaceGapLabel: string | null;
  predictionBasis: "recent-race" | "long-run" | "tempo" | "easy-run-adjusted" | "insufficient-data";
  confidence: RunningConfidence;
}
```

### 6.6 RunningStatusSummary

```ts
export interface RunningStatusSummary {
  status: "strong" | "adequate" | "watch" | "problem" | "unknown";
  value: string;
  target: string;
  reason: string;
}
```

---

## 7. Pace Zones

Running Engine V2 should create canonical running pace zones from the current predicted pace and target race pace.

```ts
export interface RunningPaceZones {
  zone2: RunningPaceZone;
  tempo: RunningPaceZone;
  threshold: RunningPaceZone;
  racePace: RunningPaceZone;
  vo2: RunningPaceZone;
}

export interface RunningPaceZone {
  name: "Zone 2" | "Tempo" | "Threshold" | "Race Pace" | "VO2";
  paceRangeSecondsPerMile: {
    min: number;
    max: number;
  };
  paceRangeLabel: string;
  effortCue: string;
  rpeRange: string;
  purpose: string;
}
```

Recommended initial zone logic:

```text
racePace = target pace if confidence is Medium/High, else predicted race pace
Zone 2 = racePace + 90 to +150 sec/mi
Tempo = racePace + 20 to +45 sec/mi
Threshold = racePace - 5 to +15 sec/mi
Race Pace = racePace - 5 to +5 sec/mi
VO2 = racePace - 45 to -20 sec/mi
```

For the current 1:58 target:

```text
Target race pace: 9:00/mile
Zone 2: roughly 10:30-11:30/mile
Tempo: roughly 9:20-9:45/mile
Threshold: roughly 8:55-9:15/mile
Race Pace: roughly 8:55-9:05/mile
VO2: roughly 8:15-8:40/mile
```

Safety note:

- Pace zones should be adjusted conservative when readiness is Yellow/Red, pain is present, or confidence is Low.
- Zone 2 should be controlled by effort/HR/RPE, not just pace.

---

## 8. Prediction Model

### 8.1 Required outputs

The engine must output:

- current predicted finish time
- current predicted pace
- target pace gap
- target finish gap

### 8.2 Prediction hierarchy

Use the most race-specific reliable signal available:

1. Recent race or time trial
2. Tempo/threshold run with high confidence
3. Long run with controlled RPE
4. Easy-run adjusted estimate
5. Insufficient data

Recommended V1 prediction strategy:

```text
if recent race/time trial exists:
  use Riegel-style projection to half marathon
else if tempo/threshold run exists:
  estimate race pace from sustained faster effort
else if long run completed with RPE <= 7:
  estimate finish from long-run pace with endurance adjustment
else if easy runs exist:
  estimate from easy pace minus conservative adjustment
else:
  prediction = null, confidence = Low
```

Riegel-style projection shape:

```text
predictedTime2 = time1 * (distance2 / distance1) ^ 1.06
```

Long-run adjustment shape:

```text
predictedHalfPace = longRunPace - 20 to 45 sec/mi if RPE <= 7 and distance >= 8 miles
predictedHalfPace = longRunPace if distance < 8 miles or confidence is Low
```

Easy-run adjustment shape:

```text
predictedHalfPace = recentEasyPace - 45 to 90 sec/mi
```

Conservative defaults:

- Never claim a 1:58 prediction from short/easy runs alone with High confidence.
- If prediction basis is `easy-run-adjusted`, confidence should usually be Low/Medium.
- If pain is present, prediction confidence should downgrade.

---

## 9. Race-Readiness Scoring

Race-readiness score should answer:

```text
How prepared is the user to complete the Jan 17 half marathon well?
```

Recommended formula:

```text
raceReadinessScore =
  longRunScore * 0.35 +
  weeklyMileageScore * 0.25 +
  consistencyScore * 0.15 +
  paceReadinessScore * 0.15 +
  recoveryScore * 0.10
```

Component guidance:

- `longRunScore`
  - based on longest recent run relative to expected build and 13.1-mile goal
  - long run completion matters more than pace early in the build

- `weeklyMileageScore`
  - rewards sustainable weekly volume
  - penalizes excessive jumps

- `consistencyScore`
  - based on completed runs / planned runs
  - rewards repeated weeks of running, not one heroic run

- `paceReadinessScore`
  - based on predicted pace gap to 9:00/mile
  - should not dominate early if race completion is the main priority

- `recoveryScore`
  - based on readiness status, sleep, RPE, HR trend, and pain

Race-readiness interpretation:

```text
85-100 = strong
70-84  = adequate
50-69  = watch
0-49   = problem
```

---

## 10. Injury-Risk Scoring

Injury-risk score should answer:

```text
How risky is it to progress running right now?
```

Higher score = higher risk.

Recommended formula:

```text
injuryRiskScore =
  painScoreComponent * 0.35 +
  mileageJumpComponent * 0.20 +
  rpeComponent * 0.15 +
  heartRateDriftComponent * 0.10 +
  readinessComponent * 0.10 +
  consistencyGapComponent * 0.10
```

Risk component examples:

- Pain:
  - pain severity `>= 7` should force high risk and likely `Recovery Focus`
  - recurring pain severity `>= 4` should usually block progression

- Mileage jump:
  - weekly increase `>10%` increases risk
  - increase `>20%` should strongly block progression

- RPE:
  - average RPE above `7` on easy/long runs increases risk
  - two poor runs in a row should block progression

- Heart rate:
  - higher HR at slower pace suggests fatigue, heat stress, illness, or under-recovery

- Readiness:
  - Red readiness increases risk
  - Yellow readiness supports hold rather than progress

Risk interpretation:

```text
0-29   = low
30-49  = moderate
50-69  = high
70-100 = severe
```

Safety overrides:

```text
pain severity >= 7 -> Recovery Focus
Red readiness + pain -> Recovery Focus
long run failed from pain -> Regress or Recovery Focus
weekly mileage jump >20% + worsening RPE -> Regress
```

---

## 11. Progression Decision Rules

### 11.1 Decision order

Apply decisions in this order:

1. Data quality scoring
2. Pain/injury safety overrides
3. Readiness safety overrides
4. Long-run completion
5. Weekly mileage load management
6. Pace/HR/RPE trend interpretation
7. Race-readiness scoring
8. Final progression recommendation
9. Explanation and audit trail generation

### 11.2 Recovery Focus

Return `Recovery Focus` if any are true:

- pain severity `>= 7`
- Red readiness with running pain
- lower-body pain prevents normal running mechanics
- run pain is worsening across multiple runs
- medical warning symptoms are logged in notes

Recommended output:

```text
recommendedWeeklyMileage = 0 or sharply reduced
recommendedLongRunDistance = 0
intensityGuidance = "no-running" or "zone-2-only"
```

### 11.3 Regress

Return `Regress` if any are true:

- long run failed because of pain, excessive RPE, or walk breaks
- two recent runs were poor quality
- pace trend is declining while HR/RPE trend worsens
- weekly mileage jumped too quickly and readiness worsened
- recurring pain severity is `4-6`

Recommended output:

```text
recommendedWeeklyMileage = current mileage * 0.70 to 0.85
recommendedLongRunDistance = current/planned long run * 0.70 to 0.85
intensityGuidance = "reduce-intensity" or "zone-2-only"
```

### 11.4 Hold

Return `Hold` if any are true:

- long run was missed
- readiness is Yellow
- weekly mileage increased more than 10%
- RPE trend is mixed
- pace trend is unknown
- data quality is Low
- running consistency is below threshold

Recommended output:

```text
recommendedWeeklyMileage = current weekly mileage
recommendedLongRunDistance = current/planned long run distance
intensityGuidance = "hold-intensity" or "zone-2-only"
```

### 11.5 Progress

Return `Progress` only if all are true:

- long run completed
- pain is absent or low
- readiness is Green or high-confidence Yellow without pain/fatigue blockers
- weekly mileage increase is within conservative limits
- RPE is controlled
- HR/pace relationship is stable or improving
- running consistency is adequate
- data quality is Medium/High

Recommended progression caps:

```text
weekly mileage increase <= 10%
long run increase <= 0.5 to 1.0 mile
no simultaneous aggressive mileage + intensity increase
```

---

## 12. Long Run and Mileage Status

### 12.1 Long run status

`longRunStatus` should summarize:

- longest recent run
- planned long run
- completion status
- long-run RPE
- long-run pain
- relation to half-marathon build

Status mapping:

```text
strong   = completed, controlled RPE, no pain, distance building
adequate = completed, minor fatigue, no meaningful pain
watch    = missed, shortened, high RPE, walk breaks, or minor pain
problem  = failed due to pain or repeated missed long runs
unknown  = insufficient data
```

### 12.2 Weekly mileage status

`weeklyMileageStatus` should summarize:

- current weekly mileage
- rolling 7-day mileage
- prior weekly mileage
- mileage increase percent
- planned mileage if available

Status mapping:

```text
strong   = consistent and safe progression
adequate = enough volume with no red flags
watch    = low consistency, flat build, or >10% increase
problem  = sharp spike, repeated missed runs, or injury signs
unknown  = insufficient data
```

---

## 13. Confidence Scoring

Confidence should reflect whether the running decision can be trusted.

```text
High   = confidenceScore >= 85
Medium = confidenceScore >= 65 and < 85
Low    = confidenceScore < 65
```

Recommended formula:

```text
confidenceScore =
  dataQualityScore * 0.55 +
  signalAgreementScore * 0.25 +
  recencyScore * 0.20
```

Signal agreement examples:

- High agreement:
  - completed long run + stable HR/RPE + no pain + Green readiness

- Mixed agreement:
  - pace improving but pain increasing

- Low agreement:
  - limited logs + missing HR + unknown readiness + one unusually fast run

Confidence downgrades:

- no run logs in the last 14 days
- no long-run data
- missing HR data when HR trend is used
- missing RPE data
- missing readiness status
- inconsistent or impossible pace/duration/distance values

---

## 14. Data Quality Scoring

Data quality should be separate from confidence.

Recommended domain weights:

```text
runLogCompleteness:      25 points
recency:                 20 points
longRunData:             20 points
paceHrRpeData:           20 points
readinessPainData:       15 points
```

Required checks:

- weekly mileage exists or can be derived
- rolling 7-day mileage exists or can be derived
- at least one recent run exists
- long run completion can be evaluated
- pace trend can be derived or marked unknown
- heart rate trend can be derived or marked unknown
- RPE trend can be derived or marked unknown
- pain trend can be derived or marked unknown
- readiness status is available or explicitly missing
- race date exists

Missing data behavior:

- Missing run logs -> `Hold`, Low confidence, low data quality
- Missing long run -> long-run status `unknown` or `watch`, do not `Progress`
- Missing HR -> HR trend `unknown`, do not block progression alone
- Missing RPE -> reduce confidence, do not `Progress` aggressively
- Missing readiness -> reduce confidence and choose `Hold` over `Progress`
- Missing race date -> cannot compute countdown or race readiness fully

---

## 15. Explanation Fields

Every major output should include explanation fields.

```ts
interface RunningExplanation {
  summary: string;
  primaryDrivers: string[];
  blockers: string[];
  supportingSignals: string[];
  tradeoffs: string[];
}
```

Example `Progress` explanation:

```text
summary: Long run was completed with controlled RPE, pain stayed low, and weekly mileage progression is within the 10% cap.
primaryDrivers: completed long run, Green readiness, stable HR/RPE
blockers: none
supportingSignals: running consistency above 80%, no pain flags
tradeoffs: progress long run only 0.5-1.0 mile because fat loss and lifting increase recovery cost
```

Example `Hold` explanation:

```text
summary: Running should hold because the long run was missed and readiness is Yellow.
primaryDrivers: missed long run, Yellow readiness
blockers: incomplete long-run signal
supportingSignals: no high pain reported
tradeoffs: holding preserves consistency without adding injury risk
```

Example `Recovery Focus` explanation:

```text
summary: Pain severity is high enough that injury prevention overrides race progression.
primaryDrivers: pain severity >= 7
blockers: high injury risk
supportingSignals: none
tradeoffs: short-term reduction protects ability to continue the half-marathon build
```

---

## 16. Recommendation Audit Trail

Every engine run should emit audit entries.

```ts
export interface RunningAuditEntry {
  id: string;
  timestamp: string;
  decisionType:
    | "running-readiness"
    | "progression"
    | "prediction"
    | "injury-risk"
    | "pace-zone"
    | "goal-status";
  action: string;
  reason: string;
  dataUsed: string[];
  thresholdsApplied: string[];
  confidence: RunningConfidence;
  dataQualityScore: number;
}
```

Example:

```ts
{
  id: "running-2026-06-07-progression",
  timestamp: "2026-06-07T12:00:00.000Z",
  decisionType: "progression",
  action: "Hold",
  reason: "Long run was missed, so mileage progression is held.",
  dataUsed: ["longRunCompleted", "weeklyMileage", "readiness.status", "painTrend"],
  thresholdsApplied: ["long run must be completed to progress", "weekly mileage increase should stay <= 10%"],
  confidence: "Medium",
  dataQualityScore: 78
}
```

---

## 17. Progression Engine V1 Integration

Running Engine V2 should be designed as an input provider for Progression Engine V1.

Progression Engine V1 should consume a stable subset of `RunningEngineResult`:

```ts
export interface ProgressionRunningInputFromRunningEngineV2 {
  weeklyMileage: number;
  rolling7DayMileage: number;
  longRunCompleted: boolean;
  plannedLongRunDistance?: number;
  actualLongRunDistance?: number;
  paceTrend: RunningTrend;
  heartRateTrend: RunningTrend;
  rpeTrend: RunningTrend;
  painTrend: RunningTrend;
  runningConsistency: number;
  runningReadinessStatus: "Green" | "Yellow" | "Red";
  injuryRiskScore: number;
  raceReadinessScore: number;
  predictedFinishMinutes: number | null;
  predictedPaceSecondsPerMile: number | null;
  targetPaceGapSecondsPerMile: number | null;
  targetFinishGapMinutes: number | null;
  progressionAction: RunningProgressionAction;
  confidence: RunningConfidence;
  dataQualityScore: number;
}
```

Integration rule:

```text
Progression Engine V1 should not recalculate running progression after Running Engine V2 exists.
It should use Running Engine V2's progressionAction, injuryRiskScore, raceReadinessScore, prediction, confidence, and explanations.
```

Mapping examples:

```text
RunningEngineResult.progression.action -> ProgressionEngineInput.running engine signal
RunningEngineResult.readiness.injuryRiskScore -> ProgressionEngineInput.running pain/risk signal
RunningEngineResult.prediction -> goal status for 1:58 pace
RunningEngineResult.goalStatus.raceCompletion -> Jan 17 half marathon status
```

---

## 18. Consumer Integration Plan

### 18.1 Run Logger

Current file:

```text
src/lib/run-logger.ts
```

Future role:

- Continue to build/save individual `RunLog` records.
- Local `nextRunDecision` should become a compatibility projection from Running Engine V2 where possible.
- It should not own final progression logic long-term.

### 18.2 Coach Engine / Daily Prescription

Current file:

```text
src/lib/coach-engine.ts
```

Future role:

- Existing `calculateRunTrends()` can become an adapter/helper or be replaced by Running Engine V2 fitness profile.
- Existing `generateRunningRecommendation()` should become a wrapper around Running Engine V2.
- Daily Prescription should use `RunningEngineResult.progression` and `RunningEngineResult.readiness`.

### 18.3 Weekly Review

Current file:

```text
src/lib/weekly-review.ts
```

Future role:

- Weekly Review should display long-run status, weekly mileage status, and running recommendation from Running Engine V2.
- It should stop independently deciding running readiness/progression from long run alone.

### 18.4 Progression Engine V1

Current architecture file:

```text
PROGRESSION_ENGINE_V1_ARCHITECTURE.md
```

Future role:

- Progression Engine V1 should use Running Engine V2 as its canonical running input.
- If Running Engine V2 says `Recovery Focus`, Progression Engine V1 should not override to running `Progress`.

---

## 19. Implementation File Plan

Do not implement yet.

Likely new files later:

```text
src/lib/running-engine.ts
src/lib/running-engine.test.ts
```

Likely modified non-UI files later:

```text
src/lib/coach-engine.ts
src/lib/coach-engine.test.ts
src/lib/run-logger.ts
src/lib/run-logger.test.ts
src/lib/weekly-review.ts
src/lib/weekly-review.test.ts
src/lib/types.ts // optional if promoted app-wide
```

Do not change unless explicitly approved:

```text
src/app/page.tsx
src/app/api/scan-food/route.ts
```

---

## 20. Future Test Plan

When implementation is approved, add tests for:

1. Prediction outputs
   - predicted finish time
   - predicted pace
   - target pace gap
   - target finish gap

2. Pace zones
   - Zone 2
   - Tempo
   - Threshold
   - Race Pace
   - VO2

3. Race-readiness scoring
   - strong long-run/mileage/consistency case
   - low long-run case
   - pace-ready but injury-risk case

4. Injury-risk scoring
   - pain severity >= 7 forces Recovery Focus
   - mileage spike >20% blocks progression
   - worsening HR/RPE downgrades recommendation

5. Progression recommendation
   - Progress when long run completed, no pain, Green readiness, safe mileage increase
   - Hold when long run missed or readiness Yellow
   - Regress when repeated poor runs or recurring moderate pain
   - Recovery Focus with high pain or Red readiness plus pain

6. Data quality
   - missing HR keeps HR trend unknown but does not crash
   - missing RPE lowers confidence
   - missing long run blocks Progress
   - missing readiness lowers confidence

7. Progression Engine V1 adapter shape
   - exposes stable fields for Progression Engine V1
   - does not require Progression Engine V1 to recalculate running decisions

---

## 21. Acceptance Criteria

Architecture acceptance:

- `RunningEngineInput` is defined.
- `RunningEngineResult` is defined.
- `RunningFitnessProfile` is defined.
- `RunningReadiness` is defined.
- `RunningProgressionDecision` is defined.
- `RunningGoalStatus` is defined.
- `RunningPrediction` is defined.
- Required outputs are included:
  - current predicted finish time
  - current predicted pace
  - target pace gap
  - target finish gap
  - long run status
  - weekly mileage status
  - running readiness
  - running confidence score
  - running data quality score
  - progression recommendation: `Progress`, `Hold`, `Regress`, `Recovery Focus`
- Required inputs are included:
  - weekly mileage
  - rolling 7-day mileage
  - long run completion
  - pace trend
  - heart rate trend
  - RPE trend
  - pain trend
  - readiness status
  - race date
  - running consistency
- Pace zones are defined:
  - Zone 2
  - Tempo
  - Threshold
  - Race Pace
  - VO2
- Race-readiness scoring is defined.
- Injury-risk scoring is defined.
- Confidence scoring is defined.
- Data quality scoring is defined.
- Explanation fields are defined.
- Recommendation audit trail is defined.
- Progression Engine V1 integration is defined.

Product acceptance:

- The app has one running source of truth.
- The user can see whether they are progressing toward the Jan 17 half marathon.
- The user can see the gap to 1:58 and 9:00/mile.
- The engine prioritizes injury prevention over aggressive running progression.
- Progression Engine V1 can consume Running Engine V2 without duplicating running decision logic.

---

## 22. Explicit Non-Code Scope

This document does not implement Running Engine V2.

Do not code yet.

Do not modify UI yet.

Do not change Daily Prescription behavior yet.

Do not change camera or AI scan behavior.

Do not remove existing running logic until wrappers and tests are implemented in a later approved phase.

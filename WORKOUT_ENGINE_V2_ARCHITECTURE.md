# WORKOUT ENGINE V2 ARCHITECTURE

Goal: design the canonical workout intelligence engine that becomes the single source of truth for exercise progression, hypertrophy progression, strength progression, PR tracking, muscle group volume tracking, fatigue management, deload decisions, exercise substitutions, and exercise history.

This document is architecture only. Do not implement code until explicitly approved.

---

## 1. Purpose

Workout Engine V2 centralizes all lifting intelligence for the app.

It should answer:

- Should this exercise progress, repeat, reduce, deload, or substitute?
- Is weekly muscle-group volume appropriate for chest, back, shoulders, arms, legs, and core?
- Is the user making hypertrophy progress?
- Is the user making strength progress?
- Did the user set an exercise PR?
- Is fatigue high enough to reduce volume or deload?
- Should an exercise be substituted because of pain, poor form, stalled performance, or equipment limitations?
- What does the user's exercise history say about the next prescription?

Workout Engine V2 should become the canonical source for workout decisions in the same way Running Engine V2 is the canonical source for running decisions.

---

## 2. Current Problem

Workout intelligence is currently scattered across several areas.

### Current files and responsibilities

- `src/lib/workout-logger.ts`
  - Builds manual workout sessions.
  - Calculates completion percentage.
  - Calculates estimated volume.
  - Flags high RPE, missed reps, pain, and poor form.
  - Produces a simple post-workout progression recommendation.
  - Applies a simple sleep/soreness volume warning.

- `src/lib/coach-engine.ts`
  - Generates workout previews.
  - Modifies workouts based on readiness.
  - Performs set-by-set recommendations.
  - Performs post-workout analysis.
  - Creates coach decision log entries.
  - Contains exercise substitution behavior.

- `src/lib/weekly-review.ts`
  - Counts lifts completed.
  - Uses lift completion as one part of weekly recommendation logic.

- `src/lib/types.ts`
  - Defines `Exercise`, `ExerciseLog`, `SetLog`, `WorkoutSession`, `WorkoutSummary`, `PostWorkoutRecommendation`, and coach decision types.

### Problems caused by scattered logic

- Exercise progression can disagree with post-workout recommendations.
- Fatigue management can disagree with readiness and weekly review.
- Volume recommendations are not muscle-group aware.
- Hypertrophy progression and strength progression are not separated.
- PR tracking is not canonical.
- Exercise substitution is not consistently connected to pain, form, history, and progression decisions.
- Weekly volume is not tracked against muscle-group targets.
- Rolling 4-week volume is not available as a first-class signal.
- The app lacks one canonical workout result that other engines can consume.

---

## 3. New Source of Truth

Create a future module:

```ts
src/lib/workout-engine.ts
```

Canonical API:

```ts
evaluateWorkout(input: WorkoutEngineInput): WorkoutEngineResult
```

All workout consumers should eventually call `evaluateWorkout()` directly or through backward-compatible adapters.

Workout Engine V2 should be the authority for:

- exercise progression
- hypertrophy progression
- strength progression
- PR tracking
- muscle group volume tracking
- fatigue management
- deload decisions
- exercise substitutions
- exercise history

---

## 4. Non-Goals

This architecture does not implement code.

This architecture does not modify UI.

This architecture does not create new screens.

This architecture does not change existing user workflows.

This architecture does not remove legacy functions yet.

This architecture does not migrate consumers yet.

Future implementation should preserve existing return shapes through adapters until each consumer is explicitly migrated.

---

## 5. Decision Vocabulary

Canonical workout decision actions:

```ts
export type WorkoutProgressionDecision =
  | "Progress"
  | "Repeat"
  | "Reduce"
  | "Deload"
  | "Substitute";
```

Meaning:

- `Progress`: increase load, reps, sets, or difficulty according to the specific progression model.
- `Repeat`: repeat the same prescription until execution quality is clean enough.
- `Reduce`: reduce load, reps, sets, or intensity but keep the movement pattern.
- `Deload`: reduce total training stress across the workout or muscle group because systemic or local fatigue is high.
- `Substitute`: replace the exercise because pain, form breakdown, equipment constraints, or repeated failure makes the current movement inappropriate.

Decision priority:

1. Substitute for unsafe exercise-specific pain/form issues.
2. Deload for systemic fatigue or widespread local fatigue.
3. Reduce for moderate fatigue, high RPE, missed reps, or volume spikes.
4. Repeat when execution is acceptable but not clean enough to progress.
5. Progress only when execution, fatigue, volume, and history support it.

---

## 6. Supported Muscle Groups

Canonical muscle groups:

```ts
export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "core";
```

Each exercise should map to one primary muscle group and optional secondary muscle groups.

Examples:

- Bench press: primary `chest`, secondary `shoulders`, `arms`
- Row: primary `back`, secondary `arms`
- Overhead press: primary `shoulders`, secondary `arms`
- Curl: primary `arms`
- Squat: primary `legs`, secondary `core`
- Plank: primary `core`

Volume accounting should count:

- 1.0 set for the primary muscle group.
- 0.5 set for each significant secondary muscle group unless a future exercise metadata table overrides this.

---

## 7. Canonical Input Types

### `WorkoutEngineInput`

```ts
export interface WorkoutEngineInput {
  generatedAt: string;
  evaluationDate: string;
  userId: string;

  currentSession?: WorkoutSessionInput;
  plannedWorkout?: PlannedWorkoutInput;

  setLogs: WorkoutSetLogInput[];
  workoutSessions: WorkoutSessionHistoryInput[];
  exerciseCatalog: WorkoutExerciseDefinition[];

  readiness?: WorkoutReadinessInput;
  recovery?: WorkoutRecoveryInput;
  goals: WorkoutGoalInput;

  volumeTargets?: MuscleGroupVolumeTargets;
  substitutionRules?: ExerciseSubstitutionRule[];
}
```

### `WorkoutSessionInput`

```ts
export interface WorkoutSessionInput {
  id: string;
  date: string;
  workoutId: string;
  workoutTitle: string;
  mode: "coach" | "tracker" | "manual";
  status: "active" | "completed" | "ended";
  exercises: WorkoutExercisePerformanceInput[];
}
```

### `WorkoutExercisePerformanceInput`

```ts
export interface WorkoutExercisePerformanceInput {
  exerciseId: string;
  exerciseName: string;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups?: MuscleGroup[];
  movementPattern?: MovementPattern;
  plannedSets: number;
  plannedReps: string;
  plannedLoad?: number;
  plannedRpe?: number;
  completedSets: WorkoutSetLogInput[];
  equipment?: string;
  painLocation?: string;
  notes?: string;
}
```

### `WorkoutSetLogInput`

```ts
export interface WorkoutSetLogInput {
  id: string;
  sessionId: string;
  userId: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  setNumber: number;
  targetReps: string;
  targetRpe: number;
  weightUsed: number;
  repsCompleted: number;
  rpe: number;
  pain: boolean;
  painLocation?: string;
  painSeverity?: number;
  formQuality: "solid" | "minor breakdown" | "poor" | "missed";
  completedAt: string;
  notes?: string;
}
```

### `WorkoutSessionHistoryInput`

```ts
export interface WorkoutSessionHistoryInput {
  id: string;
  date: string;
  workoutId: string;
  workoutTitle: string;
  status: "active" | "completed" | "ended";
  setLogs: WorkoutSetLogInput[];
}
```

### `WorkoutExerciseDefinition`

```ts
export interface WorkoutExerciseDefinition {
  id: string;
  name: string;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups?: MuscleGroup[];
  movementPattern: MovementPattern;
  equipment?: string[];
  progressionType: "load" | "reps" | "sets" | "time" | "bodyweight" | "skill";
  substitutionIds?: string[];
  contraindications?: string[];
}
```

### `MovementPattern`

```ts
export type MovementPattern =
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "curl"
  | "extension"
  | "carry"
  | "anti-extension"
  | "anti-rotation"
  | "rotation"
  | "isolation"
  | "other";
```

### `WorkoutReadinessInput`

```ts
export interface WorkoutReadinessInput {
  status: "Green" | "Yellow" | "Red";
  score: number;
  sleepHours?: number;
  soreness?: number;
  stress?: number;
  energy?: number;
  pain?: boolean;
  painLocation?: string;
  painSeverity?: number;
  confidence?: "High" | "Medium" | "Low";
}
```

### `WorkoutRecoveryInput`

```ts
export interface WorkoutRecoveryInput {
  sorenessByMuscleGroup?: Partial<Record<MuscleGroup, number>>;
  sleepHours?: number;
  restingHeartRateTrend?: "improving" | "stable" | "worsening" | "unknown";
  hrvTrend?: "improving" | "stable" | "worsening" | "unknown";
  alcoholDaysLast7?: number;
  caloriesAdherencePercent?: number;
  proteinAdherencePercent?: number;
}
```

### `WorkoutGoalInput`

```ts
export interface WorkoutGoalInput {
  primaryGoal: "hypertrophy" | "strength" | "hybrid" | "maintenance";
  physiqueGoal?: "Greek God physique" | string;
  fatLossPhase?: boolean;
  preserveRunningPerformance?: boolean;
  priorityMuscleGroups?: MuscleGroup[];
}
```

### `MuscleGroupVolumeTargets`

```ts
export type MuscleGroupVolumeTargets = Record<MuscleGroup, {
  minimumEffectiveSets: number;
  targetSets: number;
  maximumRecoverableSets: number;
}>;
```

Recommended default weekly set targets:

- chest: minimum 8, target 12, maximum 18
- back: minimum 10, target 14, maximum 20
- shoulders: minimum 8, target 12, maximum 18
- arms: minimum 6, target 10, maximum 16
- legs: minimum 8, target 12, maximum 18
- core: minimum 4, target 8, maximum 14

These defaults should be conservative because the user is also training for a half marathon and in a fat-loss phase.

---

## 8. Canonical Result Type

### `WorkoutEngineResult`

```ts
export interface WorkoutEngineResult {
  generatedAt: string;
  evaluationDate: string;

  overallDecision: WorkoutProgressionDecision;
  workoutRecommendation: WorkoutRecommendation;

  exerciseDecisions: WorkoutExerciseDecision[];
  muscleGroupVolume: MuscleGroupVolumeSummary[];
  rollingFourWeekVolume: RollingFourWeekVolumeSummary[];

  hypertrophyProgression: HypertrophyProgressionSummary;
  strengthProgression: StrengthProgressionSummary;
  fatigue: WorkoutFatigueSummary;
  deload: WorkoutDeloadDecision;
  substitutions: ExerciseSubstitutionDecision[];
  exerciseHistory: ExerciseHistorySummary[];
  prs: WorkoutPRSummary;

  confidenceScore: number;
  dataQualityScore: number;
  explanation: WorkoutExplanation;
  auditTrail: WorkoutAuditEntry[];
}
```

Required action output is represented by:

```ts
overallDecision: "Progress" | "Repeat" | "Reduce" | "Deload" | "Substitute"
```

---

## 9. Workout Recommendation Type

```ts
export interface WorkoutRecommendation {
  action: WorkoutProgressionDecision;
  summary: string;
  nextWorkoutGuidance: string;
  loadGuidance?: string;
  volumeGuidance?: string;
  exerciseGuidance?: string;
  recoveryGuidance?: string;
  reason: string;
}
```

Examples:

- `Progress`: "Add 5 lb to bench press next time if warmups feel normal."
- `Repeat`: "Repeat current loads until all sets hit target reps at RPE <= 8."
- `Reduce`: "Reduce squat load 5-10% because RPE and soreness are elevated."
- `Deload`: "Reduce total sets 30-40% this week because fatigue is high across multiple muscle groups."
- `Substitute`: "Replace barbell bench with dumbbell bench because shoulder pain was reported."

---

## 10. Exercise Decision Type

```ts
export interface WorkoutExerciseDecision {
  exerciseId: string;
  exerciseName: string;
  primaryMuscleGroup: MuscleGroup;
  action: WorkoutProgressionDecision;

  currentBestSet?: WorkoutSetPerformance;
  previousBestSet?: WorkoutSetPerformance;
  estimatedOneRepMax?: number;
  previousEstimatedOneRepMax?: number;

  recommendedLoad?: number;
  recommendedReps?: string;
  recommendedSets?: number;
  recommendedRpeCap?: number;

  reason: string;
  blockers: string[];
  supportingSignals: string[];
  confidenceScore: number;
}
```

---

## 11. PR Tracking

Workout Engine V2 should track PRs per exercise.

### `WorkoutPRSummary`

```ts
export interface WorkoutPRSummary {
  newPrs: ExercisePR[];
  exercisePrs: Record<string, ExercisePRProfile>;
}
```

### `ExercisePRProfile`

```ts
export interface ExercisePRProfile {
  exerciseId: string;
  exerciseName: string;
  estimatedOneRepMaxPr?: ExercisePR;
  repPrs: ExercisePR[];
  volumePr?: ExercisePR;
  loadPr?: ExercisePR;
  lastPrDate?: string;
}
```

### `ExercisePR`

```ts
export interface ExercisePR {
  id: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  type: "estimated-1rm" | "rep-pr" | "volume-pr" | "load-pr";
  value: number;
  unit: "lb" | "reps" | "lb-reps";
  set?: WorkoutSetPerformance;
  previousValue?: number;
  improvementPercent?: number;
  confidenceScore: number;
}
```

Required PR categories:

- exercise PRs
- estimated 1RM
- rep PRs
- volume PRs

### Estimated 1RM formula

Use Epley as the default deterministic estimate:

```ts
estimated1RM = weightUsed * (1 + repsCompleted / 30)
```

Rules:

- Only calculate estimated 1RM for sets with `repsCompleted` between 1 and 12.
- Ignore estimated 1RM if form quality is `poor` or `missed`.
- Downgrade confidence when RPE is under 6 or over 9.
- For bodyweight or time-based exercises, skip estimated 1RM and use rep/time/volume PRs instead.

### Volume PR formula

```ts
setVolume = weightUsed * repsCompleted
exerciseSessionVolume = sum(setVolume for exercise in session)
```

A volume PR occurs when current `exerciseSessionVolume` exceeds the previous best by at least 1%.

### Rep PR formula

A rep PR occurs when:

- same exercise
- same or higher load bucket
- reps exceed previous best reps at that load

Load bucket rules:

- barbell/dumbbell weighted movements: exact load
- machine movements: exact load unless machine metadata says otherwise
- bodyweight movements: bodyweight bucket

---

## 12. Muscle Group Volume Tracking

### `MuscleGroupVolumeSummary`

```ts
export interface MuscleGroupVolumeSummary {
  muscleGroup: MuscleGroup;
  weeklySets: number;
  targetSets: number;
  minimumEffectiveSets: number;
  maximumRecoverableSets: number;
  status: "below-minimum" | "productive" | "high" | "excessive";
  recommendation: "add-volume" | "maintain" | "reduce-volume" | "deload";
  reason: string;
}
```

Required tracking:

- weekly sets per muscle group
- rolling 4 week volume

### Weekly set counting

A set counts if:

- reps completed > 0
- set was not marked as skipped
- form quality is not `missed`

Primary muscle group receives 1.0 set.

Secondary muscle groups receive 0.5 sets.

### Volume status thresholds

For each muscle group:

- `< minimumEffectiveSets`: `below-minimum`
- `minimumEffectiveSets` through `targetSets + 20%`: `productive`
- `> targetSets + 20%` through `maximumRecoverableSets`: `high`
- `> maximumRecoverableSets`: `excessive`

### Rolling 4-week volume

```ts
export interface RollingFourWeekVolumeSummary {
  muscleGroup: MuscleGroup;
  week1Sets: number;
  week2Sets: number;
  week3Sets: number;
  week4Sets: number;
  averageSets: number;
  trend: "increasing" | "stable" | "decreasing" | "unknown";
  spikePercent?: number;
  fatigueRisk: "low" | "moderate" | "high";
}
```

Rolling 4-week volume should identify:

- rapid volume spikes
- chronic excessive volume
- undertraining for priority muscle groups
- deload needs after multiple high-volume weeks

Volume spike rule:

```ts
spikePercent = ((currentWeekSets - rolling4WeekAverage) / rolling4WeekAverage) * 100
```

Risk thresholds:

- spike > 30%: moderate fatigue risk
- spike > 50%: high fatigue risk
- 2+ consecutive weeks above maximum recoverable sets: high fatigue risk

---

## 13. Hypertrophy Progression

### `HypertrophyProgressionSummary`

```ts
export interface HypertrophyProgressionSummary {
  action: WorkoutProgressionDecision;
  muscleGroupStatuses: MuscleGroupVolumeSummary[];
  priorityMuscleGroups: MuscleGroup[];
  productiveVolumeMuscleGroups: MuscleGroup[];
  undertrainedMuscleGroups: MuscleGroup[];
  overreachedMuscleGroups: MuscleGroup[];
  recommendation: string;
  reason: string;
}
```

Hypertrophy progression should consider:

- weekly sets by muscle group
- rolling 4-week volume
- execution quality
- pump/connection notes if available later
- soreness by muscle group
- fatigue management
- fat-loss phase recovery constraints
- half-marathon training interference

Hypertrophy progression rules:

- `Progress`: target muscle groups are in productive volume range, sets are completed, RPE is controlled, no excessive soreness.
- `Repeat`: volume is productive but execution is not clean enough to add load/sets.
- `Reduce`: volume is high, soreness is moderate, or performance is slightly declining.
- `Deload`: volume is excessive or fatigue is high across multiple muscle groups.
- `Substitute`: specific exercises cause pain or repeated poor form.

---

## 14. Strength Progression

### `StrengthProgressionSummary`

```ts
export interface StrengthProgressionSummary {
  action: WorkoutProgressionDecision;
  estimatedOneRepMaxTrend: "improving" | "stable" | "declining" | "unknown";
  exercisesProgressing: string[];
  exercisesStalled: string[];
  exercisesRegressing: string[];
  recommendation: string;
  reason: string;
}
```

Strength progression should consider:

- estimated 1RM trend
- load PRs
- rep PRs
- top-set performance
- RPE at equivalent load
- missed reps
- pain and form quality

Strength progression rules:

- `Progress`: estimated 1RM or reps at load are improving with RPE <= 8.
- `Repeat`: performance is stable but not clean enough to increase load.
- `Reduce`: high RPE, missed reps, or declining estimated 1RM suggests load should come down.
- `Deload`: multiple compound lifts regress while fatigue is high.
- `Substitute`: lift causes pain or repeated poor form despite load reductions.

---

## 15. Fatigue Management

### `WorkoutFatigueSummary`

```ts
export interface WorkoutFatigueSummary {
  systemicFatigueScore: number;
  localFatigueByMuscleGroup: Record<MuscleGroup, number>;
  fatigueStatus: "low" | "moderate" | "high" | "severe";
  drivers: string[];
  recommendation: "normal" | "reduce-load" | "reduce-volume" | "deload";
}
```

Systemic fatigue score should combine:

- readiness status
- sleep hours
- soreness
- stress
- energy
- high RPE density
- missed reps density
- pain flags
- rolling 4-week volume spikes
- nutrition adherence if available
- alcohol days if available
- concurrent running load when Progression Engine V1 provides it later

Suggested scoring:

- start at 0
- +25 if readiness is Red
- +15 if readiness is Yellow
- +15 if sleep < 6 hours
- +25 if sleep < 5 hours
- +10 if soreness >= 7
- +20 if soreness >= 9
- +10 if high RPE sets are > 25% of sets
- +20 if missed reps are > 20% of prescribed reps
- +20 if any pain severity >= 6
- +15 if any muscle group has > 50% weekly volume spike
- +15 if 2+ muscle groups exceed maximum recoverable sets

Status:

- 0-24: `low`
- 25-49: `moderate`
- 50-74: `high`
- 75-100: `severe`

---

## 16. Deload Decisions

### `WorkoutDeloadDecision`

```ts
export interface WorkoutDeloadDecision {
  needed: boolean;
  scope: "none" | "exercise" | "muscle-group" | "full-body";
  targetMuscleGroups: MuscleGroup[];
  reductionPercent: number;
  durationDays: number;
  reason: string;
  triggers: string[];
}
```

Deload triggers:

- readiness Red with workout pain or severe fatigue
- systemic fatigue score >= 75
- 2+ muscle groups above maximum recoverable sets for 2 consecutive weeks
- pain severity >= 7 in any lift
- repeated missed reps across 2+ workouts
- estimated 1RM declining across 2+ exposures while RPE rises
- poor sleep plus high soreness

Deload intensity:

- exercise-level deload: reduce load 10-15% or sets 20% for one exercise
- muscle-group deload: reduce sets 30-40% for affected muscle group for 7 days
- full-body deload: reduce total lifting volume 40-50% for 7 days

---

## 17. Exercise Substitutions

### `ExerciseSubstitutionDecision`

```ts
export interface ExerciseSubstitutionDecision {
  exerciseId: string;
  exerciseName: string;
  shouldSubstitute: boolean;
  substituteExerciseId?: string;
  substituteExerciseName?: string;
  reason: string;
  trigger: "pain" | "poor-form" | "equipment" | "stalled-progress" | "fatigue" | "preference";
  confidenceScore: number;
}
```

Substitution rules:

- Pain severity >= 6 during an exercise: substitute next exposure.
- Same pain location appears in 2 consecutive exposures: substitute or reduce ROM/load.
- Poor form appears in 2 consecutive exposures despite load reduction: substitute.
- Exercise has 3 consecutive `Reduce` or `Repeat` decisions with no PRs and high RPE: consider substitution.
- Equipment unavailable: substitute within same movement pattern and muscle group.

Substitution should preserve:

- primary muscle group
- movement pattern when possible
- target stimulus
- fatigue cost

Examples:

- Barbell bench -> dumbbell bench or push-up variation for shoulder discomfort.
- Back squat -> leg press or goblet squat for back pain.
- Barbell row -> chest-supported row for low-back fatigue.
- Overhead press -> landmine press for shoulder pain.

---

## 18. Exercise History

### `ExerciseHistorySummary`

```ts
export interface ExerciseHistorySummary {
  exerciseId: string;
  exerciseName: string;
  exposures: number;
  lastPerformedAt?: string;
  averageSets: number;
  averageReps: number;
  averageLoad: number;
  averageRpe: number;
  bestEstimatedOneRepMax?: number;
  bestVolume?: number;
  recentTrend: "improving" | "stable" | "declining" | "unknown";
  lastDecision?: WorkoutProgressionDecision;
  notes: string[];
}
```

Exercise history should power:

- next load selection
- PR detection
- stalling detection
- substitution decisions
- confidence scoring
- audit entries

Minimum useful history:

- 1 exposure: low confidence
- 2-3 exposures: medium confidence
- 4+ exposures: high confidence for trend decisions

---

## 19. Confidence Scoring

### `WorkoutConfidenceScore`

Confidence score should be 0-100.

Inputs:

- set history completeness
- exercise metadata completeness
- recent workout count
- readiness availability
- pain severity availability
- form quality availability
- RPE availability
- bodyweight/equipment metadata for PR interpretation

Suggested scoring:

- Start at 100.
- -20 if fewer than 2 exposures for the exercise.
- -15 if exercise metadata is missing muscle group.
- -10 if RPE is missing or defaulted.
- -10 if form quality is missing.
- -10 if readiness is missing.
- -10 if pain severity is missing when pain is true.
- -10 if historical sets are unavailable.
- -5 if workout status is `ended` instead of `completed`.

Score labels:

```ts
export type WorkoutConfidence = "High" | "Medium" | "Low";
```

- 80-100: High
- 60-79: Medium
- 0-59: Low

---

## 20. Data Quality Scoring

### `WorkoutDataQualityScore`

Data quality score should be 0-100 and independent from confidence.

It answers: how complete and reliable is the source data?

Required fields for high quality:

- exercise ID
- exercise name
- muscle group mapping
- set number
- target reps
- target RPE
- weight used
- reps completed
- actual RPE
- pain boolean
- form quality
- completed timestamp

Suggested scoring:

- Start at 100.
- -15 if exercise IDs are missing or inconsistent.
- -15 if muscle group mapping is missing.
- -15 if more than 25% of sets lack RPE.
- -15 if more than 25% of sets lack form quality.
- -10 if pain severity is missing when pain is true.
- -10 if timestamps are missing.
- -10 if historical sessions are unavailable.
- -5 if planned workout data is missing.

Data quality labels:

- 80-100: complete enough for progression decisions
- 60-79: usable with caution
- 0-59: conservative decisions only

Missing-data behavior:

- Never invent PRs without enough set data.
- Never progress load if RPE, reps, or form quality are missing.
- If muscle group metadata is missing, calculate exercise-level decisions but mark volume tracking low confidence.
- If historical data is missing, allow only `Repeat`, `Reduce`, `Deload`, or `Substitute`; do not call a new all-time PR.

---

## 21. Explanation Fields

### `WorkoutExplanation`

```ts
export interface WorkoutExplanation {
  summary: string;
  primaryDrivers: string[];
  blockers: string[];
  supportingSignals: string[];
  tradeoffs: string[];
  missingData: string[];
}
```

Explanation should answer:

- What changed?
- Why did the engine choose this action?
- What data was used?
- What blocked progression?
- What should happen next time?

Examples:

- "Bench press can progress because all prescribed reps were completed at RPE 8 or lower with solid form."
- "Squat should reduce because RPE was 9 and reps were missed on the final two sets."
- "Overhead press should substitute because shoulder pain was reported for the second consecutive exposure."
- "Full-body deload is recommended because fatigue is severe and multiple muscle groups exceed recoverable volume."

---

## 22. Recommendation Audit Trail

### `WorkoutAuditEntry`

```ts
export interface WorkoutAuditEntry {
  id: string;
  timestamp: string;
  decisionType:
    | "exercise-progression"
    | "hypertrophy-progression"
    | "strength-progression"
    | "pr-detection"
    | "muscle-volume"
    | "fatigue-management"
    | "deload"
    | "substitution"
    | "overall-recommendation";
  subjectId?: string;
  subjectName?: string;
  action: string;
  reason: string;
  dataUsed: string[];
  thresholdsApplied: string[];
  confidenceScore: number;
  dataQualityScore: number;
}
```

Every final decision should have an audit entry.

Audit entries should make it possible to explain exactly why a recommendation happened without recalculating the engine.

---

## 23. Overall Decision Rules

Overall decision should be derived from exercise decisions, fatigue, deload, substitutions, and volume status.

Priority order:

1. If any required substitution is safety-related, overall decision is `Substitute`.
2. Else if full-body deload is needed, overall decision is `Deload`.
3. Else if muscle-group deload is needed, overall decision is `Deload`.
4. Else if multiple exercises require load/volume reduction, overall decision is `Reduce`.
5. Else if most exercises are repeat and none progress, overall decision is `Repeat`.
6. Else if key exercises can progress and fatigue is low/moderate, overall decision is `Progress`.
7. Else default to `Repeat`.

Safety override:

- Pain severity >= 7 always blocks progression for that exercise.
- Red readiness plus workout pain blocks aggressive lifting and should force `Deload` or `Substitute` depending on locality.
- Poor form on heavy compound lifts blocks load progression.

---

## 24. Integration Plan

### Future `workout-logger.ts` migration

`evaluateWorkoutLoggerResult()` should eventually become a compatibility wrapper:

1. Build `WorkoutEngineInput` from the logged session and recovery context.
2. Call `evaluateWorkout()`.
3. Project `WorkoutEngineResult` back into the existing `WorkoutLoggerResult` shape.
4. Preserve existing logger UI and workflow.

Legacy output mapping:

- `Progress` -> existing `progress`
- `Repeat` -> existing `repeat`
- `Reduce` -> existing `reduce-volume` or future `reduce`
- `Deload` -> existing `reduce-volume` with stronger deload copy
- `Substitute` -> existing post-workout recommendation action `substitute`

### Future `coach-engine.ts` migration

Workout preview, set-by-set recommendations, post-workout analysis, and substitutions should consume Workout Engine V2.

Legacy wrappers should preserve existing function names until UI migration is approved.

### Future `weekly-review.ts` migration

Weekly Review should consume:

- weekly sets per muscle group
- rolling 4-week volume
- fatigue status
- deload decision
- overall workout decision
- PR summary
- confidence score
- data quality score

Weekly Review should not independently recalculate workout progression once Workout Engine V2 is connected.

### Future Progression Engine V1 integration

Progression Engine V1 should consume a stable adapter:

```ts
progressionWorkoutInputFromWorkoutEngineV2(result: WorkoutEngineResult)
```

Adapter output:

```ts
export interface ProgressionWorkoutInputFromWorkoutEngineV2 {
  workoutDecision: WorkoutProgressionDecision;
  fatigueScore: number;
  deloadNeeded: boolean;
  muscleGroupVolumeStatus: Record<MuscleGroup, MuscleGroupVolumeSummary["status"]>;
  confidenceScore: number;
  dataQualityScore: number;
  explanations: string[];
}
```

Progression Engine V1 must not recalculate workout progression after Workout Engine V2 exists.

---

## 25. Future Implementation File Plan

Future implementation should create:

- `src/lib/workout-engine.ts`
- `src/lib/workout-engine.test.ts`

Future consumer migration may modify:

- `src/lib/workout-logger.ts`
- `src/lib/workout-logger.test.ts`
- `src/lib/coach-engine.ts`
- `src/lib/coach-engine.test.ts`
- `src/lib/weekly-review.ts`
- `src/lib/weekly-review.test.ts`
- `src/lib/progression-engine.ts`
- `src/lib/progression-engine.test.ts`
- `src/lib/types.ts` only if compatibility types need widening

Do not modify UI unless a future task explicitly requests it.

Do not modify `src/app/page.tsx` unless absolutely required for a compatibility import or adapter call, and prefer not to.

---

## 26. Future Test Plan

Future tests should prove:

- `evaluateWorkout()` returns the canonical `WorkoutEngineResult` shape.
- All decisions are possible: `Progress`, `Repeat`, `Reduce`, `Deload`, `Substitute`.
- Chest, back, shoulders, arms, legs, and core volume are tracked.
- Weekly sets per muscle group are counted correctly.
- Rolling 4-week volume identifies increasing, stable, decreasing, and spike patterns.
- Estimated 1RM uses the Epley formula and excludes invalid sets.
- Rep PRs are detected correctly.
- Volume PRs are detected correctly.
- Load PRs are detected correctly.
- High RPE blocks progression.
- Missed reps block progression.
- Pain can trigger substitution.
- Severe fatigue can trigger deload.
- Confidence score drops when history or metadata is missing.
- Data quality score drops when logged set data is incomplete.
- Explanation includes drivers, blockers, supporting signals, tradeoffs, and missing data.
- Audit trail includes entries for progression, PRs, volume, fatigue, deload, and substitutions.
- Legacy wrappers preserve existing return shapes after migration.

Verification commands for future implementation:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

---

## 27. Acceptance Criteria

Workout Engine V2 architecture is complete when:

- It defines `WorkoutEngineInput`.
- It defines `WorkoutEngineResult`.
- It defines the canonical action vocabulary: `Progress`, `Repeat`, `Reduce`, `Deload`, `Substitute`.
- It supports chest, back, shoulders, arms, legs, and core.
- It tracks weekly sets per muscle group.
- It tracks rolling 4-week volume.
- It tracks exercise PRs.
- It tracks estimated 1RM.
- It tracks rep PRs.
- It tracks volume PRs.
- It defines confidence scoring.
- It defines data quality scoring.
- It defines explanation fields.
- It defines recommendation audit trail fields.
- It includes fatigue management and deload decision rules.
- It includes exercise substitution rules.
- It includes exercise history requirements.
- It explains how future consumers should migrate without UI redesign.

---

## 28. Explicit Scope Boundary

This file is the only deliverable for the architecture task.

No code should be implemented from this document until explicitly requested.

No UI should be changed from this document until explicitly requested.

No visual styling should change from this document.

No screens should be created from this document.

No user workflows should change from this document.

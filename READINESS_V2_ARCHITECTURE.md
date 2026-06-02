# READINESS V2 ARCHITECTURE

Goal: create exactly one readiness engine for Home, Train, Log, Weekly Review, and Daily Prescription.

Scope of this document: architecture only. No UI implementation is included here.

Primary files inspected:

- `src/lib/coach-engine.ts`
- `src/lib/daily-checkin.ts`
- `src/lib/weekly-review.ts`
- `src/lib/types.ts`
- `src/app/page.tsx`

---

## 1. Problem Statement

The app currently has multiple recovery/readiness decision systems:

1. `calculateReadiness()` in `src/lib/coach-engine.ts`
2. `evaluateDailyRecoveryStatus()` in `src/lib/daily-checkin.ts`
3. Weekly review recovery logic in `src/lib/weekly-review.ts`

These systems use different thresholds for the same human signals. The result is that the app can tell the user different things depending on which screen they are viewing.

Examples from current code:

- Stress `5` is Red in Daily Check-In but has no effect in main readiness unless stress is `8+`.
- Pain severity `6` forces main readiness below Green/Yellow through the significant-pain cap, but Daily Check-In Red requires pain severity `7+`.
- Sleep `6.2` is Yellow in Daily Check-In but only a small deduction in main readiness.
- Weekly Review can recommend `Deload` based on weekly average sleep/soreness without consuming the same readiness result used by Home/Train.

Readiness Refactor V2 should remove this split by creating one canonical `ReadinessEngine`.

---

## 2. Old System

### 2.1 Main readiness: `calculateReadiness()`

Location: `src/lib/coach-engine.ts`

Current consumers:

- Home readiness status
- Train readiness status
- `adjustWorkoutForReadiness()`
- `generateRunningRecommendation()` via `nextDayReadiness`
- `generateDailyPrescription()`
- Home command center
- automatic adjustment logs in `page.tsx`

Inputs:

- `DailyCheckIn`
- baseline resting HR
- baseline HRV

Current scoring:

```text
score starts at 100

sleepHours < 6            -20
sleepHours < 7            -10
sleepQuality <= 4         -10
soreness >= 8             -25
soreness >= 6             -10
energy <= 3               -20
energy <= 5               -10
stress >= 8               -10
restingHr > baseline + 8  -15
hrv < baseline * 0.8      -15
pain severity >= 6        -35
pain severity >= 4        -15
alcohol + sleepQuality<=5 -15
alcohol otherwise         -5
```

Safety override:

```text
if pain && painSeverity >= 6:
  score = min(score, 59)
```

Status thresholds:

```text
Green: score >= 80
Yellow: 60 <= score < 80
Red: score < 60
```

Current output shape:

```ts
interface ReadinessScore {
  id?: string;
  userId?: string;
  date?: string;
  score: number;
  status: "Green" | "Yellow" | "Red";
  reason: string;
  recommendation: string;
}
```

Problems:

- It returns one joined `reason` string, not structured reasons.
- It does not expose per-factor severity.
- It does not distinguish daily recommendation from weekly recommendation.
- It includes `sleepQuality`, but the current Daily Check-In UI does not collect sleep quality.
- It includes HRV/resting HR, but the current Daily Check-In UI does not expose them.
- Its thresholds do not match Daily Check-In or Weekly Review.

### 2.2 Daily Check-In recovery: `evaluateDailyRecoveryStatus()`

Location: `src/lib/daily-checkin.ts`

Current consumers:

- Log tab Daily Check-In preview
- Log tab saved recovery status
- `mvp-dashboard.ts`
- Daily Check-In tests

Inputs:

- `DailyCheckIn`

Current Red rules:

```text
sleepHours < 5
soreness >= 8
stress >= 5
energy <= 1
pain && painSeverity >= 7
```

Current Yellow rules:

```text
5 <= sleepHours < 6.5
6 <= soreness <= 7
stress == 4
energy == 2
pain && 4 <= painSeverity <= 6
alcohol == true
```

Current output shape:

```ts
interface DailyRecoveryStatus {
  status: "Green" | "Yellow" | "Red";
  recommendation: string;
  reasoning: string;
  reasons: string[];
}
```

Problems:

- It is categorical only; no numeric score.
- Stress threshold is much stricter than main readiness.
- Energy threshold is much looser than main readiness for Red.
- It returns `reasoning`, while main readiness returns `reason`.
- It cannot be used directly by Train/Home without type/semantic mismatch.

### 2.3 Weekly Review recovery logic

Location: `src/lib/weekly-review.ts`

Current consumers:

- Progress tab Weekly Review
- Home command center indirectly through `buildWeeklyReviewSummary()`
- Weekly review tests

Current recovery-related logic:

```text
highPain = any pain flag containing 7/10, 8/10, 9/10, or 10/10

if highPain:
  nextWeekRecommendation = Recovery focus

poorRecovery = averageSleep < 6 OR averageSoreness >= 7.5

if poorRecovery:
  nextWeekRecommendation = Deload
```

Problems:

- It does not consume `calculateReadiness()`.
- It does not consume `evaluateDailyRecoveryStatus()`.
- It does not consider stress, energy, alcohol, resting HR, or HRV in its weekly recovery recommendation.
- It uses average sleep and average soreness only, plus regex-based pain flags.
- Its weekly recovery conclusion can conflict with Home/Train readiness.

### 2.4 Current screen-level data flow

```text
Daily Check-In / Log:
  evaluateDailyRecoveryStatus(form)

Home:
  calculateReadiness(latestCheckIn, baseline)

Train:
  calculateReadiness(latestCheckIn, baseline)
  adjustWorkoutForReadiness(currentWorkout, readiness.status)

Daily Prescription:
  generateDailyPrescription({ readiness: calculateReadiness(...) })

Weekly Review:
  buildWeeklyReviewSummary(...)
  chooseRecommendation({ averageSleep, averageSoreness, painFlags, ... })
```

This is the core architecture bug: readiness is calculated in multiple places instead of one place.

---

## 3. New System

### 3.1 Canonical module

Create one new module:

```text
src/lib/readiness-engine.ts
```

This module owns all readiness scoring, status thresholds, reasons, and recovery recommendations.

It should export one canonical engine object/function:

```ts
export function evaluateReadiness(input: ReadinessEngineInput): ReadinessEngineResult
```

Optional helper functions can exist inside the same module, but no other module should independently decide Green/Yellow/Red from raw recovery fields.

### 3.2 Canonical input type

The engine input should be independent from `DailyCheckIn` so Weekly Review can pass averages/aggregate values without pretending they are a daily check-in.

```ts
export interface ReadinessEngineInput {
  date?: string;
  mode?: "daily" | "weekly";

  sleep: number | null;
  soreness: number | null;
  stress: number | null;
  energy: number | null;
  alcohol: boolean | number | null;
  pain: boolean | null;
  painSeverity: number | null;
  restingHr: number | null;
  hrv: number | null;

  baseline?: {
    restingHr?: number | null;
    hrv?: number | null;
  };
}
```

Required user-level inputs from the request:

- sleep
- soreness
- stress
- energy
- alcohol
- pain
- pain severity
- resting HR
- HRV

Design notes:

- Use `sleep`, not `sleepHours`, at the engine boundary.
- Use `painSeverity`, not `painScore`, at the engine boundary.
- Weekly Review should convert weekly averages/counts into this same shape.
- Run pain can be represented separately as a pain severity contribution before calling the engine, or folded into the weekly `painSeverity` value.
- `alcohol` can be boolean for daily mode or count for weekly mode.

### 3.3 Canonical output type

```ts
export type ReadinessStatus = "Green" | "Yellow" | "Red";

export type ReadinessRecommendationType =
  | "full_training"
  | "modified_training"
  | "deload"
  | "recovery_focus";

export interface ReadinessReason {
  factor:
    | "sleep"
    | "soreness"
    | "stress"
    | "energy"
    | "alcohol"
    | "pain"
    | "resting_hr"
    | "hrv"
    | "data_quality";
  severity: "info" | "yellow" | "red";
  points: number;
  message: string;
}

export interface ReadinessEngineResult {
  score: number;
  status: ReadinessStatus;
  confidence: "High" | "Medium" | "Low";
  reasons: ReadinessReason[];
  reason: string;
  recommendation: string;
  recommendationType: ReadinessRecommendationType;
  trainingGuidance: string;
  recoveryGuidance: string[];
  dataQualityWarnings: string[];
}
```

Compatibility note:

- Keep `reason` and `recommendation` on the result so existing consumers that expect `ReadinessScore` can migrate with fewer changes.
- Add `reasons[]` for structured UI and Weekly Review logic.
- Keep `dataQualityWarnings[]` separate from `confidence`; warnings explain what is missing or stale, while confidence summarizes how much trust to place in the readiness result.

Confidence rules:

```text
High:
  core subjective data is present
  AND HRV is present
  AND resting HR is present

Medium:
  core subjective data is present
  BUT HRV and/or resting HR is missing

Low:
  missing key subjective data such as sleep, soreness, stress, energy, or pain status
```

Core subjective data:

```text
sleep
soreness
stress
energy
pain status
```

### 3.4 Canonical scoring rules

The new engine should combine the best parts of the old system while removing contradictions.

Proposed scoring:

```text
score starts at 100
```

Sleep:

```text
sleep < 5.0       -30 red reason
5.0 <= sleep < 6  -20 yellow reason
6.0 <= sleep < 7  -10 yellow/info reason
```

Soreness:

```text
soreness >= 8     -25 red reason
6 <= soreness < 8 -10 yellow reason
```

Stress:

```text
stress 1-5        no deduction
stress 6-7        -10 yellow reason
stress 8-10       -15 red reason
```

Energy:

```text
energy <= 2       -25 red reason
3 <= energy <= 5  -10 yellow reason
```

Alcohol:

Daily mode:

```text
alcohol == true   -5 yellow reason
```

Weekly mode:

```text
alcohol days >= 2 -10 yellow reason
alcohol days >= 4 -20 red reason
```

Pain:

```text
pain && painSeverity >= 7   -40 red reason + status cap Red
pain && painSeverity >= 6   -35 red reason + status cap Red
pain && painSeverity >= 4   -15 yellow reason
pain true but severity null -10 yellow reason + data quality warning
```

Resting HR:

```text
if baseline.restingHr exists and restingHr > baseline + 8:
  -15 yellow reason
```

HRV:

```text
if baseline.hrv exists and hrv < baseline * 0.8:
  -15 yellow reason
```

Missing data:

```text
missing resting HR -> data quality warning only
missing HRV -> data quality warning only
missing pain severity while pain is true -> score deduction and warning
```

Status thresholds:

```text
Green: score >= 80 and no red-cap condition
Yellow: 60 <= score < 80 and no red-cap condition
Red: score < 60 OR red-cap condition
```

Red-cap conditions:

```text
pain && painSeverity >= 6
sleep < 5 combined with energy <= 2
```

Why this rule set:

- Keeps main readiness score concept.
- Keeps Daily Check-In’s strict sleep and soreness safety gates.
- Stress uses a CRNA-schedule-aware threshold: stress `1-5` does not modify training, stress `6-7` creates a Yellow deduction, and stress `8-10` creates a Red reason.
- Makes pain severity `6+` consistently Red everywhere.
- Allows weekly mode to use alcohol count rather than boolean.
- Treats HRV/resting HR as useful but not mandatory until wearable integration exists.

### 3.5 Recommendation mapping

The engine should be the only place that maps readiness to recovery/training recommendation.

```text
Green:
  recommendationType = full_training
  recommendation = Complete planned training. Progress only if form and RPE support it.

Yellow:
  recommendationType = modified_training
  recommendation = Keep training but reduce volume 10-25%, cap RPE at 7, avoid max efforts.

Red with pain >= 6:
  recommendationType = recovery_focus
  recommendation = No heavy lifting, sprinting, hard intervals, or painful movement. Recovery focus.

Red without major pain:
  recommendationType = deload OR recovery_focus depending reasons
  recommendation = Replace hard work with walking, mobility, hydration, sleep, and easy Zone 2 only if symptoms improve.
```

Weekly mapping:

```text
weekly Green:
  Weekly Review may choose Progress if long run/lifts/adherence also support it.

weekly Yellow:
  Weekly Review does not automatically force Repeat.
  Progress is still allowed if there is no significant pain, the long run was completed, adherence is >=85, and there is no major recovery warning.

weekly Red with pain:
  Weekly Review chooses Recovery focus.

weekly Red without pain:
  Weekly Review chooses Deload.
```

Important distinction:

- The readiness engine decides recovery risk.
- Weekly Review still decides next-week progression, but it must use the readiness result as the recovery input instead of calculating recovery independently.

### 3.6 Adapter functions

Create adapters in `readiness-engine.ts` or a small adjacent helper file.

#### Daily Check-In adapter

```ts
export function readinessInputFromDailyCheckIn(
  checkIn: DailyCheckIn,
  baseline?: ReadinessEngineInput["baseline"]
): ReadinessEngineInput
```

Mapping:

```text
sleep        <- checkIn.sleepHours
soreness     <- checkIn.soreness
stress       <- checkIn.stress
energy       <- checkIn.energy
alcohol      <- checkIn.alcohol
pain         <- checkIn.pain
painSeverity <- checkIn.painSeverity
restingHr    <- checkIn.restingHr
hrv          <- checkIn.hrv
baseline     <- caller baseline
mode         <- daily
```

#### Weekly Review adapter

```ts
export function readinessInputFromWeeklyWindow(input: {
  checkIns: DailyCheckIn[];
  runPainSeverity?: number | null;
  baseline?: ReadinessEngineInput["baseline"];
}): ReadinessEngineInput
```

Mapping:

```text
sleep        <- average check-in sleepHours
soreness     <- average check-in soreness
stress       <- average check-in stress
energy       <- average check-in energy
alcohol      <- count check-ins with alcohol true
pain         <- any check-in pain OR run pain
painSeverity <- max check-in painSeverity and run pain severity
restingHr    <- average restingHr if present
hrv          <- average HRV if present
mode         <- weekly
```

This makes Weekly Review consume the same engine without forcing it into a fake daily record.

### 3.7 Backward-compatible wrapper plan

To reduce implementation risk, keep old exported function names temporarily but make them wrappers.

#### `calculateReadiness()` wrapper

Current public API:

```ts
calculateReadiness(checkIn: DailyCheckIn, baseline: { restingHr: number; hrv: number }): ReadinessScore
```

V2 behavior:

```text
calculateReadiness() calls evaluateReadiness(readinessInputFromDailyCheckIn(...))
returns result shaped as ReadinessScore-compatible object
```

This allows Home, Train, and Daily Prescription to continue compiling while the internals become unified.

#### `evaluateDailyRecoveryStatus()` wrapper

Current public API:

```ts
evaluateDailyRecoveryStatus(checkIn: DailyCheckIn): DailyRecoveryStatus
```

V2 behavior:

```text
evaluateDailyRecoveryStatus() calls evaluateReadiness(readinessInputFromDailyCheckIn(...))
returns status, recommendation, reasoning, reasons[] derived from same engine result
```

This allows Log to use the same engine without UI changes.

#### Weekly Review direct consumption

`buildWeeklyReviewSummary()` should stop using local `averageSleep < 6`, `averageSoreness >= 7.5`, and regex pain severity as the recovery decision source.

Instead:

```text
weeklyReadiness = evaluateReadiness(readinessInputFromWeeklyWindow(...))
chooseRecommendation(..., weeklyReadiness)
```

Weekly Review can still include pain flags and average sleep in the displayed summary, but the recovery branch should use `weeklyReadiness`.

---

## 4. New Data Flow

### 4.1 Daily Log

Old:

```text
DailyCheckInForm -> evaluateDailyRecoveryStatus(form)
```

New:

```text
DailyCheckInForm
  -> readinessInputFromDailyCheckIn(form, baseline)
  -> evaluateReadiness(input)
  -> display result through existing Log UI fields
```

No UI change required in the first implementation if `evaluateDailyRecoveryStatus()` remains as a wrapper.

### 4.2 Home

Old:

```text
latestCheckIn -> calculateReadiness(latestCheckIn, baseline)
```

New:

```text
latestCheckIn
  -> readinessInputFromDailyCheckIn(latestCheckIn, baseline)
  -> evaluateReadiness(input)
  -> Home readiness card
```

No visible UI change required if `calculateReadiness()` remains as a wrapper.

### 4.3 Train

Old:

```text
calculateReadiness()
  -> adjustedWorkout = adjustWorkoutForReadiness(workout, readiness.status)
  -> runningRecommendation(nextDayReadiness: readiness.status)
```

New:

```text
evaluateReadiness()
  -> adjustedWorkout = adjustWorkoutForReadiness(workout, readiness.status)
  -> runningRecommendation(nextDayReadiness: readiness.status)
```

The consumer still uses `status`, but the source of that status is the one engine.

### 4.4 Daily Prescription

Old:

```text
generateDailyPrescription({ readiness: calculateReadiness(...) })
```

New:

```text
generateDailyPrescription({ readiness: evaluateReadiness(...) })
```

No behavior fork should exist inside Daily Prescription. It should not calculate its own readiness.

### 4.5 Weekly Review

Old:

```text
averageSleep < 6 OR averageSoreness >= 7.5 -> Deload
high pain regex -> Recovery focus
```

New:

```text
weeklyReadiness = evaluateReadiness(weeklyInput)

if weeklyReadiness.status === Red and pain reason exists:
  Recovery focus
else if weeklyReadiness.status === Red:
  Deload
else if weeklyReadiness.status === Yellow:
  Progress is allowed if no significant pain, long run completed, adherence >=85, and no major recovery warning
else:
  Progress/Repeat based on long run, lifts, adherence, alcohol, etc.
```

Weekly Review keeps the requested fields:

- Average weight
- Weight change
- Total weekly miles
- Long run completed yes/no
- Number of lifts completed
- Average calories
- Average protein
- Average sleep
- Alcohol days
- Pain flags
- Adherence score
- Next week recommendation

But its recovery conclusion comes from the canonical engine.

---

## 5. Migration Plan

### Phase 0 — Architecture document only

Status: this document.

Rules:

- Do not modify UI.
- Do not change behavior yet.
- Capture current duplicate engines and define the new target architecture.

### Phase 1 — Create `ReadinessEngine` with tests

Files:

- Create: `src/lib/readiness-engine.ts`
- Create: `src/lib/readiness-engine.test.ts`

Test coverage:

1. Green day:
   - sleep 7.5, soreness 3, stress 2, energy 8, no alcohol, no pain
   - expected Green, score >=80
2. Yellow sleep:
   - sleep 5.8
   - expected Yellow reason for sleep
3. Red pain:
   - pain true, painSeverity 6
   - expected Red, score <=59, recovery focus recommendation
4. Red severe sleep + energy:
   - sleep 4.5, energy 2
   - expected Red
5. Stress consistency:
   - stress 5
   - expected no deduction because moderate occupational stress should not automatically modify training
   - stress 6-7
   - expected Yellow reason
   - stress 8-10
   - expected Red reason
6. Alcohol daily:
   - alcohol true
   - expected small deduction and Yellow-cap only if score crosses threshold
7. Alcohol weekly:
   - mode weekly, alcohol 2
   - expected weekly alcohol reason
8. HRV/resting HR:
   - elevated resting HR and low HRV against baseline
   - expected reasons and deductions
9. Missing biometric data:
   - null HRV/resting HR
   - expected data quality warnings, no crash
10. Structured reasons:
   - output includes factor, severity, points, message
11. Confidence:
   - core subjective data plus HRV/resting HR present -> High
   - core subjective data present but HRV/resting HR missing -> Medium
   - missing sleep, soreness, stress, energy, or pain status -> Low

Verification command:

```bash
pnpm test src/lib/readiness-engine.test.ts
```

Expected:

```text
readiness-engine tests pass
```

### Phase 2 — Wrap old APIs without changing UI

Files:

- Modify: `src/lib/coach-engine.ts`
- Modify: `src/lib/daily-checkin.ts`
- Modify tests:
  - `src/lib/coach-engine.test.ts`
  - `src/lib/daily-checkin.test.ts`

Implementation:

- Replace internal body of `calculateReadiness()` with a call to `evaluateReadiness()`.
- Replace internal body of `evaluateDailyRecoveryStatus()` with a call to `evaluateReadiness()`.
- Preserve public output shapes.
- Keep existing imports in `page.tsx` unchanged.

Purpose:

- Home, Train, Log, and Daily Prescription now indirectly consume the same engine without UI changes.

Verification commands:

```bash
pnpm test src/lib/readiness-engine.test.ts src/lib/coach-engine.test.ts src/lib/daily-checkin.test.ts
pnpm typecheck
```

### Phase 3 — Migrate Weekly Review recovery decision

Files:

- Modify: `src/lib/weekly-review.ts`
- Modify: `src/lib/weekly-review.test.ts`

Implementation:

- Build weekly readiness input from weekly check-ins and run pain.
- Call `evaluateReadiness()`.
- Update `chooseRecommendation()` to consume `weeklyReadiness` instead of independently computing poor recovery from `averageSleep` and `averageSoreness`.
- Preserve the existing `WeeklyReviewSummary` output shape unless a future UI change explicitly asks to display readiness details.

Recommended internal signature:

```ts
function chooseRecommendation(input: {
  weeklyReadiness: ReadinessEngineResult;
  painFlags: string[];
  longRunCompleted: boolean;
  longRun?: RunLog;
  liftsCompleted: number;
  adherenceScore: number;
  alcoholDays: number;
}): { nextWeekRecommendation: NextWeekRecommendation; recommendationReason: string }
```

Verification commands:

```bash
pnpm test src/lib/weekly-review.test.ts src/lib/readiness-engine.test.ts
pnpm typecheck
```

### Phase 4 — Full regression verification

Run the full project checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected:

```text
All tests pass.
Typecheck passes.
Lint passes.
Build passes.
```

### Phase 5 — Optional UI cleanup later, not now

Only after the engine is unified and verified:

- Update imports in `page.tsx` to call `evaluateReadiness()` directly if desired.
- Display structured reasons in Home/Train/Log.
- Show weekly readiness status inside Weekly Review.
- Add data-quality warnings for stale/default HRV/resting HR/pain fields.

This phase is explicitly out of scope for the current request because the user said: Do not modify UI yet.

---

## 6. Acceptance Criteria

Readiness Refactor V2 is complete when:

1. There is exactly one readiness scoring implementation: `evaluateReadiness()` in `src/lib/readiness-engine.ts`.
2. `calculateReadiness()` no longer has independent thresholds; it is a compatibility wrapper.
3. `evaluateDailyRecoveryStatus()` no longer has independent thresholds; it is a compatibility wrapper.
4. Weekly Review no longer independently decides poor recovery from separate sleep/soreness thresholds.
5. Home consumes the canonical result, directly or through `calculateReadiness()` wrapper.
6. Train consumes the canonical result, directly or through `calculateReadiness()` wrapper.
7. Log consumes the canonical result, directly or through `evaluateDailyRecoveryStatus()` wrapper.
8. Daily Prescription consumes the canonical result.
9. Weekly Review consumes the canonical result.
10. Tests prove the same inputs produce the same readiness status everywhere.
11. No UI changes are required for the first implementation pass.

---

## 7. Non-Goals

The V2 readiness refactor should not do these unless separately requested:

- Redesign Home, Train, Log, Progress, or Weekly Review UI.
- Add Apple Health integration.
- Add wearable sync.
- Add new check-in fields.
- Change the weekly review card layout.
- Change the app navigation.
- Rewrite running progression.
- Rewrite nutrition targets.
- Add database persistence changes.

---

## 8. Implementation Notes and Risks

### 8.1 Biggest behavior change

The biggest behavior change will be stress handling.

Old behavior:

- Daily Check-In: stress `5+` = Red.
- Main readiness: stress only matters at `8+`.

Proposed V2 behavior:

- stress `5-7` = Yellow deduction.
- stress `8+` = stronger deduction.
- stress alone does not automatically force Red unless the final score crosses Red.

This avoids overreacting to moderate stress while still making stress matter consistently.

### 8.2 Pain must remain conservative

Pain severity `6+` should consistently cap readiness at Red. This is the safest rule because the app combines lifting, running, calorie deficit, sprints, and long runs.

### 8.3 Missing biometric data should not punish the user

Until wearables are integrated, missing resting HR and HRV should create data quality warnings, not automatic readiness penalties.

### 8.4 Weekly mode should not fake daily precision

Weekly Review should pass weekly averages/counts into the engine with `mode: "weekly"`. It should not construct an artificial `DailyCheckIn` and pretend it represents a real day.

### 8.5 Keep wrappers during migration

Removing old function names immediately would cause broad churn across tests and page code. Wrapping them first unifies behavior while keeping implementation risk low.

---

## 9. Recommended Future File Ownership

After implementation, responsibility should be:

```text
src/lib/readiness-engine.ts
  Owns readiness scoring, status, reasons, recommendations, daily adapter, weekly adapter.

src/lib/daily-checkin.ts
  Owns check-in upsert and completion derivation.
  Does not own readiness thresholds.

src/lib/coach-engine.ts
  Owns training, nutrition, run, and prescription logic.
  Does not own readiness thresholds, except temporary compatibility wrapper.

src/lib/weekly-review.ts
  Owns weekly metrics and next-week recommendation.
  Does not own raw readiness thresholds.
```

Long-term ideal:

- Remove `calculateReadiness()` as a separate exported API after all call sites use `evaluateReadiness()` directly.
- Remove `evaluateDailyRecoveryStatus()` as a separate exported API after Log UI uses `ReadinessEngineResult` directly.

Short-term implementation should keep both wrappers to avoid UI changes.

---

## 10. Summary

Readiness V2 should consolidate all readiness/recovery judgment into one deterministic engine:

```text
ReadinessEngineInput -> evaluateReadiness() -> ReadinessEngineResult
```

Every surface should consume that same result:

```text
Home              -> same result
Train             -> same result
Log               -> same result
Daily Prescription -> same result
Weekly Review     -> same result
```

The refactor should start with tests and compatibility wrappers, then migrate Weekly Review. UI changes should wait until after the engine is unified and verified.

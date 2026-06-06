# HOME_ADAPTER_CONTRACT_V1

**Phase:** 27D — Home Adapter Contract & Pure Model Design V1  
**Mode:** Design / contract only  
**Status:** Documentation only; no code, tests, UI, source-of-truth, adapter implementation, or planner promotion changed  
**Planner status:** Developer-only, advisory-only, read-only, not promoted

## Scope boundary

This document defines the production-safe Home adapter contract required before any runtime pilot that maps `DailyTrainingSession` into a Home training display model.

This phase does **not** modify code, tests, UI, Home runtime behavior, persistence, recommendation behavior, readiness behavior, progression behavior, logging behavior, or source-of-truth ownership.

## Files reviewed

- `PLANNER_PROMOTION_CONTRACT_V1.md`
- `PLANNER_INPUT_CONTRACT_V1.md`
- `src/lib/training-planner.ts`
- `src/lib/training-planner-adapter.ts`
- `src/lib/home-command-center.ts`
- `src/lib/home-daily-dashboard.ts`
- `src/lib/mission-control-ui.ts`
- `src/lib/readiness-engine.ts`
- `src/lib/progression-engine.ts`
- `src/lib/training-engine.ts`
- `src/lib/coach-engine.ts`
- `src/lib/types.ts`
- `src/app/page.tsx`

---

# 1. DailyTrainingSession ownership model

## 1.1 Planner-owned fields

The planner may own these fields inside `DailyTrainingSession` after a production-safe input adapter provides real domain inputs:

- `id`
- `date`
- `currentWeek`
- `dayIndex`
- `sourcePlan`
  - `source`
  - `sourceWorkoutId`
  - `sourceWorkoutTitle`
  - `sourceWorkoutType`
  - `sourceWorkoutDeload`
  - `resolvedSessionType`
- `sessionType`
- `metadata.deload`
- `status`
- `confidence`, as a composition confidence derived from real readiness/progression/goal inputs
- `summary`
  - `title`
  - `primaryAction`
  - `workoutName`
  - `runName`
  - `estimatedDurationMinutes`
  - `completionStatus`, only when computed from real historical logs supplied by persistence
- `blocks`
- `workout`
- `run`
- `mobility`
- `recovery`
- `support`
- `warmup`
- `cooldown`
- `estimatedDurationMinutes`
- `combinedLoad`
- `modifications`, only as applied planner/readiness/progression adjustment receipts from real inputs
- `warnings`, only as planner display/safety warnings from real inputs or validation failures
- `todayGoals`, only as planner-facing goal/action summaries derived from real goal/progression/readiness inputs
- `auditTrail`, as planner composition audit entries

Planner ownership means the Home adapter may display these fields, but the planner still remains advisory-only until a later promotion phase explicitly changes runtime ownership.

## 1.2 Readiness-owned fields

Readiness remains owned by `readiness-engine.ts` and its canonical input pipeline. The planner and Home adapter may consume but must not invent:

- readiness score
- readiness status: `Green | Yellow | Red`
- readiness confidence
- readiness reasons
- readiness recommendation
- readiness recommendation type
- training guidance
- recovery guidance
- data quality warnings
- any Home recovery card value derived from readiness

`DailyTrainingSession.readinessStatus` is a copied/consumed readiness signal, not a planner-created readiness result.

## 1.3 Progression-owned fields

Progression remains owned by `progression-engine.ts` and its canonical input pipeline. The planner and Home adapter may consume but must not invent:

- `weeklyDecision`
- `nutritionDecision`
- progression confidence
- progression reasons
- progression warnings
- progression data quality
- progression audit entries
- goal-status map when emitted by progression

Home `coachBrief.weeklyDecision`, `progressionDecision`, Mission Control weekly decision, and any progression-derived Home warning must come from a real `ProgressionEngineResult`.

## 1.4 Recommendation-owned fields

Recommendation remains owned by existing recommendation pipelines until a later phase explicitly migrates ownership:

- `generateDailyPrescription(...)` owns daily coach recommendation copy.
- `generateRunningRecommendation(...)` owns run recommendation action/distance/risk copy.
- Running engine outputs own running-domain status when connected.
- Orchestrator/Mission Control owns mission/risk/opportunity language when connected.

The Home adapter may display planner session title/action, but it must not fabricate or replace recommendation-engine decisions.

## 1.5 Persistence-owned fields

Persistence remains owned by AppState/localStorage/Supabase/backup-restore layers:

- `AppState.currentWeek`
- `AppState.workoutSessions`
- `AppState.runLogs`
- `AppState.checkIns`
- `AppState.nutritionLogs`
- `AppState.bodyMetrics`
- user profile and macro targets
- completion receipts
- backup/restore snapshots
- future persisted planner session references
- future audit hash records
- future provenance records

The planner and Home adapter must treat logs as durable receipts. They may read completion evidence but must not create, mutate, or replace persisted logs.

## 1.6 Ownership matrix

| Field / concern | Owner | Adapter role | Fallback policy | Pilot status |
|---|---|---|---|---|
| `DailyTrainingSession.id` | Planner | Pass through and include in adapter provenance | Fallback forbidden in pilot if missing | Blocker |
| `date` | Runtime request / App orchestration | Validate against Home date and pass through | Fallback forbidden in pilot | Blocker |
| `currentWeek` | AppState / training calendar source | Validate against canonical week policy | Fallback forbidden in pilot | Blocker |
| `dayIndex` | Planner from canonical date | Pass through if date-valid | Fallback forbidden when date invalid | Blocker |
| `sourcePlan.*` | Source training plan provider + planner resolver | Pass through for audit/display | Fallback forbidden unless source provenance is explicit | Blocker |
| `sessionType` | Planner resolver | Map to Home primary training display | Fallback forbidden | Blocker |
| `metadata.deload` | Planner from source workout metadata | Pass through as metadata only | Default `false` allowed only if source workout explicitly lacks deload | Warning if source unknown |
| `status` | Planner from source/session/log context | Map to Home display status only where compatible | Fallback forbidden for completion if logs missing | Blocker |
| `readinessStatus` | Readiness engine | Display and cross-check with real readiness result | Fallback forbidden | Blocker |
| `confidence` | Planner composition from real inputs | Display only as planner confidence if UI asks for it | Fallback forbidden for domain confidence | Warning |
| `summary.*` | Planner | Map to Home workout/run names and durations | Display fallback allowed only to explicit unavailable copy | Blocker for primary labels |
| `blocks` | Planner | Optional future Home detail expansion | Empty allowed only for true rest/unavailable sessions | Warning |
| `workout` | Planner from source plan | Map to Home workout item | `No lift scheduled` allowed only if no workout prescription exists | Blocker if sessionType requires lift |
| `run` | Planner from source plan/recommendation input | Map to Home run item | `No run scheduled` allowed only if no run prescription exists | Blocker if sessionType requires run |
| `mobility` | Planner | Optional support/recovery display | Missing allowed unless sessionType requires mobility | Warning |
| `recovery` | Planner | Map to Home recovery training item if RecoveryDay | Missing blocked for RecoveryDay | Blocker |
| `support` | Planner | Optional support summary, not primary type | Missing allowed when source has no support; not allowed when source has explicit core | Warning/Blocker based on source |
| `warmup` / `cooldown` | Planner/user preference | Optional display or Train handoff only | Missing allowed if preferences disabled | Info |
| `estimatedDurationMinutes` | Planner | Map to Home training total duration | Fallback forbidden except explicit unknown/unavailable state | Warning/Blocker by context |
| `combinedLoad` | Planner | Optional Home warnings | Fallback forbidden for safety warnings | Warning |
| `modifications` | Readiness/progression/planner receipts | Optional display/audit | Missing allowed if no modifications applied | Info |
| `warnings` | Planner + domain validation | Surface adapter warnings separately | Missing allowed only if validation passes | Warning |
| `todayGoals` | Planner from real domain inputs | Optional Home goal candidates; must not replace goal engine | Fallback forbidden from planner alone | Warning |
| `auditTrail` | Planner | Required for pilot auditability | Fallback forbidden | Blocker |
| audit hash | Persistence/audit adapter | Required pilot metadata | Fallback forbidden | Blocker |
| provenance | Persistence/audit adapter | Required pilot metadata | Fallback forbidden | Blocker |

---

# 2. HomeTrainingModel target schema

## 2.1 Purpose

`HomeTrainingModel` is the pure model that a future Home adapter should produce from a validated `DailyTrainingSession` plus real domain outputs. It is not the full `HomeCommandCenterModel`. It is the training slice that Home can consume without allowing the planner to fabricate readiness, progression, recommendations, or persistence state.

## 2.2 Proposed TypeScript shape

```ts
type HomeAdapterDiagnosticSeverity = "BLOCKER" | "WARNING" | "INFO";

type HomeTrainingModelReadiness = {
  status: "Green" | "Yellow" | "Red";
  confidence: "High" | "Medium" | "Low";
  warning: string | null;
  source: "Readiness Engine V2";
};

type HomeTrainingModelItem = {
  name: string;
  estimatedDurationMinutes: number;
  status: "Completed" | "Not Completed" | "Not Scheduled" | "Unavailable";
  sourceSessionId: string;
  sourceWorkoutId: string | null;
  required: boolean;
};

type HomeTrainingModel = {
  source: "Planner Home Adapter V1";
  mode: "developer-only" | "pilot";
  sessionId: string;
  date: string;
  currentWeek: number;
  dayIndex: number;
  sessionType: PrimarySessionType;
  deload: boolean;
  title: string;
  primaryAction: string;
  workout: HomeTrainingModelItem;
  run: HomeTrainingModelItem;
  recovery: HomeTrainingModelItem | null;
  mobility: HomeTrainingModelItem | null;
  support: Array<{
    kind: "Core" | "Mobility" | "Recovery" | "Conditioning" | "Other";
    title: string;
    items: string[];
    sourceWorkoutId: string | null;
  }>;
  estimatedDurationMinutes: number;
  priorities: string[];
  warnings: string[];
  readiness: HomeTrainingModelReadiness;
  progression: {
    weeklyDecision: WeeklyProgressDecision;
    confidence: "High" | "Medium" | "Low";
    source: "Progression Engine V1";
  };
  recommendation: {
    coachRecommendation: string;
    runningRecommendationLabel: string | null;
    source: "Recommendation Pipeline";
  };
  completion: {
    workoutStatus: "Completed" | "Not Completed" | "Not Scheduled" | "Unavailable";
    runStatus: "Completed" | "Not Completed" | "Not Scheduled" | "Unavailable";
    source: "Persistence";
  };
  audit: {
    auditHash: string;
    provenance: string;
    plannerAuditTrailIds: string[];
    adapterVersion: "home-adapter-contract-v1";
  };
  diagnostics: Array<{
    severity: HomeAdapterDiagnosticSeverity;
    code: string;
    message: string;
    field?: string;
  }>;
};
```

## 2.3 Required fields

Required for any developer-only Home pilot:

- `source`
- `mode`
- `sessionId`
- `date`
- `currentWeek`
- `dayIndex`
- `sessionType`
- `deload`
- `title`
- `primaryAction`
- `workout`
- `run`
- `estimatedDurationMinutes`
- `priorities`
- `warnings`
- `readiness`
- `progression`
- `recommendation`
- `completion`
- `audit.auditHash`
- `audit.provenance`
- `audit.plannerAuditTrailIds`
- `audit.adapterVersion`
- `diagnostics`

## 2.4 Optional fields

Optional because they may not exist on every session type:

- `recovery`
- `mobility`
- `support`
- `recommendation.runningRecommendationLabel`

Optional does not mean fabricated. Optional means the adapter may emit `null` or `[]` after validating the source session has no corresponding prescription.

## 2.5 Computed fields

These fields are computed by the Home adapter from validated inputs:

- `workout.status` from persistence-owned `WorkoutSession[]`
- `run.status` from persistence-owned `RunLog[]`
- `workout.required` from `sessionType` and presence of `session.workout`
- `run.required` from `sessionType` and presence of `session.run`
- `priorities` by combining planner priorities with real recommendation/readiness/progression signals
- `warnings` by combining planner warnings and adapter diagnostics that are safe to display
- `readiness.warning` from real readiness guidance/warnings
- `audit.plannerAuditTrailIds` from `DailyTrainingSession.auditTrail`

## 2.6 Forbidden fields

`HomeTrainingModel` must not include or synthesize:

- fabricated readiness score/status/confidence
- fabricated progression decision/confidence/data quality
- fabricated daily prescription copy
- fabricated running recommendation distance/action
- fabricated completion logs
- fabricated goal status
- fabricated weight/nutrition/performance values
- persisted session IDs that do not exist in storage
- source workout IDs that do not exist in the source plan
- standalone `DeloadDay`
- collapsed recovery-as-mobility session type
- support-driven primary session type changes

---

# 3. Adapter mapping table

| DailyTrainingSession field | HomeTrainingModel field | Mapping rule | Owner | Missing behavior |
|---|---|---|---|---|
| `id` | `sessionId`, item `sourceSessionId` | Copy exactly | Planner | BLOCKER |
| `date` | `date` | Copy and validate against Home request date | Runtime/planner | BLOCKER |
| `currentWeek` | `currentWeek` | Copy and validate against AppState week policy | AppState/planner | BLOCKER |
| `dayIndex` | `dayIndex` | Copy and validate 0-6 | Planner | BLOCKER |
| `sourcePlan.source` | `audit.provenance` component | Include in provenance string/object | Source plan/planner | BLOCKER |
| `sourcePlan.sourceWorkoutId` | item `sourceWorkoutId` | Copy to workout/run/recovery/mobility/support item when applicable | Source plan/planner | WARNING if no source workout; BLOCKER if primary prescription references source |
| `sourcePlan.sourceWorkoutTitle` | fallback item name only | May be fallback only when prescription title missing but source exists | Source plan | WARNING |
| `sourcePlan.resolvedSessionType` | validation cross-check | Must equal or explain `sessionType` | Planner resolver | BLOCKER if conflict |
| `sessionType` | `sessionType` | Copy exactly; never transform RecoveryDay into MobilityDay | Planner | BLOCKER |
| `metadata.deload` | `deload` | Copy boolean as metadata only | Planner/source workout | WARNING if source unknown |
| `status` | validation context | Do not directly map to completion unless based on logs | Planner/persistence | INFO/WARNING |
| `readinessStatus` | `readiness.status` cross-check | Must match real readiness engine result | Readiness engine | BLOCKER if missing/mismatch |
| `confidence` | optional diagnostic/priority context | May inform adapter warning only; not domain confidence | Planner | INFO if absent from display |
| `summary.title` | `title` | Copy; fallback to explicit unavailable copy only in blocked model | Planner | BLOCKER for pilot |
| `summary.primaryAction` | `primaryAction`, `priorities[0]` candidate | Copy; may be supplemented by real recommendations | Planner | BLOCKER for pilot |
| `summary.workoutName` | `workout.name` | Prefer `workout.title`; fallback to summary name; else `No lift scheduled` if no workout prescription | Planner | BLOCKER if session requires lift |
| `summary.runName` | `run.name` | Prefer `run.title`; fallback to summary name; else `No run scheduled` if no run prescription | Planner | BLOCKER if session requires run |
| `summary.estimatedDurationMinutes` | `estimatedDurationMinutes` fallback | Use only if top-level duration missing | Planner | WARNING |
| `summary.completionStatus` | validation context only | Do not directly trust unless computed from supplied logs | Persistence/planner | BLOCKER if logs unavailable |
| `blocks` | future details | Not required for current Home compact cards | Planner | INFO |
| `workout` | `workout` item | Map title/duration/required/source; status from logs | Planner + persistence | BLOCKER if session requires workout and missing |
| `run` | `run` item | Map title/duration/required/source; status from logs; recommendation copy from recommendation pipeline only | Planner + persistence + recommendation | BLOCKER if session requires run and missing |
| `mobility` | `mobility` item | Map if present; not a replacement for RecoveryDay | Planner | WARNING if MobilityDay and missing |
| `recovery` | `recovery` item | Map if present; required for RecoveryDay | Planner | BLOCKER for RecoveryDay if missing |
| `support` | `support[]` | Copy support items; Core remains support only | Planner | WARNING if source has explicit support but output empty |
| `warmup` | future Train-only or support detail | Do not display as primary Home item | Planner/user preference | INFO |
| `cooldown` | future Train-only or support detail | Do not display as primary Home item | Planner/user preference | INFO |
| `estimatedDurationMinutes` | `estimatedDurationMinutes` | Copy top-level duration | Planner | WARNING if missing/zero unexpectedly |
| `combinedLoad` | `warnings`/diagnostics | Convert overload flags to Home-safe warnings | Planner | INFO if no flags |
| `modifications` | `warnings`/priorities/audit | Display only safe, user-actionable modification summaries | Readiness/progression/planner | INFO if none |
| `warnings` | `warnings`, `diagnostics` | Copy user-safe warnings; classify adapter warnings separately | Planner | INFO if none |
| `todayGoals` | `priorities` candidates | Use only if derived from real goal/progression inputs; do not replace goal engine | Planner/goal tracking | WARNING if missing |
| `auditTrail` | `audit.plannerAuditTrailIds` | Copy IDs; use full trail for audit hash generation | Planner | BLOCKER if empty in pilot |

---

# 4. Validation layer

The Home adapter must be a pure validation-and-mapping layer. It must not call fallback readiness/progression/goal functions and must not mutate `AppState`.

## 4.1 Field validation rules

| Field | Required? | Fallback allowed? | Fallback forbidden? | Promotion blocker if missing? |
|---|---:|---:|---:|---:|
| `session.id` | Yes | No | Yes | Yes |
| `session.date` | Yes | No | Yes | Yes |
| `session.currentWeek` | Yes | No | Yes | Yes |
| `session.dayIndex` | Yes | No | Yes | Yes |
| `session.sourcePlan.source` | Yes | No | Yes | Yes |
| `session.sourcePlan.sourceWorkoutId` | Conditional | Only for true no-source rest/unavailable sessions | Yes when primary prescription exists | Yes when primary exists |
| `session.sourcePlan.resolvedSessionType` | Yes | No | Yes | Yes |
| `session.sessionType` | Yes | No | Yes | Yes |
| `session.metadata.deload` | Yes | `false` only if source workout lacks deload | Yes if source metadata unavailable | No, unless source expected deload |
| `session.status` | Yes | No for completion status | Yes for log-derived completion | Yes for pilot if absent |
| `session.readinessStatus` | Yes | No | Yes | Yes |
| real `ReadinessEngineResult` | Yes | No | Yes | Yes |
| real `ProgressionEngineResult` | Yes | No | Yes | Yes |
| real recommendation output | Yes for pilot | No | Yes | Yes |
| real completion logs | Yes for pilot | No | Yes | Yes |
| `session.summary.title` | Yes | Only blocked-model unavailable copy outside pilot | Yes in pilot | Yes |
| `session.summary.primaryAction` | Yes | Only blocked-model unavailable copy outside pilot | Yes in pilot | Yes |
| `session.summary.workoutName` | Conditional | `No lift scheduled` when no workout exists | Yes if lift required | Yes if lift required |
| `session.summary.runName` | Conditional | `No run scheduled` when no run exists | Yes if run required | Yes if run required |
| `session.workout` | Conditional | Null allowed only for non-lift sessions | Yes for LiftDay/HybridDay with required lift | Yes when required |
| `session.run` | Conditional | Null allowed only for non-run sessions | Yes for RunDay/LongRunDay/HybridDay with required run | Yes when required |
| `session.recovery` | Conditional | Null allowed only for non-RecoveryDay | Yes for RecoveryDay | Yes for RecoveryDay |
| `session.mobility` | Conditional | Null allowed unless MobilityDay or explicit mobility block | Yes if MobilityDay requires it | Yes when required |
| `session.support` | No | Empty allowed when source has no support | Yes if source has explicit approved support and planner omitted it | No/Warning unless support required |
| `session.estimatedDurationMinutes` | Yes | No silent fallback in pilot | Yes if zero/missing unexpectedly | Warning/Blocker by type |
| `session.combinedLoad` | Yes | No | Yes for safety warnings | Warning |
| `session.modifications` | No | Empty allowed | No | No |
| `session.warnings` | No | Empty allowed | No | No |
| `session.todayGoals` | No | Empty allowed, but cannot fabricate | Yes for fabricated goals | No/Warning |
| `session.auditTrail` | Yes for pilot | No | Yes | Yes |
| `auditHash` | Yes for pilot | No | Yes | Yes |
| `provenance` | Yes for pilot | No | Yes | Yes |

## 4.2 Cross-field validations

- `session.sessionType` must equal `sourcePlan.resolvedSessionType` unless a future migration explicitly records a validated override.
- `RecoveryDay` must remain `RecoveryDay`; it must not map to `MobilityDay` even if the display item is recovery/mobility oriented.
- `metadata.deload=true` must not change `sessionType` and must not produce `DeloadDay`.
- `support.kind="Core"` must not change `sessionType`, `workout.required`, `run.required`, or completion logging targets.
- `workout.status` must come from `WorkoutSession[]`, not from planner optimism.
- `run.status` must come from `RunLog[]`, not from planner optimism.
- Readiness displayed in Home must match a real `ReadinessEngineResult`, not `DailyTrainingSession.readinessStatus` alone.
- Progression displayed in Home must match a real `ProgressionEngineResult`, not planner summary text.
- Recommendation displayed in Home must match the real recommendation pipeline or be explicitly absent.
- Source IDs in Home items must exist in the source plan or be `null` only for true no-source/unavailable sessions.

---

# 5. Runtime safety rules

## 5.1 Planner must never fabricate readiness

If real readiness is missing:

- Do not call `fallbackReadiness()` for Home pilot.
- Do not emit `Green`, `Yellow`, or `Red` from planner assumptions.
- Do not display planner output as actionable Home training guidance.
- Emit adapter diagnostic:
  - severity: `BLOCKER`
  - code: `READINESS_MISSING`
  - behavior: Home pilot unavailable; use existing legacy Home path.

## 5.2 Planner must never fabricate progression

If real progression is missing:

- Do not call `fallbackProgression()` for Home pilot.
- Do not default to `Repeat` as a safe production decision.
- Do not display progression confidence or weekly decision from planner assumptions.
- Emit adapter diagnostic:
  - severity: `BLOCKER`
  - code: `PROGRESSION_MISSING`
  - behavior: Home pilot unavailable; use existing legacy Home path.

## 5.3 Planner must never fabricate recommendations

If daily prescription or running recommendation is missing:

- Do not invent coach recommendation copy.
- Do not invent run action/distance.
- If no run is scheduled, `runningRecommendationLabel` may be `null` with an `INFO` diagnostic.
- If a run is scheduled and recommendation policy requires a recommendation, emit `BLOCKER`.

## 5.4 Planner must never fabricate historical logs

If completion logs are missing or not connected:

- Do not mark workout or run as completed.
- Do not infer completion from planner status alone.
- Do not create synthetic `WorkoutSession` or `RunLog` records.
- Emit `BLOCKER` for pilot because Home completion status would be unsafe.

## 5.5 Planner must never fabricate goal tracking

If real goal tracking is missing:

- Do not create goal status copy.
- Do not use planner `todayGoals` as replacement goal-engine output.
- Home may still show planner primary action only in developer-only advisory mode, but pilot readiness is blocked if goal tracking is required by Mission Control context.

## 5.6 Planner must never fabricate running engine outputs

If running engine output is missing:

- Do not infer running risk/progression beyond source-plan run prescription.
- Do not alter run logging targets.
- Do not invent pace, weekly mileage, or recommendation action.
- If the session includes a run and Home pilot requires running engine context, emit `BLOCKER`; otherwise emit `WARNING` that the run is source-plan-only.

## 5.7 Missing-data behavior summary

| Missing input | Exact behavior | Diagnostic | Legacy fallback? |
|---|---|---|---|
| Readiness | Block planner Home pilot | `BLOCKER: READINESS_MISSING` | Keep existing Home path |
| Progression | Block planner Home pilot | `BLOCKER: PROGRESSION_MISSING` | Keep existing Home path |
| Goal tracking | Block if Mission Control/Home goals require it; otherwise hide planner-derived goals | `BLOCKER` or `WARNING` | Keep existing goal engine path |
| Daily prescription | Do not fabricate coach copy; block if required | `BLOCKER: RECOMMENDATION_MISSING` | Keep existing recommendation path |
| Running recommendation | `null` only if no run scheduled or source-plan-only policy approved | `BLOCKER` or `INFO` | Keep existing running recommendation path |
| Workout logs | Completion status unavailable; block pilot | `BLOCKER: WORKOUT_LOGS_MISSING` | Keep existing Home path |
| Run logs | Completion status unavailable; block pilot | `BLOCKER: RUN_LOGS_MISSING` | Keep existing Home path |
| Audit hash | Block pilot | `BLOCKER: AUDIT_HASH_MISSING` | Keep existing Home path |
| Provenance | Block pilot | `BLOCKER: PROVENANCE_MISSING` | Keep existing Home path |

---

# 6. Adapter warning system

## 6.1 Severity definitions

### BLOCKER

A condition that prevents developer-only Home pilot output from being shown as a runtime pilot model. Existing Home must remain the active runtime path.

BLOCKER examples:

- missing real readiness
- missing real progression
- missing persistence completion evidence
- missing audit hash
- missing provenance
- missing session ID
- missing source plan identity
- invalid date/week/day index
- `RecoveryDay` collapsed into `MobilityDay`
- `deload=true` converted into `DeloadDay`
- support changed primary session type or logging target
- required workout/run/recovery prescription missing for its session type

### WARNING

A condition that allows developer-only diagnostic output but requires review before promotion.

WARNING examples:

- source-plan-only run with no running-engine context under an approved source-plan-only policy
- missing optional support details
- low planner confidence from real low-quality domain inputs
- zero/low duration for a non-rest session
- planner warnings include overload flags
- goal tracking present but low confidence
- deload source metadata unknown while output says `false`

### INFO

A non-blocking trace or expected absence.

INFO examples:

- no run scheduled today
- no lift scheduled today
- no support work in source workout
- warmup omitted by preference
- cooldown omitted by preference
- no planner modifications applied

## 6.2 Diagnostic shape

```ts
interface HomeAdapterDiagnostic {
  severity: "BLOCKER" | "WARNING" | "INFO";
  code: string;
  message: string;
  field?: string;
  source?: "Home Adapter" | "Training Planner" | "Readiness Engine" | "Progression Engine" | "Recommendation Pipeline" | "Persistence";
}
```

## 6.3 Required diagnostic codes

- `READINESS_MISSING`
- `READINESS_MISMATCH`
- `PROGRESSION_MISSING`
- `RECOMMENDATION_MISSING`
- `RUN_RECOMMENDATION_MISSING`
- `WORKOUT_LOGS_MISSING`
- `RUN_LOGS_MISSING`
- `GOAL_TRACKING_MISSING`
- `RUNNING_ENGINE_MISSING`
- `AUDIT_HASH_MISSING`
- `PROVENANCE_MISSING`
- `SESSION_ID_MISSING`
- `SOURCE_PLAN_MISSING`
- `INVALID_DATE`
- `INVALID_WEEK`
- `INVALID_DAY_INDEX`
- `SESSION_TYPE_MISSING`
- `SESSION_TYPE_MISMATCH`
- `RECOVERY_COLLAPSED_TO_MOBILITY`
- `DELOAD_DAY_FORBIDDEN`
- `SUPPORT_CHANGED_PRIMARY_TYPE`
- `SUPPORT_CHANGED_LOGGING`
- `REQUIRED_WORKOUT_MISSING`
- `REQUIRED_RUN_MISSING`
- `REQUIRED_RECOVERY_MISSING`
- `DURATION_UNSAFE`

---

# 7. Pilot requirements

Before a developer-only Home pilot can be implemented, all of the following must be true.

## 7.1 Required connected inputs

- Readiness connected:
  - Real `ReadinessEngineResult` from canonical readiness inputs.
  - No `fallbackReadiness()` in pilot path.

- Progression connected:
  - Real `ProgressionEngineResult` from canonical progression inputs.
  - No `fallbackProgression()` in pilot path.

- Recommendations connected:
  - Existing daily prescription remains owner of coach recommendation copy.
  - Existing running recommendation remains owner of run action/distance copy where applicable.
  - Planner may not replace recommendation engines.

- Persistence connected:
  - Real `WorkoutSession[]` supplied for completion status.
  - Real `RunLog[]` supplied for completion status.
  - No synthetic completion records.

- Audit hash present:
  - Hash must cover planner input, planner output, source plan reference, domain engine references, adapter version, and date/week context.

- Provenance present:
  - Must identify source plan, planner version/contract, adapter version, domain engine result references, and runtime mode.

## 7.2 Developer-only Home pilot feature flag requirements

- Pilot must be gated behind a developer-only flag distinct from planner shadow preview.
- Pilot must be read-only and advisory-only.
- Existing Home path must remain default.
- Existing Home path must remain available as immediate rollback.
- Pilot model must expose diagnostics, but diagnostics must not modify runtime state.
- Any `BLOCKER` diagnostic must suppress pilot rendering and route to existing Home path.

## 7.3 Pilot disallowed behavior

- No planner promotion.
- No source-of-truth replacement.
- No adapter writes to AppState.
- No log writes.
- No recommendation changes.
- No readiness changes.
- No progression changes.
- No Home UI replacement outside a developer-only pilot flag.
- No persistence schema changes until a separate persistence contract phase approves them.

---

# 8. Promotion readiness scorecard

## 8.1 Home Ready

- [ ] `HomeTrainingModel` contract implemented as a pure adapter.
- [ ] All required fields validated.
- [ ] Existing Home remains default.
- [ ] `BLOCKER` diagnostics suppress pilot output.
- [ ] RecoveryDay remains distinct in Home model.
- [ ] Deload is metadata only in Home model.
- [ ] Core support remains support only.
- [ ] Home compact dashboard can consume model without fabricated domain data.

## 8.2 Train Ready

- [ ] Train adapter contract exists.
- [ ] Train receives executable planner blocks without changing Home ownership.
- [ ] Run/lift/support logging targets are validated separately.
- [ ] Support work does not alter run/lift logging.
- [ ] RecoveryDay has a safe Train representation.
- [ ] Legacy Train remains rollback path.

## 8.3 Log Ready

- [ ] Log adapter contract exists.
- [ ] Planner session ID can attach to logs without replacing log schemas prematurely.
- [ ] Run logs remain durable receipts.
- [ ] Lift logs remain durable receipts.
- [ ] Support logging, if introduced later, has an explicit contract.
- [ ] No planner output fabricates completion.

## 8.4 Recommendation Ready

- [ ] Daily prescription ownership is explicitly connected or intentionally deferred.
- [ ] Running recommendation ownership is explicitly connected or intentionally source-plan-only.
- [ ] Planner does not create recommendation copy.
- [ ] Recommendation outputs can reference planner session IDs only after audit/provenance are present.

## 8.5 Persistence Ready

- [ ] Planner session audit hash exists.
- [ ] Planner session provenance exists.
- [ ] Backup/restore impact assessed.
- [ ] Supabase/localStorage behavior assessed.
- [ ] No schema migration is required for developer-only pilot, or a separate migration plan exists.
- [ ] Persisted logs remain canonical receipts.

## 8.6 Rollback Ready

- [ ] Feature flag can disable Home pilot instantly.
- [ ] Existing Home model path remains intact.
- [ ] Existing Train path remains intact.
- [ ] Existing Log path remains intact.
- [ ] Existing recommendation path remains intact.
- [ ] Pilot writes nothing irreversible.
- [ ] Diagnostics explain why pilot is unavailable when blocked.

---

# 9. Promotion blockers

The following are hard blockers before planner-derived Home output can become even a developer-only runtime pilot:

1. No implemented pure Home adapter contract.
2. No real readiness connection in planner runtime input path.
3. No real progression connection in planner runtime input path.
4. No recommendation ownership handoff or explicit recommendation pass-through policy.
5. No persistence completion-evidence connection for workout/run statuses.
6. No audit hash.
7. No provenance.
8. Current planner adapter still contains shadow-safe fallback readiness/progression/goal functions that must remain forbidden in pilot path.
9. Home command center currently recomputes readiness/progression/goal tracking internally when not supplied; pilot must avoid double ownership and pass real domain results once.
10. Current Home training display is coupled to `HomeCommandCenterModel.training`; adapter must map into this safely or introduce a pure bridge without changing UI behavior.
11. Mission Control uses Home engine outputs for primary mission/risk/opportunity; planner Home pilot must not fabricate those outputs.
12. Legacy `adjustWorkoutForReadiness()` still affects current Home/Train workout selection; pilot must avoid double-applying readiness to planner output.
13. Completion status must not use planner status alone.
14. RecoveryDay must remain distinct.
15. Deload must remain metadata only.
16. Core support must not alter primary session type or logging targets.

---

# 10. Recommended implementation sequence

## Step 1 — Pure adapter types only

Create a new adapter module that defines:

- `HomeTrainingModel`
- `HomeAdapterDiagnostic`
- `HomeAdapterInput`
- `HomeAdapterResult`

No UI changes. No runtime wiring.

## Step 2 — Validation-first implementation

Implement validation that returns diagnostics before mapping.

- Any `BLOCKER` returns a blocked result.
- Blocked result must not be displayed as active Home runtime.
- Unit tests should cover every blocker in this contract.

## Step 3 — Field-by-field mapping

Map `DailyTrainingSession -> HomeTrainingModel` using this document.

- Preserve `RecoveryDay`.
- Preserve `deload` metadata.
- Preserve `Support: Core` as support only.
- Compute completion only from real logs.
- Pass through real readiness/progression/recommendation results.

## Step 4 — Developer-only non-rendered parity tests

Add tests comparing adapter output to current Home training fields without rendering pilot UI.

- Existing Home remains default.
- Adapter output is inspected only in tests/developer diagnostics.

## Step 5 — Developer-only Home pilot flag

Only after Steps 1-4 pass:

- Add a developer-only Home pilot flag.
- Render pilot only if no `BLOCKER` diagnostics.
- Keep current Home as default and rollback path.

## Step 6 — Audit/provenance persistence design

Before any broader pilot:

- Design audit hash storage.
- Design provenance storage.
- Assess backup/restore.
- Assess Supabase/localStorage migration risk.

## Step 7 — Separate Train/Log/Recommendation contracts

Do not promote Home adapter into full planner promotion until separate contracts exist for:

- Train adapter
- Log adapter
- Recommendation adapter
- Persistence adapter

---

# 11. Final contract position

`DailyTrainingSession` may become the canonical training-session prescription only after its inputs are production-safe and adapter contracts are implemented.

For Phase 27D, the correct next artifact is a pure Home adapter contract and validation layer. The planner remains:

- developer-only
- advisory-only
- read-only
- not promoted

No source-of-truth changes are approved by this document.

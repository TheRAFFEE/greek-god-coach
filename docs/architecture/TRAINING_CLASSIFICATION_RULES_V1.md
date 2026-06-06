# Training Classification Rules V1

**Phase:** 23F — Training Classification Rules Finalization V1  
**Status:** Final classification decision document  
**Scope:** Documentation / decision only  
**Runtime impact:** None  
**Planner promotion:** Not performed  
**Shadow mode:** Not enabled  

---

## 0. Purpose

This document finalizes the canonical workout classification rules required before the Training Planner can become a future source of truth.

It resolves the two Phase 23E promotion-audit review categories:

1. Upper hypertrophy mobility inference.
2. Heavy Upper + Sprints + Core sprint representation.

This document is a governing rules document. It does not modify Home, Train, Log, UI, existing engines, planner runtime behavior, resolver runtime behavior, or source-of-truth ownership.

---

## 1. Decisions made

### Decision 1 — Shoulder-health / upper hypertrophy text does not automatically create a mobility block

**Question:** Should shoulder-health work automatically create a mobility block?

**Decision:** No.

Shoulder, delt, upper-back, pulling, pressing, hypertrophy, and shoulder-to-waist-ratio language does not create a mobility block by itself.

A lift day that contains phrases such as:

- shoulder work
- rear delts
- shoulder-to-waist ratio
- shoulder hypertrophy
- shoulder press
- upper-body health
- controlled density

remains a `LiftDay` unless the source plan explicitly programs a mobility/prehab/stretching component as its own block or exercise category.

**Canonical representation:** Mobility appears only when explicitly programmed.

**Mobility representation choice:** Mobility is a **block** only when explicit. Otherwise related context can exist as **metadata**, but it must not alter the session type or block list.

**Rationale:**

- Upper hypertrophy days are resistance-training days. Shoulder-related lifting terms are not the same as mobility work.
- Automatic mobility inference from broad text like `shoulder` creates false positives.
- Phase 23E showed this exact false positive: legacy/audit projection interpreted shoulder hypertrophy text as `lift + mobility`, while the planner produced the cleaner `warmup + lift + cooldown` structure.
- The canonical planner should not invent mobility blocks from anatomy terms.
- Mobility must be planned, not guessed.

**Resolved Phase 23E category:** Upper hypertrophy mobility inference is settled in favor of the planner approach.

Canonical outcome for upper hypertrophy days:

```text
Upper Hypertrophy + Density
→ LiftDay
→ blocks: warmup, lift, cooldown
→ mobility block: no, unless explicitly programmed
```

---

### Decision 2 — Sprints on lift-primary days are conditioning blocks, not run blocks

**Question:** Should sprint exposure on `Heavy Upper + Sprints + Core` be represented as conditioning block, run block, accessory metadata, or other?

**Decision:** Sprint exposure on lift-primary days is represented as a **conditioning block**.

It is not a `RunDay` and not a canonical run block unless the source plan explicitly programs the sprint session as a running workout with run-specific prescription fields.

**Canonical representation:** `conditioning` block.

**Not chosen:**

- Not `run` block by default.
- Not metadata-only, because sprint exposure is a real training stress.
- Not a second primary session type unless the source plan explicitly allows a `HybridDay`.

**Rationale:**

- In the seed plan, `Heavy Upper + Sprints + Core` is an upper-lift day with sprint exposure. The primary stimulus is still upper strength/hypertrophy.
- Sprint exposure creates meaningful fatigue and should be visible in blocks/stress warnings.
- Treating every sprint mention as a run block confuses logging targets and can make a lift-primary day look like a scheduled run day.
- Treating sprint exposure as metadata-only underrepresents training stress.
- `conditioning` is the safest canonical middle ground: visible, stress-aware, but not a run-prescription target.

Canonical outcome:

```text
Heavy Upper + Sprints + Core
→ LiftDay
→ blocks: warmup, lift, conditioning, cooldown
→ run block: no
→ run logging target: no
```

**Resolved Phase 23E category:** Heavy Upper sprint handling is settled in favor of `conditioning` block representation.

---

### Decision 3 — Support work never changes primary session type

Support work can add context or blocks, but it does not change the resolved primary session type.

Support work includes:

- core
- mobility
- stretching
- activation
- warmup
- cooldown
- breathing
- prehab
- low-intensity walking

Examples:

```text
Zone 2 + Mobility + Core
→ RunDay
→ not LiftDay
→ not HybridDay
```

```text
Mobility + Core
→ MobilityDay
→ not HybridDay
```

```text
Core only
→ MobilityDay or support-only day depending on source plan metadata
→ not LiftDay
```

---

## 2. Final session type definitions

Every workout resolves to exactly one primary session type before block generation.

### 2.1 LiftDay

**Purpose:** Resistance training is the main training goal.

**Primary stimulus:** Strength, hypertrophy, power, muscular endurance, or planned resistance-training circuit.

**Allowed blocks:**

- `warmup`
- `lift`
- `conditioning` when explicitly programmed as accessory/finisher work
- `mobility` only when explicitly programmed
- `cooldown`

**Forbidden blocks:**

- unplanned `run`
- unplanned `longRun`
- unplanned `race`
- hard quality run unless explicit HybridDay rules permit it

**Example workouts:**

- `Upper Strength + Sprints + Core`
- `Lower Strength`
- `Upper Hypertrophy + Density`
- `Heavy Upper + Sprints + Core`
- `Athletic Lower / P90X-Style Circuit + Core`

**Canonical notes:**

- Core support does not create LiftDay by itself.
- Sprint exposure on lift days is conditioning, not run.
- Shoulder hypertrophy text does not create mobility.

---

### 2.2 RunDay

**Purpose:** A non-long-run running session is the main training goal.

**Primary stimulus:** Easy run, Zone 2 run, tempo, intervals, hills, strides, or other run workout that is not the weekly long run, race, or test.

**Allowed blocks:**

- `warmup`
- `run`
- `mobility` when explicitly programmed
- support `core` as metadata or support work only
- `cooldown`

**Forbidden blocks:**

- `lift` unless explicit HybridDay rules permit it
- heavy lower-body work
- unplanned high-intensity conditioning

**Example workouts:**

- `Zone 2 + Mobility + Core`
- `Zone 2 Run + Mobility + Core`
- `Tempo Run`
- `Intervals`
- `Hill Repeats`

**Canonical notes:**

- `Zone 2 + Mobility + Core` is always `RunDay`, not `LiftDay`.
- Core and mobility are support, not separate primary stimuli.

---

### 2.3 LongRunDay

**Purpose:** Weekly endurance long-run stimulus.

**Primary stimulus:** Long run distance/duration progression.

**Allowed blocks:**

- `warmup`
- `run`
- explicitly programmed very light `mobility` if present
- `cooldown`

**Forbidden blocks:**

- `lift`
- sprint session
- plyometrics
- extra conditioning
- accidental HybridDay

**Example workouts:**

- `Long Run — 3 miles`
- `Long Run — 8 miles`
- `Long Run — 11 miles`

**Canonical notes:**

- LongRunDay is protected.
- LongRunDay beats RunDay, LiftDay, MobilityDay, and RecoveryDay unless safety overrides replace the session.
- LongRunDay never becomes HybridDay by inference.

---

### 2.4 RecoveryDay

**Purpose:** Reduce fatigue and restore readiness.

**Primary stimulus:** Recovery, downregulation, light movement, sleep/hydration/nutrition support.

**Allowed blocks:**

- `recovery`
- `mobility`
- `walk`
- `breathing`
- `cooldown` if useful as user-facing guidance

**Forbidden blocks:**

- `lift`
- structured `run`
- `tempo`
- `intervals`
- `sprints`
- high-intensity conditioning

**Example workouts:**

- `Recovery`
- `Recovery Walk + Mobility`
- red-readiness replacement session

**Canonical notes:**

- Recovery is intentional training support, not a missing workout.
- RecoveryDay must not become RunDay because it includes walking.

---

### 2.5 MobilityDay

**Purpose:** Movement quality, range of motion, tissue tolerance, prehab, or support-only movement.

**Primary stimulus:** Mobility/prehab/stretching/activation when no higher-priority primary training stimulus exists.

**Allowed blocks:**

- `mobility`
- `recovery`
- `walk`
- `breathing`

**Forbidden blocks:**

- `lift`
- structured `run`
- `conditioning`
- accidental HybridDay

**Example workouts:**

- `Mobility Only`
- `Mobility + Core`
- `Prehab + Mobility Flow`

**Canonical notes:**

- Mobility-only does not become LiftDay.
- Mobility + Core does not become HybridDay.
- Mobility appears as a block only when explicit.

---

### 2.6 RaceDay

**Purpose:** Race execution.

**Primary stimulus:** Race event.

**Allowed blocks:**

- `warmup`
- `run` / `race`
- `cooldown`
- recovery notes

**Forbidden blocks:**

- `lift`
- extra conditioning
- unplanned mileage beyond race plan
- second primary session

**Example workouts:**

- `Half Marathon Race`
- `5K Race`
- `10K Race`

**Canonical notes:**

- RaceDay overrides normal training classification.

---

### 2.7 TestDay

**Purpose:** Benchmark performance.

**Primary stimulus:** A planned test of running, strength, power, or capacity.

**Allowed blocks:**

- `warmup`
- one test-specific block: `run`, `lift`, or `test`
- `cooldown`

**Forbidden blocks:**

- unrelated maximal tests
- long run after maximal test
- high-volume hypertrophy after test
- accidental HybridDay unless explicitly programmed as a combined test

**Example workouts:**

- `5K Time Trial`
- `1RM Test`
- `Benchmark Run`
- `Rep Max Test`

**Canonical notes:**

- TestDay is high stress even if the block list looks short.

---

### 2.8 DeloadDay

**Purpose:** Execute a planned reduced-stress version of the source session.

**Primary stimulus:** Reduced version of the underlying day type.

**Allowed blocks:**

- reduced `lift`
- easy `run`
- `mobility`
- `recovery`
- `walk`
- `cooldown`

**Forbidden blocks:**

- PR attempts
- unplanned volume increases
- high-intensity conditioning
- extra sprint/plyometric overload

**Example workouts:**

- `Lower Strength` during a deload week
- `Zone 2 Run + Mobility + Core` during a deload week
- reduced long-run week

**Canonical notes:**

- Deload modifies stress; it does not erase the underlying planned stimulus.
- Implementation may preserve underlying type as metadata, e.g. `underlyingDayType: RunDay`.

---

### 2.9 UnavailableDay

**Purpose:** Safe output when no valid source workout exists.

**Primary stimulus:** None available.

**Allowed blocks:**

- `recovery`
- optional `mobility`
- optional `walk`

**Forbidden blocks:**

- fallback lift
- fallback run
- stale run prescription
- first workout in array fallback
- invented training

**Example workouts:**

- missing plan date
- invalid week/day index
- corrupt source plan record

**Canonical notes:**

- Missing data must produce a safe unavailable/rest answer, not a guessed workout.

---

## 3. Final support-work rules

| Item | Creates session type? | Creates block? | Metadata only? | Canonical rule |
|---|---:|---:|---:|---|
| Core | No | No by default | Yes | Support work. Never creates LiftDay by itself. Can appear inside lift/run guidance or logging notes. |
| Mobility | Yes only when primary/explicit | Yes only when explicit | Yes when incidental | Mobility creates MobilityDay only if it is the primary programmed stimulus. Otherwise block only if explicitly programmed. |
| Stretching | Yes only when primary/explicit | Yes only when explicit | Yes when incidental | Same as mobility. |
| Activation | No | No by default | Yes | Warmup/support metadata unless explicitly programmed as a mobility/prehab block. |
| Warmup | No | Yes | No | Structural block. Never changes primary session type. |
| Cooldown | No | Yes | No | Structural block. Never changes primary session type. |
| Breathing | Yes only for recovery/mobility primary day | Yes only when explicit | Yes | Downregulation/recovery support. Never creates LiftDay/RunDay. |
| Walking | Yes only for recovery/walk primary day | Yes only when explicit | Yes | Recovery/Zone 1 support. Does not create RunDay unless source plan declares a walk workout as primary. |
| Zone 1 | Yes only when primary recovery/easy aerobic day | Yes when explicit | No | Recovery/easy aerobic support. Usually RecoveryDay or RunDay depending source plan. |
| Zone 2 | Yes | Yes | No | Creates RunDay unless it is part of an explicit HybridDay. |
| Tempo | Yes | Yes | No | Creates RunDay or TestDay depending source plan. Quality run stress. |
| Intervals | Yes | Yes | No | Creates RunDay when run-primary; not inferred from generic conditioning intervals. |
| Hill Repeats | Yes | Yes | No | Creates RunDay when programmed as running. Quality run stress. |
| Strides | No by default | Yes if explicit | Yes if support | Support run mechanics unless source plan makes them the main run. Does not create HybridDay. |
| Sprints | No by default on lift-primary days | Yes as conditioning when explicit | No | On lift-primary days, creates `conditioning` block, not `run`. Creates RunDay only when source plan explicitly makes sprint running the primary session. |
| Plyometrics | No by default | Yes as conditioning/power when explicit | No | Power/conditioning support, usually LiftDay accessory. Does not create RunDay. |

Canonical table decisions:

- `Core`: support only.
- `Mobility`: explicit block only; no anatomy-term inference.
- `Zone 2`: run-primary unless explicit hybrid rules say otherwise.
- `Sprints`: conditioning on lift-primary days; run-primary only when explicitly programmed as sprint-running session.
- `Plyometrics`: power/conditioning, not running.

---

## 4. Final session priority hierarchy

Canonical precedence before safety overrides:

```text
RaceDay
→ TestDay
→ LongRunDay
→ Explicit HybridDay
→ RunDay
→ LiftDay
→ MobilityDay
→ RecoveryDay
→ Deload modifier
→ UnavailableDay fallback
```

### 4.1 How to apply the hierarchy

1. **RaceDay beats everything.** Race day is the primary event.
2. **TestDay beats ordinary training.** Benchmarking is a primary stressor.
3. **LongRunDay beats RunDay and LiftDay.** Weekly long-run progression is protected.
4. **Explicit HybridDay beats single-stimulus days only when explicitly declared.** Hybrid is never inferred from support work.
5. **RunDay beats LiftDay when the meaningful primary stimulus is running.** Example: Zone 2 + Mobility + Core.
6. **LiftDay beats MobilityDay when actual resistance training is primary.** Example: Upper Hypertrophy + Density.
7. **MobilityDay beats RecoveryDay when mobility/prehab is the programmed primary work.**
8. **RecoveryDay is primary when recovery/rest/downregulation is explicitly scheduled or safety override chooses it.**
9. **Deload is a stress modifier, not always a standalone identity.** When implementation requires a single enum value, `DeloadDay` may be used, but the underlying planned stimulus should be preserved as metadata.
10. **UnavailableDay is the safe fallback for missing/invalid plan data.**

### 4.2 Rationale

The hierarchy protects the most specific and highest-consequence sessions first:

- race and test events must not be diluted by normal training logic;
- long runs must not become accidental hybrids;
- explicit combined sessions must stay explicit;
- run-primary days must not become lift days because they contain support work;
- lift-primary days must not become mobility days because of anatomy text;
- recovery/unavailable outputs must be safe and conservative.

---

## 5. Anti-patterns explicitly prohibited

The following classifications are prohibited:

1. `Core only` becoming `LiftDay`.
2. `Mobility only` becoming `LiftDay`.
3. `Mobility + Core` becoming `HybridDay`.
4. `Zone 2 + Mobility + Core` becoming `LiftDay`.
5. `Zone 2 + Mobility + Core` becoming `HybridDay`.
6. `Long Run` becoming `HybridDay`.
7. `Long Run` becoming `LiftDay`.
8. `Recovery` becoming `RunDay` because it includes walking.
9. Shoulder/upper-hypertrophy text automatically creating a mobility block.
10. Sprints on lift-primary days automatically creating a run block.
11. Plyometrics automatically creating RunDay.
12. Strides automatically creating HybridDay.
13. Cooldown/warmup changing day type.
14. Support work creating logging targets for unrelated primary training.
15. Missing plan data falling back to the first workout in the array.
16. Deload week adding volume to “make up” missed work.
17. Long run receiving extra conditioning by inference.
18. Race day receiving lift/conditioning by inference.

---

## 6. Resolved Phase 23E needs-review categories

### 6.1 Upper hypertrophy mobility inference

**Final decision:** Planner approach is canonical.

Upper hypertrophy days should be:

```text
LiftDay
blocks: warmup, lift, cooldown
mobility: absent unless explicitly programmed
```

Legacy/projection `lift + mobility` caused by shoulder text is not canonical.

### 6.2 Heavy Upper + Sprints + Core

**Final decision:** Use conditioning block.

Heavy upper sprint days should be:

```text
LiftDay
blocks: warmup, lift, conditioning, cooldown
run block: absent unless explicitly run-primary or explicit HybridDay
```

Planner output that omits both run and conditioning underrepresents sprint stress; legacy output that uses a run block overstates run-prescription/logging ownership. The canonical target is `conditioning`.

---

## 7. Promotion readiness decision

**Decision:** READY_FOR_SHADOW_MODE

**Meaning:** Classification rules are now settled enough that no additional classification-review phase is needed before a technical audit/reconciliation pass.

**Important boundary:** This does not enable shadow mode and does not promote the planner. Phase 23F is documentation-only.

Why this is ready at the rules level:

- Critical Phase 23E mismatches were already zero.
- The 36 needs-review entries now have canonical decisions.
- Upper hypertrophy mobility inference is resolved as false-positive mobility inference.
- Heavy upper sprint exposure is resolved as conditioning, not run.
- The support-work and priority hierarchy rules are explicit enough for future tests/audits.

Required before actual shadow-mode enablement:

1. Update audit expectations to treat the resolved categories according to this document.
2. If needed, align planner/resolver block generation to emit `conditioning` for sprint exposure on lift-primary days.
3. Re-run the promotion audit.
4. Enable shadow mode only if the mechanical audit result reaches `SHADOW_MODE_READY` under the audit rules.

---

## 8. Remaining unresolved decisions

No classification-rule decisions remain unresolved for Phase 23F.

Implementation details intentionally remain out of scope:

- whether `DeloadDay` remains a standalone enum or becomes metadata over the underlying session type;
- exact code changes required to add/standardize `conditioning` blocks;
- exact audit-threshold recalculation after rules are encoded;
- runtime shadow-mode wiring.

Those are implementation/audit follow-up tasks, not classification-rule decisions.

---

## 9. Recommended next phase

Recommended next phase:

**Phase 23G — Classification Rules Audit Reconciliation V1**

Scope should be audit/implementation-adjacent but still avoid runtime promotion:

1. Convert this document into resolver/planner/audit expectations.
2. Add or update tests only for the finalized classifications.
3. Re-run the promotion audit.
4. Confirm whether the promotion result becomes `SHADOW_MODE_READY`.
5. Do not wire planner into Home, Train, or Log until the audit passes mechanically.

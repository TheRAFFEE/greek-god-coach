# Classification Rules Audit Reconciliation V1

**Phase:** 23G — Classification Rules Audit Reconciliation V1  
**Status:** Complete  
**Scope:** mechanical reconciliation only  
**Runtime integration:** not performed  
**Planner promotion:** not performed  
**Shadow mode:** not enabled

## 1. Purpose

Phase 23F finalized canonical classification rules in:

`docs/architecture/TRAINING_CLASSIFICATION_RULES_V1.md`

Phase 23G reconciles planner output, resolver output, and audit expectations against those rules. This phase does not wire planner output into Home, Train, Log, UI, or source-of-truth runtime paths.

## 2. Source of truth applied

The following Phase 23F rules were treated as canonical:

- Mobility blocks are created only by explicitly programmed mobility/stretch/prehab work.
- Shoulder-health, shoulder-to-waist, and upper-hypertrophy text does not automatically create a mobility block.
- Sprints on lift-primary days are conditioning exposure, not run blocks.
- `Heavy Upper + Sprints + Core` remains `LiftDay`.
- `Heavy Upper + Sprints + Core` may include a `conditioning` block.
- `Heavy Upper + Sprints + Core` must not create a run block or run logging target.
- `Zone 2 + Mobility + Core` is `RunDay`.
- `Zone 2 + Mobility + Core` has a run block and mobility block.
- `Zone 2 + Mobility + Core` must not create a lift block.
- Core-only support work must not become `LiftDay` or `HybridDay`.
- Mobility-only support work must not become `LiftDay`.

## 3. Baseline mismatch counts before reconciliation

Source: Phase 23E promotion audit report.

Total mismatch entries before: **96**

By severity before:

- `EXPECTED_IMPROVEMENT`: 60
- `NEEDS_REVIEW`: 36
- `CRITICAL`: 0

By category before:

- `Zone 2 + Mobility + Core` / `Zone 2 Run + Mobility + Core`: 60
- Upper hypertrophy mobility inference: 24
- Heavy upper sprint handling: 12

By mismatch type before:

- `DAY_TYPE`: 12
- `PRIMARY_SESSION`: 12
- `WORKOUT`: 12
- `RUN`: 4
- `BLOCKS`: 28
- `CLASSIFICATION`: 28

## 4. Reconciliation decisions by category

### A. Upper hypertrophy mobility inference

Before: **24** mismatch entries  
After: **0** mismatch entries  
Classification: **FIXED**

Decision:

- Planner was correct.
- Resolver was correct.
- Phase 23E audit expectation was too broad.
- Final rules document was correct.

Applied reconciliation:

- Audit mobility inference now requires explicitly programmed mobility/stretch/prehab exercise content.
- Shoulder-related hypertrophy wording no longer creates an audit-side mobility expectation.

Canonical expected output:

```text
Upper Hypertrophy + Density
High-Volume Upper Hypertrophy
High-Density Hypertrophy
→ LiftDay
→ warmup, lift, cooldown
→ no mobility block unless explicitly programmed
```

### B. Heavy Upper + Sprints + Core

Before: **12** mismatch entries  
After: **0** mismatch entries  
Classification: **FIXED**

Decision:

- Resolver was correct that primary session remains `LiftDay`.
- Audit was wrong to treat sprint exposure as a run block.
- Planner needed mechanical reconciliation to expose explicitly programmed sprint work as `conditioning` rather than omitting it from blocks.
- Final rules document was correct.

Applied reconciliation:

- Planner block kind now includes `conditioning`.
- Explicit sprint / plyometric / conditioning exercises on lift-primary days produce a `conditioning` block.
- This block uses `logTarget.type = "none"` and does not create a run logging target.
- Audit legacy expectation now treats sprint exposure on lift-primary days as `conditioning`, not `run`.

Canonical expected output:

```text
Heavy Upper + Sprints + Core
→ LiftDay
→ warmup, lift, conditioning, cooldown
→ run block absent
→ run logging target absent
```

### C. Zone 2 + Mobility + Core

Before: **60** mismatch entries  
After: **0** mismatch entries  
Classification: **FIXED**

Decision:

- Planner was correct.
- Resolver was correct.
- Phase 23E correctly classified this as an expected improvement, but Phase 23G reconciled audit expectations to the finalized rules document.
- Final rules document was correct.

Applied reconciliation:

- Audit lift inference now excludes core and conditioning-only support work from lift classification.
- Zone 2 remains run-primary even with mobility and core support work.

Canonical expected output:

```text
Zone 2 + Mobility + Core
Zone 2 Run + Mobility + Core
→ RunDay
→ warmup, run, mobility, cooldown
→ lift block absent
```

### D. Core only

Before: **0** mismatch entries  
After: **0** mismatch entries  
Classification: **EXPECTED**

Decision:

- Resolver and planner already conformed.
- Core-only support work does not become `LiftDay` or `HybridDay`.

### E. Mobility only

Before: **0** mismatch entries  
After: **0** mismatch entries  
Classification: **EXPECTED**

Decision:

- Resolver and planner already conformed.
- Mobility-only support work does not become `LiftDay`.

## 5. Mismatch counts after reconciliation

Final audit output after reconciliation:

```json
{
  "total": 0,
  "critical": 0,
  "needsReview": 0,
  "expected": 0,
  "recommendation": "TRAIN_READY",
  "byType": {},
  "bySev": {},
  "byCategory": {}
}
```

Total mismatch entries after: **0**

By severity after:

- `EXPECTED_IMPROVEMENT`: 0
- `NEEDS_REVIEW`: 0
- `CRITICAL`: 0

By category after:

- `Zone 2 + Mobility + Core` / `Zone 2 Run + Mobility + Core`: 0
- Upper hypertrophy mobility inference: 0
- Heavy upper sprint handling: 0
- Core only: 0
- Mobility only: 0

## 6. Rule conflicts

Rule conflicts found: **0**

No finalized Phase 23F rule needed to be changed.

## 7. Implementation bugs

Implementation bugs found and reconciled: **1**

- Planner did not expose explicit lift-primary sprint work as a `conditioning` block.
- This was reconciled without creating a run block or run logging target.

Audit expectation bugs found and reconciled: **3**

- Shoulder-health text created mobility too broadly.
- Sprint exposure created run blocks too broadly.
- Core support work caused Zone 2 support-run days to appear lift-like in audit projection.

## 8. Tests added/updated

TDD was followed.

RED failures observed before reconciliation:

- Finalized rules audit still had 36 rule-review items.
- `Heavy Upper + Sprints + Core` lacked a conditioning block.
- Audit expected sprint exposure as run-like legacy output.

GREEN result after reconciliation:

- Planner seed audit has 0 mismatches.
- Heavy upper sprint days produce `warmup`, `lift`, `conditioning`, `cooldown`.
- Heavy upper sprint days have no run logging target.

## 9. Promotion criteria application

Phase 23G criteria:

`READY_FOR_SHADOW_MODE` requires:

- 0 critical mismatches
- 0 rule conflicts
- <= 5 expected review items

Final values:

- Critical mismatches: **0**
- Rule conflicts: **0**
- Expected review items: **0**

Decision:

**READY_FOR_SHADOW_MODE**

Important boundary:

- Shadow mode was not enabled.
- Planner was not promoted.
- Home was not modified.
- Train was not modified.
- Log was not modified.
- UI was not modified.
- Source of truth was not changed.

## 10. Recommended next phase

Recommended next phase:

**Phase 23H — Planner Shadow Mode Readiness Gate V1**

Suggested scope:

1. Confirm shadow-mode input/output payload boundaries.
2. Confirm no user-facing UI changes.
3. Define where shadow comparison results are stored or logged.
4. Add tests proving shadow mode cannot alter Home, Train, Log, or logged data.
5. Only after approval, enable shadow-mode observation without source-of-truth promotion.

# Planner Promotion Audit V1

Phase: 23E — Planner Promotion Audit V1  
Scope: audit-only  
Runtime promotion: not performed

## Executive summary

The Training Planner is deterministic and capable of producing complete daily sessions for every seed-plan workout, but it is **not ready for promotion beyond audit/shadow analysis** yet.

The audit compared the new planner output against an audit-only legacy projection for all seed training days. The planner correctly preserves the Phase 23D intended improvement for `Zone 2 + Mobility + Core`: these days now resolve as `RunDay` with `warmup`, `run`, `mobility`, `cooldown`, and no lift block.

However, the audit still found more than five `NEEDS_REVIEW` mismatches. Per Phase 23E decision rules, the recommendation is therefore:

**Promotion recommendation: NOT_READY**

No runtime behavior was modified. Home, Train, Log, UI, existing engines, and legacy code were not promoted or rewired.

## Planner readiness score

Days audited: 84

Exact matches: 56

Intentional improvements: 60

Needs review: 36

Critical mismatches: 0

Mismatch rate: 33.33% of days had at least one mismatch

Promotion recommendation: NOT_READY

Shadow-mode safety: Not safe yet under the Phase 23E decision rules, because `NEEDS_REVIEW` is greater than 5.

## Audit scope

Every workout currently present in the seed training plan was audited.

Compared fields:

- day type
- workout title
- run title
- run type
- run distance
- run duration
- session classification
- primary session
- blocks generated
- lift presence
- run presence
- mobility presence
- cooldown presence

## Created audit module

File: `src/lib/planner-promotion-audit.ts`

Exports:

- `PromotionAuditResult`
- `PromotionAuditMismatch`
- `auditPlannerPromotion(input): PromotionAuditResult`

The audit module does not wire the planner into runtime. It builds an audit-only comparison between:

1. Planner output from `buildDailyTrainingSession()` plus `resolvePrimarySession()`.
2. Legacy output from a local audit projection that intentionally approximates pre-resolver legacy derivation patterns.

## Result shape

`PromotionAuditResult` includes:

- `totalDaysAudited`
- `plannerMatchesLegacy`
- `plannerMismatchesLegacy`
- `mismatchRate`
- `mismatches[]`
- `expectedImprovements`
- `needsReview`
- `criticalMismatches`
- `promotionRecommendation`
- `days[]`

## Mismatch summary

By severity:

- `EXPECTED_IMPROVEMENT`: 60
- `NEEDS_REVIEW`: 36
- `CRITICAL`: 0

By mismatch type:

- `DAY_TYPE`: 12
- `PRIMARY_SESSION`: 12
- `WORKOUT`: 12
- `RUN`: 4
- `BLOCKS`: 28
- `CLASSIFICATION`: 28

## Expected improvements

The expected improvements are concentrated on Wednesday support-run days:

- Week 1: `Zone 2 + Mobility + Core`
- Week 2: `Zone 2 + Mobility + Core`
- Week 3: `Zone 2 + Mobility + Core`
- Week 4: `Zone 2 + Mobility + Core`
- Weeks 5–12: `Zone 2 Run + Mobility + Core`

The planner now classifies these days as:

- Primary session: `RunDay`
- Blocks: `warmup`, `run`, `mobility`, `cooldown`
- Lift presence: false
- Run presence: true
- Mobility presence: true
- Cooldown presence: true

Legacy projection classified those same days as:

- Primary session: `LiftDay`
- Blocks: `warmup`, `lift`, `run`, `mobility`, `cooldown`
- Lift presence: true
- Run presence: true

Classification: `EXPECTED_IMPROVEMENT`

Reason: Phase 23D intentionally fixed support work so mobility/core cannot turn a run day into a lift or hybrid day.

## Needs review findings

The audit found 36 `NEEDS_REVIEW` mismatch entries. They fall into two practical groups.

### 1. Upper hypertrophy mobility inference

Affected days:

- Week 1 Thursday: `Upper Hypertrophy + Density`
- Week 2 Thursday: `Upper Hypertrophy + Density`
- Week 3 Thursday: `Upper Hypertrophy + Density`
- Week 4 Thursday: `Upper Hypertrophy + Density`
- Week 5 Thursday: `High-Volume Upper Hypertrophy`
- Week 6 Thursday: `High-Volume Upper Hypertrophy`
- Week 7 Thursday: `High-Volume Upper Hypertrophy`
- Week 8 Thursday: `High-Volume Upper Hypertrophy`
- Week 9 Thursday: `High-Density Hypertrophy`
- Week 10 Thursday: `High-Density Hypertrophy`
- Week 11 Thursday: `High-Density Hypertrophy`
- Week 12 Thursday: `High-Density Hypertrophy`

Pattern:

Planner:

- Blocks: `warmup`, `lift`, `cooldown`
- Classification: `lift`

Legacy projection:

- Blocks: `warmup`, `lift`, `mobility`, `cooldown`
- Classification: `lift + mobility`

Likely cause:

Legacy string matching treats shoulder-related hypertrophy work as mobility-like because it sees text such as `Shoulder` in exercise or notes. The planner does not create a separate mobility block for these lift days.

Initial assessment:

This is likely a legacy/projection artifact or a display-classification mismatch, not a critical planner failure. It should still be reviewed before planner promotion so real Home/Train behavior does not lose any intended warmup/mobility guidance.

### 2. Heavy upper sprint handling

Affected days:

- Week 5 Monday: `Heavy Upper + Sprints + Core`
- Week 6 Monday: `Heavy Upper + Sprints + Core`
- Week 7 Monday: `Heavy Upper + Sprints + Core`
- Week 8 Monday: `Heavy Upper + Sprints + Core`

Pattern:

Planner:

- Blocks: `warmup`, `lift`, `cooldown`
- Classification: `lift`
- Run presence: false

Legacy projection:

- Blocks: `warmup`, `lift`, `run`, `cooldown`
- Classification: `lift + run`
- Run presence: true
- Run type: `speed`

Likely cause:

The planner treats sprints on lift days as conditioning/accessory stress, while the audit-only legacy projection treats sprint text as a run block.

Initial assessment:

This needs review because it affects how sprint exposure is represented. It is not classified as critical because the affected source workouts are upper-lift days with sprint exposure, not primary scheduled endurance-run days like `Zone 2` or `Long Run`.

## Critical mismatches

Critical mismatches found: 0

No seed-plan scheduled primary run or long run was removed by the planner in this audit.

Protected outcomes verified by the audit:

- Long runs remain `LongRunDay`.
- Long runs have run blocks.
- Zone 2 support-run days remain run days.
- Zone 2 support-run days do not create lift blocks.

## Decision-rule application

Phase 23E decision rules:

- If critical mismatches > 0: `NOT_READY`
- If critical mismatches = 0 and needs review <= 5: `SHADOW_MODE_READY`
- If critical mismatches = 0 and needs review = 0: `TRAIN_READY`

Observed:

- Critical mismatches: 0
- Needs review: 36

Decision:

**NOT_READY**

Reason:

The planner has no critical mismatch, but the number of review-required mismatches exceeds the shadow-mode threshold.

## Tests added

File: `src/lib/planner-promotion-audit.test.ts`

Coverage:

1. Audit generation produces a report for seed workouts.
2. Match detection produces no mismatch for identical outputs.
3. `Zone 2 + Mobility + Core` legacy `LiftDay` vs planner `RunDay` is classified as `EXPECTED_IMPROVEMENT`.
4. Planner removing a scheduled run is classified as `CRITICAL`.
5. Recommendation engine returns:
   - `NOT_READY` when a critical mismatch exists.
   - `SHADOW_MODE_READY` when only expected improvements exist.

## Validation

Commands run:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

Latest test result after adding Phase 23E:

- Tests: 508
- Pass: 508
- Fail: 0

## Promotion recommendation

Recommendation: **NOT_READY**

The planner should not yet be promoted into Home, Train, or Log.

Recommended next action:

Perform a narrow Phase 23F review/fix phase focused only on `NEEDS_REVIEW` categories:

1. Decide whether shoulder/hypertrophy text should ever create a separate mobility block.
2. Decide whether sprint exposure on upper-lift days should be represented as conditioning, run, or accessory block.
3. Re-run the promotion audit after those categories are resolved.

Do not proceed to runtime integration until the audit reaches at least `SHADOW_MODE_READY` under the Phase 23E decision rules.

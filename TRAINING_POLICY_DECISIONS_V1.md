# TRAINING POLICY DECISIONS V1

## Scope Boundary

- Phase: 26B — Training Policy Decision Lock V1
- Purpose: convert Phase 26A shadow-trial findings into explicit planner policy decisions.
- Deliverable: decision document only.
- Planner status: developer-only, advisory-only, read-only, not promoted.
- Runtime boundary: no planner implementation, planner output, UI, Train screen, source-of-truth, recommendation, readiness, progression, persistence, logging, or test changes are authorized by this document.

## Evidence Reviewed

- `REAL_WORLD_SHADOW_TRIAL_V1.md`
  - 84 seed-plan days evaluated.
  - 56 PASS.
  - 28 REVIEW_REQUIRED.
  - 12 wrong-primary-objective reviews from recovery seed days presenting as `MobilityDay`.
  - 16 missing-support-work reviews from core/trunk work not surfaced consistently.
  - 0 incorrect logging reviews.
  - 0 stress-rating reviews.
  - 0 duration reviews.
- `src/lib/seed-data.ts`
  - Sundays are explicit `Recovery` seed days with easy walk, mobility flow, meal prep, hydration, and sleep focus.
  - Weeks 4, 8, and 12 set `deload` on lift/run templates while retaining the underlying day stimulus.
  - Core/trunk examples include hanging leg raises, cable crunches, Pallof press, side plank, loaded carries, farmer carries, and ab wheel.
- Current planner/resolver context was reviewed only to understand terminology. This document does not change it.

## Findings

### Finding 1 — Recovery and mobility are not the same policy concept

Phase 26A showed that all 12 Sunday seed recovery days were safe from a logging and load perspective, but their primary classification was not policy-correct:

- Seed day: `Recovery`
- Expected policy concept: `RecoveryDay`
- Observed planner-facing classification in the trial: `MobilityDay`
- Logging: none
- Stress: low
- Duration: 35 min

The issue is not that mobility appeared. Mobility is valid on a recovery day. The issue is that mobility became the primary day identity when the plan intent was recovery.

### Finding 2 — Core/trunk work is real support work, not invisible filler

Phase 26A found 16 lift days where the primary day type remained correct but core/trunk support was not visible as `Support: Core`.

Examples from the seed plan:

- `Loaded Carries`
- `Farmer Carries`
- `Ab Wheel`
- `Hanging Leg Raises`
- `Cable Crunches`
- `Pallof Press`
- `Side Plank`
- dedicated core circuits
- trunk stability work

This work should not change the primary day type. But hiding it makes the planner under-explain the actual training prescription.

### Finding 3 — Deload is a modifier, not a primary modality

Seed weeks 4, 8, and 12 reduce volume while preserving the underlying day intent:

- upper lift remains upper lift
- lower lift remains lower lift
- Zone 2 remains Zone 2
- long run remains long run, usually with reduced distance
- recovery remains recovery

Phase 26A found no `DeloadDay` outputs. That is not automatically wrong. A deload week modifies the prescription but does not usually replace the day’s primary stimulus.

## Decision 1 — Recovery Classification

### Options Considered

#### Option A — `RecoveryDay` remains distinct

Policy:

- A day whose source-plan intent is recovery, rest, walking, sleep, hydration, meal prep, or restoration is classified as `RecoveryDay`.
- Mobility can appear inside the day as support work.
- Recovery walking can appear inside the day as recovery support.
- No lift logging target.
- No run logging target unless the source plan explicitly prescribes a structured run.
- Stress should be `Recovery` or `Low`, never `Moderate`/`High` under normal recovery conditions.

#### Option B — `RecoveryDay` becomes `MobilityDay`

Policy:

- Recovery days with mobility work are classified as `MobilityDay`.
- Recovery becomes an implied intent rather than a primary session type.
- The planner presents movement quality as the primary prescription.

### Final Recommendation

**Choose Option A: `RecoveryDay` remains distinct.**

### Rationale

#### Readiness

Recovery is a readiness-management state. A user may be Green, Yellow, or Red, but a planned recovery day still exists as a low-stress prescription. If recovery collapses into mobility, future readiness overrides become harder to reason about:

- `RecoveryDay` clearly means protect restoration.
- `MobilityDay` means movement-quality work may be the primary stimulus.
- Red readiness can force a training day into recovery, but that should be explicit rather than hidden under mobility.

Policy lock:

- Readiness may modify a day into recovery.
- Recovery classification must remain available as a first-class planner output.
- Mobility may support recovery but must not erase recovery intent.

#### Progression

Progression systems need to distinguish between:

- planned recovery/restoration
- skipped training
- light mobility-only work
- forced deload/recovery due to poor readiness

If recovery days become mobility days, progression may over-credit mobility as training compliance or under-recognize planned fatigue management.

Policy lock:

- `RecoveryDay` counts as planned recovery compliance.
- `MobilityDay` counts as planned movement-quality compliance.
- Neither should create lift/run progression by itself.

#### User Understanding

The user should understand Sunday as a recovery prescription, not simply “do mobility.” The seed plan explicitly says:

- walking
- stretching
- meal prep
- mobility
- hydration
- sleep focus

That is a recovery behavior package, not a mobility session.

Policy lock:

- User-facing/developer-facing planner language should preserve the mental model: “Today is recovery.”
- Mobility is one component of the recovery day.

#### Future Adaptive Planning

Future adaptive planning will need recovery as an explicit state for:

- high-fatigue overrides
- pain/injury protection
- post-long-run recovery
- deload-week coordination
- missed-session rescheduling
- taper weeks
- race-week recovery

If `RecoveryDay` disappears into `MobilityDay`, future adaptive rules would have to infer recovery intent from secondary support blocks, which is fragile.

Policy lock:

- `RecoveryDay` remains a canonical day type.
- `MobilityDay` remains available only when mobility/movement quality is the primary planned stimulus and recovery is not the full-day intent.

### Examples

- Sunday seed plan with easy walk + mobility flow + meal prep:
  - Final policy: `RecoveryDay`
  - Support: Mobility, walking/recovery, nutrition prep
  - Logging: none
  - Stress: Recovery/Low

- Standalone 30-minute hip/thoracic/shoulder mobility prescription:
  - Final policy: `MobilityDay`
  - Support: Mobility
  - Logging: none
  - Stress: Low

- Red-readiness override replacing a lift with easy walk/mobility:
  - Final policy: `RecoveryDay`
  - Modification source: Readiness
  - Original day type remains available as source-plan metadata, but active prescription is recovery.

## Decision 2 — Core Support Visibility

### Options Considered

#### Option A — Core remains embedded inside primary work

Policy:

- Core/trunk items stay inside lift or run prescriptions.
- Planner does not emit a separate `Support: Core` marker.
- Primary day type remains simple, but support visibility is lower.

#### Option B — Core emits `Support: Core`

Policy:

- Core/trunk work is surfaced as `Support: Core` when explicitly present.
- Core does not create a primary session type.
- Core does not create a lift logging target by itself.
- Core does not turn `RunDay` into `LiftDay` or `HybridDay`.
- Core can coexist with lift, run, long run, mobility, and recovery prescriptions.

### Final Recommendation

**Choose Option B: explicit core/trunk work should emit `Support: Core`.**

### Rationale

Core is a real training obligation in the seed plan. It affects duration, fatigue, compliance, and user expectations. It should be visible so the planner output answers: “What support work do I need to do today?”

However, core is support work, not primary identity, unless a future seed plan explicitly defines a dedicated primary core session.

Policy lock:

- `Support: Core` should be emitted for explicit core/trunk work.
- `Support: Core` must not change day type.
- `Support: Core` must not create run or lift logging targets by itself.
- Core completion may be tracked as part of the parent session in future execution flows, but this document does not implement that.

### Specific Core/Trunk Decisions

#### Farmer carries

Decision:

- Emit `Support: Core` when farmer carries are programmed as trunk/bracing/carry work.
- If a future plan programs farmer carries as the main loaded conditioning event, they may also appear in conditioning support, but they still should not change primary day type by themselves.

Example:

- `Athletic Conditioning` with farmer carries:
  - Session type: `LiftDay`
  - Support: Conditioning, Core
  - Logging: Lift only

#### Loaded carries

Decision:

- Emit `Support: Core` when loaded carries are programmed as trunk stability/bracing.
- Do not use loaded carries alone to create a separate primary lift day if the day is otherwise run/recovery/mobility.

Example:

- `Lower Strength` with loaded carries:
  - Session type: `LiftDay`
  - Support: Core
  - Logging: Lift only

#### Ab wheel

Decision:

- Emit `Support: Core`.
- Ab wheel is explicit trunk/core work.

Example:

- `Athletic Conditioning` with ab wheel:
  - Session type: `LiftDay`
  - Support: Conditioning, Core
  - Logging: Lift only

#### Dedicated core circuits

Decision:

- Emit `Support: Core` when attached to another primary day.
- If a future plan defines a standalone core-only day, classify the day as `MobilityDay` or a future explicit `CoreSupportDay` only if policy is expanded. Do not infer `LiftDay` from core alone under current policy.

Example:

- `Zone 2 + Mobility + Core`:
  - Session type: `RunDay`
  - Primary objective: Zone 2
  - Support: Mobility, Core
  - Logging: Run only

#### Trunk stability work

Decision:

- Emit `Support: Core` for Pallof press, side plank, anti-rotation, anti-extension, bracing, carries, and trunk stability patterns.
- Keep them subordinate to the primary day stimulus.

Example:

- Zone 2 with Pallof press + side plank:
  - Session type: `RunDay`
  - Support: Mobility, Core
  - Logging: Run only

### User Understanding

Visible core support helps the user see why a day is longer or more demanding without creating false primary-session obligations. It also avoids the opposite problem: a plan says core exists, but the planner output looks like core was omitted.

### Future Adaptive Planning

Surfacing `Support: Core` enables future adaptive planning to:

- reduce core volume during high soreness or low readiness
- preserve core during deload if appropriate
- track trunk-stability compliance
- avoid stacking excessive core/bracing after heavy lower-body work
- distinguish strength progression from accessory/core compliance

## Decision 3 — Deload Representation

### Options Considered

#### Option A — `DeloadDay` session type

Policy:

- Deload becomes the primary session type.
- A deload lift day becomes `DeloadDay` instead of `LiftDay`.
- A deload run day becomes `DeloadDay` instead of `RunDay` or `LongRunDay`.

Potential benefit:

- Very clear that the day is part of a deload phase.

Problems:

- It hides the modality that determines execution and logging.
- It creates ambiguity: a `DeloadDay` could be lift, run, long run, mobility, or recovery.
- It can weaken user understanding: the user still needs to know what kind of reduced session to do.
- It complicates future Home/Train/Log mapping because logging depends on modality, not on deload status alone.

#### Option B — deload metadata attached to existing session type

Policy:

- Preserve the primary session type.
- Attach deload as metadata/modifier.
- Examples:
  - `LiftDay + deload=true`
  - `RunDay + deload=true`
  - `LongRunDay + deload=true`
  - `RecoveryDay + deload=true` only if the source week is deload and the day remains recovery

Potential benefit:

- Preserves execution clarity.
- Preserves logging clarity.
- Allows deload-specific load/volume/duration adjustments without destroying modality.
- Works better for future adaptive planning.

### Final Recommendation

**Choose Option B: deload should be metadata attached to the existing session type.**

### Rationale

Deload changes dosage, not identity.

A deload upper-strength day is still an upper-strength/lift day. A deload long run is still a long run, just reduced. A deload Zone 2 day is still a run day. The planner should preserve the primary training question:

“What kind of session is today?”

Then it should answer the modifier question:

“How should this session be adjusted because it is deload?”

Policy lock:

- `DeloadDay` should not replace normal modality-based session types for seed-plan deload weeks.
- Deload should be represented as metadata, for example `deload=true`, `phaseModifier=deload`, or equivalent future field.
- The base session type remains responsible for logging target and execution flow.
- Deload metadata is responsible for volume/intensity/duration guidance.

### Examples

#### Week 4 Monday — Upper Strength + Sprints + Core, deload week

Final policy:

- Session type: `LiftDay`
- Metadata: `deload=true`
- Support: Conditioning, Core
- Logging: Lift only
- Deload meaning: reduce lift volume/intensity; avoid max effort; sprint/conditioning should be reduced or gated by readiness.

#### Week 4 Wednesday — Zone 2 + Mobility + Core, deload week

Final policy:

- Session type: `RunDay`
- Metadata: `deload=true`
- Support: Mobility, Core
- Logging: Run only
- Deload meaning: maintain easy aerobic intent; reduce duration if needed.

#### Week 4 Saturday — Long Run, deload week

Final policy:

- Session type: `LongRunDay`
- Metadata: `deload=true`
- Logging: Run only
- Deload meaning: long-run distance is reduced relative to build weeks.

#### Week 4 Sunday — Recovery, deload week

Final policy:

- Session type: `RecoveryDay`
- Metadata: `deload=true` if the whole week carries deload context
- Logging: none
- Deload meaning: reinforces restoration; does not create a new session type.

### Future Adaptive Planning

Deload metadata supports future systems better than `DeloadDay` because it allows adaptive rules like:

- reduce lifting sets by 30–40%
- keep movement quality high
- suppress max-effort work
- reduce long-run distance
- keep Zone 2 conversational
- preserve logging target by modality
- coordinate deload weeks with readiness, injury risk, race calendar, and progression decisions

A standalone `DeloadDay` would be too broad for execution. It would still require a second field to say whether the user should lift, run, recover, or do mobility. Therefore it should not be the normal representation.

## Final Policy Lock

### Locked Decision 1

`RecoveryDay` remains distinct.

- Recovery is a primary planner state.
- Mobility can be support inside recovery.
- Recovery should not be collapsed into `MobilityDay`.

### Locked Decision 2

Explicit core/trunk work emits `Support: Core`.

- Farmer carries: `Support: Core` when programmed as carry/bracing/trunk work.
- Loaded carries: `Support: Core` when programmed as carry/bracing/trunk work.
- Ab wheel: `Support: Core`.
- Dedicated core circuits: `Support: Core` when attached to another primary day.
- Trunk stability: `Support: Core`.
- Core never changes primary day type by itself.
- Core never creates run/lift logging by itself.

### Locked Decision 3

Deload is metadata on the existing session type.

- Use `LiftDay + deload=true`.
- Use `RunDay + deload=true`.
- Use `LongRunDay + deload=true`.
- Use `RecoveryDay + deload=true` when recovery occurs inside a deload week.
- Do not use `DeloadDay` as the normal primary session type for seed-plan deload weeks.

## Future Implications

### For future planner reconciliation

The next implementation/reconciliation phase, if approved, should treat this document as policy source of truth. The known Phase 26A review items should be classified mechanically:

- Recovery seed days producing `MobilityDay` are policy mismatches.
- Core/trunk work omitted from support visibility is a policy mismatch.
- Absence of `DeloadDay` is not a policy mismatch if deload metadata is preserved.
- Replacing `LiftDay`, `RunDay`, or `LongRunDay` with `DeloadDay` would be a policy mismatch under this document.

### For future tests

If implementation is later approved, tests should prove:

- recovery seed days classify as `RecoveryDay`
- recovery days may include mobility support
- core support appears for explicit core/trunk work
- core does not change `RunDay` into `LiftDay` or `HybridDay`
- deload weeks preserve base session type
- deload metadata is available to downstream consumers
- logging targets follow base session type, not support work or deload metadata

No tests were changed in this phase.

### For Home / Train / Log

This document does not authorize any Home, Train, or Log change. If future promotion occurs, the policy implications are:

- Home should be able to explain recovery as recovery, not just mobility.
- Train should know the base execution modality even during deload.
- Log should follow base session logging targets.
- Support work visibility should not create duplicate logging surfaces.

### For readiness and progression

- Readiness can modify active prescriptions, but it should not erase source-plan intent.
- Progression should recognize planned recovery separately from missed training.
- Deload metadata should help progression reason about reduced volume without losing modality.
- Core support visibility enables better fatigue and compliance analysis without inflating primary training load.

## Recommendation for Next Phase

Recommended next phase:

**Phase 26C — Mechanical Policy Reconciliation Plan V1**

Recommended scope:

- Documentation/plan first, unless implementation is explicitly authorized.
- Map each Phase 26A review item to this policy document.
- Identify exact files/functions that would need changes if implementation is approved.
- Define test expectations without changing tests yet unless the phase explicitly permits implementation.
- Keep planner developer-only, advisory-only, read-only, and not promoted.

If implementation is later approved after the plan, use a narrow reconciliation phase only:

1. Add failing tests for these locked policies.
2. Update planner/resolver/reporting logic only as needed.
3. Do not wire planner into Home, Train, Log, persistence, recommendations, readiness, or progression.
4. Re-run full validation.

## Validation Notes

Validation commands required by this phase:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

This section records the intended validation boundary. The command results are reported in the final phase response.

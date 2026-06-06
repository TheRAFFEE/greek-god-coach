# ADAPTER_PILOT_READINESS_DECISION_BRIEF_V1

Phase: 27K — Developer-Only Adapter Pilot Readiness Decision Brief V1  
Status: documentation-only decision brief  
Decision: **PILOT_READY_WITH_CONSTRAINTS**

## Scope boundary

This brief is documentation only.

No runtime behavior was created or changed.

Explicitly not performed:

- no runtime wiring
- no `page.tsx` modification
- no Home UI replacement
- no Train UI modification
- no Log UI modification
- no feature flag creation or activation
- no pilot activation
- no planner promotion
- no adapter promotion
- no source-of-truth ownership change
- no readiness ownership change
- no progression ownership change
- no recommendation ownership change
- no persistence ownership change

Planner and Home Adapter remain developer-only, advisory-only, read-only, unmounted, and not promoted.

## 1. Executive decision

**Decision: PILOT_READY_WITH_CONSTRAINTS**

The hardened Home Adapter is ready to be considered for a future **developer-only pilot** only if the activation constraints in this brief are met in a later explicitly approved phase.

It is **not** approved for user-facing replacement, source-of-truth migration, runtime promotion, or default Home consumption.

### Decision rationale

The evidence from Phases 27D–27J shows that the adapter contract, pure implementation, parity tests, hardening tests, remediation, and regression audit now pass. The adapter has explicit `BLOCKER` and `WARNING` diagnostics, preserves critical planner invariants, and remains unmounted from runtime Home consumers.

The decision is not unconditional because no real runtime pilot has occurred, no developer-only runtime flag policy exists yet, rollback has not been exercised live, and the adapter output is not yet rendered in Home.

## 2. Evidence summary

### 2.1 Contract design

Evidence:

- `HOME_ADAPTER_CONTRACT_V1.md`
- `HOME_ADAPTER_IMPLEMENTATION_PLAN_V1.md`

Findings:

- Contract defined `HomeTrainingModel` as a Home-safe training display model.
- Contract preserved ownership boundaries:
  - planner owns session identity, session type, primary objective, prescription metadata, support, deload, duration, and audit trail
  - readiness engine owns readiness
  - progression engine owns progression
  - recommendation pipeline owns recommendations
  - persistence owns workout/run completion and history
  - Home owns rendering/default display path
- Contract explicitly forbids planner/adapter fabrication of readiness, progression, recommendations, persistence, and source-of-truth state.
- Contract requires diagnostics and keeps legacy Home as fallback on unsafe data.
- Contract states `RecoveryDay` must remain distinct and must not collapse into `MobilityDay`.
- Contract states `Support: Core` remains support only.
- Contract states deload remains metadata only and must not create `DeloadDay`.

### 2.2 Pure adapter implementation

Evidence:

- `src/lib/home-adapter.ts`
- `src/lib/home-adapter.test.ts`

Findings:

- Implemented pure adapter function:
  - `buildHomeTrainingModel(...)`
- Implemented validation helpers:
  - `validateDailyTrainingSession(...)`
  - `validateDomainInputs(...)`
  - `validateAuditAndProvenance(...)`
  - `validatePersistenceInputs(...)`
- Adapter maps valid `DailyTrainingSession` input to `HomeTrainingModel` without runtime wiring.
- Adapter blocks unsafe inputs instead of fabricating readiness/progression/recommendation/persistence.
- Adapter keeps completion status sourced from supplied workout/run logs, not planner claims.
- Adapter remains test-only/unmounted from runtime Home consumers.

### 2.3 Parity verification

Evidence:

- `src/lib/home-adapter-parity.test.ts`

Findings:

- Representative adapter models were verified against Home-display-compatible structure.
- Shadow comparison builds legacy Home path and adapter path without reconciling or replacing output.
- Verified invariants:
  - session identity preserved
  - session type preserved
  - `RecoveryDay` remains `RecoveryDay`
  - no `RecoveryDay -> MobilityDay` conversion
  - `Support: Core` remains support only
  - support does not alter session type
  - support does not alter logging requirements
  - deload remains metadata only
  - no `DeloadDay` creation
  - duration metadata preserved
  - workout/run logging preserved
  - audit/provenance preserved

### 2.4 Contract hardening

Evidence:

- `HOME_ADAPTER_CONTRACT_HARDENING_V1.md`
- `src/lib/home-adapter-contract-hardening.test.ts`

Findings:

- Phase 27H added malformed/incomplete/edge-case tests.
- Phase 27H initially found five contract gaps:
  1. invalid/future session type not blocked
  2. missing logging target crash instead of diagnostic
  3. duplicate support categories/items not diagnosed
  4. malformed duration metadata warning instead of blocker
  5. audit/provenance mismatch not blocked

### 2.5 Remediation

Evidence:

- `src/lib/home-adapter.ts`
- `src/lib/home-adapter-contract-hardening.test.ts`
- `HOME_ADAPTER_CONTRACT_HARDENING_V1.md`

Findings:

- Phase 27I remediated all five hardening gaps.
- Current hardened diagnostics include:
  - `INVALID_SESSION_TYPE` as `BLOCKER`
  - `WORKOUT_LOGGING_TARGET_MISSING` as `BLOCKER`
  - `RUN_LOGGING_TARGET_MISSING` as `BLOCKER`
  - `INVALID_DURATION_METADATA` as `BLOCKER`
  - `AUDIT_HASH_MISMATCH` as `BLOCKER`
  - `PROVENANCE_MISMATCH` as `BLOCKER`
  - `DUPLICATE_SUPPORT_CATEGORY` as `WARNING`
  - `DUPLICATE_SUPPORT_ITEM` as `WARNING`
- Missing logging targets no longer throw runtime exceptions.
- Malformed duration metadata emits no unsafe model.
- Audit/provenance mismatches do not pass silently.

### 2.6 Regression audit

Evidence:

- `HARDENED_ADAPTER_REGRESSION_AUDIT_V1.md`
- `src/lib/home-adapter-regression-audit.test.ts`

Findings:

- Total audited adapter cases: 21
- PASS representative session cases: 14
- WARNING contract cases: 1
- BLOCKER contract cases: 6
- Regression audit status: `HARDENED_ADAPTER_REGRESSION_AUDIT_PASS`
- No adapter regression found.
- Valid representative sessions emit `PASS` and non-null model.
- Invalid contract inputs emit `BLOCKER` and suppress unsafe model.
- Duplicate support contract input emits `WARNING` while preserving mapping.

### 2.7 Validation results

Most recent Phase 27J validation evidence:

```text
pnpm test
result: tests 595, pass 595, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 545.701208, exit_code 0

pnpm typecheck
result: $ tsc --noEmit, exit_code 0

pnpm lint
result: $ eslint, exit_code 0

pnpm build
result: Next.js production build compiled successfully; generated 7/7 static pages; exit_code 0
```

Phase 27K validation was run again after creating this brief:

```text
pnpm test
result: tests 595, pass 595, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 535.779917, exit_code 0

pnpm typecheck
result: $ tsc --noEmit, exit_code 0

pnpm lint
result: $ eslint, exit_code 0

pnpm build
result: Next.js production build compiled successfully; generated 7/7 static pages; exit_code 0
```

## 3. Go/no-go checklist

### Current readiness checklist

- [x] Adapter remains unmounted.
- [x] No runtime Home consumer imports adapter.
- [x] No Home UI replacement occurred.
- [x] All tests passed in latest completed validation.
- [x] Typecheck passed in latest completed validation.
- [x] Lint passed in latest completed validation.
- [x] Build passed in latest completed validation.
- [x] Blocker diagnostics work.
- [x] Warning diagnostics work.
- [x] Audit/provenance rules work.
- [x] Rollback path remains legacy Home because adapter is not mounted.
- [x] Pilot remains developer-only in policy and tests.
- [ ] Feature flag policy is absent/not implemented.
- [ ] Developer-only runtime pilot switch is absent/not implemented.
- [ ] Runtime rendering path has not been exercised.
- [ ] Live rollback has not been tested because no runtime pilot exists.

### Go/no-go result

**GO for a future developer-only pilot design/activation plan.**

**NO-GO for immediate runtime activation in this phase.**

Reason: the adapter contract is hardened and regression-audited, but runtime pilot policy, feature flag policy, explicit consumer list, live rollback behavior, and developer-only rendering suppression rules have not yet been implemented or validated.

## 4. Remaining risks

1. **Adapter output is not yet rendered in Home.**
   - Tests prove model contract and shape, but no user-facing or developer-facing runtime rendering path has consumed it.

2. **No real user-facing pilot has occurred.**
   - All evidence is developer-only tests, shadow/parity verification, and non-runtime audit.

3. **Persistence ownership remains external.**
   - Adapter consumes supplied workout/run logs and completion state; it does not own persistence.

4. **Readiness/progression/recommendation ownership remains external.**
   - Adapter blocks missing domain inputs but does not calculate or own those engines.

5. **Source-of-truth migration has not occurred.**
   - Legacy Home remains source/default runtime path.
   - Planner/adapter output remains advisory and unmounted.

6. **Rollback has not been tested in live runtime.**
   - Current rollback is structurally safe because legacy Home is still default, but a future pilot must test runtime fallback from adapter failure to legacy Home.

7. **Feature flag policy is not implemented.**
   - No developer-only flag exists yet for adapter pilot rendering.
   - No flag ownership, default-off behavior, or kill switch has been implemented.

8. **Runtime consumer list is not yet formalized in code.**
   - Future activation must explicitly list every consumer allowed to read adapter output.

9. **Diagnostic rendering policy is not implemented.**
   - Tests verify diagnostic results, but no runtime UI policy exists for rendering/suppressing `BLOCKER` or `WARNING` states.

10. **No production telemetry/observability exists for adapter pilot.**
    - Future pilot should record developer-only diagnostics and fallback events without persisting planner output as source of truth.

## 5. Exact activation constraints

Before any future pilot activation, all of the following must be true:

1. **Developer-only flag required.**
   - A future phase must create an explicit developer-only flag.
   - The flag must default to off.
   - The flag must not be enabled for normal users.

2. **Legacy Home remains default.**
   - Existing Home rendering remains the default path.
   - Adapter may not replace `buildHomeCommandCenter(...)` or current Home model ownership by default.

3. **Adapter output may be computed but not persisted as source of truth.**
   - Adapter output may be generated for developer-only preview/pilot diagnostics.
   - It must not overwrite AppState, logs, recommendations, readiness, progression, or Home source-of-truth state.

4. **No user-facing replacement without explicit future phase.**
   - Any visible Home replacement requires a separate approved phase.
   - Train and Log must remain unchanged unless explicitly approved in future scope.

5. **Rollback must be instant.**
   - Turning off the developer-only flag must immediately return to legacy Home.
   - Any adapter `BLOCKER` must automatically fall back/suppress adapter render.

6. **Diagnostics must suppress rendering on `BLOCKER`.**
   - If adapter result status is `BLOCKER`, pilot UI must not render adapter model.
   - It may show developer-only diagnostics only if explicitly scoped.

7. **`WARNING` may render only in developer-only mode.**
   - Warning-state adapter output may be shown only to developer-only users.
   - Warning diagnostics must be visible in developer mode.
   - Warning diagnostics must not silently hide uncertainty.

8. **All runtime consumers must be explicitly listed.**
   - Future pilot implementation must list exact files/functions allowed to consume adapter output before wiring.
   - Any unlisted runtime import is forbidden.

9. **Audit/provenance must remain mandatory.**
   - No pilot render without valid audit hash and approved provenance.
   - `AUDIT_HASH_MISMATCH` and `PROVENANCE_MISMATCH` must suppress adapter rendering.

10. **No ownership changes during pilot.**
    - Readiness remains owned by readiness engine.
    - Progression remains owned by progression engine.
    - Recommendations remain owned by recommendation pipeline.
    - Persistence remains owned by existing logs/state.
    - Source-of-truth remains legacy runtime/AppState until separately approved.

## 6. Recommended next phase

**Recommended next phase: PHASE 27L — Developer-Only Adapter Pilot Activation Plan V1**

Recommended scope:

- Documentation/architecture plan only.
- No runtime wiring yet.
- Define the exact developer-only pilot flag policy.
- Define the exact allowed runtime consumers.
- Define adapter render suppression rules for `BLOCKER` and `WARNING`.
- Define instant rollback behavior.
- Define developer-only diagnostics display requirements.
- Define validation commands and test matrix for a later implementation phase.

Do not activate the pilot in Phase 27L. Use Phase 27L to produce the exact activation plan and safety contract first.

## 7. Decision summary

Decision status: **PILOT_READY_WITH_CONSTRAINTS**

Go/no-go result:

- **GO** for future developer-only pilot planning.
- **NO-GO** for immediate runtime activation, default Home replacement, user-facing pilot, planner promotion, adapter promotion, or source-of-truth migration.

Final condition:

The Home Adapter is ready for a future developer-only pilot only after a separate explicit pilot activation plan defines and validates developer-only flagging, consumer boundaries, diagnostics rendering/suppression, and rollback behavior.

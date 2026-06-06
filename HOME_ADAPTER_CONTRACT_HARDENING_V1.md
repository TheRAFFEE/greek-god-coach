# HOME_ADAPTER_CONTRACT_HARDENING_V1

Phase: 27H — Developer-Only Home Adapter Contract Hardening V1
Status: HOME_ADAPTER_CONTRACT_HARDENED after Phase 27I remediation
Previous Phase 27H status: HOME_ADAPTER_CONTRACT_NOT_HARDENED
Date: 2026-06-05

## Scope

This phase added test-only contract hardening coverage for the developer-only Home Adapter.

No runtime wiring was performed.
No page.tsx changes were performed.
No Home UI, Train UI, or Log UI changes were performed.
No feature flags were activated.
No pilot mode was activated.
No planner promotion was performed.
No source-of-truth ownership changes were performed.

Planner remains developer-only, advisory-only, read-only, and not promoted.

## Files Created

- `src/lib/home-adapter-contract-hardening.test.ts`
- `HOME_ADAPTER_CONTRACT_HARDENING_V1.md`

## Hardening Coverage Added

The test file stress-tests the Home Adapter contract against:

1. null planner sessions
2. partial planner sessions
3. invalid session types
4. unsupported future session types
5. mixed run/lift `HybridDay`
6. missing workout logging targets
7. missing run logging targets
8. duplicate support categories
9. duplicate support items
10. malformed duration metadata
11. missing deload metadata
12. audit hash mismatch
13. provenance mismatch
14. missing readiness
15. missing progression
16. missing recommendations
17. missing persistence arrays
18. RecoveryDay preservation
19. Support: Core preservation
20. deload metadata preservation
21. test-only/unmounted runtime import guard

## Passing Contract Areas

Observed passing hardening areas:

- null planner session returns BLOCKER without fabricated model
- partial planner session returns BLOCKER diagnostics for missing id/title/primary action/audit trail
- valid mixed run/lift `HybridDay` preserves both workout and run logging requirements
- missing deload metadata returns BLOCKER
- valid `RecoveryDay + deload=true` preserves `sessionType: RecoveryDay` and `deload: true`
- missing readiness returns BLOCKER
- missing progression returns BLOCKER
- missing recommendation returns BLOCKER
- missing workout persistence returns BLOCKER
- missing run persistence returns BLOCKER
- valid RecoveryDay preserves RecoveryDay identity
- valid Support: Core remains support
- valid Core support does not change logging
- home-adapter remains test-only and unmounted from runtime files

## Contract Gaps Found

The new hardening tests found five contract gaps.

### 1. Invalid / future session types are not blocked

Expected:

- `INVALID_SESSION_TYPE` BLOCKER

Observed:

- adapter returned `PASS`

Risk:

- Unsupported planner session types could enter `HomeTrainingModel` without explicit contract approval.

### 2. Missing logging targets are not converted into BLOCKER diagnostics

Expected:

- `WORKOUT_LOGGING_TARGET_MISSING` BLOCKER
- `RUN_LOGGING_TARGET_MISSING` BLOCKER

Observed:

- missing workout logging target caused a runtime TypeError during mapping:
  - `Cannot read properties of null (reading 'workoutId')`

Risk:

- Malformed planner output can crash the adapter instead of returning diagnostics.

### 3. Duplicate support categories/items are not diagnosed

Expected:

- duplicate support categories/items should produce WARNING diagnostics while preserving session identity

Observed:

- adapter returned `PASS`
- no duplicate support diagnostics were emitted

Risk:

- Duplicate Support: Core entries can pass silently, which may create duplicated Home display rows later.

### 4. Malformed duration metadata is only WARNING, not BLOCKER

Expected:

- malformed duration metadata should block model output to avoid unsafe display values

Observed:

- adapter returned `WARNING`

Risk:

- a model with unsafe duration metadata can still be emitted.

### 5. Audit hash/provenance mismatches are not blocked

Expected:

- `AUDIT_HASH_MISMATCH` BLOCKER
- `PROVENANCE_MISMATCH` BLOCKER

Observed:

- adapter returned `PASS`

Risk:

- audit/provenance drift is not currently detected.

## Focused Test Result

Command:

```bash
pnpm test -- --test-name-pattern "contract hardening"
```

Result:

```text
tests 592
pass 587
fail 5
cancelled 0
skipped 0
todo 0
duration_ms 611.624708
exit_code: 1
```

Failing tests:

1. `contract hardening: invalid session types and unsupported future session types return BLOCKER`
2. `contract hardening: missing workout or run logging targets return BLOCKER`
3. `contract hardening: duplicate support categories and duplicate support items are reported without changing primary identity`
4. `contract hardening: malformed duration metadata returns BLOCKER instead of unsafe model`
5. `contract hardening: audit hash and provenance mismatches return BLOCKER`

## Runtime Import Status

The hardening test includes a runtime source scan proving `home-adapter` remains unmounted from non-test source files. This test passed in the focused run.

## Phase 27I Remediation Addendum

Phase 27I remediated the five contract gaps discovered by Phase 27H without runtime wiring, page changes, UI changes, feature flags, pilot activation, planner promotion, or source-of-truth ownership changes.

Remediated behaviors:

1. Invalid and future unknown session types now return `BLOCKER` with `INVALID_SESSION_TYPE`.
2. Missing workout/run logging targets now return `BLOCKER` with `WORKOUT_LOGGING_TARGET_MISSING` or `RUN_LOGGING_TARGET_MISSING` and do not throw runtime exceptions.
3. Duplicate support categories/items now return `WARNING` with `DUPLICATE_SUPPORT_CATEGORY` and/or `DUPLICATE_SUPPORT_ITEM` while preserving support mapping and primary identity.
4. Malformed duration metadata now returns `BLOCKER` with `INVALID_DURATION_METADATA` and emits no unsafe model.
5. Audit hash/provenance mismatches now return `BLOCKER` with `AUDIT_HASH_MISMATCH` or `PROVENANCE_MISMATCH`.

Phase 27I validation:

```text
pnpm test: 592 pass, 0 fail
pnpm typecheck: exit_code 0
pnpm lint: exit_code 0
pnpm build: exit_code 0
```

Final remediation status:

HOME_ADAPTER_CONTRACT_HARDENED

## Conclusion

The Phase 27H hardening tests originally exposed five contract gaps. Phase 27I remediated those gaps with adapter-only contract validation changes and no runtime wiring.

Required next step before any Home pilot or runtime wiring:

- perform a developer-only non-runtime regression audit of the hardened adapter contract across representative planner sessions.

Final status:

HOME_ADAPTER_CONTRACT_HARDENED

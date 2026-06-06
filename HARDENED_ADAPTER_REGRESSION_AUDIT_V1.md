# HARDENED_ADAPTER_REGRESSION_AUDIT_V1

Phase: 27J — Developer-Only Hardened Adapter Regression Audit V1
Status: PASS — audit-only regression verification completed

## Scope Boundary

This was an audit-only phase.

No runtime behavior was created or changed.

Explicitly not performed:

- no runtime wiring
- no `page.tsx` modification
- no Home UI modification
- no Train UI modification
- no Log UI modification
- no pilot activation
- no feature flag activation
- no planner promotion
- no source-of-truth ownership change
- no readiness ownership change
- no progression ownership change
- no recommendation ownership change
- no persistence ownership change

Planner remains developer-only, advisory-only, read-only, and not promoted.

## Files

Audit test file created:

- `src/lib/home-adapter-regression-audit.test.ts`

Audit report created:

- `HARDENED_ADAPTER_REGRESSION_AUDIT_V1.md`

## Audit Method

The audit uses test-only representative `DailyTrainingSession` fixtures and sends them through the hardened `buildHomeTrainingModel(...)` adapter path.

For every valid representative session the audit checks:

- session identity preservation
- primary objective preservation
- session type preservation
- RecoveryDay remains RecoveryDay
- no RecoveryDay -> MobilityDay conversion
- Support: Core remains support only
- support does not alter session type
- support does not alter logging requirements
- deload remains metadata only
- no DeloadDay creation
- duration metadata preservation
- logging requirement preservation
- workout logging target preservation
- run logging target preservation
- audit metadata preservation
- provenance metadata preservation

Contract cases verify hardened blocker/warning diagnostics remain active.

## Total Sessions / Cases Audited

Total audited adapter cases: 21

Breakdown:

- PASS representative session cases: 14
- WARNING contract cases: 1
- BLOCKER contract cases: 6

## Representative Session Coverage

PASS sessions audited:

1. Planner-generated session
2. Seed-plan session
3. RecoveryDay session
4. MobilityDay session
5. LiftDay session
6. RunDay session
7. LongRunDay session
8. HybridDay session
9. Deload LiftDay
10. Deload RunDay
11. Deload RecoveryDay
12. Support-heavy session
13. Duration-range session
14. Audit/provenance-enabled session

All representative sessions emitted `PASS` and a non-null `HomeTrainingModel`.

## Contract Verification Coverage

BLOCKER contract cases verified:

1. `INVALID_SESSION_TYPE`
2. `WORKOUT_LOGGING_TARGET_MISSING`
3. `RUN_LOGGING_TARGET_MISSING`
4. `INVALID_DURATION_METADATA`
5. `AUDIT_HASH_MISMATCH`
6. `PROVENANCE_MISMATCH`

WARNING contract cases verified:

1. `DUPLICATE_SUPPORT_CATEGORY`
2. `DUPLICATE_SUPPORT_ITEM`

## Regression Findings

No adapter regression was found in the audited cases.

Confirmed:

- valid representative sessions still emit `PASS`
- invalid contract inputs emit `BLOCKER`
- duplicate support diagnostics emit `WARNING`
- blocked inputs emit no unsafe model
- warning inputs preserve model output while carrying diagnostics

## Parity Findings

The adapter output remained structurally compatible with the current Home display expectations already established in Phase 27G:

- primary labels/objectives preserved
- workout/run scheduling counts preserved in model shape
- logging requirements preserved
- duration metadata preserved
- audit/provenance preserved

No runtime Home output was replaced or consumed.

## Invariant Findings

All audited invariants passed.

### RecoveryDay

- `RecoveryDay` remained `RecoveryDay`
- no audited RecoveryDay collapsed to `MobilityDay`
- RecoveryDay logging remained non-workout/non-run unless explicitly prescribed elsewhere

### Support: Core

- `Support: Core` remained support only
- core support did not alter primary session type
- core support did not alter workout logging requirements
- core support did not alter run logging requirements

### Deload

- deload stayed `metadata.deload`
- no `DeloadDay` was created
- Deload LiftDay stayed LiftDay
- Deload RunDay stayed RunDay
- Deload RecoveryDay stayed RecoveryDay

### Duration

- valid duration metadata was preserved
- malformed duration metadata produced `INVALID_DURATION_METADATA` blocker
- duration-range session preserved duration-based run logging target

### Logging

- workout logging targets preserved when scheduled
- run logging targets preserved when scheduled
- missing workout logging target blocked
- missing run logging target blocked

### Audit / Provenance

- audit hash preserved when valid
- planner audit trail IDs preserved
- provenance source preserved when approved
- audit hash mismatch blocked
- provenance mismatch blocked

## Runtime Import Findings

Runtime import guard passed.

`home-adapter` remains excluded from non-test source files.

Allowed references:

- `src/lib/home-adapter.ts`
- `src/lib/home-adapter.test.ts`
- `src/lib/home-adapter-parity.test.ts`
- `src/lib/home-adapter-contract-hardening.test.ts`
- `src/lib/home-adapter-regression-audit.test.ts`

No runtime import was added to:

- `src/app/page.tsx`
- Home UI
- Train UI
- Log UI
- Home command center runtime
- dashboard runtime

## Focused Audit Test Result

Command:

```text
pnpm test -- --test-name-pattern "hardened adapter regression audit"
```

Result:

```text
tests 595
pass 595
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 595.345875
exit_code: 0
```

## Validation Status

Full validation was run after the audit file/report were created.

```text
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Final validation results:

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

## Final Audit Status

HARDENED_ADAPTER_REGRESSION_AUDIT_PASS

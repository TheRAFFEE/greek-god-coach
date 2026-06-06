# PLANNER_PRESCRIPTION_FIDELITY_AUDIT_V1

## Scope

Audit-only prescription fidelity review for the full 12-week seed plan: 12 weeks x 7 days = 84 total days.

Hard constraints observed: no planner promotion, no source-of-truth replacement, no Home/Train/Log/recommendation/readiness/progression/persistence/shadow-comparison changes, and no workout generation logic changes.

## Method

- Source: `src/lib/seed-data.ts` full `workouts` seed array.
- Planner output: `buildDailyTrainingSession` from `src/lib/training-planner.ts`.
- Input posture: Green readiness, Progress weekly decision, high-confidence goal tracking, no completed logs. This isolates normal planner prescription fidelity and avoids readiness/progression overrides.
- Day mapping: Monday through Sunday dates were reused for each week so `date` resolves to the matching `dayIndex`; `currentWeek` selects the week.
- Exercise preservation checked across visible planner prescription surfaces: `workout.exercises`, run prescription, mobility prescription, conditioning block, core support, and recovery output.
- Set and rep preservation checked only for seed exercises that appeared in planner output.
- Duration check is an audit estimate. Meaningful duration deviations are flagged only when absolute delta exceeds 25 minutes.
- `FAIL` is reserved for runtime/build/test failure or an impossible-to-evaluate day. Prescription mismatches are reported as `REVIEW_REQUIRED`.

## Final Summary

- Total days evaluated: 84
- PASS count: 28
- REVIEW_REQUIRED count: 56
- FAIL count: 0

## Breakdown By Category

- Primary objective mismatches: 0 days
- Exercise mismatches: 40 days
- Set mismatches: 0 days
- Rep mismatches: 12 days
- Conditioning mismatches: 4 days
- Mobility mismatches: 0 days
- Core mismatches: 0 days
- Duration mismatches: 32 days
- Deload mismatches: 0 days
- Logging mismatches: 0 days

## Top 10 Highest Risk Prescription Differences

### 1. HIGH — Walking Lunges missing

- First observed: Week 1 Friday
- Occurrences: 9
- Category: exercise
- Seed session: Athletic Lower / P90X-Style Circuit + Core
- Planner session: Athletic Lower / P90X-Style Circuit + Core
- Exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
- Exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- Potential user impact: Seed movement omitted from visible planner prescription.

### 2. HIGH — Easy Walk missing

- First observed: Week 1 Sunday
- Occurrences: 12
- Category: exercise
- Seed session: Recovery
- Planner session: Mobility
- Exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
- Exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- Potential user impact: Seed movement omitted from visible planner prescription.

### 3. HIGH — Meal Prep missing

- First observed: Week 1 Sunday
- Occurrences: 12
- Category: exercise
- Seed session: Recovery
- Planner session: Mobility
- Exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
- Exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- Potential user impact: Seed movement omitted from visible planner prescription.

### 4. HIGH — DB Shoulder Press missing

- First observed: Week 1 Thursday
- Occurrences: 9
- Category: exercise
- Seed session: Upper Hypertrophy + Density
- Planner session: Upper Hypertrophy + Density
- Exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
- Exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- Potential user impact: Seed movement omitted from visible planner prescription.

### 5. HIGH — Incline Treadmill Walk missing

- First observed: Week 1 Tuesday
- Occurrences: 4
- Category: exercise
- Seed session: Lower Strength
- Planner session: Lower Strength
- Exact seed value: `6. Incline Treadmill Walk: 1 x 10 min [conditioning]`
- Exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- Potential user impact: Seed movement omitted from visible planner prescription.

### 6. HIGH — Incline Treadmill Walk conditioning/power missing

- First observed: Week 1 Tuesday
- Occurrences: 4
- Category: conditioning
- Seed session: Lower Strength
- Planner session: Lower Strength
- Exact seed value: `Incline Treadmill Walk: 1 x 10 min`
- Exact planner value: `not present`
- Potential user impact: Planner metadata/support/logging fidelity needs review.

### 7. HIGH — Zone 2 Run rep mismatch

- First observed: Week 1 Wednesday
- Occurrences: 4
- Category: rep
- Seed session: Zone 2 + Mobility + Core
- Planner session: Zone 2 + Mobility + Core
- Exact seed value: `35-45 min`
- Exact planner value: `40 min`
- Potential user impact: Intensity/duration/distance prescription may be altered.

### 8. HIGH — Zone 2 Run rep mismatch

- First observed: Week 10 Wednesday
- Occurrences: 8
- Category: rep
- Seed session: Zone 2 Run + Mobility + Core
- Planner session: Zone 2 Run + Mobility + Core
- Exact seed value: `45-60 min`
- Exact planner value: `53 min`
- Potential user impact: Intensity/duration/distance prescription may be altered.

### 9. HIGH — Walking Lunges missing

- First observed: Week 12 Friday
- Occurrences: 3
- Category: exercise
- Seed session: Athletic Circuit / Kettlebell Conditioning
- Planner session: Athletic Circuit / Kettlebell Conditioning
- Exact seed value: `2. Walking Lunges: 1 x 20 steps [accessory-lower]`
- Exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- Potential user impact: Seed movement omitted from visible planner prescription.

### 10. HIGH — DB Shoulder Press missing

- First observed: Week 12 Thursday
- Occurrences: 3
- Category: exercise
- Seed session: High-Density Hypertrophy
- Planner session: High-Density Hypertrophy
- Exact seed value: `3. DB Shoulder Press: 2 x 10 [accessory-upper]`
- Exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- Potential user impact: Seed movement omitted from visible planner prescription.

## Audit Findings

### Key finding

Planner classification, deload metadata, core support extraction, and logging behavior remain intact, but prescription fidelity is not complete. The planner does not currently preserve every seed exercise/intention across the visible prescription surfaces.

### Main prescription gaps

- Recovery Sundays preserve `RecoveryDay` and no logging, but visible planner output surfaces only `Mobility Flow`; seed `Easy Walk` and `Meal Prep` are not preserved as explicit recovery/nutrition prescription items.
- Thursday hypertrophy days omit `DB Shoulder Press` / shoulder press variants from visible planner output. This is high-risk for shoulder-to-waist physique intent.
- Friday athletic/circuit days omit `Walking Lunges`; this affects lower-body athletic/circuit intent.
- Phase 1 Tuesday lower-strength days omit `Incline Treadmill Walk`; this affects the low-impact conditioning finisher intent.
- Zone 2 run day duration ranges are normalized to midpoint values (`35-45 min` -> `40 min`, `45-60 min` -> `53 min`). This is semantically reasonable but not exact prescription fidelity.
- Core/trunk work is preserved across all evaluated days, including Pallof Press, Side Plank, Hanging Leg Raises, Cable Crunches, Farmer Carries, Loaded Carries, and Ab Wheel.
- Deload metadata preservation is clean: no deload mismatches and no standalone `DeloadDay`.
- Logging preservation is clean: no logging mismatches.

## Per-Day Results

### Week 1 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Upper Strength + Sprints + Core` / planner `Upper Strength + Sprints + Core`
- Exercises: 8/8 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 136 min / planner 113 min / delta -23 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 1 Tuesday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Lower Strength` / planner `Lower Strength`
- Exercises: 5/6 preserved
- Sets: match
- Reps: match
- Conditioning: review
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 82 min / planner 110 min / delta 28 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Incline Treadmill Walk missing
  - exact seed value: `6. Incline Treadmill Walk: 1 x 10 min [conditioning]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- conditioning: Incline Treadmill Walk conditioning/power missing
  - exact seed value: `Incline Treadmill Walk: 1 x 10 min`
  - exact planner value: `not present`
- duration: duration meaningful deviation
  - exact seed value: `estimated 82 min from seed prescriptions`
  - exact planner value: `110 min (delta 28)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 1 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 + Mobility + Core` / planner `Zone 2 + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 94 min / planner 85 min / delta -9 min
- Deload: N/A
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `35-45 min`
  - exact planner value: `40 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 1 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Upper Hypertrophy + Density` / planner `Upper Hypertrophy + Density`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 132 min / planner 95 min / delta -37 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 132 min from seed prescriptions`
  - exact planner value: `95 min (delta -37)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 1 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Lower / P90X-Style Circuit + Core` / planner `Athletic Lower / P90X-Style Circuit + Core`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 106 min / planner 86 min / delta -20 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 1 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 3 miles` / planner `Long Run — 3 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 33 min / planner 48 min / delta 15 min
- Deload: N/A
- Logging: expected/actual run only / run

### Week 1 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 2 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Upper Strength + Sprints + Core` / planner `Upper Strength + Sprints + Core`
- Exercises: 8/8 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 136 min / planner 113 min / delta -23 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 2 Tuesday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Lower Strength` / planner `Lower Strength`
- Exercises: 5/6 preserved
- Sets: match
- Reps: match
- Conditioning: review
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 82 min / planner 110 min / delta 28 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Incline Treadmill Walk missing
  - exact seed value: `6. Incline Treadmill Walk: 1 x 10 min [conditioning]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- conditioning: Incline Treadmill Walk conditioning/power missing
  - exact seed value: `Incline Treadmill Walk: 1 x 10 min`
  - exact planner value: `not present`
- duration: duration meaningful deviation
  - exact seed value: `estimated 82 min from seed prescriptions`
  - exact planner value: `110 min (delta 28)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 2 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 + Mobility + Core` / planner `Zone 2 + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 94 min / planner 85 min / delta -9 min
- Deload: N/A
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `35-45 min`
  - exact planner value: `40 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 2 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Upper Hypertrophy + Density` / planner `Upper Hypertrophy + Density`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 132 min / planner 95 min / delta -37 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 132 min from seed prescriptions`
  - exact planner value: `95 min (delta -37)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 2 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Lower / P90X-Style Circuit + Core` / planner `Athletic Lower / P90X-Style Circuit + Core`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 106 min / planner 86 min / delta -20 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 2 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 4 miles` / planner `Long Run — 4 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 44 min / planner 59 min / delta 15 min
- Deload: N/A
- Logging: expected/actual run only / run

### Week 2 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 3 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Upper Strength + Sprints + Core` / planner `Upper Strength + Sprints + Core`
- Exercises: 8/8 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 136 min / planner 113 min / delta -23 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 3 Tuesday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Lower Strength` / planner `Lower Strength`
- Exercises: 5/6 preserved
- Sets: match
- Reps: match
- Conditioning: review
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 82 min / planner 110 min / delta 28 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Incline Treadmill Walk missing
  - exact seed value: `6. Incline Treadmill Walk: 1 x 10 min [conditioning]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- conditioning: Incline Treadmill Walk conditioning/power missing
  - exact seed value: `Incline Treadmill Walk: 1 x 10 min`
  - exact planner value: `not present`
- duration: duration meaningful deviation
  - exact seed value: `estimated 82 min from seed prescriptions`
  - exact planner value: `110 min (delta 28)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 3 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 + Mobility + Core` / planner `Zone 2 + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 94 min / planner 85 min / delta -9 min
- Deload: N/A
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `35-45 min`
  - exact planner value: `40 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 3 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Upper Hypertrophy + Density` / planner `Upper Hypertrophy + Density`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 132 min / planner 95 min / delta -37 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 132 min from seed prescriptions`
  - exact planner value: `95 min (delta -37)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 3 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Lower / P90X-Style Circuit + Core` / planner `Athletic Lower / P90X-Style Circuit + Core`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 106 min / planner 86 min / delta -20 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 3 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 5 miles` / planner `Long Run — 5 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 55 min / planner 70 min / delta 15 min
- Deload: N/A
- Logging: expected/actual run only / run

### Week 3 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 4 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Upper Strength + Sprints + Core` / planner `Upper Strength + Sprints + Core`
- Exercises: 8/8 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 80 min / planner 103 min / delta 23 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

### Week 4 Tuesday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Lower Strength` / planner `Lower Strength`
- Exercises: 5/6 preserved
- Sets: match
- Reps: match
- Conditioning: review
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 82 min / planner 110 min / delta 28 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Incline Treadmill Walk missing
  - exact seed value: `6. Incline Treadmill Walk: 1 x 10 min [conditioning]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- conditioning: Incline Treadmill Walk conditioning/power missing
  - exact seed value: `Incline Treadmill Walk: 1 x 10 min`
  - exact planner value: `not present`
- duration: duration meaningful deviation
  - exact seed value: `estimated 82 min from seed prescriptions`
  - exact planner value: `110 min (delta 28)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 4 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 + Mobility + Core` / planner `Zone 2 + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 94 min / planner 85 min / delta -9 min
- Deload: seed/planner true/true
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `35-45 min`
  - exact planner value: `40 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 4 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Upper Hypertrophy + Density` / planner `Upper Hypertrophy + Density`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 68 min / planner 95 min / delta 27 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 2 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 68 min from seed prescriptions`
  - exact planner value: `95 min (delta 27)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 4 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Lower / P90X-Style Circuit + Core` / planner `Athletic Lower / P90X-Style Circuit + Core`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 66 min / planner 79 min / delta 13 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 1 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 4 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 4 miles` / planner `Long Run — 4 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 44 min / planner 59 min / delta 15 min
- Deload: seed/planner true/true
- Logging: expected/actual run only / run

### Week 4 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 5 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Heavy Upper + Sprints + Core` / planner `Heavy Upper + Sprints + Core`
- Exercises: 7/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 136 min / planner 119 min / delta -17 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 5 Tuesday

PASS

- Session Type: LiftDay
- Primary: seed `Lower Strength` / planner `Lower Strength`
- Exercises: 5/5 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 88 min / planner 95 min / delta 7 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 5 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 Run + Mobility + Core` / planner `Zone 2 Run + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 107 min / planner 98 min / delta -9 min
- Deload: N/A
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `45-60 min`
  - exact planner value: `53 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 5 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `High-Volume Upper Hypertrophy` / planner `High-Volume Upper Hypertrophy`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 132 min / planner 95 min / delta -37 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 132 min from seed prescriptions`
  - exact planner value: `95 min (delta -37)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 5 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Conditioning` / planner `Athletic Conditioning`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 102 min / planner 82 min / delta -20 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 5 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 6 miles` / planner `Long Run — 6 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 66 min / planner 81 min / delta 15 min
- Deload: N/A
- Logging: expected/actual run only / run

### Week 5 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 6 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Heavy Upper + Sprints + Core` / planner `Heavy Upper + Sprints + Core`
- Exercises: 7/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 136 min / planner 119 min / delta -17 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 6 Tuesday

PASS

- Session Type: LiftDay
- Primary: seed `Lower Strength` / planner `Lower Strength`
- Exercises: 5/5 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 88 min / planner 95 min / delta 7 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 6 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 Run + Mobility + Core` / planner `Zone 2 Run + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 107 min / planner 98 min / delta -9 min
- Deload: N/A
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `45-60 min`
  - exact planner value: `53 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 6 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `High-Volume Upper Hypertrophy` / planner `High-Volume Upper Hypertrophy`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 132 min / planner 95 min / delta -37 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 132 min from seed prescriptions`
  - exact planner value: `95 min (delta -37)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 6 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Conditioning` / planner `Athletic Conditioning`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 102 min / planner 82 min / delta -20 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 6 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 7 miles` / planner `Long Run — 7 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 77 min / planner 92 min / delta 15 min
- Deload: N/A
- Logging: expected/actual run only / run

### Week 6 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 7 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Heavy Upper + Sprints + Core` / planner `Heavy Upper + Sprints + Core`
- Exercises: 7/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 136 min / planner 119 min / delta -17 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 7 Tuesday

PASS

- Session Type: LiftDay
- Primary: seed `Lower Strength` / planner `Lower Strength`
- Exercises: 5/5 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 88 min / planner 95 min / delta 7 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 7 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 Run + Mobility + Core` / planner `Zone 2 Run + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 107 min / planner 98 min / delta -9 min
- Deload: N/A
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `45-60 min`
  - exact planner value: `53 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 7 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `High-Volume Upper Hypertrophy` / planner `High-Volume Upper Hypertrophy`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 132 min / planner 95 min / delta -37 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 132 min from seed prescriptions`
  - exact planner value: `95 min (delta -37)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 7 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Conditioning` / planner `Athletic Conditioning`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 102 min / planner 82 min / delta -20 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 7 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 8 miles` / planner `Long Run — 8 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 88 min / planner 103 min / delta 15 min
- Deload: N/A
- Logging: expected/actual run only / run

### Week 7 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 8 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Heavy Upper + Sprints + Core` / planner `Heavy Upper + Sprints + Core`
- Exercises: 7/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 88 min / planner 109 min / delta 21 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

### Week 8 Tuesday

PASS

- Session Type: LiftDay
- Primary: seed `Lower Strength` / planner `Lower Strength`
- Exercises: 5/5 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 88 min / planner 95 min / delta 7 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

### Week 8 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 Run + Mobility + Core` / planner `Zone 2 Run + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 107 min / planner 98 min / delta -9 min
- Deload: seed/planner true/true
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `45-60 min`
  - exact planner value: `53 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 8 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `High-Volume Upper Hypertrophy` / planner `High-Volume Upper Hypertrophy`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 68 min / planner 95 min / delta 27 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 2 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 68 min from seed prescriptions`
  - exact planner value: `95 min (delta 27)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 8 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Conditioning` / planner `Athletic Conditioning`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 62 min / planner 79 min / delta 17 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 1 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 8 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 6 miles` / planner `Long Run — 6 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 66 min / planner 81 min / delta 15 min
- Deload: seed/planner true/true
- Logging: expected/actual run only / run

### Week 8 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 9 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Heavy Upper + Explosive Push + Sprints` / planner `Heavy Upper + Explosive Push + Sprints`
- Exercises: 8/8 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 132 min / planner 113 min / delta -19 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 9 Tuesday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Heavy Lower + Jump Training` / planner `Heavy Lower + Jump Training`
- Exercises: 4/4 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 64 min / planner 104 min / delta 40 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- duration: duration meaningful deviation
  - exact seed value: `estimated 64 min from seed prescriptions`
  - exact planner value: `104 min (delta 40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 9 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 Run + Mobility + Core` / planner `Zone 2 Run + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 107 min / planner 98 min / delta -9 min
- Deload: N/A
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `45-60 min`
  - exact planner value: `53 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 9 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `High-Density Hypertrophy` / planner `High-Density Hypertrophy`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 132 min / planner 95 min / delta -37 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 132 min from seed prescriptions`
  - exact planner value: `95 min (delta -37)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 9 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Circuit / Kettlebell Conditioning` / planner `Athletic Circuit / Kettlebell Conditioning`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 102 min / planner 82 min / delta -20 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 9 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 9 miles` / planner `Long Run — 9 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 99 min / planner 114 min / delta 15 min
- Deload: N/A
- Logging: expected/actual run only / run

### Week 9 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 10 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Heavy Upper + Explosive Push + Sprints` / planner `Heavy Upper + Explosive Push + Sprints`
- Exercises: 8/8 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 132 min / planner 113 min / delta -19 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 10 Tuesday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Heavy Lower + Jump Training` / planner `Heavy Lower + Jump Training`
- Exercises: 4/4 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 64 min / planner 104 min / delta 40 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- duration: duration meaningful deviation
  - exact seed value: `estimated 64 min from seed prescriptions`
  - exact planner value: `104 min (delta 40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 10 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 Run + Mobility + Core` / planner `Zone 2 Run + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 107 min / planner 98 min / delta -9 min
- Deload: N/A
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `45-60 min`
  - exact planner value: `53 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 10 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `High-Density Hypertrophy` / planner `High-Density Hypertrophy`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 132 min / planner 95 min / delta -37 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 132 min from seed prescriptions`
  - exact planner value: `95 min (delta -37)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 10 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Circuit / Kettlebell Conditioning` / planner `Athletic Circuit / Kettlebell Conditioning`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 102 min / planner 82 min / delta -20 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 10 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 10 miles` / planner `Long Run — 10 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 110 min / planner 125 min / delta 15 min
- Deload: N/A
- Logging: expected/actual run only / run

### Week 10 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 11 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Heavy Upper + Explosive Push + Sprints` / planner `Heavy Upper + Explosive Push + Sprints`
- Exercises: 8/8 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 132 min / planner 113 min / delta -19 min
- Deload: N/A
- Logging: expected/actual lift only / lift

### Week 11 Tuesday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Heavy Lower + Jump Training` / planner `Heavy Lower + Jump Training`
- Exercises: 4/4 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 64 min / planner 104 min / delta 40 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- duration: duration meaningful deviation
  - exact seed value: `estimated 64 min from seed prescriptions`
  - exact planner value: `104 min (delta 40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 11 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 Run + Mobility + Core` / planner `Zone 2 Run + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 107 min / planner 98 min / delta -9 min
- Deload: N/A
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `45-60 min`
  - exact planner value: `53 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 11 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `High-Density Hypertrophy` / planner `High-Density Hypertrophy`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 132 min / planner 95 min / delta -37 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 4 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 132 min from seed prescriptions`
  - exact planner value: `95 min (delta -37)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 11 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Circuit / Kettlebell Conditioning` / planner `Athletic Circuit / Kettlebell Conditioning`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 102 min / planner 82 min / delta -20 min
- Deload: N/A
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 3 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 11 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 11 miles` / planner `Long Run — 11 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 121 min / planner 135 min / delta 14 min
- Deload: N/A
- Logging: expected/actual run only / run

### Week 11 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 12 Monday

PASS

- Session Type: LiftDay
- Primary: seed `Heavy Upper + Explosive Push + Sprints` / planner `Heavy Upper + Explosive Push + Sprints`
- Exercises: 8/8 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 76 min / planner 99 min / delta 23 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

### Week 12 Tuesday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Heavy Lower + Jump Training` / planner `Heavy Lower + Jump Training`
- Exercises: 4/4 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 64 min / planner 104 min / delta 40 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

Issue(s):
- duration: duration meaningful deviation
  - exact seed value: `estimated 64 min from seed prescriptions`
  - exact planner value: `104 min (delta 40)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 12 Wednesday

REVIEW_REQUIRED

- Session Type: RunDay
- Primary: seed `Zone 2 Run + Mobility + Core` / planner `Zone 2 Run + Mobility + Core`
- Exercises: 6/6 preserved
- Sets: match
- Reps: review
- Conditioning: preserved
- Mobility: preserved
- Core: preserved
- Duration: seed-estimate 107 min / planner 98 min / delta -9 min
- Deload: seed/planner true/true
- Logging: expected/actual run only / run

Issue(s):
- rep: Zone 2 Run rep mismatch
  - exact seed value: `45-60 min`
  - exact planner value: `53 min`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 12 Thursday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `High-Density Hypertrophy` / planner `High-Density Hypertrophy`
- Exercises: 7/8 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 68 min / planner 95 min / delta 27 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: DB Shoulder Press missing
  - exact seed value: `3. DB Shoulder Press: 2 x 10 [accessory-upper]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 68 min from seed prescriptions`
  - exact planner value: `95 min (delta 27)`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 12 Friday

REVIEW_REQUIRED

- Session Type: LiftDay
- Primary: seed `Athletic Circuit / Kettlebell Conditioning` / planner `Athletic Circuit / Kettlebell Conditioning`
- Exercises: 6/7 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: preserved
- Duration: seed-estimate 62 min / planner 79 min / delta 17 min
- Deload: seed/planner true/true
- Logging: expected/actual lift only / lift

Issue(s):
- exercise: Walking Lunges missing
  - exact seed value: `2. Walking Lunges: 1 x 20 steps [accessory-lower]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`

Impact: prescription fidelity requires review before planner promotion consideration.

### Week 12 Saturday

PASS

- Session Type: LongRunDay
- Primary: seed `Long Run — 8 miles` / planner `Long Run — 8 mi`
- Exercises: 1/1 preserved
- Sets: match
- Reps: match
- Conditioning: preserved
- Mobility: N/A
- Core: N/A
- Duration: seed-estimate 88 min / planner 103 min / delta 15 min
- Deload: seed/planner true/true
- Logging: expected/actual run only / run

### Week 12 Sunday

REVIEW_REQUIRED

- Session Type: RecoveryDay
- Primary: seed `Recovery` / planner `Mobility`
- Exercises: 1/3 preserved
- Sets: match
- Reps: match
- Conditioning: N/A
- Mobility: preserved
- Core: N/A
- Duration: seed-estimate 75 min / planner 35 min / delta -40 min
- Deload: N/A
- Logging: expected/actual none / none

Issue(s):
- exercise: Easy Walk missing
  - exact seed value: `1. Easy Walk: 1 x 30-60 min [recovery]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- exercise: Meal Prep missing
  - exact seed value: `3. Meal Prep: 1 x complete [nutrition]`
  - exact planner value: `not present in workout/run/mobility/conditioning/support/recovery output`
- duration: duration meaningful deviation
  - exact seed value: `estimated 75 min from seed prescriptions`
  - exact planner value: `35 min (delta -40)`

Impact: prescription fidelity requires review before planner promotion consideration.

## Recommendation

PRESCRIPTION_RECONCILIATION_REQUIRED

Reason: 56 of 84 evaluated days require review for prescription fidelity. The planner is mechanically safe/advisory-only and preserves classification/logging/deload/core support, but it does not yet preserve the full seed prescription on all days.

## End State

- Planner remains developer-only.
- Planner remains advisory-only.
- Planner remains read-only.
- Planner was not promoted.
- No source-of-truth changes were made.
- No UI changes were made.
- No planner implementation changes were made.

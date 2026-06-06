# Training Rules Constitution V1

**Phase:** 24  
**Status:** Architecture and coaching specification only  
**Runtime status:** Future source-of-truth behavior; not wired into runtime  
**Applies to:** Training Planner Core, future plan imports, future app UI consumers  
**Non-goals:** No implementation, no adapters, no engines, no UI, no tests

---

## 0. Purpose

This constitution defines the behavioral rules every future training plan in the app must obey.

It answers two questions:

1. **What should a training day actually look like?**
2. **What rules should all future training plans obey?**

The planner must eventually make Home, Train, Log, and Progress agree on the same daily training answer without each screen reinterpreting the plan independently.

The core product promise is:

> Home should answer: **“What should I do today?”**

The answer must be safe, specific, loggable, and consistent with the athlete’s current plan, recovery state, and long-term goals.

---

## 1. Training Philosophy

### 1.1 Planner responsibility

The Training Planner is responsible for converting plan data and current athlete state into one daily training session.

The planner owns:

- Day type classification.
- Block selection.
- Block ordering.
- Session priority resolution.
- Safety and recovery overrides.
- Run prescription interpretation.
- Lift prescription interpretation.
- Mobility/recovery interpretation.
- Combined-session permission rules.
- Logging target generation.
- Human-readable explanation of what to do today and why.

The planner must produce a daily answer that includes:

- What to do.
- Why to do it.
- How hard it should feel.
- How long it should take.
- What should be logged afterward.
- What risks or constraints exist today.

If the planner cannot answer those six questions, the planner design is incomplete.

### 1.2 Planner non-responsibilities

The Training Planner is **not** responsible for:

- Rendering UI.
- Saving logs.
- Writing localStorage.
- Mutating app state.
- Recalculating canonical engine outputs owned elsewhere.
- Inventing training blocks not present in the source plan unless required by safety/recovery rules.
- Importing PDFs directly.
- Parsing arbitrary plan files directly.
- Replacing nutrition, readiness, running, workout, or progression engines.

The planner may consume outputs from other engines, but it must not duplicate their scoring logic.

### 1.3 Source-of-truth hierarchy

The future source-of-truth hierarchy must be:

```text
Plan Data
→ Canonical Engines
→ Training Planner
→ UI Models
→ UI Screens
→ Logs
```

The architecture must **not** become:

```text
UI Screen
→ Local screen heuristics
→ Planner
→ Different UI screen heuristics
```

The UI should display planner output. It should not reinterpret the training plan.

### 1.4 Plan data versus planner decision

A plan says what is scheduled.

The planner says what should be done today.

Example:

- Plan data may say: “Week 4 Sunday: Long Run 6 miles.”
- Readiness may say: Red readiness with knee pain.
- Planner output should say: “Recovery day; do not run today; log recovery/pain status.”

The scheduled plan remains unchanged. The daily execution decision changes.

### 1.5 Advisory versus runtime state

During shadow mode, planner output is advisory only.

When promoted to runtime source of truth, the planner must become the single daily training authority for Home and Train. Log should use planner logging targets but should still own actual user-entered results.

---

## 2. Training Day Types

Every training day must resolve to exactly one primary day type.

A day may contain multiple blocks, but it must not have multiple competing identities. For example, a day should not simultaneously be treated as a full lift day, hard run day, conditioning day, mobility day, and recovery day unless it is explicitly classified as a Hybrid Day and passes combined-session rules.

### 2.1 Supported day types

The planner must support these day types:

1. Lift Day
2. Run Day
3. Long Run Day
4. Recovery Day
5. Rest Day
6. Mobility Day
7. Hybrid Day
8. Race Day
9. Test Day
10. Deload Day
11. Unavailable / Unknown Plan Day

### 2.2 Lift Day

**Definition:** A day whose primary training stimulus is resistance training.

**Allowed blocks:**

- Warmup
- Lift
- Core, if programmed as support work
- Mobility, if low intensity
- Cooldown

**Not required:**

- Run

**Allowed optional additions:**

- Short easy run only if explicitly programmed and allowed by combined-session rules.
- Short recovery walk.

**Forbidden by default:**

- Long run.
- Tempo run.
- Goal pace run.
- Hill repeat session.
- Sprint session, unless the entire day is explicitly designed as a combined power/sprint day.
- High-intensity conditioning after heavy lower-body strength.

**Rule:** A lift day must not automatically imply a run day.

### 2.3 Run Day

**Definition:** A day whose primary training stimulus is running, but not a long run or race.

**Allowed blocks:**

- Warmup
- Run
- Mobility
- Cooldown

**No lifting required.**

**Allowed optional additions:**

- Core if brief and low fatigue.
- Mobility/prehab.
- Recovery walk only if it does not inflate training load.

**Forbidden by default:**

- Heavy lower-body lift.
- Hard conditioning after a quality run.
- Sprint/plyometric work unless that is the run session itself.

**Rule:** A run day must not be interpreted as a lift day just because it contains mobility, core, or auxiliary exercises.

### 2.4 Long Run Day

**Definition:** A day whose primary training stimulus is the weekly endurance long run.

**Allowed blocks:**

- Warmup
- Long Run
- Cooldown
- Optional very short mobility/prehab

**Should lifting be allowed?**

No, not by default.

Long run day should generally remain **long run only** because it is a key endurance stimulus and carries high fatigue cost.

**Allowed exceptions:**

- Very light mobility/prehab.
- Very short core activation if already established and not fatiguing.
- Physical therapy movements prescribed for injury prevention.

**Forbidden by default:**

- Heavy lifting.
- Hypertrophy lifting.
- Sprint sessions.
- Plyometrics.
- Tempo work in addition to the long run.
- High-intensity conditioning.

**Rule:** Long run day wins over strength and hypertrophy goals unless the plan explicitly defines a rare advanced hybrid and readiness is Green.

### 2.5 Recovery Day

**Definition:** A day whose primary purpose is reducing fatigue and restoring readiness.

**Allowed blocks:**

- Recovery
- Walk
- Mobility
- Breathing / downregulation
- Gentle tissue work

**Forbidden:**

- Structured lifting.
- Speed work.
- Tempo running.
- Long running.
- High-intensity conditioning.
- Plyometrics.

**Rule:** Recovery is training. It is not a failed workout.

### 2.6 Rest Day

**Definition:** A day with no required structured training.

**Allowed blocks:**

- Optional walk
- Optional mobility
- Optional recovery tasks

**Forbidden:**

- Required lift.
- Required run.
- Required conditioning.

**Rule:** Rest day output must be explicit: “No structured training today.” It must not fall back to another workout.

### 2.7 Mobility Day

**Definition:** A day whose primary stimulus is movement quality, range of motion, tissue tolerance, or prehab.

**Allowed blocks:**

- Mobility
- Recovery
- Walk
- Optional light activation

**Forbidden by default:**

- Lift classification.
- Run classification.
- Conditioning classification.

**Rule:** Mobility must not become a lift session because it contains movements, sets, or durations.

### 2.8 Hybrid Day

**Definition:** A day intentionally containing more than one meaningful training stimulus, usually Lift + Run.

**Allowed blocks:**

- Warmup
- Lift
- Run
- Mobility
- Cooldown

**Allowed only when:**

- The source plan explicitly programs both stimuli on the same date, or
- The plan’s rules allow a short easy run after lifting, and
- Readiness is Green or acceptable Yellow with reduced volume, and
- Combined-session rules allow the pairing, and
- Total session stress remains appropriate for the athlete’s phase.

**Forbidden by default:**

- Accidental hybrid days created by misclassification.
- Long Run + Lift.
- Heavy Lower Lift + Sprint Session.
- Tempo/Goal Pace + Heavy Lift.

**Rule:** Hybrid day must be explicit, not accidental.

### 2.9 Race Day

**Definition:** A day whose primary stimulus is an event or benchmark race.

**Allowed blocks:**

- Warmup
- Race
- Cooldown
- Recovery notes

**Forbidden:**

- Lifting.
- Extra conditioning.
- Added mileage beyond planned warmup/cooldown unless explicitly part of race plan.

**Rule:** Race Day overrides all normal training categories.

### 2.10 Test Day

**Definition:** A day designed to evaluate performance, such as time trial, race-pace test, strength test, or rep max test.

**Allowed blocks depend on test type:**

- Running test: Warmup, test run, cooldown.
- Strength test: Warmup, specific lift test, cooldown.

**Forbidden:**

- Multiple unrelated maximal tests on the same day.
- Long run after a maximal test.
- High-volume hypertrophy after a maximal test.

**Rule:** Testing is a primary stimulus and must be treated as high stress.

### 2.11 Deload Day

**Definition:** A day inside a deload week or recovery-focused phase where training load is intentionally reduced.

**Allowed blocks:**

- Reduced lift
- Easy run
- Mobility
- Recovery
- Walk

**Forbidden by default:**

- New PR attempts.
- High-intensity conditioning.
- Sprint/plyometric overload.
- Unplanned volume increases.

**Rule:** Deload means reduce stress even if readiness feels Green.

### 2.12 Unavailable / Unknown Plan Day

**Definition:** A date/week/day combination where no valid source plan item exists.

**Allowed output:**

- Safe Rest Day
- Optional walk/mobility
- Low-confidence warning

**Forbidden:**

- Falling back to the first workout in the array.
- Inventing a workout.
- Reusing yesterday’s run.
- Displaying stale prescription data.

**Rule:** Missing plan data must produce a safe “not scheduled / unavailable” answer.

---

## 3. Run Rules

Runs must be classified by purpose, not just by text label.

A run prescription must preserve whether it is:

- Distance-based.
- Duration-based.
- Effort-based.
- Pace-based.
- Recovery-only.

The planner must never convert a duration run into a distance run or a distance run into a duration run unless a future explicit conversion policy exists.

### 3.1 Easy Run

**Purpose:** Aerobic base, running frequency, durability, low-stress endurance.

**Typical duration:** 20–60 minutes.

**Typical frequency:** 1–4 times per week depending on plan level.

**Intensity:** Conversational; RPE 3–5.

**Recovery requirements:**

- Can coexist with upper-body lifting if short and easy.
- Should be separated from hard lower-body sessions when possible.
- Should be reduced or replaced by walk on Yellow readiness if fatigue/pain is present.

### 3.2 Zone 2 Run

**Purpose:** Aerobic development with controlled intensity.

**Typical duration:** 30–75 minutes for current half marathon build; longer for marathon builds.

**Typical frequency:** 1–3 times per week.

**Intensity:** Zone 2 / easy conversational effort; RPE 3–5.

**Recovery requirements:**

- Must remain easy.
- Can follow a lift only if explicitly allowed and not after heavy lower-body work.
- If heart rate drift, poor sleep, soreness, or pain is high, reduce duration or convert to recovery run/walk.

### 3.3 Tempo Run

**Purpose:** Lactate threshold, sustained controlled hard effort, race performance development.

**Typical duration:** 20–45 minutes of work, excluding warmup/cooldown.

**Typical frequency:** 0–1 times per week for most recreational plans.

**Intensity:** Comfortably hard; RPE 6–8.

**Recovery requirements:**

- Requires Green readiness or very cautious Yellow modification.
- Should not be paired with heavy lower-body lifting.
- Should not occur the day before or after a long run unless plan level explicitly supports it.
- Requires easy/recovery day afterward for most athletes.

### 3.4 Goal Pace Run

**Purpose:** Practice target race pace, pacing discipline, race-specific confidence.

**Typical duration:** 10–60 minutes of goal-pace work depending on race distance and phase.

**Typical frequency:** 0–1 times per week.

**Intensity:** Race-specific; for half marathon often RPE 6–7.

**Recovery requirements:**

- Treat as quality work.
- Do not pair with heavy lift or sprint session.
- Reduce or convert to easy if readiness is Yellow.
- Cancel/replace if Red readiness or meaningful pain.

### 3.5 Hill Run

**Purpose:** Strength endurance, running economy, power, tendon tolerance.

**Typical duration:** 15–40 minutes of work, often intervals.

**Typical frequency:** 0–1 times per week.

**Intensity:** Moderate to hard depending on prescription.

**Recovery requirements:**

- Counts as quality run stress.
- Do not pair with heavy lower-body lift.
- Avoid during high soreness, calf/Achilles pain, knee pain, or Red readiness.
- Needs warmup and cooldown.

### 3.6 Sprint Session

**Purpose:** Speed, neuromuscular power, stride quality.

**Typical duration:** 5–20 minutes of sprint work plus full warmup/recovery.

**Typical frequency:** 0–1 times per week for most plans.

**Intensity:** Very high neuromuscular stress even if total volume is low.

**Recovery requirements:**

- Requires Green readiness.
- Requires no pain.
- Requires low soreness and good sleep.
- Should not be paired with heavy lower-body lifting unless part of an advanced power plan and carefully ordered.
- Should not be added to long run day.

### 3.7 Long Run

**Purpose:** Endurance durability, race preparation, confidence over distance, fueling practice.

**Typical duration:** 45–180+ minutes depending on race distance and phase.

**Typical frequency:** Usually once per week.

**Intensity:** Mostly easy unless explicitly specified.

**Recovery requirements:**

- Preserve as the day’s primary stimulus.
- Avoid lifting on the same day.
- Avoid speed/tempo additions unless the source plan explicitly defines structured long-run quality work.
- Requires attention to sleep, hydration, fuel, pain, and next-day recovery.
- If missed, the planner must decide whether to skip, shift, or reduce; it must not blindly stack it onto another hard day.

### 3.8 Recovery Run

**Purpose:** Circulation, low-stress movement, maintaining habit without adding meaningful load.

**Typical duration:** 10–30 minutes.

**Typical frequency:** As needed; often after hard sessions or during reduced-load periods.

**Intensity:** Very easy; RPE 2–3.

**Recovery requirements:**

- Should feel restorative.
- Convert to walk if pain or fatigue is elevated.
- Never used to compensate for missed hard training.

---

## 4. Lift Rules

Lifts must be classified by training purpose and fatigue cost, not simply by the presence of exercises.

### 4.1 Strength Blocks

**Purpose:** Increase maximal or near-maximal force production.

**Typical structure:** Lower reps, heavier loads, longer rest.

**Can coexist with:**

- Warmup.
- Low-intensity mobility.
- Core support work.
- Short easy run only if not lower-body dominant and recovery is good.

**Should not coexist with:**

- Long run.
- Tempo run.
- Hill repeats.
- Sprint session.
- High-intensity conditioning.
- Another maximal test.

### 4.2 Hypertrophy Blocks

**Purpose:** Muscle growth and physique development.

**Typical structure:** Moderate reps, moderate/high volume, controlled intensity.

**Can coexist with:**

- Mobility.
- Core.
- Short easy run if plan allows.
- Upper-body hypertrophy plus easy run, if total duration is reasonable.

**Should not coexist with:**

- Long run.
- Hard run quality session.
- High-intensity conditioning that compromises recovery.
- Excessive added volume during deload.

### 4.3 Conditioning Blocks

**Purpose:** Metabolic conditioning, work capacity, or non-running cardiovascular stress.

**Can coexist with:**

- Lift only when low/moderate intensity and planned.
- Mobility.

**Should not coexist with:**

- Tempo/goal pace/hill/sprint run.
- Long run.
- Heavy lower-body strength.
- Red readiness.

**Rule:** Conditioning is not free. It counts as training stress.

### 4.4 Sprint Blocks

**Purpose:** Maximal speed or power.

**Can coexist with:**

- Warmup.
- Technical drills.
- Low-volume power work in advanced plans.

**Should not coexist with:**

- Long run.
- Heavy lower-body lift by default.
- Tempo run.
- High-volume hypertrophy.
- Pain, illness, or poor sleep.

### 4.5 Plyometric Blocks

**Purpose:** Elastic power, tendon stiffness, athleticism.

**Can coexist with:**

- Strength/power sessions if explicitly programmed.
- Sprint mechanics if low total volume and Green readiness.

**Should not coexist with:**

- Long run.
- High-volume lower-body hypertrophy.
- High-impact running session.
- Red or pain-limited readiness.

### 4.6 Core Blocks

**Purpose:** Trunk strength, stability, posture, performance support.

**Can coexist with:**

- Lift days.
- Easy run days.
- Mobility days.

**Should not coexist with:**

- Nothing by default, if short and low fatigue.

**Rule:** Core alone does not make a day a Lift Day unless the plan explicitly defines it as a structured strength/core session.

### 4.7 Mobility Blocks

**Purpose:** Range of motion, tissue tolerance, movement quality, pain management.

**Can coexist with:**

- Most days if low intensity.

**Should not coexist with:**

- Nothing by default.

**Rule:** Mobility is supportive unless it is the primary day type. It must not be misclassified as lifting.

---

## 5. Combined Session Rules

Combined sessions are allowed only when intentional and safe.

### 5.1 Can a day contain Lift + Run?

Yes, but only under defined circumstances.

Lift + Run is allowed when:

- The source plan explicitly schedules both, or
- The plan template allows a short easy run after lifting, and
- Readiness is Green, or Yellow with reduced load and no pain, and
- The run is easy/recovery, not quality, and
- The lift is not high-fatigue lower-body work, unless the plan explicitly supports it, and
- Total duration fits the athlete’s available time and phase.

### 5.2 Allowed combinations

#### Lift + Easy Run

Allowed when:

- Easy run is short/moderate.
- Lift is upper-body or moderate full-body.
- Readiness is Green.
- No pain warning.

Yellow readiness modification:

- Reduce lift volume or run duration.
- Preserve only the higher-priority stimulus if fatigue is meaningful.

#### Lift + Zone 2 Run

Allowed when:

- Zone 2 remains truly easy.
- Duration is moderate.
- Lower-body lift volume is not high.
- Plan explicitly allows hybrid load.

#### Upper Lift + Easy Run

Generally allowed if programmed.

#### Full-Body Lift + Short Easy Run

Conditionally allowed if total stress remains moderate.

#### Short Core + Easy Run

Allowed. Core remains accessory, not primary lift.

### 5.3 Forbidden combinations by default

#### Lift + Long Run

Forbidden by default.

Exception only for advanced athletes with explicit plan design, and even then lifting must be light/prehab only.

#### Heavy Lower Lift + Sprint Session

Forbidden by default.

Both create high neuromuscular and tissue stress.

#### Heavy Lower Lift + Hill Repeats

Forbidden by default.

Both stress calves, Achilles, knees, hips, and posterior chain.

#### Heavy Lift + Tempo Run

Forbidden by default.

Tempo requires quality and recovery. Heavy lifting compromises both.

#### Hypertrophy Leg Day + Long Run

Forbidden by default.

This risks poor performance, excessive soreness, and injury.

#### Conditioning + Quality Run

Forbidden unless explicitly programmed as a performance test or advanced workout.

### 5.4 Ordering rules for allowed hybrid days

Default ordering:

1. Warmup
2. Primary stimulus
3. Secondary stimulus
4. Mobility/cooldown

If running quality matters, run before lift.

If strength quality matters, lift before easy run.

If both quality matters, the day is probably overloaded and should be split or reprioritized.

### 5.5 Combined load cap

The planner must estimate combined stress.

A session should be flagged or modified if it includes two or more of:

- Heavy lower-body work.
- Tempo/goal pace/hill/sprint running.
- Long duration.
- Plyometrics.
- High soreness.
- Poor sleep.
- Pain.
- Deload week.

---

## 6. Recovery Overrides

Recovery overrides modify or replace the scheduled plan. They do not mutate the source plan.

### 6.1 Green readiness

Green means the athlete is cleared for normal planned training.

Planner behavior:

- Execute scheduled plan as written.
- Preserve planned day type.
- Keep hard sessions hard only if scheduled.
- Do not add extra work just because readiness is Green.

Green is permission to train, not permission to overload.

### 6.2 Yellow readiness

Yellow means caution.

Planner behavior:

- Preserve the primary stimulus if safe.
- Reduce volume, duration, intensity, or complexity.
- Remove optional accessories first.
- Remove secondary stimulus before primary stimulus.
- Avoid hard run quality unless the plan phase requires it and symptoms are minor.
- Convert hybrid day to single-priority day if needed.

Examples:

- Lift Day: reduce sets/load, remove finisher.
- Easy Run Day: shorten duration or keep easy.
- Tempo Day: convert to easy run if fatigue/soreness is meaningful.
- Hybrid Day: keep primary stimulus, drop secondary.

### 6.3 Red readiness

Red means no hard training.

Planner behavior:

- Replace structured hard work with Recovery Day.
- No lifting.
- No run workout.
- Optional gentle walk/mobility only if safe.
- Emit critical safety warning.
- Generate recovery logging targets, not workout/run performance targets.

### 6.4 Pain

Pain is a safety constraint, not a suggestion.

Planner behavior depends on severity:

- Mild non-worsening discomfort: modify and monitor.
- Moderate pain: remove aggravating blocks; prefer recovery/mobility.
- Severe pain or sharp pain: Red override; no hard training.

Pain-specific rules:

- Lower-body pain blocks hard running, sprinting, hills, plyometrics, and heavy lower-body lifting.
- Upper-body pain blocks aggravating lifts but may allow easy running.
- Pain during a prior session increases caution for the same modality.

### 6.5 Illness

Illness overrides performance goals.

Planner behavior:

- Fever, chest symptoms, systemic illness: Red override.
- Mild above-neck symptoms: Yellow or Recovery depending on severity.
- Resume with reduced volume after illness.

No hard intervals, long runs, or heavy lifting during meaningful illness.

### 6.6 Poor sleep

Poor sleep reduces training tolerance.

Planner behavior:

- One poor night: Yellow modification for hard sessions.
- Multiple poor nights: stronger Yellow or Red depending on fatigue.
- Hard run/lift quality should be reduced or rescheduled if sleep debt is significant.

### 6.7 Travel

Travel increases uncertainty and recovery cost.

Planner behavior:

- Prefer shorter, simpler sessions.
- Use bodyweight/mobility/easy run options if equipment unavailable.
- Do not prescribe complex or high-risk sessions when context is unknown.
- Preserve long-run priority only if safe and feasible.

### 6.8 Missed workouts

Missed workouts must not automatically be stacked onto today.

Planner behavior:

- If missed lift is low priority: skip or resume plan.
- If missed key strength session: consider shifting only if it does not collide with higher-priority endurance/recovery work.
- Do not combine missed hard lift with scheduled hard run.

### 6.9 Missed run weeks

Missed run weeks reduce safe progression.

Planner behavior:

- Do not jump to the original planned mileage without adjustment.
- Resume with reduced volume.
- Prioritize consistency and injury avoidance.
- Long run progression should be conservative.

### 6.10 Missed long runs

Missed long runs are important but must not be panic-stacked.

Planner behavior:

- If one long run is missed: resume or modestly adjust next long run.
- If multiple long runs are missed: reduce long-run target and reassess race readiness.
- Do not move a missed long run onto a lift/hard-run day without explicit plan logic.

### 6.11 Deload weeks

Deload weeks intentionally reduce stress.

Planner behavior:

- Reduce volume/intensity even if readiness is Green.
- Preserve movement pattern practice.
- Avoid new PRs and high-intensity conditioning.
- Long run may be reduced depending on plan phase.

---

## 7. Session Priority Hierarchy

When conflicts occur, the planner must resolve them using this priority order.

### 7.1 Full priority order

1. **Safety**
   - Severe pain, injury risk, illness, dangerous fatigue.

2. **Recovery / Readiness**
   - Red readiness, major Yellow warnings, deload constraints.

3. **Race Day / Test Day**
   - Scheduled event or benchmark.

4. **Long Run**
   - Key endurance stimulus for half marathon/marathon plans.

5. **Race-Specific Quality Run**
   - Goal pace, tempo, hills, speed when phase-appropriate.

6. **Plan Phase Integrity**
   - Base, build, peak, taper, deload, race week.

7. **Strength Maintenance / Strength Development**
   - Especially when strength is an active goal.

8. **Hypertrophy / Physique Development**
   - Greek God aesthetic work.

9. **Easy Aerobic Volume**
   - Easy/Zone 2/recovery runs.

10. **Accessory Work**
    - Core, arms, calves, smaller isolation work.

11. **Mobility / Prehab**
    - Supportive movement quality.

12. **Optional Conditioning / Finishers**
    - First to remove when load is high.

### 7.2 Conflict examples

- Red readiness vs long run: Red readiness wins.
- Long run vs hypertrophy lift: Long run wins.
- Tempo run vs heavy lower lift: Race-specific quality run wins if scheduled; lift is moved/reduced/skipped.
- Deload week vs Green readiness: Deload week still reduces load.
- Pain vs any workout: Pain safety rules win.

---

## 8. Future Plan Compatibility

The planner architecture must support many plan types without changing its core decision structure.

### 8.1 Required plan abstraction

Every plan, regardless of origin, should normalize into plan data with:

- Date or week/day placement.
- Primary day type.
- Blocks.
- Modality.
- Prescription mode.
- Intensity target.
- Duration/distance/sets/reps/load when available.
- Priority.
- Required versus optional status.
- Phase context.
- Logging targets.

The planner should not care whether a plan came from:

- Seed data.
- Manual entry.
- Uploaded PDF.
- Race calendar generator.
- Coach-generated block.
- Future marketplace/template plan.

### 8.2 Current Greek God Plan

Support needs:

- Hypertrophy and aesthetics.
- Strength progression.
- Upper/lower/full-body split support.
- Accessory and core work.
- Conditioning without compromising recovery.
- Body composition goal compatibility.

Rules:

- Hypertrophy blocks should not accidentally override long-run priority.
- Finishers are optional under fatigue.
- Muscle-building work must coexist intelligently with endurance work.

### 8.3 Half Marathon Plan

Support needs:

- Easy runs.
- Zone 2 runs.
- Long runs.
- Race-pace/tempo work.
- Deload/taper/race week.
- Missed long-run handling.

Rules:

- Long run is usually the highest non-safety weekly priority.
- Quality run days should be protected from heavy lower-body lifting.
- Easy runs may coexist with lifting only when explicitly allowed.

### 8.4 Marathon Plan

Support needs:

- Higher mileage.
- Longer long runs.
- More careful recovery management.
- Fueling practice.
- Greater injury-risk sensitivity.

Rules:

- Long run and medium-long run priority increases.
- Hybrid days become more restrictive as mileage rises.
- Strength work shifts toward maintenance during peak mileage.

### 8.5 Powerlifting Plan

Support needs:

- Squat/bench/deadlift priority.
- Strength phases.
- Heavy/light day distinction.
- Test/meet day support.
- Accessory support work.

Rules:

- Max effort lifting becomes high priority below safety/recovery.
- Hard running is generally secondary unless explicitly hybridized.
- Sprint/plyometric additions require explicit plan design.

### 8.6 Hypertrophy Plan

Support needs:

- Muscle group splits.
- Volume landmarks.
- Pump/accessory work.
- Progressive overload.
- Recovery balancing.

Rules:

- Volume is important but optional work is removable under fatigue.
- Cardio should support health/body composition without compromising recovery.

### 8.7 User Uploaded PDF Plans

Support needs:

- Parsed plan data normalization.
- Confidence scores for parsed prescriptions.
- Human review for ambiguous items.
- Preservation of prescription mode.

Rules:

- PDF import must not directly become planner behavior.
- PDF content must normalize into plan data first.
- Ambiguous rows must produce low-confidence plan items, not invented workouts.
- The planner must still apply this constitution after import.

### 8.8 Architecture compatibility rule

Future plans should extend plan data, not planner architecture.

If a new plan type requires changing core planner logic, first ask:

- Is this truly a new training principle?
- Or is it just a new block/day type/prescription field?

Most future compatibility should be solved by better plan normalization, not UI-specific logic.

---

## 9. Planner Success Criteria

A valid planner output must answer all six questions.

### 9.1 What should I do today?

The planner must provide:

- Primary day type.
- Ordered blocks.
- Specific workout/run/recovery names.
- Required versus optional items.

### 9.2 Why?

The planner must explain:

- Source plan reason.
- Readiness impact.
- Progression impact.
- Goal/race relevance.
- Any override reason.

### 9.3 How hard?

The planner must provide:

- Intended intensity.
- RPE/zone/pace/load guidance when available.
- Readiness modifications.
- Whether the session is Normal, Modified, Recovery, Rest, or Unavailable.

### 9.4 How long?

The planner must provide:

- Estimated total duration.
- Block-level estimated duration.
- Preservation of distance-based versus duration-based prescriptions.

### 9.5 What should I log afterward?

The planner must provide logging targets for:

- Workout completion when lift exists.
- Run completion when run exists.
- Recovery/pain/readiness notes when recovery override exists.
- No logging requirement for true rest days except optional check-in.

Logging targets must include enough identity to avoid ambiguity:

- Date.
- Source workout ID when applicable.
- Planned distance or duration for runs.
- Run type when applicable.
- Workout title when applicable.

### 9.6 What risks exist?

The planner must surface:

- Pain risk.
- Combined load risk.
- Poor sleep/fatigue risk.
- Missed training context.
- Deload/taper constraints.
- Low-confidence plan or data warnings.

### 9.7 Invalid planner output

Planner output is incomplete or invalid if:

- It falls back to an unrelated workout.
- It displays a stale run.
- It classifies mobility as lifting.
- It classifies a run-only day as a lift day.
- It creates accidental hybrid days.
- It adds a run to every lift day.
- It changes duration runs into distance runs.
- It changes distance runs into duration runs.
- It omits logging targets for required work.
- It cannot explain why today’s decision was made.

---

## 10. Behavioral Rules Summary

These are the non-negotiable rules future planner work must obey:

1. Home asks the planner: “What should I do today?”
2. UI does not reinterpret plan data.
3. Plan data flows into planner; planner flows into UI.
4. A day has one primary day type.
5. Lift day does not automatically mean run day.
6. Run day does not automatically mean lift day.
7. Mobility does not become lifting.
8. Long run day is long-run-only by default.
9. Hybrid days must be explicit, not accidental.
10. Recovery overrides scheduled training without mutating the source plan.
11. Safety beats every training goal.
12. Deload means deload even if readiness is Green.
13. Missed workouts are not blindly stacked onto today.
14. Missed long runs are handled conservatively.
15. Duration-based runs remain duration-based.
16. Distance-based runs remain distance-based.
17. Missing plan data produces a safe unavailable/rest answer.
18. Every required training block must have a logging target.
19. Every planner decision must be explainable.
20. Future plans extend normalized plan data, not screen-specific logic.

---

## 11. Acceptance Checklist for Future Planner Phases

Before the planner becomes runtime source of truth, future implementation must prove:

- Home, Train, Log, and Progress consume the same daily planner answer.
- No screen independently derives today’s workout or run.
- Lift-only days show no required run.
- Run-only days show no required lift.
- Long run days remain protected from accidental lifts.
- Mobility days are not classified as lift days.
- Recovery days block structured training.
- Hybrid days appear only when explicitly allowed.
- Run prescription mode is preserved.
- Missing days do not fall back to `workouts[0]` or stale recommendations.
- Logging targets are valid for every required block.
- Planner output explains what, why, how hard, how long, what to log, and risks.

---

## 12. Final Principle

The Training Planner should behave like a disciplined coach:

- It respects the plan.
- It respects recovery.
- It protects key sessions.
- It refuses unsafe combinations.
- It explains its decisions.
- It gives the user one clear answer for today.

The future app should not ask the user to reconcile competing interpretations of the training plan.

It should say clearly:

> **Here is what you should do today, why it matters, how hard to go, how long it should take, what to log, and what to watch out for.**

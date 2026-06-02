# NUTRITION V2 ARCHITECTURE

Goal: create one unified nutrition system that supports daily macro targets, meal logging, nutrition label scanning, meal photo calorie estimation, daily macro progress bars, and weekly/monthly adherence.

Scope of this document: architecture only. No code implementation. No UI implementation. Camera/AI features are architected here but not built here.

---

## 1. Current Problems

The current app has several nutrition-related systems that mostly work independently. They share some data types, but they do not yet have one canonical source of truth for nutrition targets, meal confidence, scan confidence, or adherence.

### 1.1 Seeded macro targets

Current model:

```ts
export interface MacroTarget {
  id?: string;
  userId?: string;
  week?: number;
  calories: number;
  protein: number;
  proteinMax?: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
}
```

Current issue:

- `MacroTarget` is week-oriented, not date-oriented.
- It has no `dayType`.
- It has no `source`.
- It cannot distinguish base targets from adjusted targets or manual overrides.
- It cannot represent long-run, race-prep, or refeed days.
- It is used as if it is the target for whatever day is being shown, but the model itself does not prove that.

Impact:

- Home, Daily Prescription, nutrition logging, and Progress can accidentally use different assumptions about the user's correct target for a given day.

### 1.2 Nutrition logger targets

Current nutrition logger has its own hard-coded targets:

```ts
export type NutritionLoggerDayType = "training" | "rest";

export const nutritionLoggerTargets = {
  training: { calories: 2600, protein: 220, carbs: 250, fat: 65 },
  rest: { calories: 2200, protein: 220, carbs: 150, fat: 70 },
};
```

Current issue:

- These targets are separate from seeded `MacroTarget` records.
- They omit fiber and water from the target shape.
- They only support `training` and `rest`.
- They are not tied to a date.
- They are not the same type used by Daily Prescription.

Impact:

- The nutrition logger can say one calorie target while Daily Prescription or Home says another.

### 1.3 Daily prescription targets

Current Daily Prescription receives a `MacroTarget` and produces text such as:

```text
Eat 2550 calories: 220g protein, 210g carbs, 70g fat, 30g fiber.
```

It can also modify the text if adherence is low or weight/waist stall logic recommends an adjustment.

Current issue:

- Daily Prescription can recommend a different calorie number in text without creating a canonical target record for that date.
- Macro adjustment logic can say `newCalories`, but the rest of the app may still use the old `MacroTarget`.
- The prescription owns some nutrition decision text, but the target system does not own the resulting daily target.

Impact:

- The app can display a modified calorie recommendation while adherence/progress calculations continue using the unmodified target.

### 1.4 Weekly review targets

Current Weekly Review summarizes:

- average calories
- average protein
- alcohol days
- adherence score

Current issue:

- Weekly Review does not evaluate nutrition logs against a date-specific daily target.
- Weekly Review's adherence score is broader than nutrition and includes check-ins, runs, lifts, and long-run completion.
- It reports `averageCalories` and `averageProtein`, but does not prove whether those values were correct for the user's planned day types.

Impact:

- Weekly nutrition adherence can look good or bad without knowing whether the week included training days, rest days, long-run days, race-prep days, or refeeds.

### 1.5 Adherence calculations

There are multiple adherence concepts:

1. `evaluateNutritionLoggerAdherence()`
   - Only returns calorie and protein percentages.
   - Uses nutrition logger hard-coded targets.

2. `calculateAdherence()` in coach logic
   - Uses calories, protein, carbs, fat, fiber, and alcohol.
   - Uses one passed `MacroTarget` for all logs.

3. Weekly Review adherence
   - Blends nutrition logs, check-ins, run logs, workout sessions, and long-run completion.

4. Home/adherence heatmap logic
   - Uses calorie/protein scoring plus workout and `macrosHit` bonuses.

Current issue:

- These scores are not the same metric.
- They use different target assumptions.
- Some depend on manual `macrosHit` rather than calculated macro adherence.
- They do not account for entry confidence from manual, label scan, or meal photo AI sources.

Impact:

- Progress can show adherence that does not match the nutrition logger or Daily Prescription.

### 1.6 Meal logging and scan logging are separate from adherence quality

Current models include `Meal`, `MealItem`, `FoodScanResult`, and `FoodScanLog`.

Current issue:

- Meal confidence is not first-class in `Meal` or `MealItem`.
- Scan confidence exists on `FoodScanResult`, but adherence does not weight or warn based on it.
- Label scans and meal photo scans share a scan model but have different quality guarantees.
- Confirmed label scans and unedited AI meal photo estimates should not be treated equally.

Impact:

- A day made from low-confidence meal photo estimates can be scored the same as a day logged manually or confirmed from a nutrition label.

---

## 2. New Source of Truth

Nutrition V2 introduces one canonical source of truth:

```ts
export type NutritionDayType = "training" | "rest" | "long-run" | "race-prep" | "refeed";
export type NutritionTargetSource = "base" | "adjusted" | "manual override";

export interface NutritionTarget {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
  dayType: NutritionDayType;
  source: NutritionTargetSource;
}
```

### 2.1 Meaning of each field

- `date`
  - The calendar date this target applies to.
  - This makes the target unambiguous.

- `calories`
  - The exact calorie target for that date.

- `protein`
  - The protein target for that date.
  - Protein usually remains stable across day types.

- `carbs`
  - The carbohydrate target for that date.
  - This is where training/rest/long-run/race-prep variation should mostly appear.

- `fat`
  - The fat target for that date.

- `fiber`
  - The fiber target for that date.

- `water`
  - The water target for that date.

- `dayType`
  - The physiological context for the target.
  - Allowed values:
    - `training`
    - `rest`
    - `long-run`
    - `race-prep`
    - `refeed`

- `source`
  - Why this target exists.
  - Allowed values:
    - `base`
    - `adjusted`
    - `manual override`

### 2.2 Target resolution rule

Every consumer must ask the same resolver for the target:

```ts
getNutritionTargetForDate(date, context): NutritionTarget
```

The resolver owns precedence:

1. Manual override for that date
2. Adjusted target for that date
3. Planned target for that date's day type
4. Base target fallback

No screen or engine should hard-code independent macro targets after V2.

### 2.3 Consumer rule

These consumers must all use `NutritionTarget`:

- Daily macro dashboard
- Meal logging totals
- Nutrition label scan confirmation
- Meal photo AI confirmation
- Macro progress bars
- Daily Prescription nutrition text
- Weekly adherence
- Monthly adherence
- Progress → Adherence Metrics
- Any future coach adjustment logic

### 2.4 Compatibility rule

Existing `MacroTarget` can remain temporarily as a legacy input or migration source, but it should not remain the active target used by new nutrition logic.

V2 target ownership should move toward:

```text
src/lib/nutrition-engine.ts
```

---

## 3. Meal Logging Model

Nutrition V2 introduces one canonical meal entry model:

```ts
export type MealLogType = "breakfast" | "lunch" | "dinner" | "snack" | "pre-workout" | "post-workout";
export type NutritionConfidence = "High" | "Medium" | "Low";
export type MealLogSource = "manual" | "nutrition-label-scan" | "meal-photo-ai" | "saved-food";

export interface MealLog {
  id: string;
  date: string;
  mealType: MealLogType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  confidence: NutritionConfidence;
  source: MealLogSource;
  servings: number;
  notes: string;
  imageUrl?: string;
}
```

### 3.1 MealLog meaning

- `id`
  - Stable ID for editing/deleting.

- `date`
  - Calendar date the meal counts toward.

- `mealType`
  - User-facing meal category.
  - Lowercase canonical values replace the current mixed-case `MealCategory` values.

- `name`
  - User-readable name such as `Chicken rice bowl`, `Protein bar`, or `Greek yogurt`.

- `calories`, `protein`, `carbs`, `fat`, `fiber`, `sodium`
  - Final macro values saved after manual entry or review.
  - These should represent total consumed amount, not per-serving values.

- `confidence`
  - Trust level of the saved entry.

- `source`
  - How the meal entered the system.

- `servings`
  - Number of servings eaten.
  - For manually entered total macros, this can default to `1`.

- `notes`
  - User notes or provenance details.

- `imageUrl`
  - Optional image reference for scans or food photos.

### 3.2 Relationship to current models

Current `Meal`, `MealItem`, `NutritionLog`, and `FoodScanLog` can be migrated toward `MealLog`.

Recommended V2 direction:

- `MealLog` becomes the source record.
- Daily nutrition totals are derived from `MealLog[]`.
- `NutritionLog` becomes either:
  - a derived daily summary, or
  - a backward-compatible projection for existing screens.

### 3.3 Daily total derivation

Daily consumed nutrition should be derived by summing MealLogs for the date:

```ts
calculateDailyNutritionTotals(date, mealLogs): DailyNutritionTotals
```

Derived fields:

- calories
- protein
- carbs
- fat
- fiber
- sodium
- water if logged separately or added later
- alcohol if stored separately or represented as a MealLog/source extension
- confidence summary

### 3.4 Saved Foods / Quick Add

Nutrition V2 should support saved foods so common repeat foods can be logged with one tap instead of rescanning or re-entering.

Canonical saved-food type:

```ts
export interface SavedFood {
  id: string;
  name: string;
  defaultServing: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  source: MealLogSource;
  confidence: NutritionConfidence;
}
```

Purpose:

- Common repeat foods should be logged with one tap.
- Saved foods should avoid unnecessary rescanning.
- Saved foods should avoid repeated manual macro entry.
- Quick Add should create a `MealLog` using the saved food's default macro values, source, and confidence.
- Users can still edit servings/macros before saving when needed.

SavedFood to MealLog mapping:

```text
SavedFood selected
  -> user chooses mealType/date/servings if different from default
  -> app calculates total consumed macros
  -> app creates MealLog with source = "saved-food"
  -> app preserves confidence from SavedFood unless user edits macros
```

---

## 4. Nutrition Label Scan Workflow

### 4.1 User flow

1. User takes a photo of a nutrition label.
2. AI extracts per-serving values:
   - calories
   - protein
   - carbs
   - fat
   - fiber
   - sodium
3. User enters number of servings eaten.
4. App calculates total macros:
   - total calories = per-serving calories × servings eaten
   - total protein = per-serving protein × servings eaten
   - total carbs = per-serving carbs × servings eaten
   - total fat = per-serving fat × servings eaten
   - total fiber = per-serving fiber × servings eaten
   - total sodium = per-serving sodium × servings eaten
5. User reviews the extracted data and calculated totals.
6. User confirms before saving.
7. App saves a `MealLog` with:
   - `source: "nutrition-label-scan"`
   - `confidence: "High"` only after confirmation

### 4.2 Important confidence rule

Nutrition label scans should default to High confidence only after user confirms.

Before confirmation:

```ts
confidence = "Medium" | "Low"
status = "reviewed"
```

After confirmation:

```ts
confidence = "High"
status = "confirmed"
```

Rationale:

- Nutrition labels are structured data.
- AI extraction can still misread serving size, decimal points, sodium units, or line alignment.
- User confirmation is the step that upgrades the record to High confidence.

### 4.3 Required scan result distinction

The app should store both:

1. AI extracted per-serving data
2. Final confirmed consumed totals

Do not overwrite provenance.

Recommended draft model:

```ts
interface NutritionLabelScanDraft {
  id: string;
  date: string;
  imageUrl?: string;
  extractedPerServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sodium: number;
  };
  servingsEaten: number;
  calculatedTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sodium: number;
  };
  confidence: "Low" | "Medium";
  status: "reviewed" | "confirmed" | "discarded";
}
```

Confirmation creates a `MealLog`.

---

## 5. Meal Photo AI Workflow

### 5.1 User flow

1. User takes a photo of a meal.
2. AI estimates:
   - food items
   - portions
   - calories
   - protein
   - carbs
   - fat
3. App labels result as Low or Medium confidence.
4. User can edit before saving.
5. App saves final confirmed macros.

### 5.2 Important confidence rule

Meal photo AI estimates should never be treated as High confidence unless manually corrected.

Default rules:

```text
unedited meal photo AI estimate = Low confidence
edited meal photo AI estimate = Medium confidence
```

High confidence is reserved for:

- manual entry
- confirmed nutrition label scan
- saved food with known verified macros

### 5.3 Why photo confidence is lower

Meal photos are inherently less reliable because AI must infer:

- hidden oils and sauces
- portion sizes
- exact ingredient ratios
- cooking methods
- calorie density
- serving weights

Impact:

- Photo AI is useful for reducing logging friction.
- It should not silently drive high-confidence adherence or calorie adjustments.

### 5.4 Photo estimate draft model

Recommended draft model:

```ts
interface MealPhotoEstimateDraft {
  id: string;
  date: string;
  imageUrl?: string;
  detectedFoods: string[];
  portionEstimate: string;
  estimatedMacros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sodium?: number;
  };
  confidence: "Low" | "Medium";
  editedByUser: boolean;
  status: "reviewed" | "confirmed" | "discarded";
}
```

Confirmation creates a `MealLog`:

```ts
source = "meal-photo-ai"
confidence = editedByUser ? "Medium" : "Low"
```

---

## 6. Daily Macro Dashboard

Daily macro dashboard must use the same `NutritionTarget` as Daily Prescription and Progress adherence.

The dashboard must also function as a macro budget remaining view. The user should always be able to answer:

```text
What do I have left today?
```

### 6.1 Required progress bars

Show progress bars for:

- calories
- protein
- carbs
- fat
- fiber
- water

### 6.2 Each bar should show

For every macro bar:

```ts
interface MacroProgressBarValue {
  consumed: number;
  target: number;
  remaining: number;
  percentComplete: number;
}
```

Daily macro progress should expose the main bar values plus explicit carbs/fat progress fields:

```ts
interface DailyMacroProgress {
  calories: MacroProgressBarValue;
  protein: MacroProgressBarValue;
  carbs: MacroProgressBarValue;
  fat: MacroProgressBarValue;
  fiber: MacroProgressBarValue;
  water: MacroProgressBarValue;
  carbsProgress: MacroProgressBarValue;
  fatProgress: MacroProgressBarValue;
}
```

`carbsProgress` and `fatProgress` are visibility fields, not major adherence drivers yet.

Displayed values:

- consumed
- target
- remaining
- percent complete

### 6.2.1 Macro Budget Remaining

For every tracked macro, the daily dashboard must show the full budget state:

```text
calories: consumed, target, remaining, percentComplete
protein: consumed, target, remaining, percentComplete
carbs: consumed, target, remaining, percentComplete
fat: consumed, target, remaining, percentComplete
fiber: consumed, target, remaining, percentComplete
water: consumed, target, remaining, percentComplete
```

This is a product requirement, not just an internal calculation. The daily nutrition view should make the remaining budget obvious without requiring the user to do mental math.

### 6.3 Progress calculation

```ts
remaining = max(0, target - consumed)
percentComplete = clamp(round((consumed / target) * 100), 0, 100)
```

For calories, optionally also show overage if consumed exceeds target:

```ts
overage = max(0, consumed - target)
```

### 6.4 Daily dashboard data flow

```text
selectedDate
  -> getNutritionTargetForDate(selectedDate, context)
  -> getMealLogsForDate(selectedDate)
  -> calculateDailyNutritionTotals(selectedDate, mealLogs)
  -> calculateMacroProgress(totals, target)
  -> render daily macro progress bars
```

### 6.5 Water handling

Water is included in `NutritionTarget` and the progress bars, but V2 should decide whether water is:

- logged directly as a daily field, or
- stored as a special `MealLog`/hydration entry, or
- retained in `NutritionLog` compatibility state during migration.

Architecture decision:

- The target must include water now.
- The implementation can preserve existing water logging while the meal model migrates.

---

## 7. Adherence Metrics

Nutrition V2 creates one macro adherence system used by Daily, Weekly, Monthly, and Progress.

### 7.1 Required macro adherence stats

Create macro adherence stats:

- daily adherence
- weekly adherence
- monthly adherence

### 7.2 Inputs

Adherence inputs:

```ts
interface MacroAdherenceInput {
  dateRange: { startDate: string; endDate: string };
  mealLogs: MealLog[];
  nutritionTargets: NutritionTarget[];
  alcoholDays: number;
}
```

### 7.3 Adherence should consider

- calories within target range
- protein achieved
- alcohol penalty
- fiber achieved
- consistency across logged days
- entry confidence / data quality

### 7.4 Daily adherence formula

Recommended daily scoring:

```text
calorieScore: 35%
proteinScore: 30%
fiberScore: 15%
loggingConsistency: 10%
confidenceQuality: 10%
alcoholPenalty: subtract up to 10 points
```

Where:

```text
calorieScore = gradient score based on distance from target calorie range
proteinScore = min(protein / targetProtein, 1) * 100
fiberScore = min(fiber / targetFiber, 1) * 100
loggingConsistency = 100 if at least one MealLog exists for the date, else 0
confidenceQuality = weighted average confidence score
```

Target calorie range:

```text
within target = targetCalories - 10% through targetCalories + 5%
```

Calorie adherence gradient:

```text
100 points if calories are between target -10% and target +5%
Gradually reduce score above target +5%
Gradually reduce score below target -10%
0 points if calories are more than 25% over target
0 points if calories are more than 25% under target
```

Recommended implementation shape:

```text
lowerGreen = targetCalories * 0.90
upperGreen = targetCalories * 1.05
lowerZero = targetCalories * 0.75
upperZero = targetCalories * 1.25

if consumedCalories >= lowerGreen and consumedCalories <= upperGreen:
  calorieScore = 100
else if consumedCalories > upperGreen and consumedCalories <= upperZero:
  calorieScore = linear interpolation from 100 at upperGreen to 0 at upperZero
else if consumedCalories < lowerGreen and consumedCalories >= lowerZero:
  calorieScore = linear interpolation from 100 at lowerGreen to 0 at lowerZero
else:
  calorieScore = 0
```

Daily warning field:

```ts
calorieOverageWarning: boolean;
```

Warning rule:

```text
calorieOverageWarning = true if calories are >10% over target
calorieOverageWarning = true if calories are >20% under target
```

Carbs and fat should be visible in macro progress but should not become major adherence drivers yet.

Rationale:

- For fat loss, calorie control and protein are the highest priority.
- Carbs and fat should remain visible so the user understands the composition of the day.
- Carbs and fat should not be overly punished yet because the first-order nutrition behavior is hitting calories, protein, fiber, and consistency.
- Undershooting slightly is less concerning than consistently overshooting, but large under-eating should still reduce the calorie score and trigger a warning.

### 7.5 Confidence weighting

Confidence values:

```text
High   = 1.0
Medium = 0.8
Low    = 0.6
```

Daily confidence quality:

```text
confidenceQuality = weighted average meal confidence for the day
```

Low-confidence warning threshold:

```text
if more than 40% of calories come from Low confidence meals:
  show data quality warning
```

### 7.6 Weekly adherence

Weekly adherence should aggregate daily adherence over a 7-day window.

Outputs:

```ts
interface MacroAdherenceSummary {
  startDate: string;
  endDate: string;
  loggedDays: number;
  totalDays: number;
  dailyAdherence: number;
  weeklyAdherence?: number;
  monthlyAdherence?: number;
  caloriesAdherence: number;
  proteinAdherence: number;
  fiberAdherence: number;
  loggingConsistency: number;
  alcoholDays: number;
  calorieOverageWarning: boolean;
  confidence: "High" | "Medium" | "Low";
  warnings: string[];
}
```

Weekly formula:

```text
weeklyAdherence = average(daily adherence scores across the 7-day window)
loggingConsistency = loggedDays / 7 * 100
```

### 7.7 Monthly adherence

Monthly adherence should aggregate daily adherence over a 30-day window.

Formula:

```text
monthlyAdherence = average(daily adherence scores across the 30-day window)
loggingConsistency = loggedDays / 30 * 100
```

### 7.8 Alcohol penalty

Alcohol penalty should apply to adherence but should not erase otherwise useful nutrition data.

Recommended daily penalty:

```text
1 alcohol day = -5 points
2+ drinks or logged alcohol grams/servings above threshold = up to -10 points
```

Weekly/monthly outputs should include alcohol days as a visible metric.

---

## 8. Progress Integration

Under Progress → Adherence Metrics, show:

- 7-day macro adherence
- 30-day macro adherence
- calories adherence
- protein adherence
- logging consistency
- alcohol days

### 8.1 Progress data flow

```text
Progress tab selected
  -> determine current date
  -> get last 7 days of NutritionTarget + MealLog data
  -> get last 30 days of NutritionTarget + MealLog data
  -> calculateMacroAdherence(7-day window)
  -> calculateMacroAdherence(30-day window)
  -> render Adherence Metrics
```

### 8.2 Required Progress metric definitions

- `7-day macro adherence`
  - Average daily adherence over last 7 calendar days.

- `30-day macro adherence`
  - Average daily adherence over last 30 calendar days.

- `calories adherence`
  - Average calorie range adherence across the selected window.

- `protein adherence`
  - Average percentage of days where protein target was achieved or nearly achieved.

- `logging consistency`
  - Percentage of days with at least one confirmed/logged meal entry or daily nutrition total.

- `alcohol days`
  - Count of days with alcohol logged in the selected window.

### 8.3 Weekly Review relationship

Weekly Review may still output a broader `adherenceScore`, but its nutrition component should come from MacroAdherenceSummary.

Architecture rule:

```text
Weekly Review should not independently calculate nutrition adherence.
It should consume the 7-day MacroAdherenceSummary.
```

---

## 9. Data Quality

Nutrition V2 tracks confidence at the meal level and carries that forward into daily/weekly/monthly adherence.

### 9.1 Confidence source rules

```text
manual entry = High
confirmed label scan = High
edited meal photo = Medium
unedited meal photo = Low
saved food = High, if verified
saved food = Medium, if user-created but not verified
```

### 9.2 Required data quality behavior

Adherence calculations should:

- include low-confidence entries in totals
- weight low-confidence entries less in confidence quality
- show warnings when low-confidence data dominates the day/window
- avoid making aggressive calorie adjustments from low-confidence adherence data

### 9.3 Data quality warnings

Examples:

```text
More than 40% of calories were estimated from low-confidence meal photos.
Only 3 of 7 days had nutrition logs.
Meal photo estimates were not edited or confirmed.
No nutrition target exists for 2 days in this window; base targets were used.
```

### 9.4 Coach adjustment rule

Macro adjustment logic should require adequate data quality.

Recommended rule:

```text
Do not reduce calories, add refeeds, or make aggressive macro changes unless:
- logging consistency >= 80%
- confidence is High or Medium
- at least 7 days of target-aligned data exists
```

If data quality is poor:

```text
recommendation = "Improve logging consistency before changing calories."
```

---

## 10. Proposed File Ownership

Implementation should be isolated and phased. This architecture does not implement these files yet.

### 10.1 New file

```text
src/lib/nutrition-engine.ts
```

Responsibilities:

- `NutritionTarget` types
- `MealLog` types
- target resolution
- meal-to-daily-total derivation
- macro progress calculation
- daily/weekly/monthly adherence calculation
- confidence/data quality scoring

### 10.2 Tests

```text
src/lib/nutrition-engine.test.ts
```

Required tests:

- resolves date-specific target
- manual override beats adjusted/base target
- training/rest/long-run/race-prep/refeed day types produce correct target shape
- meal logs sum into daily totals
- label scan confirmation creates High confidence MealLog
- unedited meal photo creates Low confidence MealLog
- edited meal photo creates Medium confidence MealLog
- progress bars calculate consumed/target/remaining/percent
- daily adherence includes calories, protein, fiber, alcohol, consistency, confidence
- weekly adherence aggregates 7 days
- monthly adherence aggregates 30 days
- low-confidence warning appears when meal photo estimates dominate

### 10.3 Existing files likely changed during implementation

```text
src/lib/types.ts
src/lib/coach-engine.ts
src/lib/nutrition-logger.ts
src/lib/weekly-review.ts
src/lib/storage.ts
src/lib/supabase-persistence.ts
src/app/api/scan-food/route.ts
```

Potential test updates:

```text
src/lib/coach-engine.test.ts
src/lib/nutrition-logger.test.ts
src/lib/weekly-review.test.ts
src/lib/storage.test.ts
```

UI files should not be changed until the implementation phase explicitly allows UI work.

---

## 11. Migration Plan

### Phase 0: Architecture only

Current phase.

- Create this document.
- Do not write implementation code.
- Do not modify UI.

### Phase 1: Build nutrition engine without UI changes

Create:

```text
src/lib/nutrition-engine.ts
src/lib/nutrition-engine.test.ts
```

Implement:

- `NutritionTarget`
- `MealLog`
- target resolver
- daily totals
- macro progress
- adherence summaries
- confidence scoring

### Phase 2: Backward-compatible wrappers

Keep existing function names where needed:

- `getNutritionLoggerTarget()` should call the new target resolver.
- `evaluateNutritionLoggerAdherence()` should call the new adherence system.
- `calculateNutritionProgress()` should use `NutritionTarget` internally or an adapter.
- `calculateAdherence()` should become a wrapper around macro adherence logic.

### Phase 3: Scan workflow adapter

Use existing scan API/model as draft/provenance data.

Add conversion functions:

```ts
confirmNutritionLabelScanToMealLog(...): MealLog
confirmMealPhotoEstimateToMealLog(...): MealLog
```

Rules:

- confirmed nutrition label scan -> High confidence
- unedited meal photo -> Low confidence
- edited meal photo -> Medium confidence

### Phase 4: Weekly/monthly adherence migration

Migrate Weekly Review and Progress data models to consume:

```ts
MacroAdherenceSummary
```

Do not allow Weekly Review or Progress to independently calculate macro adherence.

### Phase 5: UI integration later

Only after engine migration is verified:

- Daily macro dashboard progress bars
- Meal log UI updates
- scan confirmation UI updates
- Progress → Adherence Metrics UI

---

## 12. Acceptance Criteria

Nutrition V2 is accepted when:

1. No conflicting nutrition targets
   - There is exactly one resolved `NutritionTarget` per date.

2. Nutrition logger uses same target as Daily Prescription
   - Both call the same target resolver.

3. Progress adherence uses same target
   - Progress does not use separate target math.

4. User can see daily macro progress clearly
   - Calories, protein, carbs, fat, fiber, and water each show consumed, target, remaining, and percent complete.

5. Camera/AI features are architected but not implemented yet
   - Nutrition label scan and meal photo AI workflows are specified.
   - Confidence rules are specified.
   - Confirmation behavior is specified.

6. Adherence is unified
   - Daily, weekly, and monthly adherence share one formula family.

7. Data quality is visible
   - Low-confidence food photo days do not silently drive coaching decisions.

8. Manual entry remains fast
   - Manual meals save as High confidence by default.

9. Label scan confirmation is safe
   - High confidence requires user confirmation.

10. Meal photo estimates are conservative
   - Unedited meal photo estimates remain Low confidence.
   - Edited meal photo estimates can become Medium confidence.

---

## 13. Summary

Nutrition V2 should replace scattered macro targets and adherence calculations with one date-specific target system and one meal/adherence engine.

The core decisions are:

- `NutritionTarget` is the source of truth for a date.
- `MealLog` is the source of truth for consumed nutrition.
- Daily totals are derived from MealLogs.
- Progress bars compare daily totals against the date's NutritionTarget.
- Daily, weekly, and monthly adherence use the same scoring model.
- Label scans can become High confidence only after user confirmation.
- Meal photo AI is useful but conservative: Low by default, Medium if edited, not High unless manually corrected into a verified entry.
- Progress and Weekly Review should consume the same adherence summary rather than recomputing nutrition logic independently.

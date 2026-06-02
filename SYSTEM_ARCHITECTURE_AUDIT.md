# SYSTEM ARCHITECTURE AUDIT

Purpose: explain exactly how the app currently thinks and makes decisions, based on the current source code. This is an audit of the system that exists now, not a product roadmap or marketing document.

Primary files inspected:

- `src/app/page.tsx`
- `src/lib/types.ts`
- `src/lib/coach-engine.ts`
- `src/lib/daily-checkin.ts`
- `src/lib/workout-logger.ts`
- `src/lib/run-logger.ts`
- `src/lib/nutrition-logger.ts`
- `src/lib/weekly-review.ts`
- `src/lib/weight-trend.ts`
- `src/lib/storage.ts`
- `src/lib/seed-data.ts`

Important note: the UI references `/05_API_and_Data/adjustment_rules.md`, but that file is not present at the inspected repository path. The implemented rules live in TypeScript code, mainly `daily-checkin.ts`, `coach-engine.ts`, and `weekly-review.ts`.

---

## 1. User Journey

### 1.1 Opening the app

1. User opens `/`.
2. `Home()` initializes `state` as `null`.
3. `useEffect(() => setState(loadState()), [])` loads persisted app state.
4. `loadState()` behavior:
   - If server-side rendering: returns seeded demo state from `createInitialState()`.
   - If browser and `localStorage["greek-god-coach:v1"]` exists: parses and migrates it through `migrateAppState()`.
   - If no local state or parsing fails: uses `createInitialState()`.
5. App creates a persistence context with `createAuthAwarePersistenceContext()`.
6. On every state change:
   - If no Supabase context or mode is `localStorage`, state is saved to localStorage.
   - If Supabase context exists, app attempts `syncAppStateToSupabase()` and falls back to localStorage on failure.
7. App computes derived coaching state:
   - `latestCheckIn = state.checkIns.at(-1)`.
   - Baseline recovery values are hard-coded: resting HR `58`, HRV `60`.
   - `readiness = calculateReadiness(latestCheckIn, baseline)`.
   - `currentWorkout = getWorkoutForWeekDay(selectedWeek, selectedDay)`.
   - `adjustedWorkout = adjustWorkoutForReadiness(currentWorkout, readiness.status)`.
   - `macroTarget = state.macroTargets.find(week === selectedWeek)`.
   - `trend = calculateWeightTrend(state.bodyMetrics)`.
   - `trainingAdherence = last-7 check-ins with workoutCompleted / available check-ins`.
   - `weeklyReview = buildWeeklyReviewSummary(state, last 7 calendar days)`.
   - `runTrends = calculateRunTrends(state.runLogs)`.
   - `runningRecommendation = generateRunningRecommendation(...)`.
   - `dailyPrescription = generateDailyPrescription(...)`.
   - `homeCommandCenter = buildHomeCommandCenter(...)`.
8. Header renders five primary tabs:
   - Home
   - Train
   - Log
   - Progress
   - More
9. Default active tab is `Home`.
10. Home displays:
   - Readiness status
   - Today’s workout + run
   - Calories remaining
   - Current weight
   - `Start Day` button that switches to `Log`.

### 1.2 Completing a daily check-in

1. User clicks `Start Day` on Home or opens `Log` → `Daily check-in`.
2. `DailyCheckInForm` builds a default form from:
   - Today’s existing check-in if present.
   - Otherwise latest check-in values.
   - Otherwise demo user defaults.
3. The form asks for:
   - Date
   - Weight
   - Sleep hours
   - Energy
   - Soreness
   - Stress
   - Yesterday’s Steps
   - Alcohol yesterday
   - Notes
4. It no longer asks manually for workout completed or run completed.
5. Completion status is derived by `deriveDailyCompletionStatus(state, form.date)`:
   - `workoutCompleted = true` if any workout session started, ended, or has a set completed on that date.
   - `runCompleted = true` if any run log has that date.
6. A live preview is produced by `evaluateDailyRecoveryStatus(form)`.
7. User clicks `Save check-in`.
8. Save flow:
   - Merges form with derived completion status.
   - Evaluates saved daily recovery status.
   - Calls `upsertDailyCheckIn(state, entry, uid("metric"))`.
9. `upsertDailyCheckIn()`:
   - Re-derives completion from logs, overriding stale/manual values.
   - Upserts one `DailyCheckIn` per date.
   - Creates or replaces a `BodyMetric` for the same date with the check-in weight and notes `"from daily check-in"`.
10. The right-side summary shows:
   - Recovery status Green/Yellow/Red
   - Reasoning
   - Sleep
   - Soreness
   - Stress
   - Energy
   - Alcohol
   - Workout completed, read-only, auto-detected
   - Run completed, read-only, auto-detected

### 1.3 Starting training

1. User opens `Train`.
2. `TrainingPlan` displays:
   - Today’s workout, using `adjustedWorkout`, not always the original seed workout.
   - Today’s run, using `runningRecommendation` when available.
   - Week selector, 1-12.
   - Day selector, Monday-Sunday.
   - Readiness status and score.
3. User clicks `Start Training`.
4. `startWorkout()` creates a `WorkoutSession`:
   - `id = uid("session")`
   - `userId = state.user.id`
   - `workoutId = displayedWorkout.id`
   - `workoutTitle = displayedWorkout.title`
   - `mode = "coach"`
   - `startedAt = now`
   - `status = "active"` if workout has exercises, else `"completed"`
   - `currentExerciseIndex = 0`
   - `currentSetNumber = 1`
   - `setLogs = []`
5. Session is appended to `state.workoutSessions`.
6. If active, `ActiveWorkout` replaces preview.

### 1.4 Logging workouts during active training

1. `ActiveWorkout` identifies current exercise from `workout.exercises[session.currentExerciseIndex]`.
2. It calculates recommended starting load with `getRecommendedStartingWeight(exercise.id, state.setLogs)`:
   - Finds latest set log for the exercise with no pain, reps > 0, RPE <= 8, form not missed.
   - Returns its weight.
   - If no safe history, returns `0`.
3. User logs each set:
   - Weight used
   - Reps completed
   - RPE
   - Pain yes/no
   - Form quality: solid / minor breakdown / missed
4. On set completion:
   - Creates `SetLog`.
   - Calls `generateNextSetRecommendation({ setLog, readinessStatus })`.
   - Attaches the resulting `CoachDecision` to the set log.
   - Advances session with `getNextWorkoutStep()`.
   - Persists session and set log.
   - If the decision is important, logs a `PlanAdjustment` category `Set-by-set coach decision`.
5. If session is still active, rest timer starts with the recommended rest duration.
6. User can:
   - Start next set after rest.
   - Skip current exercise.
   - End workout.
7. When all exercises/sets are completed, session becomes `completed`.
8. Completed session triggers `generatePostWorkoutAnalysis()` if no stored summary exists.
9. Generated post-workout output includes:
   - Completion percentage
   - Exercises completed
   - Total sets/reps
   - Estimated volume
   - High RPE flags
   - Missed rep flags
   - Pain flags
   - Poor form flags
   - Best sets
   - Coach summary
   - Next-session recommendations
10. Post-workout recommendations and a `Future workout recommendation` adjustment are stored.

### 1.5 Logging workouts through manual logger

1. User opens `Log` → `Workout logging`.
2. Form defaults:
   - Date = today
   - Workout type = upper strength
   - Two sample exercises: Bench Press and Row
   - Completed = true
   - Soreness and sleep from latest check-in if passed; currently the caller does not pass `latestCheckIn`, so defaults are soreness 4, sleep 7.
3. User logs:
   - Workout date
   - Workout type
   - Sleep hours
   - Soreness
   - Completed yes/no
   - For each exercise: name, sets, reps, weight, RPE, exercise completed, pain notes
4. Save flow:
   - `buildWorkoutLoggerSession(form)` converts the manual form to a `WorkoutSession` and per-set `SetLog`s.
   - `saveWorkoutLoggerEntry()` evaluates result and stores:
     - `workoutSessions`
     - `setLogs`
     - `workoutSummaries`
     - `postWorkoutRecommendations`
5. This logger treats the entire logged workout as manual mode.

### 1.6 Logging runs

1. User opens `Log` → `Run logging`.
2. `Running` form defaults:
   - Date = today
   - Run type = easy
   - Distance = `plannedDistance`, passed as `3` from `LogScreen`
   - Duration = distance × 11 minutes
   - Average pace = 11 min/mi
   - Average heart rate = 140
   - RPE = 5
   - Walk breaks = false
   - Pain score = 0
3. User logs:
   - Date
   - Run type: easy, speed, tempo, long run, race
   - Distance
   - Duration
   - Average pace
   - Average heart rate
   - RPE
   - Walk breaks
   - Pain score
   - Notes
4. Save flow:
   - `buildRunLoggerRecord(form)` creates a `RunLog`.
   - Pace is either provided or calculated as duration / distance.
   - `completed = distance > 0 && duration > 0`.
   - `zone2Compliance` is inferred from RPE:
     - RPE <= 6 → 85
     - RPE = 7 → 75
     - RPE >= 8 → 60
   - Pain is `painScore > 0`.
   - `saveRunLoggerEntry()` stores one run per date.
5. Run summary and decision are calculated internally by `evaluateRunLoggerResult()`, but the current UI save path only stores state; it does not display the returned run logger result immediately in the form.

### 1.7 Logging nutrition

1. User opens `Log` → `Nutrition logging`.
2. Existing nutrition log for today is loaded if present.
3. Form defaults:
   - Date = today
   - Day type = training
   - Calories = existing or 2600
   - Protein = existing or 220
   - Carbs = existing or 250
   - Fat = existing or 65
   - Fiber = existing or 30
   - Water = existing or 120
   - Alcohol = existing alcohol truthiness
   - Notes
4. User saves.
5. `buildNutritionLogRecord()` creates a `NutritionLog`.
6. `evaluateNutritionLoggerAdherence()` calculates simple logged ÷ target percentages.
7. `saveNutritionLoggerEntry()` upserts one nutrition log per date.
8. UI shows:
   - Training/rest targets
   - Calorie adherence percentage
   - Protein adherence percentage
   - Saved/preview macro summary

### 1.8 Reviewing progress

1. User opens `Progress`.
2. Subsections:
   - Weight trends
   - Pace trends / Mileage trends
   - Weekly review
   - Progress photos
   - Race countdown
   - Adherence metrics
3. Weight trends:
   - `buildWeightTrendDashboard(state.bodyMetrics, { startingWeight: 233, goalWeight: 199.9 })`.
   - Shows latest weight, 7-day average, 14-day average, weekly weight change, pounds lost, pounds remaining, progress percent, chart.
4. Run trends:
   - `calculateRunTrends(state.runLogs)`.
   - Shows distance trend, pace trend, RPE trend, weekly mileage.
5. Weekly review:
   - `buildWeeklyReviewSummary(state, last 7 calendar days)`.
   - Shows average weight, weight change, miles, long-run yes/no, lifts, calories, protein, sleep, alcohol days, pain flags, adherence score, next-week recommendation.
6. Photos:
   - User manually stores date and front/side/back photo URLs.
7. Race countdown:
   - Built via `buildHomeCommandCenter()`; displayed target is January 17.
8. Adherence metrics:
   - Displays weekly review adherence score, weekly miles, lifts completed.

---

## 2. Data Model

The canonical type definitions are in `src/lib/types.ts`. Persistence stores a single `AppState` object in localStorage and optionally syncs collections to Supabase.

### 2.1 AppState

Fields:

- `user: UserProfile` — required
- `appMode: AppMode` — required, currently `"coach" | "tracker" | "manual"`; UI mostly uses coach mode
- `currentWeek: number` — required
- `startDate: string` — required ISO date
- `checkIns: DailyCheckIn[]` — required array
- `bodyMetrics: BodyMetric[]` — required array
- `photos: ProgressPhoto[]` — required array
- `nutritionLogs: NutritionLog[]` — required array
- `meals: Meal[]` — required array
- `foodScans: FoodScanLog[]` — required array
- `runLogs: RunLog[]` — required array
- `exerciseLogs: ExerciseLog[]` — required array, legacy/simple exercise logs
- `workoutSessions: WorkoutSession[]` — required array
- `setLogs: SetLog[]` — required array
- `workoutSummaries: WorkoutSummary[]` — required array
- `postWorkoutRecommendations: PostWorkoutRecommendation[]` — required array
- `adjustments: PlanAdjustment[]` — required array
- `macroTargets: MacroTarget[]` — required array

Relationships:

- `user.id` links nearly every user-owned object through `userId`.
- `workoutSessions` contain embedded `setLogs`; `state.setLogs` also duplicates set logs globally.
- `workoutSummaries` reference sessions by `sessionId` and workouts by `workoutId`.
- `postWorkoutRecommendations` reference session/workout/exercise.
- `DailyCheckIn.weight` is mirrored into `BodyMetric` on save.

### 2.2 UserProfile

Required fields:

- `id: string`
- `name: string`
- `age: number`
- `sex: string`
- `height: string`
- `startingWeight: number`
- `goalWeight: number`
- `activityLevel: string`
- `goal: string`
- `trainingExperience: string`
- `strengthNumbers: string`
- `equipment: string`
- `injuryHistory: string`
- `preferredUnits: "imperial" | "metric"`
- `createdAt: string`

Relationships:

- Parent object for all logs via `userId`.

### 2.3 DailyCheckIn

Required fields:

- `id: string`
- `userId: string`
- `date: string`
- `weight: number`
- `sleepHours: number`
- `sleepQuality: number`
- `soreness: number`
- `energy: number`
- `stress: number`
- `hunger: number`
- `motivation: number`
- `alcohol: boolean`
- `steps: number`
- `restingHr: number`
- `hrv: number`
- `pain: boolean`
- `painLocation: string`
- `painSeverity: number`
- `workoutCompleted: boolean`
- `runCompleted: boolean`
- `macrosHit: boolean`
- `notes: string`

Relationships:

- One check-in per date is intended.
- Saves create/update one `BodyMetric` for the same date.
- `workoutCompleted` is now derived from `WorkoutSession`/`SetLog` dates.
- `runCompleted` is now derived from `RunLog.date`.

Current UI does not ask every field in the type. It asks date, weight, sleep hours, energy, soreness, stress, steps, alcohol, notes. Hidden/defaulted fields still exist: sleep quality, hunger, motivation, resting HR, HRV, pain, pain location, pain severity, macros hit.

### 2.4 BodyMetric

Required:

- `id: string`
- `userId: string`
- `date: string`
- `weight: number`

Optional:

- `waist?: number`
- `chest?: number`
- `arms?: number`
- `thighs?: number`
- `hips?: number`
- `notes?: string`

Relationships:

- Used by weight trend, weekly review, macro adjustment, and weight dashboard.
- Daily check-in auto-generates a minimal `BodyMetric` with weight only.

### 2.5 ProgressPhoto

Required:

- `id: string`
- `userId: string`
- `date: string`

Optional:

- `frontPhotoUrl?: string`
- `sidePhotoUrl?: string`
- `backPhotoUrl?: string`
- `notes?: string`

Relationships:

- Linked to user by `userId`.
- Not currently used in coaching decisions.

### 2.6 MacroTarget

Required:

- `calories: number`
- `protein: number`
- `carbs: number`
- `fat: number`
- `fiber: number`
- `water: number`

Optional:

- `id?: string`
- `userId?: string`
- `week?: number`
- `proteinMax?: number`

Relationships:

- Weekly macro targets are seeded for 12 weeks.
- Used by daily prescription, nutrition progress, fuel score, adherence, and macro adjustment.

Seeded macro phases:

- Weeks 1-4: 2550 calories, 220 protein, 210 carbs, 70 fat, 30 fiber, 120 water.
- Weeks 5-8: 2450 calories, 220 protein, 180 carbs, 70 fat, 30 fiber, 120 water.
- Weeks 9-11: 2350 calories, 215 protein, 160 carbs, 65 fat, 30 fiber, 120 water.
- Week 12: 2400 calories, 215 protein, 170 carbs, 65 fat, 30 fiber, 120 water.

### 2.7 NutritionLog

Required:

- `id: string`
- `userId: string`
- `date: string`
- `calories: number`
- `protein: number`
- `carbs: number`
- `fat: number`
- `fiber: number`
- `sodium: number`
- `water: number`
- `alcohol: number`
- `notes: string`

Relationships:

- One nutrition log per date is intended in the logger.
- Used by weekly review, adherence, daily prescription, nutrition progress, and fuel score.

### 2.8 Meal and MealItem

Meal required:

- `id: string`
- `userId: string`
- `date: string`
- `category: MealCategory`
- `name: string`
- `calories: number`
- `protein: number`
- `carbs: number`
- `fat: number`
- `fiber: number`
- `sodium: number`
- `water: number`
- `notes: string`
- `items: MealItem[]`

MealItem required:

- `id: string`
- `mealId: string`
- `name: string`
- `calories: number`
- `protein: number`
- `carbs: number`
- `fat: number`
- `fiber: number`
- `sodium: number`
- `water: number`
- `notes: string`

Relationships:

- Meal items belong to meals through `mealId`.
- `calculateMealTotals()` can aggregate meals into a `NutritionLog`.
- Current main UI emphasizes direct nutrition logging, not meal-level logging.

### 2.9 FoodScanResult and FoodScanLog

FoodScanResult required:

- `id: string`
- `mode: "Nutrition Label Scan" | "Food Photo Scan"`
- `detectedName: string`
- `servingSize: string`
- `servingsEaten: number`
- `calories: number`
- `protein: number`
- `carbs: number`
- `fat: number`
- `fiber: number`
- `sodium: number`
- `confidence: number`
- `provider: string`
- `isMock: boolean`

FoodScanResult optional:

- `servingsPerContainer?: string`
- `foodsDetected?: string[]`
- `portionEstimate?: string`
- `sugar?: number`
- `confidenceLevel?: "High" | "Medium" | "Low"`

FoodScanLog required:

- `id: string`
- `userId: string`
- `date: string`
- `mode: ScanMode`
- `imageName: string`
- `imagePreviewUrl: string`
- `result: FoodScanResult`
- `status: "reviewed" | "confirmed" | "discarded"`
- `provider: string`
- `isMock: boolean`
- `notes: string`

FoodScanLog optional:

- `selectedMealId?: string`

Relationships:

- Food scan can convert to `MealItem`.
- Not currently central in visible UI flow inspected here.

### 2.10 RunLog

Required:

- `id: string`
- `userId: string`
- `date: string`
- `plannedDistance: number`
- `actualDistance: number`
- `durationMinutes: number`
- `averagePace: number`
- `averageHr: number`
- `maxHr: number`
- `rpe: number`
- `zone2Compliance: number`
- `completed: boolean`
- `pain: boolean`
- `painLocation: string`
- `notes: string`

Optional:

- `runType?: "easy" | "speed" | "tempo" | "long run" | "race"`
- `walkBreaks?: boolean`
- `painScore?: number`

Relationships:

- Used by running trends, running recommendation, daily completion status, weekly review, and pain flags.
- One run per date is intended in `saveRunLoggerEntry()`.

### 2.11 Workout

Required:

- `id: string`
- `week: number`
- `phase: string`
- `day: string`
- `dayIndex: number`
- `title: string`
- `type: string`
- `notes: string`
- `exercises: Exercise[]`

Optional:

- `userId?: string`
- `finisher?: string`
- `deload?: boolean`
- `longRunMiles?: number`

Relationships:

- Seeded for 12 weeks × 7 days.
- Workout exercises become active session targets.
- `WorkoutSession.workoutId` references `Workout.id`.

### 2.12 Exercise

Required:

- `id: string`
- `workoutId: string`
- `name: string`
- `prescribedSets: number`
- `prescribedReps: string`
- `category: string`
- `order: number`

Optional:

- `prescribedWeight?: number`
- `prescribedRpe?: number`

Relationships:

- Belongs to a workout by `workoutId`.
- Referenced by `SetLog.exerciseId` and recommendations.

### 2.13 ExerciseLog

Required:

- `setsCompleted: number`
- `repsCompleted: number`
- `weightUsed: number`
- `rpe: number`
- `pain: boolean`

Optional:

- `id?: string`
- `userId?: string`
- `exerciseId?: string`
- `date?: string`
- `restTime?: number`
- `notes?: string`

Relationships:

- Used by `recommendProgression()` but not the primary active workout logger.

### 2.14 WorkoutSession

Required:

- `id: string`
- `userId: string`
- `workoutId: string`
- `workoutTitle: string`
- `mode: AppMode`
- `startedAt: string`
- `status: "active" | "completed" | "ended"`
- `currentExerciseIndex: number`
- `currentSetNumber: number`
- `setLogs: SetLog[]`

Optional:

- `endedAt?: string`
- `coachDecisions?: CoachDecision[]`

Relationships:

- Contains embedded `SetLog[]`.
- Also duplicated to global `state.setLogs` when active training logs a set.
- Referenced by summaries and recommendations.

### 2.15 SetLog

Required:

- `id: string`
- `sessionId: string`
- `userId: string`
- `workoutId: string`
- `exerciseId: string`
- `exerciseName: string`
- `setNumber: number`
- `targetReps: string`
- `targetRpe: number`
- `weightUsed: number`
- `repsCompleted: number`
- `rpe: number`
- `pain: boolean`
- `formQuality: "solid" | "minor breakdown" | "missed"`
- `completedAt: string`

Optional:

- `coachDecision?: CoachDecision`
- `notes?: string`

Relationships:

- Belongs to workout session by `sessionId`.
- Belongs to workout/exercise by IDs.
- Drives next-set recommendations, post-workout analysis, and starting-weight history.

### 2.16 CoachDecision

Required:

- `exerciseId: string`
- `action: "increase" | "repeat" | "reduce" | "stop" | "substitute"`
- `message: string`
- `nextWeight: number`
- `nextReps: string`
- `targetRpe: number`
- `restSeconds: number`
- `reason: string`
- `cue: string`

Optional:

- `id?: string`
- `sessionId?: string`
- `setLogId?: string`
- `createdAt?: string`
- `recommendedWeight?: number`

Relationships:

- Attached to `SetLog`.
- Important decisions are mirrored to `PlanAdjustment` records.

### 2.17 WorkoutSummary

Required:

- `sessionId: string`
- `workoutId: string`
- `workoutTitle: string`
- `completedAt: string`
- `completionPercentage: number`
- `exercisesCompleted: number`
- `totalExercises: number`
- `totalSets: number`
- `prescribedSets: number`
- `totalReps: number`
- `prescribedReps: number`
- `estimatedVolume: number`
- `highRpeFlags: SetLog[]`
- `missedRepFlags: SetLog[]`
- `painFlags: SetLog[]`
- `poorFormFlags: SetLog[]`
- `bestSets: SetLog[]`
- `coachSummary: string`
- `nextSessionRecommendations: PostWorkoutRecommendation[]`

Optional:

- `id?: string`

Relationships:

- Summarizes a workout session.
- Generates post-workout recommendations.

### 2.18 PostWorkoutRecommendation

Required:

- `sessionId: string`
- `workoutId: string`
- `action: "progress" | "repeat" | "reduce" | "substitute" | "reduce-volume"`
- `message: string`
- `reason: string`
- `createdAt: string`

Optional:

- `id?: string`
- `exerciseId?: string`
- `exerciseName?: string`

Relationships:

- Stored in `state.postWorkoutRecommendations`.
- `generateDailyPrescription()` uses non-progress recommendations for the same workout to flag poor previous workouts.

### 2.19 DailyPrescription

Required:

- `date: string`
- `readinessStatus: ReadinessStatus`
- `readinessScore: number`
- `trainingDecision: "Full workout" | "Modified workout" | "Recovery replacement"`
- `exactWorkoutRecommendation: string`
- `workoutModifications: string[]`
- `cardioRecommendation: string`
- `nutritionTarget: string`
- `waterTarget: string`
- `stepsTarget: string`
- `recoveryTasks: string[]`
- `warnings: string[]`
- `explanation: string[]`

Optional:

- `id?: string`

Relationships:

- Computed, not stored in `AppState` in the current type.
- Can trigger `PlanAdjustment` records through the page effect.

### 2.20 ReadinessScore

Required:

- `score: number`
- `status: "Green" | "Yellow" | "Red"`
- `reason: string`
- `recommendation: string`

Optional:

- `id?: string`
- `userId?: string`
- `date?: string`

Relationships:

- Computed from latest check-in.
- Drives workout adjustment, daily prescription, running recommendation, and Home UI.

### 2.21 WeeklyReview

Required:

- `userId: string`
- `week: number`
- `avgWeight: number`
- `weightChange: number`
- `waistChange: number`
- `trainingAdherence: number`
- `nutritionAdherence: number`
- `avgSleep: number`
- `avgSteps: number`
- `fatigueScore: number`
- `strengthTrend: PerformanceTrend`
- `runningTrend: PerformanceTrend`
- `transformationScore: number`
- `recommendation: string`

Optional:

- `id?: string`

Relationships:

- This older `WeeklyReview` model is generated by `generateWeeklyReview()`.
- Current UI uses a newer `WeeklyReviewSummary` from `weekly-review.ts`, not this full type.

### 2.22 WeeklyReviewSummary

Defined in `weekly-review.ts`, not `types.ts`.

Required fields:

- `startDate: string`
- `endDate: string`
- `averageWeight: number | null`
- `weightChange: number | null`
- `totalWeeklyMiles: number`
- `longRunCompleted: boolean`
- `liftsCompleted: number`
- `averageCalories: number | null`
- `averageProtein: number | null`
- `averageSleep: number | null`
- `alcoholDays: number`
- `painFlags: string[]`
- `adherenceScore: number`
- `nextWeekRecommendation: "Progress" | "Repeat" | "Deload" | "Recovery focus"`
- `recommendationReason: string`

Relationships:

- Computed from AppState for a date window.
- Not persisted as a first-class state object.

### 2.23 PlanAdjustment

Required:

- `id: string`
- `userId: string`
- `date: string`
- `adjustmentType: string`
- `reason: string`
- `previousValue: string`
- `newValue: string`
- `notes: string`

Optional:

- `category?: CoachDecisionCategory`
- `originalPrescription?: string`
- `adjustedPrescription?: string`
- `triggerData?: string`
- `confidence?: "High" | "Medium" | "Low"`
- `mode?: "automatic" | "manual override"`
- `explanation?: CoachDecisionExplanation`

Relationships:

- Audit log for automatic or manual coach decisions.
- Created for readiness modifications, substitutions, running decisions, set-by-set decisions, and future workout recommendations.

---

## 3. Coaching Engine

The coaching engine is deterministic. It is not currently an LLM planner. It reads local state, applies hard-coded thresholds, and outputs strings, scores, recommendations, and adjustment records.

### 3.1 Readiness scoring: `calculateReadiness()`

Inputs:

- `DailyCheckIn`
- Baseline `{ restingHr: number; hrv: number }`

Logic:

Start with `score = 100`.

Subtract:

- Sleep:
  - `sleepHours < 6` → -20
  - Else `sleepHours < 7` → -10
- Sleep quality:
  - `sleepQuality <= 4` → -10
- Soreness:
  - `soreness >= 8` → -25
  - Else `soreness >= 6` → -10
- Energy:
  - `energy <= 3` → -20
  - Else `energy <= 5` → -10
- Stress:
  - `stress >= 8` → -10
- Resting HR:
  - `restingHr > baseline.restingHr + 8` → -15
- HRV:
  - If baseline HRV > 0 and `hrv < baseline.hrv * 0.8` → -15
- Pain:
  - `pain && painSeverity >= 6` → -35
  - Else `pain && painSeverity >= 4` → -15
- Alcohol:
  - If alcohol and `sleepQuality <= 5` → -15
  - Else if alcohol → -5

Safety override:

- If significant pain exists (`pain && painSeverity >= 6`), final score is capped at 59.

Status thresholds:

- `score >= 80` → Green
- `score >= 60` and `< 80` → Yellow
- `< 60` → Red

Outputs:

- `ReadinessScore.score`
- `ReadinessScore.status`
- Reason string
- Recommendation string:
  - Green: complete planned workout; progress if form solid and RPE <= 8.
  - Yellow: reduce volume 10-25%, avoid max effort, easy Zone 2.
  - Red: no heavy lifting/sprinting/hard intervals; recovery replacement.

### 3.2 Daily check-in recovery status: `evaluateDailyRecoveryStatus()`

This is separate from `calculateReadiness()` and uses different thresholds.

Inputs:

- `DailyCheckIn`

Red rules:

- `sleepHours < 5`
- `soreness >= 8`
- `stress >= 5`
- `energy <= 1`
- `pain && painSeverity >= 7`

If any Red reason exists:

- Status = Red
- Recommendation = prioritize recovery, mobility, walking only.

Yellow rules, only checked if not Red:

- `sleepHours >= 5 && sleepHours < 6.5`
- `soreness >= 6 && soreness <= 7`
- `stress === 4`
- `energy === 2`
- `pain && painSeverity >= 4 && painSeverity <= 6`
- `alcohol === true`

If any Yellow reason exists:

- Status = Yellow
- Recommendation = modify today’s training dose.

Otherwise:

- Status = Green
- Recommendation = follow plan as written.

Outputs:

- `DailyRecoveryStatus.status`
- `recommendation`
- `reasoning`
- `reasons[]`

Technical issue:

- This daily-check-in status can disagree with `calculateReadiness()` because stress, sleep, energy, and pain thresholds differ.

### 3.3 Weight trend: `calculateWeightTrend()`

Inputs:

- `BodyMetric[]`

Logic:

1. Filter entries with numeric weight.
2. Sort by date ascending.
3. `last7 = last 7 metrics`.
4. `prev7 = metrics from -14 to -7`.
5. `current7DayAverage = round1(avg(last7 weights))`.
6. `previous7DayAverage = round1(avg(prev7 weights))`.
7. `change14Day = previous7DayAverage ? round1(current7DayAverage - previous7DayAverage) : 0`.
8. `weeklyLossRate = -change14Day`.
9. Latest waist = latest metric with waist.
10. Previous waist = latest waist before last seven metrics, fallback latest waist.
11. `waistChange = latestWaist - previousWaist`.

Outputs:

- `current7DayAverage`
- `previous7DayAverage`
- `change14Day`
- `weeklyLossRate`
- `waistChange`

### 3.4 Weight-loss macro adjustment: `recommendMacroAdjustment()`

Inputs:

- `currentCalories`
- `weightChange14Day`
- `weeklyLossRate`
- `waistChange`
- `nutritionAdherence`
- `trainingAdherence`
- `energy`
- `hunger`
- `sleep`
- `performanceTrend`
- `upcomingWorkoutType`

Logic:

1. If `nutritionAdherence < 80`:
   - Action: improve adherence first.
   - Calories unchanged.
2. Else if `weightChange14Day >= -0.2 && waistChange >= -0.1 && nutritionAdherence >= 85`:
   - Action: reduce calories.
   - `newCalories = currentCalories - 175`.
   - `carbDelta = -35`.
   - Reason: 14-day average weight and waist stalled with good adherence.
3. Else if `weeklyLossRate > 2 && energy <= 5 && sleep < 7 && performanceTrend === "declining"`:
   - Action: increase calories.
   - `newCalories = currentCalories + 150`.
   - `carbDelta = 35`.
4. Else if upcoming workout type matches `/lower|long-run|run|athletic/i`:
   - Action: move carbs around workouts.
   - Calories unchanged.
   - `carbDelta = 40`.
5. Else if `energy <= 4 && performanceTrend === "declining" && nutritionAdherence >= 85`:
   - Action: add optional refeed.
   - `newCalories = currentCalories + 250`.
   - `carbDelta = 60`.
6. Else:
   - Keep calories.

Outputs:

- Action string
- New calories
- Carb delta
- Reason

### 3.5 Workout readiness adjustment: `recommendWorkoutAdjustment()`

Inputs:

- Readiness status
- Soreness
- Pain
- Pain location
- Pain severity
- Missed reps
- Upcoming workout type

Logic:

- Generate substitutions if pain exists:
  - Shoulder: replace dips, overhead press; reduce pressing volume.
  - Knee: replace running with bike/elliptical; replace lunges; reduce jumps.
  - Back: replace deadlift; reduce axial loading; avoid high-fatigue circuits.
  - Achilles/calf: reduce sprints; use bike/rower; non-impact Zone 2.
  - Other: avoid painful movement and choose pain-free variation.
- If Red readiness or pain severity >= 6:
  - Action: Zone 2 only or full rest.
  - Volume multiplier 0.
  - Load multiplier 0.
  - Skip finisher.
- Else if Yellow:
  - Action: reduce volume 10-25% and avoid max effort.
  - Volume multiplier 0.8.
  - Load multiplier 0.9 if missed reps, else 1.
  - Skip finisher.
- Else Green:
  - Full workout.
  - Volume/load multipliers 1.
  - Do not skip finisher.

Outputs:

- Action
- Volume multiplier
- Load multiplier
- Skip finisher
- Substitutions
- Reason

Note: this function exists but the main visible training adjustment path uses `adjustWorkoutForReadiness()` and `generateDailyPrescription()` more directly.

### 3.6 Basic exercise progression: `recommendProgression()`

Inputs:

- Exercise name
- Category
- Prescribed sets
- Prescribed reps
- Previous weight
- `ExerciseLog`

Logic:

1. `targetReps = first number in prescribedReps × prescribedSets`.
2. `completed = setsCompleted >= prescribedSets && repsCompleted >= targetReps && !pain`.
3. `upper = category.includes("upper")`.
4. Increment:
   - Upper: 5 lb
   - Other: 10 lb
5. If completed and RPE <= 8:
   - Increase previous weight by increment.
6. If completed and RPE >= 9:
   - Repeat same weight.
7. If pain:
   - Reduce to `round(previousWeight × 0.9)`.
8. Else:
   - Reduce to `round(previousWeight × 0.95)`.

Outputs:

- Next weight
- Recommendation string

### 3.7 Next-set coaching: `generateNextSetRecommendation()`

Inputs:

- `SetLog`
- Readiness status

Derived values:

- `targetRepCount = first number from targetReps`
- `hitTargetReps = repsCompleted >= targetRepCount`
- `sameWeight = roundToNearestFive(weightUsed)`
- `reducedWeight = roundToNearestFive(weightUsed × 0.95)`
- `increasedWeight = roundToNearestFive(weightUsed + 5)`
- `targetRpe = min(setLog.targetRpe, readiness Yellow ? 7 : 8)`

Logic order:

1. If readiness Red:
   - Action: stop.
   - Next weight: 0.
   - Rest: 300 sec.
2. If pain:
   - Action: stop.
   - Next weight: 0.
   - Rest: 180 sec.
3. If form quality missed or minor breakdown:
   - Action: reduce.
   - Next weight: reducedWeight.
   - Rest: 180 sec.
4. If target reps missed:
   - Action: reduce.
   - Next weight: reducedWeight.
   - Rest: 180 sec.
5. If RPE >= 9:
   - Action: reduce.
   - Next weight: reducedWeight.
   - Rest: 180 sec.
6. If RPE > 7 and <= 8:
   - Action: repeat.
   - Next weight: sameWeight.
   - Rest: Yellow 150 sec, otherwise 120 sec.
7. If readiness Yellow:
   - Action: repeat.
   - Next weight: sameWeight.
   - Rest: 150 sec.
8. Else:
   - Action: increase.
   - Next weight: increasedWeight.
   - Rest: 120 sec.

Outputs:

- `CoachDecision`

### 3.8 Post-workout analysis: `generatePostWorkoutAnalysis()`

Inputs:

- `WorkoutSession`
- `Workout`
- Optional completedAt

Logic:

1. Compute prescribed sets and reps from workout.
2. Compute actual total reps and estimated volume.
3. `completionPercentage = totalReps / prescribedReps × 100`, clamped 0-100.
4. Build flags:
   - High RPE: set RPE >= 9.
   - Missed reps: reps completed < first target rep number.
   - Pain: pain true.
   - Poor form: formQuality not solid.
5. For each exercise:
   - If any pain: recommend substitute.
   - Else if missed reps or poor form: recommend reduce.
   - Else if high RPE: recommend repeat.
   - Else if all work clean and every RPE <= 8: recommend progress.
   - Else mixed: repeat.
6. If 2+ poor-form flags:
   - Add reduce-volume recommendation.
7. Coach summary priority:
   - Pain > missed reps > high RPE > multiple form flags > progress.

Outputs:

- `WorkoutSummary`

### 3.9 Running progression: `generateRunningRecommendation()`

Inputs:

- `runLogs`
- `nextDayReadiness`
- `plannedDistance`
- `runType`
- `currentWeeklyMileage`
- `previousWeeklyMileage`

Logic:

1. Sort run logs by date.
2. If no latest run:
   - Hold planned distance until baseline run exists.
3. Determine:
   - `isLongRun = runType includes long OR plannedDistance >= 5`
   - `weeklyIncrease = ((currentWeeklyMileage - previousWeeklyMileage) / previousWeeklyMileage) × 100`, or 0 if previous is 0.
   - `paceHrWorsened = previous exists && latest.averagePace > previous.averagePace + 0.3 && latest.averageHr > previous.averageHr + 8`
   - `poorRun = !completed || rpe > 6 || zone2Compliance < 75 || paceHrWorsened`
   - `previousPoorRun = previous exists && (!completed || rpe > 6 || zone2Compliance < 75)`
   - `longRunReference = latest long run if long-run context`
   - `longRunFailed = long run incomplete or actualDistance < plannedDistance × 0.9`
4. If latest pain or next-day readiness Red:
   - Regress to 0 miles.
   - Replace with walking/mobility.
5. If two poor runs or long-run failed:
   - Regress to `max(1, round(plannedDistance × 0.8 to nearest 0.5))`.
6. If poor run OR readiness Yellow OR weekly increase > 10%:
   - Hold planned distance.
7. Else:
   - Progress:
     - Long run: planned + 1 mile.
     - Other: planned + 0.5 mile.
     - Rounded to nearest 0.5.

Outputs:

- Action: Progress / Hold / Regress
- Recommended distance
- Message
- Reasons
- Warnings

### 3.10 Run logger decision: `evaluateRunLoggerResult()`

Inputs:

- `RunLog`

Logic:

- `painScore = run.painScore ?? (run.pain ? 7 : 0)`.
- If painScore >= 7:
  - Decision: deload.
- Else if not completed OR RPE >= 8 OR walk breaks OR painScore >= 4:
  - Decision: repeat.
- Else:
  - Decision: progress.

Outputs:

- Run summary
- Next run decision
- Recommendation
- Pain warning
- Reasons

### 3.11 Injury detection: `detectInjuryRisk()`

Inputs:

- `DailyCheckIn`

Logic:

- Pain and severity >= 6 → High risk.
- Pain and severity >= 4 → Moderate risk.
- Else Low.

Outputs:

- Level
- Recommendation

### 3.12 Weekly review logic: `buildWeeklyReviewSummary()`

Inputs:

- `AppState`
- Weekly window `{ startDate, endDate }`

Metrics:

- `averageWeight = average(bodyMetrics weights in window)`
- `weightChange = last weight - first weight`, null if fewer than 2 weights
- `totalWeeklyMiles = sum actualDistance for completed runs`
- `longRun = first run with type long run OR plannedDistance >= 5 OR actualDistance >= 5`
- `longRunCompleted = longRun.completed && actualDistance > 0 && painScore < 7`
- `liftsCompleted = completed workout sessions in window`
- `averageCalories = average nutrition calories`
- `averageProtein = average nutrition protein`
- `averageSleep = average check-in sleep hours`
- `alcoholDays = max(check-in alcohol days, nutrition logs with alcohol > 0)`
- `painFlags` from check-ins with pain or severity >= 4, plus run logs with pain or painScore >= 4

Adherence score:

- `calorieAdherence(logs)`:
  - A day is adherent if calories are between 1980 and 2860.
  - Score = adherent days / nutrition logged days × 100.
- Nutrition score:
  - If nutrition logs exist: `(calorieAdherence + min(100, averageProtein / 220 × 100)) / 2`.
  - Else 0.
- Sleep score:
  - `min(100, averageSleep / 7 × 100)`.
- Lift score:
  - `min(100, completed workout sessions / 4 × 100)`.
- Run score:
  - Long run completed → 100
  - Else any run logs → 70
  - Else 0
- Pain penalty:
  - If any pain flag text contains 7/10 through 10/10 → -25.
- Final adherence:
  - `max(0, round((nutritionScore + sleepScore + liftScore + runScore) / 4 - painPenalty))`.

Recommendation priority:

1. High pain flag 7-10/10:
   - `Recovery focus`
2. Poor recovery:
   - If average sleep < 6 OR average soreness >= 7.5:
   - `Deload`
3. Long run missed:
   - `Repeat`
4. Strong progression criteria:
   - Long run exists
   - Long run RPE <= 7
   - No long-run pain
   - painScore < 4
   - lifts completed >= 3
   - adherence score >= 80
   - `Progress`
5. If alcohol days >= 2 or adherence < 70:
   - `Repeat`
6. Default:
   - `Repeat`

Outputs:

- `WeeklyReviewSummary`

### 3.13 Daily prescription: `generateDailyPrescription()`

Inputs:

- Readiness
- Check-in
- Workout
- Macro target
- Nutrition logs
- Body metrics
- Training adherence
- Post-workout recommendations
- Optional running recommendation
- Optional date

Logic:

1. Calculate nutrition adherence from last 7 nutrition logs and macro target.
2. Calculate 14-day weight trend.
3. Recommend macro adjustment.
4. Identify poor previous workout if non-progress recommendations exist for this workout.
5. Identify whether workout is running/cardio.
6. Start with full workout recommendation.
7. If readiness Red or pain severity >= 6:
   - Training decision = Recovery replacement.
   - Do not lift heavy.
   - Cardio = 20-40 min easy walk or Zone 2 only if symptoms improve.
8. Else if readiness Yellow:
   - Training decision = Modified workout.
   - Reduce volume 10-25%, cap RPE at 7, skip max-effort sets.
   - Cardio conversational only.
9. Else Green:
   - No readiness modifications.
10. If running recommendation exists and workout is running and readiness not Red:
   - Replace cardio recommendation with running recommendation.
11. If running recommendation exists and readiness Red:
   - Store it as future guidance but keep recovery-only cardio.
12. If pain exists:
   - Add pain-specific substitutions and warnings.
13. If poor previous workout exists:
   - Add prior recommendation messages.
14. Nutrition target:
   - Default macro target.
   - If nutrition adherence < 80: improve adherence first.
   - Else if macro adjustment says reduce calories: lower calories or increase steps; steps target becomes 12,000.
   - Else if move carbs around workouts: move 40g carbs around workout.
15. Recovery tasks depend on readiness status.

Outputs:

- `DailyPrescription`

---

## 4. Daily Check-In Logic

### 4.1 Current questions asked in UI

1. Date
   - Why: identifies the daily record and links to logs by calendar date.
   - Effect: controls upsert key, body metric date, completion derivation date.
2. Weight
   - Why: tracks fat-loss trend.
   - Effect: creates BodyMetric; affects weight trend, weekly review, macro adjustment.
3. Sleep hours
   - Why: recovery readiness.
   - Effect:
     - `evaluateDailyRecoveryStatus`: Red if <5, Yellow if 5-6.5.
     - `calculateReadiness`: -20 if <6, -10 if <7.
     - Weekly review average sleep and Deload if weekly average <6.
4. Energy 1-10
   - Why: subjective fatigue/readiness.
   - Effect:
     - `evaluateDailyRecoveryStatus`: Red if <=1, Yellow if exactly 2.
     - `calculateReadiness`: -20 if <=3, -10 if <=5.
5. Soreness 1-10
   - Why: muscular recovery and overuse proxy.
   - Effect:
     - `evaluateDailyRecoveryStatus`: Red if >=8, Yellow if 6-7.
     - `calculateReadiness`: -25 if >=8, -10 if >=6.
     - Weekly review Deload if average soreness >=7.5.
6. Stress 1-10
   - Why: systemic recovery proxy.
   - Effect:
     - `evaluateDailyRecoveryStatus`: Red if >=5, Yellow if exactly 4.
     - `calculateReadiness`: -10 only if >=8.
7. Yesterday’s Steps
   - Why: activity and NEAT signal.
   - Effect:
     - Current daily prescription does not directly use check-in steps except through older `generateWeeklyReview()` transformation score.
     - Weekly review summary currently does not include steps.
     - UI note says future Apple Health/wearable auto-population.
8. Alcohol yesterday
   - Why: recovery and adherence risk.
   - Effect:
     - `evaluateDailyRecoveryStatus`: Yellow if true.
     - `calculateReadiness`: -5 or -15 if sleep quality <=5.
     - Weekly review counts alcohol days and repeats if >=2.
9. Notes
   - Why: free-text context.
   - Effect: currently not parsed by coaching logic.

### 4.2 Fields in `DailyCheckIn` not currently asked in UI

These still exist in the model and are defaulted from latest entry/fallback:

- `sleepQuality`
- `hunger`
- `motivation`
- `restingHr`
- `hrv`
- `pain`
- `painLocation`
- `painSeverity`
- `macrosHit`

These can affect coaching if present, but the current check-in UI does not expose them directly. This means the engine may use stale/default values for important recovery and injury signals.

### 4.3 Redundant or inferable fields

Already redundant and now inferred:

- `workoutCompleted`
  - Inferred from workout sessions/set logs for the date.
- `runCompleted`
  - Inferred from run logs for the date.

Could be inferred automatically in future:

- `steps`
  - Apple Health / wearable.
- `sleepHours`
  - Apple Health / wearable.
- `sleepQuality`
  - Sleep stages or wearable sleep score.
- `restingHr`
  - Apple Health / wearable.
- `hrv`
  - Apple Health / wearable.
- `weight`
  - Smart scale.
- `alcohol`
  - Could be inferred only if nutrition/alcohol logging is reliable; not from wearables.
- `macrosHit`
  - Can be calculated from `NutritionLog` and target; manual boolean is redundant.

### 4.4 Current daily check-in contradictions

- The UI check-in preview uses `evaluateDailyRecoveryStatus()`.
- The Home/Train readiness uses `calculateReadiness()`.
- These engines have materially different thresholds.
- Example: stress 5 is Red in the check-in preview, but only -0 in `calculateReadiness()` unless stress >= 8.
- Example: sleep 6.2 is Yellow in daily check-in but only -10 in `calculateReadiness()` and may still be Green depending other markers.

---

## 5. Workout Engine

### 5.1 How workouts are selected

Workouts are seeded in `src/lib/seed-data.ts`.

Structure:

- 12 weeks.
- 7 days per week.
- Day index:
  - 0 Monday: upper strength + sprints/core.
  - 1 Tuesday: lower strength.
  - 2 Wednesday: Zone 2 + mobility + core.
  - 3 Thursday: upper hypertrophy/density.
  - 4 Friday: athletic conditioning.
  - 5 Saturday: long run.
  - 6 Sunday: recovery.

Phases:

- Weeks 1-4: Phase 1 — Foundation.
- Weeks 5-8: Phase 2 — Performance Build.
- Weeks 9-12: Phase 3 — Lean-Out Athletic Peak.

Deload weeks:

- Weeks 4, 8, 12.
- Seed logic reduces non-conditioning/non-recovery exercise sets to approximately 65% via `Math.floor(sets * 0.65)` with minimum 1.
- Notes include deload instructions.

Selection:

- `getWorkoutForWeekDay(selectedWeek, selectedDay)` returns matching workout, fallback first workout.
- UI allows manual selection of week/day.
- There is no automatic date-to-week/day progression enforcement in the inspected UI.

### 5.2 How readiness modifies workouts

`adjustWorkoutForReadiness(workout, status)`:

- Green:
  - Return workout unchanged.
- Yellow:
  - Title suffix `— Modified`.
  - Notes append reduce volume 10-25%, skip max-effort.
  - Finisher becomes easy incline walk/bike.
  - Each exercise sets = `max(1, floor(originalSets × 0.8))`.
- Red:
  - Title becomes `Recovery Replacement`.
  - Notes say walking, mobility, easy Zone 2, or full rest.
  - Finisher = no finisher.
  - Exercises = empty array.

### 5.3 How progression occurs

There are three layers:

1. Set-by-set progression inside active workout:
   - `generateNextSetRecommendation()`.
2. Post-workout exercise-level recommendation:
   - `generatePostWorkoutAnalysis()`.
3. Manual workout logger progression:
   - `evaluateWorkoutLoggerResult()`.

### 5.4 How weights increase

Active set-by-set:

- If Green, no pain, solid form, target reps hit, RPE <= 7:
  - Increase next set by +5 lb rounded to nearest 5.
- If RPE >7 and <=8:
  - Repeat same weight.
- If Yellow:
  - Repeat same weight even if easy.

Basic exercise-level progression:

- If all sets/reps completed, no pain, RPE <=8:
  - Upper category → +5 lb.
  - Other category → +10 lb.

Manual workout logger:

- If all logged sets completed, RPE <=8, no pain, completed workout:
  - Recommends 5-10 lb barbell or 2.5-5 lb dumbbell increase in text.
  - Does not calculate/store exact next weight.

### 5.5 How RPE affects progression

- Active next-set:
  - RPE >=9 → reduce by 5% rounded to nearest 5.
  - RPE >7 and <=8 → repeat weight.
  - RPE <=7 on Green → increase +5 lb.
  - Yellow caps target RPE at 7 and blocks increases.
- Post-workout:
  - Any set RPE >=9 creates high-RPE flag and repeat recommendation.
  - Clean progress requires all sets RPE <=8.
- Manual logger:
  - Any set RPE >8 causes repeat recommendation.

### 5.6 How soreness affects progression

- `calculateReadiness()` reduces readiness for soreness:
  - >=8: -25
  - >=6: -10
- `evaluateDailyRecoveryStatus()`:
  - >=8 Red
  - 6-7 Yellow
- Manual workout logger:
  - Soreness >=8 triggers volume warning.
  - Soreness >=9, or soreness >=8 plus sleep <6, triggers 30% volume reduction.
  - Otherwise high soreness triggers 20% volume reduction.
- Active set-by-set progression does not directly read soreness; it reads readiness status.

### 5.7 How missed workouts affect progression

Current behavior is limited:

- Weekly review:
  - Lifts completed contributes to adherence.
  - Progress requires lifts completed >=3.
- `trainingAdherence` uses check-ins’ `workoutCompleted` values over last 7 days.
- Missed workouts do not automatically reschedule the next workout.
- Missed workouts do not directly adjust the selected week/day.
- Manual workout logger `completed = false` stores session status `ended`, causing repeat recommendation.

### 5.8 Workout engine pseudocode

```pseudo
on app render:
  latestCheckIn = last check-in
  readiness = calculateReadiness(latestCheckIn, baseline)
  workout = getWorkoutForWeekDay(selectedWeek, selectedDay)
  adjustedWorkout = adjustWorkoutForReadiness(workout, readiness.status)

adjustWorkoutForReadiness(workout, status):
  if status == Green:
    return workout
  if status == Yellow:
    return workout with title modified, finisher softened, sets = floor(sets * 0.8)
  if status == Red:
    return recovery replacement with no exercises

startWorkout():
  create WorkoutSession(status = active if exercises exist else completed)
  append to state.workoutSessions

completeSet():
  create SetLog from user input
  decision = generateNextSetRecommendation(setLog, readinessStatus)
  setLog.coachDecision = decision
  nextSession = getNextWorkoutStep(session, workout, setLog)
  persist session and set log
  if decision important:
    create PlanAdjustment
  if session still active:
    start rest timer(decision.restSeconds)

nextSetRecommendation(set, readiness):
  if readiness == Red: stop
  else if pain: stop
  else if form not solid: reduce weight 5%
  else if missed reps: reduce weight 5%
  else if RPE >= 9: reduce weight 5%
  else if 7 < RPE <= 8: repeat same weight
  else if readiness == Yellow: repeat same weight
  else: increase weight +5 lb

on workout completed:
  summary = generatePostWorkoutAnalysis(session, workout)
  store summary
  store next-session recommendations
  store adjustment log
```

---

## 6. Running Engine

### 6.1 How runs are selected

There are two different mechanisms:

1. Training plan:
   - Wednesday is Zone 2 run/mobility.
   - Saturday is long run.
   - Long-run mileage is seeded by week:
     - Week 1: 3
     - Week 2: 4
     - Week 3: 5
     - Week 4: 4
     - Week 5: 6
     - Week 6: 7
     - Week 7: 8
     - Week 8: 6
     - Week 9: 9
     - Week 10: 10
     - Week 11: 11
     - Week 12: 8
2. Log screen run logger:
   - Always receives `plannedDistance={3}` from `LogScreen`, regardless of selected training week/day.
   - User can manually change it.

### 6.2 How long-run progression works

Seed plan:

- Long-run progression is pre-scripted with deload weeks.
- It reaches 11 miles by week 11, then deloads to 8 miles in week 12.

Running recommendation:

- For long-run context, a clean run can increase next planned distance by 1 mile.
- A failed long run regresses to 80% of planned distance, rounded to nearest 0.5, minimum 1.
- Missing or poor long run causes weekly review to recommend Repeat.

### 6.3 How pace recommendations work

Current pace logic is weak.

- Run logger records average pace.
- `calculateRunTrends()` stores pace trend from recent runs.
- `buildRunTrendCards()` says pace is faster if latest pace delta < 0.
- `generateRunningRecommendation()` only uses pace when combined with heart rate:
  - If latest average pace is more than 0.3 min/mi slower than previous and HR is >8 bpm higher, pace/HR worsened.
- There is no explicit target pace model for 9:00/mile.
- There are no tempo/threshold pace zones.
- There is no race pace workout generator.

### 6.4 How heart rate is used

- Run logger records average heart rate and sets max HR equal to average HR.
- Zone 2 compliance is not calculated from HR. It is inferred from RPE:
  - RPE <=6 → 85
  - RPE 7 → 75
  - RPE >=8 → 60
- Running recommendation uses HR only in `paceHrWorsened`:
  - Latest pace slower by >0.3 min/mi AND latest average HR > previous average HR + 8.

### 6.5 How RPE is used

- Run logger decision:
  - RPE >=8 → repeat next run.
- Running recommendation:
  - RPE >6 makes latest run poor for progression.
  - RPE <=6 contributes to progression reasons.
- Weekly review:
  - Progress requires long run RPE <=7.

### 6.6 How missed runs are handled

- Run log `completed = distance > 0 && duration > 0`.
- `generateRunningRecommendation()` treats incomplete latest run as poor.
- Two poor runs regress next distance.
- Long-run incomplete or <90% planned distance causes regression.
- Weekly review repeats if long run was not completed.
- No automatic rescheduling exists.

### 6.7 How race preparation is handled

Existing race preparation:

- Goal displayed: January 17 half marathon.
- Progress screen shows race countdown.
- Seeded 12-week plan includes weekly long runs up to 11 miles.
- Running trends show mileage and pace.

Missing race preparation logic:

- No race date-aware plan periodization beyond a static 12-week seed.
- No target pace workouts for 9:00/mile.
- No threshold/tempo progression.
- No VO2 max or interval prescriptions tied to current pace.
- No taper logic specific to the race date unless week 12 deload happens to align.
- No prediction of half-marathon readiness.

### 6.8 Running engine pseudocode

```pseudo
calculateRunTrends(runLogs):
  sorted = sort by date
  recent = last 8 runs
  longRuns = runs where plannedDistance >= 5 or actualDistance >= 5
  return:
    distanceTrend = recent.actualDistance
    paceTrend = recent.averagePace
    rpeTrend = recent.rpe
    longRunProgression = longRuns.actualDistance
    weeklyMileage = sum actualDistance of recent last 7 run entries

buildRunLoggerRecord(input):
  pace = input.averagePace if provided else duration / distance
  zone2Compliance = 85 if RPE <= 6, 75 if RPE == 7, else 60
  completed = distance > 0 and duration > 0
  pain = painScore > 0

runLoggerDecision(run):
  if painScore >= 7:
    deload
  else if not completed or RPE >= 8 or walkBreaks or painScore >= 4:
    repeat
  else:
    progress

generateRunningRecommendation(logs, readiness, plannedDistance, runType, currentMileage, previousMileage):
  latest = last run
  previous = previous run
  if no latest:
    hold plannedDistance

  weeklyIncrease = percent increase from previous weekly mileage
  paceHrWorsened = latest pace > previous pace + 0.3 and latest HR > previous HR + 8
  poorRun = incomplete or RPE > 6 or zone2Compliance < 75 or paceHrWorsened
  previousPoorRun = previous incomplete or RPE > 6 or zone2Compliance < 75
  longRunFailed = long run incomplete or actual < 90% planned

  if latest pain or readiness == Red:
    regress to 0, replace with walking/mobility
  else if poorRun and previousPoorRun or longRunFailed:
    regress to plannedDistance * 0.8
  else if poorRun or readiness == Yellow or weeklyIncrease > 10%:
    hold plannedDistance
  else:
    progress by +1 mile for long run or +0.5 mile otherwise
```

---

## 7. Nutrition Engine

### 7.1 How calorie targets are assigned

There are two target systems.

#### Seeded weekly macro targets

Used by daily prescription and coaching engine:

- Weeks 1-4: 2550 calories.
- Weeks 5-8: 2450 calories.
- Weeks 9-11: 2350 calories.
- Week 12: 2400 calories.

#### Nutrition logger day-type targets

Used by the nutrition logging UI:

- Training day:
  - 2600 calories
  - 220g protein
  - 250g carbs
  - 65g fat
- Rest day:
  - 2200 calories
  - 220g protein
  - 150g carbs
  - 70g fat

Technical issue:

- The logger targets and weekly macro targets are not the same system. A user can be told one target by daily prescription and see another in nutrition logger.

### 7.2 How protein targets are assigned

- Seeded weekly macro targets:
  - Weeks 1-8: 220g protein, max 230g.
  - Weeks 9-12: 215g protein, max 230g.
- Nutrition logger:
  - 220g protein for both training and rest days.
- Weekly review adherence uses 220g as the denominator.

### 7.3 How weight-loss plateaus are detected

In `recommendMacroAdjustment()`:

- A plateau exists when:
  - `weightChange14Day >= -0.2`
  - AND `waistChange >= -0.1`
  - AND `nutritionAdherence >= 85`

Meaning:

- Current 7-day average weight is down less than 0.2 lb versus previous 7-day average.
- Waist is down less than 0.1.
- Nutrition adherence is high enough to trust the data.

### 7.4 How calorie adjustments are made

- If adherence <80:
  - Do not adjust calories.
- If plateau with adherence >=85:
  - Reduce calories by 175/day or add 2,000 steps.
  - In daily prescription, steps target becomes 12,000.
- If losing >2 lb/week with low energy, sleep <7, declining performance:
  - Increase calories by 150/day, mostly carbs.
- If hard workout upcoming:
  - Move ~40g carbs around workout without changing total calories.
- If energy <=4 with declining performance and high adherence:
  - Add optional +250 calorie refeed, +60g carbs.

### 7.5 Nutrition adherence formulas

`calculateAdherence(logs, target)`:

For each day:

- `calorieScore = 1 - min(abs(calories - targetCalories) / (targetCalories × 0.18), 1)`
- `proteinScore = 1` if protein >= 90% target, else protein / target
- `carbScore = 1 - min(abs(carbs - targetCarbs) / (targetCarbs × 0.35), 1)`
- `fatScore = 1 - min(abs(fat - targetFat) / (targetFat × 0.35), 1)`
- `fiberScore = 1` if fiber >=80% target, else fiber / target
- `alcoholPenalty = 0.08` if alcohol > 0, else 0

Daily score:

```text
(calorieScore × 0.35 + proteinScore × 0.30 + carbScore × 0.15 + fatScore × 0.10 + fiberScore × 0.10 - alcoholPenalty) × 100
```

Final score:

- Average daily score, rounded.

### 7.6 Daily fuel score formula

`calculateDailyFuelScore(log, target)`:

- `calorieAdherence = 1 - min(abs(calories - target) / (targetCalories × 0.15), 1)`
- `proteinProgress = min(protein / targetProtein, 1)`
- `waterProgress = min(water / targetWater, 1)`
- `fiberProgress = min(fiber / targetFiber, 1)`
- `alcoholPenalty = min(alcohol × 8, 20)`

Score:

```text
round((calorieAdherence × 0.35 + proteinProgress × 0.30 + waterProgress × 0.20 + fiberProgress × 0.15) × 100 - alcoholPenalty)
```

Clamped 0-100.

### 7.7 Nutrition engine pseudocode

```pseudo
getMacroTarget(week):
  return seeded macro target for selectedWeek

nutritionLoggerTarget(dayType):
  if training: 2600 cal, 220P, 250C, 65F
  if rest: 2200 cal, 220P, 150C, 70F

saveNutrition(form):
  log = NutritionLog(form)
  state.nutritionLogs = replace any log with same date, append log

calculateAdherence(logs, target):
  for each log:
    calorieScore = 1 - abs(calories - targetCalories) / 18% target window
    proteinScore = full if >= 90% target else partial
    carbScore = 1 - abs(carbs - targetCarbs) / 35% target window
    fatScore = 1 - abs(fat - targetFat) / 35% target window
    fiberScore = full if >= 80% target else partial
    alcoholPenalty = 8 percentage points if alcohol > 0
    dayScore = weighted sum
  return average dayScore

recommendMacroAdjustment(input):
  if nutritionAdherence < 80:
    keep calories, improve adherence first
  else if 14-day weight and waist stalled:
    reduce calories by 175 or add 2000 steps
  else if loss > 2 lb/week and recovery/performance poor:
    add 150 calories, mostly carbs
  else if hard workout upcoming:
    move 40g carbs around workout
  else if low energy and declining performance:
    optional +250 calorie refeed
  else:
    keep calories
```

---

## 8. Readiness Engine

There are two readiness/recovery engines.

### 8.1 Main readiness formula: `calculateReadiness()`

Initial score:

```text
score = 100
```

Deductions:

```text
if sleepHours < 6: score -= 20
else if sleepHours < 7: score -= 10

if sleepQuality <= 4: score -= 10

if soreness >= 8: score -= 25
else if soreness >= 6: score -= 10

if energy <= 3: score -= 20
else if energy <= 5: score -= 10

if stress >= 8: score -= 10

if restingHr > baselineRestingHr + 8: score -= 15

if baselineHrv > 0 and hrv < baselineHrv * 0.8: score -= 15

if pain and painSeverity >= 6: score -= 35
else if pain and painSeverity >= 4: score -= 15

if alcohol:
  if sleepQuality <= 5: score -= 15
  else: score -= 5

if pain and painSeverity >= 6:
  score = min(score, 59)

score = clamp(round(score), 0, 100)
```

Status:

```text
Green: score >= 80
Yellow: score >= 60 and score < 80
Red: score < 60
```

Weighting by factor:

- Sleep hours: up to 20 points.
- Sleep quality: 10 points.
- Soreness: up to 25 points.
- Energy: up to 20 points.
- Stress: 10 points.
- Resting HR: 15 points.
- HRV: 15 points.
- Pain: up to 35 points plus Red cap.
- Alcohol: 5-15 points.

### 8.2 Daily check-in status formula: `evaluateDailyRecoveryStatus()`

This is categorical, not point-based.

Red if any:

```text
sleepHours < 5
soreness >= 8
stress >= 5
energy <= 1
pain && painSeverity >= 7
```

Yellow if no Red and any:

```text
5 <= sleepHours < 6.5
6 <= soreness <= 7
stress == 4
energy == 2
pain && 4 <= painSeverity <= 6
alcohol == true
```

Green otherwise.

### 8.3 Actual system behavior

- Home and Train use `calculateReadiness()`.
- Daily check-in card preview uses `evaluateDailyRecoveryStatus()`.
- Daily prescription uses `calculateReadiness()`.
- Weekly review uses its own sleep/soreness/pain thresholds.

This means there is not one unified readiness engine. There are multiple deterministic recovery heuristics.

---

## 9. Goal Alignment Audit

### 9.1 Goal: Reaching under 200 lb

Supporting logic:

- Tracks weight through daily check-in and body metrics.
- Weight dashboard explicitly measures progress from 233 to 199.9.
- Uses 7-day and 14-day averages to avoid single-day noise.
- Macro targets create a calorie deficit structure.
- Plateau logic reduces calories by 175/day or adds 2,000 steps when weight/waist stall with good adherence.
- Protein is high, supporting lean mass retention during weight loss.
- Weekly review checks average calories, protein, sleep, alcohol, adherence.

Weaknesses:

- Starting weight is inconsistent:
  - `demoUser.startingWeight = 212`, `goalWeight = 196`.
  - Weight dashboard uses hard-coded `startingWeight: 233`, `goalWeight: 199.9`.
- Calorie targets are not individualized by current body weight, expenditure, or rate of loss.
- No adaptive TDEE estimate.
- No explicit weekly target loss range relative to body weight.
- Nutrition logger targets conflict with seeded macro targets.
- Steps are collected but not integrated into weekly review summary or daily calorie decisions except macro-adjustment step text.
- Alcohol affects weekly repeat logic but not calorie accounting beyond nutrition score penalty.

Missing systems:

- Dynamic TDEE estimation from calorie intake and weight trend.
- Unified target source.
- Energy expenditure integration from wearables.
- Automated plateau confirmation requiring enough logged days.
- Diet break/refeed protocol tied to fatigue and adherence.

Audit verdict:

- The app has a reasonable first-pass fat-loss scaffold but is not yet a truly adaptive weight-loss coach.

### 9.2 Goal: Maintaining/building a Greek God physique

Supporting logic:

- High protein targets: 215-220g.
- Workout split emphasizes:
  - Upper strength.
  - Upper hypertrophy.
  - Delts, back, chest, arms.
  - Lower strength enough to maintain/build without dominating recovery.
- Uses RPE and form quality to prevent reckless progression.
- Uses post-workout recommendations for progress/repeat/reduce/substitute.
- Pain substitutions protect continuity.
- Deload weeks exist.

Weaknesses:

- Hypertrophy progression is generic; no per-muscle volume tracking.
- No measurement-based physique logic using waist/chest/arms/shoulders ratio.
- No exercise-specific progression history beyond last successful set weight.
- No mesocycle volume landmarks.
- No automatic adjustment for lagging muscle groups.
- No distinction between strength progression and hypertrophy progression beyond reps/sets in templates.
- No body composition estimate.

Missing systems:

- Muscle-group weekly set volume tracking.
- Progressive overload targets by exercise and rep range.
- Volume adjustment based on soreness, pump/performance, and recovery.
- Physique measurement dashboard.
- Exercise substitution database by goal and equipment.

Audit verdict:

- The static program is aligned with a Greek God aesthetic, but the coaching intelligence does not yet optimize hypertrophy in a granular way.

### 9.3 Goal: Completing a Jan 17 half marathon

Supporting logic:

- Race countdown exists.
- Long runs are programmed weekly.
- Long runs progress to 11 miles in the 12-week seed plan.
- Weekly review requires long run completion before recommending progress.
- Running engine holds/regresses for pain, poor RPE, poor Zone 2 compliance, failed long run, Red readiness, or >10% weekly mileage increase.
- Deload weeks reduce long-run mileage.

Weaknesses:

- Race date is not actually used to generate a calendarized plan.
- If current date is not exactly aligned to the 12-week plan, the static plan may not peak/taper correctly.
- Weekly mileage calculation uses recent last 7 run logs, not calendar week volume.
- Run logger defaults to 3 miles even if the selected plan day is long run.
- No automatic scheduling of missed long runs.
- Longest run is 11 miles, which may be enough to complete but leaves limited margin depending athlete readiness.

Missing systems:

- Race-date-aware plan generation.
- Base-building phase if race is far away.
- Taper phase tied to race date.
- Minimum weekly mileage targets.
- Run frequency progression.
- Long-run fueling/hydration practice.

Audit verdict:

- The app can support completion if the user is already moderately trained and follows the plan, but it is not yet a robust half-marathon training system.

### 9.4 Goal: Running half marathon at approximately 9:00 pace

Supporting logic:

- Average pace is logged.
- Pace trend is displayed.
- Pace/HR deterioration can block progression.
- RPE and walk breaks affect repeat/deload decisions.

Weaknesses:

- No explicit 9:00/mile target logic.
- No threshold pace estimation.
- No interval workouts tied to goal pace.
- No tempo run progression.
- No race-pace segments in long runs.
- No aerobic decoupling metric.
- No predicted finish time.
- No current fitness assessment.

Missing systems:

- 5K/10K/time-trial calibration.
- Goal-pace workout prescriptions.
- Easy/tempo/interval pace zones.
- HR zone calibration.
- Long-run workouts with controlled race-pace blocks.
- Fatigue-adjusted pace targets.

Audit verdict:

- The app is not currently optimized for a 9:00/mile half marathon. It is optimized more for conservative completion and injury avoidance than pace performance.

---

## 10. Contradictions and Conflicts

### 10.1 Two readiness engines can disagree

- `evaluateDailyRecoveryStatus()` and `calculateReadiness()` use different thresholds.
- Stress >=5 is Red in daily check-in preview, but stress only matters at >=8 in main readiness scoring.
- Energy <=3 is a major deduction in main readiness, but daily check-in Red only happens at energy <=1 and Yellow only at exactly 2.
- Pain >=6 caps main readiness to Red, but daily check-in Red requires pain >=7.

Impact:

- User may see one recovery status in the check-in summary and another readiness score in Home/Train.

### 10.2 Nutrition targets conflict

- Weekly macro target for Week 1 is 2550 calories, 220P, 210C, 70F.
- Nutrition logger training target is 2600 calories, 220P, 250C, 65F.
- Rest target is 2200 calories, 220P, 150C, 70F.

Impact:

- A user can be adherent according to one target and off-target according to another.

### 10.3 User starting weight conflicts

- Demo user starts at 212 and goal is 196.
- Progress dashboard uses 233 to 199.9.

Impact:

- Weight progress reporting may contradict user profile data.

### 10.4 Run plan and run logger conflict

- Training plan may show a long run based on selected week/day.
- Log screen run logger always defaults to 3 miles.

Impact:

- User can accidentally log a default 3-mile run instead of the planned long run.

### 10.5 Running recommendation uses synthetic previous weekly mileage

- In `page.tsx`, previousWeeklyMileage is passed as `max(0, runTrends.weeklyMileage - plannedRunDistance)`.
- This is not actual previous week mileage.

Impact:

- The 10% weekly mileage cap can be mathematically unreliable.

### 10.6 Running engine says progress while weekly review says repeat

Possible scenario:

- Latest run is clean, so `generateRunningRecommendation()` says Progress.
- Weekly long run was missed, so `buildWeeklyReviewSummary()` says Repeat.

Impact:

- Daily running recommendation and weekly recommendation can conflict.

### 10.7 Recovery recommendation can conflict with future run recommendation

- `generateDailyPrescription()` handles Red readiness by making cardio recovery-only.
- It may still log that running engine has a future action.

Impact:

- This is mostly handled, but the UI can still display running recommendation text in Train if not carefully contextualized.

### 10.8 Workout completion source changed but old fields remain in model

- `DailyCheckIn.workoutCompleted` and `runCompleted` remain stored fields.
- They are derived at save time now.

Impact:

- Historical records may contain stale completion values until re-saved/migrated.

### 10.9 Pain exists in model but not current check-in UI

- Pain fields affect readiness and substitutions.
- The current check-in UI does not ask pain.

Impact:

- Pain logic may not trigger unless pain was set elsewhere or exists from old state.

### 10.10 Sleep quality, HRV, resting HR affect readiness but are not visible in current check-in UI

- Main readiness uses sleepQuality, restingHr, HRV.
- UI does not collect them now.

Impact:

- Readiness can be based on stale/default biometrics.

### 10.11 Manual workout logger and active workout logger produce different semantics

- Active workout uses actual workout IDs/exercise IDs and set-by-set coach decisions.
- Manual workout logger creates `workoutId = input.id`, not the seeded workout ID.

Impact:

- Post-workout recommendations from manual logs may not connect to future planned workouts.

### 10.12 Weekly review long run picks first long run in window, not necessarily best/latest

- `runLogs.find(...)` returns first matching long run.

Impact:

- If user fails an early long-run attempt then completes another, weekly review may still mark based on the first one.

### 10.13 Weekly mileage is based on last seven run entries, not last seven days

- `calculateRunTrends()` uses `recent.slice(-7)` run logs.

Impact:

- High-frequency or sparse logging distorts weekly mileage.

### 10.14 Deload weeks exist in seed plan but weekly review can also recommend Deload independently

- Seed deload weeks: 4, 8, 12.
- Weekly poor recovery can recommend Deload any week.

Impact:

- Not inherently wrong, but there is no reconciler deciding whether to repeat, deload, or move to a seeded deload week.

### 10.15 No single source of truth for adherence

- `trainingAdherence` from daily check-ins.
- Weekly review adherence from nutrition, sleep, lifts, run, pain.
- Heatmap adherence uses calories, protein, workout completed, macroHit.

Impact:

- Different screens may report different adherence concepts under similar labels.

---

## 11. Missing Features

Top 20 highest-value missing features required for a truly intelligent AI coach, ranked by impact:

1. Unified readiness engine
   - One source of truth for Green/Yellow/Red across check-in, Home, Train, weekly review, and prescriptions.
2. Unified target system
   - One macro/calorie target source used by daily prescription, nutrition logger, adherence, and weekly review.
3. Wearable/Apple Health integration
   - Auto-populate steps, sleep, HRV, resting HR, workouts, runs, HR zones.
4. Race-date-aware half-marathon planner
   - Calendarized training phases, long runs, deloads, taper, missed-run recovery.
5. Goal-pace running engine
   - Explicit 9:00/mile target workouts, threshold/tempo intervals, race pace segments, predicted finish.
6. Dynamic TDEE and calorie adaptation
   - Estimate maintenance from intake and weight trend, then adjust deficit intelligently.
7. Per-exercise progression database
   - Store current training max/working weights, rep PRs, progression history, and next targets.
8. Muscle-group volume tracking
   - Weekly sets by chest/back/delts/arms/legs/core with volume adjustment.
9. Injury/pain workflow
   - Pain location, severity, onset, trend, movement restrictions, return-to-run/lift protocol.
10. Automatic missed-session rescheduling
    - Decide whether to skip, move, repeat, or compress sessions.
11. Calendar/date-to-plan alignment
    - Auto-select current week/day based on start date and actual calendar.
12. Workout-run conflict resolver
    - Detect hard lower + speed/long run conflicts and adjust load distribution.
13. Real weekly mileage accounting
    - Calendar-week mileage, rolling 7-day mileage, acute:chronic workload ratio.
14. HR zone calibration
    - Use real max HR/LTHR/resting HR; calculate Zone 2 from HR, not RPE proxy.
15. Nutrition periodization
    - Training/rest/long-run fueling, pre-run carbs, post-workout protein, long-run fueling practice.
16. Data quality and confidence scoring
    - Know when recommendations are based on missing, stale, or conflicting data.
17. Body composition and measurement logic
    - Waist-to-weight, visual/photo cadence, circumference goals tied to physique.
18. Recommendation audit dashboard
    - Show exactly what changed, why, confidence, and what data triggered it.
19. Supabase production persistence completion
    - Real auth, cloud persistence, backup/restore, conflict handling.
20. Testable coaching scenarios library
    - Golden-path scenarios for fat loss, injury, missed runs, poor sleep, plateau, race prep.

---

## 12. Executive Summary

### 12.1 What is the app currently good at?

- It has a coherent local-first MVP architecture.
- It stores the major categories of data a hybrid physique/running coach needs:
  - check-ins
  - weight/body metrics
  - nutrition
  - workouts
  - sets
  - runs
  - weekly reviews
  - coach adjustments
- It has deterministic safety rules for readiness, pain, RPE, missed reps, and poor recovery.
- It has a solid 12-week static training template combining strength, hypertrophy, Zone 2, athletic conditioning, long runs, recovery days, and deload weeks.
- It has useful post-workout analysis for flags and next-session recommendations.
- It has a functional weekly review MVP with the exact requested fields:
  - average weight
  - weight change
  - total weekly miles
  - long run completed
  - lifts completed
  - calories
  - protein
  - sleep
  - alcohol
  - pain
  - adherence
  - next-week recommendation
- It is conservative around pain and Red readiness, which is appropriate for a user combining lifting, running, calorie deficit, and half-marathon training.

### 12.2 What will break first?

The first thing to break will be recommendation consistency.

Reasons:

- Multiple readiness engines use different thresholds.
- Multiple nutrition target systems exist.
- Run logger defaults do not align with selected plan.
- Weekly mileage is not true weekly mileage.
- User profile weight and progress dashboard starting weight differ.
- Important fields that affect recommendations are not collected in the current check-in UI.

The app can still function, but as data volume grows the user will see contradictory coaching messages.

### 12.3 What are the biggest risks?

1. False confidence from incomplete data
   - HRV, resting HR, sleep quality, pain, and macrosHit can affect logic while being stale/defaulted.
2. Running goal undertraining
   - The app may help finish a half marathon, but it does not specifically train for 9:00 pace.
3. Conflicting calorie guidance
   - Different target systems may confuse adherence and plateau decisions.
4. Injury risk from hybrid load
   - Strength, sprints, lower lifting, conditioning, and long runs coexist, but there is no full workload conflict resolver.
5. Static plan drift
   - If life causes missed sessions, the app does not intelligently reschedule or re-phase.
6. Local persistence fragility
   - Primary persistence is localStorage fallback unless Supabase is configured and syncing correctly.

### 12.4 What should be built next?

If only one thing is built next: unify the coaching source of truth.

Specifically:

1. Create one readiness/recovery engine.
2. Create one nutrition target engine.
3. Create one weekly progression engine that reconciles:
   - lifting
   - running
   - soreness
   - sleep
   - pain
   - weight-loss rate
   - race timeline
4. Ensure every screen consumes those same outputs.

After that, build race-date-aware running progression and dynamic calorie adaptation.

### 12.5 If a user followed the app exactly for 6 months, what results would be expected?

Brutally honest estimate:

- Weight loss:
  - Likely meaningful weight loss if the user actually logs nutrition and follows calorie targets.
  - Under 200 lb is plausible from 233 over 6 months if adherence is high.
  - But the app does not dynamically estimate TDEE, so plateaus may be handled late or imprecisely.
- Physique:
  - Likely maintenance or modest improvement in upper-body muscularity because protein is high and training is consistent.
  - True Greek God optimization is limited by lack of muscle-group volume tracking and body-measurement-driven adjustments.
- Half marathon completion:
  - Completion is plausible if the user consistently runs and avoids injury.
  - Long-run progression to 11 miles supports finishing.
- 9:00/mile half marathon:
  - Not reliably expected from current logic.
  - The app lacks the pace-specific workouts, threshold development, mileage structure, and performance testing needed to target 9:00/mile.
- Injury/recovery:
  - Conservative pain and readiness rules reduce risk.
  - But hybrid workload conflicts may still accumulate because the app does not truly reconcile lower-body lifting, sprints, athletic circuits, and run progression.

Final technical verdict:

The app is a strong deterministic MVP for logging, basic readiness gating, conservative workout adjustment, and weekly summaries. It is not yet an intelligent adaptive coach. Its biggest gap is not UI; it is unification of decision logic and deeper goal-specific progression models.

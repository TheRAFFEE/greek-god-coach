import { buildWeightTrendDashboard } from "./weight-trend";
import { buildWeeklyReviewSummary } from "./weekly-review";
import { evaluateReadiness, readinessInputFromDailyCheckIn, type ReadinessEngineResult } from "./readiness-engine";
import {
  calculateMacroAdherence,
  calculateMacroProgress,
  legacyMacroTargetToNutritionTarget,
  nutritionLogsToMealLogs,
  type MacroAdherenceSummary,
} from "./nutrition-engine";
import { evaluateProgression, type ProgressionEngineResult, type WeeklyProgressDecision } from "./progression-engine";
import { evaluateGoalTracking, type GoalStatus, type GoalTrackingEngineResult } from "./goal-tracking-engine";
import { evaluateTraining, type TrainingEngineResult } from "./training-engine";
import { evaluatePerformance, type PerformanceEngineResult } from "./performance-engine";
import type { AppState, MacroTarget, Workout, WorkoutSession } from "./types";
import { humanizeDataQualityReason } from "./log-tab-ui";

export type HomeGoalPriority = "Safety" | "Recovery" | "Training" | "Nutrition" | "Goals";
export type HomeTrainingStatus = "Completed" | "Not Completed";
export type HomeDataQuality = "High" | "Medium" | "Low";
export type TodayRunType = "easy" | "tempo" | "speed" | "long" | "race";

export interface TodayRunDisplay {
  label: string;
  title: string;
  type: TodayRunType;
  distanceMiles: number;
  estimatedMinutes: number;
  required: boolean;
  dayIndex: number;
  sourceWorkoutId: string;
}

export interface TodayRunForDateInput {
  today: string;
  currentWeek: number;
  workouts: Workout[];
  staleRunLabel?: string | null;
  completedRunDates?: string[];
  missedRunDates?: string[];
}

export interface HomeCommandCenterOptions {
  today: string;
  readinessStatus: "Green" | "Yellow" | "Red" | string;
  todaysWorkout: string;
  todaysRun: string;
  macroTarget: MacroTarget;
  coachRecommendation: string;
  workoutDurationMinutes?: number;
  runDurationMinutes?: number;
  scheduledWorkout?: Workout | null;
  scheduledRun?: { type: string; title?: string; distanceMiles: number; notes?: string; estimatedMinutes?: number } | null;
  readinessResult?: ReadinessEngineResult;
  progressionResult?: ProgressionEngineResult;
  goalTrackingResult?: GoalTrackingEngineResult;
}

export interface HomeTodayGoal {
  label: string;
  priority: HomeGoalPriority;
  source: "Readiness Engine" | "Nutrition Engine" | "Progression Engine" | "Goal Tracking Engine" | "Training Plan";
}

export interface HomeTrainingItem {
  name: string;
  estimatedDurationMinutes: number;
  status: HomeTrainingStatus;
}

export interface HomeSundayPrompt {
  visible: boolean;
  title: string;
  message: string;
  items: string[];
  buttonLabel: string;
  destination: "Log";
  section: "Body Metrics";
}

export interface HomeCommandCenterModel {
  // Existing compact-dashboard fields kept for compatibility with older consumers/tests.
  readinessStatus: string;
  todaysWorkout: string;
  todaysRun: string;
  currentWeight: number | null;
  caloriesRemaining: number;
  weeklyWeightChange: number | null;
  weeklyMiles: number;
  daysUntilRace: number;
  coachRecommendation: string;

  // UX V2 Mission Control fields.
  coachBrief: {
    readiness: string;
    overallGoalStatus: GoalStatus;
    weeklyDecision: WeeklyProgressDecision;
  };
  progressionDecision: WeeklyProgressDecision;
  todaysGoals: HomeTodayGoal[];
  goalStatuses: Record<"Fat Loss" | "Physique" | "Strength" | "Half Marathon", GoalStatus>;
  training: {
    workout: HomeTrainingItem;
    run: HomeTrainingItem;
    estimatedDurationMinutes: number;
    priorities: string[];
    warnings: string[];
  };
  trainingEngineResult: TrainingEngineResult;
  performanceEngineResult: PerformanceEngineResult;
  progressionEngineResult: ProgressionEngineResult;
  goalTrackingEngineResult: GoalTrackingEngineResult;
  recovery: {
    readiness: string;
    confidence: HomeDataQuality;
    warning: string | null;
  };
  confidenceCards: Array<{
    label: "Data Quality";
    value: HomeDataQuality;
    reason: string;
  }>;
  sundayPrompt: HomeSundayPrompt;
  actions: {
    dailyCheckIn: { label: "Daily Check-In"; destination: "Log"; section: "Daily Check-In" };
    startWorkout: { label: "Start Workout"; destination: "Train" };
  };
  engineSources: {
    readiness: "Readiness Engine V2";
    nutrition: "Nutrition Engine V2";
    progression: "Progression Engine V1";
    goalTracking: "Goal Tracking Engine V1";
  };
}

function weekWindow(endDate: string) {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

function daysUntilJan17(today: string) {
  const current = new Date(`${today}T00:00:00.000Z`);
  const year = current.getUTCMonth() === 0 && current.getUTCDate() <= 17 ? current.getUTCFullYear() : current.getUTCFullYear() + 1;
  const race = new Date(`${year}-01-17T00:00:00.000Z`);
  return Math.max(0, Math.ceil((race.getTime() - current.getTime()) / 86_400_000));
}

function planDayIndex(today: string) {
  const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function milesFromWorkout(workout: Workout) {
  if (typeof workout.longRunMiles === "number" && workout.longRunMiles > 0) return workout.longRunMiles;
  for (const exercise of workout.exercises ?? []) {
    if (!/run|jog/i.test(exercise.name) && !/run/i.test(workout.type)) continue;
    const miles = exercise.prescribedReps.match(/([\d.]+)\s*(?:mi|mile|miles)\b/i)?.[1];
    if (miles) return Number(miles);
  }
  return 0;
}

function estimatedMinutesFromWorkout(workout: Workout, distanceMiles: number) {
  if (distanceMiles > 0) return Math.max(20, Math.round(distanceMiles * (/long/i.test(workout.type) ? 11 : 10)));
  const minutes = workout.exercises
    ?.map((exercise) => exercise.prescribedReps.match(/([\d.]+)(?:\s*-\s*([\d.]+))?\s*min/i))
    .find(Boolean);
  if (!minutes) return 0;
  const low = Number(minutes[1]);
  const high = Number(minutes[2] ?? minutes[1]);
  return Math.round((low + high) / 2);
}

function todayRunType(workout: Workout): TodayRunType {
  const text = `${workout.type} ${workout.title}`;
  if (/race/i.test(text)) return "race";
  if (/long/i.test(text)) return "long";
  if (/tempo|threshold/i.test(text)) return "tempo";
  if (/speed|sprint|interval/i.test(text)) return "speed";
  return "easy";
}

function isOptionalRun(workout: Workout) {
  return /optional/i.test(`${workout.type} ${workout.title} ${workout.notes ?? ""}`);
}

function isRunWorkout(workout: Workout) {
  const text = `${workout.type} ${workout.title}`;
  if (/recovery|walk|mobility/i.test(workout.type)) return false;
  if (workout.longRunMiles && workout.longRunMiles > 0) return true;
  if (/race|long-run|tempo-run|easy-run|zone-2|\brun\b/i.test(text)) return true;
  return (workout.exercises ?? []).some((exercise) => /run|jog/i.test(exercise.name) && /mi|mile|miles|min/i.test(exercise.prescribedReps));
}

function formatMiles(distanceMiles: number) {
  return Number.isInteger(distanceMiles) ? String(distanceMiles) : distanceMiles.toFixed(1).replace(/\.0$/, "");
}

export function getTodayRunForDate(input: TodayRunForDateInput): TodayRunDisplay | null {
  const dayIndex = planDayIndex(input.today);
  const workout = input.workouts.find((candidate) => candidate.week === input.currentWeek && candidate.dayIndex === dayIndex);
  if (!workout || !isRunWorkout(workout)) return null;

  const distanceMiles = milesFromWorkout(workout);
  const estimatedMinutes = estimatedMinutesFromWorkout(workout, distanceMiles);
  if (distanceMiles <= 0 && estimatedMinutes <= 0) return null;

  const required = !isOptionalRun(workout);
  const suffix = distanceMiles > 0 ? ` — ${formatMiles(distanceMiles)} mi` : "";
  const prefix = required ? "" : "Optional: ";
  return {
    label: `${prefix}${workout.title}${suffix}`,
    title: workout.title,
    type: todayRunType(workout),
    distanceMiles,
    estimatedMinutes,
    required,
    dayIndex,
    sourceWorkoutId: workout.id,
  };
}

export function getScheduledRunForTraining(todayRun: TodayRunDisplay | null, titleOverride?: string | null, distanceOverride?: number | null) {
  if (!todayRun || todayRun.distanceMiles <= 0) return null;
  return {
    type: todayRun.type,
    title: titleOverride && !/Hold:\s*3\s*mi/i.test(titleOverride) ? titleOverride : todayRun.label,
    distanceMiles: distanceOverride && distanceOverride > 0 ? distanceOverride : todayRun.distanceMiles,
    estimatedMinutes: todayRun.estimatedMinutes,
  };
}

function conciseRecommendation(input: string, workout: string, run: string) {
  const firstSentence = input.split(/(?<=[.!?])\s+/)[0]?.trim();
  const command = firstSentence && firstSentence.length <= 150 ? firstSentence : `Do ${workout} today.`;
  return `${command} Run plan: ${run}. Keep the mission simple: check in, train, and log nutrition.`;
}

function todayCheckIn(state: AppState, today: string) {
  return (state.checkIns ?? []).find((entry) => entry.date === today);
}

function readinessFromState(state: AppState, today: string, fallbackStatus: string): ReadinessEngineResult {
  const checkIn = todayCheckIn(state, today);
  if (checkIn) return evaluateReadiness(readinessInputFromDailyCheckIn(checkIn, { restingHr: 58, hrv: 60 }));
  return {
    score: fallbackStatus === "Green" ? 85 : fallbackStatus === "Yellow" ? 65 : 40,
    status: fallbackStatus === "Green" || fallbackStatus === "Yellow" || fallbackStatus === "Red" ? fallbackStatus : "Yellow",
    confidence: "Low",
    reasons: [{ factor: "data_quality", severity: "yellow", points: -10, message: "No daily check-in is available for a fresh readiness evaluation." }],
    reason: "No daily check-in is available.",
    recommendation: "Complete Daily Check-In before training.",
    recommendationType: "modified_training",
    trainingGuidance: "Complete Daily Check-In before training.",
    recoveryGuidance: ["Complete Daily Check-In."],
    dataQualityWarnings: ["Missing daily readiness check-in."],
  };
}

function missingTodayCheckIn(state: AppState, today: string) {
  return !todayCheckIn(state, today);
}

function nutritionSummary(state: AppState, macroTarget: MacroTarget, today: string) {
  const window = weekWindow(today);
  const nutritionTarget = legacyMacroTargetToNutritionTarget(macroTarget, today);
  const mealLogs = nutritionLogsToMealLogs(state.nutritionLogs ?? []);
  const alcoholDays = (state.nutritionLogs ?? []).filter((entry) => entry.date >= window.startDate && entry.date <= window.endDate && entry.alcohol > 0).length;
  const adherence = calculateMacroAdherence({
    dateRange: window,
    mealLogs,
    nutritionTargets: [nutritionTarget],
    alcoholDays,
  });
  const todaysNutrition = (state.nutritionLogs ?? []).find((entry) => entry.date === today);
  const progress = calculateMacroProgress({
    calories: todaysNutrition?.calories ?? 0,
    protein: todaysNutrition?.protein ?? 0,
    carbs: todaysNutrition?.carbs ?? 0,
    fat: todaysNutrition?.fat ?? 0,
    fiber: todaysNutrition?.fiber ?? 0,
    water: todaysNutrition?.water ?? 0,
  }, nutritionTarget);
  return { adherence, progress, todaysNutrition };
}

function weeklyProgressionInput(state: AppState, today: string, readiness: ReadinessEngineResult, nutrition: MacroAdherenceSummary) {
  const window = weekWindow(today);
  const weeklyReview = buildWeeklyReviewSummary(state, window);
  const weightDashboard = buildWeightTrendDashboard(state.bodyMetrics ?? [], { startingWeight: state.user.startingWeight, goalWeight: state.user.goalWeight });
  return {
    readinessResult: readiness,
    nutritionResult: nutrition,
    runningResult: null,
    workoutResult: null,
    weightTrend: {
      currentWeight: weightDashboard.latestWeight,
      goalWeight: state.user.goalWeight,
      sevenDayAverage: weightDashboard.sevenDayAverage,
      fourteenDayAverage: weightDashboard.fourteenDayAverage,
      weeklyLossRate: weeklyReview.weightChange === null ? null : Math.abs(weeklyReview.weightChange),
      waistTrend: null,
    },
    weeklyReviewMetrics: {
      adherenceScore: weeklyReview.adherenceScore,
      trainingAdherence: Math.min(100, Math.round((weeklyReview.liftsCompleted / 4) * 100)),
      nutritionAdherence: nutrition.weeklyAdherence ?? nutrition.dailyAdherence,
      longRunCompleted: weeklyReview.longRunCompleted,
      liftsCompleted: weeklyReview.liftsCompleted,
      plannedLifts: 4,
      missedWorkouts: Math.max(0, 4 - weeklyReview.liftsCompleted),
      failedWorkouts: 0,
      missedRuns: weeklyReview.longRunCompleted ? 0 : 1,
      missedLogs: Math.max(0, 7 - nutrition.loggedDays),
      missedCheckIns: Math.max(0, 7 - (state.checkIns ?? []).filter((entry) => entry.date >= window.startDate && entry.date <= window.endDate).length),
      missingNutritionDays: Math.max(0, 7 - nutrition.loggedDays),
      missingRuns: weeklyReview.longRunCompleted ? 0 : 1,
      missingBodyMetrics: (state.bodyMetrics ?? []).some((entry) => entry.date >= window.startDate && entry.date <= window.endDate) ? 0 : 1,
      weeklyFatigue: readiness.status === "Red" ? "severe" : readiness.status === "Yellow" ? "moderate" : "low",
      recoveryTrend: readiness.status === "Red" ? "poor" : readiness.status === "Yellow" ? "stable" : "improving",
      strengthProgressStalled: false,
      multipleFailedWorkouts: false,
      weeksFatLossBelowMinimum: weightDashboard.weeklyWeightChange !== null && weightDashboard.weeklyWeightChange >= -0.2 ? 1 : 0,
    },
    goalContext: {
      fatLossGoal: { targetWeight: state.user.goalWeight },
      physiqueGoal: { goalName: "Greek God physique" },
      strengthGoal: { goalName: "strength progression" },
      halfMarathonGoal: { raceDate: "2027-01-17" },
    },
  };
}

function goalStatusesFrom(result: GoalTrackingEngineResult): HomeCommandCenterModel["goalStatuses"] {
  return {
    "Fat Loss": result.goals.fatLoss.status,
    Physique: result.goals.physique.status,
    Strength: result.goals.strength.status,
    "Half Marathon": result.goals.halfMarathon.status,
  };
}

function firstRecoveryWarning(readiness: ReadinessEngineResult) {
  const painReason = readiness.reasons.find((reason) => reason.factor === "pain" && (reason.severity === "red" || reason.severity === "yellow"))?.message;
  const readinessReason = readiness.reasons.find((reason) => reason.severity === "red" || reason.severity === "yellow")?.message;
  return painReason ?? readinessReason ?? null;
}

function sundayPrompt(state: AppState, today: string): HomeSundayPrompt {
  const current = new Date(`${today}T00:00:00.000Z`);
  const isSunday = current.getUTCDay() === 0;
  const start = new Date(current);
  start.setUTCDate(current.getUTCDate() - 6);
  const startDate = start.toISOString().slice(0, 10);
  const loggedThisWeek = (state.bodyMetrics ?? []).some((entry) => entry.date >= startDate && entry.date <= today && typeof entry.weight === "number" && typeof entry.waist === "number");
  return {
    visible: isSunday && !loggedThisWeek,
    title: "Weekly Check-In Due",
    message: "Please log your weekly body metrics and progress photos.",
    items: ["weight", "waist", "photos"],
    buttonLabel: "Log Weekly Check-In",
    destination: "Log",
    section: "Body Metrics",
  };
}

function completedWorkoutToday(sessions: WorkoutSession[], today: string, workoutName: string) {
  return sessions.some((session) =>
    session.status === "completed" &&
    (session.endedAt ?? session.startedAt).slice(0, 10) === today &&
    (!workoutName || session.workoutTitle === workoutName)
  );
}

function completedRunToday(state: AppState, today: string) {
  return (state.runLogs ?? []).some((entry) => entry.date === today && entry.completed);
}

function compactDataQuality(readiness: ReadinessEngineResult, progression: ProgressionEngineResult, goalTracking: GoalTrackingEngineResult, nutrition: MacroAdherenceSummary) {
  const values = [readiness.confidence, progression.confidence, goalTracking.confidence, nutrition.confidence];
  const value: HomeDataQuality = values.includes("Low") ? "Low" : values.includes("Medium") ? "Medium" : "High";
  const reason = readiness.dataQualityWarnings[0]
    ?? progression.dataQuality.missingInputs[0]
    ?? goalTracking.warnings[0]
    ?? nutrition.warnings[0]
    ?? "Core readiness, nutrition, progression, and goal tracking signals are available.";
  return { label: "Data Quality" as const, value, reason: humanizeDataQualityReason(reason) };
}

export function buildHomeCommandCenter(state: AppState, options: HomeCommandCenterOptions): HomeCommandCenterModel {
  const weightDashboard = buildWeightTrendDashboard(state.bodyMetrics ?? [], { startingWeight: state.user.startingWeight, goalWeight: state.user.goalWeight });
  const weeklyReview = buildWeeklyReviewSummary(state, weekWindow(options.today));
  const nutrition = nutritionSummary(state, options.macroTarget, options.today);
  const caloriesRemaining = Math.max(0, options.macroTarget.calories - (nutrition.todaysNutrition?.calories ?? 0));
  const readiness = options.readinessResult ?? readinessFromState(state, options.today, options.readinessStatus);
  const recoveryMissingToday = missingTodayCheckIn(state, options.today);
  const progression = options.progressionResult ?? evaluateProgression(weeklyProgressionInput(state, options.today, readiness, nutrition.adherence));
  const goalTracking = options.goalTrackingResult ?? evaluateGoalTracking({
    evaluationDate: options.today,
    currentWeek: state.currentWeek,
    weekStartDate: weekWindow(options.today).startDate,
    weekEndDate: options.today,
    bodyMetrics: state.bodyMetrics ?? [],
    nutritionAdherence: {
      macroAdherence: nutrition.adherence.weeklyAdherence ?? nutrition.adherence.dailyAdherence,
      proteinAdherence: nutrition.adherence.proteinAdherence,
      caloriesAdherence: nutrition.adherence.caloriesAdherence,
      loggingConsistency: nutrition.adherence.loggingConsistency,
      confidence: nutrition.adherence.confidence,
    },
    nutritionLogs: state.nutritionLogs ?? [],
    workoutSessions: state.workoutSessions ?? [],
    runLogs: state.runLogs ?? [],
    progressionEngineResult: progression,
    goals: {
      startWeight: state.user.startingWeight,
      targetWeight: state.user.goalWeight,
      targetRaceDate: "2027-01-17",
      targetRaceDistance: 13.1,
      targetRaceFinishMinutes: 117.9,
      targetRacePaceSecondsPerMile: 540,
      physiqueGoalName: "Greek God physique",
    },
  });
  const confidenceCard = recoveryMissingToday
    ? { label: "Data Quality" as const, value: "Low" as const, reason: "Today's daily check-in is missing. Prior-day recovery is not carried forward." }
    : compactDataQuality(readiness, progression, goalTracking, nutrition.adherence);
  const trainingEngine = evaluateTraining({
    currentDate: options.today,
    trainingPlan: null,
    selectedWeek: state.currentWeek,
    selectedDay: 0,
    readinessResult: readiness,
    progressionResult: progression,
    goalTrackingResult: goalTracking,
    scheduledWorkout: options.scheduledWorkout ?? null,
    scheduledRun: options.scheduledRun ?? null,
    availableMinutes: (options.workoutDurationMinutes ?? 50) + (options.scheduledRun ? (options.runDurationMinutes ?? options.scheduledRun.estimatedMinutes ?? 30) : 0) + 15,
    userPreferences: { includeWarmup: true, includeCooldown: true },
  });
  const performanceEngine = evaluatePerformance({
    evaluationDate: options.today,
    historicalBodyMetrics: state.bodyMetrics ?? [],
    historicalRunLogs: state.runLogs ?? [],
    historicalWorkoutSessions: state.workoutSessions ?? [],
    historicalNutritionLogs: state.nutritionLogs ?? [],
    historicalCheckIns: state.checkIns ?? [],
    goals: { startWeight: state.user.startingWeight, targetWeight: state.user.goalWeight },
    goalTrackingResult: goalTracking,
    progressionResult: progression,
  });
  const homeTrainingGoals = trainingEngine.priorityActions.map((priority) => ({
    label: priority.label,
    priority: priority.priority,
    source: priority.source === "Training Engine" ? "Training Plan" : priority.source === "Running Engine" || priority.source === "Workout Engine" ? "Training Plan" : priority.source,
  })) as HomeTodayGoal[];
  if (!homeTrainingGoals.some((goal) => /protein/i.test(goal.label))) {
    homeTrainingGoals.splice(Math.min(3, homeTrainingGoals.length), 0, { label: "Hit protein goal", priority: "Nutrition", source: "Nutrition Engine" });
  }
  if (options.todaysWorkout && !homeTrainingGoals.some((goal) => goal.label.includes(options.todaysWorkout))) {
    homeTrainingGoals.splice(Math.min(4, homeTrainingGoals.length), 0, { label: `Complete ${options.todaysWorkout}`, priority: "Training", source: "Training Plan" });
  }
  const safetyGoal = homeTrainingGoals.find((goal) => goal.priority === "Safety");
  const proteinGoal = homeTrainingGoals.find((goal) => /protein/i.test(goal.label));
  const workoutGoal = homeTrainingGoals.find((goal) => /Upper Strength|workout/i.test(goal.label));
  const orderedHomeGoals = [safetyGoal, proteinGoal, workoutGoal, ...homeTrainingGoals]
    .filter((goal): goal is HomeTodayGoal => Boolean(goal))
    .filter((goal, index, goals) => goals.findIndex((candidate) => candidate.label === goal.label) === index)
    .slice(0, 5);

  return {
    readinessStatus: readiness.status,
    todaysWorkout: options.todaysWorkout,
    todaysRun: options.todaysRun,
    currentWeight: weightDashboard.latestWeight,
    caloriesRemaining,
    weeklyWeightChange: weightDashboard.weeklyWeightChange,
    weeklyMiles: weeklyReview.totalWeeklyMiles,
    daysUntilRace: daysUntilJan17(options.today),
    coachRecommendation: conciseRecommendation(options.coachRecommendation, options.todaysWorkout, options.todaysRun),
    coachBrief: {
      readiness: readiness.status,
      overallGoalStatus: goalTracking.overallStatus,
      weeklyDecision: progression.weeklyDecision,
    },
    progressionDecision: progression.weeklyDecision,
    todaysGoals: orderedHomeGoals,
    goalStatuses: goalStatusesFrom(goalTracking),
    training: {
      workout: {
        name: trainingEngine.workout?.title ?? options.todaysWorkout,
        estimatedDurationMinutes: trainingEngine.estimatedDuration.workoutMinutes || options.workoutDurationMinutes || 50,
        status: completedWorkoutToday(state.workoutSessions ?? [], options.today, options.todaysWorkout) ? "Completed" : "Not Completed",
      },
      run: {
        name: trainingEngine.run?.title ?? options.todaysRun,
        estimatedDurationMinutes: trainingEngine.run ? trainingEngine.estimatedDuration.runMinutes : (options.scheduledRun ? (options.runDurationMinutes ?? options.scheduledRun.estimatedMinutes ?? 30) : 0),
        status: completedRunToday(state, options.today) ? "Completed" : "Not Completed",
      },
      estimatedDurationMinutes: trainingEngine.estimatedDuration.totalEstimatedMinutes,
      priorities: trainingEngine.priorityActions.map((priority) => priority.label),
      warnings: trainingEngine.warnings.map((warning) => warning.message),
    },
    trainingEngineResult: trainingEngine,
    performanceEngineResult: performanceEngine,
    progressionEngineResult: progression,
    goalTrackingEngineResult: goalTracking,
    recovery: {
      readiness: recoveryMissingToday ? "Missing" : readiness.status,
      confidence: recoveryMissingToday ? "Low" : readiness.confidence,
      warning: recoveryMissingToday ? "Today's recovery check-in is missing. Complete Daily Check-In before treating recovery as current." : firstRecoveryWarning(readiness),
    },
    confidenceCards: [confidenceCard],
    sundayPrompt: sundayPrompt(state, options.today),
    actions: {
      dailyCheckIn: { label: "Daily Check-In", destination: "Log", section: "Daily Check-In" },
      startWorkout: { label: "Start Workout", destination: "Train" },
    },
    engineSources: {
      readiness: "Readiness Engine V2",
      nutrition: "Nutrition Engine V2",
      progression: "Progression Engine V1",
      goalTracking: "Goal Tracking Engine V1",
    },
  };
}

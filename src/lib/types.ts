export type ReadinessStatus = "Green" | "Yellow" | "Red";
export type PerformanceTrend = "improving" | "stable" | "declining";
export type AppMode = "coach" | "tracker" | "manual";

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  sex: string;
  height: string;
  startingWeight: number;
  goalWeight: number;
  activityLevel: string;
  goal: string;
  trainingExperience: string;
  strengthNumbers: string;
  equipment: string;
  injuryHistory: string;
  preferredUnits: "imperial" | "metric";
  createdAt: string;
}

export interface DailyCheckIn {
  id: string;
  userId: string;
  date: string;
  weight: number;
  sleepHours: number;
  sleepQuality: number;
  soreness: number;
  energy: number;
  stress: number;
  hunger: number;
  motivation: number;
  alcohol: boolean;
  steps: number;
  restingHr: number;
  hrv: number;
  pain: boolean;
  painLocation: string;
  painSeverity: number;
  workoutCompleted: boolean;
  runCompleted: boolean;
  macrosHit: boolean;
  notes: string;
}

export interface BodyMetric {
  id: string;
  userId: string;
  date: string;
  weight: number;
  waist?: number;
  chest?: number;
  arms?: number;
  thighs?: number;
  hips?: number;
  notes?: string;
}

export interface ProgressPhoto {
  id: string;
  userId: string;
  date: string;
  frontPhotoUrl?: string;
  sidePhotoUrl?: string;
  backPhotoUrl?: string;
  notes?: string;
}

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

export interface NutritionLog {
  id: string;
  userId: string;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  water: number;
  alcohol: number;
  notes: string;
}

export type MealCategory = "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Pre-workout" | "Post-workout" | "Custom";

export interface MealItem {
  id: string;
  mealId: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  water: number;
  notes: string;
}

export interface Meal {
  id: string;
  userId: string;
  date: string;
  category: MealCategory;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  water: number;
  notes: string;
  items: MealItem[];
}

export type ScanMode = "Nutrition Label Scan" | "Food Photo Scan";
export type ScanConfidenceLevel = "High" | "Medium" | "Low";

export interface FoodScanResult {
  id: string;
  mode: ScanMode;
  detectedName: string;
  servingSize: string;
  servingsPerContainer?: string;
  servingsEaten: number;
  foodsDetected?: string[];
  portionEstimate?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar?: number;
  confidence: number;
  confidenceLevel?: ScanConfidenceLevel;
  provider: string;
  isMock: boolean;
}

export interface FoodScanLog {
  id: string;
  userId: string;
  date: string;
  mode: ScanMode;
  imageName: string;
  imagePreviewUrl: string;
  selectedMealId?: string;
  result: FoodScanResult;
  status: "reviewed" | "confirmed" | "discarded";
  provider: string;
  isMock: boolean;
  notes: string;
}

export interface NutritionProgressItem {
  target: number;
  consumed: number;
  remaining: number;
  percent: number;
}

export interface NutritionProgress {
  calories: NutritionProgressItem;
  protein: NutritionProgressItem;
  carbs: NutritionProgressItem;
  fat: NutritionProgressItem;
  fiber: NutritionProgressItem;
  water: NutritionProgressItem;
}

export interface DailyFuelScore {
  score: number;
  reasons: string[];
}

export interface NextMealMacroSuggestion {
  protein: number;
  carbs: number;
  fat: number;
  water: number;
  message: string;
}

export type RunningRecommendationAction = "Progress" | "Hold" | "Regress";
export type RunType = "easy" | "speed" | "tempo" | "long run" | "race";

export interface RunLog {
  id: string;
  userId: string;
  date: string;
  runType?: RunType;
  plannedDistance: number;
  actualDistance: number;
  durationMinutes: number;
  averagePace: number;
  averageHr: number;
  maxHr: number;
  rpe: number;
  zone2Compliance: number;
  completed: boolean;
  walkBreaks?: boolean;
  pain: boolean;
  painScore?: number;
  painLocation: string;
  notes: string;
}

export interface RunningRecommendation {
  action: RunningRecommendationAction;
  recommendedDistance: number;
  message: string;
  reasons: string[];
  warnings: string[];
}

export interface RunTrends {
  distanceTrend: number[];
  paceTrend: number[];
  rpeTrend: number[];
  longRunProgression: number[];
  weeklyMileage: number;
}

export interface Workout {
  id: string;
  userId?: string;
  week: number;
  phase: string;
  day: string;
  dayIndex: number;
  title: string;
  type: string;
  notes: string;
  finisher?: string;
  deload?: boolean;
  longRunMiles?: number;
  exercises: Exercise[];
}

export interface Exercise {
  id: string;
  workoutId: string;
  name: string;
  prescribedSets: number;
  prescribedReps: string;
  prescribedWeight?: number;
  prescribedRpe?: number;
  category: string;
  order: number;
}

export interface ExerciseLog {
  id?: string;
  userId?: string;
  exerciseId?: string;
  date?: string;
  setsCompleted: number;
  repsCompleted: number;
  weightUsed: number;
  rpe: number;
  restTime?: number;
  pain: boolean;
  notes?: string;
}

export type WorkoutSessionStatus = "active" | "completed" | "ended";
export type FormQuality = "solid" | "minor breakdown" | "missed";

export type CoachDecisionAction = "increase" | "repeat" | "reduce" | "stop" | "substitute";

export interface CoachDecision {
  id?: string;
  sessionId?: string;
  setLogId?: string;
  exerciseId: string;
  action: CoachDecisionAction;
  message: string;
  nextWeight: number;
  nextReps: string;
  targetRpe: number;
  restSeconds: number;
  reason: string;
  cue: string;
  createdAt?: string;
  recommendedWeight?: number;
}

export interface SetLog {
  id: string;
  sessionId: string;
  userId: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  targetReps: string;
  targetRpe: number;
  weightUsed: number;
  repsCompleted: number;
  rpe: number;
  pain: boolean;
  formQuality: FormQuality;
  completedAt: string;
  coachDecision?: CoachDecision;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  workoutId: string;
  workoutTitle: string;
  mode: AppMode;
  startedAt: string;
  endedAt?: string;
  status: WorkoutSessionStatus;
  currentExerciseIndex: number;
  currentSetNumber: number;
  setLogs: SetLog[];
  coachDecisions?: CoachDecision[];
}

export type PostWorkoutRecommendationAction = "progress" | "repeat" | "reduce" | "substitute" | "reduce-volume";

export interface PostWorkoutRecommendation {
  id?: string;
  sessionId: string;
  workoutId: string;
  exerciseId?: string;
  exerciseName?: string;
  action: PostWorkoutRecommendationAction;
  message: string;
  reason: string;
  createdAt: string;
}

export interface WorkoutSummary {
  id?: string;
  sessionId: string;
  workoutId: string;
  workoutTitle: string;
  completedAt: string;
  completionPercentage: number;
  exercisesCompleted: number;
  totalExercises: number;
  totalSets: number;
  prescribedSets: number;
  totalReps: number;
  prescribedReps: number;
  estimatedVolume: number;
  highRpeFlags: SetLog[];
  missedRepFlags: SetLog[];
  painFlags: SetLog[];
  poorFormFlags: SetLog[];
  bestSets: SetLog[];
  coachSummary: string;
  nextSessionRecommendations: PostWorkoutRecommendation[];
}

export interface DailyPrescription {
  id?: string;
  date: string;
  readinessStatus: ReadinessStatus;
  readinessScore: number;
  trainingDecision: "Full workout" | "Modified workout" | "Recovery replacement";
  exactWorkoutRecommendation: string;
  workoutModifications: string[];
  cardioRecommendation: string;
  nutritionTarget: string;
  waterTarget: string;
  stepsTarget: string;
  recoveryTasks: string[];
  warnings: string[];
  explanation: string[];
}

export interface ReadinessScore {
  id?: string;
  userId?: string;
  date?: string;
  score: number;
  status: ReadinessStatus;
  reason: string;
  recommendation: string;
}

export interface WeeklyReview {
  id?: string;
  userId: string;
  week: number;
  avgWeight: number;
  weightChange: number;
  waistChange: number;
  trainingAdherence: number;
  nutritionAdherence: number;
  avgSleep: number;
  avgSteps: number;
  fatigueScore: number;
  strengthTrend: PerformanceTrend;
  runningTrend: PerformanceTrend;
  transformationScore: number;
  recommendation: string;
}

export type CoachDecisionCategory = "Readiness modification" | "Workout reduction" | "Exercise substitution" | "Set-by-set coach decision" | "Future workout recommendation" | "Macro target change" | "Manual override" | "Run progression/regression" | "Recovery replacement" | string;
export type CoachDecisionConfidence = "High" | "Medium" | "Low";
export type CoachDecisionMode = "automatic" | "manual override";

export interface CoachDecisionExplanation {
  whatChanged: string;
  whyItChanged: string;
  dataThatCausedIt: string;
  whatToDoNext: string;
}

export interface PlanAdjustment {
  id: string;
  userId: string;
  date: string;
  adjustmentType: string;
  reason: string;
  previousValue: string;
  newValue: string;
  notes: string;
  category?: CoachDecisionCategory;
  originalPrescription?: string;
  adjustedPrescription?: string;
  triggerData?: string;
  confidence?: CoachDecisionConfidence;
  mode?: CoachDecisionMode;
  explanation?: CoachDecisionExplanation;
}

export interface AppState {
  user: UserProfile;
  appMode: AppMode;
  currentWeek: number;
  startDate: string;
  checkIns: DailyCheckIn[];
  bodyMetrics: BodyMetric[];
  photos: ProgressPhoto[];
  nutritionLogs: NutritionLog[];
  meals: Meal[];
  foodScans: FoodScanLog[];
  runLogs: RunLog[];
  exerciseLogs: ExerciseLog[];
  workoutSessions: WorkoutSession[];
  setLogs: SetLog[];
  workoutSummaries: WorkoutSummary[];
  postWorkoutRecommendations: PostWorkoutRecommendation[];
  adjustments: PlanAdjustment[];
  macroTargets: MacroTarget[];
}

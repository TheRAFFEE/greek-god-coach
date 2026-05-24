export type ReadinessStatus = "Green" | "Yellow" | "Red";
export type PerformanceTrend = "improving" | "stable" | "declining";

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

export interface PlanAdjustment {
  id: string;
  userId: string;
  date: string;
  adjustmentType: string;
  reason: string;
  previousValue: string;
  newValue: string;
  notes: string;
}

export interface AppState {
  user: UserProfile;
  currentWeek: number;
  startDate: string;
  checkIns: DailyCheckIn[];
  bodyMetrics: BodyMetric[];
  photos: ProgressPhoto[];
  nutritionLogs: NutritionLog[];
  exerciseLogs: ExerciseLog[];
  adjustments: PlanAdjustment[];
  macroTargets: MacroTarget[];
}

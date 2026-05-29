import type {
  AppMode,
  BodyMetric,
  CoachDecision,
  CoachDecisionExplanation,
  DailyCheckIn,
  DailyFuelScore,
  DailyPrescription,
  ExerciseLog,
  MacroTarget,
  Meal,
  MealItem,
  FoodScanResult,
  ScanMode,
  AppState,
  NextMealMacroSuggestion,
  NutritionLog,
  NutritionProgress,
  PerformanceTrend,
  PlanAdjustment,
  PostWorkoutRecommendation,
  ReadinessScore,
  ReadinessStatus,
  RunLog,
  RunningRecommendation,
  RunTrends,
  SetLog,
  WeeklyReview,
  Workout,
  WorkoutSession,
  WorkoutSummary,
} from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const round1 = (value: number) => Math.round(value * 10) / 10;
const round0 = (value: number) => Math.round(value);
const safeArray = <T>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];
const stableSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "decision";
const stableHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
};

function triggerDataToText(data: unknown): string {
  if (typeof data === "string") return data;
  try { return JSON.stringify(data); } catch { return String(data); }
}

export function explainCoachDecision(input: {
  category: string;
  originalPrescription: string;
  adjustedPrescription: string;
  reason: string;
  triggerData: unknown;
  nextStep: string;
}): CoachDecisionExplanation {
  return {
    whatChanged: `${input.category}: ${input.originalPrescription} → ${input.adjustedPrescription}`,
    whyItChanged: input.reason,
    dataThatCausedIt: triggerDataToText(input.triggerData),
    whatToDoNext: input.nextStep,
  };
}

export function createCoachDecisionLogEntry(input: {
  id?: string;
  userId: string;
  date: string;
  category: string;
  originalPrescription: string;
  adjustedPrescription: string;
  reason: string;
  triggerData: unknown;
  confidence?: "High" | "Medium" | "Low";
  mode?: "automatic" | "manual override";
  notes?: string;
  nextStep?: string;
}): PlanAdjustment {
  const explanation = explainCoachDecision({
    category: input.category,
    originalPrescription: input.originalPrescription,
    adjustedPrescription: input.adjustedPrescription,
    reason: input.reason,
    triggerData: input.triggerData,
    nextStep: input.nextStep ?? `Follow adjusted prescription: ${input.adjustedPrescription}.`,
  });
  const idPayload = `${input.date}:${input.category}:${input.originalPrescription}:${input.adjustedPrescription}:${input.reason}`;
  return {
    id: input.id ?? `decision-${input.date.slice(0, 10)}-${stableSlug(input.category)}-${stableHash(idPayload)}`,
    userId: input.userId,
    date: input.date,
    adjustmentType: input.category,
    category: input.category,
    reason: input.reason,
    previousValue: input.originalPrescription,
    newValue: input.adjustedPrescription,
    originalPrescription: input.originalPrescription,
    adjustedPrescription: input.adjustedPrescription,
    triggerData: triggerDataToText(input.triggerData),
    confidence: input.confidence ?? "Medium",
    mode: input.mode ?? "automatic",
    notes: input.notes ?? explanation.whatToDoNext,
    explanation,
  };
}

export function summarizeTodaysChanges(adjustments: PlanAdjustment[], date: string): string[] {
  return adjustments
    .filter((entry) => entry.date.startsWith(date))
    .map((entry) => `${entry.category ?? entry.adjustmentType}: ${entry.previousValue} → ${entry.newValue} because ${entry.reason}`);
}

export type PremiumTone = "green" | "yellow" | "red" | "neutral";

export interface ReadinessGaugeModel {
  score: number;
  status: ReadinessStatus;
  arcPercent: number;
  tone: PremiumTone;
  commandCopy: string;
  detailCopy: string;
}

export interface WeeklyAdherenceCell {
  date: string;
  score: number;
  tone: PremiumTone;
  label: string;
  details: string;
}

export interface WorkoutCompletionCards {
  totalWorkouts: number;
  completedSessions: number;
  activeSessions: number;
  completionPercent: number;
  coachCopy: string;
}

export interface RunTrendCard {
  label: string;
  value: string;
  coachCopy: string;
  tone: PremiumTone;
}

export function getReadinessGaugeModel(readiness: Pick<ReadinessScore, "score" | "status" | "reason" | "recommendation">): ReadinessGaugeModel {
  const score = clamp(round0(readiness.score), 0, 100);
  const tone: PremiumTone = readiness.status === "Green" ? "green" : readiness.status === "Yellow" ? "yellow" : "red";
  const commandCopy = readiness.status === "Green" ? "Attack the plan with controlled aggression." : readiness.status === "Yellow" ? "Modify the dose, keep the habit." : "Recover first. Training stress is not the answer today.";
  return { score, status: readiness.status, arcPercent: score, tone, commandCopy, detailCopy: `${readiness.reason}. ${readiness.recommendation}` };
}

export function buildWeeklyAdherenceHeatmap(input: { dates: string[]; checkIns: DailyCheckIn[]; nutritionLogs: NutritionLog[]; target: MacroTarget }): WeeklyAdherenceCell[] {
  return input.dates.map((date) => {
    const checkIn = input.checkIns.find((entry) => entry.date === date);
    const log = input.nutritionLogs.find((entry) => entry.date === date);
    const calorieScore = log ? Math.max(0, 100 - Math.abs(log.calories - input.target.calories) / Math.max(input.target.calories, 1) * 100) : 0;
    const proteinScore = log ? clamp((log.protein / Math.max(input.target.protein, 1)) * 100, 0, 100) : 0;
    const trainingScore = checkIn?.workoutCompleted ? 100 : 0;
    const macroHitBonus = checkIn?.macrosHit ? 10 : 0;
    const score = clamp(round0(Math.max((calorieScore * 0.35) + (proteinScore * 0.35) + (trainingScore * 0.3) + macroHitBonus, checkIn?.workoutCompleted ? 65 : 0)), 0, 100);
    const tone: PremiumTone = score >= 85 ? "green" : score >= 60 ? "yellow" : "red";
    return { date, score, tone, label: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }), details: `${log ? `${log.calories} cal / ${log.protein}P` : "No nutrition log"} · ${checkIn?.workoutCompleted ? "trained" : "no workout logged"}` };
  });
}

export function summarizeWorkoutCompletionCards(input: { workouts: Workout[]; sessions: WorkoutSession[] }): WorkoutCompletionCards {
  const completed = input.sessions.filter((session) => session.status === "completed").length;
  const active = input.sessions.filter((session) => session.status === "active").length;
  const total = input.workouts.length;
  const completionPercent = total ? clamp(round0((completed / total) * 100), 0, 100) : 0;
  const coachCopy = active ? `${active} active session${active === 1 ? "" : "s"} in progress — finish the work or end deliberately.` : completed ? "Workout receipts are stacking. Keep the next session honest." : "No completed sessions yet. Start today’s workout to create your first card.";
  return { totalWorkouts: total, completedSessions: completed, activeSessions: active, completionPercent, coachCopy };
}

export function buildRunTrendCards(trends: RunTrends): RunTrendCard[] {
  const last = <T,>(values: T[]) => values.length ? values[values.length - 1] : undefined;
  const delta = (values: number[]) => values.length >= 2 ? round1(values[values.length - 1] - values[values.length - 2]) : 0;
  if (!trends.distanceTrend.length) {
    return [
      { label: "Distance trend", value: "No runs yet", coachCopy: "Log a baseline run to unlock trend coaching.", tone: "neutral" },
      { label: "Pace trend", value: "—", coachCopy: "Pace trend appears after two runs.", tone: "neutral" },
      { label: "RPE trend", value: "—", coachCopy: "Effort trend appears after logging RPE.", tone: "neutral" },
      { label: "Weekly mileage", value: "0 mi", coachCopy: "Build from a conservative baseline.", tone: "neutral" },
    ];
  }
  const paceDelta = delta(trends.paceTrend);
  const rpeDelta = delta(trends.rpeTrend);
  return [
    { label: "Distance trend", value: `${last(trends.distanceTrend) ?? 0} mi`, coachCopy: delta(trends.distanceTrend) > 0 ? "Distance is progressing." : "Distance is stable — earn the next increase.", tone: delta(trends.distanceTrend) > 0 ? "green" : "yellow" },
    { label: "Pace trend", value: `${last(trends.paceTrend) ?? 0} pace`, coachCopy: paceDelta < 0 ? "Pace is getting faster." : paceDelta > 0 ? "Pace is slower; watch fatigue." : "Pace is stable.", tone: paceDelta <= 0 ? "green" : "yellow" },
    { label: "RPE trend", value: `${last(trends.rpeTrend) ?? 0}/10`, coachCopy: rpeDelta > 1 ? "Effort is climbing; hold progression." : "Effort is controlled.", tone: rpeDelta > 1 ? "yellow" : "green" },
    { label: "Weekly mileage", value: `${trends.weeklyMileage} mi`, coachCopy: "Keep weekly jumps conservative.", tone: "neutral" },
  ];
}

export type SupabaseStorageImageKind = "progress-photo" | "food-photo" | "nutrition-label";

export function getSupabasePersistenceConfig(env: Record<string, string | undefined>): { mode: "localStorage" | "supabase"; enabled: boolean; missing: string[] } {
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const missing = required.filter((key) => !env[key]);
  return missing.length ? { mode: "localStorage", enabled: false, missing } : { mode: "supabase", enabled: true, missing: [] };
}

export function getSupabaseStorageBucketForImageKind(kind: SupabaseStorageImageKind): string {
  if (kind === "progress-photo") return "progress-photos";
  if (kind === "food-photo") return "food-scan-images";
  return "nutrition-label-images";
}

export function mapAppStateToSupabaseTableCounts(state: AppState): Record<string, number> {
  const meals = safeArray(state.meals);
  return {
    users: state.user ? 1 : 0,
    daily_check_ins: safeArray(state.checkIns).length,
    body_metrics: safeArray(state.bodyMetrics).length,
    progress_photos: safeArray(state.photos).length,
    nutrition_logs: safeArray(state.nutritionLogs).length,
    meals: meals.length,
    meal_items: meals.reduce((total, meal) => total + safeArray(meal.items).length, 0),
    food_scan_logs: safeArray(state.foodScans).length,
    run_logs: safeArray(state.runLogs).length,
    exercise_logs: safeArray(state.exerciseLogs).length,
    workout_sessions: safeArray(state.workoutSessions).length,
    set_logs: safeArray(state.setLogs).length,
    workout_summaries: safeArray(state.workoutSummaries).length,
    post_workout_recommendations: safeArray(state.postWorkoutRecommendations).length,
    daily_prescriptions: 0,
    coach_decision_logs: safeArray(state.adjustments).length,
    macro_target_history: safeArray(state.macroTargets).length,
  };
}

export function calculateReadiness(checkIn: DailyCheckIn, baseline: { restingHr: number; hrv: number }): ReadinessScore {
  let score = 100;
  const reasons: string[] = [];
  const subtract = (points: number, reason: string) => {
    score -= points;
    reasons.push(reason);
  };

  if (checkIn.sleepHours < 6) subtract(20, "sleep under 6 hours");
  else if (checkIn.sleepHours < 7) subtract(10, "sleep 6-7 hours");
  if (checkIn.sleepQuality <= 4) subtract(10, "low sleep quality");
  if (checkIn.soreness >= 8) subtract(25, "severe soreness");
  else if (checkIn.soreness >= 6) subtract(10, "moderate soreness");
  if (checkIn.energy <= 3) subtract(20, "low energy");
  else if (checkIn.energy <= 5) subtract(10, "moderate energy");
  if (checkIn.stress >= 8) subtract(10, "high stress");
  if (checkIn.restingHr > baseline.restingHr + 8) subtract(15, "resting HR elevated");
  if (baseline.hrv > 0 && checkIn.hrv < baseline.hrv * 0.8) subtract(15, "HRV down over 20%");
  if (checkIn.pain && checkIn.painSeverity >= 6) subtract(35, "significant pain");
  else if (checkIn.pain && checkIn.painSeverity >= 4) subtract(15, "moderate pain");
  if (checkIn.alcohol) subtract(checkIn.sleepQuality <= 5 ? 15 : 5, "alcohol yesterday");

  const significantPain = checkIn.pain && checkIn.painSeverity >= 6;
  const finalScore = clamp(round0(significantPain ? Math.min(score, 59) : score), 0, 100);
  const status: ReadinessStatus = finalScore >= 80 ? "Green" : finalScore >= 60 ? "Yellow" : "Red";
  const recommendation = status === "Green"
    ? "Complete the planned workout. Progress weights or reps if form is solid and RPE stays at 8 or less. Conditioning allowed."
    : status === "Yellow"
      ? "Keep the workout but reduce volume 10-25%, avoid max-effort sets, keep Zone 2 conversational, and replace sprinting with incline walk or easy bike if needed."
      : "No heavy lifting, sprinting, or hard intervals. Replace today with walking, mobility, easy Zone 2, hydration, sleep, and recovery. Seek professional evaluation for persistent concerning symptoms.";

  return { score: finalScore, status, reason: reasons.length ? reasons.join("; ") : "Recovery markers are within normal range", recommendation };
}

export function calculateWeightTrend(metrics: BodyMetric[]) {
  const sorted = [...metrics].filter((m) => typeof m.weight === "number").sort((a, b) => a.date.localeCompare(b.date));
  const last7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);
  const current7DayAverage = round1(avg(last7.map((m) => m.weight)));
  const previous7DayAverage = round1(avg(prev7.map((m) => m.weight)));
  const change14Day = previous7DayAverage ? round1(current7DayAverage - previous7DayAverage) : 0;
  const latestWaist = [...sorted].reverse().find((m) => m.waist)?.waist ?? 0;
  const previousWaist = [...sorted.slice(0, -7)].reverse().find((m) => m.waist)?.waist ?? latestWaist;
  return { current7DayAverage, previous7DayAverage, change14Day, weeklyLossRate: -change14Day, waistChange: round1((latestWaist || 0) - (previousWaist || 0)) };
}

export function normalizeScanResult(result: FoodScanResult): FoodScanResult {
  const rawServings = Math.max(0, round1(result.servingsEaten || 1));
  const alreadyNormalized = result.id.includes(":normalized") || result.provider.includes(":normalized");
  const servings = alreadyNormalized ? 1 : rawServings;
  const scaled = (value: number) => round1(Math.max(0, value) * servings);
  const confidence = clamp(round0(result.confidence), 0, 100);
  const confidenceLevel = confidence >= 85 ? "High" : confidence >= 65 ? "Medium" : "Low";
  return {
    ...result,
    id: alreadyNormalized ? result.id : `${result.id}:normalized`,
    servingsEaten: rawServings,
    calories: scaled(result.calories),
    protein: scaled(result.protein),
    carbs: scaled(result.carbs),
    fat: scaled(result.fat),
    fiber: scaled(result.fiber),
    sodium: scaled(result.sodium),
    sugar: result.sugar === undefined ? undefined : scaled(result.sugar),
    confidence,
    confidenceLevel,
    isMock: result.isMock,
    provider: alreadyNormalized ? result.provider : (result.provider || "mock-deterministic"),
  };
}

export function mockScanNutritionImage(input: { mode: ScanMode; fileName?: string }): FoodScanResult {
  const fileName = (input.fileName ?? "").toLowerCase();
  let base: Omit<FoodScanResult, "id" | "mode" | "provider" | "isMock">;
  if (input.mode === "Nutrition Label Scan") {
    if (fileName.includes("bar")) {
      base = { detectedName: "Mock Protein Bar", servingSize: "1 bar", servingsEaten: 1, calories: 220, protein: 20, carbs: 24, fat: 7, fiber: 5, sodium: 180, confidence: 94 };
    } else if (fileName.includes("yogurt")) {
      base = { detectedName: "Mock Greek Yogurt Label", servingSize: "1 container", servingsEaten: 1, calories: 140, protein: 17, carbs: 9, fat: 3, fiber: 0, sodium: 65, confidence: 96 };
    } else {
      base = { detectedName: "Mock Scanned Nutrition Label", servingSize: "1 serving", servingsEaten: 1, calories: 250, protein: 18, carbs: 28, fat: 8, fiber: 4, sodium: 320, confidence: 90 };
    }
  } else if (fileName.includes("salmon") || fileName.includes("bowl")) {
    base = { detectedName: "Mock Salmon Rice Bowl", servingSize: "1 bowl", servingsEaten: 1, calories: 620, protein: 42, carbs: 58, fat: 22, fiber: 7, sodium: 760, confidence: 74 };
  } else {
    base = { detectedName: "Mock Mixed Plate Estimate", servingSize: "1 plate", servingsEaten: 1, calories: 540, protein: 35, carbs: 52, fat: 20, fiber: 6, sodium: 700, confidence: 68 };
  }
  return normalizeScanResult({ id: `scan-result-${input.mode.replace(/\s+/g, "-").toLowerCase()}`, mode: input.mode, provider: "mock-deterministic", isMock: true, ...base });
}

export function parseVisionProviderScanResult(input: { mode: ScanMode; provider: string; payload: Record<string, unknown> }): FoodScanResult {
  const text = (value: unknown, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const num = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string" || !value.trim()) return 0;
    const direct = Number(value);
    if (Number.isFinite(direct)) return direct;
    const parsed = Number.parseFloat(value.replace(/,/g, "").replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const list = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : typeof value === "string" && value.trim() ? value.split(",").map((item) => item.trim()).filter(Boolean) : undefined;
  return normalizeScanResult({
    id: `scan-result-${input.provider}-${Date.now()}`,
    mode: input.mode,
    detectedName: text(input.payload.detectedName, input.mode === "Food Photo Scan" ? "AI estimated food photo" : "AI extracted nutrition label"),
    servingSize: text(input.payload.servingSize, input.mode === "Food Photo Scan" ? "estimated portion" : ""),
    servingsPerContainer: text(input.payload.servingsPerContainer),
    servingsEaten: num(input.payload.servingsEaten) || 1,
    foodsDetected: list(input.payload.foodsDetected),
    portionEstimate: text(input.payload.portionEstimate),
    calories: num(input.payload.calories),
    protein: num(input.payload.protein),
    carbs: num(input.payload.carbs),
    fat: num(input.payload.fat),
    fiber: num(input.payload.fiber),
    sodium: num(input.payload.sodium),
    sugar: input.payload.sugar === undefined ? undefined : num(input.payload.sugar),
    confidence: num(input.payload.confidence),
    provider: input.provider,
    isMock: false,
  });
}

export function validateScanResultForReview(result: FoodScanResult): string[] {
  const issues: string[] = [];
  if (result.confidence < 65) issues.push("Low confidence: review every field before confirming.");
  if (!result.detectedName.trim()) issues.push("Missing detected food or label name.");
  if (result.mode === "Nutrition Label Scan" && !result.servingSize.trim()) issues.push("Missing serving size from nutrition label.");
  if (result.mode === "Food Photo Scan" && (!result.foodsDetected || result.foodsDetected.length === 0)) issues.push("Missing detected foods from photo estimate.");
  if (result.calories <= 0) issues.push("Missing calories estimate.");
  if (result.protein <= 0 && result.carbs <= 0 && result.fat <= 0) issues.push("Missing macro fields: protein, carbs, and fat are all zero.");
  return issues;
}

export function getScanProviderConfig(env: Record<string, string | undefined>): { provider: "mock" | "openai"; model: string; hasApiKey: boolean } {
  const wantsOpenAI = env.GREEK_GOD_SCAN_PROVIDER === "openai" || env.GREEK_GOD_SCAN_PROVIDER === "openai-vision";
  const hasApiKey = Boolean(env.OPENAI_API_KEY);
  if (wantsOpenAI && hasApiKey) return { provider: "openai", model: env.OPENAI_SCAN_MODEL || "gpt-4o-mini", hasApiKey: true };
  return { provider: "mock", model: "mock-deterministic", hasApiKey: false };
}

export function scanResultToMealItem(input: { result: FoodScanResult; mealId: string; itemId?: string }): MealItem {
  const result = normalizeScanResult(input.result);
  return {
    id: input.itemId ?? `meal-item-${result.id}`,
    mealId: input.mealId,
    name: result.detectedName,
    calories: result.calories,
    protein: result.protein,
    carbs: result.carbs,
    fat: result.fat,
    fiber: result.fiber,
    sodium: result.sodium,
    water: 0,
    notes: `${result.isMock ? "Mock" : "AI vision"} scan (${result.mode}) · ${result.servingsEaten} × ${result.servingSize || "serving"} · confidence ${result.confidence}%${result.sugar !== undefined ? ` · sugar ${result.sugar}g` : ""}`,
  };
}

export function calculateRunTrends(runLogs: RunLog[]): RunTrends {
  const sorted = [...safeArray(runLogs)].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-8);
  const longRuns = sorted.filter((run) => run.plannedDistance >= 5 || run.actualDistance >= 5);
  return {
    distanceTrend: recent.map((run) => run.actualDistance),
    paceTrend: recent.map((run) => run.averagePace),
    rpeTrend: recent.map((run) => run.rpe),
    longRunProgression: longRuns.map((run) => run.actualDistance),
    weeklyMileage: Math.round(recent.slice(-7).reduce((sum, run) => sum + run.actualDistance, 0) * 10) / 10,
  };
}

export function generateRunningRecommendation(input: {
  runLogs: RunLog[];
  nextDayReadiness: ReadinessStatus;
  plannedDistance: number;
  runType: string;
  currentWeeklyMileage: number;
  previousWeeklyMileage: number;
}): RunningRecommendation {
  const sorted = [...safeArray(input.runLogs)].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  const previous = sorted.at(-2);
  const reasons: string[] = [];
  const warnings: string[] = [];
  const isLongRun = /long/i.test(input.runType) || input.plannedDistance >= 5;
  if (!latest) {
    return { action: "Hold", recommendedDistance: input.plannedDistance, message: `Hold the planned ${input.plannedDistance} mile run until a baseline run is logged.`, reasons: ["No running history yet."], warnings };
  }

  const weeklyIncrease = input.previousWeeklyMileage > 0 ? ((input.currentWeeklyMileage - input.previousWeeklyMileage) / input.previousWeeklyMileage) * 100 : 0;
  const paceHrWorsened = Boolean(previous && latest.averagePace > previous.averagePace + 0.3 && latest.averageHr > previous.averageHr + 8);
  const poorRun = !latest.completed || latest.rpe > 6 || latest.zone2Compliance < 75 || paceHrWorsened;
  const previousPoorRun = Boolean(previous && (!previous.completed || previous.rpe > 6 || previous.zone2Compliance < 75));
  const longRunReference = isLongRun ? [...sorted].reverse().find((run) => run.plannedDistance >= 5 || run.actualDistance >= 5) : latest;
  const longRunFailed = Boolean(isLongRun && longRunReference && (!longRunReference.completed || longRunReference.actualDistance < longRunReference.plannedDistance * 0.9));

  if (latest.completed) reasons.push("Latest run was completed."); else reasons.push("Latest run was incomplete.");
  if (latest.rpe <= 6) reasons.push("Zone 2 effort stayed at RPE 6 or lower."); else reasons.push("RPE was too high for Zone 2 progression.");
  if (latest.zone2Compliance >= 80) reasons.push("Zone 2 compliance was strong."); else reasons.push("Zone 2 compliance was low.");
  if (weeklyIncrease <= 10) reasons.push("Weekly mileage increase is reasonable."); else reasons.push("Weekly mileage increase is above the conservative 10% cap.");
  if (paceHrWorsened) reasons.push("Pace/HR relationship worsened versus the prior run.");

  if (latest.pain) warnings.push(`Pain reported${latest.painLocation ? `: ${latest.painLocation}` : ""}.`);
  if (input.nextDayReadiness === "Red") warnings.push("Next-day readiness was Red after running.");
  if (longRunFailed) warnings.push("Long run failed or fell materially short of plan.");

  if (latest.pain || input.nextDayReadiness === "Red") {
    return { action: "Regress", recommendedDistance: 0, message: `No run today. Replace the next ${input.runType} with walking or mobility until pain/readiness clears.`, reasons, warnings };
  }

  if ((poorRun && previousPoorRun) || longRunFailed) {
    const recommendedDistance = Math.max(1, Math.round(input.plannedDistance * 0.8 * 2) / 2);
    return { action: "Regress", recommendedDistance, message: `Reduce the next ${input.runType} to ${recommendedDistance} miles and keep it easy until pain/fatigue clears.`, reasons, warnings };
  }

  if (poorRun || input.nextDayReadiness === "Yellow" || weeklyIncrease > 10) {
    return { action: "Hold", recommendedDistance: input.plannedDistance, message: `Hold the next ${input.runType} at ${input.plannedDistance} miles; do not progress until the next clean run.`, reasons, warnings };
  }

  const recommendedDistance = Math.round((input.plannedDistance + (isLongRun ? 1 : 0.5)) * 2) / 2;
  return { action: "Progress", recommendedDistance, message: `Increase the next ${input.runType} to ${recommendedDistance} miles while keeping Zone 2 conversational.`, reasons, warnings };
}

export function calculateMealTotals(meals: Meal[], date: string): Omit<NutritionLog, "id" | "userId" | "date" | "alcohol" | "notes"> {
  const empty = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, water: 0 };
  return safeArray(meals).filter((meal) => meal.date === date).reduce((totals, meal) => {
    const itemTotals = safeArray(meal.items).reduce((sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
      fiber: sum.fiber + item.fiber,
      sodium: sum.sodium + item.sodium,
      water: sum.water + item.water,
    }), { ...empty });
    const mealTotals = {
      calories: meal.calories + itemTotals.calories,
      protein: meal.protein + itemTotals.protein,
      carbs: meal.carbs + itemTotals.carbs,
      fat: meal.fat + itemTotals.fat,
      fiber: meal.fiber + itemTotals.fiber,
      sodium: meal.sodium + itemTotals.sodium,
      water: meal.water + itemTotals.water,
    };
    return {
      calories: totals.calories + mealTotals.calories,
      protein: totals.protein + mealTotals.protein,
      carbs: totals.carbs + mealTotals.carbs,
      fat: totals.fat + mealTotals.fat,
      fiber: totals.fiber + mealTotals.fiber,
      sodium: totals.sodium + mealTotals.sodium,
      water: totals.water + mealTotals.water,
    };
  }, { ...empty });
}

export function syncNutritionLogFromMeals(input: { userId: string; date: string; meals: Meal[]; existingLog?: NutritionLog }): NutritionLog {
  const totals = calculateMealTotals(input.meals, input.date);
  return {
    id: input.existingLog?.id ?? `nutrition-${input.date}`,
    userId: input.userId,
    date: input.date,
    ...totals,
    alcohol: input.existingLog?.alcohol ?? 0,
    notes: input.existingLog?.notes ?? "Synced from meal logs",
  };
}

export function calculateNutritionProgress(log: NutritionLog, target: MacroTarget): NutritionProgress {
  const item = (consumed: number, targetValue: number) => ({
    target: targetValue,
    consumed,
    remaining: Math.max(0, round0(targetValue - consumed)),
    percent: targetValue > 0 ? clamp(round0((consumed / targetValue) * 100), 0, 100) : 0,
  });
  return {
    calories: item(log.calories, target.calories),
    protein: item(log.protein, target.protein),
    carbs: item(log.carbs, target.carbs),
    fat: item(log.fat, target.fat),
    fiber: item(log.fiber, target.fiber),
    water: item(log.water, target.water),
  };
}

export function calculateDailyFuelScore(log: NutritionLog, target: MacroTarget): DailyFuelScore {
  const progress = calculateNutritionProgress(log, target);
  const calorieAdherence = 1 - Math.min(Math.abs(log.calories - target.calories) / Math.max(target.calories * 0.15, 1), 1);
  const proteinProgress = Math.min(log.protein / Math.max(target.protein, 1), 1);
  const waterProgress = Math.min(log.water / Math.max(target.water, 1), 1);
  const fiberProgress = Math.min(log.fiber / Math.max(target.fiber, 1), 1);
  const alcoholPenalty = Math.min(log.alcohol * 8, 20);
  const score = clamp(round0((calorieAdherence * 0.35 + proteinProgress * 0.3 + waterProgress * 0.2 + fiberProgress * 0.15) * 100 - alcoholPenalty), 0, 100);
  const reasons: string[] = [];
  if (progress.calories.percent < 85 || progress.calories.percent > 100) reasons.push("calories are outside the target window");
  if (progress.protein.percent < 90) reasons.push("protein is behind target");
  if (progress.water.percent < 90) reasons.push("water is behind target");
  if (progress.fiber.percent < 80) reasons.push("fiber is behind target");
  if (log.alcohol > 0) reasons.push("alcohol penalty applied");
  if (!reasons.length) reasons.push("fuel targets are on track");
  return { score, reasons };
}

export function suggestNextMealMacros(log: NutritionLog, target: MacroTarget, mealsRemaining = 3): NextMealMacroSuggestion {
  const divisor = Math.max(1, mealsRemaining);
  const macro = (remaining: number, min: number, max: number) => remaining <= 0 ? 0 : clamp(round0(remaining / divisor), min, max);
  const protein = macro(target.protein - log.protein, 25, 45);
  const carbs = macro(target.carbs - log.carbs, 20, 60);
  const fat = macro(target.fat - log.fat, 8, 20);
  const waterRemaining = Math.max(0, target.water - log.water);
  const water = waterRemaining <= 0 ? 0 : waterRemaining >= 24 ? 24 : clamp(round0(waterRemaining / divisor), 12, 24);
  const message = protein + carbs + fat + water === 0
    ? "Next meal: macro targets are already covered. Keep it light, prioritize micronutrients, and do not force extra calories."
    : `Next meal: aim for ${protein}g protein, ${carbs}g carbs, ${fat}g fat, and ${water} oz water.`;
  return {
    protein,
    carbs,
    fat,
    water,
    message,
  };
}

export function calculateAdherence(logs: NutritionLog[], target: MacroTarget): number {
  if (!logs.length) return 0;
  const dayScores = logs.map((log) => {
    const calorieScore = 1 - Math.min(Math.abs(log.calories - target.calories) / Math.max(target.calories * 0.18, 1), 1);
    const proteinScore = log.protein >= target.protein * 0.9 ? 1 : log.protein / Math.max(target.protein, 1);
    const carbScore = 1 - Math.min(Math.abs(log.carbs - target.carbs) / Math.max(target.carbs * 0.35, 1), 1);
    const fatScore = 1 - Math.min(Math.abs(log.fat - target.fat) / Math.max(target.fat * 0.35, 1), 1);
    const fiberScore = log.fiber >= target.fiber * 0.8 ? 1 : log.fiber / Math.max(target.fiber, 1);
    const alcoholPenalty = log.alcohol > 0 ? 0.08 : 0;
    return clamp((calorieScore * 0.35 + proteinScore * 0.3 + carbScore * 0.15 + fatScore * 0.1 + fiberScore * 0.1 - alcoholPenalty) * 100, 0, 100);
  });
  return round0(avg(dayScores));
}

export function recommendMacroAdjustment(input: {
  currentCalories: number;
  weightChange14Day: number;
  weeklyLossRate: number;
  waistChange: number;
  nutritionAdherence: number;
  trainingAdherence: number;
  energy: number;
  hunger: number;
  sleep: number;
  performanceTrend: PerformanceTrend;
  upcomingWorkoutType: string;
}) {
  const hardTomorrow = /lower|long-run|run|athletic/i.test(input.upcomingWorkoutType);
  if (input.nutritionAdherence < 80) {
    return { action: "Improve adherence first", newCalories: input.currentCalories, carbDelta: 0, reason: "Adherence is below 80%, so changing calories would hide the real signal." };
  }
  if (input.weightChange14Day >= -0.2 && input.waistChange >= -0.1 && input.nutritionAdherence >= 85) {
    return { action: "Reduce calories", newCalories: input.currentCalories - 175, carbDelta: -35, reason: "14-day average weight and waist are stalled with good adherence. Reduce 150-200/day or add 2,000 easy steps." };
  }
  if (input.weeklyLossRate > 2 && input.energy <= 5 && input.sleep < 7 && input.performanceTrend === "declining") {
    return { action: "Increase calories", newCalories: input.currentCalories + 150, carbDelta: 35, reason: "Weight is dropping too fast while recovery/performance are worsening. Add mostly carbs." };
  }
  if (hardTomorrow) {
    return { action: "Move carbs around workouts", newCalories: input.currentCalories, carbDelta: 40, reason: "Heavy lower body or long run is near. Add 25-50g carbs and trim fat if calories need to stay equal." };
  }
  if (input.energy <= 4 && input.performanceTrend === "declining" && input.nutritionAdherence >= 85) {
    return { action: "Add optional refeed", newCalories: input.currentCalories + 250, carbDelta: 60, reason: "Fatigue is high with good adherence and declining performance. Use a carb-focused refeed, not a fat-heavy cheat day." };
  }
  return { action: "Keep calories", newCalories: input.currentCalories, carbDelta: 0, reason: "Weight, waist, adherence, and recovery do not justify a plan change." };
}

const substitutionsForPain = (location: string) => {
  const l = location.toLowerCase();
  if (l.includes("shoulder")) return ["Replace dips with pushups or machine press", "Replace overhead press with landmine press", "Reduce pressing volume"];
  if (l.includes("knee")) return ["Replace running with bike or elliptical temporarily", "Replace lunges with step-ups or sled pushes", "Reduce jump volume"];
  if (l.includes("back")) return ["Replace deadlift with trap bar high handle or hip thrust", "Reduce axial loading", "Avoid high-fatigue circuits"];
  if (l.includes("achilles") || l.includes("calf")) return ["Reduce sprints", "Use bike or rower conditioning", "Keep Zone 2 non-impact if needed"];
  return ["Avoid painful movement and choose a pain-free variation"];
};

export function recommendWorkoutAdjustment(input: {
  readinessStatus: ReadinessStatus;
  soreness: number;
  pain: boolean;
  painLocation: string;
  painSeverity: number;
  missedReps: boolean;
  upcomingWorkoutType: string;
}) {
  const substitutions = input.pain ? substitutionsForPain(input.painLocation) : [];
  if (input.readinessStatus === "Red" || input.painSeverity >= 6) {
    return { action: "Zone 2 only or full rest", volumeMultiplier: 0, loadMultiplier: 0, skipFinisher: true, substitutions, reason: "Recovery or pain markers are red. Do not force intensity." };
  }
  if (input.readinessStatus === "Yellow") {
    return { action: "Reduce volume 10-25% and avoid max-effort sets", volumeMultiplier: 0.8, loadMultiplier: input.missedReps ? 0.9 : 1, skipFinisher: true, substitutions, reason: "Yellow readiness calls for productive work without digging a recovery hole." };
  }
  return { action: "Full workout", volumeMultiplier: 1, loadMultiplier: 1, skipFinisher: false, substitutions, reason: "Green readiness supports the planned session." };
}

export function recommendProgression(input: { exerciseName: string; category: string; prescribedSets: number; prescribedReps: string; previousWeight: number; log: ExerciseLog }) {
  const targetReps = parseInt(input.prescribedReps.match(/\d+/)?.[0] ?? "0", 10) * input.prescribedSets;
  const completed = input.log.setsCompleted >= input.prescribedSets && input.log.repsCompleted >= targetReps && !input.log.pain;
  const upper = input.category.includes("upper");
  const increment = upper ? 5 : 10;
  if (completed && input.log.rpe <= 8) return { nextWeight: input.previousWeight + increment, recommendation: `All work completed at RPE ${input.log.rpe}; increase ${upper ? "5 lb" : "5-10 lb"} next time.` };
  if (completed && input.log.rpe >= 9) return { nextWeight: input.previousWeight, recommendation: "Completed but RPE was 9-10; repeat the same weight next time." };
  if (input.log.pain) return { nextWeight: round0(input.previousWeight * 0.9), recommendation: "Pain reported; reduce load 5-10% and use a pain-free substitution." };
  return { nextWeight: round0(input.previousWeight * 0.95), recommendation: "Missed reps or form broke down; reduce 5-10% or repeat with lower volume." };
}

export function detectInjuryRisk(checkIn: DailyCheckIn) {
  if (checkIn.pain && checkIn.painSeverity >= 6) return { level: "High", recommendation: `Pain severity ${checkIn.painSeverity}/10 at ${checkIn.painLocation || "unspecified location"}. Avoid painful movements and consider professional evaluation if persistent or concerning.` };
  if (checkIn.pain && checkIn.painSeverity >= 4) return { level: "Moderate", recommendation: "Modify today's workout, avoid painful range of motion, and monitor symptoms." };
  return { level: "Low", recommendation: "No major pain flags reported." };
}

export function transformationScore(input: { nutritionAdherence: number; trainingAdherence: number; stepAdherence: number; sleepRecovery: number; weightWaistTrend: number; injuryFree: number }) {
  return round0(
    input.nutritionAdherence * 0.25 +
      input.trainingAdherence * 0.25 +
      input.stepAdherence * 0.15 +
      input.sleepRecovery * 0.15 +
      input.weightWaistTrend * 0.15 +
      input.injuryFree * 0.05,
  );
}

export function estimatedOneRepMax(weight: number, reps: number) {
  return round1(weight * (1 + reps / 30));
}

export function generateWeeklyReview(input: {
  userId: string;
  week: number;
  checkIns: DailyCheckIn[];
  bodyMetrics: BodyMetric[];
  nutritionAdherence: number;
  trainingAdherence: number;
  strengthTrend: PerformanceTrend;
  runningTrend: PerformanceTrend;
}): WeeklyReview {
  const trend = calculateWeightTrend(input.bodyMetrics);
  const avgSleep = round1(avg(input.checkIns.map((c) => c.sleepHours)));
  const avgSteps = round0(avg(input.checkIns.map((c) => c.steps)));
  const fatigueScore = round0(avg(input.checkIns.map((c) => c.soreness + (10 - c.energy) + c.stress)) * 3.33);
  const stepAdherence = clamp((avgSteps / 10000) * 100, 0, 100);
  const sleepRecovery = clamp((avgSleep / 7) * 100 - Math.max(0, fatigueScore - 60) * 0.4, 0, 100);
  const waistImproving = trend.waistChange < 0;
  const rateGood = trend.weeklyLossRate >= 1 && trend.weeklyLossRate <= 1.5;
  const bodyTrendScore = waistImproving || rateGood ? 90 : trend.weeklyLossRate > 2 ? 65 : 75;
  const injuryFree = input.checkIns.some((c) => c.pain && c.painSeverity >= 6) ? 40 : 100;
  const tScore = transformationScore({ nutritionAdherence: input.nutritionAdherence, trainingAdherence: input.trainingAdherence, stepAdherence, sleepRecovery, weightWaistTrend: bodyTrendScore, injuryFree });

  let recommendation = "Keep plan unchanged: trend is acceptable, waist is moving or performance is stable, and adherence is strong.";
  if (input.nutritionAdherence < 80) recommendation = "Do not change the plan yet. Improve meal consistency, protein, and logging adherence first.";
  else if (input.bodyMetrics.length >= 14 && trend.change14Day >= -0.2 && trend.waistChange >= -0.1) recommendation = "Weight and waist are stalled with good adherence. Reduce calories 150-200/day or add 2,000 easy daily steps.";
  else if (trend.weeklyLossRate > 2 && fatigueScore > 65) recommendation = "Loss is too fast with fatigue rising. Add 100-200 calories, mostly carbs, and protect sleep.";
  if (input.strengthTrend === "declining" && fatigueScore > 65) recommendation = "Strength is falling with high soreness. Reduce conditioning volume 20%, add workout carbs, and consider deload.";

  return {
    userId: input.userId,
    week: input.week,
    avgWeight: trend.current7DayAverage,
    weightChange: trend.change14Day,
    waistChange: trend.waistChange,
    trainingAdherence: input.trainingAdherence,
    nutritionAdherence: input.nutritionAdherence,
    avgSleep,
    avgSteps,
    fatigueScore,
    strengthTrend: input.strengthTrend,
    runningTrend: input.runningTrend,
    transformationScore: tScore,
    recommendation,
  };
}

export function generateDailyPrescription(input: {
  readiness: ReadinessScore;
  checkIn: DailyCheckIn;
  workout: Workout;
  macroTarget: MacroTarget;
  nutritionLogs: NutritionLog[];
  bodyMetrics: BodyMetric[];
  trainingAdherence: number;
  postWorkoutRecommendations: PostWorkoutRecommendation[];
  runningRecommendation?: RunningRecommendation;
  date?: string;
}): DailyPrescription {
  const { readiness, checkIn, workout, macroTarget } = input;
  const nutritionAdherence = calculateAdherence(input.nutritionLogs.slice(-7), macroTarget);
  const trend = calculateWeightTrend(input.bodyMetrics.slice(-14));
  const macroAdjustment = recommendMacroAdjustment({
    currentCalories: macroTarget.calories,
    weightChange14Day: trend.change14Day,
    weeklyLossRate: trend.weeklyLossRate,
    waistChange: trend.waistChange,
    nutritionAdherence,
    trainingAdherence: input.trainingAdherence,
    energy: checkIn.energy,
    hunger: checkIn.hunger,
    sleep: checkIn.sleepHours,
    performanceTrend: "stable",
    upcomingWorkoutType: workout.type,
  });
  const priorRecommendations = input.postWorkoutRecommendations.filter((recommendation) => recommendation.workoutId === workout.id && recommendation.action !== "progress");
  const poorPreviousWorkout = priorRecommendations.length > 0;
  const isRunning = /run|zone-2|conditioning|athletic/i.test(workout.type) || workout.exercises.some((exercise) => /run|sprint|walk|treadmill|conditioning/i.test(exercise.name));
  const workoutModifications: string[] = [];
  const warnings: string[] = [];
  const explanation: string[] = [`Readiness is ${readiness.status} at ${readiness.score}/100 because ${readiness.reason}.`];

  let trainingDecision: DailyPrescription["trainingDecision"] = "Full workout";
  let exactWorkoutRecommendation = `Do ${workout.title}: ${workout.exercises.map((exercise) => `${exercise.name} ${exercise.prescribedSets}x${exercise.prescribedReps} @ RPE ≤${exercise.prescribedRpe ?? 8}`).join("; ")}.`;
  let cardioRecommendation = isRunning ? "Do the planned cardio exactly as written if breathing stays conversational and mechanics are clean." : (workout.finisher ? `Do finisher only if RPE is controlled: ${workout.finisher}.` : "No extra cardio required today; optional easy 10-20 minute walk.");

  if (readiness.status === "Red" || checkIn.painSeverity >= 6) {
    trainingDecision = "Recovery replacement";
    exactWorkoutRecommendation = "Do not lift heavy today. Replace the planned workout with walking, mobility, hydration, and sleep-focused recovery.";
    workoutModifications.push("Skip heavy lifting, sprinting, hard intervals, and grinders.");
    cardioRecommendation = "20-40 minute easy walk or easy Zone 2 only if symptoms improve; otherwise full rest.";
    warnings.push("No heavy lifting on Red readiness or significant pain.");
    explanation.push("Red readiness overrides the plan: recovery replacement is the safest deterministic choice.");
  } else if (readiness.status === "Yellow") {
    trainingDecision = "Modified workout";
    workoutModifications.push("Reduce volume 10-25%, cap RPE at 7, and skip max-effort sets.");
    if (workout.finisher) workoutModifications.push("Skip or soften the finisher.");
    exactWorkoutRecommendation = `Do ${workout.title} modified: reduce each lift by 1 set where possible and keep every set at RPE 7 or lower.`;
    cardioRecommendation = isRunning ? "Keep cardio conversational; replace sprinting with incline walk, bike, or easy Zone 2." : "Optional 10-20 minute easy walk only; no extra conditioning pressure.";
    explanation.push("Yellow readiness keeps training productive but limits intensity and volume.");
  } else {
    workoutModifications.push("No readiness modifications: perform all prescribed sets.");
    explanation.push("Green readiness supports the full planned workout unless pain or previous workout history says otherwise.");
  }

  if (input.runningRecommendation && isRunning && readiness.status !== "Red") {
    cardioRecommendation = `${input.runningRecommendation.action}: ${input.runningRecommendation.message}`;
    workoutModifications.push(`Running engine: ${input.runningRecommendation.action} to ${input.runningRecommendation.recommendedDistance} miles.`);
    explanation.push(`Running recommendation is based on recent completion, RPE, HR/pace, pain, readiness, and weekly mileage.`);
    warnings.push(...input.runningRecommendation.warnings);
  } else if (input.runningRecommendation && isRunning) {
    workoutModifications.push(`Running engine stored for later: ${input.runningRecommendation.action} when readiness returns above Red.`);
    explanation.push("Red readiness keeps today's cardio as recovery-only even when the running engine has a future-distance recommendation.");
    warnings.push(...input.runningRecommendation.warnings);
  }

  if (checkIn.pain) {
    const substitutions = substitutionsForPain(checkIn.painLocation);
    workoutModifications.push(...substitutions);
    warnings.push(`Pain flag: ${checkIn.painLocation || "unspecified location"} at ${checkIn.painSeverity}/10. Use pain-free substitutions only.`);
    explanation.push("Pain modifies exercise selection and blocks aggressive progression.");
  }

  if (poorPreviousWorkout) {
    workoutModifications.push(...priorRecommendations.map((recommendation) => recommendation.message));
    explanation.push("Previous workout recommendations say to hold progression until the next clean signal.");
  }

  let nutritionTarget = `Eat ${macroTarget.calories} calories: ${macroTarget.protein}g protein, ${macroTarget.carbs}g carbs, ${macroTarget.fat}g fat, ${macroTarget.fiber}g fiber.`;
  let steps = 10000;
  if (nutritionAdherence < 80) {
    nutritionTarget = `Improve adherence first: hit ${macroTarget.calories} calories, ${macroTarget.protein}g protein, and log consistently before changing calories.`;
    explanation.push("Nutrition adherence is below 80%, so consistency comes before calorie changes.");
  } else if (macroAdjustment.action === "Reduce calories") {
    nutritionTarget = `Eat ${macroAdjustment.newCalories} calories today or keep ${macroTarget.calories} calories and add steps; protein target remains ${macroTarget.protein}g.`;
    steps = 12000;
    explanation.push("Weight/waist are stalled with good adherence, so the order adds a small calorie or step adjustment.");
  } else if (macroAdjustment.action === "Move carbs around workouts") {
    nutritionTarget = `Eat ${macroTarget.calories} calories with ${macroTarget.protein}g protein; move ~40g carbs around the workout.`;
    explanation.push("Workout type benefits from putting carbs near training without changing total calories.");
  }

  const recoveryTasks = readiness.status === "Red"
    ? ["sleep 8+ hours tonight", "Mobility 10-20 minutes", "Hydrate early", "Avoid painful ranges"]
    : readiness.status === "Yellow"
      ? ["Add 10 minutes mobility", "Keep caffeine earlier", "Prioritize 7.5+ hours sleep", "Stop sets before form breakdown"]
      : ["Warm up thoroughly", "Log all sets", "Walk after meals", "Sleep 7.5+ hours"];

  return {
    date: input.date ?? checkIn.date,
    readinessStatus: readiness.status,
    readinessScore: readiness.score,
    trainingDecision,
    exactWorkoutRecommendation,
    workoutModifications,
    cardioRecommendation,
    nutritionTarget,
    waterTarget: `${macroTarget.water} oz water`,
    stepsTarget: `${steps.toLocaleString()} steps`,
    recoveryTasks,
    warnings,
    explanation,
  };
}

export function adjustWorkoutForReadiness(workout: Workout, status: ReadinessStatus) {
  if (status === "Green") return workout;
  const volumeMultiplier = status === "Yellow" ? 0.8 : 0;
  return {
    ...workout,
    title: status === "Yellow" ? `${workout.title} — Modified` : "Recovery Replacement",
    notes: status === "Yellow" ? `${workout.notes} Reduce volume 10-25%, skip max-effort sets.` : "Red day: walking, mobility, easy Zone 2, or full rest. No heavy lifting or hard intervals.",
    finisher: status === "Yellow" ? "Skip or replace with easy incline walk/bike." : "No finisher.",
    exercises: status === "Red" ? [] : workout.exercises.map((e) => ({ ...e, prescribedSets: Math.max(1, Math.floor(e.prescribedSets * volumeMultiplier)) })),
  };
}

export function getRecommendedStartingWeight(exerciseId: string, history: SetLog[]): number {
  const successful = [...history]
    .filter((log) => log.exerciseId === exerciseId && !log.pain && log.repsCompleted > 0 && log.rpe <= 8 && log.formQuality !== "missed")
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  return successful.at(-1)?.weightUsed ?? 0;
}

const firstTargetRepCount = (targetReps: string) => parseInt(targetReps.match(/\d+/)?.[0] ?? "0", 10);
const roundToNearestFive = (value: number) => Math.round(value / 5) * 5;

export function generateNextSetRecommendation(input: { setLog: SetLog; readinessStatus: ReadinessStatus }): CoachDecision {
  const { setLog, readinessStatus } = input;
  const targetRepCount = firstTargetRepCount(setLog.targetReps);
  const hitTargetReps = targetRepCount > 0 ? setLog.repsCompleted >= targetRepCount : setLog.repsCompleted > 0;
  const sameWeight = Math.max(0, roundToNearestFive(setLog.weightUsed));
  const reducedWeight = Math.max(0, roundToNearestFive(setLog.weightUsed * 0.95));
  const increasedWeight = Math.max(0, roundToNearestFive(setLog.weightUsed + 5));
  const nextReps = setLog.targetReps;
  const targetRpe = Math.min(setLog.targetRpe, readinessStatus === "Yellow" ? 7 : 8);
  const base: Omit<CoachDecision, "action" | "message" | "nextWeight" | "restSeconds" | "reason"> = {
    exerciseId: setLog.exerciseId,
    nextReps,
    targetRpe,
    cue: "Keep reps crisp, stop before grinders, and prioritize pain-free form.",
    recommendedWeight: sameWeight,
  };

  if (readinessStatus === "Red") {
    return {
      ...base,
      action: "stop",
      message: "Stop the heavy workout. Red readiness means active heavy work should not proceed today.",
      nextWeight: 0,
      restSeconds: 300,
      reason: "Readiness is Red, so the safest deterministic recommendation is recovery work instead of another work set.",
      recommendedWeight: 0,
    };
  }

  if (setLog.pain) {
    return {
      ...base,
      action: "stop",
      message: "Stop this movement. If training continues, substitute a pain-free variation or reduce load substantially.",
      nextWeight: 0,
      restSeconds: 180,
      reason: "Pain was reported, so there is no progression recommendation.",
      recommendedWeight: 0,
    };
  }

  if (setLog.formQuality === "missed" || setLog.formQuality === "minor breakdown") {
    return {
      ...base,
      action: "reduce",
      message: "Repeat with better mechanics at a lower load. Form quality is the limiter for the next set.",
      nextWeight: reducedWeight,
      restSeconds: 180,
      reason: `Form quality was ${setLog.formQuality}, so reduce load before chasing progression.`,
      recommendedWeight: reducedWeight,
    };
  }

  if (!hitTargetReps) {
    return {
      ...base,
      action: "reduce",
      message: "reduce load 5-10%, take more rest, and hit clean target reps next set.",
      nextWeight: reducedWeight,
      restSeconds: 180,
      reason: `Completed ${setLog.repsCompleted} reps against a ${setLog.targetReps} target, so reduce load and increase rest.`,
      recommendedWeight: reducedWeight,
    };
  }

  if (setLog.rpe >= 9) {
    return {
      ...base,
      action: "reduce",
      message: "Do not increase. Repeat or reduce slightly, and take extra rest before the next set.",
      nextWeight: reducedWeight,
      restSeconds: 180,
      reason: `Target reps were hit, but RPE ${setLog.rpe} is too close to max effort.`,
      recommendedWeight: reducedWeight,
    };
  }

  if (setLog.rpe > 7 && setLog.rpe <= 8) {
    return {
      ...base,
      action: "repeat",
      message: "Repeat the same weight and reps. Effort is in the productive range.",
      nextWeight: sameWeight,
      restSeconds: readinessStatus === "Yellow" ? 150 : 120,
      reason: `Target reps were hit at RPE ${setLog.rpe}, so hold load steady.`,
      recommendedWeight: sameWeight,
    };
  }

  if (readinessStatus === "Yellow") {
    return {
      ...base,
      action: "repeat",
      message: "Repeat the same weight. Yellow readiness caps intensity, even though the last set was easy.",
      nextWeight: sameWeight,
      restSeconds: 150,
      reason: "Yellow readiness calls for conservative work and avoids aggressive increases.",
      recommendedWeight: sameWeight,
    };
  }

  return {
    ...base,
    action: "increase",
    message: "You hit target reps with room in reserve. Slightly increase or repeat if you want the safer option.",
    nextWeight: increasedWeight,
    restSeconds: 120,
    reason: `Target reps were hit at RPE ${setLog.rpe}, so a small increase is allowed.`,
    recommendedWeight: increasedWeight,
  };
}

export function generatePostWorkoutAnalysis(input: { session: WorkoutSession; workout: Workout; completedAt?: string }): WorkoutSummary {
  const { session, workout } = input;
  const completedAt = input.completedAt ?? session.endedAt ?? new Date().toISOString();
  const logs = session.setLogs;
  const prescribedSets = workout.exercises.reduce((sum, exercise) => sum + exercise.prescribedSets, 0);
  const prescribedReps = workout.exercises.reduce((sum, exercise) => sum + exercise.prescribedSets * firstTargetRepCount(exercise.prescribedReps), 0);
  const totalReps = logs.reduce((sum, log) => sum + log.repsCompleted, 0);
  const estimatedVolume = logs.reduce((sum, log) => sum + log.weightUsed * log.repsCompleted, 0);
  const completionPercentage = prescribedReps > 0 ? clamp(round0((totalReps / prescribedReps) * 100), 0, 100) : logs.length >= prescribedSets ? 100 : 0;
  const loggedExerciseIds = new Set(logs.map((log) => log.exerciseId));
  const exercisesCompleted = workout.exercises.filter((exercise) => {
    const exerciseLogs = logs.filter((log) => log.exerciseId === exercise.id);
    const targetReps = firstTargetRepCount(exercise.prescribedReps);
    return exerciseLogs.length >= exercise.prescribedSets && exerciseLogs.reduce((sum, log) => sum + log.repsCompleted, 0) >= exercise.prescribedSets * targetReps;
  }).length || loggedExerciseIds.size;
  const highRpeFlags = logs.filter((log) => log.rpe >= 9);
  const missedRepFlags = logs.filter((log) => {
    const target = firstTargetRepCount(log.targetReps);
    return target > 0 && log.repsCompleted < target;
  });
  const painFlags = logs.filter((log) => log.pain);
  const poorFormFlags = logs.filter((log) => log.formQuality !== "solid");
  const bestSets = [...logs].sort((a, b) => (b.weightUsed * b.repsCompleted) - (a.weightUsed * a.repsCompleted)).slice(0, 3);

  const recommendations: PostWorkoutRecommendation[] = workout.exercises.flatMap((exercise): PostWorkoutRecommendation[] => {
    const exerciseLogs = logs.filter((log) => log.exerciseId === exercise.id);
    if (!exerciseLogs.length) return [];
    const exercisePain = exerciseLogs.some((log) => log.pain);
    const exerciseMissed = exerciseLogs.some((log) => {
      const target = firstTargetRepCount(log.targetReps);
      return target > 0 && log.repsCompleted < target;
    });
    const exerciseHighRpe = exerciseLogs.some((log) => log.rpe >= 9);
    const exercisePoorForm = exerciseLogs.filter((log) => log.formQuality !== "solid").length;
    const cleanCompletion = !exercisePain && !exerciseMissed && !exerciseHighRpe && exercisePoorForm === 0 && exerciseLogs.every((log) => log.rpe <= 8);
    const base = { sessionId: session.id, workoutId: workout.id, exerciseId: exercise.id, exerciseName: exercise.name, createdAt: completedAt };
    if (exercisePain) return [{ ...base, action: "substitute" as const, message: `Use a pain-free substitute for ${exercise.name} next time.`, reason: "Pain was reported during this exercise." }];
    if (exerciseMissed || exercisePoorForm > 0) return [{ ...base, action: "reduce" as const, message: `Repeat or reduce ${exercise.name} next time.`, reason: exerciseMissed ? "Target reps were missed." : "Form quality broke down." }];
    if (exerciseHighRpe) return [{ ...base, action: "repeat" as const, message: `Repeat ${exercise.name} next time before adding load.`, reason: "Completed work reached RPE 9-10." }];
    if (cleanCompletion) return [{ ...base, action: "progress" as const, message: `Progress ${exercise.name} next time with a small load or rep increase.`, reason: "All prescribed work was completed at RPE 8 or lower with no pain." }];
    return [{ ...base, action: "repeat" as const, message: `Repeat ${exercise.name} next time and collect a cleaner signal.`, reason: "Workout result was mixed." }];
  });

  if (poorFormFlags.length >= 2) {
    recommendations.push({
      sessionId: session.id,
      workoutId: workout.id,
      action: "reduce-volume",
      message: "Reduce volume next time if form breakdown repeats.",
      reason: "Multiple poor-form sets were logged.",
      createdAt: completedAt,
    });
  }

  const coachSummary = painFlags.length
    ? "Pain was flagged. Prioritize substitutions and pain-free ranges next time."
    : missedRepFlags.length
      ? "Missed reps showed the load or fatigue was too high. Repeat or reduce next time."
      : highRpeFlags.length
        ? "Workout was completed, but high RPE means repeat before progressing."
        : poorFormFlags.length >= 2
          ? "Multiple form flags suggest reducing volume next time."
          : "Progress next time: all work was completed at RPE 8 or lower with no pain.";

  return {
    sessionId: session.id,
    workoutId: workout.id,
    workoutTitle: session.workoutTitle,
    completedAt,
    completionPercentage,
    exercisesCompleted,
    totalExercises: workout.exercises.length,
    totalSets: logs.length,
    prescribedSets,
    totalReps,
    prescribedReps,
    estimatedVolume,
    highRpeFlags,
    missedRepFlags,
    painFlags,
    poorFormFlags,
    bestSets,
    coachSummary,
    nextSessionRecommendations: recommendations,
  };
}

export function getNextWorkoutStep(session: WorkoutSession, workout: Workout, completedSet: SetLog, completedAt = completedSet.completedAt): WorkoutSession {
  const setLogs = [...session.setLogs, completedSet];
  const coachDecisions = completedSet.coachDecision ? [...(session.coachDecisions ?? []), completedSet.coachDecision] : session.coachDecisions;
  const currentExercise = workout.exercises[session.currentExerciseIndex];
  if (!currentExercise) return { ...session, setLogs, coachDecisions, status: "completed", endedAt: completedAt };
  if (session.currentSetNumber < currentExercise.prescribedSets) {
    return { ...session, setLogs, coachDecisions, currentSetNumber: session.currentSetNumber + 1 };
  }
  const nextExerciseIndex = session.currentExerciseIndex + 1;
  if (nextExerciseIndex >= workout.exercises.length) {
    return { ...session, setLogs, coachDecisions, status: "completed", currentExerciseIndex: session.currentExerciseIndex, currentSetNumber: currentExercise.prescribedSets, endedAt: completedAt };
  }
  return { ...session, setLogs, coachDecisions, currentExerciseIndex: nextExerciseIndex, currentSetNumber: 1 };
}

export interface WorkoutPreview {
  modeLabel: string;
  primaryInstruction: string;
  focus: string;
  coachNotes: string[];
  whatChanged: string[];
  substitutions: string[];
  startButtonLabel: string;
  showAdjustedWorkout: boolean;
}

export function generateWorkoutPreview(input: {
  mode: AppMode;
  originalWorkout: Workout;
  adjustedWorkout: Workout;
  readiness: ReadinessScore;
  checkIn?: DailyCheckIn;
}): WorkoutPreview {
  const mode: AppMode = input.mode === "tracker" || input.mode === "manual" || input.mode === "coach" ? input.mode : "coach";
  const { originalWorkout, adjustedWorkout, readiness, checkIn } = input;
  const substitutions = checkIn?.pain ? substitutionsForPain(checkIn.painLocation) : [];
  const modeLabel = mode === "coach" ? "Coach Mode" : mode === "tracker" ? "Tracker Mode" : "Manual Mode";
  const focusByType: Record<string, string> = {
    "upper-strength": "Upper-body strength, controlled bar speed, and clean reps with 1-2 reps in reserve.",
    "lower-strength": "Lower-body strength without grinders; keep bracing crisp and protect recovery.",
    "zone-2": "Aerobic base and mobility. Keep the run conversational, not competitive.",
    "upper-hypertrophy": "Shoulder-to-waist hypertrophy with controlled density and clean pump work.",
    "athletic-conditioning": "Athletic power and conditioning while protecting movement quality.",
    "long-run": "Long Zone 2 endurance. Complete the distance conversationally; do not race it.",
    recovery: "Recovery, mobility, meal prep, hydration, and sleep quality.",
  };

  const whatChanged: string[] = [];
  if (readiness.status === "Yellow") whatChanged.push("Readiness is Yellow: reduce volume 10-25%, skip max-effort sets, and soften or remove finishers.");
  if (readiness.status === "Red") whatChanged.push("Readiness is Red: replace the planned workout with recovery work only.");
  if (originalWorkout.exercises.length !== adjustedWorkout.exercises.length) whatChanged.push(`Exercise count changed from ${originalWorkout.exercises.length} to ${adjustedWorkout.exercises.length}.`);
  const reducedExercises = adjustedWorkout.exercises.filter((exercise) => {
    const original = originalWorkout.exercises.find((item) => item.id === exercise.id);
    return original && exercise.prescribedSets < original.prescribedSets;
  });
  if (reducedExercises.length) whatChanged.push(`${reducedExercises.length} exercise${reducedExercises.length === 1 ? "" : "s"} have reduced set volume.`);
  if (adjustedWorkout.finisher && adjustedWorkout.finisher !== originalWorkout.finisher) whatChanged.push(`Finisher adjusted: ${adjustedWorkout.finisher}`);
  if (substitutions.length) whatChanged.push(`Pain flag at ${checkIn?.painLocation || "unspecified location"}: use pain-free substitutions.`);
  if (!whatChanged.length) whatChanged.push("No readiness changes. Follow the planned session as written.");

  if (mode === "tracker") {
    return {
      modeLabel,
      primaryInstruction: "Log freely: follow the planned workout and record what you actually do. The coach will summarize afterward.",
      focus: focusByType[originalWorkout.type] ?? "Complete the planned work with controlled effort.",
      coachNotes: ["Tracker Mode keeps coaching light so you can run the session your way.", readiness.recommendation],
      whatChanged: ["Tracker Mode is showing the planned workout without automatic mid-session coaching."],
      substitutions,
      startButtonLabel: "Start Tracker Workout",
      showAdjustedWorkout: false,
    };
  }

  if (mode === "manual") {
    return {
      modeLabel,
      primaryInstruction: "Override freely: use this as a flexible workout template and modify exercises, sets, and loads as needed.",
      focus: focusByType[originalWorkout.type] ?? "Use the plan as a starting point and adjust manually.",
      coachNotes: ["Manual Mode gives you control. Safety flags still matter, especially pain and Red readiness.", readiness.recommendation],
      whatChanged: ["Manual Mode does not force automatic changes; use coach guidance as advisory."],
      substitutions,
      startButtonLabel: "Start Manual Workout",
      showAdjustedWorkout: false,
    };
  }

  const primaryInstruction = readiness.status === "Green"
    ? `Do ${adjustedWorkout.title}. Full session approved; progress only if form is clean and RPE stays at 8 or less.`
    : readiness.status === "Yellow"
      ? `Modify ${originalWorkout.title}. Use the adjusted workout, reduce intensity, and leave the gym better than you entered.`
      : "Recover today. Do not force heavy lifting, sprinting, or hard intervals.";

  return {
    modeLabel,
    primaryInstruction,
    focus: focusByType[originalWorkout.type] ?? "Complete today's prescription with disciplined execution.",
    coachNotes: [readiness.recommendation, adjustedWorkout.notes, substitutions.length ? `Substitutions: ${substitutions.join("; ")}` : "No pain substitutions needed."],
    whatChanged,
    substitutions,
    startButtonLabel: "Start Coach Workout",
    showAdjustedWorkout: true,
  };
}

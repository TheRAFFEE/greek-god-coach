import type {
  BodyMetric,
  DailyCheckIn,
  ExerciseLog,
  MacroTarget,
  NutritionLog,
  PerformanceTrend,
  ReadinessScore,
  ReadinessStatus,
  WeeklyReview,
  Workout,
} from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const round1 = (value: number) => Math.round(value * 10) / 10;
const round0 = (value: number) => Math.round(value);

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

  const finalScore = clamp(round0(score), 0, 100);
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

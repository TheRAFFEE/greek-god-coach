import type { SetLog, WorkoutSession } from "./types";

export type MuscleGroup = "chest" | "back" | "shoulders" | "arms" | "legs" | "core";
export type WorkoutProgressionDecision = "Progress" | "Repeat" | "Reduce" | "Deload" | "Substitute";
export type WorkoutConfidence = "High" | "Medium" | "Low";
export type MovementPattern =
  | "horizontal-push" | "vertical-push" | "horizontal-pull" | "vertical-pull"
  | "squat" | "hinge" | "lunge" | "curl" | "extension" | "carry"
  | "anti-extension" | "anti-rotation" | "rotation" | "isolation" | "other";

export interface WorkoutSetLogInput {
  id: string; sessionId: string; userId: string; workoutId: string; exerciseId: string; exerciseName: string;
  date: string; setNumber: number; targetReps: string; targetRpe: number; weightUsed: number; repsCompleted: number;
  rpe: number; pain: boolean; painLocation?: string; painSeverity?: number; formQuality: "solid" | "minor breakdown" | "poor" | "missed";
  completedAt: string; notes?: string;
}
export interface WorkoutExercisePerformanceInput {
  exerciseId: string; exerciseName: string; primaryMuscleGroup: MuscleGroup; secondaryMuscleGroups?: MuscleGroup[]; movementPattern?: MovementPattern;
  plannedSets: number; plannedReps: string; plannedLoad?: number; plannedRpe?: number; completedSets: WorkoutSetLogInput[]; equipment?: string; painLocation?: string; notes?: string;
}
export interface WorkoutSessionInput { id: string; date: string; workoutId: string; workoutTitle: string; mode: "coach" | "tracker" | "manual"; status: "active" | "completed" | "ended"; exercises: WorkoutExercisePerformanceInput[]; }
export interface WorkoutSessionHistoryInput { id: string; date: string; workoutId: string; workoutTitle: string; status: "active" | "completed" | "ended"; setLogs: WorkoutSetLogInput[]; }
export interface WorkoutExerciseDefinition { id: string; name: string; primaryMuscleGroup: MuscleGroup; secondaryMuscleGroups?: MuscleGroup[]; movementPattern: MovementPattern; equipment?: string[]; progressionType: "load" | "reps" | "sets" | "time" | "bodyweight" | "skill"; substitutionIds?: string[]; contraindications?: string[]; }
export interface WorkoutReadinessInput { status: "Green" | "Yellow" | "Red"; score: number; sleepHours?: number; soreness?: number; stress?: number; energy?: number; pain?: boolean; painLocation?: string; painSeverity?: number; confidence?: WorkoutConfidence; }
export interface WorkoutRecoveryInput { sorenessByMuscleGroup?: Partial<Record<MuscleGroup, number>>; sleepHours?: number; restingHeartRateTrend?: "improving" | "stable" | "worsening" | "unknown"; hrvTrend?: "improving" | "stable" | "worsening" | "unknown"; alcoholDaysLast7?: number; caloriesAdherencePercent?: number; proteinAdherencePercent?: number; }
export interface WorkoutGoalInput { primaryGoal: "hypertrophy" | "strength" | "hybrid" | "maintenance"; physiqueGoal?: "Greek God physique" | string; fatLossPhase?: boolean; preserveRunningPerformance?: boolean; priorityMuscleGroups?: MuscleGroup[]; }
export type MuscleGroupVolumeTargets = Record<MuscleGroup, { minimumEffectiveSets: number; targetSets: number; maximumRecoverableSets: number }>;
export interface ExerciseSubstitutionRule { exerciseId: string; substituteExerciseId: string; reason: string; }
export interface WorkoutEngineInput { generatedAt: string; evaluationDate: string; userId: string; currentSession?: WorkoutSessionInput; plannedWorkout?: unknown; setLogs: WorkoutSetLogInput[]; workoutSessions: WorkoutSessionHistoryInput[]; exerciseCatalog: WorkoutExerciseDefinition[]; readiness?: WorkoutReadinessInput; recovery?: WorkoutRecoveryInput; goals: WorkoutGoalInput; volumeTargets?: MuscleGroupVolumeTargets; substitutionRules?: ExerciseSubstitutionRule[]; }
export interface WorkoutSetPerformance { weightUsed: number; repsCompleted: number; rpe: number; volume: number; completedAt: string; }
export interface WorkoutRecommendation { action: WorkoutProgressionDecision; summary: string; nextWorkoutGuidance: string; loadGuidance?: string; volumeGuidance?: string; exerciseGuidance?: string; recoveryGuidance?: string; reason: string; }
export interface WorkoutExerciseDecision { exerciseId: string; exerciseName: string; primaryMuscleGroup: MuscleGroup; action: WorkoutProgressionDecision; currentBestSet?: WorkoutSetPerformance; previousBestSet?: WorkoutSetPerformance; estimatedOneRepMax?: number; previousEstimatedOneRepMax?: number; recommendedLoad?: number; recommendedReps?: string; recommendedSets?: number; recommendedRpeCap?: number; reason: string; blockers: string[]; supportingSignals: string[]; confidenceScore: number; }
export interface MuscleGroupVolumeSummary { muscleGroup: MuscleGroup; weeklySets: number; targetSets: number; minimumEffectiveSets: number; maximumRecoverableSets: number; status: "below-minimum" | "productive" | "high" | "excessive"; recommendation: "add-volume" | "maintain" | "reduce-volume" | "deload"; reason: string; }
export interface RollingFourWeekVolumeSummary { muscleGroup: MuscleGroup; week1Sets: number; week2Sets: number; week3Sets: number; week4Sets: number; averageSets: number; trend: "increasing" | "stable" | "decreasing" | "unknown"; spikePercent?: number; fatigueRisk: "low" | "moderate" | "high"; }
export interface HypertrophyProgressionSummary { action: WorkoutProgressionDecision; muscleGroupStatuses: MuscleGroupVolumeSummary[]; priorityMuscleGroups: MuscleGroup[]; productiveVolumeMuscleGroups: MuscleGroup[]; undertrainedMuscleGroups: MuscleGroup[]; overreachedMuscleGroups: MuscleGroup[]; recommendation: string; reason: string; }
export interface StrengthProgressionSummary { action: WorkoutProgressionDecision; estimatedOneRepMaxTrend: "improving" | "stable" | "declining" | "unknown"; exercisesProgressing: string[]; exercisesStalled: string[]; exercisesRegressing: string[]; recommendation: string; reason: string; }
export interface WorkoutFatigueSummary { systemicFatigueScore: number; localFatigueByMuscleGroup: Record<MuscleGroup, number>; fatigueStatus: "low" | "moderate" | "high" | "severe"; drivers: string[]; recommendation: "normal" | "reduce-load" | "reduce-volume" | "deload"; }
export interface WorkoutDeloadDecision { needed: boolean; scope: "none" | "exercise" | "muscle-group" | "full-body"; targetMuscleGroups: MuscleGroup[]; reductionPercent: number; durationDays: number; reason: string; triggers: string[]; }
export interface ExerciseSubstitutionDecision { exerciseId: string; exerciseName: string; shouldSubstitute: boolean; substituteExerciseId?: string; substituteExerciseName?: string; reason: string; trigger: "pain" | "poor-form" | "equipment" | "stalled-progress" | "fatigue" | "preference"; confidenceScore: number; }
export interface ExerciseHistorySummary { exerciseId: string; exerciseName: string; exposures: number; lastPerformedAt?: string; averageSets: number; averageReps: number; averageLoad: number; averageRpe: number; bestEstimatedOneRepMax?: number; bestVolume?: number; recentTrend: "improving" | "stable" | "declining" | "unknown"; lastDecision?: WorkoutProgressionDecision; notes: string[]; }
export interface ExercisePR { id: string; exerciseId: string; exerciseName: string; date: string; type: "estimated-1rm" | "rep-pr" | "volume-pr" | "load-pr"; value: number; unit: "lb" | "reps" | "lb-reps"; set?: WorkoutSetPerformance; previousValue?: number; improvementPercent?: number; confidenceScore: number; }
export interface ExercisePRProfile { exerciseId: string; exerciseName: string; estimatedOneRepMaxPr?: ExercisePR; repPrs: ExercisePR[]; volumePr?: ExercisePR; loadPr?: ExercisePR; lastPrDate?: string; }
export interface WorkoutPRSummary { newPrs: ExercisePR[]; exercisePrs: Record<string, ExercisePRProfile>; }
export interface WorkoutExplanation { summary: string; primaryDrivers: string[]; blockers: string[]; supportingSignals: string[]; tradeoffs: string[]; missingData: string[]; }
export interface WorkoutAuditEntry { id: string; timestamp: string; decisionType: "exercise-progression" | "hypertrophy-progression" | "strength-progression" | "pr-detection" | "muscle-volume" | "fatigue-management" | "deload" | "substitution" | "overall-recommendation"; subjectId?: string; subjectName?: string; action: string; reason: string; dataUsed: string[]; thresholdsApplied: string[]; confidenceScore: number; dataQualityScore: number; }
export interface WorkoutEngineResult { generatedAt: string; evaluationDate: string; overallDecision: WorkoutProgressionDecision; workoutRecommendation: WorkoutRecommendation; exerciseDecisions: WorkoutExerciseDecision[]; muscleGroupVolume: MuscleGroupVolumeSummary[]; rollingFourWeekVolume: RollingFourWeekVolumeSummary[]; hypertrophyProgression: HypertrophyProgressionSummary; strengthProgression: StrengthProgressionSummary; fatigue: WorkoutFatigueSummary; deload: WorkoutDeloadDecision; substitutions: ExerciseSubstitutionDecision[]; exerciseHistory: ExerciseHistorySummary[]; prs: WorkoutPRSummary; confidenceScore: number; dataQualityScore: number; explanation: WorkoutExplanation; auditTrail: WorkoutAuditEntry[]; }

const muscleGroups: MuscleGroup[] = ["chest", "back", "shoulders", "arms", "legs", "core"];
export const defaultMuscleGroupVolumeTargets: MuscleGroupVolumeTargets = { chest: { minimumEffectiveSets: 8, targetSets: 12, maximumRecoverableSets: 18 }, back: { minimumEffectiveSets: 10, targetSets: 14, maximumRecoverableSets: 20 }, shoulders: { minimumEffectiveSets: 8, targetSets: 12, maximumRecoverableSets: 18 }, arms: { minimumEffectiveSets: 6, targetSets: 10, maximumRecoverableSets: 16 }, legs: { minimumEffectiveSets: 8, targetSets: 12, maximumRecoverableSets: 18 }, core: { minimumEffectiveSets: 4, targetSets: 8, maximumRecoverableSets: 14 } };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round0 = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;
const datePart = (value: string) => value.slice(0, 10);
const firstTargetRepCount = (targetReps: string) => Number.parseInt(targetReps.match(/\d+/)?.[0] ?? "0", 10);

function inferMuscleGroup(name: string, category = ""): MuscleGroup {
  const text = `${name} ${category}`.toLowerCase();
  if (/bench|push|chest|pec/.test(text)) return "chest";
  if (/row|pull|lat|back|rdl|deadlift/.test(text)) return "back";
  if (/press|raise|delt|shoulder/.test(text)) return "shoulders";
  if (/curl|tricep|bicep|arm/.test(text)) return "arms";
  if (/squat|lunge|leg|quad|hamstring|calf|glute/.test(text)) return "legs";
  if (/plank|core|ab|carry/.test(text)) return "core";
  return "chest";
}
function secondaryFor(primary: MuscleGroup): MuscleGroup[] { return primary === "chest" ? ["shoulders", "arms"] : primary === "back" ? ["arms"] : primary === "legs" ? ["core"] : []; }
function catalogForSet(set: WorkoutSetLogInput, catalog: WorkoutExerciseDefinition[]): WorkoutExerciseDefinition {
  return catalog.find((exercise) => exercise.id === set.exerciseId) ?? { id: set.exerciseId, name: set.exerciseName, primaryMuscleGroup: inferMuscleGroup(set.exerciseName), secondaryMuscleGroups: secondaryFor(inferMuscleGroup(set.exerciseName)), movementPattern: "other", progressionType: "load" };
}
function toSetInput(set: SetLog): WorkoutSetLogInput { return { ...set, date: datePart(set.completedAt), formQuality: set.formQuality === "missed" ? "missed" : set.formQuality, painLocation: set.notes, painSeverity: set.pain ? 6 : undefined }; }

export function calculateEstimatedOneRepMax(input: { weightUsed: number; repsCompleted: number; rpe: number; formQuality: string }): number | null {
  if (input.weightUsed <= 0 || input.repsCompleted < 1 || input.repsCompleted > 12) return null;
  if (input.formQuality === "poor" || input.formQuality === "missed") return null;
  return round0(input.weightUsed * (1 + input.repsCompleted / 30));
}
function setPerformance(set: WorkoutSetLogInput): WorkoutSetPerformance { return { weightUsed: set.weightUsed, repsCompleted: set.repsCompleted, rpe: set.rpe, volume: set.weightUsed * set.repsCompleted, completedAt: set.completedAt }; }
export function calculateMuscleGroupVolume(input: WorkoutEngineInput): MuscleGroupVolumeSummary[] {
  const totals: Record<MuscleGroup, number> = { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, core: 0 };
  for (const set of input.setLogs) {
    if (set.repsCompleted <= 0 || set.formQuality === "missed") continue;
    const exercise = catalogForSet(set, input.exerciseCatalog);
    totals[exercise.primaryMuscleGroup] += 1;
    for (const secondary of exercise.secondaryMuscleGroups ?? []) totals[secondary] += 0.5;
  }
  const targets = input.volumeTargets ?? defaultMuscleGroupVolumeTargets;
  return muscleGroups.map((muscleGroup) => {
    const weeklySets = round1(totals[muscleGroup]);
    const target = targets[muscleGroup];
    const status = weeklySets < target.minimumEffectiveSets ? "below-minimum" : weeklySets <= target.targetSets * 1.2 ? "productive" : weeklySets <= target.maximumRecoverableSets ? "high" : "excessive";
    const recommendation = status === "below-minimum" ? "add-volume" : status === "productive" ? "maintain" : status === "high" ? "reduce-volume" : "deload";
    return { muscleGroup, weeklySets, ...target, status, recommendation, reason: `${muscleGroup} logged ${weeklySets} weekly sets against target ${target.targetSets}.` };
  });
}

function calculateRollingFourWeekVolume(input: WorkoutEngineInput): RollingFourWeekVolumeSummary[] {
  const sessions = input.workoutSessions.length ? input.workoutSessions : [{ id: input.currentSession?.id ?? "current", date: input.evaluationDate, workoutId: "current", workoutTitle: "Current", status: "completed" as const, setLogs: input.setLogs }];
  return muscleGroups.map((muscleGroup) => {
    const weeks = [0, 0, 0, 0];
    for (const session of sessions) {
      const bucket = Math.max(0, 3 - Math.floor((Date.parse(input.evaluationDate) - Date.parse(session.date)) / (7 * 86400000)));
      if (bucket > 3) continue;
      for (const set of session.setLogs) {
        if (set.repsCompleted <= 0 || set.formQuality === "missed") continue;
        const exercise = catalogForSet(set, input.exerciseCatalog);
        if (exercise.primaryMuscleGroup === muscleGroup) weeks[bucket] += 1;
        if ((exercise.secondaryMuscleGroups ?? []).includes(muscleGroup)) weeks[bucket] += 0.5;
      }
    }
    const averageSets = round1(weeks.reduce((a, b) => a + b, 0) / 4);
    const spikePercent = averageSets > 0 ? round0(((weeks[3] - averageSets) / averageSets) * 100) : 0;
    const trend = weeks[3] > weeks[0] ? "increasing" : weeks[3] < weeks[0] ? "decreasing" : averageSets > 0 ? "stable" : "unknown";
    const fatigueRisk = spikePercent > 50 ? "high" : spikePercent > 30 ? "moderate" : "low";
    return { muscleGroup, week1Sets: round1(weeks[0]), week2Sets: round1(weeks[1]), week3Sets: round1(weeks[2]), week4Sets: round1(weeks[3]), averageSets, trend, spikePercent, fatigueRisk };
  });
}

export function calculateFatigue(input: WorkoutEngineInput, volume = calculateMuscleGroupVolume(input)): WorkoutFatigueSummary {
  let score = 0; const drivers: string[] = [];
  const add = (points: number, reason: string) => { score += points; drivers.push(reason); };
  const readiness = input.readiness;
  if (readiness?.status === "Red") add(25, "Red readiness"); else if (readiness?.status === "Yellow") add(15, "Yellow readiness");
  const sleep = readiness?.sleepHours ?? input.recovery?.sleepHours;
  if (sleep !== undefined && sleep < 5) add(25, "Sleep under 5 hours"); else if (sleep !== undefined && sleep < 6) add(15, "Sleep under 6 hours");
  const soreness = readiness?.soreness ?? Math.max(0, ...Object.values(input.recovery?.sorenessByMuscleGroup ?? {}));
  if (soreness >= 9) add(20, "Severe soreness"); else if (soreness >= 7) add(10, "High soreness");
  const highRpe = input.setLogs.filter((set) => set.rpe >= 9).length;
  if (input.setLogs.length && highRpe / input.setLogs.length > 0.25) add(10, "High RPE density");
  const missed = input.setLogs.filter((set) => set.repsCompleted < firstTargetRepCount(set.targetReps)).length;
  if (input.setLogs.length && missed / input.setLogs.length > 0.2) add(20, "Missed rep density");
  if (input.setLogs.some((set) => set.painSeverity !== undefined ? set.painSeverity >= 6 : set.pain)) add(20, "Pain flags");
  if (volume.filter((item) => item.status === "excessive").length >= 2) add(15, "Multiple muscle groups above MRV");
  const status = score >= 70 ? "severe" : score >= 50 ? "high" : score >= 25 ? "moderate" : "low";
  const recommendation = status === "severe" ? "deload" : status === "high" ? "reduce-volume" : status === "moderate" ? "reduce-load" : "normal";
  const local = Object.fromEntries(muscleGroups.map((group) => [group, clamp((input.recovery?.sorenessByMuscleGroup?.[group] ?? 0) * 10 + (volume.find((v) => v.muscleGroup === group)?.status === "excessive" ? 30 : 0), 0, 100)])) as Record<MuscleGroup, number>;
  return { systemicFatigueScore: clamp(score, 0, 100), localFatigueByMuscleGroup: local, fatigueStatus: status, drivers, recommendation };
}

export function calculateWorkoutConfidenceScore(input: WorkoutEngineInput): number {
  let score = 100;
  if (input.workoutSessions.length < 2) score -= 20;
  if (!input.exerciseCatalog.length) score -= 15;
  if (input.setLogs.some((set) => !Number.isFinite(set.rpe))) score -= 10;
  if (input.setLogs.some((set) => !set.formQuality)) score -= 10;
  if (!input.readiness) score -= 10;
  if (input.setLogs.some((set) => set.pain && set.painSeverity === undefined)) score -= 10;
  if (!input.setLogs.length) score -= 20;
  if (input.currentSession?.status === "ended") score -= 5;
  return clamp(score, 0, 100);
}
export function calculateDataQualityScore(input: WorkoutEngineInput): number {
  let score = 100;
  if (input.setLogs.some((set) => !set.exerciseId || !set.exerciseName)) score -= 15;
  if (!input.exerciseCatalog.length) score -= 15;
  if (input.setLogs.length && input.setLogs.filter((set) => !Number.isFinite(set.rpe)).length / input.setLogs.length > 0.25) score -= 15;
  if (input.setLogs.length && input.setLogs.filter((set) => !set.formQuality).length / input.setLogs.length > 0.25) score -= 15;
  if (input.setLogs.some((set) => set.pain && set.painSeverity === undefined)) score -= 10;
  if (input.setLogs.some((set) => !set.completedAt)) score -= 10;
  if (!input.workoutSessions.length) score -= 10;
  if (!input.currentSession) score -= 5;
  return clamp(score, 0, 100);
}

function exerciseDecisions(input: WorkoutEngineInput, fatigue: WorkoutFatigueSummary, confidenceScore: number): WorkoutExerciseDecision[] {
  const byExercise = new Map<string, WorkoutSetLogInput[]>();
  for (const set of input.setLogs) byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) ?? []), set]);
  return [...byExercise.entries()].map(([exerciseId, sets]) => {
    const exercise = catalogForSet(sets[0], input.exerciseCatalog);
    const target = firstTargetRepCount(sets[0].targetReps);
    const pain = sets.some((set) => set.pain || (set.painSeverity ?? 0) >= 6);
    const missed = sets.some((set) => target > 0 && set.repsCompleted < target);
    const poorForm = sets.some((set) => set.formQuality !== "solid");
    const highRpe = sets.some((set) => set.rpe >= 9);
    const easyClean = sets.every((set) => !set.pain && set.formQuality === "solid" && set.rpe <= 7 && (target === 0 || set.repsCompleted >= target));
    const clean = sets.every((set) => !set.pain && set.formQuality === "solid" && set.rpe <= 8 && (target === 0 || set.repsCompleted >= target));
    let action: WorkoutProgressionDecision = "Repeat";
    const blockers: string[] = [];
    if (pain) { action = "Substitute"; blockers.push("Pain reported"); }
    else if (fatigue.fatigueStatus === "severe") { action = "Deload"; blockers.push("Severe fatigue"); }
    else if (missed || poorForm || highRpe) { action = "Reduce"; if (missed) blockers.push("Target reps missed"); if (poorForm) blockers.push("Form quality broke down"); if (highRpe) blockers.push("RPE reached 9+"); }
    else if (easyClean && input.workoutSessions.length >= 1) action = "Progress";
    else if (clean) action = input.workoutSessions.length >= 1 ? "Progress" : "Repeat";
    const best = [...sets].sort((a, b) => b.weightUsed * b.repsCompleted - a.weightUsed * a.repsCompleted)[0];
    const e1rm = best ? calculateEstimatedOneRepMax(best) ?? undefined : undefined;
    const recommendedLoad = best ? (action === "Progress" ? best.weightUsed + 5 : action === "Reduce" ? round0(best.weightUsed * 0.95 / 5) * 5 : action === "Deload" || action === "Substitute" ? 0 : best.weightUsed) : undefined;
    return { exerciseId, exerciseName: sets[0].exerciseName, primaryMuscleGroup: exercise.primaryMuscleGroup, action, currentBestSet: best ? setPerformance(best) : undefined, estimatedOneRepMax: e1rm, recommendedLoad, recommendedReps: sets[0].targetReps, recommendedSets: sets.length, recommendedRpeCap: action === "Progress" ? 8 : action === "Repeat" ? 8 : 7, reason: `Workout Engine V2 ${action}: ${blockers[0] ?? "execution and history support this decision"}.`, blockers, supportingSignals: [`${sets.length} sets logged`, `${exercise.primaryMuscleGroup} primary muscle group`], confidenceScore };
  });
}
function calculatePRs(input: WorkoutEngineInput): WorkoutPRSummary {
  const profiles: Record<string, ExercisePRProfile> = {}; const newPrs: ExercisePR[] = [];
  const allSets = input.workoutSessions.flatMap((session) => session.setLogs).concat(input.setLogs);
  for (const set of allSets) {
    const profile = profiles[set.exerciseId] ?? { exerciseId: set.exerciseId, exerciseName: set.exerciseName, repPrs: [] };
    const perf = setPerformance(set);
    const e1rm = calculateEstimatedOneRepMax(set);
    if (e1rm !== null && (!profile.estimatedOneRepMaxPr || e1rm > profile.estimatedOneRepMaxPr.value)) profile.estimatedOneRepMaxPr = { id: `${set.id}-e1rm-pr`, exerciseId: set.exerciseId, exerciseName: set.exerciseName, date: datePart(set.completedAt), type: "estimated-1rm", value: e1rm, unit: "lb", set: perf, previousValue: profile.estimatedOneRepMaxPr?.value, improvementPercent: profile.estimatedOneRepMaxPr ? round1(((e1rm - profile.estimatedOneRepMaxPr.value) / profile.estimatedOneRepMaxPr.value) * 100) : undefined, confidenceScore: set.rpe < 6 || set.rpe > 9 ? 70 : 90 };
    const volume = set.weightUsed * set.repsCompleted;
    if (!profile.volumePr || volume > profile.volumePr.value * 1.01) profile.volumePr = { id: `${set.id}-volume-pr`, exerciseId: set.exerciseId, exerciseName: set.exerciseName, date: datePart(set.completedAt), type: "volume-pr", value: volume, unit: "lb-reps", set: perf, previousValue: profile.volumePr?.value, confidenceScore: 90 };
    if (!profile.loadPr || set.weightUsed > profile.loadPr.value) profile.loadPr = { id: `${set.id}-load-pr`, exerciseId: set.exerciseId, exerciseName: set.exerciseName, date: datePart(set.completedAt), type: "load-pr", value: set.weightUsed, unit: "lb", set: perf, previousValue: profile.loadPr?.value, confidenceScore: 90 };
    profile.repPrs.push({ id: `${set.id}-rep-pr`, exerciseId: set.exerciseId, exerciseName: set.exerciseName, date: datePart(set.completedAt), type: "rep-pr", value: set.repsCompleted, unit: "reps", set: perf, confidenceScore: 80 });
    profile.lastPrDate = datePart(set.completedAt); profiles[set.exerciseId] = profile;
  }
  for (const profile of Object.values(profiles)) {
    for (const pr of [profile.estimatedOneRepMaxPr, profile.volumePr, profile.loadPr].filter(Boolean) as ExercisePR[]) if (pr.date === input.evaluationDate) newPrs.push(pr);
  }
  return { newPrs, exercisePrs: profiles };
}
function history(input: WorkoutEngineInput, decisions: WorkoutExerciseDecision[]): ExerciseHistorySummary[] {
  const allSets = input.workoutSessions.flatMap((session) => session.setLogs).concat(input.setLogs);
  const ids = [...new Set(allSets.map((set) => set.exerciseId))];
  return ids.map((exerciseId) => {
    const sets = allSets.filter((set) => set.exerciseId === exerciseId);
    const e1rms = sets.map((set) => calculateEstimatedOneRepMax(set)).filter((value): value is number => value !== null);
    return { exerciseId, exerciseName: sets[0]?.exerciseName ?? exerciseId, exposures: new Set(sets.map((set) => set.sessionId)).size, lastPerformedAt: sets.sort((a, b) => a.completedAt.localeCompare(b.completedAt)).at(-1)?.completedAt, averageSets: round1(sets.length / Math.max(1, new Set(sets.map((set) => set.sessionId)).size)), averageReps: round1(sets.reduce((s, set) => s + set.repsCompleted, 0) / Math.max(1, sets.length)), averageLoad: round1(sets.reduce((s, set) => s + set.weightUsed, 0) / Math.max(1, sets.length)), averageRpe: round1(sets.reduce((s, set) => s + set.rpe, 0) / Math.max(1, sets.length)), bestEstimatedOneRepMax: e1rms.length ? Math.max(...e1rms) : undefined, bestVolume: sets.length ? Math.max(...sets.map((set) => set.weightUsed * set.repsCompleted)) : undefined, recentTrend: "stable", lastDecision: decisions.find((d) => d.exerciseId === exerciseId)?.action, notes: [] };
  });
}
function overall(decisions: WorkoutExerciseDecision[], fatigue: WorkoutFatigueSummary, volume: MuscleGroupVolumeSummary[]): WorkoutProgressionDecision {
  const fatigueStatus = fatigue.fatigueStatus;
  if (decisions.some((d) => d.action === "Substitute")) return "Substitute";
  if (fatigueStatus === "severe" || volume.some((v) => v.status === "excessive")) return "Deload";
  if (decisions.filter((d) => d.action === "Reduce").length >= Math.max(1, Math.ceil(decisions.length / 2)) || fatigueStatus === "high") return "Reduce";
  if (decisions.some((d) => d.action === "Progress")) return "Progress";
  return "Repeat";
}

export function evaluateWorkout(input: WorkoutEngineInput): WorkoutEngineResult {
  const muscleGroupVolume = calculateMuscleGroupVolume(input);
  const fatigue = calculateFatigue(input, muscleGroupVolume);
  const confidenceScore = calculateWorkoutConfidenceScore(input);
  const dataQualityScore = calculateDataQualityScore(input);
  const exerciseDecisions = exerciseDecisionsInternal(input, fatigue, confidenceScore);
  const decision = overall(exerciseDecisions, fatigue, muscleGroupVolume);
  const rollingFourWeekVolume = calculateRollingFourWeekVolume(input);
  const prs = calculatePRs(input);
  const substitutions = exerciseDecisions.filter((item) => item.action === "Substitute").map((item): ExerciseSubstitutionDecision => ({ exerciseId: item.exerciseId, exerciseName: item.exerciseName, shouldSubstitute: true, substituteExerciseId: catalogForSet(input.setLogs.find((set) => set.exerciseId === item.exerciseId) ?? input.setLogs[0], input.exerciseCatalog).substitutionIds?.[0], reason: item.reason, trigger: "pain", confidenceScore: item.confidenceScore }));
  const over = muscleGroupVolume.filter((item) => item.status === "excessive").map((item) => item.muscleGroup);
  const deload: WorkoutDeloadDecision = { needed: decision === "Deload", scope: decision === "Deload" ? (over.length ? "muscle-group" : "full-body") : "none", targetMuscleGroups: over, reductionPercent: decision === "Deload" ? 40 : 0, durationDays: decision === "Deload" ? 7 : 0, reason: decision === "Deload" ? "Workout Engine V2 detected severe fatigue or excessive volume." : "No deload trigger met.", triggers: fatigue.drivers };
  const priority = input.goals.priorityMuscleGroups ?? [];
  const hypertrophyProgression: HypertrophyProgressionSummary = { action: decision, muscleGroupStatuses: muscleGroupVolume, priorityMuscleGroups: priority, productiveVolumeMuscleGroups: muscleGroupVolume.filter((v) => v.status === "productive").map((v) => v.muscleGroup), undertrainedMuscleGroups: muscleGroupVolume.filter((v) => v.status === "below-minimum").map((v) => v.muscleGroup), overreachedMuscleGroups: muscleGroupVolume.filter((v) => v.status === "excessive").map((v) => v.muscleGroup), recommendation: `Workout Engine V2 hypertrophy action: ${decision}.`, reason: "Based on weekly sets, execution quality, and fatigue." };
  const strengthProgression: StrengthProgressionSummary = { action: decision, estimatedOneRepMaxTrend: prs.newPrs.some((pr) => pr.type === "estimated-1rm") ? "improving" : "stable", exercisesProgressing: exerciseDecisions.filter((d) => d.action === "Progress").map((d) => d.exerciseName), exercisesStalled: exerciseDecisions.filter((d) => d.action === "Repeat").map((d) => d.exerciseName), exercisesRegressing: exerciseDecisions.filter((d) => d.action === "Reduce" || d.action === "Deload").map((d) => d.exerciseName), recommendation: `Workout Engine V2 strength action: ${decision}.`, reason: "Based on estimated 1RM, top-set execution, RPE, and missed reps." };
  const explanation: WorkoutExplanation = { summary: `Workout Engine V2 recommends ${decision}.`, primaryDrivers: [fatigue.fatigueStatus, ...exerciseDecisions.map((item) => `${item.exerciseName}: ${item.action}`)], blockers: exerciseDecisions.flatMap((item) => item.blockers), supportingSignals: [`${input.setLogs.length} sets logged`, `${muscleGroupVolume.length} muscle groups evaluated`], tradeoffs: ["Preserve UI compatibility through adapters while consolidating workout intelligence."], missingData: [!input.exerciseCatalog.length ? "Exercise catalog is missing." : "", !input.readiness ? "Readiness data is missing." : ""].filter(Boolean) };
  const workoutRecommendation: WorkoutRecommendation = { action: decision, summary: explanation.summary, nextWorkoutGuidance: decision === "Progress" ? "Progress key exercises with small load or rep increases." : decision === "Repeat" ? "Repeat current prescription until cleaner data supports progression." : decision === "Reduce" ? "Reduce load or volume for the limiting exercises." : decision === "Deload" ? "Reduce total lifting stress for 7 days." : "Substitute painful or unsuitable exercises next exposure.", loadGuidance: decision === "Progress" ? "Add 5 lb where appropriate." : decision === "Reduce" ? "Reduce load 5-10%." : undefined, volumeGuidance: decision === "Deload" ? "Reduce volume 40%." : undefined, exerciseGuidance: decision === "Substitute" ? "Choose pain-free movement-pattern substitutes." : undefined, recoveryGuidance: fatigue.recommendation, reason: explanation.primaryDrivers.join("; ") };
  const auditTrail: WorkoutAuditEntry[] = [{ id: `workout-${input.evaluationDate}-overall`, timestamp: input.generatedAt, decisionType: "overall-recommendation", action: decision, reason: workoutRecommendation.reason, dataUsed: ["set logs", "readiness", "volume", "exercise history"], thresholdsApplied: ["pain substitutes", "severe fatigue deload", "high RPE/missed reps reduce", "clean execution progress"], confidenceScore, dataQualityScore }, ...exerciseDecisions.map((item) => ({ id: `workout-${input.evaluationDate}-${item.exerciseId}`, timestamp: input.generatedAt, decisionType: "exercise-progression" as const, subjectId: item.exerciseId, subjectName: item.exerciseName, action: item.action, reason: item.reason, dataUsed: ["exercise set logs"], thresholdsApplied: ["RPE <=8", "no pain", "target reps hit"], confidenceScore: item.confidenceScore, dataQualityScore }))];
  return { generatedAt: input.generatedAt, evaluationDate: input.evaluationDate, overallDecision: decision, workoutRecommendation, exerciseDecisions, muscleGroupVolume, rollingFourWeekVolume, hypertrophyProgression, strengthProgression, fatigue, deload, substitutions, exerciseHistory: history(input, exerciseDecisions), prs, confidenceScore, dataQualityScore, explanation, auditTrail };
}
const exerciseDecisionsInternal = exerciseDecisions;

export function buildWorkoutEngineInputFromSession(input: { session: WorkoutSession; recovery?: { sorenessLevel?: number; sleepHours?: number }; history?: WorkoutSession[] }): WorkoutEngineInput {
  const setLogs = input.session.setLogs.map(toSetInput);
  const catalogMap = new Map<string, WorkoutExerciseDefinition>();
  for (const set of setLogs) {
    const primary = inferMuscleGroup(set.exerciseName);
    catalogMap.set(set.exerciseId, { id: set.exerciseId, name: set.exerciseName, primaryMuscleGroup: primary, secondaryMuscleGroups: secondaryFor(primary), movementPattern: primary === "chest" ? "horizontal-push" : primary === "back" ? "horizontal-pull" : primary === "legs" ? "squat" : "other", progressionType: "load", substitutionIds: [`${set.exerciseId}-substitute`] });
  }
  const evaluationDate = datePart(input.session.endedAt ?? input.session.startedAt);
  return { generatedAt: input.session.endedAt ?? input.session.startedAt, evaluationDate, userId: input.session.userId, currentSession: { id: input.session.id, date: evaluationDate, workoutId: input.session.workoutId, workoutTitle: input.session.workoutTitle, mode: input.session.mode, status: input.session.status, exercises: [] }, setLogs, workoutSessions: (input.history ?? [input.session]).map((session) => ({ id: session.id, date: datePart(session.endedAt ?? session.startedAt), workoutId: session.workoutId, workoutTitle: session.workoutTitle, status: session.status, setLogs: session.setLogs.map(toSetInput) })), exerciseCatalog: [...catalogMap.values()], readiness: { status: input.recovery?.sorenessLevel !== undefined && input.recovery.sorenessLevel >= 9 || input.recovery?.sleepHours !== undefined && input.recovery.sleepHours < 5 ? "Red" : input.recovery?.sorenessLevel !== undefined && input.recovery.sorenessLevel >= 8 || input.recovery?.sleepHours !== undefined && input.recovery.sleepHours < 6 ? "Yellow" : "Green", score: 80, sleepHours: input.recovery?.sleepHours, soreness: input.recovery?.sorenessLevel, confidence: "Medium" }, recovery: { sleepHours: input.recovery?.sleepHours }, goals: { primaryGoal: "hybrid", physiqueGoal: "Greek God physique", fatLossPhase: true, priorityMuscleGroups: ["chest", "back", "shoulders"] } };
}

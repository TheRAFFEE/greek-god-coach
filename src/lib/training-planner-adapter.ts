import { buildDailyTrainingSession, type BuildDailyTrainingSessionInput, type DailyTrainingSession } from "./training-planner";
import { workouts as seedWorkouts } from "./seed-data";
import { todayIso } from "./storage";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { PerformanceEngineResult } from "./performance-engine";
import type { PhysiqueEngineResult } from "./physique-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { RaceCalendarEngineResult } from "./race-calendar-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { RunningEngineResult } from "./running-engine";
import type { AppState, RunningRecommendation, Workout } from "./types";

export interface BuildPlannerSessionFromAppStateInput {
  state: AppState;
  date?: string;
  selectedWeek?: number | null;
  currentWeek?: number | null;
  workouts?: Workout[];
  readinessResult?: ReadinessEngineResult | null;
  progressionResult?: ProgressionEngineResult | null;
  goalTrackingResult?: GoalTrackingEngineResult | null;
  runningEngineResult?: RunningEngineResult | null;
  runningRecommendation?: RunningRecommendation | null;
  performanceResult?: PerformanceEngineResult | null;
  physiqueResult?: PhysiqueEngineResult | null;
  raceCalendarResult?: RaceCalendarEngineResult | null;
  userPreferences?: BuildDailyTrainingSessionInput["userPreferences"];
}

export interface PlannerLegacyComparisonInput {
  plannerSession: DailyTrainingSession;
  legacyWorkout?: string | { title?: string | null; workoutTitle?: string | null; name?: string | null } | null;
  legacyRun?: string | { title?: string | null; label?: string | null; name?: string | null } | null;
}

export interface PlannerLegacyComparison {
  plannerWorkout: string | null;
  legacyWorkout: string | null;
  plannerRun: string | null;
  legacyRun: string | null;
  workoutMatch: boolean;
  runMatch: boolean;
}

function fallbackReadiness(): ReadinessEngineResult {
  return {
    score: 60,
    status: "Yellow",
    confidence: "Low",
    reasons: [{ factor: "data_quality", severity: "yellow", points: -10, message: "Planner adapter did not receive a readiness result." }],
    reason: "Planner adapter did not receive a readiness result.",
    recommendation: "Complete Daily Check-In before relying on planner shadow output.",
    recommendationType: "modified_training",
    trainingGuidance: "Shadow planner output only; keep legacy runtime behavior unchanged.",
    recoveryGuidance: ["Complete Daily Check-In."],
    dataQualityWarnings: ["Missing readiness result for planner adapter."],
  };
}

function fallbackProgression(): ProgressionEngineResult {
  return {
    weeklyDecision: "Repeat",
    nutritionDecision: "Maintain Calories",
    goalStatus: { "Fat Loss": "At Risk", Physique: "At Risk", Strength: "At Risk", "Half Marathon": "At Risk" },
    confidence: "Low",
    dataQuality: { score: 40, confidence: "Low", missingInputs: ["progressionResult"], penalties: [], warnings: ["Missing progression result for planner adapter."] },
    reasons: ["Planner adapter did not receive a progression result."],
    warnings: ["Missing progression result for planner adapter."],
    auditEntries: [],
  };
}

function fallbackGoalTracking(): GoalTrackingEngineResult {
  return {
    overallStatus: "Insufficient Data",
    overallScore: 0,
    confidence: "Low",
    dataQualityScore: 40,
    goals: {
      fatLoss: { domain: "fat_loss", status: "Insufficient Data", score: 0, confidence: "Low", currentValue: "unknown", targetValue: "199.9", trend: "unknown", blockers: ["Missing goal tracking result"], supportingSignals: [], recommendation: "Keep logging.", explanation: "Planner adapter did not receive goal tracking output." },
      physique: { domain: "physique", status: "Insufficient Data", score: 0, confidence: "Low", currentValue: "unknown", targetValue: "Greek God", trend: "unknown", blockers: ["Missing goal tracking result"], supportingSignals: [], recommendation: "Keep logging.", explanation: "Planner adapter did not receive goal tracking output." },
      strength: { domain: "strength", status: "Insufficient Data", score: 0, confidence: "Low", currentValue: "unknown", targetValue: "progress", trend: "unknown", blockers: ["Missing goal tracking result"], supportingSignals: [], recommendation: "Keep logging.", explanation: "Planner adapter did not receive goal tracking output." },
      halfMarathon: { domain: "half_marathon", status: "Insufficient Data", score: 0, confidence: "Low", currentValue: "unknown", targetValue: "13.1", trend: "unknown", blockers: ["Missing goal tracking result"], supportingSignals: [], recommendation: "Keep logging.", explanation: "Planner adapter did not receive goal tracking output." },
    },
    priorityGoal: "half_marathon",
    summary: "Planner adapter is missing goal tracking output.",
    recommendations: ["Keep logging."],
    warnings: ["Missing goal tracking result for planner adapter."],
    explanations: ["Fallback low-confidence goal tracking was used for shadow planner output only."],
    auditTrail: [],
  };
}

export function buildDailyTrainingSessionInputFromAppState(input: BuildPlannerSessionFromAppStateInput): BuildDailyTrainingSessionInput {
  const date = input.date ?? todayIso();
  const currentWeek = input.selectedWeek ?? input.currentWeek ?? input.state.currentWeek;
  return {
    date,
    currentWeek,
    workouts: [...(input.workouts ?? seedWorkouts)],
    readinessResult: input.readinessResult ?? fallbackReadiness(),
    progressionResult: input.progressionResult ?? fallbackProgression(),
    goalTrackingResult: input.goalTrackingResult ?? fallbackGoalTracking(),
    runningEngineResult: input.runningEngineResult ?? null,
    runningRecommendation: input.runningRecommendation ?? null,
    userPreferences: input.userPreferences ?? { includeWarmup: true, includeCooldown: true },
    completedWorkoutSessions: [...(input.state.workoutSessions ?? [])],
    completedRunLogs: [...(input.state.runLogs ?? [])],
  };
}

export function buildPlannerSessionFromAppState(input: BuildPlannerSessionFromAppStateInput): DailyTrainingSession {
  return buildDailyTrainingSession(buildDailyTrainingSessionInputFromAppState(input));
}

function normalizeLegacyWorkout(value: PlannerLegacyComparisonInput["legacyWorkout"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return value || null;
  return value.title ?? value.workoutTitle ?? value.name ?? null;
}

function normalizeLegacyRun(value: PlannerLegacyComparisonInput["legacyRun"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return value || null;
  return value.title ?? value.label ?? value.name ?? null;
}

function comparableRunName(value: string | null): string | null {
  return value?.replace(/^Optional:\s*/i, "").replace(/\s+—\s+\d+(?:\.\d+)?\s*mi$/i, "").trim() || null;
}

export function comparePlannerVsLegacy(input: PlannerLegacyComparisonInput): PlannerLegacyComparison {
  const plannerWorkout = input.plannerSession.summary.workoutName;
  const legacyWorkout = normalizeLegacyWorkout(input.legacyWorkout);
  const plannerRun = input.plannerSession.run?.title ?? input.plannerSession.summary.runName;
  const legacyRun = normalizeLegacyRun(input.legacyRun);
  return {
    plannerWorkout,
    legacyWorkout,
    plannerRun,
    legacyRun,
    workoutMatch: (plannerWorkout ?? null) === (legacyWorkout ?? null),
    runMatch: comparableRunName(plannerRun) === comparableRunName(legacyRun),
  };
}

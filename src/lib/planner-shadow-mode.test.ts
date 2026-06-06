import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildDailyTrainingSession, type BuildDailyTrainingSessionInput, type DailyTrainingSession } from "./training-planner";
import { runPlannerShadowComparison, type PlannerShadowComparableOutput } from "./planner-shadow-mode";
import { workouts } from "./seed-data";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";

const readiness = (status: "Green" | "Yellow" | "Red" = "Green"): ReadinessEngineResult => ({
  score: status === "Green" ? 90 : status === "Yellow" ? 60 : 30,
  status,
  confidence: "High",
  reasons: [],
  reason: `${status} readiness`,
  recommendation: status === "Green" ? "Train normally" : status === "Yellow" ? "Modify" : "Recover",
  recommendationType: status === "Green" ? "full_training" : status === "Yellow" ? "modified_training" : "recovery_focus",
  trainingGuidance: status === "Red" ? "Recovery only" : "Train",
  recoveryGuidance: [],
  dataQualityWarnings: [],
});

const progression: ProgressionEngineResult = {
  weeklyDecision: "Progress",
  nutritionDecision: "Maintain Calories",
  goalStatus: { "Fat Loss": "On Track", Physique: "On Track", Strength: "On Track", "Half Marathon": "On Track" },
  confidence: "High",
  dataQuality: { score: 95, confidence: "High", missingInputs: [], penalties: [], warnings: [] },
  reasons: [],
  warnings: [],
  auditEntries: [],
};

const goalTracking: GoalTrackingEngineResult = {
  overallStatus: "On Track",
  overallScore: 90,
  confidence: "High",
  dataQualityScore: 95,
  goals: {
    fatLoss: { domain: "fat_loss", status: "On Track", score: 90, confidence: "High", currentValue: "ok", targetValue: "ok", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue", explanation: "On track" },
    physique: { domain: "physique", status: "On Track", score: 90, confidence: "High", currentValue: "ok", targetValue: "ok", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue", explanation: "On track" },
    strength: { domain: "strength", status: "On Track", score: 90, confidence: "High", currentValue: "ok", targetValue: "ok", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue", explanation: "On track" },
    halfMarathon: { domain: "half_marathon", status: "On Track", score: 90, confidence: "High", currentValue: "ok", targetValue: "ok", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue", explanation: "On track" },
  },
  priorityGoal: "half_marathon",
  summary: "On track",
  recommendations: ["Continue"],
  warnings: [],
  explanations: [],
  auditTrail: [],
};

function plannerInput(overrides: Partial<BuildDailyTrainingSessionInput> = {}): BuildDailyTrainingSessionInput {
  return {
    date: "2026-06-06",
    currentWeek: 1,
    workouts,
    readinessResult: readiness("Green"),
    progressionResult: progression,
    goalTrackingResult: goalTracking,
    userPreferences: { includeWarmup: true, includeCooldown: true },
    ...overrides,
  };
}

function session(overrides: Partial<BuildDailyTrainingSessionInput> = {}): DailyTrainingSession {
  return buildDailyTrainingSession(plannerInput(overrides));
}

function legacyFromSession(plannerSession: DailyTrainingSession, overrides: Partial<PlannerShadowComparableOutput> = {}): PlannerShadowComparableOutput {
  return {
    sessionType: plannerSession.run?.type === "long" ? "LongRunDay" : plannerSession.run ? "RunDay" : plannerSession.workout ? "LiftDay" : plannerSession.recovery ? "RecoveryDay" : plannerSession.mobility ? "MobilityDay" : "UnavailableDay",
    workoutTitle: plannerSession.workout?.title ?? null,
    runTitle: plannerSession.run?.title ?? null,
    hasRunLoggingTarget: Boolean(plannerSession.run?.loggingTarget),
    hasWorkoutLoggingTarget: Boolean(plannerSession.workout?.loggingTarget),
    estimatedDurationMinutes: plannerSession.estimatedDurationMinutes,
    sessionStress: plannerSession.combinedLoad.sessionStress,
    recoveryOverrideActive: plannerSession.status === "Recovery",
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("shadow mode cannot mutate state", () => {
  const plannerSession = session();
  const state = { runLogs: [{ id: "run-1", distance: 3 }], workoutSessions: [{ id: "workout-1" }] };
  const before = JSON.stringify(state);
  const result = runPlannerShadowComparison({ plannerSession, legacy: legacyFromSession(plannerSession), runtimeGuards: { state } });
  assert.equal(JSON.stringify(state), before);
  assert.equal(result.runtimeMutationAttempted, false);
  assert.equal(result.advisoryOnly, true);
});

test("shadow mode cannot write logs", () => {
  const plannerSession = session();
  const logs = { runLogs: [{ id: "run-1" }], workoutLogs: [{ id: "lift-1" }] };
  const before = clone(logs);
  runPlannerShadowComparison({ plannerSession, legacy: legacyFromSession(plannerSession), runtimeGuards: { logs } });
  assert.deepEqual(logs, before);
});

test("shadow mode cannot modify recommendations", () => {
  const plannerSession = session();
  const recommendations = { primary: "Legacy recommendation", actions: ["Do legacy plan"] };
  const before = clone(recommendations);
  runPlannerShadowComparison({ plannerSession, legacy: legacyFromSession(plannerSession), runtimeGuards: { recommendations } });
  assert.deepEqual(recommendations, before);
});

test("shadow mode cannot modify Home output", () => {
  const plannerSession = session();
  const homeOutput = { title: "Legacy Home", primaryCta: "Start legacy workout" };
  const before = clone(homeOutput);
  runPlannerShadowComparison({ plannerSession, legacy: legacyFromSession(plannerSession), runtimeGuards: { homeOutput } });
  assert.deepEqual(homeOutput, before);
});

test("shadow mode cannot modify Train output", () => {
  const plannerSession = session();
  const trainOutput = { blocks: ["Warmup", "Legacy Run", "Cooldown"] };
  const before = clone(trainOutput);
  runPlannerShadowComparison({ plannerSession, legacy: legacyFromSession(plannerSession), runtimeGuards: { trainOutput } });
  assert.deepEqual(trainOutput, before);
});

test("shadow mode cannot modify Log output", () => {
  const plannerSession = session();
  const logOutput = { sections: ["Daily Check-In", "Nutrition", "Body Metrics", "Progress Photos"] };
  const before = clone(logOutput);
  runPlannerShadowComparison({ plannerSession, legacy: legacyFromSession(plannerSession), runtimeGuards: { logOutput } });
  assert.deepEqual(logOutput, before);
});

test("shadow mode returns deterministic comparison results", () => {
  const input = plannerInput();
  const plannerSession = session();
  const legacy = legacyFromSession(plannerSession);
  const first = runPlannerShadowComparison({ plannerInput: input, legacy });
  const second = runPlannerShadowComparison({ plannerInput: input, legacy });
  assert.deepEqual(first, second);
});

test("long-run removal becomes CRITICAL", () => {
  const plannerSession = session({ readinessResult: readiness("Red") });
  const result = runPlannerShadowComparison({
    plannerSession,
    legacy: {
      sessionType: "LongRunDay",
      workoutTitle: null,
      runTitle: "Long Run — 3 mi",
      hasRunLoggingTarget: true,
      hasWorkoutLoggingTarget: false,
      estimatedDurationMinutes: 45,
      sessionStress: "Moderate",
      recoveryOverrideActive: false,
    },
  });
  assert.ok(result.mismatches.some((mismatch) => mismatch.severity === "CRITICAL" && mismatch.field === "runLoggingTarget"));
});

test("workout removal becomes CRITICAL", () => {
  const plannerSession = session({ date: "2026-06-01", readinessResult: readiness("Red") });
  const result = runPlannerShadowComparison({
    plannerSession,
    legacy: {
      sessionType: "LiftDay",
      workoutTitle: "Upper Strength + Sprints + Core",
      runTitle: null,
      hasRunLoggingTarget: false,
      hasWorkoutLoggingTarget: true,
      estimatedDurationMinutes: 75,
      sessionStress: "High",
      recoveryOverrideActive: false,
    },
  });
  assert.ok(result.mismatches.some((mismatch) => mismatch.severity === "CRITICAL" && mismatch.field === "workoutLoggingTarget"));
});

test("naming differences become WARNING", () => {
  const plannerSession = session();
  const result = runPlannerShadowComparison({ plannerSession, legacy: legacyFromSession(plannerSession, { runTitle: "Legacy Long Run Name" }) });
  assert.ok(result.mismatches.some((mismatch) => mismatch.severity === "WARNING" && mismatch.field === "runTitle"));
  assert.equal(result.criticalCount, 0);
});

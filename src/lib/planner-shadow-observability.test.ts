import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  buildPlannerShadowObservabilityPanel,
  isPlannerDebugEnabled,
  renderPlannerShadowPanelText,
  toLegacyComparableFromTrainingEngine,
  type PlannerShadowObservabilityRuntimeOutput,
} from "./planner-shadow-observability";
import { buildDailyTrainingSession, type DailyTrainingSession } from "./training-planner";
import { workouts } from "./seed-data";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { TrainingEngineResult } from "./training-engine";

const readinessResult: ReadinessEngineResult = {
  score: 90,
  status: "Green",
  confidence: "High",
  reasons: [],
  reason: "Green readiness",
  recommendation: "Train normally",
  recommendationType: "full_training",
  trainingGuidance: "Full session",
  recoveryGuidance: [],
  dataQualityWarnings: [],
};

const progressionResult: ProgressionEngineResult = {
  weeklyDecision: "Progress",
  nutritionDecision: "Maintain Calories",
  goalStatus: { "Fat Loss": "On Track", Physique: "On Track", Strength: "On Track", "Half Marathon": "On Track" },
  confidence: "High",
  dataQuality: { score: 95, confidence: "High", missingInputs: [], penalties: [], warnings: [] },
  reasons: [],
  warnings: [],
  auditEntries: [],
};

const goal = (domain: GoalTrackingEngineResult["goals"]["fatLoss"]["domain"]): GoalTrackingEngineResult["goals"]["fatLoss"] => ({
  domain,
  status: "On Track",
  score: 90,
  confidence: "High",
  currentValue: "ok",
  targetValue: "ok",
  trend: "improving",
  blockers: [],
  supportingSignals: [],
  recommendation: "Continue",
  explanation: "On track",
});

const goalTrackingResult: GoalTrackingEngineResult = {
  overallStatus: "On Track",
  overallScore: 90,
  confidence: "High",
  dataQualityScore: 95,
  goals: {
    fatLoss: goal("fat_loss"),
    physique: goal("physique"),
    strength: goal("strength"),
    halfMarathon: goal("half_marathon"),
  },
  priorityGoal: "half_marathon",
  summary: "On track",
  recommendations: ["Continue"],
  warnings: [],
  explanations: [],
  auditTrail: [],
};

function plannerSession(): DailyTrainingSession {
  return buildDailyTrainingSession({
    date: "2026-06-06",
    currentWeek: 1,
    workouts,
    readinessResult,
    progressionResult,
    goalTrackingResult,
    userPreferences: { includeWarmup: true, includeCooldown: true },
  });
}

function trainingEngineResult(): TrainingEngineResult {
  return {
    todayPlan: [],
    warmup: null,
    workout: null,
    run: { kind: "run", title: "Legacy long run label", description: "Legacy run", items: [], estimatedMinutes: 33, source: "Training Engine" },
    cooldown: null,
    sessionOrder: ["run"],
    estimatedDuration: { warmupMinutes: 0, workoutMinutes: 0, runMinutes: 33, cooldownMinutes: 0, mobilityMinutes: 0, walkMinutes: 0, totalEstimatedMinutes: 33 },
    priorityActions: [],
    warnings: [],
    trainingStatus: "Normal",
    confidence: "High",
    auditTrail: [],
  };
}

function runtimeOutputs(): PlannerShadowObservabilityRuntimeOutput {
  return {
    homeOutput: { title: "Home legacy output", cta: "Start Workout" },
    trainOutput: { blocks: ["Legacy Run"] },
    logOutput: { sections: ["Daily Check-In", "Nutrition", "Body Metrics", "Progress Photos"] },
    recommendations: { recommendation: "Legacy recommendation" },
    runtimeState: { runLogs: [{ id: "run-1" }], workoutSessions: [] },
  };
}

test("Developer panel hidden by default", () => {
  const panel = buildPlannerShadowObservabilityPanel({
    debug: { queryDebugPlanner: false, localStoragePlannerDebug: false, developerToggle: false },
    plannerSession: plannerSession(),
    legacy: toLegacyComparableFromTrainingEngine(trainingEngineResult()),
    timestamp: "2026-06-04T12:00:00.000Z",
    runtimeOutputs: runtimeOutputs(),
  });

  assert.equal(panel.visible, false);
  assert.equal(panel.comparison, null);
});

test("Panel appears only in query/developer debug mode", () => {
  assert.equal(isPlannerDebugEnabled({ queryDebugPlanner: true }), true);
  assert.equal(isPlannerDebugEnabled({ localStoragePlannerDebug: true }), false);
  assert.equal(isPlannerDebugEnabled({ developerToggle: true }), true);
  assert.equal(isPlannerDebugEnabled({ queryDebugPlanner: false, localStoragePlannerDebug: false, developerToggle: false }), false);

  const panel = buildPlannerShadowObservabilityPanel({
    debug: { queryDebugPlanner: true },
    plannerSession: plannerSession(),
    legacy: toLegacyComparableFromTrainingEngine(trainingEngineResult()),
    timestamp: "2026-06-04T12:00:00.000Z",
    runtimeOutputs: runtimeOutputs(),
  });

  assert.equal(panel.visible, true);
  assert.ok(panel.comparison);
});

test("Planner output remains advisory only", () => {
  const panel = buildPlannerShadowObservabilityPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession(), legacy: toLegacyComparableFromTrainingEngine(trainingEngineResult()), timestamp: "2026-06-04T12:00:00.000Z", runtimeOutputs: runtimeOutputs() });

  assert.equal(panel.comparison?.advisoryOnly, true);
  assert.equal(panel.comparison?.plannerShownToUser, false);
  assert.equal(panel.comparison?.affectsRecommendations, false);
  assert.equal(panel.comparison?.affectsHome, false);
  assert.equal(panel.comparison?.affectsTrain, false);
  assert.equal(panel.comparison?.affectsLog, false);
});

test("Planner cannot mutate runtime state", () => {
  const outputs = runtimeOutputs();
  const before = JSON.stringify(outputs);
  const panel = buildPlannerShadowObservabilityPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession(), legacy: toLegacyComparableFromTrainingEngine(trainingEngineResult()), timestamp: "2026-06-04T12:00:00.000Z", runtimeOutputs: outputs });

  assert.equal(JSON.stringify(outputs), before);
  assert.equal(panel.comparison?.runtimeMutationAttempted, false);
});

test("Planner comparison executes", () => {
  const panel = buildPlannerShadowObservabilityPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession(), legacy: toLegacyComparableFromTrainingEngine(trainingEngineResult()), timestamp: "2026-06-04T12:00:00.000Z", runtimeOutputs: runtimeOutputs() });

  assert.equal(panel.rows.find((row) => row.label === "Legacy Session Type")?.value, "LongRunDay");
  assert.equal(panel.rows.find((row) => row.label === "Planner Session Type")?.value, "LongRunDay");
  assert.equal(panel.rows.find((row) => row.label === "Timestamp")?.value, "2026-06-04T12:00:00.000Z");
  assert.match(renderPlannerShadowPanelText(panel), /Planner Shadow Comparison/);
});

test("Existing Home output unchanged", () => {
  const outputs = runtimeOutputs();
  const before = JSON.stringify(outputs.homeOutput);
  buildPlannerShadowObservabilityPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession(), legacy: toLegacyComparableFromTrainingEngine(trainingEngineResult()), timestamp: "2026-06-04T12:00:00.000Z", runtimeOutputs: outputs });
  assert.equal(JSON.stringify(outputs.homeOutput), before);
});

test("Existing Train output unchanged", () => {
  const outputs = runtimeOutputs();
  const before = JSON.stringify(outputs.trainOutput);
  buildPlannerShadowObservabilityPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession(), legacy: toLegacyComparableFromTrainingEngine(trainingEngineResult()), timestamp: "2026-06-04T12:00:00.000Z", runtimeOutputs: outputs });
  assert.equal(JSON.stringify(outputs.trainOutput), before);
});

test("Existing Log output unchanged", () => {
  const outputs = runtimeOutputs();
  const before = JSON.stringify(outputs.logOutput);
  buildPlannerShadowObservabilityPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession(), legacy: toLegacyComparableFromTrainingEngine(trainingEngineResult()), timestamp: "2026-06-04T12:00:00.000Z", runtimeOutputs: outputs });
  assert.equal(JSON.stringify(outputs.logOutput), before);
});

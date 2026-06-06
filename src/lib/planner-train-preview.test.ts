import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildDailyTrainingSession, type BuildDailyTrainingSessionInput, type DailyTrainingSession } from "./training-planner";
import { workouts } from "./seed-data";
import {
  buildPlannerTrainPreviewPanel,
  renderPlannerTrainPreviewText,
  type PlannerTrainPreviewRuntimeGuards,
} from "./planner-train-preview";
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

function plannerSession(date: string, currentWeek = 1, status: "Green" | "Yellow" | "Red" = "Green"): DailyTrainingSession {
  const input: BuildDailyTrainingSessionInput = {
    date,
    currentWeek,
    workouts,
    readinessResult: readiness(status),
    progressionResult: progression,
    goalTrackingResult: goalTracking,
    userPreferences: { includeWarmup: true, includeCooldown: true },
  };
  return buildDailyTrainingSession(input);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("Planner Train Preview hidden by default", () => {
  const panel = buildPlannerTrainPreviewPanel({ debug: {}, plannerSession: plannerSession("2026-06-03") });
  assert.equal(panel.visible, false);
  assert.equal(renderPlannerTrainPreviewText(panel), "");
});

test("Planner Train Preview appears only in query/developer debug mode", () => {
  assert.equal(buildPlannerTrainPreviewPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-03") }).visible, true);
  assert.equal(buildPlannerTrainPreviewPanel({ debug: { localStoragePlannerDebug: true }, plannerSession: plannerSession("2026-06-03") }).visible, false);
  assert.equal(buildPlannerTrainPreviewPanel({ debug: {}, plannerSession: plannerSession("2026-06-03") }).visible, false);
});

test("Zone 2 + Mobility + Core preview is RunDay not LiftDay or HybridDay", () => {
  const panel = buildPlannerTrainPreviewPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-03", 1) });
  assert.equal(panel.preview?.sessionType, "RunDay");
  assert.notEqual(panel.preview?.sessionType, "LiftDay");
  assert.notEqual(panel.preview?.sessionType, "HybridDay");
  assert.deepEqual(panel.preview?.allowedBlocks, ["Warmup", "Run", "Mobility", "Cooldown"]);
  assert.equal(panel.preview?.workoutTarget, "None");
  assert.match(panel.preview?.runTarget ?? "", /Zone 2/i);
  assert.equal(panel.preview?.runLogging, "Required");
  assert.equal(panel.preview?.liftLogging, "None");
});

test("Heavy Upper + Sprints + Core preview is LiftDay with conditioning and no run target/logging", () => {
  const panel = buildPlannerTrainPreviewPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-01", 5) });
  assert.equal(panel.preview?.sessionType, "LiftDay");
  assert.equal(panel.preview?.primarySession, "LiftDay");
  assert.ok(panel.preview?.allowedBlocks.includes("Conditioning"));
  assert.equal(panel.preview?.workoutTarget, "Heavy Upper + Sprints + Core");
  assert.notEqual(panel.preview?.conditioningTarget, "None");
  assert.equal(panel.preview?.runTarget, "None");
  assert.equal(panel.preview?.runLogging, "None");
  assert.equal(panel.preview?.liftLogging, "Required");
});

test("Long Run preview is LongRunDay", () => {
  const panel = buildPlannerTrainPreviewPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-06", 1) });
  assert.equal(panel.preview?.sessionType, "LongRunDay");
  assert.equal(panel.preview?.primarySession, "LongRunDay");
  assert.match(panel.preview?.runTarget ?? "", /Long Run/i);
  assert.equal(panel.preview?.runLogging, "Required");
});

test("Recovery preview is RecoveryDay", () => {
  const panel = buildPlannerTrainPreviewPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-07", 1) });
  assert.equal(panel.preview?.sessionType, "RecoveryDay");
  assert.equal(panel.preview?.primarySession, "RecoveryDay");
  assert.equal(panel.preview?.stressRating, "Recovery");
});

test("Preview consumes explicit planner session type and deload metadata", () => {
  const panel = buildPlannerTrainPreviewPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-01", 4) });
  assert.equal(panel.preview?.sessionType, "LiftDay");
  assert.equal(panel.preview?.primarySession, "LiftDay");
  assert.equal(panel.preview?.deload, true);
  assert.notEqual(panel.preview?.sessionType, "DeloadDay");
  assert.equal(panel.rows.find((row) => row.label === "Deload")?.value, "true");
});

test("Planner Train Preview is advisory only and read only", () => {
  const panel = buildPlannerTrainPreviewPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-03") });
  assert.equal(panel.developerOnly, true);
  assert.equal(panel.readOnly, true);
  assert.equal(panel.advisoryOnly, true);
  assert.equal(panel.affectsHome, false);
  assert.equal(panel.affectsTrain, false);
  assert.equal(panel.affectsLog, false);
  assert.equal(panel.affectsRecommendations, false);
  assert.equal(panel.affectsProgression, false);
  assert.equal(panel.affectsReadiness, false);
  assert.equal(panel.affectsLogs, false);
});

test("Planner Train Preview cannot mutate state, logs, recommendations, readiness, progression, Home, Train, or Log", () => {
  const guards: PlannerTrainPreviewRuntimeGuards = {
    state: { active: "Train", count: 1 },
    logs: { runLogs: [{ id: "run-1" }], workoutLogs: [{ id: "lift-1" }] },
    recommendations: { primary: "Legacy recommendation" },
    readiness: { status: "Green" },
    progression: { weeklyDecision: "Progress" },
    homeOutput: { title: "Legacy Home" },
    trainOutput: { title: "Legacy Train" },
    logOutput: { sections: ["Daily Check-In"] },
  };
  const before = clone(guards);
  const panel = buildPlannerTrainPreviewPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-03"), runtimeGuards: guards });
  assert.deepEqual(guards, before);
  assert.equal(panel.runtimeMutationAttempted, false);
});

test("rendered preview output contains requested fields", () => {
  const panel = buildPlannerTrainPreviewPanel({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-03"), timestamp: "2026-06-04T12:00:00.000Z" });
  const text = renderPlannerTrainPreviewText(panel);
  assert.match(text, /Planner Train Preview/);
  assert.match(text, /Session Type: RunDay/);
  assert.match(text, /Primary Session: RunDay/);
  assert.match(text, /Allowed Blocks: Warmup, Run, Mobility, Cooldown/);
  assert.match(text, /Workout Target: None/);
  assert.match(text, /Run Target:/);
  assert.match(text, /Estimated Duration:/);
  assert.match(text, /Stress Rating:/);
  assert.match(text, /Warnings:/);
  assert.match(text, /Confidence: High/);
});

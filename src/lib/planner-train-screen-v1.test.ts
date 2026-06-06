import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildDailyTrainingSession, type DailyTrainingSession, type BuildDailyTrainingSessionInput } from "./training-planner";
import { workouts } from "./seed-data";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import {
  buildPlannerTrainScreenV1,
  renderPlannerTrainScreenV1Text,
  shouldRenderLegacyPlannerShadowPanel,
  type PlannerTrainScreenV1RuntimeGuards,
} from "./planner-train-screen-v1";

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

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

test("PlannerTrainScreenV1 is hidden by default and visible only in debug mode", () => {
  const hidden = buildPlannerTrainScreenV1({ debug: {}, plannerSession: plannerSession("2026-06-03") });
  assert.equal(hidden.visible, false);
  assert.equal(renderPlannerTrainScreenV1Text(hidden), "");
  assert.equal(buildPlannerTrainScreenV1({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-03") }).visible, true);
  assert.equal(buildPlannerTrainScreenV1({ debug: { localStoragePlannerDebug: true }, plannerSession: plannerSession("2026-06-03") }).visible, false);
});

test("Zone 2 + Mobility + Core renders primary Run, support Mobility and Core, and run logging only", () => {
  const screen = buildPlannerTrainScreenV1({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-03", 1), timestamp: "2026-06-04T12:00:00.000Z" });
  assert.equal(screen.topCard.sessionType, "RunDay");
  assert.equal(screen.primaryPrescription.kind, "Run");
  assert.equal(screen.primaryPrescription.title, "Zone 2");
  assert.doesNotMatch(screen.primaryPrescription.title, /Mobility|Core/i);
  assert.ok(screen.supportWork.some((item) => item.kind === "Mobility"));
  assert.ok(screen.supportWork.some((item) => item.kind === "Core"));
  assert.equal(screen.logging.showRunLogging, true);
  assert.equal(screen.logging.showLiftLogging, false);
  assert.doesNotMatch(renderPlannerTrainScreenV1Text(screen), /Data confidence|Missing data|audit|raw planner/i);
});

test("Heavy Upper + Sprints + Core renders primary Heavy Upper, support Conditioning and Core, and lift logging only", () => {
  const screen = buildPlannerTrainScreenV1({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-01", 5) });
  assert.equal(screen.topCard.sessionType, "LiftDay");
  assert.equal(screen.primaryPrescription.kind, "Lift");
  assert.equal(screen.primaryPrescription.title, "Heavy Upper");
  assert.doesNotMatch(screen.primaryPrescription.title, /Sprints|Core/i);
  assert.ok(screen.supportWork.some((item) => item.kind === "Conditioning"));
  assert.ok(screen.supportWork.some((item) => item.kind === "Core"));
  assert.equal(screen.logging.showRunLogging, false);
  assert.equal(screen.logging.showLiftLogging, true);
});

test("Long Run renders primary Long Run and run logging only", () => {
  const screen = buildPlannerTrainScreenV1({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-06", 1) });
  assert.equal(screen.topCard.sessionType, "LongRunDay");
  assert.equal(screen.primaryPrescription.kind, "Run");
  assert.match(screen.primaryPrescription.title, /Long Run/i);
  assert.equal(screen.logging.showRunLogging, true);
  assert.equal(screen.logging.showLiftLogging, false);
});

test("Recovery renders Recovery and no logging", () => {
  const screen = buildPlannerTrainScreenV1({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-07", 1) });
  assert.equal(screen.topCard.sessionType, "RecoveryDay");
  assert.equal(screen.primaryPrescription.kind, "Recovery");
  assert.equal(screen.logging.showRunLogging, false);
  assert.equal(screen.logging.showLiftLogging, false);
});

test("Core support uses planner support extraction and does not change logging", () => {
  const screen = buildPlannerTrainScreenV1({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-02", 5) });
  const core = screen.supportWork.find((item) => item.kind === "Core");
  assert.equal(screen.topCard.sessionType, "LiftDay");
  assert.deepEqual(core?.items, ["5. Loaded Carries: 4 x 1 round"]);
  assert.equal(screen.logging.showLiftLogging, true);
  assert.equal(screen.logging.showRunLogging, false);
});

test("Deload displays as metadata and never replaces the session type", () => {
  const screen = buildPlannerTrainScreenV1({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-01", 4) });
  assert.equal(screen.topCard.sessionType, "LiftDay");
  assert.equal(screen.topCard.deload, true);
  assert.notEqual(screen.topCard.sessionType, "DeloadDay");
  assert.equal(screen.logging.showLiftLogging, true);
  assert.equal(screen.logging.showRunLogging, false);
  assert.match(renderPlannerTrainScreenV1Text(screen), /Deload: true/);
});

test("developer comparison is hidden by default and contains legacy/planner fields", () => {
  const screen = buildPlannerTrainScreenV1({
    debug: { queryDebugPlanner: true },
    plannerSession: plannerSession("2026-06-03", 1),
    legacySession: { sessionType: "RunDay", warnings: ["legacy warning"] },
  });
  assert.equal(screen.comparison.hiddenByDefault, true);
  assert.equal(screen.comparison.legacySession, "RunDay");
  assert.equal(screen.comparison.plannerSession, "RunDay");
  assert.equal(screen.comparison.match, true);
  assert.deepEqual(screen.comparison.warnings, ["legacy warning"]);
});

test("PlannerTrainScreenV1 containment hides the old shadow panel only while the Train preview is active", () => {
  assert.equal(shouldRenderLegacyPlannerShadowPanel({
    plannerDebugEnabled: true,
    legacyShadowPanelVisible: true,
    plannerTrainScreenV1Visible: true,
    activeScreen: "Train",
  }), false);
  assert.equal(shouldRenderLegacyPlannerShadowPanel({
    plannerDebugEnabled: true,
    legacyShadowPanelVisible: true,
    plannerTrainScreenV1Visible: false,
    activeScreen: "Train",
  }), true);
  assert.equal(shouldRenderLegacyPlannerShadowPanel({
    plannerDebugEnabled: true,
    legacyShadowPanelVisible: true,
    plannerTrainScreenV1Visible: true,
    activeScreen: "Home",
  }), true);
});

test("normal users never see PlannerTrainScreenV1 or the legacy shadow panel", () => {
  const screen = buildPlannerTrainScreenV1({ debug: {}, plannerSession: plannerSession("2026-06-03") });
  assert.equal(screen.visible, false);
  assert.equal(shouldRenderLegacyPlannerShadowPanel({
    plannerDebugEnabled: false,
    legacyShadowPanelVisible: true,
    plannerTrainScreenV1Visible: screen.visible,
    activeScreen: "Train",
  }), false);
});
test("PlannerTrainScreenV1 is advisory-only, read-only, and cannot mutate runtime guards", () => {
  const guards: PlannerTrainScreenV1RuntimeGuards = {
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
  const screen = buildPlannerTrainScreenV1({ debug: { queryDebugPlanner: true }, plannerSession: plannerSession("2026-06-03"), runtimeGuards: guards });
  assert.deepEqual(guards, before);
  assert.equal(screen.runtimeMutationAttempted, false);
  assert.equal(screen.developerOnly, true);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.advisoryOnly, true);
  assert.equal(screen.affectsHome, false);
  assert.equal(screen.affectsTrain, false);
  assert.equal(screen.affectsLog, false);
  assert.equal(screen.affectsLogs, false);
  assert.equal(screen.affectsRecommendations, false);
  assert.equal(screen.affectsReadiness, false);
  assert.equal(screen.affectsProgression, false);
});

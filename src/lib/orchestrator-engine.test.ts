import { test } from "node:test";
import * as assert from "node:assert/strict";
import { evaluateOrchestrator, type OrchestratorEngineInput } from "./orchestrator-engine";

const completeInput: OrchestratorEngineInput = {
  readinessEngineResult: { status: "Green", readinessStatus: "Green", score: 86 },
  nutritionEngineResult: { adherence: 88, proteinAdherence: 92, primaryOpportunity: "Strong protein adherence" },
  runningEngineResult: { injuryRisk: 20, decision: "Progress", primaryOpportunity: "Running performance improving" },
  workoutEngineResult: { decision: "Progress", strengthTrend: "Improving", primaryOpportunity: "Strength progressing" },
  progressionEngineResult: { weeklyDecision: "Progress", decision: "Progress", nutritionDecision: "Maintain Calories" },
  goalTrackingEngineResult: {
    goals: {
      fatLoss: { status: "On Track", confidence: "High" },
      physique: { status: "On Track", confidence: "High" },
      strength: { status: "On Track", confidence: "High" },
      halfMarathon: { status: "On Track", confidence: "High" },
    },
  },
  trainingEngineResult: { todayPlan: "Strength workout", priorityActions: ["Complete strength workout"] },
  performanceEngineResult: { primaryOpportunity: "Running performance improving", primaryRisk: "None", overallStatus: "Improving" },
  physiqueEngineResult: { physiqueStatus: "Improving", primaryOpportunity: "Body fat trending down", primaryRisk: "None" },
};

function result(overrides: Partial<OrchestratorEngineInput> = {}) {
  return evaluateOrchestrator({ ...completeInput, ...overrides });
}

test("Recovery wins over everything", () => {
  const evaluated = result({ readinessEngineResult: { status: "Red" }, goalTrackingEngineResult: { goals: { fatLoss: { status: "Off Track" }, strength: { status: "Off Track" }, halfMarathon: { status: "Off Track" } } } });
  assert.equal(evaluated.primaryMission, "Recovery");
});

test("Red readiness override", () => {
  assert.equal(result({ readinessEngineResult: { readinessStatus: "Red" } }).primaryMission, "Recovery");
});

test("High injury risk override", () => {
  assert.equal(result({ runningEngineResult: { injuryRisk: 72 } }).primaryMission, "Recovery");
});

test("Recovery Focus override", () => {
  assert.equal(result({ progressionEngineResult: { weeklyDecision: "Recovery Focus" } }).primaryMission, "Recovery");
});

test("Fat Loss mission", () => {
  assert.equal(result({ goalTrackingEngineResult: { goals: { fatLoss: { status: "Off Track" } } } }).primaryMission, "Fat Loss");
});

test("Strength mission", () => {
  assert.equal(result({ goalTrackingEngineResult: { goals: { strength: { status: "Off Track" } } } }).primaryMission, "Strength");
});

test("Half Marathon mission", () => {
  assert.equal(result({ goalTrackingEngineResult: { goals: { halfMarathon: { status: "Off Track" } } } }).primaryMission, "Half Marathon");
});

test("Physique mission", () => {
  assert.equal(result({ physiqueEngineResult: { physiqueStatus: "Declining", primaryRisk: "Body fat increase" } }).primaryMission, "Physique");
});

test("Opportunity selection", () => {
  assert.equal(result({ performanceEngineResult: { primaryOpportunity: "Running performance improving" } }).biggestOpportunity, "Running performance improving");
});

test("Risk selection", () => {
  assert.equal(result({ goalTrackingEngineResult: { goals: { halfMarathon: { status: "Off Track" } } } }).biggestRisk, "Half marathon goal is off track");
});

test("High confidence", () => {
  assert.equal(result().decisionConfidence, "High");
});

test("Medium confidence", () => {
  assert.equal(evaluateOrchestrator({ readinessEngineResult: {}, nutritionEngineResult: {}, runningEngineResult: {}, progressionEngineResult: {}, performanceEngineResult: {} }).decisionConfidence, "Medium");
});

test("Low confidence", () => {
  assert.equal(evaluateOrchestrator({ readinessEngineResult: {}, goalTrackingEngineResult: {} }).decisionConfidence, "Low");
});

test("Summary generation", () => {
  const summary = result({ runningEngineResult: { injuryRisk: 85 }, performanceEngineResult: { primaryOpportunity: "Strength progressing" } }).summary;
  assert.match(summary, /Recovery/);
  assert.match(summary, /injury risk|readiness|recovery/i);
});

test("Audit trail generation", () => {
  const audit = result().auditTrail.join("\n");
  assert.match(audit, /mission/i);
  assert.match(audit, /risk/i);
  assert.match(audit, /opportunity/i);
  assert.match(audit, /confidence/i);
});

test("Multiple competing goals", () => {
  const evaluated = result({ goalTrackingEngineResult: { goals: { fatLoss: { status: "Off Track" }, halfMarathon: { status: "Off Track" }, strength: { status: "Off Track" } } } });
  assert.equal(evaluated.primaryMission, "Fat Loss");
  assert.equal(evaluated.secondaryMission, "Half Marathon");
});

test("Missing data handling", () => {
  const evaluated = evaluateOrchestrator({});
  assert.equal(evaluated.primaryMission, "Consistency");
  assert.equal(evaluated.decisionConfidence, "Low");
  assert.match(evaluated.topPriority, /log|data|consistency/i);
});

test("Deterministic output", () => {
  assert.deepEqual(result(), result());
});

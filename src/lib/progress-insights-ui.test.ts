import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildProgressInsightsModel } from "./progress-insights-ui";
import type { PerformanceEngineResult } from "./performance-engine";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";

const performance: PerformanceEngineResult = {
  overallScore: 82,
  overallStatus: "Improving",
  confidence: "High",
  dataQualityScore: 88,
  strengthTrend: { domain: "Strength", status: "Improving", score: 90, confidence: "High", summary: "Strength volume is climbing.", metrics: { volumeDelta: 1200 }, reasons: ["More volume"] },
  runningTrend: { domain: "Running", status: "Plateau", score: 58, confidence: "Medium", summary: "Running consistency is flat.", metrics: { mileageDelta: 0, paceDelta: 0 }, reasons: ["Flat mileage"] },
  recoveryTrend: { domain: "Recovery", status: "Stable", score: 75, confidence: "High", summary: "Recovery is stable.", metrics: { readinessDelta: 1 }, reasons: ["Stable readiness"] },
  nutritionTrend: { domain: "Nutrition", status: "Declining", score: 35, confidence: "Medium", summary: "Protein adherence is slipping.", metrics: { adherenceDelta: -12 }, reasons: ["Protein down"] },
  adherenceTrend: { domain: "Adherence", status: "Improving", score: 92, confidence: "High", summary: "Adherence is strong.", metrics: { adherence: 92 }, reasons: ["Completed most items"] },
  weightTrend: { domain: "Weight", status: "Plateau", score: 58, confidence: "Medium", summary: "Weight is flat.", metrics: { weeklyLoss: 0 }, reasons: ["Flat weight"] },
  primaryOpportunity: "Protein adherence",
  primaryRisk: "Injury risk",
  summary: "Improving: overall performance score 82/100.",
  recommendations: ["Primary opportunity: Protein adherence."],
  warnings: ["Injury risk"],
  auditTrail: [
    { id: "a1", domain: "Strength", decision: "Improving", score: 90, reason: "Strength decision", dataUsed: ["volume"], confidence: "High" },
    { id: "a2", domain: "Running", decision: "Plateau", score: 58, reason: "Running decision", dataUsed: ["mileage"], confidence: "Medium" },
    { id: "a3", domain: "Recovery", decision: "Stable", score: 75, reason: "Recovery decision", dataUsed: ["checkIns"], confidence: "High" },
    { id: "a4", domain: "Nutrition", decision: "Declining", score: 35, reason: "Nutrition decision", dataUsed: ["logs"], confidence: "Medium" },
    { id: "a5", domain: "Adherence", decision: "Improving", score: 92, reason: "Adherence decision", dataUsed: ["logs"], confidence: "High" },
    { id: "a6", domain: "Overall", decision: "Improving", score: 82, reason: "Overall score", dataUsed: ["weights"], confidence: "High" },
  ],
};

const goalTracking: GoalTrackingEngineResult = {
  overallStatus: "At Risk", overallScore: 65, confidence: "Medium", dataQualityScore: 76, priorityGoal: "half_marathon", summary: "Half marathon is most at risk.", recommendations: [], warnings: [], explanations: [], auditTrail: [],
  goals: {
    fatLoss: { domain: "fat_loss", status: "On Track", score: 82, confidence: "High", currentValue: "210 lb", targetValue: "199.9 lb", trend: "down", blockers: [], supportingSignals: [], recommendation: "Keep going", explanation: "Weight is moving." },
    physique: { domain: "physique", status: "At Risk", score: 62, confidence: "Medium", currentValue: "waist flat", targetValue: "leaner", trend: "flat", blockers: ["Protein"], supportingSignals: [], recommendation: "Hit protein", explanation: "Protein is low." },
    strength: { domain: "strength", status: "On Track", score: 82, confidence: "High", currentValue: "progressing", targetValue: "progress", trend: "up", blockers: [], supportingSignals: [], recommendation: "Progress", explanation: "Volume up." },
    halfMarathon: { domain: "half_marathon", status: "Off Track", score: 40, confidence: "Medium", currentValue: "slow", targetValue: "9:00/mile", trend: "flat", blockers: ["Consistency"], supportingSignals: [], recommendation: "Run consistently", explanation: "Pace gap remains." },
  },
};

const progression: ProgressionEngineResult = {
  weeklyDecision: "Repeat",
  nutritionDecision: "Maintain Calories",
  goalStatus: { "Fat Loss": "On Track", Physique: "At Risk", Strength: "On Track", "Half Marathon": "Off Track" },
  confidence: "Medium",
  dataQuality: { score: 74, confidence: "Medium", missingInputs: [], penalties: [], warnings: [] },
  reasons: ["Repeat until running consistency improves."],
  warnings: [],
  auditEntries: [],
};

const model = () => buildProgressInsightsModel({ performanceEngineResult: performance, goalTrackingEngineResult: goalTracking, progressionEngineResult: progression });

test("Performance score display", () => assert.equal(model().overview.scoreLabel, "82/100"));
test("Performance status display", () => assert.equal(model().overview.status, "Improving"));
test("Strength trend display", () => assert.equal(model().domains.find((d) => d.label === "Strength")?.status, "Improving"));
test("Running trend display", () => assert.equal(model().domains.find((d) => d.label === "Running")?.status, "Plateau"));
test("Recovery trend display", () => assert.equal(model().domains.find((d) => d.label === "Recovery")?.status, "Stable"));
test("Nutrition trend display", () => assert.equal(model().domains.find((d) => d.label === "Nutrition")?.status, "Declining"));
test("Adherence trend display", () => assert.equal(model().domains.find((d) => d.label === "Adherence")?.status, "Improving"));
test("Weight trend display", () => assert.equal(model().domains.find((d) => d.label === "Weight")?.status, "Plateau"));
test("Primary opportunity display", () => assert.equal(model().primaryOpportunity.title, "Protein adherence"));
test("Primary risk display", () => assert.equal(model().primaryRisk.title, "Injury risk"));
test("Goal statuses display", () => assert.deepEqual(model().goalTracking.map((g) => [g.label, g.status]), [["Fat Loss", "On Track"], ["Physique", "At Risk"], ["Strength", "On Track"], ["Half Marathon", "Off Track"]]));
test("Weekly decision display", () => assert.equal(model().weeklyDecision.weeklyDecision, "Repeat"));
test("Nutrition decision display", () => assert.equal(model().weeklyDecision.nutritionDecision, "Maintain Calories"));
test("Audit entries display", () => assert.deepEqual(model().auditSnapshot.map((entry) => entry.id), ["a6", "a5", "a4", "a3", "a2"]));
test("Coach summary display", () => assert.match(model().coachSummary, /Performance is improving.*Protein adherence.*Injury risk/i));
test("Insufficient data display", () => {
  const insufficient = buildProgressInsightsModel({ performanceEngineResult: { ...performance, overallStatus: "Insufficient Data", confidence: "Low", dataQualityScore: 20, overallScore: 20 }, goalTrackingEngineResult: goalTracking, progressionEngineResult: progression });
  assert.equal(insufficient.overview.status, "Insufficient Data");
  assert.match(insufficient.coachSummary, /Need more data/i);
});

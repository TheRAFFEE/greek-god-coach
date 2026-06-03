import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { buildMissionControlUiModel } from "./mission-control-ui";

const engineOutputs = {
  orchestratorEngineResult: {
    primaryMission: "Half Marathon",
    secondaryMission: "Fat Loss",
    biggestRisk: "Recovery Trend Declining",
    biggestOpportunity: "Running Performance Improving",
    todayFocus: "Aerobic Base Training",
    weekFocus: "Complete all scheduled runs",
    decisionConfidence: "High",
    summary: "Half Marathon is currently the highest priority. Biggest risk: Recovery Trend Declining. Biggest opportunity: Running Performance Improving.",
  },
  performanceEngineResult: {
    overallScore: 82,
    overallStatus: "Improving",
    confidence: "High",
    primaryRisk: "Recovery Trend Declining",
    primaryOpportunity: "Running Performance Improving",
  },
  physiqueEngineResult: {
    physiqueScore: 74,
    physiqueStatus: "Stable",
    confidence: "Medium",
  },
  goalTrackingEngineResult: {
    goals: {
      fatLoss: { domain: "Fat Loss", status: "On Track", confidence: "High" },
      physique: { domain: "Physique", status: "At Risk", confidence: "Medium" },
      strength: { domain: "Strength", status: "Insufficient Data", confidence: "Low" },
      halfMarathon: { domain: "Half Marathon", status: "On Track", confidence: "Medium" },
    },
  },
  raceCalendarEngineResult: {
    raceReadiness: "OnTrack",
    currentPhase: "Base",
    weeksRemaining: 16,
  },
  progressionEngineResult: {
    weeklyDecision: "Repeat",
    nutritionDecision: "Maintain Calories",
    confidence: "Medium",
  },
  trainingEngineResult: {
    priorities: ["Easy miles before intensity"],
  },
} as const;

function model() {
  return buildMissionControlUiModel(engineOutputs as any);
}

test("Primary Mission display", () => {
  assert.equal(model().primaryMission.value, "Half Marathon");
});

test("Secondary Mission display", () => {
  assert.equal(model().secondaryMission.value, "Fat Loss");
});

test("Biggest Risk display", () => {
  assert.equal(model().biggestRisk.value, "Recovery Trend Declining");
});

test("Biggest Opportunity display", () => {
  assert.equal(model().biggestOpportunity.value, "Running Performance Improving");
});

test("Today Focus display", () => {
  assert.equal(model().todayFocus.value, "Aerobic Base Training");
});

test("Week Focus display", () => {
  assert.equal(model().weekFocus.value, "Complete all scheduled runs");
});

test("Performance Score display", () => {
  assert.equal(model().performanceScore.value, "82/100");
});

test("Performance Status display", () => {
  assert.equal(model().performanceStatus.value, "Improving");
});

test("Physique Score display", () => {
  assert.equal(model().physiqueScore.value, "74/100");
});

test("Physique Status display", () => {
  assert.equal(model().physiqueStatus.value, "Stable");
});

test("Race Readiness display", () => {
  assert.equal(model().raceReadiness.value, "OnTrack");
  assert.equal(model().racePhase.value, "Base");
  assert.equal(model().raceWeeksRemaining.value, "16 weeks");
});

test("Weekly Decision display", () => {
  assert.equal(model().weeklyDecision.value, "Repeat");
  assert.equal(model().nutritionDecision.value, "Maintain Calories");
});

test("Goal Status display", () => {
  assert.deepEqual(model().goalStatuses.map((goal) => [goal.label, goal.status]), [
    ["Fat Loss", "On Track"],
    ["Physique", "At Risk"],
    ["Strength", "Insufficient Data"],
    ["Half Marathon", "On Track"],
  ]);
});

test("Coach Summary display", () => {
  assert.equal(model().coachSummary.value, engineOutputs.orchestratorEngineResult.summary);
});

test("Missing race data state", () => {
  const empty = buildMissionControlUiModel({ ...engineOutputs, raceCalendarEngineResult: undefined } as any);
  assert.equal(empty.raceReadiness.value, "No race configured.");
});

test("Missing physique data state", () => {
  const empty = buildMissionControlUiModel({ ...engineOutputs, physiqueEngineResult: undefined } as any);
  assert.equal(empty.physiqueStatus.value, "No physique data available.");
});

test("Missing performance data state", () => {
  const empty = buildMissionControlUiModel({ ...engineOutputs, performanceEngineResult: undefined } as any);
  assert.equal(empty.performanceStatus.value, "Insufficient performance data.");
});

test("UI consumes engine outputs only", () => {
  const source = fs.readFileSync("src/lib/mission-control-ui.ts", "utf8");
  assert.doesNotMatch(source, /evaluate[A-Z]|scoreForStatus|statusFromScore|chooseMission|evaluateWeeklyDecision|navyBodyFat|daysBetween/);
  assert.match(source, /orchestratorEngineResult/);
  assert.match(source, /performanceEngineResult/);
  assert.match(source, /physiqueEngineResult/);
  assert.match(source, /raceCalendarEngineResult/);
  assert.match(source, /progressionEngineResult/);
});

test("No duplicate calculations", () => {
  const source = fs.readFileSync("src/lib/mission-control-ui.ts", "utf8");
  assert.doesNotMatch(source, /overallScore\s*[+\-*/]|physiqueScore\s*[+\-*/]|weeksRemaining\s*[+\-*/]|weeklyDecision\s*===|raceReadiness\s*===/);
});

test("Deterministic output", () => {
  assert.deepEqual(model(), model());
});

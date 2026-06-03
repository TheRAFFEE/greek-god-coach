import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildMissionControlRoutes } from "./mission-control-routing";
import type { MissionControlUiModel } from "./mission-control-ui";

function field(label: string, value: string) {
  return { label, value };
}

function model(overrides: Partial<MissionControlUiModel> = {}): MissionControlUiModel {
  return {
    primaryMission: field("Primary Mission", "Fat Loss"),
    secondaryMission: field("Secondary Mission", "Strength"),
    biggestRisk: field("Biggest Risk", "Recovery Risk"),
    biggestOpportunity: field("Biggest Opportunity", "Running Opportunity"),
    todayFocus: field("Today’s Focus", "Aerobic Base Training"),
    weekFocus: field("This Week’s Focus", "Progress aerobic base"),
    decisionConfidence: field("Decision Confidence", "High"),
    performanceStatus: field("Performance Status", "Improving"),
    performanceScore: field("Performance Score", "82/100"),
    physiqueStatus: field("Physique Status", "On Track"),
    physiqueScore: field("Physique Score", "78/100"),
    raceReadiness: field("Race Readiness", "OnTrack"),
    racePhase: field("Current Phase", "Base"),
    raceWeeksRemaining: field("Weeks Remaining", "12 weeks"),
    weeklyDecision: field("Weekly Decision", "Progress"),
    nutritionDecision: field("Nutrition Decision", "Maintain Calories"),
    goalStatuses: [
      { label: "Fat Loss", status: "On Track", confidence: "High" },
      { label: "Physique", status: "On Track", confidence: "High" },
      { label: "Strength", status: "At Risk", confidence: "Medium" },
      { label: "Half Marathon", status: "On Track", confidence: "High" },
    ],
    coachSummary: field("Coach Summary", "Existing summary"),
    engineSources: [],
    ...overrides,
  };
}

test("Fat Loss route", () => {
  assert.deepEqual(buildMissionControlRoutes(model({ primaryMission: field("Primary Mission", "Fat Loss") })).primaryMission, { destination: "progress", sectionId: "goals" });
});

test("Strength route", () => {
  assert.deepEqual(buildMissionControlRoutes(model({ primaryMission: field("Primary Mission", "Strength") })).primaryMission, { destination: "progress", sectionId: "goals" });
});

test("Half Marathon route", () => {
  assert.deepEqual(buildMissionControlRoutes(model({ primaryMission: field("Primary Mission", "Half Marathon") })).primaryMission, { destination: "progress", sectionId: "race" });
});

test("Physique route", () => {
  assert.deepEqual(buildMissionControlRoutes(model({ primaryMission: field("Primary Mission", "Physique") })).primaryMission, { destination: "progress", sectionId: "physique" });
});

test("Recovery route", () => {
  assert.deepEqual(buildMissionControlRoutes(model({ primaryMission: field("Primary Mission", "Recovery") })).primaryMission, { destination: "progress", sectionId: "recovery" });
});

test("Running opportunity route", () => {
  assert.deepEqual(buildMissionControlRoutes(model({ biggestOpportunity: field("Biggest Opportunity", "Running Performance Improving") })).biggestOpportunity, { destination: "progress", sectionId: "run" });
});

test("Nutrition risk route", () => {
  assert.deepEqual(buildMissionControlRoutes(model({ biggestRisk: field("Biggest Risk", "Nutrition Risk") })).biggestRisk, { destination: "progress", sectionId: "nutrition" });
});

test("Goal status route", () => {
  assert.deepEqual(buildMissionControlRoutes(model()).goalStatus, { destination: "progress", sectionId: "goals" });
});

test("Race status route", () => {
  assert.deepEqual(buildMissionControlRoutes(model()).raceStatus, { destination: "progress", sectionId: "race" });
});

test("Performance snapshot route", () => {
  assert.deepEqual(buildMissionControlRoutes(model()).performanceSnapshot, { destination: "progress", sectionId: "performance" });
});

test("Missing data route", () => {
  const routes = buildMissionControlRoutes(model({ primaryMission: field("Primary Mission", "No mission available."), biggestRisk: field("Biggest Risk", "No risk available."), biggestOpportunity: field("Biggest Opportunity", "No opportunity available.") }));
  assert.deepEqual(routes.primaryMission, { destination: "progress", sectionId: "missing" });
  assert.equal(routes.emptyState, "Data not available yet.");
});

test("Deterministic output", () => {
  const input = model({ biggestRisk: field("Biggest Risk", "Race Risk") });
  assert.deepEqual(buildMissionControlRoutes(input), buildMissionControlRoutes(input));
});

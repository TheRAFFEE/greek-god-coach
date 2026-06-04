import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildHomeDailyDashboard, HOME_FORBIDDEN_REPORTING_LABELS } from "./home-daily-dashboard";
import type { HomeCommandCenterModel } from "./home-command-center";
import type { MissionControlUiModel } from "./mission-control-ui";

const home = {
  training: {
    workout: { name: "Upper Strength", estimatedDurationMinutes: 55, status: "Not Completed" },
    run: { name: "Easy Run 3 mi", estimatedDurationMinutes: 30, status: "Not Completed" },
  },
  recovery: { readiness: "Green", confidence: "High", warning: null },
  caloriesRemaining: 650,
  actions: {
    startWorkout: { label: "Start Workout", destination: "Train" },
    dailyCheckIn: { label: "Daily Check-In", destination: "Log", section: "Daily Check-In" },
  },
} as HomeCommandCenterModel;

const mission = {
  primaryMission: { label: "Primary Mission", value: "Half Marathon" },
  biggestRisk: { label: "Biggest Risk", value: "Recovery Trend Declining" },
  biggestOpportunity: { label: "Biggest Opportunity", value: "Running Performance Improving" },
  weeklyDecision: { label: "Weekly Decision", value: "Repeat" },
  nutritionDecision: { label: "Nutrition Decision", value: "Maintain Calories" },
} as MissionControlUiModel;

function model() {
  return buildHomeDailyDashboard({ home, missionControl: mission });
}

test("Home daily dashboard exposes only the required one-screen sections", () => {
  const result = model();

  assert.deepEqual(result.sections.map((section) => section.label), [
    "Today's workout",
    "Today's run",
    "Today's nutrition focus",
    "Recovery status",
    "Primary mission",
  ]);
  assert.equal(result.sections.length, 5);
});

test("Home daily dashboard returns a single primary CTA only", () => {
  const result = model();

  assert.equal(result.ctas.length, 1);
  assert.deepEqual(result.ctas[0], { label: "Start Workout", destination: "Train" });
});

test("Why section contains required rationale fields and is collapsed by default", () => {
  const result = model();

  assert.equal(result.why.collapsedByDefault, true);
  assert.deepEqual(result.why.items.map((item) => item.label), [
    "Primary Mission",
    "Biggest Risk",
    "Biggest Opportunity",
    "Weekly Decision",
  ]);
});

test("Home daily dashboard explicitly excludes reporting and historical sections", () => {
  const result = model();
  const visibleLabels = [
    ...result.sections.map((section) => section.label),
    ...result.ctas.map((cta) => cta.label),
    result.why.title,
  ].join(" ");

  for (const forbidden of HOME_FORBIDDEN_REPORTING_LABELS) {
    assert.doesNotMatch(visibleLabels, new RegExp(forbidden, "i"));
  }
});

test("nutrition focus and recovery status stay action-oriented instead of reporting historical analytics", () => {
  const result = model();

  assert.match(result.sections.find((section) => section.label === "Today's nutrition focus")?.value ?? "", /protein|calories|hydration|nutrition/i);
  assert.match(result.sections.find((section) => section.label === "Recovery status")?.value ?? "", /Green|Yellow|Red/i);
});

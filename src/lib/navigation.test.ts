import { test } from "node:test";
import * as assert from "node:assert/strict";
import { appNavigation, removedHomeSections, removedRunningSections, removedTopLevelTabs, screenGroups } from "./navigation";

test("limits primary navigation to the five AI coach areas", () => {
  assert.deepEqual(appNavigation.map((tab) => tab.id), ["Home", "Train", "Log", "Progress", "More"]);
  assert.deepEqual(appNavigation.map((tab) => tab.label), ["Home", "Train", "Log", "Progress", "More"]);
  assert.equal(appNavigation.length, 5);
});

test("removes legacy modes and collection-style labels from primary navigation", () => {
  const topLevelLabels: string[] = appNavigation.map((tab) => tab.label);
  for (const removed of removedTopLevelTabs) {
    assert.equal(topLevelLabels.includes(removed), false, `${removed} should not be a primary tab`);
  }
});

test("assigns every existing capability to the only screen where it belongs", () => {
  assert.deepEqual(screenGroups.Home, ["Readiness", "Today's plan", "Calories", "Weight", "Start Day"]);
  assert.deepEqual(screenGroups.Train, ["Warm-up", "Today's workout", "Today's run", "Cooldown", "Session summary", "Start Training"]);
  assert.deepEqual(screenGroups.Log, ["Daily check-in", "Nutrition logging", "Body metrics logging", "Progress photos"]);
  assert.equal(screenGroups.Log.includes("Workout logging"), false);
  assert.equal(screenGroups.Log.includes("Run logging"), false);
  assert.deepEqual(screenGroups.Progress, ["Weight trends", "Pace trends", "Mileage trends", "Weekly review", "Race countdown", "Adherence metrics"]);
  assert.deepEqual(screenGroups.More, ["Settings", "Integrations", "Goals"]);
});

test("removes duplicated coaching and running analytics from planning screens", () => {
  assert.deepEqual(removedHomeSections, [
    "Mode Clarity",
    "Duplicate readiness cards",
    "Duplicate recommendation cards",
    "Workout receipts",
    "Run summary cards",
  ]);
  assert.deepEqual(removedRunningSections, [
    "Distance trend section from Running tab",
    "Pace trend section from Running tab",
    "RPE trend section from Running tab",
    "Long run progression section from Running tab",
    "Recent running logs section from Running tab",
  ]);
});

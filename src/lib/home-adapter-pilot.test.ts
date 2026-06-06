import { test } from "node:test";
import * as assert from "node:assert/strict";

import { buildHomeAdapterPilotPreview, isHomeAdapterPilotEnabled } from "./home-adapter-pilot";
import type { HomeAdapterResult, HomeTrainingModel } from "./home-adapter";

function model(overrides: Partial<HomeTrainingModel> = {}): HomeTrainingModel {
  return {
    source: "Planner Home Adapter V1",
    mode: "pilot",
    sessionId: "session-1",
    date: "2026-06-06",
    currentWeek: 3,
    dayIndex: 5,
    sessionType: "LiftDay",
    primaryObjective: "Build strength while preserving run readiness",
    title: "Lift + Support",
    primaryAction: "Build strength while preserving run readiness",
    deload: false,
    workout: {
      name: "Upper Strength",
      estimatedDurationMinutes: 45,
      status: "Not Completed",
      sourceSessionId: "session-1",
      sourceWorkoutId: "workout-1",
      required: true,
      loggingRequired: true,
      loggingTarget: { type: "workout", workoutId: "workout-1" },
    },
    run: {
      name: "No run scheduled",
      estimatedDurationMinutes: 0,
      status: "Not Scheduled",
      sourceSessionId: "session-1",
      sourceWorkoutId: null,
      required: false,
      loggingRequired: false,
      loggingTarget: null,
    },
    recovery: null,
    mobility: null,
    support: [{ kind: "Core", title: "Support: Core", items: ["Pallof press", "Side plank"], sourceWorkoutId: "workout-1" }],
    estimatedDurationMinutes: 55,
    durationMetadata: { summaryEstimatedDurationMinutes: 55, combinedLoadEstimatedDurationMinutes: 55 },
    loggingRequirements: { workoutLoggingRequired: true, runLoggingRequired: false },
    readiness: { status: "Green", confidence: "High", source: "Readiness Engine" },
    progression: { weeklyDecision: "Progress", confidence: "High", source: "Progression Engine" },
    recommendation: { coachRecommendation: "Complete the validated session.", runningRecommendation: null, source: "Recommendation Pipeline" },
    audit: { auditHash: "audit-hash-session-1", provenance: { source: "home-adapter-pilot" }, plannerAuditTrailIds: ["audit-1"] },
    diagnostics: [],
    ...overrides,
  };
}

function result(overrides: Partial<HomeAdapterResult> = {}): HomeAdapterResult {
  return { status: "PASS", model: model(), diagnostics: [], ...overrides };
}

function rows(adapterResult: HomeAdapterResult = result()) {
  const preview = buildHomeAdapterPilotPreview({ enabled: true, adapterResult });
  assert.equal(preview.state, "preview");
  return Object.fromEntries(preview.rows.map((row) => [row.label, row.value]));
}

test("pilot flag defaults to clean user mode and only explicit query activation enables it", () => {
  assert.equal(isHomeAdapterPilotEnabled({ search: "", localStorageValue: null }), false);
  assert.equal(isHomeAdapterPilotEnabled({ search: "?homeAdapterPilot=false", localStorageValue: "false" }), false);
  assert.equal(isHomeAdapterPilotEnabled({ search: "?homeAdapterPilot=true", localStorageValue: null }), true);
  assert.equal(isHomeAdapterPilotEnabled({ search: "", localStorageValue: "true" }), false);
});

test("pilot OFF hides adapter rendering entirely", () => {
  assert.deepEqual(buildHomeAdapterPilotPreview({ enabled: false, adapterResult: result() }), { enabled: false, state: "off", rows: [], warnings: [] });
});

test("pilot ON renders a Developer Preview with only approved display rows", () => {
  const preview = buildHomeAdapterPilotPreview({ enabled: true, adapterResult: result() });
  assert.equal(preview.state, "preview");
  assert.equal(preview.title, "Developer Preview");
  assert.deepEqual(preview.rows.map((row) => row.label), [
    "Session Type",
    "Primary Objective",
    "Workout Summary",
    "Run Summary",
    "Support Work",
    "Duration",
    "Deload Metadata",
    "Logging Requirements",
    "Warnings",
  ]);
  assert.equal(JSON.stringify(preview).includes("audit-hash"), false);
  assert.equal(JSON.stringify(preview).includes("provenance"), false);
});

test("BLOCKER hides preview rows and shows unavailable copy", () => {
  const preview = buildHomeAdapterPilotPreview({ enabled: true, adapterResult: result({ status: "BLOCKER", model: null }) });
  assert.equal(preview.state, "unavailable");
  assert.equal(preview.title, "Adapter Preview Unavailable");
  assert.equal(preview.message, "Use legacy Home only");
  assert.deepEqual(preview.rows, []);
});

test("WARNING keeps preview visible and renders warning copy without raw diagnostic codes", () => {
  const preview = buildHomeAdapterPilotPreview({
    enabled: true,
    adapterResult: result({ status: "WARNING", diagnostics: [{ severity: "WARNING", code: "DUPLICATE_SUPPORT_ITEM", message: "Duplicate support item detected; mapping is preserved." }] }),
  });
  assert.equal(preview.state, "preview");
  const warningRow = preview.rows.find((row) => row.label === "Warnings");
  assert.equal(warningRow?.value, "Duplicate support item detected; mapping is preserved.");
  assert.equal(JSON.stringify(preview).includes("DUPLICATE_SUPPORT_ITEM"), false);
});

test("RecoveryDay is displayed correctly", () => {
  const display = rows(result({ model: model({ sessionType: "RecoveryDay", primaryObjective: "Recover fully", workout: { ...model().workout, name: "No lift scheduled", estimatedDurationMinutes: 0, status: "Not Scheduled", required: false, loggingRequired: false, loggingTarget: null }, recovery: { ...model().workout, name: "Recovery walk", loggingRequired: false, loggingTarget: null }, loggingRequirements: { workoutLoggingRequired: false, runLoggingRequired: false } }) }));
  assert.equal(display["Session Type"], "RecoveryDay");
  assert.equal(display["Primary Objective"], "Recover fully");
  assert.equal(display["Workout Summary"], "No lift scheduled");
});

test("RunDay is displayed correctly", () => {
  const run = { ...model().run, name: "Easy Run", estimatedDurationMinutes: 35, status: "Not Completed" as const, required: true, loggingRequired: true, loggingTarget: { type: "run" } };
  const display = rows(result({ model: model({ sessionType: "RunDay", run, loggingRequirements: { workoutLoggingRequired: false, runLoggingRequired: true } }) }));
  assert.equal(display["Session Type"], "RunDay");
  assert.match(display["Run Summary"], /Easy Run · 35 min · Not Completed · Required · logging required/);
});

test("LiftDay is displayed correctly", () => {
  const display = rows();
  assert.equal(display["Session Type"], "LiftDay");
  assert.match(display["Workout Summary"], /Upper Strength · 45 min · Not Completed · Required · logging required/);
});

test("LongRunDay is displayed correctly", () => {
  const run = { ...model().run, name: "Long Run", estimatedDurationMinutes: 90, status: "Not Completed" as const, required: true, loggingRequired: true, loggingTarget: { type: "run" } };
  const display = rows(result({ model: model({ sessionType: "LongRunDay", run, loggingRequirements: { workoutLoggingRequired: false, runLoggingRequired: true } }) }));
  assert.equal(display["Session Type"], "LongRunDay");
  assert.match(display["Run Summary"], /Long Run · 90 min/);
});

test("deload metadata is displayed as metadata only", () => {
  const display = rows(result({ model: model({ deload: true }) }));
  assert.equal(display["Deload Metadata"], "deload=true");
  assert.notEqual(display["Session Type"], "DeloadDay");
});

test("Support: Core is displayed correctly", () => {
  const display = rows();
  assert.equal(display["Support Work"], "Support: Core: Pallof press, Side plank");
});

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { createInitialState } from "./seed-data";
import { buildAppStateBackupPayload, buildDataConfidenceNote, buildFoodScanProviderLabel } from "./pre-test-cleanup-ui";

test("food scan provider label distinguishes mock, OpenAI, and error states", () => {
  assert.deepEqual(buildFoodScanProviderLabel({ provider: "mock" }), {
    kind: "mock",
    label: "Mock mode",
    detail: "FOOD_AI_V1 is using deterministic mock scan data for safe local testing.",
  });
  assert.equal(buildFoodScanProviderLabel({ provider: "openai" }).label, "OpenAI / real AI mode");
  assert.equal(buildFoodScanProviderLabel({ error: "API failure" }).kind, "error");
});

test("AppState backup payload wraps the full current state with export metadata", () => {
  const state = createInitialState();
  const payload = buildAppStateBackupPayload(state, "2026-01-01T00:00:00.000Z");

  assert.equal(payload.storageKey, "greek-god-coach:v1");
  assert.equal(payload.appStateVersion, 1);
  assert.equal(payload.exportedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(payload.appState, state);
});

test("data confidence note surfaces missing manual-test data", () => {
  const state = createInitialState();
  const note = buildDataConfidenceNote({ ...state, checkIns: [], nutritionLogs: [], runLogs: [], exerciseLogs: [], workoutSessions: [] }, "weekly-review", "2026-01-07");

  assert.equal(note.label, "Data confidence / missing data");
  assert.equal(note.confidence, "Low");
  assert.ok(note.missingData.includes("fewer than 5 check-ins this week"));
  assert.ok(note.missingData.includes("no run log this week"));
});

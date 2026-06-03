import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildAuditCenterUiModel } from "./audit-center-ui";

const sampleEntry = (message: string, confidence = "High", timestamp = "2026-06-03T12:00:00.000Z") => ({ message, confidence, timestamp });

test("Readiness audit aggregation", () => {
  const model = buildAuditCenterUiModel({ readinessEngineResult: { auditTrail: [sampleEntry("Readiness red from pain")] } });
  assert.equal(model.entries[0].source, "Readiness");
  assert.equal(model.entries[0].message, "Readiness red from pain");
});

test("Progression audit aggregation", () => {
  const model = buildAuditCenterUiModel({ progressionEngineResult: { auditTrail: [{ whatHappened: "Weekly decision repeat", confidence: "Low" }] } });
  assert.deepEqual(model.entries[0], { source: "Progression", message: "Weekly decision repeat", confidence: "Low" });
});

test("Performance audit aggregation", () => {
  const model = buildAuditCenterUiModel({ performanceEngineResult: { auditTrail: [{ reason: "Recovery trend declining", confidence: "Medium" }] } });
  assert.equal(model.entries[0].source, "Performance");
  assert.equal(model.entries[0].message, "Recovery trend declining");
});

test("Physique audit aggregation", () => {
  const model = buildAuditCenterUiModel({ physiqueEngineResult: { auditTrail: [{ reason: "Waist data missing" }] } });
  assert.equal(model.entries[0].source, "Physique");
  assert.equal(model.entries[0].message, "Waist data missing");
});

test("Race audit aggregation", () => {
  const model = buildAuditCenterUiModel({ raceCalendarEngineResult: { auditTrail: ["Race phase selected from weeks remaining"] } });
  assert.equal(model.entries[0].source, "RaceCalendar");
  assert.equal(model.entries[0].message, "Race phase selected from weeks remaining");
});

test("Orchestrator audit aggregation", () => {
  const model = buildAuditCenterUiModel({ orchestratorEngineResult: { auditTrail: ["Orchestrator selected primary mission"] } });
  assert.equal(model.entries[0].source, "Orchestrator");
  assert.equal(model.entries[0].message, "Orchestrator selected primary mission");
});

test("Mixed source aggregation", () => {
  const model = buildAuditCenterUiModel({
    readinessEngineResult: { auditTrail: ["Readiness entry"] },
    progressionEngineResult: { auditTrail: ["Progression entry"] },
    performanceEngineResult: { auditTrail: ["Performance entry"] },
  });
  assert.deepEqual(model.entries.map((entry) => entry.source), ["Readiness", "Progression", "Performance"]);
});

test("Source counts", () => {
  const model = buildAuditCenterUiModel({
    readinessEngineResult: { auditTrail: ["one", "two"] },
    raceCalendarEngineResult: { auditTrail: ["race"] },
  });
  assert.equal(model.sourceCounts.Readiness, 2);
  assert.equal(model.sourceCounts.RaceCalendar, 1);
  assert.equal(model.sourceCounts.Performance, 0);
});

test("Empty state", () => {
  const model = buildAuditCenterUiModel({});
  assert.deepEqual(model.entries, []);
  assert.equal(model.emptyState, "No audit data available yet.");
});

test("Total count calculation", () => {
  const model = buildAuditCenterUiModel({
    readinessEngineResult: { auditTrail: ["one"] },
    progressionEngineResult: { auditTrail: ["two", "three"] },
  });
  assert.equal(model.totalEntries, 3);
});

test("Ordering preserved", () => {
  const model = buildAuditCenterUiModel({ readinessEngineResult: { auditTrail: ["first", "second", "third"] } });
  assert.deepEqual(model.entries.map((entry) => entry.message), ["first", "second", "third"]);
});

test("Deterministic output", () => {
  const input = {
    orchestratorEngineResult: { auditTrail: ["mission"] },
    progressionEngineResult: { auditEntries: [{ whatHappened: "repeat", confidence: "Low" }] },
  };
  assert.deepEqual(buildAuditCenterUiModel(input), buildAuditCenterUiModel(input));
});

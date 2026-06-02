import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { AppState, RunLog } from "./types";
import { buildRunLoggerRecord, buildRunningEngineInputForRunLogger, evaluateRunLoggerResult, saveRunLoggerEntry } from "./run-logger";
import { evaluateRunning } from "./running-engine";

const run = (overrides: Partial<RunLog> = {}): RunLog => ({
  id: "run-base",
  userId: "user-1",
  date: "2026-06-01",
  runType: "easy",
  plannedDistance: 3,
  actualDistance: 3,
  durationMinutes: 30,
  averagePace: 10,
  averageHr: 140,
  maxHr: 158,
  rpe: 5,
  zone2Compliance: 85,
  completed: true,
  walkBreaks: false,
  pain: false,
  painScore: 0,
  painLocation: "",
  notes: "",
  ...overrides,
});

test("builds a run log record from the required run logger fields", () => {
  const record = buildRunLoggerRecord({
    id: "run-1",
    userId: "user-1",
    date: "2026-06-01",
    runType: "tempo",
    distance: 4.2,
    durationMinutes: 39,
    averagePace: 9.3,
    averageHeartRate: 152,
    rpe: 7,
    walkBreaks: false,
    painScore: 2,
    notes: "Controlled tempo effort.",
  });

  assert.equal(record.runType, "tempo");
  assert.equal(record.actualDistance, 4.2);
  assert.equal(record.plannedDistance, 4.2);
  assert.equal(record.averageHr, 152);
  assert.equal(record.walkBreaks, false);
  assert.equal(record.painScore, 2);
  assert.equal(record.pain, true);
  assert.equal(record.notes, "Controlled tempo effort.");
});

test("summarizes a clean long run as progress with no pain warning", () => {
  const result = evaluateRunLoggerResult(run({ runType: "long run", actualDistance: 6, plannedDistance: 6, durationMinutes: 66, averagePace: 11, rpe: 6, walkBreaks: false, painScore: 0 }));

  assert.equal(result.nextRunDecision, "progress");
  assert.match(result.summary, /6 mi long run/i);
  assert.match(result.recommendation, /progress/i);
  assert.equal(result.painWarning, null);
});

test("repeats the next run after high effort or walk breaks", () => {
  const result = evaluateRunLoggerResult(run({ runType: "easy", rpe: 8, walkBreaks: true, painScore: 2 }));

  assert.equal(result.nextRunDecision, "repeat");
  assert.match(result.recommendation, /repeat/i);
  assert.match(result.reasons.join(" "), /walk break/i);
});

test("deloads and warns when pain is high", () => {
  const result = evaluateRunLoggerResult(run({ runType: "speed", rpe: 6, painScore: 8, pain: true }));

  assert.equal(result.nextRunDecision, "deload");
  assert.match(result.recommendation, /deload/i);
  assert.match(result.painWarning ?? "", /Pain score is 8\/10/i);
});

test("saves one run per date and keeps the latest summary available", () => {
  const state = {
    user: { id: "user-1" },
    runLogs: [run({ id: "old", date: "2026-06-01", actualDistance: 2 })],
    adjustments: [],
  } as unknown as AppState;

  const saved = saveRunLoggerEntry(state, run({ id: "new", date: "2026-06-01", actualDistance: 3.5, runType: "tempo" }));

  assert.equal(saved.state.runLogs.length, 1);
  assert.equal(saved.state.runLogs[0].id, "new");
  assert.equal(saved.result.runSummary.distance, 3.5);
  assert.equal(saved.result.runSummary.runType, "tempo");
});


test("run logger result is a legacy projection of Running Engine V2", () => {
  const cleanLongRun = run({ runType: "long run", plannedDistance: 6, actualDistance: 6, durationMinutes: 66, averagePace: 11, rpe: 6, painScore: 0 });
  const result = evaluateRunLoggerResult(cleanLongRun);
  const engine = evaluateRunning(buildRunningEngineInputForRunLogger(cleanLongRun));

  assert.equal(engine.progression.action, "Progress");
  assert.equal(result.nextRunDecision, "progress");
  assert.match(result.reasons.join(" "), /Running Engine V2/i);
});

test("run logger maps Running Engine V2 Recovery Focus to legacy deload without changing the UI shape", () => {
  const painfulRun = run({ runType: "speed", rpe: 6, painScore: 8, pain: true });
  const result = evaluateRunLoggerResult(painfulRun);
  const engine = evaluateRunning(buildRunningEngineInputForRunLogger(painfulRun));

  assert.equal(engine.progression.action, "Recovery Focus");
  assert.equal(result.nextRunDecision, "deload");
  assert.match(result.recommendation, /deload|recovery/i);
  assert.match(result.painWarning ?? "", /8\/10/);
});

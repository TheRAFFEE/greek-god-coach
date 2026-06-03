import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { AppState, RunLog, Workout } from "./types";
import { buildTrainSessionBlocks, saveTrainRunLog } from "./run-logger";

const liftWorkout: Workout = {
  id: "lift-1",
  userId: "user-1",
  week: 1,
  phase: "Base",
  day: "Monday",
  dayIndex: 0,
  title: "Upper Strength",
  type: "upper-strength",
  notes: "Lift day",
  exercises: [{ id: "bench", workoutId: "lift-1", name: "Bench Press", prescribedSets: 3, prescribedReps: "5", prescribedRpe: 8, category: "strength", order: 1 }],
};

const runWorkout: Workout = {
  ...liftWorkout,
  id: "run-1",
  title: "Zone 2 Run",
  type: "run",
  notes: "Run day",
  exercises: [{ id: "run", workoutId: "run-1", name: "Zone 2 Run", prescribedSets: 1, prescribedReps: "3 miles", prescribedRpe: 6, category: "running", order: 1 }],
};

const liftAndRunWorkout: Workout = {
  ...liftWorkout,
  id: "hybrid-1",
  title: "Upper Strength + Zone 2",
  type: "hybrid",
  notes: "Lift then run",
};

function stateWithRuns(runLogs: RunLog[] = []) {
  return {
    user: { id: "user-1" },
    runLogs,
  } as unknown as AppState;
}

test("Train session composition includes warm-up and cooldown around a lift-only day", () => {
  const blocks = buildTrainSessionBlocks({ workout: liftWorkout, plannedRunDistance: 0 });

  assert.deepEqual(blocks.map((block) => block.kind), ["warm-up", "lift", "cooldown", "summary"]);
  assert.equal(blocks[1].title, "Upper Strength");
});

test("Train session composition includes warm-up and cooldown around a run-only day", () => {
  const blocks = buildTrainSessionBlocks({ workout: runWorkout, plannedRunDistance: 3, forceRun: true });

  assert.deepEqual(blocks.map((block) => block.kind), ["warm-up", "run", "cooldown", "summary"]);
  assert.match(blocks[1].title, /run/i);
});

test("Train session composition orders lift before run on lift + run days", () => {
  const blocks = buildTrainSessionBlocks({ workout: liftAndRunWorkout, plannedRunDistance: 3, forceRun: true });

  assert.deepEqual(blocks.map((block) => block.kind), ["warm-up", "lift", "run", "cooldown", "summary"]);
});

test("Train-side run save creates a RunLog-compatible record through the existing Running Engine V2 logger path", () => {
  const saved = saveTrainRunLog(stateWithRuns([{ id: "old-run", userId: "user-1", date: "2026-06-01", runType: "easy", plannedDistance: 2, actualDistance: 2, durationMinutes: 22, averagePace: 11, averageHr: 140, maxHr: 140, rpe: 5, zone2Compliance: 85, completed: true, walkBreaks: false, pain: false, painScore: 0, painLocation: "", notes: "old" }]), {
    id: "new-run",
    userId: "user-1",
    date: "2026-06-01",
    runType: "long run",
    plannedDistance: 6,
    actualDistance: 6,
    durationMinutes: 66,
    averagePace: 11,
    averageHeartRate: 145,
    rpe: 6,
    pain: false,
    painScore: 0,
    notes: "Felt smooth.",
  });

  assert.equal(saved.state.runLogs.length, 1);
  assert.equal(saved.state.runLogs[0].id, "new-run");
  assert.equal(saved.state.runLogs[0].completed, true);
  assert.equal(saved.state.runLogs[0].plannedDistance, 6);
  assert.equal(saved.state.runLogs[0].actualDistance, 6);
  assert.match(saved.result.reasons.join(" "), /Running Engine V2/i);
});

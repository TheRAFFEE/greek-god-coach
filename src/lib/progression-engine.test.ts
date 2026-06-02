import { test } from "node:test";
import * as assert from "node:assert/strict";
import { evaluateRunning, type RunningEngineInput } from "./running-engine";
import { progressionRunningInputFromRunningEngineV2 } from "./progression-engine";

const input: RunningEngineInput = {
  generatedAt: "2026-06-08T12:00:00.000Z",
  evaluationDate: "2026-06-08",
  race: { raceDate: "2027-01-17", targetFinishMinutes: 118, targetPaceSecondsPerMile: 540, distanceMiles: 13.1 },
  runLogs: [
    { id: "r1", date: "2026-06-01", runType: "easy", plannedDistance: 4, actualDistance: 4, durationMinutes: 42, averagePace: 10.5, averageHr: 145, maxHr: 162, rpe: 5, zone2Compliance: 86, completed: true, walkBreaks: false, pain: false, painScore: 0, painLocation: "", notes: "" },
    { id: "r2", date: "2026-06-06", runType: "long run", plannedDistance: 8, actualDistance: 8, durationMinutes: 80, averagePace: 10, averageHr: 148, maxHr: 165, rpe: 6, zone2Compliance: 85, completed: true, walkBreaks: false, pain: false, painScore: 0, painLocation: "", notes: "" },
  ],
  currentWeek: { startDate: "2026-06-01", endDate: "2026-06-07", weeklyMileage: 12, rolling7DayMileage: 12, previousWeeklyMileage: 11, runningDaysPlanned: 2, runningDaysCompleted: 2 },
  readiness: { status: "Green", score: 84, averageSleep: 7.3, averageSoreness: 3, averageStress: 4, averageEnergy: 8 },
};

test("Progression Engine V1 consumes Running Engine V2 output instead of recalculating running progression", () => {
  const running = evaluateRunning(input);
  const progressionInput = progressionRunningInputFromRunningEngineV2(running);

  assert.equal(progressionInput.progressionAction, running.progression.action);
  assert.equal(progressionInput.injuryRiskScore, running.readiness.injuryRiskScore);
  assert.equal(progressionInput.raceReadinessScore, running.readiness.raceReadinessScore);
  assert.equal(progressionInput.confidenceScore, running.confidenceScore);
  assert.deepEqual(progressionInput.explanations, running.explanations.map((explanation) => explanation.summary));
});

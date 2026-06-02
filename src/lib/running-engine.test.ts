import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  calculateConfidenceScore,
  calculateDataQualityScore,
  calculateInjuryRisk,
  calculatePaceZones,
  calculatePredictedHalfMarathonTime,
  calculatePredictedRacePace,
  calculateRaceReadiness,
  calculateRunningReadiness,
  evaluateRunning,
  generateRunningAuditEntries,
  generateRunningExplanation,
  type RunningEngineInput,
} from "./running-engine";

const race = {
  raceDate: "2027-01-17",
  targetFinishMinutes: 118,
  targetPaceSecondsPerMile: 540,
  distanceMiles: 13.1,
};

const run = (day: number, overrides: Partial<RunningEngineInput["runLogs"][number]> = {}): RunningEngineInput["runLogs"][number] => ({
  id: `run-${day}`,
  date: `2026-06-${String(day).padStart(2, "0")}`,
  runType: "easy",
  plannedDistance: 4,
  actualDistance: 4,
  durationMinutes: 42,
  averagePace: 10.5,
  averagePaceSecondsPerMile: 630,
  averageHr: 145,
  maxHr: 162,
  rpe: 5,
  zone2Compliance: 86,
  completed: true,
  walkBreaks: false,
  pain: false,
  painScore: 0,
  painLocation: "",
  notes: "",
  ...overrides,
});

const input = (overrides: Partial<RunningEngineInput> = {}): RunningEngineInput => ({
  generatedAt: "2026-06-08T12:00:00.000Z",
  evaluationDate: "2026-06-08",
  race,
  runLogs: [
    run(1, { actualDistance: 4, durationMinutes: 43, averagePace: 10.75, averagePaceSecondsPerMile: 645, averageHr: 146, rpe: 5 }),
    run(3, { actualDistance: 5, durationMinutes: 52, averagePace: 10.4, averagePaceSecondsPerMile: 624, averageHr: 145, rpe: 5 }),
    run(6, { runType: "long run", plannedDistance: 8, actualDistance: 8, durationMinutes: 80, averagePace: 10, averagePaceSecondsPerMile: 600, averageHr: 148, rpe: 6 }),
  ],
  currentWeek: {
    startDate: "2026-06-01",
    endDate: "2026-06-07",
    weeklyMileage: 17,
    rolling7DayMileage: 17,
    plannedWeeklyMileage: 17,
    previousWeeklyMileage: 16,
    runningDaysPlanned: 3,
    runningDaysCompleted: 3,
  },
  readiness: {
    status: "Green",
    score: 84,
    confidence: "High",
    averageSleep: 7.4,
    averageSoreness: 3,
    averageStress: 4,
    averageEnergy: 8,
  },
  ...overrides,
});

test("evaluateRunning returns the canonical output shape and progresses only when running signals are clean", () => {
  const result = evaluateRunning(input());

  assert.equal(result.progression.action, "Progress");
  assert.equal(result.currentPredictedPace, result.prediction.predictedPaceLabel);
  assert.equal(result.currentPredictedFinishTime, result.prediction.predictedFinishTime);
  assert.equal(result.prediction.targetFinishTime, "1:58");
  assert.equal(result.prediction.targetPaceLabel, "9:00/mile");
  assert.equal(result.longRunStatus.status, "strong");
  assert.equal(result.weeklyMileageStatus.status, "strong");
  assert.ok(result.runningReadiness.score >= 70);
  assert.ok(result.runningConfidenceScore >= 65);
  assert.ok(result.runningDataQualityScore >= 80);
  assert.ok(result.targetPaceGap.includes("/mi"));
  assert.ok(result.targetFinishGap.includes("min"));
  assert.ok(result.explanations[0].primaryDrivers.length > 0);
  assert.ok(result.auditTrail.some((entry) => entry.decisionType === "progression"));
});

test("evaluateRunning supports Hold, Regress, and Recovery Focus safety outcomes", () => {
  const hold = evaluateRunning(input({ readiness: { status: "Yellow", score: 65, averageSleep: 6.2, averageSoreness: 5, averageStress: 5, averageEnergy: 6 } }));
  assert.equal(hold.progression.action, "Hold");

  const regress = evaluateRunning(input({
    currentWeek: { startDate: "2026-06-01", endDate: "2026-06-07", weeklyMileage: 22, rolling7DayMileage: 22, previousWeeklyMileage: 16, runningDaysPlanned: 3, runningDaysCompleted: 3 },
    runLogs: [
      run(3, { completed: true, rpe: 8, averageHr: 160, averagePaceSecondsPerMile: 690, averagePace: 11.5 }),
      run(6, { runType: "long run", plannedDistance: 8, actualDistance: 6, completed: false, rpe: 8, walkBreaks: true, painScore: 5, pain: true }),
    ],
  }));
  assert.equal(regress.progression.action, "Regress");
  assert.ok(regress.readiness.injuryRiskScore >= 50);

  const recovery = evaluateRunning(input({
    readiness: { status: "Red", score: 35, averageSleep: 5, averageSoreness: 8, averageStress: 8, averageEnergy: 3 },
    runLogs: [run(6, { runType: "long run", pain: true, painScore: 8, painLocation: "knee", rpe: 8 })],
  }));
  assert.equal(recovery.progression.action, "Recovery Focus");
  assert.equal(recovery.progression.intensityGuidance, "no-running");
});

test("calculatePredictedHalfMarathonTime and calculatePredictedRacePace use race and long-run signals", () => {
  const prediction = calculatePredictedHalfMarathonTime(input());
  assert.equal(prediction.targetFinishMinutes, 118);
  assert.equal(prediction.targetPaceSecondsPerMile, 540);
  assert.equal(prediction.predictionBasis, "long-run");
  assert.ok(prediction.predictedFinishMinutes !== null && prediction.predictedFinishMinutes > 118);
  assert.ok(prediction.predictedPaceSecondsPerMile !== null && prediction.predictedPaceSecondsPerMile > 540);

  const pace = calculatePredictedRacePace(input());
  assert.equal(pace, prediction.predictedPaceSecondsPerMile);
});

test("calculatePaceZones returns canonical Zone 2, Tempo, Threshold, Race Pace, and VO2 ranges", () => {
  const zones = calculatePaceZones({ racePaceSecondsPerMile: 540, confidence: "High" });

  assert.deepEqual(zones.racePace.paceRangeSecondsPerMile, { min: 535, max: 545 });
  assert.deepEqual(zones.zone2.paceRangeSecondsPerMile, { min: 630, max: 690 });
  assert.equal(zones.zone2.name, "Zone 2");
  assert.equal(zones.tempo.name, "Tempo");
  assert.equal(zones.threshold.name, "Threshold");
  assert.equal(zones.racePace.name, "Race Pace");
  assert.equal(zones.vo2.name, "VO2");
});

test("readiness, race readiness, injury risk, confidence, and data quality are scored separately", () => {
  const base = input();
  const injuryRisk = calculateInjuryRisk(base);
  const raceReadiness = calculateRaceReadiness(base);
  const dataQuality = calculateDataQualityScore(base);
  const confidence = calculateConfidenceScore(base);
  const readiness = calculateRunningReadiness(base);

  assert.ok(injuryRisk < 35);
  assert.ok(raceReadiness >= 65);
  assert.ok(dataQuality >= 80);
  assert.ok(confidence >= 65);
  assert.equal(readiness.status, "Green");
  assert.equal(readiness.injuryRiskScore, injuryRisk);
  assert.equal(readiness.raceReadinessScore, raceReadiness);

  const thinData = input({ runLogs: [], currentWeek: { startDate: "2026-06-01", endDate: "2026-06-07" }, readiness: {} });
  assert.ok(calculateDataQualityScore(thinData) < 65);
  assert.ok(calculateConfidenceScore(thinData) < 65);
});

test("explanations and audit entries include decision drivers, thresholds, confidence, and data quality", () => {
  const base = input();
  const result = evaluateRunning(base);
  const explanation = generateRunningExplanation({
    input: base,
    action: result.progression.action,
    fitnessProfile: result.fitnessProfile,
    readiness: result.readiness,
    prediction: result.prediction,
    longRunStatus: result.longRunStatus,
    weeklyMileageStatus: result.weeklyMileageStatus,
  });
  const audit = generateRunningAuditEntries(result);

  assert.ok(explanation.summary.length > 0);
  assert.ok(explanation.primaryDrivers.length > 0);
  assert.ok(explanation.tradeoffs.some((line) => line.includes("injury") || line.includes("conservative")));
  assert.ok(audit.length >= 5);
  assert.ok(audit.every((entry) => entry.thresholdsApplied.length > 0));
  assert.ok(audit.every((entry) => entry.dataQualityScore === result.dataQualityScore));
});

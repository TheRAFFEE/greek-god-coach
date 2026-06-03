import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { evaluateTraining, type TrainingEngineInput } from "./training-engine";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { Workout } from "./types";

const workout = (overrides: Partial<Workout> = {}): Workout => ({
  id: "w-lift",
  week: 1,
  phase: "Base",
  day: "Monday",
  dayIndex: 0,
  title: "Lower Strength",
  type: "strength",
  notes: "Lift clean.",
  exercises: [
    { id: "squat", workoutId: "w-lift", name: "Back Squat", prescribedSets: 4, prescribedReps: "5", prescribedRpe: 8, category: "strength", order: 1 },
    { id: "rdl", workoutId: "w-lift", name: "RDL", prescribedSets: 3, prescribedReps: "8", prescribedRpe: 8, category: "strength", order: 2 },
  ],
  ...overrides,
});

const readiness = (status: "Green" | "Yellow" | "Red", overrides: Partial<ReadinessEngineResult> = {}): ReadinessEngineResult => ({
  score: status === "Green" ? 88 : status === "Yellow" ? 65 : 38,
  status,
  confidence: "High",
  reasons: [],
  reason: `${status} readiness`,
  recommendation: status === "Green" ? "Train normally" : status === "Yellow" ? "Modify training" : "Recovery only",
  recommendationType: status === "Green" ? "full_training" : status === "Yellow" ? "modified_training" : "recovery_focus",
  trainingGuidance: status === "Green" ? "Full session" : status === "Yellow" ? "Reduce volume" : "No hard training",
  recoveryGuidance: ["Sleep 7+ hours", "Hydrate"],
  dataQualityWarnings: [],
  ...overrides,
});

const progression = (decision: ProgressionEngineResult["weeklyDecision"] = "Progress", overrides: Partial<ProgressionEngineResult> = {}): ProgressionEngineResult => ({
  weeklyDecision: decision,
  nutritionDecision: "Maintain Calories",
  goalStatus: { "Fat Loss": "On Track", Physique: "On Track", Strength: "On Track", "Half Marathon": "On Track" },
  reasons: [],
  warnings: [],
  auditEntries: [],
  confidence: "High",
  dataQuality: { score: 90, confidence: "High", missingInputs: [], penalties: [], warnings: [] },
  ...overrides,
});

const goalTracking = (overrides: Partial<GoalTrackingEngineResult> = {}): GoalTrackingEngineResult => ({
  overallStatus: "On Track",
  overallScore: 86,
  confidence: "High",
  dataQualityScore: 88,
  goals: {
    fatLoss: { domain: "fat_loss", status: "On Track", score: 86, confidence: "High", currentValue: "210", targetValue: "199.9", trend: "down", blockers: [], supportingSignals: [], recommendation: "Stay consistent", explanation: "On track" },
    physique: { domain: "physique", status: "On Track", score: 84, confidence: "High", currentValue: "good", targetValue: "Greek God", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Lift", explanation: "On track" },
    strength: { domain: "strength", status: "On Track", score: 84, confidence: "High", currentValue: "good", targetValue: "progress", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Lift", explanation: "On track" },
    halfMarathon: { domain: "half_marathon", status: "On Track", score: 84, confidence: "High", currentValue: "building", targetValue: "13.1", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Run", explanation: "On track" },
  },
  priorityGoal: "half_marathon",
  summary: "Goals on track",
  recommendations: ["Hit protein goal", "Complete long run"],
  warnings: [],
  explanations: [],
  auditTrail: [],
  ...overrides,
});

function input(overrides: Partial<TrainingEngineInput> = {}): TrainingEngineInput {
  return {
    currentDate: "2026-06-01",
    trainingPlan: null,
    selectedWeek: 1,
    selectedDay: 0,
    readinessResult: readiness("Green"),
    progressionResult: progression(),
    goalTrackingResult: goalTracking(),
    scheduledWorkout: workout(),
    scheduledRun: null,
    availableMinutes: 90,
    userPreferences: { includeWarmup: true, includeCooldown: true },
    ...overrides,
  };
}

test("lift only day orders Warmup Workout Cooldown", () => {
  const result = evaluateTraining(input({ scheduledRun: null }));
  assert.deepEqual(result.sessionOrder, ["warmup", "workout", "cooldown"]);
  assert.equal(result.workout?.title, "Lower Strength");
  assert.equal(result.run, null);
});

test("run only day orders Warmup Run Cooldown", () => {
  const result = evaluateTraining(input({ scheduledWorkout: null, scheduledRun: { type: "easy", distanceMiles: 3, title: "Zone 2 Run" } }));
  assert.deepEqual(result.sessionOrder, ["warmup", "run", "cooldown"]);
  assert.equal(result.workout, null);
  assert.match(result.run?.items.join(" ") ?? "", /3 mi/);
});

test("lift plus run day orders Warmup Workout Run Cooldown", () => {
  const result = evaluateTraining(input({ scheduledRun: { type: "easy", distanceMiles: 3, title: "Zone 2 Run" } }));
  assert.deepEqual(result.sessionOrder, ["warmup", "workout", "run", "cooldown"]);
});

test("green readiness keeps normal session", () => {
  const result = evaluateTraining(input({ readinessResult: readiness("Green") }));
  assert.equal(result.trainingStatus, "Normal");
  assert.doesNotMatch(result.workout?.description ?? "", /reduced/i);
});

test("yellow readiness reduces volume and adds warning", () => {
  const result = evaluateTraining(input({ readinessResult: readiness("Yellow") }));
  assert.equal(result.trainingStatus, "Modified");
  assert.match(result.workout?.description ?? "", /reduced volume/i);
  assert.ok(result.warnings.some((warning) => warning.source === "Readiness Engine" && /Yellow/i.test(warning.message)));
});

test("red readiness blocks hard training and replaces with recovery session", () => {
  const result = evaluateTraining(input({ readinessResult: readiness("Red") }));
  assert.equal(result.trainingStatus, "Recovery");
  assert.deepEqual(result.sessionOrder, ["warmup", "mobility", "walk", "cooldown"]);
  assert.equal(result.workout, null);
});

test("Recovery Focus progression overrides everything", () => {
  const result = evaluateTraining(input({ readinessResult: readiness("Green"), progressionResult: progression("Recovery Focus") }));
  assert.equal(result.trainingStatus, "Recovery");
  assert.deepEqual(result.sessionOrder, ["warmup", "mobility", "walk", "cooldown"]);
  assert.ok(result.warnings.some((warning) => /Recovery Focus/i.test(warning.message)));
});

test("long run day prioritizes the long run", () => {
  const result = evaluateTraining(input({ scheduledWorkout: null, scheduledRun: { type: "long", distanceMiles: 8, title: "Long Run" } }));
  assert.match(result.run?.title ?? "", /Long Run/i);
  assert.ok(result.priorityActions.some((priority) => /long run/i.test(priority.label)));
});

test("high injury risk creates warning", () => {
  const result = evaluateTraining(input({ scheduledRun: { type: "easy", distanceMiles: 3 }, progressionResult: progression("Repeat", { warnings: ["High injury risk from running load."] }) }));
  assert.ok(result.warnings.some((warning) => warning.source === "Running Engine" && /injury risk/i.test(warning.message)));
});

test("missing data creates low confidence warning", () => {
  const result = evaluateTraining(input({ readinessResult: readiness("Green", { confidence: "Low", dataQualityWarnings: ["Missing daily readiness check-in."] }), progressionResult: progression("Repeat", { confidence: "Low", dataQuality: { score: 45, confidence: "Low", missingInputs: ["runningResult"], penalties: [], warnings: ["Need at least 2 recent runs"] } }) }));
  assert.equal(result.confidence, "Low");
  assert.ok(result.warnings.some((warning) => /missing|Need at least 2 recent runs/i.test(warning.message)));
});

test("duration calculation includes warmup workout run and cooldown", () => {
  const result = evaluateTraining(input({ scheduledRun: { type: "easy", distanceMiles: 4 } }));
  assert.equal(result.estimatedDuration.warmupMinutes, 8);
  assert.ok(result.estimatedDuration.workoutMinutes >= 45);
  assert.equal(result.estimatedDuration.runMinutes, 40);
  assert.equal(result.estimatedDuration.cooldownMinutes, 7);
  assert.equal(result.estimatedDuration.totalEstimatedMinutes, result.estimatedDuration.warmupMinutes + result.estimatedDuration.workoutMinutes + result.estimatedDuration.runMinutes + result.estimatedDuration.cooldownMinutes);
});

test("priority generation uses training, goal tracking, progression, readiness, hydration, and sleep signals", () => {
  const result = evaluateTraining(input({ goalTrackingResult: goalTracking({ overallStatus: "At Risk", priorityGoal: "fat_loss" }) }));
  assert.ok(result.priorityActions.length >= 3 && result.priorityActions.length <= 5);
  assert.ok(result.priorityActions.some((priority) => /Lower Strength|workout/i.test(priority.label)));
  assert.ok(result.priorityActions.some((priority) => /protein|hydration|sleep|goal/i.test(priority.label)));
});

test("Home consumes Training Engine output", () => {
  const source = fs.readFileSync("src/lib/home-command-center.ts", "utf8");
  assert.match(source, /evaluateTraining/);
  assert.match(source, /trainingEngine/);
});

test("Train consumes Training Engine output", () => {
  const source = fs.readFileSync("src/app/page.tsx", "utf8");
  assert.match(source, /evaluateTraining/);
  assert.match(source, /trainingEngineResult/);
});

test("session composition lives in Training Engine, not page JSX", () => {
  const source = fs.readFileSync("src/app/page.tsx", "utf8");
  assert.doesNotMatch(source, /buildTrainSessionBlocks\(/);
  assert.match(source, /trainingEngineResult\.todayPlan/);
});

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildHomeCommandCenter } from "./home-command-center";
import type { AppState, MacroTarget } from "./types";

const userId = "user-1";
const macroTarget: MacroTarget = { id: "macro-1", userId, week: 1, calories: 2550, protein: 220, carbs: 210, fat: 70, fiber: 30, water: 120 };

const checkIn = (overrides: Partial<AppState["checkIns"][number]> = {}): AppState["checkIns"][number] => ({
  id: `check-${overrides.date ?? "2026-06-01"}`,
  userId,
  date: overrides.date ?? "2026-06-01",
  weight: 209.8,
  sleepHours: 7.5,
  sleepQuality: 8,
  soreness: 3,
  energy: 8,
  stress: 3,
  hunger: 4,
  motivation: 8,
  alcohol: false,
  steps: 9000,
  restingHr: 58,
  hrv: 61,
  pain: false,
  painLocation: "",
  painSeverity: 0,
  workoutCompleted: true,
  runCompleted: true,
  macrosHit: true,
  notes: "",
  ...overrides,
});

const state = (overrides: Partial<AppState> = {}): AppState => ({
  user: { id: userId, name: "Walter", age: 39, sex: "male", height: "5'11\"", startingWeight: 233, goalWeight: 199.9, activityLevel: "hybrid", goal: "half marathon", trainingExperience: "experienced", strengthNumbers: "", equipment: "gym", injuryHistory: "", preferredUnits: "imperial", createdAt: "2026-05-01T00:00:00.000Z" },
  appMode: "coach",
  currentWeek: 1,
  startDate: "2026-05-01",
  checkIns: [checkIn({ date: "2026-05-29" }), checkIn({ date: "2026-05-30" }), checkIn({ date: "2026-05-31" }), checkIn({ date: "2026-06-01" })],
  bodyMetrics: [
    { id: "metric-1", userId, date: "2026-05-18", weight: 213.8, waist: 40.2 },
    { id: "metric-2", userId, date: "2026-05-19", weight: 213.1, waist: 40.1 },
    { id: "metric-3", userId, date: "2026-05-20", weight: 212.7, waist: 40 },
    { id: "metric-4", userId, date: "2026-05-21", weight: 212.1, waist: 39.9 },
    { id: "metric-5", userId, date: "2026-05-22", weight: 211.7, waist: 39.8 },
    { id: "metric-6", userId, date: "2026-05-23", weight: 211.3, waist: 39.7 },
    { id: "metric-7", userId, date: "2026-05-24", weight: 210.9, waist: 39.6 },
    { id: "metric-8", userId, date: "2026-05-25", weight: 210.7, waist: 39.5 },
    { id: "metric-9", userId, date: "2026-05-26", weight: 210.5, waist: 39.4 },
    { id: "metric-10", userId, date: "2026-05-27", weight: 210.3, waist: 39.3 },
    { id: "metric-11", userId, date: "2026-05-28", weight: 210.1, waist: 39.2 },
    { id: "metric-12", userId, date: "2026-05-29", weight: 210, waist: 39.1 },
    { id: "metric-13", userId, date: "2026-05-30", weight: 209.9, waist: 39 },
    { id: "metric-14", userId, date: "2026-06-01", weight: 209.8, waist: 38.9 },
  ],
  nutritionLogs: [
    { id: "nutrition-1", userId, date: "2026-05-26", calories: 2450, protein: 218, carbs: 205, fat: 68, fiber: 28, sodium: 2500, water: 120, alcohol: 0, notes: "" },
    { id: "nutrition-2", userId, date: "2026-05-27", calories: 2500, protein: 220, carbs: 210, fat: 70, fiber: 30, sodium: 2500, water: 125, alcohol: 0, notes: "" },
    { id: "nutrition-3", userId, date: "2026-05-28", calories: 2520, protein: 224, carbs: 211, fat: 70, fiber: 31, sodium: 2500, water: 120, alcohol: 0, notes: "" },
    { id: "nutrition-4", userId, date: "2026-05-29", calories: 2480, protein: 219, carbs: 208, fat: 69, fiber: 30, sodium: 2500, water: 120, alcohol: 0, notes: "" },
    { id: "nutrition-5", userId, date: "2026-05-30", calories: 2475, protein: 221, carbs: 209, fat: 70, fiber: 29, sodium: 2500, water: 118, alcohol: 0, notes: "" },
    { id: "nutrition-6", userId, date: "2026-05-31", calories: 2510, protein: 220, carbs: 212, fat: 71, fiber: 30, sodium: 2500, water: 122, alcohol: 0, notes: "" },
    { id: "nutrition-7", userId, date: "2026-06-01", calories: 1900, protein: 180, carbs: 160, fat: 60, fiber: 25, sodium: 2500, water: 90, alcohol: 0, notes: "" },
  ],
  runLogs: [{ id: "run-1", userId, date: "2026-05-30", runType: "long run", plannedDistance: 6, actualDistance: 6, durationMinutes: 60, averagePace: 10, averageHr: 145, maxHr: 165, rpe: 6, zone2Compliance: 85, completed: true, walkBreaks: false, pain: false, painScore: 0, painLocation: "", notes: "" }],
  workoutSessions: [{ id: "session-1", userId, workoutId: "upper", workoutTitle: "Upper Strength", mode: "coach", startedAt: "2026-05-29T12:00:00.000Z", endedAt: "2026-05-29T13:00:00.000Z", status: "completed", currentExerciseIndex: 0, currentSetNumber: 1, setLogs: [] }],
  macroTargets: [macroTarget],
  adjustments: [],
  photos: [],
  meals: [],
  foodScans: [],
  exerciseLogs: [],
  setLogs: [],
  workoutSummaries: [],
  postWorkoutRecommendations: [],
  ...overrides,
});

function model(overrides: Partial<AppState> = {}, today = "2026-06-01") {
  return buildHomeCommandCenter(state(overrides), {
    today,
    readinessStatus: "Green",
    todaysWorkout: "Upper Strength",
    todaysRun: "Hold: 3 mi",
    macroTarget,
    coachRecommendation: "Do Upper Strength today with controlled reps. This extra explanation should not become a long report.",
    workoutDurationMinutes: 55,
    runDurationMinutes: 30,
  });
}

test("builds action-focused Home command center metrics", () => {
  const result = model();

  assert.equal(result.readinessStatus, "Green");
  assert.equal(result.todaysWorkout, "Upper Strength");
  assert.equal(result.todaysRun, "Hold: 3 mi");
  assert.equal(result.currentWeight, 209.8);
  assert.equal(result.caloriesRemaining, 650);
  assert.equal(result.weeklyMiles, 6);
  assert.equal(result.daysUntilRace, 230);
});

test("keeps coach recommendation concise for quick mission scanning", () => {
  const result = buildHomeCommandCenter(state(), {
    today: "2026-06-01",
    readinessStatus: "Yellow",
    todaysWorkout: "Lower Strength",
    todaysRun: "Regress: 2 mi",
    macroTarget,
    coachRecommendation: "This is a very long recommendation that should not dominate the command center because Home is not a report screen and the user needs the mission fast without detailed analytics or duplicate explanations that belong in Progress.",
  });

  const sentenceCount = result.coachRecommendation.split(/[.!?]+/).filter(Boolean).length;
  assert.ok(sentenceCount <= 3);
  assert.ok(result.coachRecommendation.includes("Lower Strength"));
  assert.ok(result.coachRecommendation.includes("Regress: 2 mi"));
});

test("generates Today's Goals dynamically from safety, recovery, training, nutrition, and goal signals", () => {
  const result = model({ checkIns: [checkIn({ date: "2026-06-01", pain: true, painSeverity: 7, painLocation: "knee", sleepHours: 5.5 })] });

  assert.ok(result.todaysGoals.length >= 3 && result.todaysGoals.length <= 5);
  assert.equal(result.todaysGoals[0].priority, "Safety");
  assert.match(result.todaysGoals[0].label, /pain|knee|recovery/i);
  assert.ok(result.todaysGoals.some((goal) => /protein/i.test(goal.label)));
  assert.ok(result.todaysGoals.some((goal) => /Upper Strength|workout/i.test(goal.label)));
});

test("renders Goal Tracking statuses for fat loss, physique, strength, and half marathon", () => {
  const result = model();

  assert.deepEqual(Object.keys(result.goalStatuses), ["Fat Loss", "Physique", "Strength", "Half Marathon"]);
  for (const status of Object.values(result.goalStatuses)) {
    assert.ok(["On Track", "At Risk", "Off Track", "Insufficient Data"].includes(status));
  }
});

test("renders the Progression Engine weekly decision in the coach brief", () => {
  const result = model();

  assert.equal(result.coachBrief.weeklyDecision, result.progressionDecision);
  assert.ok(["Progress", "Repeat", "Deload", "Recovery Focus"].includes(result.coachBrief.weeklyDecision));
});

test("exposes a single compact confidence card only", () => {
  const result = model();

  assert.equal(result.confidenceCards.length, 1);
  assert.match(result.confidenceCards[0].label, /Data Quality/);
  assert.ok(["High", "Medium", "Low"].includes(result.confidenceCards[0].value));
});

test("shows Sunday weekly check-in prompt when body metrics have not been logged this week", () => {
  const result = model({ bodyMetrics: [{ id: "old", userId, date: "2026-05-25", weight: 212, waist: 40 }] }, "2026-06-07");

  assert.equal(result.sundayPrompt.visible, true);
  assert.equal(result.sundayPrompt.buttonLabel, "Log Weekly Check-In");
  assert.deepEqual(result.sundayPrompt.items, ["weight", "waist", "photos"]);
});

test("hides Sunday prompt when it is not Sunday or body metrics are already logged this week", () => {
  assert.equal(model({}, "2026-06-06").sundayPrompt.visible, false);
  assert.equal(model({ bodyMetrics: [{ id: "metric-sun", userId, date: "2026-06-07", weight: 209, waist: 38.8 }] }, "2026-06-07").sundayPrompt.visible, false);
});

test("Daily Check-In and Start Workout actions route to the correct primary screens", () => {
  const result = model();

  assert.deepEqual(result.actions.dailyCheckIn, { label: "Daily Check-In", destination: "Log", section: "Daily Check-In" });
  assert.deepEqual(result.actions.startWorkout, { label: "Start Workout", destination: "Train" });
});

test("Sunday prompt routes to Log Body Metrics instead of Daily Check-In", () => {
  const result = model({ bodyMetrics: [{ id: "old", userId, date: "2026-05-25", weight: 212, waist: 40 }] }, "2026-06-07");

  assert.equal(result.sundayPrompt.destination, "Log");
  assert.equal(result.sundayPrompt.section, "Body Metrics");
});

test("Home data quality card uses user-facing labels for missing engine inputs", () => {
  const result = model();

  assert.doesNotMatch(result.confidenceCards[0].reason, /runningResult|workoutResult|nutritionResult/i);
  assert.match(result.confidenceCards[0].reason, /Need|Core readiness|completed workouts|recent runs|meal logs/i);
});

test("hides recovery warnings when none exist", () => {
  const result = model();

  assert.equal(result.recovery.warning, null);
});

test("displays recovery warning when readiness engine warnings exist", () => {
  const result = model({ checkIns: [checkIn({ date: "2026-06-01", sleepHours: 4.5, energy: 3, soreness: 8, stress: 8 })] });

  assert.notEqual(result.recovery.warning, null);
  assert.match(result.recovery.warning ?? "", /sleep|soreness|stress|energy|recovery|warning/i);
});

test("summarizes today's training without recalculating training plan", () => {
  const result = model({ workoutSessions: [{ id: "today", userId, workoutId: "upper", workoutTitle: "Upper Strength", mode: "coach", startedAt: "2026-06-01T12:00:00.000Z", endedAt: "2026-06-01T13:00:00.000Z", status: "completed", currentExerciseIndex: 0, currentSetNumber: 1, setLogs: [] }] });

  assert.equal(result.training.workout.name, "Upper Strength");
  assert.equal(result.training.workout.estimatedDurationMinutes, 55);
  assert.equal(result.training.workout.status, "Completed");
  assert.equal(result.training.run.name, "Hold: 3 mi");
  assert.equal(result.training.run.estimatedDurationMinutes, 30);
});

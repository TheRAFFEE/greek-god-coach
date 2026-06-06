import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHomeTrainingModel,
  validateAuditAndProvenance,
  validateDailyTrainingSession,
  validateDomainInputs,
  validatePersistenceInputs,
  type BuildHomeTrainingModelInput,
} from "./home-adapter";
import type { DailyTrainingSession } from "./training-planner";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { RunningRecommendation, WorkoutSession, RunLog } from "./types";

function readiness(status: ReadinessEngineResult["status"] = "Green"): ReadinessEngineResult {
  return {
    score: status === "Green" ? 90 : status === "Yellow" ? 65 : 35,
    status,
    confidence: "High",
    reasons: [],
    reason: `${status} readiness`,
    recommendation: "Proceed with validated plan.",
    recommendationType: "full_training",
    trainingGuidance: "Use validated training session.",
    recoveryGuidance: [],
    dataQualityWarnings: [],
  };
}

function progression(): ProgressionEngineResult {
  return {
    weeklyDecision: "Progress",
    nutritionDecision: "Maintain Calories",
    goalStatus: { "Fat Loss": "On Track", Physique: "On Track", Strength: "On Track", "Half Marathon": "On Track" },
    confidence: "High",
    dataQuality: { score: 95, confidence: "High", missingInputs: [], penalties: [], warnings: [] },
    reasons: ["Validated inputs support progression."],
    warnings: [],
    auditEntries: [{ id: "progression-audit-1", decisionType: "weekly", decision: "Progress", engine: "Progression Engine", whatHappened: "Progression evaluated.", why: "Validated inputs support progression.", priority: "Optimization", dataUsed: ["test"], confidence: "High", dataQualityScore: 95 }],
  };
}

function goalTracking(): GoalTrackingEngineResult {
  return {
    overallStatus: "On Track",
    overallScore: 90,
    confidence: "High",
    dataQualityScore: 95,
    goals: {
      fatLoss: { domain: "fat_loss", status: "On Track", score: 90, confidence: "High", currentValue: "220", targetValue: "199.9", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue.", explanation: "On track." },
      physique: { domain: "physique", status: "On Track", score: 90, confidence: "High", currentValue: "improving", targetValue: "Greek God", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue.", explanation: "On track." },
      strength: { domain: "strength", status: "On Track", score: 90, confidence: "High", currentValue: "improving", targetValue: "progress", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue.", explanation: "On track." },
      halfMarathon: { domain: "half_marathon", status: "On Track", score: 90, confidence: "High", currentValue: "building", targetValue: "13.1", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue.", explanation: "On track." },
    },
    priorityGoal: "half_marathon",
    summary: "Goals are on track.",
    recommendations: ["Continue."],
    warnings: [],
    explanations: [],
    auditTrail: [],
  };
}

const recommendation: RunningRecommendation = {
  action: "Progress",
  recommendedDistance: 3,
  message: "Run the validated plan.",
  reasons: ["Inputs support the run."],
  warnings: [],
};

function baseSession(overrides: Partial<DailyTrainingSession> = {}): DailyTrainingSession {
  const session: DailyTrainingSession = {
    id: "planner-session-2026-06-01",
    date: "2026-06-01",
    currentWeek: 1,
    dayIndex: 0,
    sourcePlan: {
      source: "seed-workouts-v1",
      sourceWorkoutId: "workout-1",
      sourceWorkoutTitle: "Upper Strength + Core",
      sourceWorkoutType: "strength",
      sourceWorkoutDeload: false,
      resolvedSessionType: "LiftDay",
    },
    sessionType: "LiftDay",
    metadata: { deload: false },
    status: "Normal",
    readinessStatus: "Green",
    confidence: "High",
    summary: {
      title: "Upper Strength + Core",
      primaryAction: "Complete Upper Strength + Core",
      workoutName: "Upper Strength + Core",
      runName: null,
      estimatedDurationMinutes: 65,
      completionStatus: "Not Started",
    },
    blocks: [],
    workout: {
      sourceWorkoutId: "workout-1",
      title: "Upper Strength + Core",
      type: "strength",
      exercises: [],
      estimatedMinutes: 50,
      readinessAdjusted: false,
      executionRequired: true,
      loggingTarget: { workoutId: "workout-1", workoutTitle: "Upper Strength + Core", date: "2026-06-01" },
    },
    run: null,
    mobility: null,
    recovery: null,
    support: [{ kind: "Core", title: "Core", items: ["1. Pallof Press: 3 x 12/side", "2. Farmer Carries: 3 x 40 yd"], sourceWorkoutId: "workout-1" }],
    warmup: null,
    cooldown: null,
    estimatedDurationMinutes: 65,
    combinedLoad: {
      estimatedDurationMinutes: 65,
      modalityCount: 1,
      hasLift: true,
      hasRun: false,
      hasConditioning: false,
      hasPlyometricsOrSprints: false,
      lowerBodyStress: "Low",
      sessionStress: "Moderate",
      overloadFlags: [],
    },
    modifications: [],
    warnings: [],
    todayGoals: [{ label: "Complete Upper Strength + Core", priority: "Training", source: "Training Planner" }],
    auditTrail: [{ id: "audit-1", event: "session_created", message: "Planner session created.", source: "Training Planner" }],
  };
  return { ...session, ...overrides };
}

function completedWorkoutSession(): WorkoutSession {
  return {
    id: "workout-session-1",
    userId: "user-1",
    workoutId: "workout-1",
    workoutTitle: "Upper Strength + Core",
    mode: "coach",
    startedAt: "2026-06-01T12:00:00.000Z",
    endedAt: "2026-06-01T13:00:00.000Z",
    status: "completed",
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    setLogs: [],
  };
}

function completedRunLog(): RunLog {
  return {
    id: "run-log-1",
    userId: "user-1",
    date: "2026-06-02",
    runType: "easy",
    plannedDistance: 3,
    actualDistance: 3,
    durationMinutes: 30,
    averagePace: 600,
    averageHr: 140,
    maxHr: 155,
    rpe: 5,
    zone2Compliance: 90,
    completed: true,
    pain: false,
    painLocation: "",
    notes: "Clean run.",
  };
}

function input(overrides: Partial<BuildHomeTrainingModelInput> = {}): BuildHomeTrainingModelInput {
  return {
    mode: "developer-only",
    requestDate: "2026-06-01",
    session: baseSession(),
    readinessResult: readiness(),
    progressionResult: progression(),
    goalTrackingResult: goalTracking(),
    recommendation: { coachRecommendation: "Complete the validated session.", runningRecommendation: null },
    workoutSessions: [],
    runLogs: [],
    auditHash: "audit-hash-1",
    provenance: { source: "test", plannerVersion: "planner-v1", adapterVersion: "home-adapter-v1" },
    ...overrides,
  };
}

test("RecoveryDay remains RecoveryDay and never becomes MobilityDay", () => {
  const session = baseSession({
    sessionType: "RecoveryDay",
    sourcePlan: { source: "seed-workouts-v1", sourceWorkoutId: "recovery-1", sourceWorkoutTitle: "Recovery", sourceWorkoutType: "recovery", resolvedSessionType: "RecoveryDay" },
    summary: { title: "Recovery", primaryAction: "Complete recovery", workoutName: null, runName: null, estimatedDurationMinutes: 35, completionStatus: "Not Started" },
    workout: null,
    support: [],
    recovery: { title: "Recovery", items: ["Easy walk", "Hydration", "Sleep focus"], estimatedMinutes: 35, reason: "Planned recovery day" },
    mobility: { sourceWorkoutId: "recovery-1", title: "Mobility Flow", items: ["Hip mobility"], estimatedMinutes: 10 },
    estimatedDurationMinutes: 35,
  });

  const result = buildHomeTrainingModel(input({ session }));

  assert.equal(result.status, "PASS");
  assert.equal(result.model?.sessionType, "RecoveryDay");
  assert.notEqual(result.model?.sessionType, "MobilityDay");
  assert.equal(result.model?.recovery?.name, "Recovery");
});

test("Core support remains Support Core and never changes session type or logging requirements", () => {
  const result = buildHomeTrainingModel(input());

  assert.equal(result.status, "PASS");
  assert.equal(result.model?.sessionType, "LiftDay");
  assert.deepEqual(result.model?.support.map((item) => item.kind), ["Core"]);
  assert.equal(result.model?.workout.loggingRequired, true);
  assert.equal(result.model?.run.loggingRequired, false);
  assert.equal(result.model?.run.status, "Not Scheduled");
});

test("Deload remains metadata and never becomes DeloadDay", () => {
  const session = baseSession({ metadata: { deload: true }, sourcePlan: { ...baseSession().sourcePlan, sourceWorkoutDeload: true } });

  const result = buildHomeTrainingModel(input({ session }));

  assert.equal(result.status, "PASS");
  assert.equal(result.model?.deload, true);
  assert.equal(result.model?.sessionType, "LiftDay");
  assert.notEqual(result.model?.sessionType, "DeloadDay");
});

test("Workout mapping preserves workout item and completion comes from persisted workout sessions only", () => {
  const result = buildHomeTrainingModel(input({ workoutSessions: [completedWorkoutSession()] }));

  assert.equal(result.model?.workout.name, "Upper Strength + Core");
  assert.equal(result.model?.workout.estimatedDurationMinutes, 50);
  assert.equal(result.model?.workout.status, "Completed");
  assert.equal(result.model?.workout.loggingTarget?.workoutId, "workout-1");
});

test("Run mapping preserves run item and completion comes from persisted run logs only", () => {
  const session = baseSession({
    date: "2026-06-02",
    dayIndex: 1,
    sessionType: "RunDay",
    sourcePlan: { source: "seed-workouts-v1", sourceWorkoutId: "run-1", sourceWorkoutTitle: "Zone 2 Run", sourceWorkoutType: "run", resolvedSessionType: "RunDay" },
    summary: { title: "Zone 2 Run", primaryAction: "Run Zone 2", workoutName: null, runName: "Zone 2 Run", estimatedDurationMinutes: 40, completionStatus: "Not Started" },
    workout: null,
    run: {
      sourceWorkoutId: "run-1",
      title: "Zone 2 Run",
      type: "easy",
      prescriptionMode: "distance",
      distanceMiles: 3,
      durationMinutes: null,
      required: true,
      estimatedMinutes: 30,
      executionRequired: true,
      loggingTarget: { date: "2026-06-02", plannedDistance: 3, plannedDurationMinutes: null, runType: "easy" },
    },
    support: [{ kind: "Core", title: "Core", items: ["Side Plank: 3 x 30 sec"], sourceWorkoutId: "run-1" }],
  });

  const result = buildHomeTrainingModel(input({ requestDate: "2026-06-02", session, runLogs: [completedRunLog()], recommendation: { coachRecommendation: "Run the validated session.", runningRecommendation: recommendation } }));

  assert.equal(result.status, "PASS");
  assert.equal(result.model?.run.name, "Zone 2 Run");
  assert.equal(result.model?.run.estimatedDurationMinutes, 30);
  assert.equal(result.model?.run.status, "Completed");
  assert.equal(result.model?.run.loggingRequired, true);
  assert.equal(result.model?.support[0].kind, "Core");
  assert.equal(result.model?.workout.loggingRequired, false);
});

test("Support mapping preserves support items", () => {
  const result = buildHomeTrainingModel(input());

  assert.deepEqual(result.model?.support, [{
    kind: "Core",
    title: "Core",
    items: ["1. Pallof Press: 3 x 12/side", "2. Farmer Carries: 3 x 40 yd"],
    sourceWorkoutId: "workout-1",
  }]);
});

test("Audit and provenance metadata are preserved", () => {
  const result = buildHomeTrainingModel(input());

  assert.equal(result.model?.audit.auditHash, "audit-hash-1");
  assert.deepEqual(result.model?.audit.provenance, { source: "test", plannerVersion: "planner-v1", adapterVersion: "home-adapter-v1" });
  assert.deepEqual(result.model?.audit.plannerAuditTrailIds, ["audit-1"]);
});

test("Missing required session input produces BLOCKER", () => {
  const result = buildHomeTrainingModel(input({ session: null }));

  assert.equal(result.status, "BLOCKER");
  assert.equal(result.model, null);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.severity === "BLOCKER" && diagnostic.code === "SESSION_MISSING"));
});

test("No fabricated readiness: missing readiness produces BLOCKER", () => {
  const result = buildHomeTrainingModel(input({ readinessResult: null }));

  assert.equal(result.status, "BLOCKER");
  assert.equal(result.model, null);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "READINESS_MISSING"));
});

test("No fabricated progression: missing progression produces BLOCKER", () => {
  const result = buildHomeTrainingModel(input({ progressionResult: null }));

  assert.equal(result.status, "BLOCKER");
  assert.equal(result.model, null);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "PROGRESSION_MISSING"));
});

test("No fabricated recommendation: missing recommendation produces BLOCKER", () => {
  const result = buildHomeTrainingModel(input({ recommendation: null }));

  assert.equal(result.status, "BLOCKER");
  assert.equal(result.model, null);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "RECOMMENDATION_MISSING"));
});

test("DeloadDay is blocked instead of mapped", () => {
  const session = baseSession({ sessionType: "DeloadDay", sourcePlan: { ...baseSession().sourcePlan, resolvedSessionType: "DeloadDay" } });

  const result = buildHomeTrainingModel(input({ session }));

  assert.equal(result.status, "BLOCKER");
  assert.equal(result.model, null);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "DELOAD_DAY_FORBIDDEN"));
});

test("validation helpers return explicit PASS WARNING BLOCKER statuses", () => {
  assert.equal(validateDailyTrainingSession(baseSession(), "2026-06-01").status, "PASS");
  assert.equal(validateDomainInputs({ session: baseSession(), readinessResult: null, progressionResult: progression(), goalTrackingResult: goalTracking(), recommendation: { coachRecommendation: "ok", runningRecommendation: null } }).status, "BLOCKER");
  assert.equal(validateAuditAndProvenance({ session: baseSession(), auditHash: "", provenance: { source: "test" } }).status, "BLOCKER");
  assert.equal(validatePersistenceInputs({ workoutSessions: undefined, runLogs: [] }).status, "BLOCKER");
});

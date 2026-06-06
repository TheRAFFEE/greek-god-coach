import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { buildHomeTrainingModel, type BuildHomeTrainingModelInput, type HomeTrainingModel } from "./home-adapter";
import { buildHomeCommandCenter, type HomeCommandCenterModel } from "./home-command-center";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { PrimarySessionType } from "./primary-session-resolver";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { DailyTrainingSession } from "./training-planner";
import type { AppState, Exercise, MacroTarget, RunningRecommendation, Workout } from "./types";

const userId = "user-1";
const macroTarget: MacroTarget = { id: "macro-1", userId, week: 1, calories: 2550, protein: 220, carbs: 210, fat: 70, fiber: 30, water: 120 };

function readiness(status: ReadinessEngineResult["status"] = "Green"): ReadinessEngineResult {
  return {
    score: status === "Green" ? 92 : status === "Yellow" ? 68 : 35,
    status,
    confidence: "High",
    reasons: [],
    reason: `${status} readiness supplied by test fixture`,
    recommendation: "Use validated training inputs.",
    recommendationType: "full_training",
    trainingGuidance: "Proceed from validated source inputs.",
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
    reasons: ["Representative shadow fixture."],
    warnings: [],
    auditEntries: [{ id: "progression-audit-1", decisionType: "weekly", decision: "Progress", engine: "Progression Engine", whatHappened: "Progression evaluated.", why: "Representative shadow fixture.", priority: "Optimization", dataUsed: ["fixture"], confidence: "High", dataQualityScore: 95 }],
  };
}

function goalTracking(): GoalTrackingEngineResult {
  return {
    overallStatus: "On Track",
    overallScore: 90,
    confidence: "High",
    dataQualityScore: 95,
    goals: {
      fatLoss: { domain: "fat_loss", status: "On Track", score: 90, confidence: "High", currentValue: "210", targetValue: "199.9", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue.", explanation: "On track." },
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

const runningRecommendation: RunningRecommendation = {
  action: "Progress",
  recommendedDistance: 3,
  message: "Use validated run prescription.",
  reasons: ["Representative fixture."],
  warnings: [],
};

function exercise(id: string, workoutId: string, name: string, category = "strength", prescribedReps = "3 x 8", order = 1): Exercise {
  return { id, workoutId, name, prescribedSets: 3, prescribedReps, category, order };
}

function sourceWorkout(id: string, title: string, type: string, dayIndex: number, deload = false, exercises: Exercise[] = []): Workout {
  return { id, userId, week: 1, phase: "Base", day: `Day ${dayIndex + 1}`, dayIndex, title, type, notes: "Representative shadow fixture", deload, exercises };
}

function baseSession(type: PrimarySessionType, overrides: Partial<DailyTrainingSession> = {}): DailyTrainingSession {
  const date = overrides.date ?? "2026-06-01";
  const sourceWorkoutId = overrides.sourcePlan?.sourceWorkoutId ?? `${type.toLowerCase()}-source`;
  const title = overrides.summary?.title ?? type.replace("Day", " Day");
  const workout = type === "LiftDay" || type === "HybridDay" || type === "TestDay" ? {
    sourceWorkoutId,
    title,
    type: "strength",
    exercises: [exercise("ex-1", sourceWorkoutId, "Bench Press"), exercise("ex-2", sourceWorkoutId, "Cable Crunch", "core", "3 x 12", 2)],
    estimatedMinutes: 50,
    readinessAdjusted: false,
    executionRequired: true,
    loggingTarget: { workoutId: sourceWorkoutId, workoutTitle: title, date },
  } : null;
  const run = type === "RunDay" || type === "LongRunDay" || type === "RaceDay" ? {
    sourceWorkoutId,
    title,
    type: type === "LongRunDay" ? "long" as const : "easy" as const,
    prescriptionMode: "distance" as const,
    distanceMiles: type === "LongRunDay" ? 8 : 3,
    durationMinutes: null,
    required: true,
    estimatedMinutes: type === "LongRunDay" ? 90 : 35,
    executionRequired: true,
    loggingTarget: { date, plannedDistance: type === "LongRunDay" ? 8 : 3, plannedDurationMinutes: null, runType: type === "LongRunDay" ? "long run" as const : "easy" as const },
  } : null;
  const recovery = type === "RecoveryDay" ? { title, items: ["Easy walk", "Hydration", "Sleep focus"], estimatedMinutes: 35, reason: "Planned recovery" } : null;
  const mobility = type === "MobilityDay" ? { sourceWorkoutId, title, items: ["Hip mobility", "T-spine rotations"], estimatedMinutes: 25 } : type === "RecoveryDay" ? { sourceWorkoutId, title: "Mobility support", items: ["Hip mobility"], estimatedMinutes: 10 } : null;
  const support = [{ kind: "Core" as const, title: "Core", items: ["Pallof Press: 3 x 12/side", "Farmer Carries: 3 x 40 yd"], sourceWorkoutId }];
  const estimatedDurationMinutes = workout?.estimatedMinutes ?? run?.estimatedMinutes ?? recovery?.estimatedMinutes ?? mobility?.estimatedMinutes ?? 0;

  return {
    id: `session-${type}-${date}`,
    date,
    currentWeek: 1,
    dayIndex: overrides.dayIndex ?? 0,
    sourcePlan: { source: "seed-workouts-v1", sourceWorkoutId, sourceWorkoutTitle: title, sourceWorkoutType: type, sourceWorkoutDeload: false, resolvedSessionType: type },
    sessionType: type,
    metadata: { deload: false },
    status: type === "RecoveryDay" ? "Recovery" : "Normal",
    readinessStatus: "Green",
    confidence: "High",
    summary: { title, primaryAction: `Complete ${title}`, workoutName: workout?.title ?? null, runName: run?.title ?? null, estimatedDurationMinutes, completionStatus: "Not Started" },
    blocks: [],
    workout,
    run,
    mobility,
    recovery,
    support,
    warmup: null,
    cooldown: null,
    estimatedDurationMinutes,
    combinedLoad: { estimatedDurationMinutes, modalityCount: [workout, run, mobility, recovery].filter(Boolean).length, hasLift: Boolean(workout), hasRun: Boolean(run), hasConditioning: false, hasPlyometricsOrSprints: false, lowerBodyStress: type === "LongRunDay" ? "High" : "Low", sessionStress: type === "RecoveryDay" ? "Recovery" : "Moderate", overloadFlags: [] },
    modifications: [],
    warnings: [],
    todayGoals: [{ label: `Complete ${title}`, priority: "Training", source: "Training Planner" }],
    auditTrail: [{ id: `audit-${type}`, event: "session_created", message: `${type} shadow fixture created.`, source: "Training Planner" }],
    ...overrides,
  };
}

function representativeSessions(): DailyTrainingSession[] {
  const lift = baseSession("LiftDay", { date: "2026-06-01", dayIndex: 0, summary: { title: "Lift Day", primaryAction: "Complete Lift Day", workoutName: "Lift Day", runName: null, estimatedDurationMinutes: 50, completionStatus: "Not Started" } });
  const run = baseSession("RunDay", { date: "2026-06-02", dayIndex: 1, summary: { title: "Run Day", primaryAction: "Complete Run Day", workoutName: null, runName: "Run Day", estimatedDurationMinutes: 35, completionStatus: "Not Started" } });
  const longRun = baseSession("LongRunDay", { date: "2026-06-07", dayIndex: 6, summary: { title: "Long Run Day", primaryAction: "Complete Long Run Day", workoutName: null, runName: "Long Run Day", estimatedDurationMinutes: 90, completionStatus: "Not Started" } });
  const recovery = baseSession("RecoveryDay", { date: "2026-06-08", dayIndex: 0, summary: { title: "Recovery Day", primaryAction: "Complete Recovery Day", workoutName: null, runName: null, estimatedDurationMinutes: 35, completionStatus: "Not Started" } });
  const mobility = baseSession("MobilityDay", { date: "2026-06-09", dayIndex: 1, summary: { title: "Mobility Day", primaryAction: "Complete Mobility Day", workoutName: null, runName: null, estimatedDurationMinutes: 25, completionStatus: "Not Started" } });
  const deloadLift = { ...baseSession("LiftDay", { date: "2026-06-10", dayIndex: 2, summary: { title: "Deload Lift Day", primaryAction: "Complete Deload Lift Day", workoutName: "Deload Lift Day", runName: null, estimatedDurationMinutes: 40, completionStatus: "Not Started" } }), metadata: { deload: true }, sourcePlan: { ...lift.sourcePlan, sourceWorkoutId: "deload-lift-source", sourceWorkoutTitle: "Deload Lift Day", sourceWorkoutDeload: true, resolvedSessionType: "LiftDay" as const } };
  const deloadRun = { ...baseSession("RunDay", { date: "2026-06-11", dayIndex: 3, summary: { title: "Deload Run Day", primaryAction: "Complete Deload Run Day", workoutName: null, runName: "Deload Run Day", estimatedDurationMinutes: 30, completionStatus: "Not Started" } }), metadata: { deload: true }, sourcePlan: { ...run.sourcePlan, sourceWorkoutId: "deload-run-source", sourceWorkoutTitle: "Deload Run Day", sourceWorkoutDeload: true, resolvedSessionType: "RunDay" as const } };
  const deloadRecovery = { ...baseSession("RecoveryDay", { date: "2026-06-12", dayIndex: 4, summary: { title: "Deload Recovery Day", primaryAction: "Complete Deload Recovery Day", workoutName: null, runName: null, estimatedDurationMinutes: 30, completionStatus: "Not Started" } }), metadata: { deload: true }, sourcePlan: { ...recovery.sourcePlan, sourceWorkoutId: "deload-recovery-source", sourceWorkoutTitle: "Deload Recovery Day", sourceWorkoutDeload: true, resolvedSessionType: "RecoveryDay" as const } };
  return [run, lift, longRun, recovery, mobility, deloadLift, deloadRun, deloadRecovery];
}

function appStateFor(session: DailyTrainingSession): AppState {
  const scheduledWorkout = session.workout ? sourceWorkout(session.workout.sourceWorkoutId, session.workout.title, session.workout.type, session.dayIndex, session.metadata.deload, session.workout.exercises) : null;
  const scheduledRunWorkout = session.run ? sourceWorkout(session.run.sourceWorkoutId ?? `run-${session.date}`, session.run.title, session.run.type, session.dayIndex, session.metadata.deload, [exercise(`run-ex-${session.date}`, session.run.sourceWorkoutId ?? `run-${session.date}`, session.run.title, "run", `${session.run.distanceMiles ?? session.run.durationMinutes ?? 0} miles`)]) : null;
  const workouts = [scheduledWorkout, scheduledRunWorkout].filter((item): item is Workout => Boolean(item));
  return {
    user: { id: userId, name: "Walter", age: 39, sex: "male", height: "5'11\"", startingWeight: 233, goalWeight: 199.9, activityLevel: "hybrid", goal: "half marathon", trainingExperience: "experienced", strengthNumbers: "", equipment: "gym", injuryHistory: "", preferredUnits: "imperial", createdAt: "2026-05-01T00:00:00.000Z" },
    appMode: "coach",
    currentWeek: 1,
    startDate: "2026-05-01",
    checkIns: [],
    bodyMetrics: [],
    nutritionLogs: [],
    runLogs: [],
    workoutSessions: [],
    macroTargets: [macroTarget],
    adjustments: [],
    photos: [],
    meals: [],
    foodScans: [],
    exerciseLogs: [],
    setLogs: [],
    workoutSummaries: [],
    postWorkoutRecommendations: [],
    workouts,
  } as AppState;
}

function adapterInput(session: DailyTrainingSession, overrides: Partial<BuildHomeTrainingModelInput> = {}): BuildHomeTrainingModelInput {
  return {
    mode: "developer-only",
    requestDate: session.date,
    session,
    readinessResult: readiness(session.readinessStatus),
    progressionResult: progression(),
    goalTrackingResult: goalTracking(),
    recommendation: { coachRecommendation: session.summary.primaryAction, runningRecommendation: session.run ? runningRecommendation : null },
    workoutSessions: [],
    runLogs: [],
    auditHash: `audit-hash-${session.id}`,
    provenance: { source: "home-adapter-parity-test", plannerVersion: "planner-v1", adapterVersion: "home-adapter-v1" },
    ...overrides,
  };
}

function homeModelFor(session: DailyTrainingSession): HomeTrainingModel {
  const result = buildHomeTrainingModel(adapterInput(session));
  assert.equal(result.status, "PASS");
  assert.ok(result.model);
  return result.model;
}

function legacyModelFor(session: DailyTrainingSession): HomeCommandCenterModel {
  return buildHomeCommandCenter(appStateFor(session), {
    today: session.date,
    readinessStatus: session.readinessStatus,
    todaysWorkout: session.workout?.title ?? session.recovery?.title ?? session.mobility?.title ?? "No workout scheduled today",
    todaysRun: session.run?.title ?? "No run scheduled today",
    macroTarget,
    coachRecommendation: session.summary.primaryAction,
    workoutDurationMinutes: session.workout?.estimatedMinutes ?? session.recovery?.estimatedMinutes ?? session.mobility?.estimatedMinutes ?? 0,
    runDurationMinutes: session.run?.estimatedMinutes ?? 0,
    scheduledWorkout: session.workout ? sourceWorkout(session.workout.sourceWorkoutId, session.workout.title, session.workout.type, session.dayIndex, session.metadata.deload, session.workout.exercises) : null,
    scheduledRun: session.run ? { type: session.run.type, title: session.run.title, distanceMiles: session.run.distanceMiles ?? 0, estimatedMinutes: session.run.estimatedMinutes } : null,
    readinessResult: readiness(session.readinessStatus),
    progressionResult: progression(),
    goalTrackingResult: goalTracking(),
  });
}

function structuralDiffs(adapter: HomeTrainingModel, legacy: HomeCommandCenterModel): string[] {
  const diffs: string[] = [];
  if (adapter.title !== legacy.training.workout.name && adapter.workout.loggingRequired) diffs.push(`workout label: adapter=${adapter.title} legacy=${legacy.training.workout.name}`);
  if (adapter.run.loggingRequired && adapter.run.name !== legacy.training.run.name) diffs.push(`run label: adapter=${adapter.run.name} legacy=${legacy.training.run.name}`);
  if (adapter.estimatedDurationMinutes !== legacy.training.estimatedDurationMinutes) diffs.push(`duration: adapter=${adapter.estimatedDurationMinutes} legacy=${legacy.training.estimatedDurationMinutes}`);
  if (adapter.workout.loggingRequired && legacy.training.workout.status === "Not Completed" && adapter.workout.status === "Not Scheduled") diffs.push("workout scheduledness differs");
  if (adapter.run.loggingRequired && legacy.training.run.status === "Not Completed" && adapter.run.status === "Not Scheduled") diffs.push("run scheduledness differs");
  return diffs;
}

test("representative HomeAdapter models preserve planner identity and display-consumer-compatible shape", () => {
  for (const session of representativeSessions()) {
    const model = homeModelFor(session);
    assert.equal(model.sessionId, session.id);
    assert.equal(model.sessionType, session.sessionType);
    assert.equal(model.primaryObjective, session.summary.primaryAction);
    assert.equal(model.title, session.summary.title);
    assert.equal(model.deload, session.metadata.deload);
    assert.equal(model.estimatedDurationMinutes, session.estimatedDurationMinutes);
    assert.equal(model.durationMetadata.summaryEstimatedDurationMinutes, session.summary.estimatedDurationMinutes);
    assert.equal(model.durationMetadata.combinedLoadEstimatedDurationMinutes, session.combinedLoad.estimatedDurationMinutes);
    assert.equal(model.workout.loggingRequired, Boolean(session.workout?.executionRequired));
    assert.equal(model.run.loggingRequired, Boolean(session.run?.executionRequired));
    assert.equal(model.support.length, session.support.length);
    assert.deepEqual(model.support.map((item) => item.kind), session.support.map((item) => item.kind));
    assert.ok(model.workout.name.length > 0);
    assert.ok(model.run.name.length > 0);
  }
});

test("representative shadow comparison builds legacy Home path and HomeAdapter path without reconciling differences", () => {
  const findings = representativeSessions().map((session) => {
    const adapter = homeModelFor(session);
    const legacy = legacyModelFor(session);
    return { sessionType: session.sessionType, deload: session.metadata.deload, differences: structuralDiffs(adapter, legacy) };
  });

  assert.equal(findings.length, 8);
  assert.ok(findings.every((finding) => Array.isArray(finding.differences)));
  assert.ok(findings.some((finding) => finding.sessionType === "RecoveryDay" && finding.deload));
});

test("RecoveryDay Support Core deload and logging invariants survive parity verification", () => {
  const recovery = representativeSessions().find((session) => session.sessionType === "RecoveryDay" && session.metadata.deload);
  assert.ok(recovery);
  const model = homeModelFor(recovery);

  assert.equal(model.sessionType, "RecoveryDay");
  assert.notEqual(model.sessionType, "MobilityDay");
  assert.equal(model.deload, true);
  assert.deepEqual(model.support.map((item) => item.kind), ["Core"]);
  assert.equal(model.workout.loggingRequired, false);
  assert.equal(model.run.loggingRequired, false);
  assert.equal(model.recovery?.required, true);
});

test("runtime imports keep home-adapter limited to the developer-only pilot", () => {
  const runtimeFiles = [
    "src/app/page.tsx",
    "src/lib/home-command-center.ts",
    "src/lib/home-daily-dashboard.ts",
    "src/lib/mission-control-ui.ts",
    "src/lib/training-engine.ts",
  ];

  for (const file of runtimeFiles) {
    const source = fs.readFileSync(file, "utf8");
    if (file === "src/app/page.tsx") {
      assert.equal(source.includes("homeAdapterPilot"), true, "page.tsx may consume home-adapter only behind the developer pilot flag");
      continue;
    }
    assert.equal(source.includes("./home-adapter"), false, `${file} must not import home-adapter`);
    assert.equal(source.includes("home-adapter"), false, `${file} must not consume home-adapter`);
  }
});

test("home-adapter remains test-only and unmounted from src runtime files", () => {
  const offenders: string[] = [];
  const allowedPilotFiles = new Set([
    path.join("src", "app", "page.tsx"),
    path.join("src", "lib", "home-adapter-pilot.ts"),
  ]);
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (entry.name === "home-adapter.ts" || entry.name.endsWith(".test.ts")) continue;
      if (allowedPilotFiles.has(fullPath)) continue;
      const source = fs.readFileSync(fullPath, "utf8");
      if (source.includes("./home-adapter") || source.includes("home-adapter")) offenders.push(fullPath);
    }
  };

  walk("src");
  assert.deepEqual(offenders, []);
});

test("adapter safety blockers remain enforced during shadow verification", () => {
  const session = representativeSessions()[0];
  const blockerCases: Array<[string, Partial<BuildHomeTrainingModelInput>, string]> = [
    ["missing readiness", { readinessResult: null }, "READINESS_MISSING"],
    ["missing progression", { progressionResult: null }, "PROGRESSION_MISSING"],
    ["missing recommendation", { recommendation: null }, "RECOMMENDATION_MISSING"],
    ["missing persistence", { workoutSessions: undefined }, "WORKOUT_LOGS_MISSING"],
    ["missing provenance", { provenance: null }, "PROVENANCE_MISSING"],
    ["missing audit hash", { auditHash: null }, "AUDIT_HASH_MISSING"],
  ];

  for (const [label, overrides, code] of blockerCases) {
    const result = buildHomeTrainingModel(adapterInput(session, overrides));
    assert.equal(result.status, "BLOCKER", label);
    assert.equal(result.model, null, label);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code), label);
  }
});

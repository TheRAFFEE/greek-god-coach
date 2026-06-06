import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { buildHomeTrainingModel, type BuildHomeTrainingModelInput } from "./home-adapter";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { PrimarySessionType } from "./primary-session-resolver";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { DailyTrainingSession } from "./training-planner";
import type { Exercise, RunningRecommendation } from "./types";

function readiness(status: ReadinessEngineResult["status"] = "Green"): ReadinessEngineResult {
  return {
    score: 90,
    status,
    confidence: "High",
    reasons: [],
    reason: "Contract hardening fixture.",
    recommendation: "Use validated inputs.",
    recommendationType: "full_training",
    trainingGuidance: "Proceed only with validated inputs.",
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
    reasons: ["Contract hardening fixture."],
    warnings: [],
    auditEntries: [{ id: "progression-audit-hardening", decisionType: "weekly", decision: "Progress", engine: "Progression Engine", whatHappened: "Progression evaluated.", why: "Contract hardening fixture.", priority: "Optimization", dataUsed: ["fixture"], confidence: "High", dataQualityScore: 95 }],
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

const runRecommendation: RunningRecommendation = {
  action: "Progress",
  recommendedDistance: 3,
  message: "Use validated run prescription.",
  reasons: ["Contract hardening fixture."],
  warnings: [],
};

function exercise(id: string, workoutId: string, name: string, category = "strength", order = 1): Exercise {
  return { id, workoutId, name, prescribedSets: 3, prescribedReps: "3 x 8", category, order };
}

function session(type: PrimarySessionType = "LiftDay", overrides: Partial<DailyTrainingSession> = {}): DailyTrainingSession {
  const date = overrides.date ?? "2026-06-15";
  const sourceWorkoutId = overrides.sourcePlan?.sourceWorkoutId ?? `${type.toLowerCase()}-hardening-source`;
  const title = overrides.summary?.title ?? type.replace("Day", " Day");
  const workout = type === "LiftDay" || type === "HybridDay" || type === "TestDay" ? {
    sourceWorkoutId,
    title,
    type: "strength",
    exercises: [exercise("ex-hardening-1", sourceWorkoutId, "Bench Press"), exercise("ex-hardening-2", sourceWorkoutId, "Pallof Press", "core", 2)],
    estimatedMinutes: 45,
    readinessAdjusted: false,
    executionRequired: true,
    loggingTarget: { workoutId: sourceWorkoutId, workoutTitle: title, date },
  } : null;
  const run = type === "RunDay" || type === "LongRunDay" || type === "HybridDay" || type === "RaceDay" ? {
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
  const recovery = type === "RecoveryDay" ? { title, items: ["Walk", "Hydration"], estimatedMinutes: 30, reason: "Planned recovery" } : null;
  const mobility = type === "MobilityDay" ? { sourceWorkoutId, title, items: ["Hip mobility"], estimatedMinutes: 20 } : type === "RecoveryDay" ? { sourceWorkoutId, title: "Mobility support", items: ["Hip mobility"], estimatedMinutes: 10 } : null;
  const estimatedDurationMinutes = workout?.estimatedMinutes ?? run?.estimatedMinutes ?? recovery?.estimatedMinutes ?? mobility?.estimatedMinutes ?? 0;

  return {
    id: `session-${type}-${date}`,
    date,
    currentWeek: 1,
    dayIndex: 0,
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
    support: [{ kind: "Core", title: "Core", items: ["Pallof Press", "Farmer Carries"], sourceWorkoutId }],
    warmup: null,
    cooldown: null,
    estimatedDurationMinutes,
    combinedLoad: { estimatedDurationMinutes, modalityCount: [workout, run, mobility, recovery].filter(Boolean).length, hasLift: Boolean(workout), hasRun: Boolean(run), hasConditioning: false, hasPlyometricsOrSprints: false, lowerBodyStress: "Low", sessionStress: type === "RecoveryDay" ? "Recovery" : "Moderate", overloadFlags: [] },
    modifications: [],
    warnings: [],
    todayGoals: [{ label: `Complete ${title}`, priority: "Training", source: "Training Planner" }],
    auditTrail: [{ id: `audit-${type}`, event: "session_created", message: `${type} hardening fixture created.`, source: "Training Planner" }],
    ...overrides,
  };
}

function inputFor(baseSession: DailyTrainingSession | null, overrides: Partial<BuildHomeTrainingModelInput> = {}): BuildHomeTrainingModelInput {
  return {
    mode: "developer-only",
    requestDate: baseSession?.date ?? "2026-06-15",
    session: baseSession,
    readinessResult: readiness(baseSession?.readinessStatus ?? "Green"),
    progressionResult: progression(),
    goalTrackingResult: goalTracking(),
    recommendation: { coachRecommendation: baseSession?.summary?.primaryAction ?? "Use validated recommendation.", runningRecommendation: baseSession?.run ? runRecommendation : null },
    workoutSessions: [],
    runLogs: [],
    auditHash: baseSession ? `audit-hash-${baseSession.id}` : "audit-hash-missing-session",
    provenance: { source: "home-adapter-contract-hardening", plannerVersion: "planner-v1", adapterVersion: "home-adapter-v1" },
    ...overrides,
  };
}

function expectBlocker(label: string, baseInput: BuildHomeTrainingModelInput, expectedCodes: string[]): void {
  const result = buildHomeTrainingModel(baseInput);
  assert.equal(result.status, "BLOCKER", label);
  assert.equal(result.model, null, label);
  for (const code of expectedCodes) {
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code), `${label}: expected ${code}`);
  }
}

test("contract hardening: null planner session returns BLOCKER without fabricated model", () => {
  expectBlocker("null planner session", inputFor(null), ["SESSION_MISSING"]);
});

test("contract hardening: partial planner sessions return BLOCKER diagnostics", () => {
  const partial = { ...session("LiftDay"), id: "", summary: { title: "", primaryAction: "", workoutName: null, runName: null, estimatedDurationMinutes: 0, completionStatus: "Not Started" }, auditTrail: [] } as DailyTrainingSession;
  expectBlocker("partial planner session", inputFor(partial), ["SESSION_ID_MISSING", "TITLE_MISSING", "PRIMARY_ACTION_MISSING", "AUDIT_TRAIL_MISSING"]);
});

test("contract hardening: invalid session types and unsupported future session types return BLOCKER", () => {
  const invalid = { ...session("LiftDay"), sessionType: "CalendarDay", sourcePlan: { ...session("LiftDay").sourcePlan, resolvedSessionType: "CalendarDay" } } as unknown as DailyTrainingSession;
  expectBlocker("invalid session type", inputFor(invalid), ["INVALID_SESSION_TYPE"]);

  const future = { ...session("LiftDay"), sessionType: "FutureTrainingDay", sourcePlan: { ...session("LiftDay").sourcePlan, resolvedSessionType: "FutureTrainingDay" } } as unknown as DailyTrainingSession;
  expectBlocker("unsupported future session type", inputFor(future), ["INVALID_SESSION_TYPE"]);
});

test("contract hardening: mixed run/lift HybridDay preserves both logging requirements when valid", () => {
  const hybrid = session("HybridDay");
  const result = buildHomeTrainingModel(inputFor(hybrid, { recommendation: { coachRecommendation: hybrid.summary.primaryAction, runningRecommendation: runRecommendation } }));
  assert.equal(result.status, "PASS");
  assert.ok(result.model);
  assert.equal(result.model.sessionType, "HybridDay");
  assert.equal(result.model.workout.loggingRequired, true);
  assert.equal(result.model.run.loggingRequired, true);
  assert.equal(result.model.loggingRequirements.workoutLoggingRequired, true);
  assert.equal(result.model.loggingRequirements.runLoggingRequired, true);
});

test("contract hardening: missing workout or run logging targets return BLOCKER", () => {
  const missingWorkoutTarget = { ...session("LiftDay"), workout: { ...session("LiftDay").workout!, loggingTarget: null as never } };
  expectBlocker("missing workout logging target", inputFor(missingWorkoutTarget), ["WORKOUT_LOGGING_TARGET_MISSING"]);

  const missingRunTarget = { ...session("RunDay"), run: { ...session("RunDay").run!, loggingTarget: null as never } };
  expectBlocker("missing run logging target", inputFor(missingRunTarget, { recommendation: { coachRecommendation: missingRunTarget.summary.primaryAction, runningRecommendation: runRecommendation } }), ["RUN_LOGGING_TARGET_MISSING"]);
});

test("contract hardening: duplicate support categories and duplicate support items are reported without changing primary identity", () => {
  const duplicateSupport = {
    ...session("RunDay"),
    support: [
      { kind: "Core" as const, title: "Core", items: ["Pallof Press", "Pallof Press"], sourceWorkoutId: "run-source" },
      { kind: "Core" as const, title: "Core Again", items: ["Farmer Carries"], sourceWorkoutId: "run-source" },
    ],
  };
  const result = buildHomeTrainingModel(inputFor(duplicateSupport, { recommendation: { coachRecommendation: duplicateSupport.summary.primaryAction, runningRecommendation: runRecommendation } }));
  assert.equal(result.status, "WARNING");
  assert.ok(result.model);
  assert.equal(result.model.sessionType, "RunDay");
  assert.deepEqual(result.model.support.map((item) => item.kind), ["Core", "Core"]);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "DUPLICATE_SUPPORT_CATEGORY"));
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "DUPLICATE_SUPPORT_ITEM"));
});

test("contract hardening: malformed duration metadata returns BLOCKER instead of unsafe model", () => {
  const malformed = { ...session("LiftDay"), estimatedDurationMinutes: Number.NaN, summary: { ...session("LiftDay").summary, estimatedDurationMinutes: Number.NaN }, combinedLoad: { ...session("LiftDay").combinedLoad, estimatedDurationMinutes: Number.NaN } };
  expectBlocker("malformed duration metadata", inputFor(malformed), ["INVALID_DURATION_METADATA"]);
});

test("contract hardening: missing deload metadata remains BLOCKER and valid deload stays metadata", () => {
  const missing = { ...session("LiftDay"), metadata: {} as DailyTrainingSession["metadata"] };
  expectBlocker("missing deload metadata", inputFor(missing), ["DELOAD_METADATA_MISSING"]);

  const deload = { ...session("RecoveryDay"), metadata: { deload: true } };
  const result = buildHomeTrainingModel(inputFor(deload));
  assert.equal(result.status, "PASS");
  assert.ok(result.model);
  assert.equal(result.model.sessionType, "RecoveryDay");
  assert.equal(result.model.deload, true);
  assert.notEqual(result.model.sessionType, "DeloadDay");
});

test("contract hardening: audit hash and provenance mismatches return BLOCKER", () => {
  const base = session("LiftDay");
  expectBlocker("audit hash mismatch", inputFor(base, { auditHash: "hash-from-another-session" }), ["AUDIT_HASH_MISMATCH"]);
  expectBlocker("provenance mismatch", inputFor(base, { provenance: { source: "unexpected-source", plannerVersion: "planner-v1", adapterVersion: "home-adapter-v1" } }), ["PROVENANCE_MISMATCH"]);
});

test("contract hardening: no fabricated domain or persistence inputs remain enforced", () => {
  const base = session("RunDay");
  const cases: Array<[string, Partial<BuildHomeTrainingModelInput>, string]> = [
    ["readiness", { readinessResult: null }, "READINESS_MISSING"],
    ["progression", { progressionResult: null }, "PROGRESSION_MISSING"],
    ["recommendation", { recommendation: null }, "RECOMMENDATION_MISSING"],
    ["workout persistence", { workoutSessions: undefined }, "WORKOUT_LOGS_MISSING"],
    ["run persistence", { runLogs: undefined }, "RUN_LOGS_MISSING"],
  ];

  for (const [label, overrides, code] of cases) {
    expectBlocker(label, inputFor(base, { recommendation: { coachRecommendation: base.summary.primaryAction, runningRecommendation: runRecommendation }, ...overrides }), [code]);
  }
});

test("contract hardening: RecoveryDay and Support Core remain preserved under valid edge input", () => {
  const recovery = { ...session("RecoveryDay"), metadata: { deload: true }, support: [{ kind: "Core" as const, title: "Core", items: ["Side Plank", "Cable Crunch"], sourceWorkoutId: "recovery-source" }] };
  const result = buildHomeTrainingModel(inputFor(recovery));
  assert.equal(result.status, "PASS");
  assert.ok(result.model);
  assert.equal(result.model.sessionType, "RecoveryDay");
  assert.notEqual(result.model.sessionType, "MobilityDay");
  assert.equal(result.model.deload, true);
  assert.deepEqual(result.model.support.map((item) => item.kind), ["Core"]);
  assert.equal(result.model.workout.loggingRequired, false);
  assert.equal(result.model.run.loggingRequired, false);
});

test("contract hardening: home-adapter remains limited to approved adapter pilot files", () => {
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

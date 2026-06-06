import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { buildHomeTrainingModel, type BuildHomeTrainingModelInput, type HomeAdapterStatus } from "./home-adapter";
import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { PrimarySessionType } from "./primary-session-resolver";
import type { ProgressionEngineResult } from "./progression-engine";
import type { ReadinessEngineResult } from "./readiness-engine";
import type { DailyTrainingSession, DailyTrainingSupportItem } from "./training-planner";
import type { Exercise, RunningRecommendation } from "./types";

function readiness(status: ReadinessEngineResult["status"] = "Green"): ReadinessEngineResult {
  return { score: 90, status, confidence: "High", reasons: [], reason: "Regression audit fixture.", recommendation: "Proceed with validated inputs.", recommendationType: "full_training", trainingGuidance: "Proceed with validated inputs.", recoveryGuidance: [], dataQualityWarnings: [] };
}

function progression(): ProgressionEngineResult {
  return { weeklyDecision: "Progress", nutritionDecision: "Maintain Calories", goalStatus: { "Fat Loss": "On Track", Physique: "On Track", Strength: "On Track", "Half Marathon": "On Track" }, confidence: "High", dataQuality: { score: 95, confidence: "High", missingInputs: [], penalties: [], warnings: [] }, reasons: ["Regression audit fixture."], warnings: [], auditEntries: [{ id: "progression-audit-regression", decisionType: "weekly", decision: "Progress", engine: "Progression Engine", whatHappened: "Progression evaluated.", why: "Regression audit fixture.", priority: "Optimization", dataUsed: ["fixture"], confidence: "High", dataQualityScore: 95 }] };
}

function goalTracking(): GoalTrackingEngineResult {
  return {
    overallStatus: "On Track", overallScore: 90, confidence: "High", dataQualityScore: 95,
    goals: {
      fatLoss: { domain: "fat_loss", status: "On Track", score: 90, confidence: "High", currentValue: "210", targetValue: "199.9", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue.", explanation: "On track." },
      physique: { domain: "physique", status: "On Track", score: 90, confidence: "High", currentValue: "improving", targetValue: "Greek God", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue.", explanation: "On track." },
      strength: { domain: "strength", status: "On Track", score: 90, confidence: "High", currentValue: "improving", targetValue: "progress", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue.", explanation: "On track." },
      halfMarathon: { domain: "half_marathon", status: "On Track", score: 90, confidence: "High", currentValue: "building", targetValue: "13.1", trend: "improving", blockers: [], supportingSignals: [], recommendation: "Continue.", explanation: "On track." },
    },
    priorityGoal: "half_marathon", summary: "Goals are on track.", recommendations: ["Continue."], warnings: [], explanations: [], auditTrail: [],
  };
}

const runRecommendation: RunningRecommendation = { action: "Progress", recommendedDistance: 3, message: "Use validated run prescription.", reasons: ["Regression audit fixture."], warnings: [] };

function exercise(id: string, workoutId: string, name: string, category = "strength", order = 1): Exercise {
  return { id, workoutId, name, prescribedSets: 3, prescribedReps: "3 x 8", category, order };
}

function support(sourceWorkoutId: string, variants: DailyTrainingSupportItem[] = []): DailyTrainingSupportItem[] {
  return variants.length ? variants : [{ kind: "Core", title: "Core", items: ["Pallof Press", "Farmer Carries"], sourceWorkoutId }];
}

function session(type: PrimarySessionType = "LiftDay", overrides: Partial<DailyTrainingSession> = {}): DailyTrainingSession {
  const date = overrides.date ?? "2026-06-15";
  const sourceWorkoutId = overrides.sourcePlan?.sourceWorkoutId ?? `${type.toLowerCase()}-regression-source`;
  const title = overrides.summary?.title ?? type.replace("Day", " Day");
  const workout = type === "LiftDay" || type === "HybridDay" || type === "TestDay" ? { sourceWorkoutId, title, type: "strength", exercises: [exercise("ex-regression-1", sourceWorkoutId, "Bench Press"), exercise("ex-regression-2", sourceWorkoutId, "Pallof Press", "core", 2)], estimatedMinutes: 45, readinessAdjusted: false, executionRequired: true, loggingTarget: { workoutId: sourceWorkoutId, workoutTitle: title, date } } : null;
  const run = type === "RunDay" || type === "LongRunDay" || type === "HybridDay" || type === "RaceDay" ? { sourceWorkoutId, title, type: type === "LongRunDay" ? "long" as const : "easy" as const, prescriptionMode: "distance" as const, distanceMiles: type === "LongRunDay" ? 8 : 3, durationMinutes: null, required: true, estimatedMinutes: type === "LongRunDay" ? 90 : 35, executionRequired: true, loggingTarget: { date, plannedDistance: type === "LongRunDay" ? 8 : 3, plannedDurationMinutes: null, runType: type === "LongRunDay" ? "long run" as const : "easy" as const } } : null;
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
    blocks: [], workout, run, mobility, recovery,
    support: support(sourceWorkoutId),
    warmup: null, cooldown: null,
    estimatedDurationMinutes,
    combinedLoad: { estimatedDurationMinutes, modalityCount: [workout, run, mobility, recovery].filter(Boolean).length, hasLift: Boolean(workout), hasRun: Boolean(run), hasConditioning: false, hasPlyometricsOrSprints: false, lowerBodyStress: "Low", sessionStress: type === "RecoveryDay" ? "Recovery" : "Moderate", overloadFlags: [] },
    modifications: [], warnings: [],
    todayGoals: [{ label: `Complete ${title}`, priority: "Training", source: "Training Planner" }],
    auditTrail: [{ id: `audit-${type}`, event: "session_created", message: `${type} regression fixture created.`, source: "Training Planner" }],
    ...overrides,
  };
}

function inputFor(baseSession: DailyTrainingSession | null, overrides: Partial<BuildHomeTrainingModelInput> = {}): BuildHomeTrainingModelInput {
  return { mode: "developer-only", requestDate: baseSession?.date ?? "2026-06-15", session: baseSession, readinessResult: readiness(baseSession?.readinessStatus ?? "Green"), progressionResult: progression(), goalTrackingResult: goalTracking(), recommendation: { coachRecommendation: baseSession?.summary?.primaryAction ?? "Use validated recommendation.", runningRecommendation: baseSession?.run ? runRecommendation : null }, workoutSessions: [], runLogs: [], auditHash: baseSession ? `audit-hash-${baseSession.id}` : "audit-hash-missing-session", provenance: { source: "home-adapter-contract-hardening", plannerVersion: "planner-v1", adapterVersion: "home-adapter-v1" }, ...overrides };
}

function assertValidAuditCase(label: string, baseSession: DailyTrainingSession): void {
  const result = buildHomeTrainingModel(inputFor(baseSession));
  assert.equal(result.status, "PASS", label);
  assert.ok(result.model, label);
  assert.equal(result.model.sessionId, baseSession.id, label);
  assert.equal(result.model.primaryObjective, baseSession.summary.primaryAction, label);
  assert.equal(result.model.sessionType, baseSession.sessionType, label);
  assert.equal(result.model.title, baseSession.summary.title, label);
  assert.equal(result.model.deload, baseSession.metadata.deload, label);
  assert.notEqual(result.model.sessionType, "DeloadDay", label);
  assert.equal(result.model.estimatedDurationMinutes, baseSession.estimatedDurationMinutes, label);
  assert.equal(result.model.durationMetadata.summaryEstimatedDurationMinutes, baseSession.summary.estimatedDurationMinutes, label);
  assert.equal(result.model.durationMetadata.combinedLoadEstimatedDurationMinutes, baseSession.combinedLoad.estimatedDurationMinutes, label);
  assert.equal(result.model.loggingRequirements.workoutLoggingRequired, Boolean(baseSession.workout?.executionRequired), label);
  assert.equal(result.model.loggingRequirements.runLoggingRequired, Boolean(baseSession.run?.executionRequired), label);
  assert.deepEqual(result.model.workout.loggingTarget, baseSession.workout?.loggingTarget ?? null, label);
  assert.deepEqual(result.model.run.loggingTarget, baseSession.run?.loggingTarget ?? null, label);
  assert.equal(result.model.audit.auditHash, `audit-hash-${baseSession.id}`, label);
  assert.equal(result.model.audit.provenance.source, "home-adapter-contract-hardening", label);
  assert.deepEqual(result.model.audit.plannerAuditTrailIds, baseSession.auditTrail.map((entry) => entry.id), label);
  if (baseSession.sessionType === "RecoveryDay") assert.notEqual(result.model.sessionType, "MobilityDay", label);
  if (baseSession.support.some((item) => item.kind === "Core")) assert.ok(result.model.support.some((item) => item.kind === "Core"), label);
}

function statusFor(input: BuildHomeTrainingModelInput): { status: HomeAdapterStatus; codes: string[] } {
  const result = buildHomeTrainingModel(input);
  return { status: result.status, codes: result.diagnostics.map((item) => item.code) };
}

function auditedSessions(): Array<[string, DailyTrainingSession]> {
  const durationRun = session("RunDay", { id: "session-duration-range-runday", run: { ...session("RunDay").run!, prescriptionMode: "duration", distanceMiles: null, durationMinutes: 40, estimatedMinutes: 40, loggingTarget: { date: "2026-06-15", plannedDistance: null, plannedDurationMinutes: 40, runType: "easy" } }, estimatedDurationMinutes: 40, summary: { ...session("RunDay").summary, estimatedDurationMinutes: 40 }, combinedLoad: { ...session("RunDay").combinedLoad, estimatedDurationMinutes: 40 } });
  const supportHeavy = session("LiftDay", { id: "session-support-heavy-liftday", support: support("support-heavy-source", [{ kind: "Core", title: "Core + Carries", items: ["Pallof Press", "Side Plank", "Ab Wheel", "Farmer Carries", "Loaded Carries", "Cable Crunch"], sourceWorkoutId: "support-heavy-source" }]) });
  return [
    ["planner-generated session", session("LiftDay", { id: "session-planner-generated", sourcePlan: { ...session("LiftDay").sourcePlan, source: "manual-override" } })],
    ["seed-plan session", session("LiftDay")],
    ["RecoveryDay session", session("RecoveryDay")],
    ["MobilityDay session", session("MobilityDay")],
    ["LiftDay session", session("LiftDay", { id: "session-liftday-regression" })],
    ["RunDay session", session("RunDay")],
    ["LongRunDay session", session("LongRunDay")],
    ["HybridDay session", session("HybridDay")],
    ["Deload LiftDay", session("LiftDay", { id: "session-deload-liftday", metadata: { deload: true }, sourcePlan: { ...session("LiftDay").sourcePlan, sourceWorkoutDeload: true } })],
    ["Deload RunDay", session("RunDay", { id: "session-deload-runday", metadata: { deload: true }, sourcePlan: { ...session("RunDay").sourcePlan, sourceWorkoutDeload: true } })],
    ["Deload RecoveryDay", session("RecoveryDay", { id: "session-deload-recoveryday", metadata: { deload: true }, sourcePlan: { ...session("RecoveryDay").sourcePlan, sourceWorkoutDeload: true } })],
    ["support-heavy session", supportHeavy],
    ["duration-range session", durationRun],
    ["audit/provenance-enabled session", session("LiftDay", { id: "session-audit-provenance-enabled", auditTrail: [{ id: "audit-a", event: "session_created", message: "Created.", source: "Training Planner" }, { id: "audit-b", event: "validated", message: "Validated.", source: "Training Planner" }] })],
  ];
}

test("hardened adapter regression audit: representative sessions preserve required invariants", () => {
  const cases = auditedSessions();
  assert.equal(cases.length, 14);
  for (const [label, baseSession] of cases) assertValidAuditCase(label, baseSession);
});

test("hardened adapter regression audit: contract blockers and warnings remain active", () => {
  const validLift = session("LiftDay");
  const invalidSession = { ...validLift, sessionType: "FutureTrainingDay", sourcePlan: { ...validLift.sourcePlan, resolvedSessionType: "FutureTrainingDay" } } as unknown as DailyTrainingSession;
  const missingWorkoutTarget = { ...validLift, workout: { ...validLift.workout!, loggingTarget: null as never } };
  const run = session("RunDay");
  const missingRunTarget = { ...run, run: { ...run.run!, loggingTarget: null as never } };
  const invalidDuration = { ...validLift, estimatedDurationMinutes: Number.NaN, summary: { ...validLift.summary, estimatedDurationMinutes: Number.NaN }, combinedLoad: { ...validLift.combinedLoad, estimatedDurationMinutes: Number.NaN } };
  const duplicateSupport = { ...run, support: [{ kind: "Core" as const, title: "Core", items: ["Pallof Press", "Pallof Press"], sourceWorkoutId: "run" }, { kind: "Core" as const, title: "Core Again", items: ["Farmer Carries"], sourceWorkoutId: "run" }] };

  const checks: Array<[string, BuildHomeTrainingModelInput, HomeAdapterStatus, string[]]> = [
    ["invalid session type", inputFor(invalidSession), "BLOCKER", ["INVALID_SESSION_TYPE"]],
    ["missing workout logging target", inputFor(missingWorkoutTarget), "BLOCKER", ["WORKOUT_LOGGING_TARGET_MISSING"]],
    ["missing run logging target", inputFor(missingRunTarget), "BLOCKER", ["RUN_LOGGING_TARGET_MISSING"]],
    ["invalid duration metadata", inputFor(invalidDuration), "BLOCKER", ["INVALID_DURATION_METADATA"]],
    ["audit hash mismatch", inputFor(validLift, { auditHash: "wrong-hash" }), "BLOCKER", ["AUDIT_HASH_MISMATCH"]],
    ["provenance mismatch", inputFor(validLift, { provenance: { source: "unexpected-source" } }), "BLOCKER", ["PROVENANCE_MISMATCH"]],
    ["duplicate support diagnostics", inputFor(duplicateSupport), "WARNING", ["DUPLICATE_SUPPORT_CATEGORY", "DUPLICATE_SUPPORT_ITEM"]],
  ];

  for (const [label, input, expectedStatus, expectedCodes] of checks) {
    const actual = statusFor(input);
    assert.equal(actual.status, expectedStatus, label);
    for (const code of expectedCodes) assert.ok(actual.codes.includes(code), `${label}: expected ${code}`);
  }
});

test("hardened adapter regression audit: adapter remains limited to approved adapter pilot files", () => {
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

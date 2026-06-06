import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  auditPlannerPromotion,
  type PromotionAuditDaySnapshot,
  type PromotionAuditMismatch,
} from "./planner-promotion-audit";
import { workouts } from "./seed-data";

const matchPlanner: PromotionAuditDaySnapshot = {
  dayType: "LiftDay",
  workoutTitle: "Upper Strength",
  runTitle: null,
  runType: null,
  runDistance: null,
  runDuration: null,
  sessionClassification: "LiftDay",
  primarySession: "LiftDay",
  blocks: ["warmup", "lift", "cooldown"],
  hasLift: true,
  hasRun: false,
  hasMobility: false,
  hasCooldown: true,
};

const matchLegacy: PromotionAuditDaySnapshot = { ...matchPlanner };

test("Audit generation: planner vs legacy comparison produces report for seed workouts", () => {
  const result = auditPlannerPromotion({ workouts });
  assert.equal(result.totalDaysAudited, workouts.length);
  assert.ok(result.totalDaysAudited > 0);
  assert.equal(result.mismatches.length, result.plannerMismatchesLegacy);
  assert.ok(result.mismatchRate >= 0);
  assert.ok(["NOT_READY", "SHADOW_MODE_READY", "TRAIN_READY", "HOME_READY", "FULL_PROMOTION_READY"].includes(result.promotionRecommendation));
});

test("Match detection: identical outputs produce no mismatch", () => {
  const result = auditPlannerPromotion({
    auditDays: [{ id: "day-1", week: 1, dayIndex: 0, title: "Upper Strength", plannerOutput: matchPlanner, legacyOutput: matchLegacy }],
  });
  assert.equal(result.totalDaysAudited, 1);
  assert.equal(result.plannerMatchesLegacy, 1);
  assert.equal(result.plannerMismatchesLegacy, 0);
  assert.deepEqual(result.mismatches, []);
  assert.equal(result.promotionRecommendation, "TRAIN_READY");
});

test("Improvement detection: Zone 2 + Mobility + Core legacy LiftDay vs planner RunDay is EXPECTED_IMPROVEMENT", () => {
  const planner: PromotionAuditDaySnapshot = {
    dayType: "RunDay",
    workoutTitle: null,
    runTitle: "Zone 2 + Mobility + Core",
    runType: "easy",
    runDistance: null,
    runDuration: 40,
    sessionClassification: "RunDay",
    primarySession: "RunDay",
    blocks: ["warmup", "run", "mobility", "cooldown"],
    hasLift: false,
    hasRun: true,
    hasMobility: true,
    hasCooldown: true,
  };
  const legacy: PromotionAuditDaySnapshot = {
    ...planner,
    dayType: "LiftDay",
    workoutTitle: "Zone 2 + Mobility + Core",
    sessionClassification: "lift + run + mobility",
    primarySession: "LiftDay",
    blocks: ["warmup", "lift", "run", "mobility", "cooldown"],
    hasLift: true,
  };
  const result = auditPlannerPromotion({ auditDays: [{ id: "zone-2", week: 1, dayIndex: 2, title: "Zone 2 + Mobility + Core", plannerOutput: planner, legacyOutput: legacy }] });
  assert.equal(result.expectedImprovements, result.mismatches.length);
  assert.ok(result.expectedImprovements > 0);
  assert.ok(result.mismatches.every((mismatch: PromotionAuditMismatch) => mismatch.severity === "EXPECTED_IMPROVEMENT"));
});

test("Critical mismatch detection: planner removes a scheduled run", () => {
  const planner: PromotionAuditDaySnapshot = {
    dayType: "RestDay",
    workoutTitle: null,
    runTitle: null,
    runType: null,
    runDistance: null,
    runDuration: null,
    sessionClassification: "Rest",
    primarySession: "UnavailableDay",
    blocks: [],
    hasLift: false,
    hasRun: false,
    hasMobility: false,
    hasCooldown: false,
  };
  const legacy: PromotionAuditDaySnapshot = {
    dayType: "RunDay",
    workoutTitle: null,
    runTitle: "Long Run — 4 mi",
    runType: "long",
    runDistance: 4,
    runDuration: null,
    sessionClassification: "RunDay",
    primarySession: "LongRunDay",
    blocks: ["warmup", "run", "cooldown"],
    hasLift: false,
    hasRun: true,
    hasMobility: false,
    hasCooldown: true,
  };
  const result = auditPlannerPromotion({ auditDays: [{ id: "missing-run", week: 1, dayIndex: 5, title: "Long Run", plannerOutput: planner, legacyOutput: legacy }] });
  assert.equal(result.criticalMismatches, result.mismatches.length);
  assert.ok(result.mismatches.some((mismatch) => mismatch.type === "RUN" && mismatch.severity === "CRITICAL"));
});

test("Recommendation engine returns NOT_READY for critical mismatches and SHADOW_MODE_READY for expected improvements only", () => {
  const critical: PromotionAuditMismatch = {
    id: "critical",
    workoutId: "w1",
    week: 1,
    dayIndex: 5,
    workoutTitle: "Long Run",
    type: "RUN",
    severity: "CRITICAL",
    field: "run presence",
    plannerValue: false,
    legacyValue: true,
    explanation: "Planner removed a scheduled run.",
  };
  const improvement: PromotionAuditMismatch = {
    id: "improvement",
    workoutId: "w2",
    week: 1,
    dayIndex: 2,
    workoutTitle: "Zone 2 + Mobility + Core",
    type: "DAY_TYPE",
    severity: "EXPECTED_IMPROVEMENT",
    field: "day type",
    plannerValue: "RunDay",
    legacyValue: "LiftDay",
    explanation: "Planner fixed support-work classification.",
  };
  assert.equal(auditPlannerPromotion({ auditDays: [{ id: "placeholder", week: 1, dayIndex: 0, title: "Placeholder", plannerOutput: matchPlanner, legacyOutput: matchLegacy }], injectedMismatches: [critical] }).promotionRecommendation, "NOT_READY");
  assert.equal(auditPlannerPromotion({ auditDays: [{ id: "placeholder", week: 1, dayIndex: 0, title: "Placeholder", plannerOutput: matchPlanner, legacyOutput: matchLegacy }], injectedMismatches: [improvement] }).promotionRecommendation, "SHADOW_MODE_READY");
});

test("Finalized rules audit: seed plan has no critical mismatches or rule-review items", () => {
  const result = auditPlannerPromotion({ workouts });
  assert.equal(result.criticalMismatches, 0);
  assert.equal(result.needsReview, 0);
  assert.ok(result.expectedImprovements <= 5);
  assert.equal(result.promotionRecommendation, "TRAIN_READY");
});

test("Finalized rules audit: Heavy Upper + Sprints + Core expects conditioning block without run block", () => {
  const result = auditPlannerPromotion({ workouts });
  const day = result.days.find((candidate) => candidate.week === 5 && candidate.title === "Heavy Upper + Sprints + Core");
  assert.ok(day);
  assert.equal(day.plannerOutput.primarySession, "LiftDay");
  assert.equal(day.plannerOutput.hasRun, false);
  assert.deepEqual(day.plannerOutput.blocks, ["warmup", "lift", "conditioning", "cooldown"]);
  assert.deepEqual(day.legacyOutput.blocks, ["warmup", "lift", "conditioning", "cooldown"]);
});

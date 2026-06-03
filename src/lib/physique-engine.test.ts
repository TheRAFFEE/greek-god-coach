import { test } from "node:test";
import * as assert from "node:assert/strict";
import { evaluatePhysique, type PhysiqueEngineInput } from "./physique-engine";

const baseInput: PhysiqueEngineInput = {
  weight: 210,
  waist: 36,
  neck: 16,
  height: 70,
  priorWeight: 214,
  priorWaist: 38,
  priorNeck: 16,
  proteinAdherence: 88,
  calorieAdherence: 82,
  workoutAdherence: 86,
  strengthTrend: "Improving",
  photoCount: 6,
  photoConsistency: 85,
};

function result(overrides: Partial<PhysiqueEngineInput> = {}) {
  return evaluatePhysique({ ...baseInput, ...overrides });
}

test("Body fat estimate calculation", () => {
  assert.equal(Math.round(result().bodyFatPercent ?? 0), 19);
});

test("Lean mass calculation", () => {
  const evaluated = result();
  assert.equal(Math.round(evaluated.leanMass ?? 0), 169);
});

test("Improving physique", () => {
  assert.equal(result().physiqueStatus, "Improving");
});

test("Stable physique", () => {
  assert.equal(result({ weight: 210, waist: 36, neck: 16, priorWeight: 210, priorWaist: 36, priorNeck: 16, proteinAdherence: 72, workoutAdherence: 72, strengthTrend: "Stable" }).physiqueStatus, "Stable");
});

test("Plateau physique", () => {
  assert.equal(result({ weight: 210, waist: 36, neck: 16, priorWeight: 210.1, priorWaist: 36.1, priorNeck: 16, proteinAdherence: 91, workoutAdherence: 90, strengthTrend: "Stable" }).physiqueStatus, "Plateau");
});

test("Declining physique", () => {
  assert.equal(result({ weight: 214, waist: 38.5, neck: 15.8, priorWeight: 210, priorWaist: 36, priorNeck: 16, proteinAdherence: 55, workoutAdherence: 45, strengthTrend: "Declining" }).physiqueStatus, "Declining");
});

test("Insufficient data", () => {
  assert.equal(result({ waist: undefined }).physiqueStatus, "Insufficient Data");
});

test("High confidence", () => {
  assert.equal(result().confidence, "High");
});

test("Medium confidence", () => {
  assert.equal(result({ priorNeck: undefined, photoConsistency: 40 }).confidence, "Medium");
});

test("Low confidence", () => {
  assert.equal(result({ priorWeight: undefined, priorWaist: undefined, priorNeck: undefined, photoCount: 0, photoConsistency: 0, proteinAdherence: undefined, workoutAdherence: undefined }).confidence, "Low");
});

test("Strong protein adherence", () => {
  const evaluated = result({ proteinAdherence: 95 });
  assert.match(evaluated.auditTrail.map((entry) => entry.reason).join(" "), /protein adherence/i);
  assert.ok(evaluated.physiqueScore >= 75);
});

test("Poor protein adherence", () => {
  const evaluated = result({ proteinAdherence: 45 });
  assert.equal(evaluated.primaryOpportunity, "Protein adherence");
  assert.ok(evaluated.warnings.some((warning) => /protein/i.test(warning)));
});

test("Waist reduction", () => {
  assert.equal(result().waistTrend, "Down");
});

test("Waist increase", () => {
  assert.equal(result({ waist: 38.5, priorWaist: 36 }).waistTrend, "Up");
});

test("Strength improving", () => {
  const evaluated = result({ strengthTrend: "Improving" });
  assert.ok(evaluated.auditTrail.some((entry) => entry.reason.includes("Strength trend Improving")));
});

test("Strength declining", () => {
  const evaluated = result({ strengthTrend: "Declining" });
  assert.equal(evaluated.primaryRisk, "Strength regression");
});

test("Audit trail generation", () => {
  const evaluated = result();
  assert.deepEqual(evaluated.auditTrail.map((entry) => entry.decision), ["body_fat_estimate", "trend_analysis", "score", "status", "confidence"]);
});

test("Overall score generation", () => {
  const evaluated = result();
  assert.equal(typeof evaluated.physiqueScore, "number");
  assert.ok(evaluated.physiqueScore >= 0 && evaluated.physiqueScore <= 100);
});

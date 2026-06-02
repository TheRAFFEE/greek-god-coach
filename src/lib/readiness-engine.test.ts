import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { DailyCheckIn } from "./types";
import { evaluateReadiness, readinessInputFromDailyCheckIn, readinessInputFromWeeklyWindow } from "./readiness-engine";

const baseCheckIn = (overrides: Partial<DailyCheckIn> = {}): DailyCheckIn => ({
  id: "check-1",
  userId: "user-1",
  date: "2026-06-01",
  weight: 232,
  sleepHours: 8,
  sleepQuality: 4,
  soreness: 2,
  energy: 8,
  stress: 3,
  hunger: 4,
  motivation: 8,
  alcohol: false,
  steps: 9000,
  restingHr: 58,
  hrv: 60,
  pain: false,
  painLocation: "",
  painSeverity: 0,
  workoutCompleted: false,
  runCompleted: false,
  macrosHit: true,
  notes: "",
  ...overrides,
});

test("evaluates Green readiness with strong subjective markers", () => {
  const result = evaluateReadiness({
    mode: "daily",
    sleep: 8,
    soreness: 2,
    stress: 3,
    energy: 8,
    alcohol: false,
    pain: false,
    painSeverity: 0,
    restingHr: 58,
    hrv: 60,
    baseline: { restingHr: 58, hrv: 60 },
  });

  assert.equal(result.status, "Green");
  assert.equal(result.score, 100);
  assert.equal(result.confidence, "High");
  assert.match(result.recommendation, /Complete the planned workout/i);
});

test("evaluates Yellow readiness for sleep 6, soreness 6, and stress 6", () => {
  const result = evaluateReadiness({
    mode: "daily",
    sleep: 6,
    soreness: 6,
    stress: 6,
    energy: 8,
    alcohol: false,
    pain: false,
    painSeverity: 0,
    restingHr: 58,
    hrv: 60,
    baseline: { restingHr: 58, hrv: 60 },
  });

  assert.equal(result.status, "Yellow");
  assert.equal(result.score, 70);
  assert.ok(result.reasons.some((reason) => reason.factor === "sleep" && reason.points === 10));
  assert.ok(result.reasons.some((reason) => reason.factor === "soreness" && reason.points === 10));
  assert.ok(result.reasons.some((reason) => reason.factor === "stress" && reason.points === 10));
});

test("evaluates Red readiness for pain severity 7", () => {
  const result = evaluateReadiness({
    mode: "daily",
    sleep: 8,
    soreness: 2,
    stress: 3,
    energy: 8,
    alcohol: false,
    pain: true,
    painSeverity: 7,
    restingHr: 58,
    hrv: 60,
    baseline: { restingHr: 58, hrv: 60 },
  });

  assert.equal(result.status, "Red");
  assert.ok(result.score <= 59);
  assert.equal(result.recommendationType, "recovery_focus");
  assert.match(result.recommendation, /No heavy lifting/i);
});

test("missing HRV downgrades confidence but still calculates readiness", () => {
  const result = evaluateReadiness({
    mode: "daily",
    sleep: 8,
    soreness: 2,
    stress: 3,
    energy: 8,
    alcohol: false,
    pain: false,
    painSeverity: 0,
    restingHr: 58,
    hrv: null,
    baseline: { restingHr: 58, hrv: 60 },
  });

  assert.equal(result.status, "Green");
  assert.equal(result.confidence, "Medium");
  assert.match(result.dataQualityWarnings.join(" "), /HRV/i);
});

test("missing resting HR downgrades confidence but still calculates readiness", () => {
  const result = evaluateReadiness({
    mode: "daily",
    sleep: 8,
    soreness: 2,
    stress: 3,
    energy: 8,
    alcohol: false,
    pain: false,
    painSeverity: 0,
    restingHr: null,
    hrv: 60,
    baseline: { restingHr: 58, hrv: 60 },
  });

  assert.equal(result.status, "Green");
  assert.equal(result.confidence, "Medium");
  assert.match(result.dataQualityWarnings.join(" "), /resting HR/i);
});

test("stress 5 has no deduction for high-stress CRNA schedule calibration", () => {
  const result = evaluateReadiness({
    mode: "daily",
    sleep: 8,
    soreness: 2,
    stress: 5,
    energy: 8,
    alcohol: false,
    pain: false,
    painSeverity: 0,
    restingHr: 58,
    hrv: 60,
    baseline: { restingHr: 58, hrv: 60 },
  });

  assert.equal(result.status, "Green");
  assert.equal(result.score, 100);
  assert.equal(result.reasons.some((reason) => reason.factor === "stress"), false);
});

test("daily check-in adapter maps fields into canonical readiness input", () => {
  const input = readinessInputFromDailyCheckIn(baseCheckIn({ sleepHours: 6, soreness: 6, stress: 6 }), { restingHr: 58, hrv: 60 });
  const result = evaluateReadiness(input);

  assert.equal(input.sleep, 6);
  assert.equal(input.soreness, 6);
  assert.equal(input.stress, 6);
  assert.equal(input.mode, "daily");
  assert.equal(result.status, "Yellow");
});

test("weekly adapter produces a valid readiness result", () => {
  const checkIns = [
    baseCheckIn({ id: "check-1", date: "2026-06-01", sleepHours: 7, soreness: 3, stress: 3, energy: 8 }),
    baseCheckIn({ id: "check-2", date: "2026-06-02", sleepHours: 7.5, soreness: 4, stress: 4, energy: 7 }),
    baseCheckIn({ id: "check-3", date: "2026-06-03", sleepHours: 6.5, soreness: 5, stress: 5, energy: 6 }),
  ];

  const input = readinessInputFromWeeklyWindow({ checkIns, baseline: { restingHr: 58, hrv: 60 } });
  const result = evaluateReadiness(input);

  assert.equal(input.mode, "weekly");
  assert.equal(input.sleep, 7);
  assert.equal(input.pain, false);
  assert.ok(["Green", "Yellow", "Red"].includes(result.status));
  assert.equal(result.confidence, "High");
});

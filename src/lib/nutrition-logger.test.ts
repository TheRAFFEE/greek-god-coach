import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { AppState } from "./types";
import { buildNutritionLogRecord, getNutritionLoggerTarget, evaluateNutritionLoggerAdherence, saveNutritionLoggerEntry } from "./nutrition-logger";

const baseInput = {
  id: "nutrition-1",
  userId: "user-1",
  date: "2026-06-01",
  dayType: "training" as const,
  calories: 2600,
  protein: 220,
  carbs: 250,
  fat: 65,
  fiber: 30,
  water: 120,
  alcohol: false,
  notes: "hit the plan",
};

test("returns the requested training and rest day nutrition targets", () => {
  assert.deepEqual(getNutritionLoggerTarget("training"), { calories: 2600, protein: 220, carbs: 250, fat: 65 });
  assert.deepEqual(getNutritionLoggerTarget("rest"), { calories: 2200, protein: 220, carbs: 150, fat: 70 });
});

test("builds a nutrition log from required logger fields", () => {
  const log = buildNutritionLogRecord(baseInput);

  assert.equal(log.date, "2026-06-01");
  assert.equal(log.calories, 2600);
  assert.equal(log.protein, 220);
  assert.equal(log.carbs, 250);
  assert.equal(log.fat, 65);
  assert.equal(log.fiber, 30);
  assert.equal(log.water, 120);
  assert.equal(log.alcohol, 0);
  assert.equal(log.notes, "hit the plan");
});

test("shows adherence percentage for calories and protein", () => {
  const log = buildNutritionLogRecord({ ...baseInput, calories: 2340, protein: 198 });
  const result = evaluateNutritionLoggerAdherence(log, "training");

  assert.equal(result.target.calories, 2600);
  assert.equal(result.calorieAdherencePercent, 90);
  assert.equal(result.proteinAdherencePercent, 90);
});

test("uses rest day targets when selected", () => {
  const log = buildNutritionLogRecord({ ...baseInput, dayType: "rest", calories: 2200, carbs: 150, fat: 70 });
  const result = evaluateNutritionLoggerAdherence(log, "rest");

  assert.equal(result.target.calories, 2200);
  assert.equal(result.target.carbs, 150);
  assert.equal(result.target.fat, 70);
  assert.equal(result.calorieAdherencePercent, 100);
  assert.equal(result.proteinAdherencePercent, 100);
});

test("saves one nutrition log per date and preserves alcohol flag as yes/no compatible number", () => {
  const state = {
    nutritionLogs: [buildNutritionLogRecord({ ...baseInput, id: "old", date: "2026-06-01", calories: 1000 })],
  } as unknown as AppState;
  const saved = saveNutritionLoggerEntry(state, { ...baseInput, id: "new", alcohol: true });

  assert.equal(saved.state.nutritionLogs.length, 1);
  assert.equal(saved.state.nutritionLogs[0].id, "new");
  assert.equal(saved.state.nutritionLogs[0].alcohol, 1);
  assert.equal(saved.adherence.calorieAdherencePercent, 100);
  assert.equal(saved.adherence.proteinAdherencePercent, 100);
});

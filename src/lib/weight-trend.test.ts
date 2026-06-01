import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { BodyMetric } from "./types";
import { buildWeightTrendDashboard } from "./weight-trend";

const metric = (date: string, weight: number): BodyMetric => ({ id: date, userId: "user-1", date, weight });

test("builds weight trend dashboard numbers from dated body metrics", () => {
  const metrics = [
    metric("2026-05-18", 233),
    metric("2026-05-19", 232),
    metric("2026-05-20", 231),
    metric("2026-05-21", 230),
    metric("2026-05-22", 229),
    metric("2026-05-23", 228),
    metric("2026-05-24", 227),
    metric("2026-05-25", 226),
    metric("2026-05-26", 225),
    metric("2026-05-27", 224),
    metric("2026-05-28", 223),
    metric("2026-05-29", 222),
    metric("2026-05-30", 221),
    metric("2026-05-31", 220),
  ];

  const dashboard = buildWeightTrendDashboard(metrics, { startingWeight: 233, goalWeight: 199.9 });

  assert.equal(dashboard.hasData, true);
  assert.equal(dashboard.latestWeight, 220);
  assert.equal(dashboard.sevenDayAverage, 223);
  assert.equal(dashboard.fourteenDayAverage, 226.5);
  assert.equal(dashboard.weeklyWeightChange, -7);
  assert.equal(dashboard.progressPoundsLost, 13);
  assert.equal(dashboard.progressPoundsRemaining, 20.1);
  assert.equal(dashboard.progressPercent, 39);
  assert.equal(dashboard.chartPoints.length, 14);
  assert.equal(dashboard.summary, "13 lb lost, 20.1 lb to under 200 lb.");
});

test("handles empty and invalid weight data gracefully", () => {
  const dashboard = buildWeightTrendDashboard([
    { id: "bad", userId: "user-1", date: "2026-05-20", weight: Number.NaN },
  ], { startingWeight: 233, goalWeight: 199.9 });

  assert.equal(dashboard.hasData, false);
  assert.equal(dashboard.latestWeight, null);
  assert.equal(dashboard.sevenDayAverage, null);
  assert.equal(dashboard.fourteenDayAverage, null);
  assert.equal(dashboard.weeklyWeightChange, null);
  assert.equal(dashboard.progressPercent, 0);
  assert.equal(dashboard.summary, "No weight entries yet. Log a check-in or body metric to start the trend.");
  assert.deepEqual(dashboard.chartPoints, []);
});

test("uses available data when fewer than 14 entries exist", () => {
  const dashboard = buildWeightTrendDashboard([
    metric("2026-05-29", 232.4),
    metric("2026-05-30", 231.6),
    metric("2026-05-31", 231),
  ], { startingWeight: 233, goalWeight: 199.9 });

  assert.equal(dashboard.latestWeight, 231);
  assert.equal(dashboard.sevenDayAverage, 231.7);
  assert.equal(dashboard.fourteenDayAverage, 231.7);
  assert.equal(dashboard.weeklyWeightChange, null);
  assert.equal(dashboard.progressPercent, 6);
});

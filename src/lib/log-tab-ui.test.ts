import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { BodyMetric, ProgressPhoto } from "./types";
import { buildBodyMetricsSummary, buildLogSections, buildPhotoSectionSummary, humanizeDataQualityReason } from "./log-tab-ui";

test("Log contains only Daily Check-In Nutrition Body Metrics and Progress Photos", () => {
  const sections = buildLogSections();

  assert.deepEqual(sections.map((section) => section.label), ["Daily Check-In", "Nutrition", "Body Metrics", "Progress Photos"]);
  assert.deepEqual(sections.map((section) => section.id), ["checkin", "nutrition", "body", "photos"]);
});

test("Log section model hides workout and run logger capabilities", () => {
  const visibleText = buildLogSections().flatMap((section) => [section.label, section.description, ...section.fields]).join(" ");

  assert.doesNotMatch(visibleText, /workout logger|run logger|log run|log workout/i);
});

test("data quality reasons use user-facing language instead of technical engine keys", () => {
  assert.equal(humanizeDataQualityReason("runningResult"), "Need at least 2 recent runs");
  assert.equal(humanizeDataQualityReason("workoutResult incomplete"), "Need more completed workouts");
  assert.equal(humanizeDataQualityReason("nutritionResult missing"), "Need more meal logs");
});

test("Body Metrics summary renders current weight and 7-day changes", () => {
  const metrics: BodyMetric[] = [
    { id: "m1", userId: "u1", date: "2026-06-01", weight: 211, waist: 39.5 },
    { id: "m2", userId: "u1", date: "2026-06-08", weight: 209.5, waist: 38.8 },
  ];

  const summary = buildBodyMetricsSummary(metrics);

  assert.equal(summary.hasData, true);
  assert.equal(summary.currentWeight, 209.5);
  assert.equal(summary.weightChange7Days, -1.5);
  assert.equal(summary.waistChange7Days, -0.7);
  assert.equal(summary.message, "Current measurements are available.");
});

test("Body Metrics summary handles missing measurements", () => {
  const summary = buildBodyMetricsSummary([]);

  assert.equal(summary.hasData, false);
  assert.equal(summary.currentWeight, null);
  assert.equal(summary.weightChange7Days, null);
  assert.equal(summary.waistChange7Days, null);
  assert.equal(summary.message, "Need more measurements");
});

test("Photo section renders Front Side Back grouping and latest upload date", () => {
  const photos: ProgressPhoto[] = [
    { id: "p1", userId: "u1", date: "2026-06-01", frontPhotoUrl: "front-old.jpg" },
    { id: "p2", userId: "u1", date: "2026-06-08", frontPhotoUrl: "front.jpg", sidePhotoUrl: "side.jpg", backPhotoUrl: "back.jpg" },
  ];

  const summary = buildPhotoSectionSummary(photos);

  assert.equal(summary.latestUploadDate, "2026-06-08");
  assert.deepEqual(summary.slots.map((slot) => slot.label), ["Front", "Side", "Back"]);
  assert.deepEqual(summary.slots.map((slot) => slot.latestUrl), ["front.jpg", "side.jpg", "back.jpg"]);
});

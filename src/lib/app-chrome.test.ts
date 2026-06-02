import { test } from "node:test";
import * as assert from "node:assert/strict";
import { buildCompactAppChrome } from "./app-chrome";

test("uses compact mobile chrome instead of the old large command-center header", () => {
  const chrome = buildCompactAppChrome({ currentWeek: 4 });

  assert.equal(chrome.title, "Greek God Coach");
  assert.equal(chrome.subtitle, "Week 4");
  assert.equal(chrome.heroHeadline, null);
  assert.equal(chrome.globalStartDayCta, false);
  assert.ok(chrome.estimatedMobileChromeHeightPx <= chrome.previousMobileChromeHeightPx * 0.4);
});

test("keeps content directly attached below navigation tabs", () => {
  const chrome = buildCompactAppChrome({ currentWeek: 1 });

  assert.equal(chrome.contentTopGapPx, 8);
  assert.ok(chrome.contentTopGapPx <= 8);
});

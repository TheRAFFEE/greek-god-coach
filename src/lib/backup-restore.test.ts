import { test } from "node:test";
import * as assert from "node:assert/strict";
import { createInitialState } from "./seed-data";
import {
  CURRENT_BACKUP_SCHEMA_VERSION,
  appStateCounts,
  buildBackupDashboardModel,
  createBackupPayload,
  parseAndValidateBackupJson,
  restoreBackupPayload,
  rotateSnapshots,
  verifyRestoreCounts,
} from "./backup-restore";
import { loadStateWithRecovery, saveState, STORAGE_KEY, SNAPSHOT_KEYS, PRE_RESTORE_BACKUP_KEY } from "./storage";

function makeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    keys: () => Array.from(store.keys()),
  };
}

function installWindowStorage(storage: ReturnType<typeof makeStorage>) {
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  });
}

test("exports canonical backup payload with schema, timestamp, app version, and full AppState", () => {
  const state = createInitialState();
  const payload = createBackupPayload(state, "2026-01-01T00:00:00.000Z");

  assert.equal(payload.schemaVersion, CURRENT_BACKUP_SCHEMA_VERSION);
  assert.equal(payload.exportedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(typeof payload.appVersion, "string");
  assert.equal(payload.appState, state);
});

test("imports valid backup and verifies restored counts", () => {
  const state = { ...createInitialState(), runLogs: createInitialState().runLogs.slice(0, 2), meals: createInitialState().meals.slice(0, 3) };
  const payload = createBackupPayload(state, "2026-01-01T00:00:00.000Z");
  const validation = parseAndValidateBackupJson(JSON.stringify(payload));

  assert.equal(validation.status, "VALID");
  assert.ok(validation.payload);
  const restore = restoreBackupPayload(validation.payload);
  assert.equal(restore.status, "restored");
  assert.deepEqual(restore.expectedCounts, appStateCounts(restore.state));
});

test("invalid JSON is rejected", () => {
  const validation = parseAndValidateBackupJson("{not json");

  assert.equal(validation.status, "INVALID");
  assert.match(validation.messages.join(" "), /valid JSON/i);
});

test("invalid schema and missing AppState sections are rejected", () => {
  const validation = parseAndValidateBackupJson(JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01", appVersion: "0.1.0", appState: { checkIns: [] } }));

  assert.equal(validation.status, "INVALID");
  assert.ok(validation.messages.some((message) => message.includes("required AppState section")));
});

test("future schema version is rejected", () => {
  const payload = createBackupPayload(createInitialState(), "2026-01-01T00:00:00.000Z");
  const validation = parseAndValidateBackupJson(JSON.stringify({ ...payload, schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION + 1 }));

  assert.equal(validation.status, "INVALID");
  assert.match(validation.messages.join(" "), /future schema/i);
});

test("older current-compatible schema returns a migration warning", () => {
  const payload = createBackupPayload(createInitialState(), "2026-01-01T00:00:00.000Z");
  const validation = parseAndValidateBackupJson(JSON.stringify({ ...payload, schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION - 1 }));

  assert.equal(validation.status, "WARNING");
  assert.match(validation.messages.join(" "), /migration/i);
});

test("restore verification detects mismatched imported and restored counts", () => {
  const state = createInitialState();
  const importedCounts = appStateCounts({ ...state, photos: [{ id: "photo-extra", userId: state.user.id, date: "2026-01-01", frontPhotoUrl: "front.jpg" }] });
  const restoredCounts = appStateCounts(state);
  const verification = verifyRestoreCounts(importedCounts, restoredCounts);

  assert.equal(verification.ok, false);
  assert.ok(verification.messages.some((message) => message.includes("photos")));
});

test("saveState creates recovery backup and rotates snapshots", () => {
  const storage = makeStorage();
  installWindowStorage(storage);
  const first = { ...createInitialState(), currentWeek: 1 };
  const second = { ...createInitialState(), currentWeek: 2 };
  const third = { ...createInitialState(), currentWeek: 3 };
  const fourth = { ...createInitialState(), currentWeek: 4 };

  saveState(first);
  saveState(second);
  saveState(third);
  saveState(fourth);

  assert.ok(storage.getItem(SNAPSHOT_KEYS.current));
  assert.ok(storage.getItem(SNAPSHOT_KEYS.previous));
  assert.ok(storage.getItem(SNAPSHOT_KEYS.previousPrevious));
  assert.equal(JSON.parse(storage.getItem(SNAPSHOT_KEYS.current) ?? "{}").appState.currentWeek, 4);
  assert.equal(JSON.parse(storage.getItem(SNAPSHOT_KEYS.previous) ?? "{}").appState.currentWeek, 3);
  assert.equal(JSON.parse(storage.getItem(SNAPSHOT_KEYS.previousPrevious) ?? "{}").appState.currentWeek, 2);
});

test("corrupted localStorage returns recovery state instead of seed data", () => {
  const storage = makeStorage();
  installWindowStorage(storage);
  storage.setItem(STORAGE_KEY, "{corrupt json");
  storage.setItem(SNAPSHOT_KEYS.current, JSON.stringify(createBackupPayload(createInitialState(), "2026-01-01T00:00:00.000Z")));

  const result = loadStateWithRecovery();

  assert.equal(result.status, "corrupt");
  assert.equal(result.state, null);
  assert.equal(result.recoveryOptions.hasSnapshot, true);
});

test("restore creates pre_restore_backup before writing imported state", () => {
  const storage = makeStorage();
  installWindowStorage(storage);
  const original = { ...createInitialState(), currentWeek: 1 };
  const imported = { ...createInitialState(), currentWeek: 7 };
  saveState(original);

  const restore = restoreBackupPayload(createBackupPayload(imported, "2026-01-01T00:00:00.000Z"), { persist: true });

  assert.equal(restore.status, "restored");
  assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_BACKUP_KEY) ?? "{}").appState.currentWeek, 1);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}").currentWeek, 7);
});

test("backup health status is red when never backed up, yellow when older than 30 days, and green when recent", () => {
  const state = createInitialState();

  assert.equal(buildBackupDashboardModel(state, null, "2026-02-01T00:00:00.000Z").health.status, "RED");
  assert.equal(buildBackupDashboardModel(state, "2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z").health.status, "YELLOW");
  assert.equal(buildBackupDashboardModel(state, "2026-01-20T00:00:00.000Z", "2026-02-01T00:00:00.000Z").health.status, "GREEN");
});

test("snapshot rotation helper keeps only current, previous, and previous_previous", () => {
  const first = createBackupPayload({ ...createInitialState(), currentWeek: 1 }, "2026-01-01T00:00:00.000Z");
  const second = createBackupPayload({ ...createInitialState(), currentWeek: 2 }, "2026-01-02T00:00:00.000Z");
  const third = createBackupPayload({ ...createInitialState(), currentWeek: 3 }, "2026-01-03T00:00:00.000Z");
  const rotated = rotateSnapshots({ current: second, previous: first, previousPrevious: null }, third);

  assert.equal(rotated.current.appState.currentWeek, 3);
  assert.equal(rotated.previous?.appState.currentWeek, 2);
  assert.equal(rotated.previousPrevious?.appState.currentWeek, 1);
});

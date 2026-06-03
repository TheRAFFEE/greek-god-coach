export type AuditSource =
  | "Readiness"
  | "Progression"
  | "Performance"
  | "Physique"
  | "RaceCalendar"
  | "Orchestrator";

export interface AuditCenterEntry {
  source: AuditSource;
  message: string;
  confidence?: string;
  timestamp?: string;
}

export interface AuditCenterUiModel {
  entries: AuditCenterEntry[];
  totalEntries: number;
  sourceCounts: Record<string, number>;
  emptyState?: string;
}

export interface AuditCenterInput {
  readinessEngineResult?: unknown;
  progressionEngineResult?: unknown;
  performanceEngineResult?: unknown;
  physiqueEngineResult?: unknown;
  raceCalendarEngineResult?: unknown;
  orchestratorEngineResult?: unknown;
}

const AUDIT_SOURCES: Array<{ source: AuditSource; key: keyof AuditCenterInput }> = [
  { source: "Readiness", key: "readinessEngineResult" },
  { source: "Progression", key: "progressionEngineResult" },
  { source: "Performance", key: "performanceEngineResult" },
  { source: "Physique", key: "physiqueEngineResult" },
  { source: "RaceCalendar", key: "raceCalendarEngineResult" },
  { source: "Orchestrator", key: "orchestratorEngineResult" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function auditItems(result: unknown): unknown[] {
  if (!isRecord(result)) return [];
  const trail = result.auditTrail;
  if (Array.isArray(trail)) return trail;
  const entries = result.auditEntries;
  if (Array.isArray(entries)) return entries;
  return [];
}

function entryMessage(item: unknown): string | undefined {
  if (typeof item === "string") return item;
  if (!isRecord(item)) return undefined;
  return asString(item.message)
    ?? asString(item.whatHappened)
    ?? asString(item.reason)
    ?? asString(item.why)
    ?? asString(item.decision)
    ?? asString(item.summary);
}

function entryConfidence(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined;
  return asString(item.confidence);
}

function entryTimestamp(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined;
  return asString(item.timestamp) ?? asString(item.generatedAt) ?? asString(item.date);
}

export function buildAuditCenterUiModel(input: AuditCenterInput): AuditCenterUiModel {
  const sourceCounts: Record<string, number> = Object.fromEntries(AUDIT_SOURCES.map(({ source }) => [source, 0]));
  const entries: AuditCenterEntry[] = [];

  for (const { source, key } of AUDIT_SOURCES) {
    for (const item of auditItems(input[key])) {
      const message = entryMessage(item);
      if (!message) continue;
      const entry: AuditCenterEntry = { source, message };
      const confidence = entryConfidence(item);
      const timestamp = entryTimestamp(item);
      if (confidence) entry.confidence = confidence;
      if (timestamp) entry.timestamp = timestamp;
      entries.push(entry);
      sourceCounts[source] += 1;
    }
  }

  return {
    entries,
    totalEntries: entries.length,
    sourceCounts,
    emptyState: entries.length ? undefined : "No audit data available yet.",
  };
}

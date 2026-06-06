import type { DailyTrainingBlock, DailyTrainingSession } from "./training-planner";
import { isPlannerDebugEnabled, type PlannerDebugActivationInput } from "./planner-shadow-observability";
import { buildPlannerTrainPreview } from "./planner-train-preview";

export type PlannerTrainScreenV1SessionType = "LiftDay" | "RunDay" | "LongRunDay" | "RecoveryDay" | "MobilityDay" | "RaceDay" | "DeloadDay" | "HybridDay" | "UnavailableDay";
export type PlannerTrainPrimaryKind = "Run" | "Lift" | "Recovery" | "Mobility" | "Unavailable";
export type PlannerTrainSupportKind = "Mobility" | "Core" | "Stretching" | "Activation" | "Breathing" | "Cooldown" | "Conditioning";

export interface PlannerTrainScreenV1RuntimeGuards {
  state?: unknown;
  logs?: unknown;
  recommendations?: unknown;
  readiness?: unknown;
  progression?: unknown;
  homeOutput?: unknown;
  trainOutput?: unknown;
  logOutput?: unknown;
}

export interface PlannerTrainScreenV1TopCard {
  title: "Today's Session";
  sessionType: PlannerTrainScreenV1SessionType;
  deload: boolean;
  primaryObjective: string;
  estimatedDuration: string;
  stressRating: DailyTrainingSession["combinedLoad"]["sessionStress"];
}

export interface PlannerTrainScreenV1PrimaryPrescription {
  kind: PlannerTrainPrimaryKind;
  title: string;
  details: string[];
}

export interface PlannerTrainScreenV1SupportItem {
  kind: PlannerTrainSupportKind;
  title: string;
  items: string[];
}

export interface PlannerTrainScreenV1Logging {
  showRunLogging: boolean;
  showLiftLogging: boolean;
  runLabel: string;
  liftLabel: string;
}

export interface PlannerTrainScreenV1Comparison {
  hiddenByDefault: true;
  legacySession: string;
  plannerSession: string;
  match: boolean;
  warnings: string[];
}

export interface PlannerTrainScreenV1LegacySession {
  sessionType?: string;
  warnings?: string[];
}

export interface PlannerTrainScreenV1 {
  visible: boolean;
  developerOnly: true;
  readOnly: true;
  advisoryOnly: true;
  title: "PlannerTrainScreenV1";
  topCard: PlannerTrainScreenV1TopCard;
  primaryPrescription: PlannerTrainScreenV1PrimaryPrescription;
  supportWork: PlannerTrainScreenV1SupportItem[];
  logging: PlannerTrainScreenV1Logging;
  comparison: PlannerTrainScreenV1Comparison;
  timestamp: string;
  runtimeMutationAttempted: boolean;
  affectsHome: false;
  affectsTrain: false;
  affectsLog: false;
  affectsLogs: false;
  affectsRecommendations: false;
  affectsProgression: false;
  affectsReadiness: false;
}

export interface BuildPlannerTrainScreenV1Input {
  debug: PlannerDebugActivationInput;
  plannerSession: DailyTrainingSession;
  legacySession?: PlannerTrainScreenV1LegacySession;
  timestamp?: string;
  runtimeGuards?: PlannerTrainScreenV1RuntimeGuards;
}

const NONE = "None";

function fingerprint(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function blockTitle(block: DailyTrainingBlock): string {
  return block.title || block.kind;
}

function itemHasCore(text: string): boolean {
  return /\bcore\b|plank|pallof|dead bug|hanging leg|ab wheel|crunch|sit-up/i.test(text);
}

function sourceHasCore(session: DailyTrainingSession): boolean {
  const text = [session.sourcePlan.sourceWorkoutTitle, session.sourcePlan.sourceWorkoutType, ...session.blocks.flatMap((block) => [block.title, ...block.items])].filter(Boolean).join(" ");
  return itemHasCore(text);
}

function normalizeSessionType(value: string): PlannerTrainScreenV1SessionType {
  if (["LiftDay", "RunDay", "LongRunDay", "RecoveryDay", "MobilityDay", "RaceDay", "DeloadDay", "HybridDay", "UnavailableDay"].includes(value)) return value as PlannerTrainScreenV1SessionType;
  return "UnavailableDay";
}

function cleanPrimaryTitle(title: string, kind: PlannerTrainPrimaryKind): string {
  if (kind === "Run") return title.replace(/\s*\+\s*(mobility|core|stretching|activation|breathing)(\s*\+\s*(mobility|core|stretching|activation|breathing))*\s*$/gi, "").trim();
  if (kind === "Lift") return title.replace(/\s*\+\s*(sprints?|conditioning|plyometrics?|agility|core)(\s*\+\s*(sprints?|conditioning|plyometrics?|agility|core))*\s*$/gi, "").trim();
  return title;
}

function makePrimary(session: DailyTrainingSession, sessionType: PlannerTrainScreenV1SessionType): PlannerTrainScreenV1PrimaryPrescription {
  if (sessionType === "RecoveryDay") {
    return { kind: "Recovery", title: "Recovery", details: ["No required training log today"] };
  }
  if (session.run && (sessionType === "RunDay" || sessionType === "LongRunDay" || sessionType === "RaceDay")) {
    const details = session.run.prescriptionMode === "distance" && session.run.distanceMiles !== null
      ? [`Distance: ${session.run.distanceMiles} mi`, `Target Duration: ${session.run.estimatedMinutes} min`]
      : [`Target Duration: ${session.run.durationMinutes ?? session.run.estimatedMinutes} min`];
    return { kind: "Run", title: cleanPrimaryTitle(session.run.title, "Run"), details };
  }
  if (session.workout && (sessionType === "LiftDay" || sessionType === "HybridDay")) {
    const liftBlock = session.blocks.find((block) => block.kind === "lift");
    return { kind: "Lift", title: cleanPrimaryTitle(session.workout.title, "Lift"), details: liftBlock?.items ?? [] };
  }
  if (session.mobility || session.blocks.some((block) => block.kind === "mobility")) {
    const block = session.blocks.find((item) => item.kind === "mobility");
    return { kind: "Mobility", title: block?.title ?? session.mobility?.title ?? "Mobility", details: block?.items ?? session.mobility?.items ?? [] };
  }
  return { kind: "Unavailable", title: "No planner session", details: [] };
}

function pushSupport(items: PlannerTrainScreenV1SupportItem[], kind: PlannerTrainSupportKind, title: string, blockItems: string[]): void {
  if (!items.some((item) => item.kind === kind && item.title === title)) items.push({ kind, title, items: blockItems });
}

function supportFromBlocks(session: DailyTrainingSession, primary: PlannerTrainScreenV1PrimaryPrescription): PlannerTrainScreenV1SupportItem[] {
  const support: PlannerTrainScreenV1SupportItem[] = [];
  for (const item of session.support) {
    if (item.kind === "Core") pushSupport(support, "Core", item.title, item.items);
  }
  for (const block of session.blocks) {
    if (block.kind === "warmup") pushSupport(support, "Activation", "Warmup / Activation", block.items);
    if (block.kind === "conditioning") pushSupport(support, "Conditioning", blockTitle(block), block.items);
    if (block.kind === "mobility" && primary.kind !== "Mobility") pushSupport(support, "Mobility", blockTitle(block), block.items);
    if (block.kind === "cooldown") {
      pushSupport(support, "Cooldown", blockTitle(block), block.items);
      if (block.items.some((item) => /breath/i.test(item))) pushSupport(support, "Breathing", "Breathing", block.items.filter((item) => /breath/i.test(item)));
      if (block.items.some((item) => /stretch/i.test(item))) pushSupport(support, "Stretching", "Stretching", block.items.filter((item) => /stretch/i.test(item)));
    }
  }
  if (!session.support.some((item) => item.kind === "Core") && sourceHasCore(session)) pushSupport(support, "Core", "Core", session.blocks.flatMap((block) => block.items.filter(itemHasCore)).length ? session.blocks.flatMap((block) => block.items.filter(itemHasCore)) : ["Core support work"]);
  return support;
}

function makeLogging(session: DailyTrainingSession, sessionType: PlannerTrainScreenV1SessionType): PlannerTrainScreenV1Logging {
  const showRunLogging = Boolean(session.run?.loggingTarget) && ["RunDay", "LongRunDay", "RaceDay"].includes(sessionType);
  const showLiftLogging = Boolean(session.workout?.loggingTarget) && sessionType === "LiftDay";
  return {
    showRunLogging,
    showLiftLogging,
    runLabel: showRunLogging ? "Run logging required" : "Run logging hidden",
    liftLabel: showLiftLogging ? "Lift logging required" : "Lift logging hidden",
  };
}

function emptyScreen(runtimeMutationAttempted = false): PlannerTrainScreenV1 {
  return {
    visible: false,
    developerOnly: true,
    readOnly: true,
    advisoryOnly: true,
    title: "PlannerTrainScreenV1",
    topCard: { title: "Today's Session", sessionType: "UnavailableDay", deload: false, primaryObjective: NONE, estimatedDuration: NONE, stressRating: "Low" },
    primaryPrescription: { kind: "Unavailable", title: NONE, details: [] },
    supportWork: [],
    logging: { showRunLogging: false, showLiftLogging: false, runLabel: "Run logging hidden", liftLabel: "Lift logging hidden" },
    comparison: { hiddenByDefault: true, legacySession: NONE, plannerSession: NONE, match: false, warnings: [] },
    timestamp: "",
    runtimeMutationAttempted,
    affectsHome: false,
    affectsTrain: false,
    affectsLog: false,
    affectsLogs: false,
    affectsRecommendations: false,
    affectsProgression: false,
    affectsReadiness: false,
  };
}

export function buildPlannerTrainScreenV1(input: BuildPlannerTrainScreenV1Input): PlannerTrainScreenV1 {
  const before = fingerprint(input.runtimeGuards);
  if (!isPlannerDebugEnabled(input.debug)) return emptyScreen(fingerprint(input.runtimeGuards) !== before);
  const preview = buildPlannerTrainPreview(input.plannerSession, input.timestamp ?? new Date().toISOString());
  const sessionType = normalizeSessionType(preview.sessionType);
  const primaryPrescription = makePrimary(input.plannerSession, sessionType);
  const supportWork = supportFromBlocks(input.plannerSession, primaryPrescription);
  const after = fingerprint(input.runtimeGuards);
  const legacySession = input.legacySession?.sessionType ?? NONE;
  return {
    visible: true,
    developerOnly: true,
    readOnly: true,
    advisoryOnly: true,
    title: "PlannerTrainScreenV1",
    topCard: {
      title: "Today's Session",
      sessionType,
      deload: input.plannerSession.metadata.deload,
      primaryObjective: primaryPrescription.title,
      estimatedDuration: preview.estimatedDuration,
      stressRating: preview.stressRating,
    },
    primaryPrescription,
    supportWork,
    logging: makeLogging(input.plannerSession, sessionType),
    comparison: {
      hiddenByDefault: true,
      legacySession,
      plannerSession: sessionType,
      match: legacySession === NONE ? false : legacySession === sessionType,
      warnings: input.legacySession?.warnings ?? [],
    },
    timestamp: preview.timestamp,
    runtimeMutationAttempted: before !== after,
    affectsHome: false,
    affectsTrain: false,
    affectsLog: false,
    affectsLogs: false,
    affectsRecommendations: false,
    affectsProgression: false,
    affectsReadiness: false,
  };
}

export interface PlannerTrainShadowPanelVisibilityInput {
  plannerDebugEnabled: boolean;
  legacyShadowPanelVisible: boolean;
  plannerTrainScreenV1Visible: boolean;
  activeScreen: string;
}

export function shouldRenderLegacyPlannerShadowPanel(input: PlannerTrainShadowPanelVisibilityInput): boolean {
  if (!input.plannerDebugEnabled || !input.legacyShadowPanelVisible) return false;
  return !(input.activeScreen === "Train" && input.plannerTrainScreenV1Visible);
}

export function renderPlannerTrainScreenV1Text(screen: PlannerTrainScreenV1): string {
  if (!screen.visible) return "";
  const support = screen.supportWork.map((item) => `Support: ${item.kind} — ${item.title}`).join("\n") || "Support: None";
  return [
    "PlannerTrainScreenV1",
    `${screen.topCard.title}: ${screen.topCard.sessionType}`,
    `Deload: ${screen.topCard.deload}`,
    `Primary Objective: ${screen.topCard.primaryObjective}`,
    `Estimated Duration: ${screen.topCard.estimatedDuration}`,
    `Stress Rating: ${screen.topCard.stressRating}`,
    `Primary: ${screen.primaryPrescription.kind} — ${screen.primaryPrescription.title}`,
    ...screen.primaryPrescription.details.map((item) => `Primary Detail: ${item}`),
    support,
    `Run Logging: ${screen.logging.showRunLogging ? "Shown" : "Hidden"}`,
    `Lift Logging: ${screen.logging.showLiftLogging ? "Shown" : "Hidden"}`,
    `Developer Comparison: hidden by default`,
    `Legacy Session: ${screen.comparison.legacySession}`,
    `Planner Session: ${screen.comparison.plannerSession}`,
    `Match: ${screen.comparison.match ? "Yes" : "No"}`,
    `Warnings: ${screen.comparison.warnings.join(" | ") || NONE}`,
    `Timestamp: ${screen.timestamp}`,
  ].join("\n");
}

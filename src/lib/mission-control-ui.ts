import type { GoalTrackingEngineResult } from "./goal-tracking-engine";
import type { OrchestratorEngineResult } from "./orchestrator-engine";
import type { PerformanceEngineResult } from "./performance-engine";
import type { PhysiqueEngineResult } from "./physique-engine";
import type { ProgressionEngineResult } from "./progression-engine";
import type { RaceCalendarEngineResult } from "./race-calendar-engine";
import type { TrainingEngineResult } from "./training-engine";

export interface MissionControlUiField {
  label: string;
  value: string;
  sub?: string;
  severity?: string;
}

export interface MissionControlGoalStatus {
  label: "Fat Loss" | "Physique" | "Strength" | "Half Marathon";
  status: string;
  confidence: string;
}

export interface MissionControlUiModel {
  primaryMission: MissionControlUiField;
  secondaryMission: MissionControlUiField;
  biggestRisk: MissionControlUiField;
  biggestOpportunity: MissionControlUiField;
  todayFocus: MissionControlUiField;
  weekFocus: MissionControlUiField;
  decisionConfidence: MissionControlUiField;
  performanceStatus: MissionControlUiField;
  performanceScore: MissionControlUiField;
  physiqueStatus: MissionControlUiField;
  physiqueScore: MissionControlUiField;
  raceReadiness: MissionControlUiField;
  racePhase: MissionControlUiField;
  raceWeeksRemaining: MissionControlUiField;
  weeklyDecision: MissionControlUiField;
  nutritionDecision: MissionControlUiField;
  goalStatuses: MissionControlGoalStatus[];
  coachSummary: MissionControlUiField;
  engineSources: string[];
}

export interface MissionControlUiInput {
  orchestratorEngineResult?: Partial<OrchestratorEngineResult> | null;
  performanceEngineResult?: Partial<PerformanceEngineResult> | null;
  physiqueEngineResult?: Partial<PhysiqueEngineResult> | null;
  goalTrackingEngineResult?: Partial<GoalTrackingEngineResult> | null;
  raceCalendarEngineResult?: Partial<RaceCalendarEngineResult> | ({ currentPhase?: string; raceReadiness?: string } & Record<string, unknown>) | null;
  progressionEngineResult?: Partial<ProgressionEngineResult> | null;
  trainingEngineResult?: Partial<TrainingEngineResult> | null;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberLabel(value: unknown, fallback: string): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value}/100` : fallback;
}

function weeksLabel(value: unknown, fallback: string): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value} weeks` : fallback;
}

function field(label: string, value: string, sub?: string, severity?: string): MissionControlUiField {
  return { label, value, sub, severity };
}

function goalStatus(result: Partial<GoalTrackingEngineResult> | null | undefined, key: "fatLoss" | "physique" | "strength" | "halfMarathon", label: MissionControlGoalStatus["label"]): MissionControlGoalStatus {
  const goals = result?.goals as Record<string, { status?: unknown; confidence?: unknown }> | undefined;
  const goal = goals?.[key];
  return {
    label,
    status: text(goal?.status, "No goal data."),
    confidence: text(goal?.confidence, "Unknown"),
  };
}

function raceValue(result: MissionControlUiInput["raceCalendarEngineResult"], primary: string, fallbackKey: string, fallback: string): string {
  const source = result as Record<string, unknown> | null | undefined;
  return text(source?.[primary], text(source?.[fallbackKey], fallback));
}

export function buildMissionControlUiModel(input: MissionControlUiInput): MissionControlUiModel {
  const orchestrator = input.orchestratorEngineResult;
  const performance = input.performanceEngineResult;
  const physique = input.physiqueEngineResult;
  const race = input.raceCalendarEngineResult;
  const progression = input.progressionEngineResult;

  return {
    primaryMission: field("Primary Mission", text(orchestrator?.primaryMission, "No mission available.")),
    secondaryMission: field("Secondary Mission", text(orchestrator?.secondaryMission, "No secondary mission available.")),
    biggestRisk: field("Biggest Risk", text(orchestrator?.biggestRisk, "No risk available."), undefined, text((orchestrator as { riskSeverity?: unknown } | null | undefined)?.riskSeverity, "")),
    biggestOpportunity: field("Biggest Opportunity", text(orchestrator?.biggestOpportunity, "No opportunity available.")),
    todayFocus: field("Today’s Focus", text(orchestrator?.todayFocus, "No mission available.")),
    weekFocus: field("This Week’s Focus", text(orchestrator?.weekFocus, "No weekly focus available.")),
    decisionConfidence: field("Decision Confidence", text(orchestrator?.decisionConfidence, text(progression?.confidence, "Unknown"))),
    performanceStatus: field("Performance Status", text(performance?.overallStatus, "Insufficient performance data."), text(performance?.confidence, "Unknown confidence")),
    performanceScore: field("Performance Score", numberLabel(performance?.overallScore, "Insufficient performance data.")),
    physiqueStatus: field("Physique Status", text(physique?.physiqueStatus, "No physique data available."), text(physique?.confidence, "Unknown confidence")),
    physiqueScore: field("Physique Score", numberLabel(physique?.physiqueScore, "No physique data available.")),
    raceReadiness: field("Race Readiness", raceValue(race, "readiness", "raceReadiness", "No race configured.")),
    racePhase: field("Current Phase", raceValue(race, "phase", "currentPhase", "No race configured.")),
    raceWeeksRemaining: field("Weeks Remaining", weeksLabel((race as Record<string, unknown> | null | undefined)?.weeksRemaining, "No race configured.")),
    weeklyDecision: field("Weekly Decision", text(progression?.weeklyDecision, "No weekly decision available.")),
    nutritionDecision: field("Nutrition Decision", text(progression?.nutritionDecision, "No nutrition decision available.")),
    goalStatuses: [
      goalStatus(input.goalTrackingEngineResult, "fatLoss", "Fat Loss"),
      goalStatus(input.goalTrackingEngineResult, "physique", "Physique"),
      goalStatus(input.goalTrackingEngineResult, "strength", "Strength"),
      goalStatus(input.goalTrackingEngineResult, "halfMarathon", "Half Marathon"),
    ],
    coachSummary: field("Coach Summary", text(orchestrator?.summary, "No mission available.")),
    engineSources: [
      "Orchestrator Engine",
      "Performance Engine",
      "Physique Engine",
      "Goal Tracking Engine",
      "Race Calendar Engine",
      "Progression Engine",
      "Training Engine",
    ],
  };
}

export type OrchestratorMission =
  | "Recovery"
  | "Fat Loss"
  | "Strength"
  | "Half Marathon"
  | "Physique"
  | "Consistency";

export type OrchestratorRiskSeverity = "Low" | "Medium" | "High" | "Critical";
export type OrchestratorConfidence = "High" | "Medium" | "Low";

export interface OrchestratorEngineInput {
  readinessEngineResult?: any;
  nutritionEngineResult?: any;
  runningEngineResult?: any;
  workoutEngineResult?: any;
  progressionEngineResult?: any;
  goalTrackingEngineResult?: any;
  trainingEngineResult?: any;
  performanceEngineResult?: any;
  physiqueEngineResult?: any;
}

export interface OrchestratorEngineResult {
  primaryMission: OrchestratorMission;
  secondaryMission?: OrchestratorMission;
  topPriority: string;
  biggestRisk: string;
  biggestOpportunity: string;
  todayFocus: string;
  weekFocus: string;
  decisionConfidence: OrchestratorConfidence;
  summary: string;
  auditTrail: string[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasEngine(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function readinessStatus(input: OrchestratorEngineInput): string {
  const result = input.readinessEngineResult ?? {};
  return text(result.status || result.readinessStatus || result.recoveryStatus || result.state);
}

function injuryRisk(input: OrchestratorEngineInput): number {
  const result = input.runningEngineResult ?? {};
  return number(result.injuryRisk) ?? number(result.injuryRiskScore) ?? number(result.riskScore) ?? 0;
}

function progressionDecision(input: OrchestratorEngineInput): string {
  const result = input.progressionEngineResult ?? {};
  return text(result.weeklyDecision || result.decision || result.progressionDecision || result.recommendation);
}

function goalContainer(input: OrchestratorEngineInput): any {
  const result = input.goalTrackingEngineResult ?? {};
  return result.goals ?? result.goalStatuses ?? result;
}

function getGoalStatus(input: OrchestratorEngineInput, key: "fatLoss" | "halfMarathon" | "strength" | "physique"): string {
  const goals = goalContainer(input);
  const aliases: Record<typeof key, string[]> = {
    fatLoss: ["fatLoss", "Fat Loss", "fat_loss"],
    halfMarathon: ["halfMarathon", "Half Marathon", "half_marathon"],
    strength: ["strength", "Strength"],
    physique: ["physique", "Physique"],
  };
  for (const alias of aliases[key]) {
    const value = goals?.[alias];
    if (typeof value === "string") return value;
    if (value?.status) return text(value.status);
    if (value?.goalStatus) return text(value.goalStatus);
  }
  return "";
}

function isOffTrack(status: string): boolean {
  return status.toLowerCase() === "off track";
}

function physiqueStatus(input: OrchestratorEngineInput): string {
  const physique = input.physiqueEngineResult ?? {};
  return text(physique.physiqueStatus || physique.status);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = text(value).trim();
    if (candidate) return candidate;
  }
  return "";
}

function chooseOpportunity(input: OrchestratorEngineInput): string {
  return firstString(
    input.performanceEngineResult?.primaryOpportunity,
    input.goalTrackingEngineResult?.primaryOpportunity,
    input.physiqueEngineResult?.primaryOpportunity,
    input.nutritionEngineResult?.primaryOpportunity,
    input.workoutEngineResult?.primaryOpportunity,
    input.runningEngineResult?.primaryOpportunity,
  ) || "Improve consistency with logging, nutrition, and training adherence";
}

function evaluateConfidence(input: OrchestratorEngineInput): OrchestratorConfidence {
  const supplied = [
    input.readinessEngineResult,
    input.nutritionEngineResult,
    input.runningEngineResult,
    input.workoutEngineResult,
    input.progressionEngineResult,
    input.goalTrackingEngineResult,
    input.trainingEngineResult,
    input.performanceEngineResult,
    input.physiqueEngineResult,
  ].filter(hasEngine).length;
  if (supplied >= 7) return "High";
  if (supplied >= 4) return "Medium";
  return "Low";
}

function missionText(mission: OrchestratorMission): { topPriority: string; todayFocus: string; weekFocus: string } {
  switch (mission) {
    case "Recovery":
      return { topPriority: "Protect recovery before progressing other goals.", todayFocus: "Complete recovery session.", weekFocus: "Prioritize recovery this week." };
    case "Fat Loss":
      return { topPriority: "Bring fat loss back on track.", todayFocus: "Hit protein target.", weekFocus: "Improve nutrition adherence." };
    case "Half Marathon":
      return { topPriority: "Bring half marathon preparation back on track.", todayFocus: "Finish scheduled run.", weekFocus: "Complete all scheduled runs." };
    case "Strength":
      return { topPriority: "Restart strength progression.", todayFocus: "Complete strength workout.", weekFocus: "Push strength progression." };
    case "Physique":
      return { topPriority: "Reverse declining physique trend.", todayFocus: "Hit protein target and complete planned training.", weekFocus: "Improve physique inputs: protein, workouts, and measurements." };
    case "Consistency":
      return { topPriority: "Log enough data and execute the basics consistently.", todayFocus: "Log today and complete the scheduled basics.", weekFocus: "Build consistency across check-ins, meals, workouts, and runs." };
  }
}

function riskForMission(mission: OrchestratorMission, input: OrchestratorEngineInput): string {
  if (mission === "Recovery") {
    if (readinessStatus(input).toLowerCase() === "red") return "Recovery is declining";
    if (injuryRisk(input) >= 70) return "Injury risk is high";
    return "Recovery requires focus";
  }
  if (mission === "Fat Loss") return "Fat loss has plateaued";
  if (mission === "Half Marathon") return "Half marathon goal is off track";
  if (mission === "Strength") return "Strength progression stalled";
  if (mission === "Physique") return firstString(input.physiqueEngineResult?.primaryRisk) || "Physique is declining";
  return "Major engine data is missing";
}

function chooseMission(input: OrchestratorEngineInput): { primary: OrchestratorMission; secondary?: OrchestratorMission; reason: string } {
  const candidates: OrchestratorMission[] = [];
  const readiness = readinessStatus(input).toLowerCase();
  const risk = injuryRisk(input);
  const progression = progressionDecision(input).toLowerCase();

  if (readiness === "red") return { primary: "Recovery", reason: "Red readiness overrides all other goals." };
  if (risk >= 70) return { primary: "Recovery", reason: `Injury risk ${risk} is at or above the recovery threshold.` };
  if (progression === "recovery focus") return { primary: "Recovery", reason: "Progression Engine selected Recovery Focus." };

  if (isOffTrack(getGoalStatus(input, "fatLoss"))) candidates.push("Fat Loss");
  if (isOffTrack(getGoalStatus(input, "halfMarathon"))) candidates.push("Half Marathon");
  if (isOffTrack(getGoalStatus(input, "strength"))) candidates.push("Strength");
  if (physiqueStatus(input) === "Declining" || isOffTrack(getGoalStatus(input, "physique"))) candidates.push("Physique");

  if (candidates.length > 0) {
    return { primary: candidates[0], secondary: candidates[1], reason: `${candidates[0]} has the highest-priority non-recovery risk.` };
  }

  const suppliedOpportunity = firstString(
    input.performanceEngineResult?.primaryOpportunity,
    input.goalTrackingEngineResult?.primaryOpportunity,
    input.physiqueEngineResult?.primaryOpportunity,
    input.nutritionEngineResult?.primaryOpportunity,
    input.workoutEngineResult?.primaryOpportunity,
    input.runningEngineResult?.primaryOpportunity,
  );
  if (!suppliedOpportunity) return { primary: "Consistency", reason: "No major risks or specific opportunities were available." };
  const opportunity = suppliedOpportunity.toLowerCase();
  if (opportunity.includes("protein") || opportunity.includes("nutrition") || opportunity.includes("adherence")) return { primary: "Fat Loss", reason: "No major risks exist, so the strongest opportunity points to nutrition/adherence." };
  if (opportunity.includes("run") || opportunity.includes("marathon") || opportunity.includes("pace")) return { primary: "Half Marathon", reason: "No major risks exist, so the strongest opportunity points to running." };
  if (opportunity.includes("strength") || opportunity.includes("workout") || opportunity.includes("lift")) return { primary: "Strength", reason: "No major risks exist, so the strongest opportunity points to strength." };
  if (opportunity.includes("body fat") || opportunity.includes("physique") || opportunity.includes("waist")) return { primary: "Physique", reason: "No major risks exist, so the strongest opportunity points to physique." };
  return { primary: "Consistency", reason: "No major risks or specific opportunities were available." };
}

export function evaluateOrchestrator(input: OrchestratorEngineInput): OrchestratorEngineResult {
  const mission = chooseMission(input);
  const focus = missionText(mission.primary);
  const biggestRisk = riskForMission(mission.primary, input);
  const biggestOpportunity = chooseOpportunity(input);
  const decisionConfidence = evaluateConfidence(input);
  const summary = mission.primary === "Recovery"
    ? `Recovery is currently the highest priority because readiness, injury risk, or recovery focus outweighs all other goals. Biggest opportunity: ${biggestOpportunity}.`
    : `${mission.primary} is currently the highest priority. Biggest risk: ${biggestRisk}. Biggest opportunity: ${biggestOpportunity}.`;
  const auditTrail = [
    `Mission chosen: ${mission.primary}. ${mission.reason}`,
    `Risk chosen: ${biggestRisk}. Priority order applied as Safety, Recovery, Adherence, Goal Risk, Performance Opportunity, Optimization.`,
    `Opportunity chosen: ${biggestOpportunity}. Source priority used Performance, Goal Tracking, Physique, Nutrition, Workout, Running.`,
    `Confidence assigned: ${decisionConfidence}. Based on supplied engine result count.`,
  ];

  return {
    primaryMission: mission.primary,
    secondaryMission: mission.secondary,
    topPriority: focus.topPriority,
    biggestRisk,
    biggestOpportunity,
    todayFocus: focus.todayFocus,
    weekFocus: focus.weekFocus,
    decisionConfidence,
    summary,
    auditTrail,
  };
}

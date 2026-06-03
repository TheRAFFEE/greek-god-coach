import type { MissionControlUiModel } from "./mission-control-ui";

export type MissionControlDestination =
  | "progress"
  | "goals"
  | "physique"
  | "raceCalendar"
  | "performance"
  | "training"
  | "nutrition"
  | "recovery";

export interface MissionControlRoute {
  destination: MissionControlDestination;
  sectionId: string;
}

export interface MissionControlRoutes {
  primaryMission: MissionControlRoute;
  secondaryMission: MissionControlRoute;
  biggestRisk: MissionControlRoute;
  biggestOpportunity: MissionControlRoute;
  todayMission: MissionControlRoute;
  weeklyDecision: MissionControlRoute;
  performanceSnapshot: MissionControlRoute;
  physiqueSnapshot: MissionControlRoute;
  raceStatus: MissionControlRoute;
  goalStatus: MissionControlRoute;
  coachSummary: MissionControlRoute;
  emptyState: string;
}

const EMPTY_ROUTE: MissionControlRoute = { destination: "progress", sectionId: "missing" };
const EMPTY_STATE = "Data not available yet.";

function includes(value: string, token: string): boolean {
  return value.toLowerCase().includes(token.toLowerCase());
}

function route(destination: MissionControlDestination, sectionId: string): MissionControlRoute {
  return { destination, sectionId };
}

function missionRoute(value: string): MissionControlRoute {
  if (includes(value, "fat loss")) return route("progress", "goals");
  if (includes(value, "strength")) return route("progress", "goals");
  if (includes(value, "half marathon") || includes(value, "race")) return route("progress", "race");
  if (includes(value, "physique")) return route("progress", "physique");
  if (includes(value, "recovery")) return route("progress", "recovery");
  if (includes(value, "consistency")) return route("progress", "coachSummary");
  return EMPTY_ROUTE;
}

function riskRoute(value: string): MissionControlRoute {
  if (includes(value, "recovery")) return route("progress", "recovery");
  if (includes(value, "nutrition")) return route("progress", "nutrition");
  if (includes(value, "physique")) return route("progress", "physique");
  if (includes(value, "race") || includes(value, "running")) return route("progress", "race");
  if (includes(value, "goal")) return route("goals", "goals");
  return EMPTY_ROUTE;
}

function opportunityRoute(value: string): MissionControlRoute {
  if (includes(value, "running")) return route("progress", "run");
  if (includes(value, "strength")) return route("progress", "strength");
  if (includes(value, "nutrition")) return route("progress", "nutrition");
  if (includes(value, "physique")) return route("progress", "physique");
  if (includes(value, "race")) return route("progress", "race");
  if (includes(value, "recovery") || includes(value, "sleep")) return route("progress", "recovery");
  return EMPTY_ROUTE;
}

export function buildMissionControlRoutes(model: MissionControlUiModel): MissionControlRoutes {
  return {
    primaryMission: missionRoute(model.primaryMission.value),
    secondaryMission: missionRoute(model.secondaryMission.value),
    biggestRisk: riskRoute(model.biggestRisk.value),
    biggestOpportunity: opportunityRoute(model.biggestOpportunity.value),
    todayMission: missionRoute(model.todayFocus.value),
    weeklyDecision: route("progress", "review"),
    performanceSnapshot: route("progress", "performance"),
    physiqueSnapshot: route("progress", "physique"),
    raceStatus: route("progress", "race"),
    goalStatus: route("progress", "goals"),
    coachSummary: route("progress", "coachSummary"),
    emptyState: EMPTY_STATE,
  };
}

import type { HomeCommandCenterModel } from "./home-command-center";
import type { MissionControlUiModel } from "./mission-control-ui";

export const HOME_FORBIDDEN_REPORTING_LABELS = [
  "Performance Snapshot",
  "Physique Snapshot",
  "Goal Status",
  "Race Status",
  "Audit Center",
  "Week In Review",
  "Data Quality",
  "Historical reporting",
] as const;

export interface HomeDailyDashboardSection {
  label: "Today's workout" | "Today's run" | "Today's nutrition focus" | "Recovery status" | "Primary mission";
  value: string;
  sub?: string;
}

export interface HomeDailyDashboardCta {
  label: string;
  destination: "Train" | "Log" | "Progress" | "More";
  section?: string;
}

export interface HomeDailyDashboardWhyItem {
  label: "Primary Mission" | "Biggest Risk" | "Biggest Opportunity" | "Weekly Decision";
  value: string;
  sub?: string;
}

export interface HomeDailyDashboardModel {
  question: "What should I do today?";
  sections: HomeDailyDashboardSection[];
  ctas: HomeDailyDashboardCta[];
  why: {
    title: "Why?";
    collapsedByDefault: true;
    items: HomeDailyDashboardWhyItem[];
  };
}

export interface HomeDailyDashboardInput {
  home: HomeCommandCenterModel;
  missionControl: MissionControlUiModel;
}

function nutritionFocus(home: HomeCommandCenterModel): string {
  if (home.caloriesRemaining > 0) return `Hit protein target and keep calories within ${home.caloriesRemaining} remaining.`;
  return "Prioritize protein, hydration, and clean logging for the rest of today.";
}

function recoveryStatus(home: HomeCommandCenterModel): string {
  const warning = home.recovery.warning ? ` — ${home.recovery.warning}` : "";
  return `${home.recovery.readiness}${warning}`;
}

export function buildHomeDailyDashboard(input: HomeDailyDashboardInput): HomeDailyDashboardModel {
  const { home, missionControl } = input;

  return {
    question: "What should I do today?",
    sections: [
      {
        label: "Today's workout",
        value: home.training.workout.name,
        sub: `${home.training.workout.estimatedDurationMinutes} min · ${home.training.workout.status}`,
      },
      {
        label: "Today's run",
        value: home.training.run.name,
        sub: `${home.training.run.estimatedDurationMinutes} min · ${home.training.run.status}`,
      },
      {
        label: "Today's nutrition focus",
        value: nutritionFocus(home),
      },
      {
        label: "Recovery status",
        value: recoveryStatus(home),
        sub: `Confidence: ${home.recovery.confidence}`,
      },
      {
        label: "Primary mission",
        value: missionControl.primaryMission.value,
      },
    ],
    ctas: [
      {
        label: home.actions.startWorkout.label,
        destination: home.actions.startWorkout.destination,
      },
    ],
    why: {
      title: "Why?",
      collapsedByDefault: true,
      items: [
        { label: "Primary Mission", value: missionControl.primaryMission.value, sub: missionControl.primaryMission.sub },
        { label: "Biggest Risk", value: missionControl.biggestRisk.value, sub: missionControl.biggestRisk.sub },
        { label: "Biggest Opportunity", value: missionControl.biggestOpportunity.value, sub: missionControl.biggestOpportunity.sub },
        { label: "Weekly Decision", value: missionControl.weeklyDecision.value, sub: missionControl.nutritionDecision.value },
      ],
    },
  };
}

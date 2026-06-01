export type PrimaryNavigationId = "Home" | "Train" | "Log" | "Progress" | "More";

export interface PrimaryNavigationTab {
  id: PrimaryNavigationId;
  label: PrimaryNavigationId;
}

export const appNavigation: PrimaryNavigationTab[] = [
  { id: "Home", label: "Home" },
  { id: "Train", label: "Train" },
  { id: "Log", label: "Log" },
  { id: "Progress", label: "Progress" },
  { id: "More", label: "More" },
];

export const removedTopLevelTabs = [
  "Coach Mode",
  "Tracker Mode",
  "Manual Mode",
  "Mode Clarity",
  "Onboarding",
  "Readiness",
  "Weekly Review",
  "Plan Adjustments",
  "Workout",
  "Running",
] as const;

export const screenGroups: Record<PrimaryNavigationId, string[]> = {
  Home: ["Readiness", "Today's plan", "Calories", "Weight", "Start Day"],
  Train: ["Today's workout", "Today's run", "Start Training"],
  Log: ["Daily check-in", "Workout logging", "Run logging", "Nutrition logging", "Body metrics logging"],
  Progress: ["Weight trends", "Pace trends", "Mileage trends", "Weekly review", "Progress photos", "Race countdown", "Adherence metrics"],
  More: ["Settings", "Integrations", "Goals"],
};

export const removedHomeSections = [
  "Mode Clarity",
  "Duplicate readiness cards",
  "Duplicate recommendation cards",
  "Workout receipts",
  "Run summary cards",
] as const;

export const removedRunningSections = [
  "Distance trend section from Running tab",
  "Pace trend section from Running tab",
  "RPE trend section from Running tab",
  "Long run progression section from Running tab",
  "Recent running logs section from Running tab",
] as const;

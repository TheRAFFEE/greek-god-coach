import type { BodyMetric, ProgressPhoto } from "./types";

export type LogSectionId = "checkin" | "nutrition" | "body" | "photos";

export interface LogSectionModel {
  id: LogSectionId;
  label: "Daily Check-In" | "Nutrition" | "Body Metrics" | "Progress Photos";
  description: string;
  fields: string[];
}

export interface BodyMetricsSummary {
  hasData: boolean;
  currentWeight: number | null;
  weightChange7Days: number | null;
  waistChange7Days: number | null;
  message: string;
}

export interface PhotoSlotSummary {
  label: "Front" | "Side" | "Back";
  field: "frontPhotoUrl" | "sidePhotoUrl" | "backPhotoUrl";
  latestUrl: string | null;
}

export interface PhotoSectionSummary {
  latestUploadDate: string | null;
  slots: PhotoSlotSummary[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function buildLogSections(): LogSectionModel[] {
  return [
    {
      id: "checkin",
      label: "Daily Check-In",
      description: "Report recovery signals before the day starts.",
      fields: ["sleep", "soreness", "stress", "energy", "alcohol", "pain"],
    },
    {
      id: "nutrition",
      label: "Nutrition",
      description: "Report meals, scans, saved foods, and macro logging.",
      fields: ["meals", "food scan", "saved foods", "nutrition logging"],
    },
    {
      id: "body",
      label: "Body Metrics",
      description: "Report weekly measurements.",
      fields: ["weight", "waist", "neck", "hips", "chest", "arms", "thighs"],
    },
    {
      id: "photos",
      label: "Progress Photos",
      description: "Report front, side, and back photos.",
      fields: ["front", "side", "back"],
    },
  ];
}

export function humanizeDataQualityReason(reason: string) {
  const normalized = reason.toLowerCase();
  if (normalized.includes("runningresult") || normalized.includes("run log") || normalized.includes("recent runs")) return "Need at least 2 recent runs";
  if (normalized.includes("workoutresult") || normalized.includes("workout")) return "Need more completed workouts";
  if (normalized.includes("nutritionresult") || normalized.includes("meal") || normalized.includes("nutrition")) return "Need more meal logs";
  if (normalized.includes("readinessresult") || normalized.includes("check-in") || normalized.includes("checkins")) return "Need more daily check-ins";
  return reason;
}

export function buildBodyMetricsSummary(metrics: BodyMetric[]): BodyMetricsSummary {
  const sorted = [...metrics].filter((metric) => typeof metric.weight === "number").sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  if (!latest) {
    return { hasData: false, currentWeight: null, weightChange7Days: null, waistChange7Days: null, message: "Need more measurements" };
  }

  const latestTime = new Date(`${latest.date}T00:00:00.000Z`).getTime();
  const targetTime = latestTime - 7 * 24 * 60 * 60 * 1000;
  const baseline = [...sorted].reverse().find((metric) => new Date(`${metric.date}T00:00:00.000Z`).getTime() <= targetTime) ?? (sorted.length >= 2 ? sorted[0] : null);
  const weightChange7Days = baseline ? round1(latest.weight - baseline.weight) : null;
  const waistChange7Days = baseline && typeof latest.waist === "number" && typeof baseline.waist === "number" ? round1(latest.waist - baseline.waist) : null;

  return {
    hasData: true,
    currentWeight: latest.weight,
    weightChange7Days,
    waistChange7Days,
    message: baseline ? "Current measurements are available." : "Need more measurements",
  };
}

export function buildPhotoSectionSummary(photos: ProgressPhoto[]): PhotoSectionSummary {
  const latest = [...photos].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return {
    latestUploadDate: latest?.date ?? null,
    slots: [
      { label: "Front", field: "frontPhotoUrl", latestUrl: latest?.frontPhotoUrl || null },
      { label: "Side", field: "sidePhotoUrl", latestUrl: latest?.sidePhotoUrl || null },
      { label: "Back", field: "backPhotoUrl", latestUrl: latest?.backPhotoUrl || null },
    ],
  };
}

import type { BodyMetric } from "./types";

export interface WeightTrendDashboardInput {
  startingWeight: number;
  goalWeight: number;
}

export interface WeightChartPoint {
  date: string;
  weight: number;
}

export interface WeightTrendDashboard {
  hasData: boolean;
  latestWeight: number | null;
  sevenDayAverage: number | null;
  fourteenDayAverage: number | null;
  weeklyWeightChange: number | null;
  progressPoundsLost: number;
  progressPoundsRemaining: number;
  progressPercent: number;
  chartPoints: WeightChartPoint[];
  summary: string;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const round0 = (value: number) => Math.round(value);
const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function validWeightMetrics(metrics: BodyMetric[]): WeightChartPoint[] {
  return metrics
    .filter((metric) => Number.isFinite(metric.weight) && metric.weight > 0 && typeof metric.date === "string" && metric.date.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((metric) => ({ date: metric.date, weight: round1(metric.weight) }));
}

export function buildWeightTrendDashboard(metrics: BodyMetric[], input: WeightTrendDashboardInput): WeightTrendDashboard {
  const points = validWeightMetrics(metrics);

  if (!points.length) {
    return {
      hasData: false,
      latestWeight: null,
      sevenDayAverage: null,
      fourteenDayAverage: null,
      weeklyWeightChange: null,
      progressPoundsLost: 0,
      progressPoundsRemaining: round1(Math.max(0, input.startingWeight - input.goalWeight)),
      progressPercent: 0,
      chartPoints: [],
      summary: "No weight entries yet. Log a check-in or body metric to start the trend.",
    };
  }

  const latestWeight = points[points.length - 1].weight;
  const last7 = points.slice(-7).map((point) => point.weight);
  const last14 = points.slice(-14).map((point) => point.weight);
  const previous7 = points.slice(-14, -7).map((point) => point.weight);
  const sevenDayAverage = round1(avg(last7) ?? latestWeight);
  const fourteenDayAverage = round1(avg(last14) ?? latestWeight);
  const previous7Average = avg(previous7);
  const weeklyWeightChange = previous7Average === null ? null : round1(sevenDayAverage - previous7Average);
  const totalToLose = Math.max(0.1, input.startingWeight - input.goalWeight);
  const progressPoundsLost = round1(Math.max(0, input.startingWeight - latestWeight));
  const progressPoundsRemaining = round1(Math.max(0, latestWeight - input.goalWeight));
  const progressPercent = clamp(round0((progressPoundsLost / totalToLose) * 100), 0, 100);

  return {
    hasData: true,
    latestWeight,
    sevenDayAverage,
    fourteenDayAverage,
    weeklyWeightChange,
    progressPoundsLost,
    progressPoundsRemaining,
    progressPercent,
    chartPoints: points.slice(-21),
    summary: `${progressPoundsLost} lb lost, ${progressPoundsRemaining} lb to under 200 lb.`,
  };
}

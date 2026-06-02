import type { DailyCheckIn, ReadinessStatus } from "./types";

export type ReadinessRecommendationType = "full_training" | "modified_training" | "deload" | "recovery_focus";
export type ReadinessConfidence = "High" | "Medium" | "Low";

export interface ReadinessEngineInput {
  date?: string;
  mode?: "daily" | "weekly";

  sleep: number | null;
  soreness: number | null;
  stress: number | null;
  energy: number | null;
  alcohol: boolean | number | null;
  pain: boolean | null;
  painSeverity: number | null;
  restingHr: number | null;
  hrv: number | null;

  baseline?: {
    restingHr?: number | null;
    hrv?: number | null;
  };
}

export interface ReadinessReason {
  factor:
    | "sleep"
    | "soreness"
    | "stress"
    | "energy"
    | "alcohol"
    | "pain"
    | "resting_hr"
    | "hrv"
    | "data_quality";
  severity: "info" | "yellow" | "red";
  points: number;
  message: string;
}

export interface ReadinessEngineResult {
  score: number;
  status: ReadinessStatus;
  confidence: ReadinessConfidence;
  reasons: ReadinessReason[];
  reason: string;
  recommendation: string;
  recommendationType: ReadinessRecommendationType;
  trainingGuidance: string;
  recoveryGuidance: string[];
  dataQualityWarnings: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round0 = (value: number) => Math.round(value);
const isPresent = (value: number | boolean | null | undefined) => value !== null && value !== undefined && !(typeof value === "number" && Number.isNaN(value));
const finiteNumbers = (values: number[]) => values.filter((value) => Number.isFinite(value));
const average = (values: number[]) => {
  const valid = finiteNumbers(values);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

function confidenceFor(input: ReadinessEngineInput): { confidence: ReadinessConfidence; warnings: string[] } {
  const warnings: string[] = [];
  const missingSubjective: string[] = [];

  if (!isPresent(input.sleep)) missingSubjective.push("sleep");
  if (!isPresent(input.soreness)) missingSubjective.push("soreness");
  if (!isPresent(input.stress)) missingSubjective.push("stress");
  if (!isPresent(input.energy)) missingSubjective.push("energy");
  if (!isPresent(input.pain)) missingSubjective.push("pain status");

  if (missingSubjective.length) {
    warnings.push(`Missing key subjective readiness data: ${missingSubjective.join(", ")}.`);
    return { confidence: "Low", warnings };
  }

  const missingBiometrics: string[] = [];
  if (!isPresent(input.restingHr)) missingBiometrics.push("resting HR");
  if (!isPresent(input.hrv)) missingBiometrics.push("HRV");

  if (missingBiometrics.length) {
    warnings.push(`Missing biometric readiness data: ${missingBiometrics.join(", ")}.`);
    return { confidence: "Medium", warnings };
  }

  return { confidence: "High", warnings };
}

function recommendationFor(status: ReadinessStatus, painRedCap: boolean, redWithoutMajorPain: boolean) {
  if (status === "Green") {
    return {
      recommendationType: "full_training" as const,
      recommendation: "Complete the planned workout. Progress weights or reps if form is solid and RPE stays at 8 or less. Conditioning allowed.",
      trainingGuidance: "Complete planned training. Progress only if form and RPE support it.",
      recoveryGuidance: ["Continue normal recovery habits: hydration, protein, steps, and sleep."],
    };
  }

  if (status === "Yellow") {
    return {
      recommendationType: "modified_training" as const,
      recommendation: "Keep the workout but reduce volume 10-25%, avoid max-effort sets, keep Zone 2 conversational, and replace sprinting with incline walk or easy bike if needed.",
      trainingGuidance: "Keep training, but reduce volume 10-25%, cap RPE at 7, and avoid max efforts.",
      recoveryGuidance: ["Prioritize sleep, hydration, mobility, and easy walking."],
    };
  }

  if (painRedCap) {
    return {
      recommendationType: "recovery_focus" as const,
      recommendation: "No heavy lifting, sprinting, hard intervals, or painful movement. Replace today with walking, mobility, hydration, sleep, and recovery. Seek professional evaluation for persistent concerning symptoms.",
      trainingGuidance: "Do not train through significant pain.",
      recoveryGuidance: ["Avoid painful movement.", "Use walking and mobility only if symptoms allow.", "Seek professional evaluation for persistent concerning symptoms."],
    };
  }

  return {
    recommendationType: (redWithoutMajorPain ? "deload" : "recovery_focus") as ReadinessRecommendationType,
    recommendation: "No heavy lifting, sprinting, or hard intervals. Replace today with walking, mobility, easy Zone 2, hydration, sleep, and recovery.",
    trainingGuidance: "Replace hard work with recovery-focused movement only.",
    recoveryGuidance: ["Prioritize hydration and sleep.", "Use walking, mobility, and easy Zone 2 only if symptoms improve."],
  };
}

export function evaluateReadiness(input: ReadinessEngineInput): ReadinessEngineResult {
  let score = 100;
  const reasons: ReadinessReason[] = [];
  const dataQualityWarnings: string[] = [];

  const subtract = (points: number, factor: ReadinessReason["factor"], severity: ReadinessReason["severity"], message: string) => {
    score -= points;
    reasons.push({ factor, severity, points, message });
  };

  if (input.sleep !== null && input.sleep !== undefined) {
    if (input.sleep < 5) subtract(30, "sleep", "red", "sleep under 5 hours");
    else if (input.sleep < 6) subtract(20, "sleep", "yellow", "sleep 5-6 hours");
    else if (input.sleep < 7) subtract(10, "sleep", "yellow", "sleep 6-7 hours");
  }

  if (input.soreness !== null && input.soreness !== undefined) {
    if (input.soreness >= 8) subtract(25, "soreness", "red", "severe soreness");
    else if (input.soreness >= 6) subtract(10, "soreness", "yellow", "moderate soreness");
  }

  if (input.stress !== null && input.stress !== undefined) {
    if (input.stress >= 8) subtract(15, "stress", "red", "high stress");
    else if (input.stress >= 6) subtract(10, "stress", "yellow", "elevated stress");
  }

  if (input.energy !== null && input.energy !== undefined) {
    if (input.energy <= 2) subtract(25, "energy", "red", "very low energy");
    else if (input.energy <= 5) subtract(10, "energy", "yellow", "moderate energy");
  }

  if (input.mode === "weekly") {
    const alcoholDays = typeof input.alcohol === "number" ? input.alcohol : input.alcohol ? 1 : 0;
    if (alcoholDays >= 4) subtract(20, "alcohol", "red", "four or more alcohol days");
    else if (alcoholDays >= 2) subtract(10, "alcohol", "yellow", "two or more alcohol days");
  } else if (input.alcohol === true) {
    subtract(5, "alcohol", "yellow", "alcohol yesterday");
  }

  const painRedCap = input.pain === true && (input.painSeverity ?? 0) >= 6;
  if (input.pain === true) {
    if (input.painSeverity === null || input.painSeverity === undefined) {
      subtract(10, "pain", "yellow", "pain logged without severity");
      dataQualityWarnings.push("Pain was logged without pain severity.");
    } else if (input.painSeverity >= 7) {
      subtract(40, "pain", "red", "severe pain");
    } else if (input.painSeverity >= 6) {
      subtract(35, "pain", "red", "significant pain");
    } else if (input.painSeverity >= 4) {
      subtract(15, "pain", "yellow", "moderate pain");
    }
  }

  if (isPresent(input.restingHr) && isPresent(input.baseline?.restingHr) && Number(input.restingHr) > Number(input.baseline?.restingHr) + 8) {
    subtract(15, "resting_hr", "yellow", "resting HR elevated");
  }

  if (isPresent(input.hrv) && isPresent(input.baseline?.hrv) && Number(input.baseline?.hrv) > 0 && Number(input.hrv) < Number(input.baseline?.hrv) * 0.8) {
    subtract(15, "hrv", "yellow", "HRV down over 20%");
  }

  const confidence = confidenceFor(input);
  dataQualityWarnings.push(...confidence.warnings);

  const severeSleepAndEnergy = (input.sleep ?? 99) < 5 && (input.energy ?? 10) <= 2;
  const redCap = painRedCap || severeSleepAndEnergy;
  const finalScore = clamp(round0(redCap ? Math.min(score, 59) : score), 0, 100);
  const status: ReadinessStatus = redCap || finalScore < 60 ? "Red" : finalScore >= 80 ? "Green" : "Yellow";
  const redWithoutMajorPain = status === "Red" && !painRedCap;
  const recommendation = recommendationFor(status, painRedCap, redWithoutMajorPain);
  const reason = reasons.length ? reasons.map((item) => item.message).join("; ") : "Recovery markers are within normal range";

  return {
    score: finalScore,
    status,
    confidence: confidence.confidence,
    reasons,
    reason,
    ...recommendation,
    dataQualityWarnings,
  };
}

export function readinessInputFromDailyCheckIn(
  checkIn: DailyCheckIn,
  baseline?: ReadinessEngineInput["baseline"],
): ReadinessEngineInput {
  return {
    date: checkIn.date,
    mode: "daily",
    sleep: checkIn.sleepHours,
    soreness: checkIn.soreness,
    stress: checkIn.stress,
    energy: checkIn.energy,
    alcohol: checkIn.alcohol,
    pain: checkIn.pain,
    painSeverity: checkIn.painSeverity,
    restingHr: checkIn.restingHr,
    hrv: checkIn.hrv,
    baseline,
  };
}

export function readinessInputFromWeeklyWindow(input: {
  checkIns: DailyCheckIn[];
  runPainSeverity?: number | null;
  baseline?: ReadinessEngineInput["baseline"];
}): ReadinessEngineInput {
  const checkIns = input.checkIns ?? [];
  const checkInPainSeverities = checkIns.filter((entry) => entry.pain || entry.painSeverity > 0).map((entry) => entry.painSeverity);
  const painSeverities = [
    ...checkInPainSeverities,
    ...(input.runPainSeverity !== null && input.runPainSeverity !== undefined ? [input.runPainSeverity] : []),
  ].filter((value) => Number.isFinite(value));
  const painSeverity = painSeverities.length ? Math.max(...painSeverities) : null;

  return {
    mode: "weekly",
    sleep: average(checkIns.map((entry) => entry.sleepHours)),
    soreness: average(checkIns.map((entry) => entry.soreness)),
    stress: average(checkIns.map((entry) => entry.stress)),
    energy: average(checkIns.map((entry) => entry.energy)),
    alcohol: checkIns.filter((entry) => entry.alcohol).length,
    pain: checkIns.some((entry) => entry.pain || entry.painSeverity > 0) || painSeverity !== null,
    painSeverity,
    restingHr: average(checkIns.map((entry) => entry.restingHr)),
    hrv: average(checkIns.map((entry) => entry.hrv)),
    baseline: input.baseline,
  };
}

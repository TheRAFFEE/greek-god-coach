export type PhysiqueStatus = "Improving" | "Stable" | "Plateau" | "Declining" | "Insufficient Data";
export type PhysiqueConfidence = "High" | "Medium" | "Low";
export type PhysiqueTrend = "Down" | "Flat" | "Up" | "Unknown";
export type LeanMassTrend = "Increasing" | "Maintained" | "Decreasing" | "Unknown";
export type PhysiqueStrengthTrend = "Improving" | "Stable" | "Plateau" | "Declining" | "Insufficient Data";

export interface PhysiqueEngineInput {
  weight?: number;
  waist?: number;
  neck?: number;
  height?: number;
  priorWeight?: number;
  priorWaist?: number;
  priorNeck?: number;
  proteinAdherence?: number;
  calorieAdherence?: number;
  workoutAdherence?: number;
  strengthTrend?: PhysiqueStrengthTrend;
  photoCount?: number;
  photoConsistency?: number;
}

export interface PhysiqueAuditEntry {
  id: string;
  decision: "body_fat_estimate" | "trend_analysis" | "score" | "status" | "confidence";
  score: number | null;
  reason: string;
  dataUsed: string[];
}

export interface PhysiqueEngineResult {
  physiqueStatus: PhysiqueStatus;
  confidence: PhysiqueConfidence;
  physiqueScore: number;
  bodyFatPercent: number | null;
  leanMass: number | null;
  bodyFatTrend: PhysiqueTrend;
  waistTrend: PhysiqueTrend;
  leanMassTrend: LeanMassTrend;
  primaryOpportunity: string;
  primaryRisk: string;
  summary: string;
  warnings: string[];
  auditTrail: PhysiqueAuditEntry[];
}

function isPositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function navyBodyFatPercent(weight: number | undefined, waist: number | undefined, neck: number | undefined, height: number | undefined) {
  void weight;
  if (!isPositive(waist) || !isPositive(neck) || !isPositive(height) || waist <= neck) return null;
  const estimate = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76;
  if (!Number.isFinite(estimate)) return null;
  return round(clamp(estimate, 3, 60), 1);
}

function leanMassFrom(weight: number | undefined, bodyFatPercent: number | null) {
  if (!isPositive(weight) || bodyFatPercent === null) return null;
  return round(weight * (1 - bodyFatPercent / 100), 1);
}

function trendFromDelta(delta: number | null, threshold: number): PhysiqueTrend {
  if (delta === null) return "Unknown";
  if (delta <= -threshold) return "Down";
  if (delta >= threshold) return "Up";
  return "Flat";
}

function leanTrendFromDelta(delta: number | null): LeanMassTrend {
  if (delta === null) return "Unknown";
  if (delta >= 1) return "Increasing";
  if (delta <= -1) return "Decreasing";
  return "Maintained";
}

function scoreAdherence(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return clamp(value);
}

function scoreStrength(trend: PhysiqueStrengthTrend | undefined) {
  if (trend === "Improving") return 90;
  if (trend === "Stable") return 75;
  if (trend === "Plateau") return 55;
  if (trend === "Declining") return 25;
  return 50;
}

function scoreTrend(trend: PhysiqueTrend) {
  if (trend === "Down") return 90;
  if (trend === "Flat") return 60;
  if (trend === "Up") return 25;
  return 50;
}

function scoreLeanTrend(trend: LeanMassTrend) {
  if (trend === "Increasing") return 95;
  if (trend === "Maintained") return 85;
  if (trend === "Decreasing") return 30;
  return 50;
}

function decideConfidence(input: PhysiqueEngineInput, hasCurrentEstimate: boolean): PhysiqueConfidence {
  if (!hasCurrentEstimate) return "Low";
  const hasPriorMeasurements = isPositive(input.priorWeight) && isPositive(input.priorWaist) && isPositive(input.priorNeck);
  const hasAdherence = typeof input.proteinAdherence === "number" && typeof input.workoutAdherence === "number" && typeof input.calorieAdherence === "number";
  const photoConsistency = input.photoConsistency ?? 0;
  const photoCount = input.photoCount ?? 0;
  if (hasPriorMeasurements && hasAdherence && photoCount >= 3 && photoConsistency >= 70) return "High";
  if ((hasPriorMeasurements || hasAdherence) && (photoCount > 0 || photoConsistency > 0)) return "Medium";
  return "Low";
}

function decideStatus(input: {
  sufficient: boolean;
  bodyFatTrend: PhysiqueTrend;
  waistTrend: PhysiqueTrend;
  leanMassTrend: LeanMassTrend;
  proteinAdherence: number | undefined;
  workoutAdherence: number | undefined;
  strengthTrend: PhysiqueStrengthTrend | undefined;
  score: number;
}): PhysiqueStatus {
  if (!input.sufficient) return "Insufficient Data";
  const strongProtein = (input.proteinAdherence ?? 0) >= 80;
  const strongWorkouts = (input.workoutAdherence ?? 0) >= 75;
  const leanMaintained = input.leanMassTrend === "Maintained" || input.leanMassTrend === "Increasing" || input.leanMassTrend === "Unknown";
  if (input.waistTrend === "Up" || input.bodyFatTrend === "Up" || input.leanMassTrend === "Decreasing" || input.strengthTrend === "Declining") return "Declining";
  if (input.waistTrend === "Down" && input.bodyFatTrend === "Down" && leanMaintained && strongProtein) return "Improving";
  if (input.waistTrend === "Flat" && input.bodyFatTrend === "Flat" && strongProtein && strongWorkouts) return "Plateau";
  if (input.score >= 70) return "Stable";
  if (input.score < 50) return "Declining";
  return "Plateau";
}

function opportunity(input: PhysiqueEngineInput, status: PhysiqueStatus) {
  const options = [
    { label: "Protein adherence", score: scoreAdherence(input.proteinAdherence), warning: (input.proteinAdherence ?? 100) < 70 },
    { label: "Workout adherence", score: scoreAdherence(input.workoutAdherence), warning: (input.workoutAdherence ?? 100) < 70 },
    { label: "Calorie adherence", score: scoreAdherence(input.calorieAdherence), warning: (input.calorieAdherence ?? 100) < 70 },
  ].sort((a, b) => a.score - b.score);
  if (status === "Insufficient Data") return "Measurements consistency";
  return options.find((option) => option.warning)?.label ?? options[0]?.label ?? "Measurement consistency";
}

function risk(input: PhysiqueEngineInput, trends: { waistTrend: PhysiqueTrend; bodyFatTrend: PhysiqueTrend; leanMassTrend: LeanMassTrend }) {
  if (input.strengthTrend === "Declining") return "Strength regression";
  if (trends.leanMassTrend === "Decreasing") return "Lean mass loss";
  if (trends.waistTrend === "Up" || trends.bodyFatTrend === "Up") return "Body fat increase";
  if ((input.workoutAdherence ?? 100) < 60) return "Low workout adherence";
  if ((input.proteinAdherence ?? 100) < 60) return "Low protein adherence";
  return "Measurement inconsistency";
}

export function evaluatePhysique(input: PhysiqueEngineInput): PhysiqueEngineResult {
  const bodyFatPercent = navyBodyFatPercent(input.weight, input.waist, input.neck, input.height);
  const leanMass = leanMassFrom(input.weight, bodyFatPercent);
  const priorBodyFatPercent = navyBodyFatPercent(input.priorWeight, input.priorWaist, input.priorNeck, input.height);
  const priorLeanMass = leanMassFrom(input.priorWeight, priorBodyFatPercent);
  const bodyFatDelta = bodyFatPercent !== null && priorBodyFatPercent !== null ? round(bodyFatPercent - priorBodyFatPercent, 1) : null;
  const waistDelta = isPositive(input.waist) && isPositive(input.priorWaist) ? round(input.waist - input.priorWaist, 1) : null;
  const leanMassDelta = leanMass !== null && priorLeanMass !== null ? round(leanMass - priorLeanMass, 1) : null;

  const bodyFatTrend = trendFromDelta(bodyFatDelta, 0.5);
  const waistTrend = trendFromDelta(waistDelta, 0.5);
  const leanMassTrend = leanTrendFromDelta(leanMassDelta);
  const hasCurrentMeasurements = bodyFatPercent !== null && leanMass !== null;

  const trendComponent = scoreTrend(bodyFatTrend) * 0.2 + scoreTrend(waistTrend) * 0.2 + scoreLeanTrend(leanMassTrend) * 0.2;
  const adherenceComponent = scoreAdherence(input.proteinAdherence) * 0.15 + scoreAdherence(input.workoutAdherence) * 0.15;
  const strengthComponent = scoreStrength(input.strengthTrend) * 0.1;
  const physiqueScore = hasCurrentMeasurements ? Math.round(clamp(trendComponent + adherenceComponent + strengthComponent)) : 0;

  const physiqueStatus = decideStatus({
    sufficient: hasCurrentMeasurements,
    bodyFatTrend,
    waistTrend,
    leanMassTrend,
    proteinAdherence: input.proteinAdherence,
    workoutAdherence: input.workoutAdherence,
    strengthTrend: input.strengthTrend,
    score: physiqueScore,
  });
  const confidence = decideConfidence(input, hasCurrentMeasurements);
  const primaryOpportunity = opportunity(input, physiqueStatus);
  const primaryRisk = physiqueStatus === "Insufficient Data" ? "Sparse physique data" : risk(input, { waistTrend, bodyFatTrend, leanMassTrend });
  const warnings: string[] = [];
  if (!hasCurrentMeasurements) warnings.push("Need weight, waist, neck, and height to estimate physique." );
  if ((input.proteinAdherence ?? 100) < 70) warnings.push("Protein adherence is limiting physique improvement.");
  if ((input.workoutAdherence ?? 100) < 70) warnings.push("Workout adherence is limiting lean-mass retention signals.");
  if (waistTrend === "Up") warnings.push("Waist measurement is increasing.");
  if (leanMassTrend === "Decreasing") warnings.push("Estimated lean mass is decreasing.");

  const summary = physiqueStatus === "Insufficient Data"
    ? "Need more measurements before estimating physique trend."
    : `Physique is ${physiqueStatus.toLowerCase()}. Body fat trend: ${bodyFatTrend}. Waist trend: ${waistTrend}. Lean mass trend: ${leanMassTrend}. Primary opportunity: ${primaryOpportunity}. Primary risk: ${primaryRisk}.`;

  const auditTrail: PhysiqueAuditEntry[] = [
    {
      id: "physique-body-fat-estimate",
      decision: "body_fat_estimate",
      score: bodyFatPercent,
      reason: bodyFatPercent === null ? "Navy male body fat estimate unavailable because required measurements are missing." : `Navy male estimate is ${bodyFatPercent}% from waist ${input.waist}, neck ${input.neck}, and height ${input.height}.`,
      dataUsed: ["weight", "waist", "neck", "height"],
    },
    {
      id: "physique-trend-analysis",
      decision: "trend_analysis",
      score: null,
      reason: `Body fat trend ${bodyFatTrend}; waist trend ${waistTrend}; lean mass trend ${leanMassTrend}; Strength trend ${input.strengthTrend ?? "Insufficient Data"}.`,
      dataUsed: ["current_measurements", "prior_measurements", "strengthTrend"],
    },
    {
      id: "physique-score",
      decision: "score",
      score: physiqueScore,
      reason: `Score combines body fat trend, waist trend, lean mass retention, protein adherence ${input.proteinAdherence ?? "missing"}, workout adherence ${input.workoutAdherence ?? "missing"}, and strength trend ${input.strengthTrend ?? "missing"}.`,
      dataUsed: ["bodyFatTrend", "waistTrend", "leanMassTrend", "proteinAdherence", "workoutAdherence", "strengthTrend"],
    },
    {
      id: "physique-status",
      decision: "status",
      score: physiqueScore,
      reason: `Status ${physiqueStatus} chosen from measurement trends, lean mass trend, adherence, and strength trend.`,
      dataUsed: ["physiqueScore", "bodyFatTrend", "waistTrend", "leanMassTrend"],
    },
    {
      id: "physique-confidence",
      decision: "confidence",
      score: confidence === "High" ? 90 : confidence === "Medium" ? 60 : 30,
      reason: `Confidence ${confidence} chosen from current measurements, prior measurements, photo count ${input.photoCount ?? 0}, photo consistency ${input.photoConsistency ?? 0}, and adherence data availability.`,
      dataUsed: ["measurements", "priorMeasurements", "photoCount", "photoConsistency", "adherence"],
    },
  ];

  return {
    physiqueStatus,
    confidence,
    physiqueScore,
    bodyFatPercent,
    leanMass,
    bodyFatTrend,
    waistTrend,
    leanMassTrend,
    primaryOpportunity,
    primaryRisk,
    summary,
    warnings,
    auditTrail,
  };
}

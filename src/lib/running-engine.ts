export type RunningConfidence = "High" | "Medium" | "Low";
export type RunningTrend = "improving" | "stable" | "declining" | "unknown";
export type RunningProgressionAction = "Progress" | "Hold" | "Regress" | "Recovery Focus";
export type RunningGoalStatusLabel = "On Track" | "At Risk" | "Off Track";
export type RunningStatusLabel = "strong" | "adequate" | "watch" | "problem" | "unknown";

export interface RunningExplanation {
  summary: string;
  primaryDrivers: string[];
  blockers: string[];
  supportingSignals: string[];
  tradeoffs: string[];
}

export interface RunningAuditEntry {
  id: string;
  timestamp: string;
  decisionType:
    | "running-readiness"
    | "progression"
    | "prediction"
    | "injury-risk"
    | "pace-zone"
    | "goal-status";
  action: string;
  reason: string;
  dataUsed: string[];
  thresholdsApplied: string[];
  confidence: RunningConfidence;
  dataQualityScore: number;
}

export interface RunningEngineInput {
  generatedAt: string;
  evaluationDate: string;
  race: {
    raceDate: string;
    targetFinishMinutes: number;
    targetPaceSecondsPerMile: number;
    distanceMiles: number;
  };
  runLogs: Array<{
    id: string;
    date: string;
    runType?: "easy" | "long run" | "tempo" | "interval" | "recovery" | "race" | string;
    plannedDistance: number;
    actualDistance: number;
    durationMinutes: number;
    averagePace?: number;
    averagePaceSecondsPerMile?: number;
    averageHr?: number;
    maxHr?: number;
    rpe: number;
    zone2Compliance?: number;
    completed: boolean;
    walkBreaks?: boolean;
    pain?: boolean;
    painScore?: number;
    painLocation?: string;
    notes?: string;
  }>;
  currentWeek: {
    startDate: string;
    endDate: string;
    weeklyMileage?: number;
    rolling7DayMileage?: number;
    plannedWeeklyMileage?: number;
    previousWeeklyMileage?: number;
    runningDaysPlanned?: number;
    runningDaysCompleted?: number;
  };
  readiness: {
    status?: "Green" | "Yellow" | "Red";
    score?: number;
    confidence?: RunningConfidence;
    averageSleep?: number;
    averageSoreness?: number;
    averageStress?: number;
    averageEnergy?: number;
  };
  trends?: {
    paceTrend?: RunningTrend;
    heartRateTrend?: RunningTrend;
    rpeTrend?: RunningTrend;
    painTrend?: RunningTrend;
    mileageTrend?: RunningTrend;
    longRunTrend?: RunningTrend;
  };
  userContext?: {
    age?: number;
    bodyWeight?: number;
    experienceLevel?: "beginner" | "intermediate" | "advanced";
    injuryHistory?: string;
  };
}

export interface RunningFitnessProfile {
  weeklyMileage: number;
  rolling7DayMileage: number;
  previousWeeklyMileage?: number;
  mileageChangePercent?: number;
  longestRecentRunMiles: number;
  longRunCompletionRate: number;
  runningConsistency: number;
  recentAveragePaceSecondsPerMile?: number;
  recentAverageHr?: number;
  recentAverageRpe?: number;
  paceTrend: RunningTrend;
  heartRateTrend: RunningTrend;
  rpeTrend: RunningTrend;
  painTrend: RunningTrend;
}

export interface RunningReadiness {
  status: "Green" | "Yellow" | "Red";
  score: number;
  reasons: string[];
  blockers: string[];
  injuryRiskScore: number;
  raceReadinessScore: number;
  confidence: RunningConfidence;
}

export interface RunningProgressionDecision {
  action: RunningProgressionAction;
  recommendedWeeklyMileage?: number;
  recommendedLongRunDistance?: number;
  recommendedRunFrequency?: number;
  intensityGuidance: "normal" | "zone-2-only" | "hold-intensity" | "reduce-intensity" | "no-running";
  paceGuidance: string;
  reason: string;
  explanation: RunningExplanation;
  confidence: RunningConfidence;
  dataQualityScore: number;
}

export interface RunningGoalStatus {
  raceCompletion: RunningGoalStatusItem;
  targetFinishTime: RunningGoalStatusItem;
  targetPace: RunningGoalStatusItem;
  longRunBuild: RunningGoalStatusItem;
  mileageBuild: RunningGoalStatusItem;
  injuryPrevention: RunningGoalStatusItem;
}

export interface RunningGoalStatusItem {
  status: RunningGoalStatusLabel;
  score: number;
  currentSignal: string;
  targetSignal: string;
  reason: string;
  confidence: RunningConfidence;
}

export type RunningPredictionBasis = "recent-race" | "long-run" | "tempo" | "easy-run-adjusted" | "insufficient-data";

export interface RunningPrediction {
  predictedFinishMinutes: number | null;
  predictedFinishTime: string | null;
  predictedPaceSecondsPerMile: number | null;
  predictedPaceLabel: string | null;
  targetFinishMinutes: number;
  targetFinishTime: string;
  targetPaceSecondsPerMile: number;
  targetPaceLabel: string;
  targetFinishGapMinutes: number | null;
  targetFinishGapLabel: string | null;
  targetPaceGapSecondsPerMile: number | null;
  targetPaceGapLabel: string | null;
  predictionBasis: RunningPredictionBasis;
  confidence: RunningConfidence;
}

export interface RunningStatusSummary {
  status: RunningStatusLabel;
  value: string;
  target: string;
  reason: string;
}

export interface RunningPaceZones {
  zone2: RunningPaceZone;
  tempo: RunningPaceZone;
  threshold: RunningPaceZone;
  racePace: RunningPaceZone;
  vo2: RunningPaceZone;
}

export interface RunningPaceZone {
  name: "Zone 2" | "Tempo" | "Threshold" | "Race Pace" | "VO2";
  paceRangeSecondsPerMile: {
    min: number;
    max: number;
  };
  paceRangeLabel: string;
  effortCue: string;
  rpeRange: string;
  purpose: string;
}

export interface RunningEngineResult {
  generatedAt: string;
  evaluationDate: string;
  fitnessProfile: RunningFitnessProfile;
  readiness: RunningReadiness;
  progression: RunningProgressionDecision;
  goalStatus: RunningGoalStatus;
  prediction: RunningPrediction;
  paceZones: RunningPaceZones;
  currentPredictedFinishTime: string;
  currentPredictedPace: string;
  targetPaceGap: string;
  targetFinishGap: string;
  longRunStatus: RunningStatusSummary;
  weeklyMileageStatus: RunningStatusSummary;
  runningReadiness: RunningReadiness;
  runningConfidenceScore: number;
  runningDataQualityScore: number;
  confidence: RunningConfidence;
  confidenceScore: number;
  dataQualityScore: number;
  explanations: RunningExplanation[];
  auditTrail: RunningAuditEntry[];
}

type Run = RunningEngineInput["runLogs"][number];

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round0 = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;
const safeRuns = (input: RunningEngineInput) => [...(input.runLogs ?? [])].filter((run) => run.actualDistance >= 0).sort((a, b) => a.date.localeCompare(b.date));
const confidenceFromScore = (score: number): RunningConfidence => score >= 85 ? "High" : score >= 65 ? "Medium" : "Low";

function paceSeconds(run: Run): number | undefined {
  if (Number.isFinite(run.averagePaceSecondsPerMile) && (run.averagePaceSecondsPerMile ?? 0) > 0) return run.averagePaceSecondsPerMile;
  if (Number.isFinite(run.averagePace) && (run.averagePace ?? 0) > 0) return Math.round((run.averagePace ?? 0) * 60);
  if (run.actualDistance > 0 && run.durationMinutes > 0) return Math.round((run.durationMinutes / run.actualDistance) * 60);
  return undefined;
}

function labelPace(seconds: number | null | undefined) {
  if (!Number.isFinite(seconds ?? NaN) || seconds == null) return null;
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}/mile`;
}

function labelTime(minutes: number | null | undefined) {
  if (!Number.isFinite(minutes ?? NaN) || minutes == null) return null;
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return hours > 0 ? `${hours}:${String(mins).padStart(2, "0")}` : `${mins} min`;
}

function recentRuns(input: RunningEngineInput, count = 8) {
  return safeRuns(input).slice(-count);
}

function longRuns(input: RunningEngineInput) {
  return safeRuns(input).filter((run) => /long/i.test(run.runType ?? "") || run.plannedDistance >= 5 || run.actualDistance >= 5);
}

function trendFromNumbers(values: number[], improvingWhenLower = false): RunningTrend {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 2) return "unknown";
  const first = clean.slice(0, Math.ceil(clean.length / 2)).reduce((sum, value) => sum + value, 0) / Math.ceil(clean.length / 2);
  const secondValues = clean.slice(Math.floor(clean.length / 2));
  const second = secondValues.reduce((sum, value) => sum + value, 0) / secondValues.length;
  const delta = second - first;
  if (Math.abs(delta) < 0.15) return "stable";
  if (improvingWhenLower) return delta < 0 ? "improving" : "declining";
  return delta > 0 ? "improving" : "declining";
}

function calculateFitnessProfile(input: RunningEngineInput): RunningFitnessProfile {
  const runs = recentRuns(input);
  const completed = runs.filter((run) => run.completed && run.actualDistance > 0);
  const weeklyMileage = input.currentWeek.weeklyMileage ?? round1(runs.reduce((sum, run) => sum + run.actualDistance, 0));
  const rolling7DayMileage = input.currentWeek.rolling7DayMileage ?? weeklyMileage;
  const previousWeeklyMileage = input.currentWeek.previousWeeklyMileage;
  const mileageChangePercent = previousWeeklyMileage && previousWeeklyMileage > 0 ? round1(((weeklyMileage - previousWeeklyMileage) / previousWeeklyMileage) * 100) : undefined;
  const paceValues = completed.map(paceSeconds).filter((value): value is number => value !== undefined);
  const hrValues = completed.map((run) => run.averageHr).filter((value): value is number => value !== undefined && Number.isFinite(value));
  const rpeValues = completed.map((run) => run.rpe).filter(Number.isFinite);
  const painValues = runs.map((run) => run.painScore ?? (run.pain ? 7 : 0));
  const longRunList = longRuns(input);
  const completedLongRuns = longRunList.filter((run) => run.completed && run.actualDistance >= Math.max(1, run.plannedDistance * 0.9) && (run.painScore ?? 0) < 7);
  const planned = input.currentWeek.runningDaysPlanned ?? runs.length;
  const done = input.currentWeek.runningDaysCompleted ?? completed.length;

  return {
    weeklyMileage,
    rolling7DayMileage,
    previousWeeklyMileage,
    mileageChangePercent,
    longestRecentRunMiles: round1(Math.max(0, ...longRunList.map((run) => run.actualDistance), ...completed.map((run) => run.actualDistance))),
    longRunCompletionRate: longRunList.length ? round0((completedLongRuns.length / longRunList.length) * 100) : 0,
    runningConsistency: planned > 0 ? clamp(round0((done / planned) * 100)) : completed.length ? 100 : 0,
    recentAveragePaceSecondsPerMile: paceValues.length ? round0(paceValues.reduce((sum, value) => sum + value, 0) / paceValues.length) : undefined,
    recentAverageHr: hrValues.length ? round0(hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length) : undefined,
    recentAverageRpe: rpeValues.length ? round1(rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) : undefined,
    paceTrend: input.trends?.paceTrend ?? trendFromNumbers(paceValues, true),
    heartRateTrend: input.trends?.heartRateTrend ?? trendFromNumbers(hrValues, true),
    rpeTrend: input.trends?.rpeTrend ?? trendFromNumbers(rpeValues, true),
    painTrend: input.trends?.painTrend ?? trendFromNumbers(painValues, true),
  };
}

export function calculateDataQualityScore(input: RunningEngineInput): number {
  const runs = safeRuns(input);
  const recent = recentRuns(input);
  const longRunList = longRuns(input);
  const hasMileage = Number.isFinite(input.currentWeek.weeklyMileage) || runs.length > 0;
  const hasRolling = Number.isFinite(input.currentWeek.rolling7DayMileage) || runs.length > 0;
  const completeRunFields = recent.length ? recent.filter((run) => run.actualDistance > 0 && run.durationMinutes > 0 && Number.isFinite(run.rpe)).length / recent.length : 0;
  const runLogCompleteness = (hasMileage && hasRolling ? 10 : hasMileage || hasRolling ? 6 : 0) + completeRunFields * 15;
  const recency = recent.length ? 20 : 0;
  const longRunData = longRunList.length ? 20 : 0;
  const withPace = recent.filter((run) => paceSeconds(run) !== undefined).length;
  const withHr = recent.filter((run) => Number.isFinite(run.averageHr)).length;
  const withRpe = recent.filter((run) => Number.isFinite(run.rpe)).length;
  const paceHrRpeData = recent.length ? ((withPace / recent.length) * 7 + (withHr / recent.length) * 6 + (withRpe / recent.length) * 7) : 0;
  const withPain = recent.filter((run) => run.pain !== undefined || run.painScore !== undefined).length;
  const readinessPainData = (input.readiness.status ? 7 : 0) + (recent.length ? (withPain / recent.length) * 8 : 0);
  const raceDate = input.race.raceDate ? 0 : -10;
  return clamp(round0(runLogCompleteness + recency + longRunData + paceHrRpeData + readinessPainData + raceDate));
}

export function calculateInjuryRisk(input: RunningEngineInput): number {
  const runs = recentRuns(input);
  const fitness = calculateFitnessProfile(input);
  const maxPain = runs.reduce((max, run) => Math.max(max, run.painScore ?? (run.pain ? 7 : 0)), 0);
  const recurringPain = runs.filter((run) => (run.painScore ?? (run.pain ? 7 : 0)) >= 4).length;
  const painScoreComponent = clamp(maxPain >= 7 ? 100 : maxPain * 11 + recurringPain * 12);
  const mileageJump = fitness.mileageChangePercent ?? 0;
  const mileageJumpComponent = clamp(mileageJump <= 10 ? Math.max(0, mileageJump * 2) : mileageJump <= 20 ? 35 + (mileageJump - 10) * 4 : 75 + (mileageJump - 20) * 2);
  const avgRpe = fitness.recentAverageRpe ?? 0;
  const poorRuns = runs.filter((run) => !run.completed || run.rpe >= 8 || (run.walkBreaks ?? false)).length;
  const rpeComponent = clamp(avgRpe <= 6 ? avgRpe * 4 : 35 + (avgRpe - 6) * 18 + poorRuns * 8);
  const heartRateDriftComponent = fitness.paceTrend === "declining" && fitness.heartRateTrend === "declining" ? 80 : fitness.heartRateTrend === "declining" ? 45 : 15;
  const readinessComponent = input.readiness.status === "Red" ? 100 : input.readiness.status === "Yellow" ? 55 : input.readiness.status === "Green" ? 10 : 45;
  const consistencyGapComponent = clamp(100 - fitness.runningConsistency);
  return clamp(round0(
    painScoreComponent * 0.35 +
    mileageJumpComponent * 0.20 +
    rpeComponent * 0.15 +
    heartRateDriftComponent * 0.10 +
    readinessComponent * 0.10 +
    consistencyGapComponent * 0.10,
  ));
}

export function calculatePredictedHalfMarathonTime(input: RunningEngineInput): RunningPrediction {
  const runs = safeRuns(input).filter((run) => run.completed && run.actualDistance > 0 && run.durationMinutes > 0);
  const targetFinishMinutes = input.race.targetFinishMinutes || 118;
  const targetPaceSecondsPerMile = input.race.targetPaceSecondsPerMile || 540;
  const raceDistance = input.race.distanceMiles || 13.1;
  let basis: RunningPredictionBasis = "insufficient-data";
  let predictedPaceSecondsPerMile: number | null = null;
  let confidence: RunningConfidence = "Low";

  const recentRace = [...runs].reverse().find((run) => /race|time trial/i.test(run.runType ?? "") && run.actualDistance >= 3);
  const tempo = [...runs].reverse().find((run) => /tempo|threshold/i.test(run.runType ?? "") && run.actualDistance >= 3 && run.rpe <= 8);
  const longRun = [...longRuns(input)].reverse().find((run) => run.completed && run.actualDistance > 0 && run.durationMinutes > 0 && run.rpe <= 7);
  const easyRuns = runs.filter((run) => /easy|recovery/i.test(run.runType ?? "") || !run.runType);

  if (recentRace) {
    basis = "recent-race";
    const projected = recentRace.durationMinutes * Math.pow(raceDistance / recentRace.actualDistance, 1.06);
    predictedPaceSecondsPerMile = round0((projected / raceDistance) * 60);
    confidence = recentRace.actualDistance >= 6 ? "High" : "Medium";
  } else if (tempo) {
    basis = "tempo";
    const pace = paceSeconds(tempo) ?? (tempo.durationMinutes / tempo.actualDistance) * 60;
    predictedPaceSecondsPerMile = round0(pace + 10);
    confidence = "Medium";
  } else if (longRun) {
    basis = "long-run";
    const pace = paceSeconds(longRun) ?? (longRun.durationMinutes / longRun.actualDistance) * 60;
    const adjustment = longRun.actualDistance >= 8 ? 30 : 0;
    predictedPaceSecondsPerMile = round0(Math.max(1, pace - adjustment));
    confidence = longRun.actualDistance >= 8 ? "Medium" : "Low";
  } else if (easyRuns.length) {
    basis = "easy-run-adjusted";
    const paces = easyRuns.map(paceSeconds).filter((value): value is number => value !== undefined);
    const averageEasyPace = paces.length ? paces.reduce((sum, pace) => sum + pace, 0) / paces.length : null;
    if (averageEasyPace) predictedPaceSecondsPerMile = round0(Math.max(1, averageEasyPace - 60));
    confidence = "Low";
  }

  const predictedFinishMinutes = predictedPaceSecondsPerMile == null ? null : round1((predictedPaceSecondsPerMile * raceDistance) / 60);
  const targetFinishGapMinutes = predictedFinishMinutes == null ? null : round1(predictedFinishMinutes - targetFinishMinutes);
  const targetPaceGapSecondsPerMile = predictedPaceSecondsPerMile == null ? null : round0(predictedPaceSecondsPerMile - targetPaceSecondsPerMile);
  return {
    predictedFinishMinutes,
    predictedFinishTime: labelTime(predictedFinishMinutes),
    predictedPaceSecondsPerMile,
    predictedPaceLabel: labelPace(predictedPaceSecondsPerMile),
    targetFinishMinutes,
    targetFinishTime: labelTime(targetFinishMinutes) ?? "1:58",
    targetPaceSecondsPerMile,
    targetPaceLabel: labelPace(targetPaceSecondsPerMile) ?? "9:00/mile",
    targetFinishGapMinutes,
    targetFinishGapLabel: targetFinishGapMinutes == null ? null : `${targetFinishGapMinutes >= 0 ? "+" : ""}${targetFinishGapMinutes} min vs target`,
    targetPaceGapSecondsPerMile,
    targetPaceGapLabel: targetPaceGapSecondsPerMile == null ? null : `${targetPaceGapSecondsPerMile >= 0 ? "+" : ""}${targetPaceGapSecondsPerMile} sec/mi vs target`,
    predictionBasis: basis,
    confidence,
  };
}

export function calculatePredictedRacePace(input: RunningEngineInput): number | null {
  return calculatePredictedHalfMarathonTime(input).predictedPaceSecondsPerMile;
}

export function calculateRaceReadiness(input: RunningEngineInput): number {
  const fitness = calculateFitnessProfile(input);
  const prediction = calculatePredictedHalfMarathonTime(input);
  const injuryRisk = calculateInjuryRisk(input);
  const longRunScore = clamp((fitness.longestRecentRunMiles / Math.max(1, input.race.distanceMiles * 0.75)) * 100);
  const weeklyMileageScore = clamp((fitness.weeklyMileage / 25) * 100 - Math.max(0, (fitness.mileageChangePercent ?? 0) - 10) * 2);
  const consistencyScore = fitness.runningConsistency;
  const paceGap = prediction.targetPaceGapSecondsPerMile;
  const paceReadinessScore = paceGap == null ? 40 : clamp(100 - Math.max(0, paceGap) * 0.8);
  const recoveryScore = clamp((input.readiness.score ?? (input.readiness.status === "Green" ? 80 : input.readiness.status === "Yellow" ? 60 : input.readiness.status === "Red" ? 35 : 55)) - injuryRisk * 0.25);
  return clamp(round0(
    longRunScore * 0.35 +
    weeklyMileageScore * 0.25 +
    consistencyScore * 0.15 +
    paceReadinessScore * 0.15 +
    recoveryScore * 0.10,
  ));
}

export function calculateRunningReadiness(input: RunningEngineInput): RunningReadiness {
  const injuryRiskScore = calculateInjuryRisk(input);
  const raceReadinessScore = calculateRaceReadiness(input);
  let score = input.readiness.score ?? (input.readiness.status === "Green" ? 82 : input.readiness.status === "Yellow" ? 62 : input.readiness.status === "Red" ? 35 : 55);
  score = clamp(score - Math.max(0, injuryRiskScore - 45) * 0.4);
  const reasons: string[] = [];
  const blockers: string[] = [];
  if (input.readiness.status) reasons.push(`Readiness status is ${input.readiness.status}.`);
  if ((input.readiness.averageSleep ?? 7) < 6.5) reasons.push("Sleep is below the preferred running recovery floor.");
  if (injuryRiskScore >= 50) blockers.push("Injury risk is elevated enough to block aggressive progression.");
  if (injuryRiskScore >= 70) blockers.push("Severe injury risk overrides running progression.");
  if (raceReadinessScore >= 70) reasons.push("Race-readiness signals are adequate for the current build.");
  else reasons.push("Race-readiness signals need more consistent long-run and mileage data.");
  const status: RunningReadiness["status"] = injuryRiskScore >= 70 || input.readiness.status === "Red" ? "Red" : score >= 70 && input.readiness.status !== "Yellow" ? "Green" : "Yellow";
  return {
    status,
    score: round0(score),
    reasons,
    blockers,
    injuryRiskScore,
    raceReadinessScore,
    confidence: input.readiness.confidence ?? confidenceFromScore(calculateConfidenceScore(input)),
  };
}

export function calculateConfidenceScore(input: RunningEngineInput): number {
  const dataQualityScore = calculateDataQualityScore(input);
  const fitness = calculateFitnessProfile(input);
  const injuryRisk = calculateInjuryRisk(input);
  const signals = [fitness.paceTrend, fitness.heartRateTrend, fitness.rpeTrend, fitness.painTrend];
  let signalAgreementScore = 60;
  if (fitness.longRunCompletionRate > 0 && injuryRisk < 35 && input.readiness.status === "Green") signalAgreementScore = 90;
  else if (signals.includes("declining") && signals.includes("improving")) signalAgreementScore = 55;
  else if (injuryRisk >= 70) signalAgreementScore = 70;
  const runs = safeRuns(input);
  const recencyScore = runs.length ? 90 : 20;
  return clamp(round0(dataQualityScore * 0.55 + signalAgreementScore * 0.25 + recencyScore * 0.20));
}

export function calculatePaceZones(input: { racePaceSecondsPerMile: number; confidence?: RunningConfidence }): RunningPaceZones {
  const racePace = Math.round(input.racePaceSecondsPerMile || 540);
  const zone = (name: RunningPaceZone["name"], min: number, max: number, effortCue: string, rpeRange: string, purpose: string): RunningPaceZone => ({
    name,
    paceRangeSecondsPerMile: { min: racePace + min, max: racePace + max },
    paceRangeLabel: `${labelPace(racePace + min)?.replace("/mile", "")} - ${labelPace(racePace + max)}`,
    effortCue,
    rpeRange,
    purpose,
  });
  return {
    zone2: zone("Zone 2", 90, 150, "Conversational, controlled, able to speak in full sentences.", "3-5", "Aerobic base and low-risk mileage."),
    tempo: zone("Tempo", 20, 45, "Comfortably hard but sustainable.", "6-7", "Sustained aerobic power."),
    threshold: zone("Threshold", -5, 15, "Hard but controlled, not a sprint.", "7-8", "Lactate-threshold development."),
    racePace: zone("Race Pace", -5, 5, "Specific half-marathon pace rehearsal.", "6-7", "Practice the 1:58 / 9:00 per mile goal pace."),
    vo2: zone("VO2", -45, -20, "Fast intervals only when recovery and injury risk allow.", "8-9", "Top-end speed and VO2 stimulus."),
  };
}

function longRunStatus(input: RunningEngineInput): RunningStatusSummary {
  const longRunList = longRuns(input);
  const latest = longRunList.at(-1);
  if (!latest) return { status: "unknown", value: "No long run logged", target: "Complete weekly long run", reason: "Long-run data is missing." };
  const painScore = latest.painScore ?? (latest.pain ? 7 : 0);
  const completed = latest.completed && latest.actualDistance >= Math.max(1, latest.plannedDistance * 0.9);
  if (!completed && painScore >= 4) return { status: "problem", value: `${latest.actualDistance} mi`, target: `${latest.plannedDistance} mi`, reason: "Long run failed with pain or meaningful limitation." };
  if (!completed || latest.rpe >= 8 || latest.walkBreaks || painScore >= 4) return { status: "watch", value: `${latest.actualDistance} mi`, target: `${latest.plannedDistance} mi`, reason: "Long run was missed, shortened, high effort, or had minor pain." };
  if (latest.rpe <= 6 && painScore === 0) return { status: "strong", value: `${latest.actualDistance} mi`, target: `${latest.plannedDistance} mi`, reason: "Long run completed with controlled RPE and no pain." };
  return { status: "adequate", value: `${latest.actualDistance} mi`, target: `${latest.plannedDistance} mi`, reason: "Long run completed with manageable fatigue." };
}

function weeklyMileageStatus(input: RunningEngineInput, fitness = calculateFitnessProfile(input)): RunningStatusSummary {
  if (!safeRuns(input).length && !input.currentWeek.weeklyMileage) return { status: "unknown", value: "No mileage", target: "Build consistent weekly mileage", reason: "Mileage data is missing." };
  const change = fitness.mileageChangePercent ?? 0;
  if (change > 20) return { status: "problem", value: `${fitness.weeklyMileage} mi`, target: "<=20% weekly jump", reason: "Weekly mileage jumped too sharply." };
  if (change > 10 || fitness.runningConsistency < 70) return { status: "watch", value: `${fitness.weeklyMileage} mi`, target: "<=10% weekly jump", reason: "Mileage progression or consistency needs caution." };
  if (fitness.runningConsistency >= 90 && change >= 0 && change <= 10) return { status: "strong", value: `${fitness.weeklyMileage} mi`, target: `${input.currentWeek.plannedWeeklyMileage ?? fitness.weeklyMileage} mi`, reason: "Mileage is consistent and progressing within conservative limits." };
  return { status: "adequate", value: `${fitness.weeklyMileage} mi`, target: `${input.currentWeek.plannedWeeklyMileage ?? fitness.weeklyMileage} mi`, reason: "Weekly mileage is usable without major red flags." };
}

function statusFromScore(score: number): RunningGoalStatusLabel {
  return score >= 75 ? "On Track" : score >= 50 ? "At Risk" : "Off Track";
}

function buildGoalStatus(input: RunningEngineInput, prediction: RunningPrediction, readiness: RunningReadiness, fitness: RunningFitnessProfile): RunningGoalStatus {
  const confidence = confidenceFromScore(calculateConfidenceScore(input));
  const raceCompletionScore = readiness.raceReadinessScore;
  const paceScore = prediction.targetPaceGapSecondsPerMile == null ? 45 : clamp(100 - Math.max(0, prediction.targetPaceGapSecondsPerMile) * 0.8);
  const finishScore = prediction.targetFinishGapMinutes == null ? 45 : clamp(100 - Math.max(0, prediction.targetFinishGapMinutes) * 3);
  const longRunScore = clamp((fitness.longestRecentRunMiles / Math.max(1, input.race.distanceMiles * 0.75)) * 100);
  const mileageScore = clamp((fitness.weeklyMileage / 25) * 100);
  const injuryScore = clamp(100 - readiness.injuryRiskScore);
  const item = (score: number, currentSignal: string, targetSignal: string, reason: string): RunningGoalStatusItem => ({
    status: statusFromScore(score),
    score: round0(score),
    currentSignal,
    targetSignal,
    reason,
    confidence,
  });
  return {
    raceCompletion: item(raceCompletionScore, `${readiness.raceReadinessScore}/100 race readiness`, "Safely complete Jan 17 half marathon", "Race completion depends on long-run build, weekly volume, consistency, and recovery."),
    targetFinishTime: item(finishScore, prediction.predictedFinishTime ?? "Unknown", "1:58", "Finish goal uses the current half-marathon prediction gap."),
    targetPace: item(paceScore, prediction.predictedPaceLabel ?? "Unknown", "9:00/mile", "Pace goal uses the current predicted race pace gap."),
    longRunBuild: item(longRunScore, `${fitness.longestRecentRunMiles} mi`, "Build toward 13.1 mi", "Long-run build is the most important completion signal."),
    mileageBuild: item(mileageScore, `${fitness.weeklyMileage} mi/week`, "Sustainable weekly mileage", "Mileage supports the long-run and pace goals when progressed conservatively."),
    injuryPrevention: item(injuryScore, `${readiness.injuryRiskScore}/100 risk`, "Low injury risk", "Injury prevention overrides aggressive race progression."),
  };
}

export function generateRunningExplanation(input: {
  input: RunningEngineInput;
  action: RunningProgressionAction;
  fitnessProfile: RunningFitnessProfile;
  readiness: RunningReadiness;
  prediction: RunningPrediction;
  longRunStatus: RunningStatusSummary;
  weeklyMileageStatus: RunningStatusSummary;
}): RunningExplanation {
  const primaryDrivers: string[] = [];
  const blockers: string[] = [...input.readiness.blockers];
  const supportingSignals: string[] = [];
  const tradeoffs: string[] = ["Use conservative running progression because injury prevention and fat-loss recovery cost both matter."];
  primaryDrivers.push(`Long run status is ${input.longRunStatus.status}.`);
  primaryDrivers.push(`Weekly mileage status is ${input.weeklyMileageStatus.status}.`);
  primaryDrivers.push(`Readiness is ${input.readiness.status}.`);
  if (input.prediction.predictedPaceLabel) supportingSignals.push(`Predicted pace is ${input.prediction.predictedPaceLabel}.`);
  if (input.fitnessProfile.mileageChangePercent !== undefined) supportingSignals.push(`Weekly mileage change is ${input.fitnessProfile.mileageChangePercent}%.`);
  if (input.fitnessProfile.runningConsistency >= 80) supportingSignals.push("Running consistency is adequate.");
  if (input.action !== "Progress") blockers.push(`${input.action} selected instead of Progress to manage running risk.`);
  const summary = input.action === "Progress"
    ? "Running can progress because long-run, readiness, pain, and mileage signals are clean enough."
    : input.action === "Hold"
      ? "Running should hold because one or more readiness, long-run, mileage, data-quality, or consistency signals are not strong enough to progress."
      : input.action === "Regress"
        ? "Running should regress because injury, quality, mileage, or recovery signals show elevated risk."
        : "Running should shift to Recovery Focus because safety signals override race progression.";
  return { summary, primaryDrivers, blockers, supportingSignals, tradeoffs };
}

function chooseProgression(input: RunningEngineInput, fitness: RunningFitnessProfile, readiness: RunningReadiness, prediction: RunningPrediction, dataQualityScore: number, confidence: RunningConfidence, longStatus: RunningStatusSummary, mileageStatus: RunningStatusSummary): RunningProgressionDecision {
  const runs = recentRuns(input);
  const maxPain = runs.reduce((max, run) => Math.max(max, run.painScore ?? (run.pain ? 7 : 0)), 0);
  const latestPoorRuns = runs.slice(-2).filter((run) => !run.completed || run.rpe >= 8 || run.walkBreaks || (run.painScore ?? (run.pain ? 7 : 0)) >= 4).length;
  const weeklyMileage = fitness.weeklyMileage;
  const longDistance = fitness.longestRecentRunMiles;
  let action: RunningProgressionAction = "Hold";
  let recommendedWeeklyMileage = weeklyMileage;
  let recommendedLongRunDistance = longDistance || undefined;
  let intensityGuidance: RunningProgressionDecision["intensityGuidance"] = "hold-intensity";
  let reason = "Hold running until enough clean signals support progression.";

  if (maxPain >= 7 || input.readiness.status === "Red" || readiness.injuryRiskScore >= 70) {
    action = "Recovery Focus";
    recommendedWeeklyMileage = Math.max(0, round1(weeklyMileage * 0.25));
    recommendedLongRunDistance = 0;
    intensityGuidance = "no-running";
    reason = "Pain severity, Red readiness, or severe injury risk overrides running progression.";
  } else if (longStatus.status === "problem" || latestPoorRuns >= 2 || readiness.injuryRiskScore >= 50 || ((fitness.mileageChangePercent ?? 0) > 20 && fitness.rpeTrend === "declining")) {
    action = "Regress";
    recommendedWeeklyMileage = round1(weeklyMileage * 0.8);
    recommendedLongRunDistance = longDistance ? round1(longDistance * 0.8) : undefined;
    intensityGuidance = "reduce-intensity";
    reason = "Running load should regress because poor run quality, pain, or load spikes raise injury risk.";
  } else if (longStatus.status === "watch" || longStatus.status === "unknown" || input.readiness.status === "Yellow" || (fitness.mileageChangePercent ?? 0) > 10 || fitness.runningConsistency < 70 || dataQualityScore < 65 || fitness.paceTrend === "unknown") {
    action = "Hold";
    intensityGuidance = "hold-intensity";
    reason = "Hold running because long-run, readiness, mileage, consistency, or data quality is not clean enough to progress.";
  } else if (longStatus.status === "strong" || longStatus.status === "adequate") {
    action = "Progress";
    recommendedWeeklyMileage = round1(Math.min(weeklyMileage * 1.1, weeklyMileage + 2));
    recommendedLongRunDistance = round1(longDistance + (longDistance >= 5 ? 1 : 0.5));
    intensityGuidance = "normal";
    reason = "Long run completed, pain is low, readiness is supportive, and mileage increase is within the 10% cap.";
  }

  const explanation = generateRunningExplanation({ input, action, fitnessProfile: fitness, readiness, prediction, longRunStatus: longStatus, weeklyMileageStatus: mileageStatus });
  return {
    action,
    recommendedWeeklyMileage,
    recommendedLongRunDistance,
    recommendedRunFrequency: input.currentWeek.runningDaysCompleted ?? input.currentWeek.runningDaysPlanned,
    intensityGuidance,
    paceGuidance: action === "Progress" ? "Keep most running Zone 2; progress distance before intensity." : action === "Recovery Focus" ? "Avoid hard running; use walking, mobility, or low-impact recovery until symptoms settle." : "Keep running easy and avoid adding speed work.",
    reason,
    explanation,
    confidence,
    dataQualityScore,
  };
}

export function generateRunningAuditEntries(result: RunningEngineResult): RunningAuditEntry[] {
  const base = {
    timestamp: result.generatedAt,
    confidence: result.confidence,
    dataQualityScore: result.dataQualityScore,
  };
  return [
    {
      ...base,
      id: `running-${result.evaluationDate}-readiness`,
      decisionType: "running-readiness",
      action: result.readiness.status,
      reason: result.readiness.reasons.join(" ") || "Readiness calculated from recovery and running risk.",
      dataUsed: ["readiness.status", "sleep", "soreness", "stress", "energy", "pain"],
      thresholdsApplied: ["Red readiness or severe injury risk blocks progression"],
    },
    {
      ...base,
      id: `running-${result.evaluationDate}-injury-risk`,
      decisionType: "injury-risk",
      action: `${result.readiness.injuryRiskScore}/100`,
      reason: "Injury risk calculated from pain, mileage jump, RPE, HR/pace trend, readiness, and consistency.",
      dataUsed: ["painScore", "mileageChangePercent", "rpeTrend", "heartRateTrend", "readiness", "runningConsistency"],
      thresholdsApplied: ["pain >= 7 severe", "weekly mileage jump >10% caution", "weekly mileage jump >20% block"],
    },
    {
      ...base,
      id: `running-${result.evaluationDate}-prediction`,
      decisionType: "prediction",
      action: result.currentPredictedFinishTime,
      reason: `Prediction basis is ${result.prediction.predictionBasis}.`,
      dataUsed: ["runLogs", "race.distanceMiles", "targetPace", "targetFinish"],
      thresholdsApplied: ["recent race > tempo > long run > easy-run adjusted > insufficient data"],
    },
    {
      ...base,
      id: `running-${result.evaluationDate}-pace-zone`,
      decisionType: "pace-zone",
      action: result.paceZones.racePace.paceRangeLabel,
      reason: "Pace zones calculated from target or predicted race pace.",
      dataUsed: ["targetPaceSecondsPerMile", "predictedPaceSecondsPerMile"],
      thresholdsApplied: ["Zone 2 = race pace +90 to +150", "Race Pace = +/-5 sec/mi"],
    },
    {
      ...base,
      id: `running-${result.evaluationDate}-goal-status`,
      decisionType: "goal-status",
      action: result.goalStatus.targetFinishTime.status,
      reason: "Goal status calculated from prediction, race readiness, mileage, long-run build, and injury risk.",
      dataUsed: ["prediction", "raceReadinessScore", "injuryRiskScore", "weeklyMileage", "longRunStatus"],
      thresholdsApplied: ["On Track >=75", "At Risk >=50", "Off Track <50"],
    },
    {
      ...base,
      id: `running-${result.evaluationDate}-progression`,
      decisionType: "progression",
      action: result.progression.action,
      reason: result.progression.reason,
      dataUsed: ["longRunStatus", "weeklyMileageStatus", "readiness", "injuryRiskScore", "dataQualityScore"],
      thresholdsApplied: ["progress requires completed long run", "weekly mileage increase <=10%", "pain >=7 forces Recovery Focus"],
    },
  ];
}

export function evaluateRunning(input: RunningEngineInput): RunningEngineResult {
  const fitnessProfile = calculateFitnessProfile(input);
  const dataQualityScore = calculateDataQualityScore(input);
  const confidenceScore = calculateConfidenceScore(input);
  const confidence = confidenceFromScore(confidenceScore);
  const prediction = calculatePredictedHalfMarathonTime(input);
  const readiness = calculateRunningReadiness(input);
  const longRun = longRunStatus(input);
  const weeklyMileage = weeklyMileageStatus(input, fitnessProfile);
  const paceSource = confidence === "Low" && prediction.predictedPaceSecondsPerMile ? prediction.predictedPaceSecondsPerMile : input.race.targetPaceSecondsPerMile;
  const paceZones = calculatePaceZones({ racePaceSecondsPerMile: paceSource || 540, confidence });
  const goalStatus = buildGoalStatus(input, prediction, readiness, fitnessProfile);
  const progression = chooseProgression(input, fitnessProfile, readiness, prediction, dataQualityScore, confidence, longRun, weeklyMileage);
  const explanations = [progression.explanation];
  const partial: RunningEngineResult = {
    generatedAt: input.generatedAt,
    evaluationDate: input.evaluationDate,
    fitnessProfile,
    readiness,
    progression,
    goalStatus,
    prediction,
    paceZones,
    currentPredictedFinishTime: prediction.predictedFinishTime ?? "Unknown",
    currentPredictedPace: prediction.predictedPaceLabel ?? "Unknown",
    targetPaceGap: prediction.targetPaceGapLabel ?? "Unknown",
    targetFinishGap: prediction.targetFinishGapLabel ?? "Unknown",
    longRunStatus: longRun,
    weeklyMileageStatus: weeklyMileage,
    runningReadiness: readiness,
    runningConfidenceScore: confidenceScore,
    runningDataQualityScore: dataQualityScore,
    confidence,
    confidenceScore,
    dataQualityScore,
    explanations,
    auditTrail: [],
  };
  return { ...partial, auditTrail: generateRunningAuditEntries(partial) };
}

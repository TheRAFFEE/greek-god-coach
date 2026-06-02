import type { RunningEngineResult, RunningProgressionAction } from "./running-engine";

export interface ProgressionRunningInputFromRunningEngineV2 {
  progressionAction: RunningProgressionAction;
  injuryRiskScore: number;
  raceReadinessScore: number;
  confidenceScore: number;
  explanations: string[];
}

export function progressionRunningInputFromRunningEngineV2(result: RunningEngineResult): ProgressionRunningInputFromRunningEngineV2 {
  return {
    progressionAction: result.progression.action,
    injuryRiskScore: result.readiness.injuryRiskScore,
    raceReadinessScore: result.readiness.raceReadinessScore,
    confidenceScore: result.confidenceScore,
    explanations: result.explanations.map((explanation) => explanation.summary),
  };
}

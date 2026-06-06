import type { Exercise, Workout } from "./types";

export type PrimarySessionType =
  | "LiftDay"
  | "RunDay"
  | "LongRunDay"
  | "RecoveryDay"
  | "MobilityDay"
  | "HybridDay"
  | "RaceDay"
  | "TestDay"
  | "DeloadDay"
  | "UnavailableDay";

export interface PrimarySessionResolution {
  dayType: PrimarySessionType;
  primaryStimulus: string;
  allowedBlocks: string[];
  forbiddenBlocks: string[];
  hybridAllowed: boolean;
  sessionStress:
    | "Recovery"
    | "Low"
    | "Moderate"
    | "High"
    | "VeryHigh";
  reasoning: string[];
}

const SUPPORT_CATEGORIES = /\b(core|mobility|recovery|nutrition|warmup|cooldown|breathing|prehab)\b/i;
const SUPPORT_TEXT = /\b(core|mobility|recovery|breathing|prehab|cooldown|warmup|stretch|walk|meal prep|hydration|sleep)\b/i;
const RUN_TEXT = /\b(run|jog|zone\s*2|tempo|threshold|interval|mile|miles|race|time trial)\b/i;
const LIFT_TEXT = /\b(strength|hypertrophy|lift|lifting|bench|press|pull-?up|row|squat|deadlift|rdl|lunge|split squat|curl|triceps|delt|chest|back|shoulder|kettlebell|swing|carry|carries|circuit|conditioning|athletic|power|jump|plyo)\b/i;
const RACE_TEXT = /\brace\b/i;
const TEST_TEXT = /\b(test|time trial|benchmark|rep max|1rm|5k test|trial)\b/i;

const EXPLICIT_HYBRID_TEXT = /\bhybrid\b|\blift\s*\+\s*run\b|\brun\s*\+\s*lift\b|\bstrength\s*\+\s*(?:zone\s*2|run)\b|\bupper\s*\+\s*(?:zone\s*2|run)\b|\blower\s*\+\s*(?:zone\s*2|run)\b/i;

function textFor(workout: Workout | undefined): string {
  if (!workout) return "";
  return `${workout.title} ${workout.type} ${workout.notes ?? ""} ${workout.finisher ?? ""}`;
}

function exerciseText(exercise: Exercise): string {
  return `${exercise.name} ${exercise.category} ${exercise.prescribedReps}`;
}

function isSupportExercise(exercise: Exercise): boolean {
  return SUPPORT_CATEGORIES.test(exercise.category) || SUPPORT_TEXT.test(exercise.name);
}

function isRunExercise(exercise: Exercise): boolean {
  return RUN_TEXT.test(exerciseText(exercise)) && !/walk/i.test(exerciseText(exercise));
}

function isResistanceExercise(exercise: Exercise): boolean {
  if (isSupportExercise(exercise) || isRunExercise(exercise)) return false;
  return LIFT_TEXT.test(exerciseText(exercise)) || /compound|accessory|power|delts|chest|arms/i.test(exercise.category);
}

function hasExplicitHybridPermission(workout: Workout): boolean {
  return EXPLICIT_HYBRID_TEXT.test(textFor(workout));
}

function longRunMiles(workout: Workout): number | null {
  if (typeof workout.longRunMiles === "number" && workout.longRunMiles > 0) return workout.longRunMiles;
  const match = textFor(workout).match(/long\s+run\D+(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/i);
  return match ? Number(match[1]) : null;
}

function hasRunStimulus(workout: Workout): boolean {
  const text = textFor(workout);
  return Boolean(longRunMiles(workout)) || /zone\s*2|\brun\b|jog|tempo|threshold|interval|race|time trial/i.test(text) || workout.exercises.some(isRunExercise);
}

function hasResistanceStimulus(workout: Workout): boolean {
  const text = textFor(workout);
  const titleType = `${workout.title} ${workout.type}`;
  if (/\b(core|mobility|recovery)\b/i.test(titleType) && !workout.exercises.some(isResistanceExercise)) return false;
  return /upper|lower|strength|hypertrophy|athletic-conditioning|circuit|kettlebell|heavy|explosive/i.test(text) || workout.exercises.some(isResistanceExercise);
}

function hasMobilityStimulus(workout: Workout): boolean {
  return /mobility|prehab|stretch/i.test(textFor(workout)) || workout.exercises.some((exercise) => /mobility|prehab|stretch/i.test(exerciseText(exercise)));
}

function supportOnly(workout: Workout): boolean {
  return workout.exercises.length > 0 && workout.exercises.every((exercise) => isSupportExercise(exercise));
}

function resolution(input: Omit<PrimarySessionResolution, "reasoning"> & { reasoning: string[] }): PrimarySessionResolution {
  return input;
}

export function resolvePrimarySession(workout?: Workout | null): PrimarySessionResolution {
  if (!workout) {
    return resolution({
      dayType: "UnavailableDay",
      primaryStimulus: "Unavailable plan day",
      allowedBlocks: ["recovery"],
      forbiddenBlocks: ["lift", "run", "conditioning"],
      hybridAllowed: false,
      sessionStress: "Recovery",
      reasoning: ["No source workout was available; missing plan data must produce a safe unavailable day."],
    });
  }

  const text = textFor(workout);
  const resistance = hasResistanceStimulus(workout);
  const run = hasRunStimulus(workout);
  const mobility = hasMobilityStimulus(workout);
  const explicitHybrid = hasExplicitHybridPermission(workout);
  const longMiles = longRunMiles(workout);


  if (RACE_TEXT.test(`${workout.title} ${workout.type}`)) {
    return resolution({
      dayType: "RaceDay",
      primaryStimulus: "Race event",
      allowedBlocks: ["warmup", "run", "cooldown"],
      forbiddenBlocks: ["lift", "extra conditioning"],
      hybridAllowed: false,
      sessionStress: "VeryHigh",
      reasoning: ["Race Day overrides normal training categories."],
    });
  }

  if (TEST_TEXT.test(`${workout.title} ${workout.type}`)) {
    return resolution({
      dayType: "TestDay",
      primaryStimulus: "Performance test",
      allowedBlocks: ["warmup", run ? "run" : "lift", "cooldown"],
      forbiddenBlocks: ["unrelated maximal test", "long run after maximal test"],
      hybridAllowed: false,
      sessionStress: "High",
      reasoning: ["Testing is a primary stimulus and must be treated as high stress."],
    });
  }

  if (/recovery|rest/i.test(`${workout.title} ${workout.type}`)) {
    return resolution({
      dayType: "RecoveryDay",
      primaryStimulus: "Recovery / walk / mobility",
      allowedBlocks: ["mobility", "recovery"],
      forbiddenBlocks: ["lift", "run", "conditioning", "sprint"],
      hybridAllowed: false,
      sessionStress: "Recovery",
      reasoning: ["Recovery work is primary; no structured lifting or running should be inferred."],
    });
  }

  if (longMiles) {
    return resolution({
      dayType: "LongRunDay",
      primaryStimulus: `Long run (${longMiles} miles)`,
      allowedBlocks: ["warmup", "run", "cooldown"],
      forbiddenBlocks: ["lift", "sprint", "plyometric", "extra conditioning"],
      hybridAllowed: false,
      sessionStress: longMiles >= 8 ? "High" : "Moderate",
      reasoning: ["Long run is protected and remains the primary endurance stimulus.", "Long Run Day never becomes LiftDay or accidental HybridDay."],
    });
  }

  if (explicitHybrid && resistance && run) {
    return resolution({
      dayType: "HybridDay",
      primaryStimulus: "Explicit lift + run combined session",
      allowedBlocks: ["warmup", "lift", "run", "mobility", "cooldown"],
      forbiddenBlocks: ["long run", "unplanned extra conditioning"],
      hybridAllowed: true,
      sessionStress: "High",
      reasoning: ["Hybrid Day is allowed because the source workout explicitly requests both lift and run primary stimuli."],
    });
  }

  if (run) {
    return resolution({
      dayType: "RunDay",
      primaryStimulus: /zone\s*2/i.test(text) ? "Zone 2 aerobic run" : "Run stimulus",
      allowedBlocks: ["warmup", "run", ...(mobility ? ["mobility"] : []), "cooldown"],
      forbiddenBlocks: ["lift"],
      hybridAllowed: false,
      sessionStress: "Moderate",
      reasoning: ["Run remains primary even with mobility/core support.", "Support work never changes primary day type.", "Core does not create lift classification."],
    });
  }

  if (resistance) {
    const conditioningAllowed = /sprint|conditioning|circuit|kettlebell|athletic/i.test(text);
    return resolution({
      dayType: "LiftDay",
      primaryStimulus: /lower/i.test(text) ? "Lower strength/power" : /upper|bench|pull|row|press|hypertrophy/i.test(text) ? "Upper strength/hypertrophy" : /athletic|conditioning|circuit/i.test(text) ? "Athletic lift/conditioning circuit" : "Upper strength/hypertrophy",
      allowedBlocks: ["warmup", "lift", ...(conditioningAllowed ? ["conditioning"] : []), "cooldown"],
      forbiddenBlocks: ["long run", "unplanned run"],
      hybridAllowed: false,
      sessionStress: conditioningAllowed || /heavy|strength|sprint|power/i.test(text) ? "High" : "Moderate",
      reasoning: ["Actual resistance training stimulus is primary.", "Support core/mobility work does not create a second primary type."],
    });
  }

  if (mobility) {
    return resolution({
      dayType: "MobilityDay",
      primaryStimulus: supportOnly(workout) ? "Mobility / core support work" : "Mobility / movement quality",
      allowedBlocks: ["mobility", "recovery"],
      forbiddenBlocks: ["lift", "run", "conditioning"],
      hybridAllowed: false,
      sessionStress: "Low",
      reasoning: ["Mobility alone does not create LiftDay.", "Mobility + Core does not create HybridDay."],
    });
  }

  return resolution({
    dayType: "UnavailableDay",
    primaryStimulus: "Unavailable plan day",
    allowedBlocks: ["recovery"],
    forbiddenBlocks: ["lift", "run", "conditioning"],
    hybridAllowed: false,
    sessionStress: "Recovery",
    reasoning: ["No primary lift, run, long run, mobility, or recovery stimulus could be resolved safely."],
  });
}

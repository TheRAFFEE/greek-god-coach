import type { AppState, DailyCheckIn, Exercise, MacroTarget, NutritionLog, UserProfile, Workout } from "./types";

const userId = "demo-user";
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const phaseForWeek = (week: number) => week <= 4 ? "Phase 1 — Foundation" : week <= 8 ? "Phase 2 — Performance Build" : "Phase 3 — Lean-Out Athletic Peak";
export const longRunMiles: Record<number, number> = { 1: 3, 2: 4, 3: 5, 4: 4, 5: 6, 6: 7, 7: 8, 8: 6, 9: 9, 10: 10, 11: 11, 12: 8 };

export const macroTargets: MacroTarget[] = Array.from({ length: 12 }, (_, index) => {
  const week = index + 1;
  const target = week <= 4
    ? { calories: 2550, protein: 220, proteinMax: 230, carbs: 210, fat: 70, fiber: 30, water: 120 }
    : week <= 8
      ? { calories: 2450, protein: 220, proteinMax: 230, carbs: 180, fat: 70, fiber: 30, water: 120 }
      : { calories: week === 12 ? 2400 : 2350, protein: 215, proteinMax: 230, carbs: week === 12 ? 170 : 160, fat: 65, fiber: 30, water: 120 };
  return { id: `macro-${week}`, userId, week, ...target };
});

function ex(workoutId: string, order: number, name: string, sets: number, reps: string, category: string, rpe = 8): Exercise {
  return { id: `${workoutId}-e${order}`, workoutId, order, name, prescribedSets: sets, prescribedReps: reps, category, prescribedRpe: rpe };
}

function templateForDay(week: number, dayIndex: number): Omit<Workout, "id" | "week" | "phase" | "day" | "dayIndex" | "exercises"> & { exerciseSeed: Array<[string, number, string, string, number?]> } {
  const deload = [4, 8, 12].includes(week);
  const phase = week <= 4 ? 1 : week <= 8 ? 2 : 3;
  const scale = deload ? " Deload: reduce lifting volume 30-40%, keep movement quality, avoid max effort." : "";
  if (dayIndex === 0) {
    if (phase === 1) return { title: "Upper Strength + Sprints + Core", type: "upper-strength", notes: "Bench and pull-up strength, upper-body athletic look, sprint exposure." + scale, finisher: "30 sec hard / 60 sec easy x 10 rounds", deload, exerciseSeed: [["Bench Press",5,"5","compound-upper"],["Weighted Pull-Ups",4,"6","compound-upper"],["Incline Dumbbell Press",4,"10","accessory-upper"],["Chest-Supported Rows",4,"10","accessory-upper"],["Dips",3,"12","accessory-upper"],["40-yard Sprints",6,"1","conditioning"],["Hanging Leg Raises",4,"12","core"],["Cable Crunches",4,"15","core"]] };
    if (phase === 2) return { title: "Heavy Upper + Sprints + Core", type: "upper-strength", notes: "Heavier bench and pull-ups while keeping 1-2 reps in reserve." + scale, finisher: "30 sec hard / 60 sec easy x 10-12 rounds", deload, exerciseSeed: [["Bench Press",5,"5 heavier","compound-upper"],["Weighted Pull-Ups",5,"5","compound-upper"],["Incline DB Press",4,"8","accessory-upper"],["Heavy Rows",4,"8","compound-upper"],["Sprint Intervals",8,"1","conditioning"],["Hanging Leg Raises",4,"12","core"],["Cable Crunches",4,"15","core"]] };
    return { title: "Heavy Upper + Explosive Push + Sprints", type: "upper-strength", notes: "Strong non-maximal top sets, back-off work, explosive pushups, sprint work." + scale, finisher: "Sprint work only if readiness is Green", deload, exerciseSeed: [["Heavy Bench Top Sets",3,"3-5","compound-upper"],["Back-off Bench Sets",3,"5-8","compound-upper"],["Weighted Pull-Ups",4,"5-6","compound-upper"],["Explosive Pushups",5,"5","power"],["Heavy Rows",4,"8","compound-upper"],["Sprint Work",6,"1","conditioning"],["Hanging Leg Raises",4,"12","core"],["Cable Crunches",4,"15","core"]] };
  }
  if (dayIndex === 1) {
    if (phase === 1) return { title: "Lower Strength", type: "lower-strength", notes: "Reduced lower volume to preserve conditioning and fat-loss recovery." + scale, exerciseSeed: [["Trap Bar Deadlift",4,"5","compound-lower"],["Back Squat",3,"6","compound-lower"],["Bulgarian Split Squat",3,"10/leg","accessory-lower"],["Romanian Deadlift",3,"10","accessory-lower"],["Box Jumps",5,"3","power"],["Incline Treadmill Walk",1,"10 min","conditioning"]] };
    if (phase === 2) return { title: "Lower Strength", type: "lower-strength", notes: "Heavy triples and fives, strong bracing, no grinders." + scale, exerciseSeed: [["Trap Bar Deadlift",5,"3","compound-lower"],["Back Squat",5,"5","compound-lower"],["Bulgarian Split Squat",4,"10","accessory-lower"],["Romanian Deadlift",4,"8","accessory-lower"],["Loaded Carries",4,"1 round","core"]] };
    return { title: "Heavy Lower + Jump Training", type: "lower-strength", notes: "Maintain strength while lean. Conditioning finisher only if Green." + scale, exerciseSeed: [["Heavy Deadlift Triples",4,"3","compound-lower"],["Squats",4,"3-6","compound-lower"],["Jump Training",5,"3","power"],["Bulgarian Split Squat or Lunges",3,"10/leg","accessory-lower"]] };
  }
  if (dayIndex === 2) return { title: phase === 1 ? "Zone 2 + Mobility + Core" : "Zone 2 Run + Mobility + Core", type: "zone-2", notes: `${phase === 1 ? "35-45" : "45-60"} minute conversational run, hip/thoracic/shoulder mobility.` + scale, exerciseSeed: [["Zone 2 Run",1, phase === 1 ? "35-45 min" : "45-60 min","conditioning",6],["Hip Mobility",1,"10 min","mobility",5],["Thoracic Mobility",1,"10 min","mobility",5],["Shoulder Mobility",1,"10 min","mobility",5],["Pallof Press",3,"12/side","core"],["Side Plank",3,"45-60 sec/side","core"]] };
  if (dayIndex === 3) return { title: phase === 1 ? "Upper Hypertrophy + Density" : phase === 2 ? "High-Volume Upper Hypertrophy" : "High-Density Hypertrophy", type: "upper-hypertrophy", notes: "Shoulder-to-waist ratio work: incline press, pulls, delts, arms, controlled density." + scale, finisher: phase === 3 ? "Optional short finisher" : "3-4 rounds: pushups x20, rows x15, kettlebell swings x20, burpees x10", deload, exerciseSeed: [["Incline Bench or Machine Press",4,"10-12","accessory-upper"],["Pull-Ups or Lat Pulldown",4,"10-12","accessory-upper"],["DB Shoulder Press",4,"10","accessory-upper"],["Lateral Raises",5,"15-20","delts"],["Rear Delt Flyes",4,"15-20","delts"],["Cable/Band Flyes",4,"15","chest"],["Curls",4,"12-15","arms"],["Triceps Pressdowns or Skull Crushers",4,"12-15","arms"]] };
  if (dayIndex === 4) return { title: phase === 1 ? "Athletic Lower / P90X-Style Circuit + Core" : phase === 2 ? "Athletic Conditioning" : "Athletic Circuit / Kettlebell Conditioning", type: "athletic-conditioning", notes: "P90X-style density without wrecking form. Rest minimally but move clean." + scale, finisher: "5 rounds: KB swings x20, pushups x20, pullups x10, walking lunges x20, burpees x10, farmer carry 1 min", deload, exerciseSeed: [["Front Squat", phase === 1 ? 4 : 3,"6","compound-lower"],["Walking Lunges",3,"20 steps","accessory-lower"],["Kettlebell Swings",4,"20","conditioning"],["Broad Jumps",5,"3","power"],["Farmer Carries",4,"60 sec","core"],["Agility Work",1,"10 min","conditioning"],["Ab Wheel",4,"8-12","core"]] };
  if (dayIndex === 5) return { title: `Long Run — ${longRunMiles[week]} miles`, type: "long-run", notes: "Conversational Zone 2. Increase 0.5-1 mile weekly except deload weeks. Do not race it.", longRunMiles: longRunMiles[week], deload, exerciseSeed: [["Long Run",1,`${longRunMiles[week]} miles`,"conditioning",6]] };
  return { title: "Recovery", type: "recovery", notes: "Walking, stretching, meal prep, mobility, hydration, and sleep focus.", exerciseSeed: [["Easy Walk",1,"30-60 min","recovery",4],["Mobility Flow",1,"15-25 min","mobility",4],["Meal Prep",1,"complete","nutrition",1]] };
}

export const workouts: Workout[] = Array.from({ length: 12 }).flatMap((_, weekIndex) => {
  const week = weekIndex + 1;
  return days.map((day, dayIndex) => {
    const id = `w${week}-d${dayIndex + 1}`;
    const t = templateForDay(week, dayIndex);
    return {
      id,
      userId,
      week,
      phase: phaseForWeek(week),
      day,
      dayIndex,
      title: t.title,
      type: t.type,
      notes: t.notes,
      finisher: t.finisher,
      deload: t.deload,
      longRunMiles: t.longRunMiles,
      exercises: t.exerciseSeed.map(([name, sets, reps, category, rpe], i) => ex(id, i + 1, name, t.deload && category !== "conditioning" && category !== "recovery" ? Math.max(1, Math.floor(sets * 0.65)) : sets, reps, category, rpe ?? 8)),
    };
  });
});

export const demoUser: UserProfile = {
  id: userId,
  name: "Walter",
  age: 39,
  sex: "male",
  height: "5'11\"",
  startingWeight: 212,
  goalWeight: 196,
  activityLevel: "Hybrid strength + running",
  goal: "12-week Greek-god athletic recomposition with half-marathon endurance",
  trainingExperience: "Experienced natural lifter",
  strengthNumbers: "Bench 225x5, squat 275x5, trap bar deadlift 365x5, pull-ups +45x5",
  equipment: "Full gym, treadmill, bike/rower, kettlebells",
  injuryHistory: "No current major injury; modify around pain immediately",
  preferredUnits: "imperial",
  createdAt: "2026-05-24T00:00:00.000Z",
};

const dates = Array.from({ length: 14 }, (_, i) => `2026-05-${String(11 + i).padStart(2, "0")}`);
export const sampleCheckIns: DailyCheckIn[] = dates.map((date, i) => ({
  id: `check-${i + 1}`,
  userId,
  date,
  weight: Math.round((212 - i * 0.18 + (i % 3) * 0.15) * 10) / 10,
  sleepHours: i === 9 ? 5.8 : 7.1 + (i % 3) * 0.2,
  sleepQuality: i === 9 ? 5 : 8,
  soreness: i === 9 ? 7 : 4 + (i % 2),
  energy: i === 9 ? 5 : 8,
  stress: i === 9 ? 7 : 4,
  hunger: 5 + (i % 3),
  motivation: 8,
  alcohol: i === 5,
  steps: 9800 + i * 180,
  restingHr: i === 9 ? 66 : 58 + (i % 2),
  hrv: i === 9 ? 48 : 61 - (i % 3),
  pain: false,
  painLocation: "",
  painSeverity: 0,
  workoutCompleted: i % 7 !== 6,
  macrosHit: i !== 5 && i !== 9,
  notes: i === 9 ? "Felt beat up; good day to modify volume." : "",
}));

export const sampleNutritionLogs: NutritionLog[] = dates.map((date, i) => ({
  id: `nutrition-${i + 1}`,
  userId,
  date,
  calories: i === 5 ? 2880 : i === 9 ? 2650 : 2520 + (i % 3) * 30,
  protein: i === 5 ? 190 : 220,
  carbs: i === 9 ? 240 : 205,
  fat: i === 5 ? 95 : 70,
  fiber: 30,
  sodium: 2600 + i * 20,
  water: 118,
  alcohol: i === 5 ? 2 : 0,
  notes: "",
}));

export function createInitialState(): AppState {
  return {
    user: demoUser,
    currentWeek: 1,
    startDate: "2026-05-24",
    checkIns: sampleCheckIns,
    bodyMetrics: sampleCheckIns.map((c, i) => ({ id: `metric-${i + 1}`, userId, date: c.date, weight: c.weight, waist: Math.round((38 - i * 0.035) * 10) / 10, chest: 43, arms: 16.2, thighs: 24, hips: 40, notes: "" })),
    photos: [],
    nutritionLogs: sampleNutritionLogs,
    exerciseLogs: [],
    adjustments: [],
    macroTargets,
  };
}

export function getWorkoutForWeekDay(week: number, dayIndex: number) {
  return workouts.find((w) => w.week === week && w.dayIndex === dayIndex) ?? workouts[0];
}

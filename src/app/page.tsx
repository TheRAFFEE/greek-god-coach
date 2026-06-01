"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adjustWorkoutForReadiness,
  calculateAdherence,
  calculateReadiness,
  calculateWeightTrend,
  detectInjuryRisk,
  generateWorkoutPreview,
  calculateRunTrends,
  createCoachDecisionLogEntry,
  generateDailyPrescription,
  generateNextSetRecommendation,
  generatePostWorkoutAnalysis,
  getNextWorkoutStep,
  getRecommendedStartingWeight,
  recommendMacroAdjustment,
  recommendWorkoutAdjustment,
  generateRunningRecommendation,
  summarizeTodaysChanges,
  getReadinessGaugeModel,
  buildWeeklyAdherenceHeatmap,
  summarizeWorkoutCompletionCards,
  buildRunTrendCards,
} from "@/lib/coach-engine";
import { evaluateDailyRecoveryStatus, upsertDailyCheckIn } from "@/lib/daily-checkin";
import { getWorkoutForWeekDay, workouts } from "@/lib/seed-data";
import { buildWeightTrendDashboard } from "@/lib/weight-trend";
import { buildRunLoggerRecord, evaluateRunLoggerResult, saveRunLoggerEntry, type RunLoggerInput } from "@/lib/run-logger";
import { buildWorkoutLoggerSession, evaluateWorkoutLoggerResult, saveWorkoutLoggerEntry, type WorkoutLoggerExerciseInput, type WorkoutLoggerInput, type WorkoutLoggerType } from "@/lib/workout-logger";
import { buildNutritionLogRecord, evaluateNutritionLoggerAdherence, getNutritionLoggerTarget, saveNutritionLoggerEntry, type NutritionLoggerDayType, type NutritionLoggerInput } from "@/lib/nutrition-logger";
import { buildWeeklyReviewSummary } from "@/lib/weekly-review";
import { buildMvpDashboard } from "@/lib/mvp-dashboard";
import { createAuthAwarePersistenceContext, syncAppStateToSupabase, type AuthPersistenceContext } from "@/lib/supabase-persistence";
import { loadState, resetState, saveState, todayIso, uid } from "@/lib/storage";
import type { AppMode, AppState, CoachDecision, DailyCheckIn, Exercise, FormQuality, ProgressPhoto, RunLog, RunType, SetLog, WorkoutSession } from "@/lib/types";

const tabs = ["Dashboard", "Onboarding", "Daily Check-In", "Workout", "Running", "Nutrition", "Body Metrics", "Progress Photos", "Readiness", "Weekly Review", "Plan Adjustments", "Settings"];

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Card({ title, eyebrow, children, className }: { title?: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  return <section className={classNames("rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/30", className)}>{eyebrow && <p className="text-xs uppercase tracking-[0.25em] text-amber-300/80">{eyebrow}</p>}{title && <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>}<div className="mt-4">{children}</div></section>;
}

function Stat({ label, value, sub, tone = "neutral" }: { label: string; value: string | number; sub?: string; tone?: "green" | "yellow" | "red" | "neutral" }) {
  const tones = { green: "text-emerald-300", yellow: "text-yellow-300", red: "text-red-300", neutral: "text-white" };
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-zinc-500">{label}</p><p className={classNames("mt-1 text-2xl font-bold", tones[tone])}>{value}</p>{sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm text-zinc-300"><span>{label}</span>{children}</label>;
}

function toneGradient(tone: "green" | "yellow" | "red" | "neutral" = "neutral") {
  if (tone === "green") return "from-emerald-400 to-lime-300";
  if (tone === "yellow") return "from-amber-300 to-orange-400";
  if (tone === "red") return "from-red-400 to-rose-500";
  return "from-zinc-400 to-zinc-600";
}

function ReadinessGauge({ model }: { model: ReturnType<typeof getReadinessGaugeModel> }) {
  const stroke = model.tone === "green" ? "#34d399" : model.tone === "yellow" ? "#fbbf24" : "#fb7185";
  return <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 shadow-2xl shadow-black/20">
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative grid h-36 w-36 shrink-0 place-items-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90"><circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,.1)" strokeWidth="12" fill="none" /><circle cx="60" cy="60" r="50" stroke={stroke} strokeWidth="12" strokeLinecap="round" fill="none" strokeDasharray={`${model.arcPercent * 3.14} 314`} /></svg>
        <div className="text-center"><p className="text-4xl font-black text-white">{model.score}</p><p className="text-xs uppercase tracking-[0.25em] text-zinc-400">{model.status}</p></div>
      </div>
      <div><p className={`inline-flex rounded-full bg-gradient-to-r ${toneGradient(model.tone)} px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-black`}>Readiness Gauge</p><h3 className="mt-3 text-2xl font-black text-white">{model.commandCopy}</h3><p className="mt-2 text-sm leading-6 text-zinc-300">{model.detailCopy}</p></div>
    </div>
  </div>;
}

function RingMetric({ label, value, percent, tone = "yellow", sub }: { label: string; value: string; percent: number; tone?: "green" | "yellow" | "red" | "neutral"; sub?: string }) {
  const stroke = tone === "green" ? "#34d399" : tone === "red" ? "#fb7185" : tone === "yellow" ? "#fbbf24" : "#a1a1aa";
  return <div className="rounded-3xl border border-white/10 bg-black/25 p-4"><div className="flex items-center gap-3"><svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90"><circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,.1)" strokeWidth="7" fill="none" /><circle cx="28" cy="28" r="22" stroke={stroke} strokeWidth="7" strokeLinecap="round" fill="none" strokeDasharray={`${Math.max(0, Math.min(100, percent)) * 1.38} 138`} /></svg><div><p className="text-xs text-zinc-500">{label}</p><p className="text-lg font-black text-white">{value}</p>{sub && <p className="text-xs text-zinc-400">{sub}</p>}</div></div></div>;
}

function WeeklyAdherenceHeatmap({ cells }: { cells: ReturnType<typeof buildWeeklyAdherenceHeatmap> }) {
  return <div className="grid grid-cols-7 gap-2">{cells.map((cell) => <div key={cell.date} title={cell.details} className={classNames("rounded-2xl border p-3 text-center", cell.tone === "green" ? "border-emerald-300/30 bg-emerald-400/20" : cell.tone === "yellow" ? "border-amber-300/30 bg-amber-400/20" : "border-red-300/30 bg-red-400/20")}><p className="text-xs font-bold text-zinc-300">{cell.label}</p><p className="mt-1 text-lg font-black text-white">{cell.score}</p></div>)}</div>;
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) {
  return <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center"><p className="text-lg font-black text-white">{title}</p><p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{copy}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

const inputClass = "rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white outline-none ring-amber-400/30 focus:ring-2";

function Sparkline({ values, color = "#f59e0b" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-24 rounded-2xl bg-white/[0.03]" />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${90 - ((v - min) / span) * 80}`).join(" ");
  return <svg viewBox="0 0 100 100" className="h-24 w-full overflow-visible rounded-2xl bg-white/[0.03] p-2"><polyline fill="none" stroke={color} strokeWidth="3" points={points} vectorEffect="non-scaling-stroke" /></svg>;
}

export default function Home() {
  const [state, setState] = useState<AppState | null>(null);
  const [active, setActive] = useState("Dashboard");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState(0);
  const [persistenceContext, setPersistenceContext] = useState<AuthPersistenceContext | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState("localStorage fallback");

  useEffect(() => setState(loadState()), []);
  useEffect(() => { void createAuthAwarePersistenceContext().then(setPersistenceContext).catch(() => setPersistenceContext({ mode: "localStorage", client: null })); }, []);
  useEffect(() => {
    if (!state) return;
    if (!persistenceContext || persistenceContext.mode === "localStorage") {
      saveState(state);
      setPersistenceStatus("localStorage fallback");
      return;
    }
    void syncAppStateToSupabase(state, persistenceContext)
      .then((result) => setPersistenceStatus(result.mode === "supabase" ? `Supabase sync: ${result.syncedTables.length} tables` : "localStorage fallback"))
      .catch(() => { saveState(state); setPersistenceStatus("localStorage fallback after sync error"); });
  }, [state, persistenceContext]);

  const latestCheckIn = useMemo(() => state?.checkIns.at(-1), [state]);
  const baseline = useMemo(() => ({ restingHr: 58, hrv: 60 }), []);
  const readiness = useMemo(() => latestCheckIn ? calculateReadiness(latestCheckIn, baseline) : null, [latestCheckIn, baseline]);
  const currentWorkout = useMemo(() => getWorkoutForWeekDay(selectedWeek, selectedDay), [selectedWeek, selectedDay]);
  const adjustedWorkout = useMemo(() => readiness ? adjustWorkoutForReadiness(currentWorkout, readiness.status) : currentWorkout, [currentWorkout, readiness]);
  const macroTarget = useMemo(() => state?.macroTargets.find((m) => m.week === selectedWeek) ?? state?.macroTargets[0], [state, selectedWeek]);
  const trend = useMemo(() => state ? calculateWeightTrend(state.bodyMetrics) : null, [state]);
  const nutritionAdherence = useMemo(() => state && macroTarget ? calculateAdherence(state.nutritionLogs.slice(-7), macroTarget) : 0, [state, macroTarget]);
  const trainingAdherence = useMemo(() => state?.checkIns.length ? Math.round((state.checkIns.slice(-7).filter((c) => c.workoutCompleted).length / Math.min(7, state.checkIns.length)) * 100) : 0, [state]);
  const weeklyReview = useMemo(() => {
    if (!state) return null;
    const endDate = todayIso();
    const start = new Date(`${endDate}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 6);
    const startDate = start.toISOString().slice(0, 10);
    return buildWeeklyReviewSummary(state, { startDate, endDate });
  }, [state]);
  const runTrends = useMemo(() => state ? calculateRunTrends(state.runLogs ?? []) : null, [state]);
  const plannedRunDistance = currentWorkout.longRunMiles ?? (currentWorkout.type.includes("run") ? Number(currentWorkout.exercises[0]?.prescribedReps.match(/[\d.]+/)?.[0] ?? 3) : 3);
  const runningRecommendation = useMemo(() => state && readiness && runTrends ? generateRunningRecommendation({ runLogs: state.runLogs ?? [], nextDayReadiness: readiness.status, plannedDistance: plannedRunDistance, runType: currentWorkout.longRunMiles ? "Long run" : "Zone 2", currentWeeklyMileage: runTrends.weeklyMileage, previousWeeklyMileage: Math.max(0, runTrends.weeklyMileage - plannedRunDistance) }) : null, [state, readiness, runTrends, plannedRunDistance, currentWorkout.longRunMiles]);
  const nextLiftTitle = useMemo(() => {
    const currentOrder = (selectedWeek - 1) * 7 + selectedDay;
    return workouts.find((workout) => (workout.week - 1) * 7 + workout.dayIndex >= currentOrder && /strength|hypertrophy/i.test(workout.type))?.title ?? currentWorkout.title;
  }, [selectedWeek, selectedDay, currentWorkout.title]);
  const nextRunLabel = runningRecommendation ? `${runningRecommendation.action}: ${runningRecommendation.recommendedDistance} mi` : `${plannedRunDistance} mi planned`;
  const mvpDashboard = useMemo(() => state && macroTarget ? buildMvpDashboard(state, { today: todayIso(), currentWorkoutTitle: currentWorkout.title, nextLiftTitle, nextRunLabel, macroTarget }) : null, [state, macroTarget, currentWorkout.title, nextLiftTitle, nextRunLabel]);
  const dailyPrescription = useMemo(() => state && latestCheckIn && macroTarget && readiness ? generateDailyPrescription({ readiness, checkIn: latestCheckIn, workout: currentWorkout, macroTarget, nutritionLogs: state.nutritionLogs, bodyMetrics: state.bodyMetrics, trainingAdherence, postWorkoutRecommendations: state.postWorkoutRecommendations, runningRecommendation: runningRecommendation ?? undefined }) : null, [state, latestCheckIn, macroTarget, readiness, currentWorkout, trainingAdherence, runningRecommendation]);
  useEffect(() => {
    if (!state || !dailyPrescription || !readiness || !latestCheckIn) return;
    const day = dailyPrescription.date.slice(0, 10);
    const decisionDate = `${day}T00:00:00.000Z`;
    const existingKeys = new Set(state.adjustments.map((entry) => `${entry.date.slice(0, 10)}:${entry.category ?? entry.adjustmentType}:${entry.previousValue}:${entry.newValue}`));
    const autoDecisions = [];
    if (dailyPrescription.trainingDecision !== "Full workout") {
      const category = dailyPrescription.trainingDecision === "Recovery replacement" ? "Recovery replacement" : "Readiness modification";
      autoDecisions.push(createCoachDecisionLogEntry({ id: uid("adj"), userId: state.user.id, date: decisionDate, category, originalPrescription: currentWorkout.title, adjustedPrescription: dailyPrescription.exactWorkoutRecommendation, reason: dailyPrescription.explanation.join(" "), triggerData: { readinessStatus: readiness.status, readinessScore: readiness.score, pain: latestCheckIn.pain, painSeverity: latestCheckIn.painSeverity, soreness: latestCheckIn.soreness }, confidence: dailyPrescription.trainingDecision === "Recovery replacement" ? "High" : "Medium", mode: "automatic", notes: dailyPrescription.workoutModifications.join(" | ") }));
    }
    if (dailyPrescription.workoutModifications.some((item) => /substitut|pain/i.test(item))) {
      autoDecisions.push(createCoachDecisionLogEntry({ id: uid("adj"), userId: state.user.id, date: decisionDate, category: "Exercise substitution", originalPrescription: currentWorkout.exercises.map((exercise) => exercise.name).join(", "), adjustedPrescription: dailyPrescription.workoutModifications.filter((item) => /substitut|pain/i.test(item)).join(" | "), reason: "Pain-aware substitution or movement restriction was triggered.", triggerData: { pain: latestCheckIn.pain, painLocation: latestCheckIn.painLocation, painSeverity: latestCheckIn.painSeverity }, confidence: latestCheckIn.painSeverity >= 6 ? "High" : "Medium", mode: "automatic" }));
    }
    if (runningRecommendation && /Progress|Hold|Regress/.test(runningRecommendation.action)) {
      autoDecisions.push(createCoachDecisionLogEntry({ id: uid("adj"), userId: state.user.id, date: decisionDate, category: "Run progression/regression", originalPrescription: `${plannedRunDistance} mile planned run`, adjustedPrescription: `${runningRecommendation.recommendedDistance} mile ${runningRecommendation.action}`, reason: runningRecommendation.message, triggerData: { reasons: runningRecommendation.reasons, warnings: runningRecommendation.warnings }, confidence: runningRecommendation.action === "Regress" ? "High" : "Medium", mode: "automatic" }));
    }
    const newDecisions = autoDecisions.filter((entry) => !existingKeys.has(`${day}:${entry.category ?? entry.adjustmentType}:${entry.previousValue}:${entry.newValue}`));
    if (newDecisions.length) setState({ ...state, adjustments: [...state.adjustments, ...newDecisions] });
  }, [state, dailyPrescription, readiness, latestCheckIn, currentWorkout, runningRecommendation, plannedRunDistance]);
  const macroRec = useMemo(() => state && trend && macroTarget && latestCheckIn ? recommendMacroAdjustment({ currentCalories: macroTarget.calories, weightChange14Day: trend.change14Day, weeklyLossRate: trend.weeklyLossRate, waistChange: trend.waistChange, nutritionAdherence, trainingAdherence, energy: latestCheckIn.energy, hunger: latestCheckIn.hunger, sleep: latestCheckIn.sleepHours, performanceTrend: "stable", upcomingWorkoutType: currentWorkout.type }) : null, [state, trend, macroTarget, latestCheckIn, nutritionAdherence, trainingAdherence, currentWorkout.type]);
  const workoutRec = useMemo(() => latestCheckIn && readiness ? recommendWorkoutAdjustment({ readinessStatus: readiness.status, soreness: latestCheckIn.soreness, pain: latestCheckIn.pain, painLocation: latestCheckIn.painLocation, painSeverity: latestCheckIn.painSeverity, missedReps: false, upcomingWorkoutType: currentWorkout.type }) : null, [latestCheckIn, readiness, currentWorkout.type]);

  if (!state || !readiness || !macroTarget || !trend || !weeklyReview || !dailyPrescription || !mvpDashboard) return <main className="min-h-screen bg-black p-8 text-white">Loading coach...</main>;

  const updateState = (next: AppState) => setState(next);
  const latestInjuryRisk = latestCheckIn ? detectInjuryRisk(latestCheckIn) : { level: "Low", recommendation: "No check-in yet." };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#3f2f12,transparent_30%),linear-gradient(135deg,#050505,#111111_50%,#050505)] text-zinc-100">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-black/70 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><p className="text-xs uppercase tracking-[0.4em] text-amber-300">Greek God Coach</p><h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl">12-week transformation command center</h1><p className="mt-2 max-w-3xl text-sm text-zinc-400">Not a passive tracker: the app compares planned vs. actual performance, recovery, macros, wearable trends, and body metrics to recommend the next best action.</p></div>
          <div className="flex gap-2"><span className="hidden rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-400 md:inline">{persistenceStatus}</span><button onClick={() => updateState(resetState())} className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300">Reset demo</button><button onClick={() => setActive("Daily Check-In")} className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black">Check in</button></div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button key={tab} onClick={() => setActive(tab)} className={classNames("whitespace-nowrap rounded-full px-4 py-2 text-sm", active === tab ? "bg-white text-black" : "bg-white/5 text-zinc-300")}>{tab}</button>)}</nav>
      </header>

      <div className="py-6">
        {active === "Dashboard" && <Dashboard state={state} prescription={dailyPrescription} readiness={readiness} macroTarget={macroTarget} workoutTitle={adjustedWorkout.title} nutritionAdherence={nutritionAdherence} trainingAdherence={trainingAdherence} macroRec={macroRec?.action ?? "Keep calories"} weeklyScore={weeklyReview.adherenceScore} mvp={mvpDashboard} />}
        {active === "Onboarding" && <Onboarding state={state} updateState={updateState} />}
        {active === "Daily Check-In" && <DailyCheckInForm state={state} updateState={updateState} readiness={readiness} />}
        {active === "Workout" && <WorkoutPreview state={state} updateState={updateState} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} selectedDay={selectedDay} setSelectedDay={setSelectedDay} readiness={readiness} workout={adjustedWorkout} originalWorkout={currentWorkout} latestCheckIn={latestCheckIn} runningRecommendation={runningRecommendation} />}
        {active === "Running" && <Running state={state} updateState={updateState} recommendation={runningRecommendation} trends={runTrends} plannedDistance={plannedRunDistance} />}
        {active === "Nutrition" && <NutritionLogger state={state} updateState={updateState} />}
        {active === "Body Metrics" && <BodyMetrics state={state} updateState={updateState} trend={trend} />}
        {active === "Progress Photos" && <ProgressPhotos state={state} updateState={updateState} />}
        {active === "Readiness" && <ReadinessPanel readiness={readiness} workoutRec={workoutRec} injuryRisk={latestInjuryRisk} latestCheckIn={latestCheckIn} />}
        {active === "Weekly Review" && <WeeklyReviewPanel review={weeklyReview} />}
        {active === "Plan Adjustments" && <PlanAdjustments state={state} updateState={updateState} />}
        {active === "Settings" && <Settings state={state} updateState={updateState} />}
      </div>
    </div>
  </main>;
}

function Dashboard({ state, prescription, readiness, macroTarget, workoutTitle, nutritionAdherence, trainingAdherence, macroRec, weeklyScore, mvp }: any) {
  const tone = readiness.status === "Green" ? "green" : readiness.status === "Yellow" ? "yellow" : "red";
  const todaysChanges = summarizeTodaysChanges(state.adjustments ?? [], todayIso());
  const gauge = getReadinessGaugeModel(readiness);
  const recentDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const heatmap = buildWeeklyAdherenceHeatmap({ dates: recentDates, checkIns: state.checkIns, nutritionLogs: state.nutritionLogs, target: macroTarget });
  const completion = summarizeWorkoutCompletionCards({ workouts, sessions: state.workoutSessions ?? [] });
  const weightDashboard = buildWeightTrendDashboard(state.bodyMetrics ?? [], { startingWeight: 233, goalWeight: 199.9 });
  return <div className="grid gap-5">
    <Card eyebrow="MVP Dashboard" title="Today at a glance">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Today's recovery status" value={mvp.recoveryStatus} tone={mvp.recoveryStatus === "Green" ? "green" : mvp.recoveryStatus === "Yellow" ? "yellow" : "red"} />
        <Stat label="Current weight" value={mvp.currentWeight === null ? "—" : `${mvp.currentWeight} lb`} />
        <Stat label="7-day average weight" value={mvp.sevenDayAverageWeight === null ? "—" : `${mvp.sevenDayAverageWeight} lb`} />
        <Stat label="Weekly miles" value={`${mvp.weeklyMiles} mi`} />
        <Stat label="Next run" value={mvp.nextRun} />
        <Stat label="Next lift" value={mvp.nextLift} />
        <Stat label="Calories/protein status" value={mvp.caloriesStatus} sub={mvp.proteinStatus} tone={mvp.proteinStatus.includes("No ") ? "yellow" : "green"} />
        <Stat label="Jan 17 half marathon countdown" value={`${mvp.halfMarathonCountdown} days`} />
        <Stat label="Current plan recommendation" value={mvp.currentPlanRecommendation} tone={mvp.currentPlanRecommendation === "Progress" ? "green" : mvp.currentPlanRecommendation === "Repeat" ? "yellow" : "red"} />
      </div>
    </Card>
    <Card eyebrow="Today’s Orders" title="Your command brief" className="overflow-hidden border-amber-300/30 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.18),transparent_35%),rgba(69,26,3,.18)]">
      <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <ReadinessGauge model={gauge} />
        <div className="grid gap-4">
          <div className="rounded-[2rem] bg-amber-400 p-5 text-black shadow-2xl shadow-amber-950/30">
            <p className="text-xs font-black uppercase tracking-[0.25em]">Primary order</p>
            <h3 className="mt-2 text-2xl font-black sm:text-4xl">{prescription.exactWorkoutRecommendation}</h3>
            <div className="mt-4 grid gap-2 text-sm font-black sm:grid-cols-3"><span>Training: {prescription.trainingDecision}</span><span>Water: {prescription.waterTarget}</span><span>Steps: {prescription.stepsTarget}</span></div>
          </div>
          <div className="grid gap-3 md:grid-cols-3"><Stat label="Nutrition order" value={prescription.nutritionTarget} /><Stat label="Cardio order" value={prescription.cardioRecommendation} /><Stat label="Current workout" value={workoutTitle} sub="readiness-adjusted" tone={tone} /></div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">Use these modifications</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-300">{prescription.workoutModifications.length ? prescription.workoutModifications.map((item: string) => <li key={item}>• {item}</li>) : <li>No modifications — run the plan as written.</li>}</ul></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">Recovery actions</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-300">{prescription.recoveryTasks.map((task: string) => <li key={task}>• {task}</li>)}</ul></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">Why the coach chose this</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-300">{prescription.explanation.map((why: string) => <li key={why}>• {why}</li>)}</ul>{todaysChanges.length ? <div className="mt-3 rounded-2xl bg-amber-400/10 p-3 text-sm text-amber-100"><b>Changed today</b><ul className="mt-1 grid gap-1">{todaysChanges.map((change) => <li key={change}>• {change}</li>)}</ul></div> : null}</div></div>
    </Card>

    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <Card eyebrow="Premium Dashboard" title="Scoreboard"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><RingMetric label="Transformation" value={`${weeklyScore}/100`} percent={weeklyScore} tone="green" sub="weekly score" /><RingMetric label="Nutrition" value={`${nutritionAdherence}%`} percent={nutritionAdherence} tone={nutritionAdherence >= 85 ? "green" : nutritionAdherence >= 70 ? "yellow" : "red"} sub={macroRec} /><RingMetric label="Training" value={`${trainingAdherence}%`} percent={trainingAdherence} tone={trainingAdherence >= 85 ? "green" : trainingAdherence >= 70 ? "yellow" : "red"} sub="last 7 days" /><RingMetric label="Plan completion" value={`${completion.completionPercent}%`} percent={completion.completionPercent} tone="yellow" sub={`${completion.completedSessions} sessions done`} /></div><div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4"><p className="font-bold text-white">Weekly adherence heatmap</p><p className="mb-3 mt-1 text-sm text-zinc-400">Green means nutrition and training are both close enough to drive the physique goal.</p><WeeklyAdherenceHeatmap cells={heatmap} /></div></Card>
      <WeightTrendDashboardCard dashboard={weightDashboard} />
    </div>

    <Card eyebrow="Workout Receipts" title="Completion cards"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Completed sessions" value={completion.completedSessions} sub={`${completion.totalWorkouts} seeded workouts`} tone="green" /><Stat label="Active sessions" value={completion.activeSessions} sub="finish or end deliberately" tone={completion.activeSessions ? "yellow" : "neutral"} /><Stat label="Coach copy" value={completion.coachCopy} /></div></Card>
  </div>;
}

function WeightTrendDashboardCard({ dashboard }: { dashboard: ReturnType<typeof buildWeightTrendDashboard> }) {
  const value = (number: number | null, suffix = " lb") => number === null ? "—" : `${number}${suffix}`;
  if (!dashboard.hasData) {
    return <Card eyebrow="Weight Trend Dashboard" title="Scale trend"><EmptyState title="No weight data yet" copy={dashboard.summary} /></Card>;
  }
  const weeklyTone = dashboard.weeklyWeightChange === null ? "neutral" : dashboard.weeklyWeightChange <= 0 ? "green" : "yellow";
  return <Card eyebrow="Weight Trend Dashboard" title="Cut progress toward under 200 lb">
    <div className="grid gap-3 sm:grid-cols-2">
      <Stat label="Latest weight" value={value(dashboard.latestWeight)} sub="most recent entry" tone="neutral" />
      <Stat label="7-day average" value={value(dashboard.sevenDayAverage)} sub="uses available entries if fewer than 7" tone="green" />
      <Stat label="14-day average" value={value(dashboard.fourteenDayAverage)} sub="trend smoothing" tone="neutral" />
      <Stat label="Weekly weight change" value={dashboard.weeklyWeightChange === null ? "Need 14 days" : `${dashboard.weeklyWeightChange > 0 ? "+" : ""}${dashboard.weeklyWeightChange} lb`} sub="current 7-day avg vs prior 7-day avg" tone={weeklyTone} />
    </div>
    <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="font-black text-white">233 lb → under 200 lb</p><p className="text-sm text-zinc-400">{dashboard.summary}</p></div>
        <p className="text-3xl font-black text-amber-300">{dashboard.progressPercent}%</p>
      </div>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-300" style={{ width: `${dashboard.progressPercent}%` }} /></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><Stat label="Lost from start" value={`${dashboard.progressPoundsLost} lb`} tone="green" /><Stat label="Remaining" value={`${dashboard.progressPoundsRemaining} lb`} sub="to 199.9 lb" tone={dashboard.progressPoundsRemaining <= 5 ? "green" : "yellow"} /></div>
    </div>
    <div className="mt-4"><p className="mb-2 text-sm font-bold text-zinc-300">Weight chart</p><Sparkline values={dashboard.chartPoints.map((point) => point.weight)} color="#fbbf24" /><p className="mt-2 text-xs text-zinc-500">Showing up to the latest 21 weight entries.</p></div>
  </Card>;
}
function Onboarding({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const u = state.user;
  const set = (field: string, value: string | number) => updateState({ ...state, user: { ...u, [field]: value } });
  return <Card eyebrow="Setup Wizard" title="Personalize the coach"><div className="grid gap-4 md:grid-cols-2">{[["Name","name"],["Age","age"],["Height","height"],["Starting weight","startingWeight"],["Goal weight","goalWeight"],["Training experience","trainingExperience"],["Current strength numbers","strengthNumbers"],["Equipment available","equipment"],["Injury history","injuryHistory"],["Primary goal","goal"]].map(([label, field]) => <Field key={field} label={label}><input className={inputClass} value={(u as any)[field]} onChange={(e) => set(field, field.includes("weight") || field === "age" ? Number(e.target.value) : e.target.value)} /></Field>)}</div></Card>;
}

function DailyCheckInForm({ state, updateState }: { state: AppState; updateState: (s: AppState) => void; readiness: any }) {
  const latest = state.checkIns.at(-1);
  const todayEntry = state.checkIns.find((entry) => entry.date === todayIso());
  const fallback: DailyCheckIn = {
    id: uid("check"),
    userId: state.user.id,
    date: todayIso(),
    weight: latest?.weight ?? state.user.startingWeight,
    sleepHours: latest?.sleepHours ?? 7,
    sleepQuality: latest?.sleepQuality ?? 4,
    soreness: latest?.soreness ?? 3,
    energy: latest?.energy ?? 7,
    stress: latest?.stress ?? 3,
    hunger: latest?.hunger ?? 5,
    motivation: latest?.motivation ?? 7,
    alcohol: latest?.alcohol ?? false,
    steps: latest?.steps ?? 8000,
    restingHr: latest?.restingHr ?? 58,
    hrv: latest?.hrv ?? 60,
    pain: latest?.pain ?? false,
    painLocation: latest?.painLocation ?? "",
    painSeverity: latest?.painSeverity ?? 0,
    workoutCompleted: latest?.workoutCompleted ?? false,
    runCompleted: latest?.runCompleted ?? false,
    macrosHit: latest?.macrosHit ?? false,
    notes: "",
  };
  const [form, setForm] = useState<DailyCheckIn>({ ...fallback, ...todayEntry, id: todayEntry?.id ?? uid("check"), date: todayIso(), notes: todayEntry?.notes ?? "" });
  const [savedStatus, setSavedStatus] = useState<ReturnType<typeof evaluateDailyRecoveryStatus> | null>(todayEntry ? evaluateDailyRecoveryStatus(todayEntry) : null);
  const previewStatus = evaluateDailyRecoveryStatus(form);
  const displayedStatus = savedStatus ?? previewStatus;
  const statusClasses = displayedStatus.status === "Green"
    ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
    : displayedStatus.status === "Yellow"
      ? "border-amber-300/30 bg-amber-400/15 text-amber-100"
      : "border-red-300/30 bg-red-400/15 text-red-100";
  const set = (field: keyof DailyCheckIn, value: string | number | boolean) => {
    setSavedStatus(null);
    setForm((current) => ({ ...current, [field]: value }));
  };
  const save = () => {
    const entry: DailyCheckIn = { ...form, userId: state.user.id, id: form.id || uid("check") };
    const status = evaluateDailyRecoveryStatus(entry);
    updateState(upsertDailyCheckIn(state, entry, uid("metric")));
    setSavedStatus(status);
  };
  const numberInput = (field: keyof DailyCheckIn, min?: number, max?: number, step = "1") => (
    <input className={inputClass} type="number" min={min} max={max} step={step} value={String(form[field] ?? "")} onChange={(event) => set(field, Number(event.target.value))} />
  );
  const yesNo = (field: keyof DailyCheckIn) => (
    <select className={inputClass} value={String(form[field])} onChange={(event) => set(field, event.target.value === "true")}>
      <option value="false">No</option>
      <option value="true">Yes</option>
    </select>
  );

  return <div className="grid gap-4 lg:grid-cols-[1fr_0.65fr]">
    <Card eyebrow="Daily Check-In" title="Log today’s recovery signals">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Date"><input className={inputClass} type="date" value={form.date} onChange={(event) => set("date", event.target.value)} /></Field>
        <Field label="Weight (lb)">{numberInput("weight", 1, 1000, "0.1")}</Field>
        <Field label="Sleep hours">{numberInput("sleepHours", 0, 24, "0.25")}</Field>
        <Field label="Energy 1-10">{numberInput("energy", 1, 10)}</Field>
        <Field label="Soreness 1-10">{numberInput("soreness", 1, 10)}</Field>
        <Field label="Stress 1-10">{numberInput("stress", 1, 10)}</Field>
        <Field label="Steps">{numberInput("steps", 0, 100000)}</Field>
        <Field label="Alcohol yesterday">{yesNo("alcohol")}</Field>
        <Field label="Workout completed">{yesNo("workoutCompleted")}</Field>
        <Field label="Run completed">{yesNo("runCompleted")}</Field>
        <label className="grid gap-1 text-sm text-zinc-300 md:col-span-2"><span>Notes</span><textarea className={inputClass} rows={4} value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Anything the coach should know about today?" /></label>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button onClick={save} className="rounded-full bg-amber-400 px-5 py-3 font-black text-black">Save check-in</button>
        <p className="text-sm text-zinc-400">One entry is kept per date. Saving this date updates today’s log instead of duplicating it.</p>
      </div>
    </Card>
    <Card eyebrow="Today’s Recovery Status" title={displayedStatus.status}>
      <div className={classNames("rounded-3xl border p-5", statusClasses)}>
        <p className="text-xs font-black uppercase tracking-[0.25em]">{savedStatus ? "Saved status" : "Live preview"}</p>
        <p className="mt-2 text-4xl font-black">{displayedStatus.status}</p>
        <p className="mt-3 text-lg font-bold">{displayedStatus.recommendation}</p>
        <p className="mt-3 text-sm leading-6 opacity-90">{displayedStatus.reasoning}</p>
      </div>
      <div className="mt-4 grid gap-3">
        <Stat label="Sleep" value={`${form.sleepHours}h`} tone={form.sleepHours >= 6.5 ? "green" : form.sleepHours >= 5 ? "yellow" : "red"} />
        <Stat label="Soreness" value={`${form.soreness}/10`} tone={form.soreness <= 5 ? "green" : form.soreness <= 7 ? "yellow" : "red"} />
        <Stat label="Stress" value={`${form.stress}/10`} tone={form.stress <= 3 ? "green" : form.stress === 4 ? "yellow" : "red"} />
        <Stat label="Energy" value={`${form.energy}/10`} tone={form.energy >= 3 ? "green" : form.energy === 2 ? "yellow" : "red"} />
        <Stat label="Alcohol" value={form.alcohol ? "Yes" : "No"} tone={form.alcohol ? "yellow" : "green"} />
      </div>
      <p className="mt-4 text-xs text-zinc-500">Rules applied from /05_API_and_Data/adjustment_rules.md: Red overrides Yellow; otherwise Green means follow plan, Yellow means modify dose.</p>
    </Card>
  </div>;
}

function ModeSelector({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const modes: Array<{ value: AppMode; label: string; description: string }> = [
    { value: "coach", label: "Coach", description: "The app tells you what to do and adjusts the plan." },
    { value: "tracker", label: "Tracker", description: "Follow the plan and log freely with light guidance." },
    { value: "manual", label: "Manual", description: "Use the workout as a template and override freely." },
  ];
  const currentMode = state.appMode ?? "coach";
  return <div className="grid gap-2 md:grid-cols-3">{modes.map((mode) => <button key={mode.value} onClick={() => updateState({ ...state, appMode: mode.value })} className={classNames("rounded-2xl border p-4 text-left", currentMode === mode.value ? "border-amber-300 bg-amber-400 text-black" : "border-white/10 bg-white/[0.03] text-zinc-300")}><b>{mode.label} Mode</b><p className={classNames("mt-1 text-xs", currentMode === mode.value ? "text-black/70" : "text-zinc-500")}>{mode.description}</p></button>)}</div>;
}

const blankWorkoutExercise = (id: string, name: string): WorkoutLoggerExerciseInput => ({ id, name, sets: 3, reps: 8, weight: 0, rpe: 7, painNotes: "", completed: true });

function WorkoutLogger({ state, updateState, latestCheckIn }: { state: AppState; updateState: (s: AppState) => void; latestCheckIn?: DailyCheckIn }) {
  const [form, setForm] = useState<WorkoutLoggerInput>({
    id: uid("manual-workout"),
    userId: state.user.id,
    date: todayIso(),
    workoutType: "upper strength",
    exercises: [blankWorkoutExercise("manual-ex-1", "Bench Press"), blankWorkoutExercise("manual-ex-2", "Row")],
    completed: true,
    sorenessLevel: latestCheckIn?.soreness ?? 4,
    sleepHours: latestCheckIn?.sleepHours ?? 7,
  });
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const set = (field: keyof WorkoutLoggerInput, value: string | number | boolean | WorkoutLoggerExerciseInput[]) => setForm({ ...form, [field]: value });
  const setExercise = (index: number, field: keyof WorkoutLoggerExerciseInput, value: string | number | boolean) => set("exercises", form.exercises.map((exercise, i) => i === index ? { ...exercise, [field]: value } : exercise));
  const session = buildWorkoutLoggerSession(form);
  const preview = evaluateWorkoutLoggerResult(session, { sorenessLevel: form.sorenessLevel, sleepHours: form.sleepHours });
  const savedSession = savedSessionId ? state.workoutSessions.find((entry) => entry.id === savedSessionId) : null;
  const savedResult = savedSession ? evaluateWorkoutLoggerResult(savedSession, { sorenessLevel: form.sorenessLevel, sleepHours: form.sleepHours }) : null;
  const save = () => {
    const nextSession = buildWorkoutLoggerSession({ ...form, id: savedSessionId ?? form.id });
    const saved = saveWorkoutLoggerEntry(state, nextSession, { sorenessLevel: form.sorenessLevel, sleepHours: form.sleepHours });
    updateState(saved.state);
    setSavedSessionId(nextSession.id);
  };
  const result = savedResult ?? preview;
  return <Card eyebrow="Workout Logger" title="Manual workout log"><div className="grid gap-3 md:grid-cols-2">
    <Field label="Workout date"><input className={inputClass} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
    <Field label="Workout type"><select className={inputClass} value={form.workoutType} onChange={(e) => set("workoutType", e.target.value as WorkoutLoggerType)}><option value="upper strength">Upper strength</option><option value="lower strength">Lower strength</option><option value="Greek god hypertrophy">Greek god hypertrophy</option><option value="recovery">Recovery</option></select></Field>
    <Field label="Sleep hours"><input className={inputClass} type="number" step="0.1" value={form.sleepHours} onChange={(e) => set("sleepHours", Number(e.target.value))} /></Field>
    <Field label="Soreness 1-10"><input className={inputClass} type="number" min="1" max="10" value={form.sorenessLevel} onChange={(e) => set("sorenessLevel", Number(e.target.value))} /></Field>
    <Field label="Completed"><select className={inputClass} value={String(form.completed)} onChange={(e) => set("completed", e.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></Field>
  </div><div className="mt-4 grid gap-3">{form.exercises.map((exercise, index) => <div key={exercise.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="mb-3 font-bold text-white">Exercise {index + 1}</p><div className="grid gap-3 md:grid-cols-3"><Field label="Exercise"><input className={inputClass} value={exercise.name} onChange={(e) => setExercise(index, "name", e.target.value)} /></Field><Field label="Sets"><input className={inputClass} type="number" min="0" value={exercise.sets} onChange={(e) => setExercise(index, "sets", Number(e.target.value))} /></Field><Field label="Reps"><input className={inputClass} type="number" min="0" value={exercise.reps} onChange={(e) => setExercise(index, "reps", Number(e.target.value))} /></Field><Field label="Weight"><input className={inputClass} type="number" min="0" value={exercise.weight} onChange={(e) => setExercise(index, "weight", Number(e.target.value))} /></Field><Field label="RPE"><input className={inputClass} type="number" min="1" max="10" value={exercise.rpe} onChange={(e) => setExercise(index, "rpe", Number(e.target.value))} /></Field><Field label="Exercise completed"><select className={inputClass} value={String(exercise.completed)} onChange={(e) => setExercise(index, "completed", e.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></Field><label className="grid gap-1 text-sm text-zinc-300 md:col-span-3">Pain notes<textarea className={inputClass} value={exercise.painNotes} onChange={(e) => setExercise(index, "painNotes", e.target.value)} /></label></div></div>)}</div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save workout log</button><div className="mt-5 grid gap-4"><div className="grid gap-3 sm:grid-cols-3"><Stat label={savedResult ? "Workout summary" : "Preview summary"} value={`${result.summary.totalSets} sets`} sub={`${result.summary.totalReps} reps · ${result.summary.estimatedVolume} lb volume`} tone="neutral" /><Stat label="Suggested next progression" value={result.nextProgression.action} sub={result.nextProgression.message} tone={result.nextProgression.action === "progress" ? "green" : result.nextProgression.action === "repeat" ? "yellow" : "red"} /><Stat label="Volume warning" value={result.volumeWarning ? `${result.volumeWarning.reductionPercent}% reduction` : "None"} sub={result.volumeWarning?.message ?? "Sleep/soreness do not require a volume cut"} tone={result.volumeWarning ? "red" : "green"} /></div><div className="rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">{savedResult ? "Saved workout summary" : "Live workout preview"}</p><h3 className="mt-2 text-2xl font-black">{result.summary.coachSummary}</h3><p className="mt-2 text-sm font-bold">{result.nextProgression.reason}</p>{result.volumeWarning ? <p className="mt-3 rounded-2xl bg-red-950/20 p-3 text-sm font-black">Warning: {result.volumeWarning.reason}</p> : null}</div></div></Card>;
}

function WorkoutPreview({ state, updateState, selectedWeek, setSelectedWeek, selectedDay, setSelectedDay, readiness, workout, originalWorkout, latestCheckIn, runningRecommendation }: { state: AppState; updateState: (s: AppState) => void; selectedWeek: number; setSelectedWeek: (n: number) => void; selectedDay: number; setSelectedDay: (n: number) => void; readiness: any; workout: any; originalWorkout: any; latestCheckIn?: DailyCheckIn; runningRecommendation?: any }) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const mode = state.appMode ?? "coach";
  const preview = generateWorkoutPreview({ mode, originalWorkout, adjustedWorkout: workout, readiness, checkIn: latestCheckIn });
  const displayedWorkout = preview.showAdjustedWorkout ? workout : originalWorkout;
  const futureRecommendations = state.postWorkoutRecommendations.filter((recommendation) => recommendation.workoutId === displayedWorkout.id);
  const tone = readiness.status === "Green" ? "green" : readiness.status === "Yellow" ? "yellow" : "red";
  const completion = summarizeWorkoutCompletionCards({ workouts: [displayedWorkout], sessions: state.workoutSessions.filter((session) => session.workoutId === displayedWorkout.id) });
  const activeSession = (activeSessionId ? state.workoutSessions.find((session) => session.id === activeSessionId) : null)
    ?? [...state.workoutSessions].reverse().find((session) => session.workoutId === displayedWorkout.id && session.status === "active");

  const startWorkout = () => {
    const now = new Date().toISOString();
    const session: WorkoutSession = {
      id: uid("session"),
      userId: state.user.id,
      workoutId: displayedWorkout.id,
      workoutTitle: displayedWorkout.title,
      mode,
      startedAt: now,
      status: displayedWorkout.exercises.length ? "active" : "completed",
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      setLogs: [],
      endedAt: displayedWorkout.exercises.length ? undefined : now,
    };
    updateState({ ...state, workoutSessions: [...state.workoutSessions, session] });
    setActiveSessionId(session.id);
  };

  if (activeSession) {
    return <ActiveWorkout state={state} updateState={updateState} session={activeSession} workout={displayedWorkout} readinessStatus={readiness.status} onBackToPreview={() => setActiveSessionId(null)} />;
  }

  return <div className="grid gap-4"><WorkoutLogger state={state} updateState={updateState} latestCheckIn={latestCheckIn} /><Card eyebrow="Session Control" title="Mode, readiness, and workout receipts"><div className="grid gap-4 lg:grid-cols-[1fr_0.75fr]"><ModeSelector state={state} updateState={updateState} /><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><Stat label="Readiness" value={`${readiness.status} — ${readiness.score}`} sub={readiness.reason} tone={tone} /><Stat label="This workout" value={`${completion.completionPercent}%`} sub={completion.coachCopy} tone={completion.activeSessions ? "yellow" : "green"} /><Stat label="Mode clarity" value={preview.modeLabel} sub={preview.focus} /></div></div></Card><Card eyebrow="Today’s Workout Preview" title={displayedWorkout.title}><div className="grid gap-3 sm:grid-cols-3"><Field label="Week"><select className={inputClass} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>Week {i+1}</option>)}</select></Field><Field label="Day"><select className={inputClass} value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field><Stat label="Readiness" value={`${readiness.status} — ${readiness.score}`} sub={readiness.reason} tone={tone} /></div><div className="mt-5 rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">{preview.modeLabel}</p><h3 className="mt-2 text-2xl font-black">{preview.primaryInstruction}</h3><p className="mt-2 text-sm font-medium">Focus: {preview.focus}</p></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">Coach notes</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-300">{preview.coachNotes.map((note) => <li key={note}>• {note}</li>)}</ul></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">What changed from the original plan</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-300">{preview.whatChanged.map((change) => <li key={change}>• {change}</li>)}</ul></div></div>{runningRecommendation && (displayedWorkout.longRunMiles || /run|conditioning/i.test(displayedWorkout.type)) && <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm text-sky-100"><b>Running engine:</b> {runningRecommendation.action} · {runningRecommendation.message}<ul className="mt-2 grid gap-1 text-xs">{runningRecommendation.reasons.slice(0, 4).map((reason: string) => <li key={reason}>• {reason}</li>)}</ul></div>}{preview.substitutions.length > 0 && <div className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-500/10 p-4 text-sm text-yellow-100"><b>Pain-aware substitutions:</b><ul className="mt-2 grid gap-1">{preview.substitutions.map((sub) => <li key={sub}>• {sub}</li>)}</ul></div>}{futureRecommendations.length > 0 && <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100"><b>Stored next-session recommendations:</b><ul className="mt-2 grid gap-1">{futureRecommendations.slice(-6).map((recommendation) => <li key={recommendation.id ?? recommendation.message}>• {recommendation.message}</li>)}</ul></div>}<div className="mt-5 grid gap-3">{displayedWorkout.exercises.length ? displayedWorkout.exercises.map((exercise: Exercise) => {
    const original = originalWorkout.exercises.find((item: Exercise) => item.id === exercise.id);
    const changed = original && original.prescribedSets !== exercise.prescribedSets;
    return <div key={exercise.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="font-bold text-white">{exercise.order}. {exercise.name}</h4><p className="text-sm text-zinc-400">Target: {exercise.prescribedSets} x {exercise.prescribedReps} · RPE ≤{exercise.prescribedRpe ?? 8}</p></div>{changed && <p className="text-xs text-yellow-300">Adjusted from {original.prescribedSets} sets</p>}</div></div>;
  }) : <p className="rounded-2xl bg-red-950/40 p-4 text-red-200">Recovery replacement: walk, mobility, easy Zone 2, hydration, sleep, or full rest.</p>}</div><button onClick={startWorkout} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">{preview.startButtonLabel}</button></Card></div>;
}

function coachingCue(exercise: Exercise) {
  const name = exercise.name.toLowerCase();
  if (name.includes("bench") || name.includes("press")) return "Brace, control the lowering, and finish each rep without shoulder irritation.";
  if (name.includes("squat") || name.includes("deadlift")) return "Brace before every rep, keep the bar path clean, and stop before grinders.";
  if (name.includes("run") || name.includes("sprint")) return "Stay smooth and athletic; never trade mechanics for speed.";
  if (name.includes("mobility") || name.includes("walk")) return "Keep it easy, nasal-breathing friendly, and pain-free.";
  return "Own the tempo, keep form crisp, and leave 1-2 reps in reserve.";
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function ActiveWorkout({ state, updateState, session, workout, readinessStatus, onBackToPreview }: { state: AppState; updateState: (s: AppState) => void; session: WorkoutSession; workout: any; readinessStatus: "Green" | "Yellow" | "Red"; onBackToPreview: () => void }) {
  const currentExercise = workout.exercises[session.currentExerciseIndex] as Exercise | undefined;
  const recommendedWeight = currentExercise ? getRecommendedStartingWeight(currentExercise.id, state.setLogs) : 0;
  const [form, setForm] = useState({ weightUsed: recommendedWeight, repsCompleted: currentExercise?.prescribedReps.match(/\d+/)?.[0] ?? "", rpe: currentExercise?.prescribedRpe ?? 8, pain: false, formQuality: "solid" as FormQuality });
  const [rest, setRest] = useState<{ decision: CoachDecision; secondsRemaining: number; paused: boolean } | null>(null);

  useEffect(() => {
    if (currentExercise && !rest) setForm({ weightUsed: getRecommendedStartingWeight(currentExercise.id, state.setLogs), repsCompleted: currentExercise.prescribedReps.match(/\d+/)?.[0] ?? "", rpe: currentExercise.prescribedRpe ?? 8, pain: false, formQuality: "solid" });
  }, [currentExercise, session.currentSetNumber, state.setLogs, rest]);

  useEffect(() => {
    if (!rest || rest.paused || rest.secondsRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setRest((current) => current ? { ...current, secondsRemaining: Math.max(0, current.secondsRemaining - 1) } : null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rest]);

  const applyDecisionToForm = (decision: CoachDecision) => {
    setForm({ weightUsed: decision.nextWeight, repsCompleted: decision.nextReps.match(/\d+/)?.[0] ?? decision.nextReps, rpe: decision.targetRpe, pain: false, formQuality: "solid" });
  };

  const startNextSet = () => {
    if (rest) applyDecisionToForm(rest.decision);
    setRest(null);
  };

  const persistSession = (nextSession: WorkoutSession, extraSetLog?: SetLog, extraAdjustments: AppState["adjustments"] = []) => {
    updateState({
      ...state,
      workoutSessions: state.workoutSessions.map((item) => item.id === nextSession.id ? nextSession : item),
      setLogs: extraSetLog ? [...state.setLogs, extraSetLog] : state.setLogs,
      adjustments: extraAdjustments.length ? [...state.adjustments, ...extraAdjustments] : state.adjustments,
    });
  };

  const completeSet = () => {
    if (!currentExercise || rest) return;
    const now = new Date().toISOString();
    const setId = uid("set");
    const baseSetLog: SetLog = {
      id: setId,
      sessionId: session.id,
      userId: state.user.id,
      workoutId: workout.id,
      exerciseId: currentExercise.id,
      exerciseName: currentExercise.name,
      setNumber: session.currentSetNumber,
      targetReps: currentExercise.prescribedReps,
      targetRpe: currentExercise.prescribedRpe ?? 8,
      weightUsed: Number(form.weightUsed) || 0,
      repsCompleted: Number(form.repsCompleted) || 0,
      rpe: Number(form.rpe) || 0,
      pain: form.pain,
      formQuality: form.formQuality,
      completedAt: now,
    };
    const coachDecision: CoachDecision = {
      ...generateNextSetRecommendation({ setLog: baseSetLog, readinessStatus }),
      id: uid("decision"),
      sessionId: session.id,
      setLogId: setId,
      createdAt: now,
    };
    const setLog: SetLog = { ...baseSetLog, coachDecision };
    const nextSession = getNextWorkoutStep(session, workout, setLog, now);
    const importantDecision = coachDecision.action !== "repeat" || form.pain || Number(form.rpe) >= 9 || form.formQuality !== "solid";
    const decisionLog = importantDecision ? createCoachDecisionLogEntry({
      id: uid("adj"),
      userId: state.user.id,
      date: now,
      category: "Set-by-set coach decision",
      originalPrescription: `${currentExercise.name} set ${session.currentSetNumber}: ${baseSetLog.weightUsed} lb x ${currentExercise.prescribedReps} @ RPE ≤${currentExercise.prescribedRpe ?? 8}`,
      adjustedPrescription: `${coachDecision.nextWeight} lb x ${coachDecision.nextReps}, rest ${coachDecision.restSeconds}s`,
      reason: coachDecision.reason,
      triggerData: { repsCompleted: baseSetLog.repsCompleted, rpe: baseSetLog.rpe, pain: baseSetLog.pain, formQuality: baseSetLog.formQuality, readinessStatus },
      confidence: baseSetLog.pain || readinessStatus === "Red" ? "High" : "Medium",
      mode: "automatic",
      notes: coachDecision.message,
    }) : null;
    persistSession(nextSession, setLog, decisionLog ? [decisionLog] : []);
    if (nextSession.status === "active") setRest({ decision: coachDecision, secondsRemaining: coachDecision.restSeconds, paused: false });
  };

  const skipExercise = () => {
    if (!currentExercise) return;
    const nextIndex = session.currentExerciseIndex + 1;
    const now = new Date().toISOString();
    const nextSession: WorkoutSession = nextIndex >= workout.exercises.length
      ? { ...session, status: "completed", endedAt: now }
      : { ...session, currentExerciseIndex: nextIndex, currentSetNumber: 1 };
    setRest(null);
    persistSession(nextSession);
  };

  const endWorkout = () => {
    setRest(null);
    persistSession({ ...session, status: "ended", endedAt: new Date().toISOString() });
  };
  const previousSets = currentExercise ? session.setLogs.filter((log) => log.exerciseId === currentExercise.id) : [];
  const totalSets = workout.exercises.reduce((sum: number, exercise: Exercise) => sum + exercise.prescribedSets, 0);
  const completedSets = session.setLogs.length;
  const sessionPercent = totalSets ? Math.round((completedSets / totalSets) * 100) : 0;
  const storedSummary = state.workoutSummaries.find((summary) => summary.sessionId === session.id);
  const workoutSummary = session.status === "completed" ? storedSummary ?? generatePostWorkoutAnalysis({ session, workout }) : null;

  useEffect(() => {
    if (session.status !== "completed" || storedSummary || !workoutSummary) return;
    const summaryId = uid("summary");
    const recommendations = workoutSummary.nextSessionRecommendations.map((recommendation) => ({ ...recommendation, id: uid("postrec") }));
    const summary = { ...workoutSummary, id: summaryId, nextSessionRecommendations: recommendations };
    const adjustment = createCoachDecisionLogEntry({
      id: uid("adj"),
      userId: state.user.id,
      date: new Date().toISOString(),
      category: "Future workout recommendation",
      originalPrescription: workout.title,
      adjustedPrescription: recommendations.map((recommendation) => recommendation.message).join(" | ") || "Repeat the plan as written.",
      reason: summary.coachSummary,
      triggerData: { highRpeFlags: summary.highRpeFlags.length, missedRepFlags: summary.missedRepFlags.length, painFlags: summary.painFlags.length, poorFormFlags: summary.poorFormFlags.length, completionPercentage: summary.completionPercentage },
      confidence: summary.painFlags.length || summary.highRpeFlags.length ? "High" : "Medium",
      mode: "automatic",
      notes: `Post-workout analysis for ${session.id}`,
    });
    updateState({
      ...state,
      workoutSummaries: [...state.workoutSummaries, summary],
      postWorkoutRecommendations: [...state.postWorkoutRecommendations, ...recommendations],
      adjustments: [...state.adjustments, adjustment],
    });
  }, [session, storedSummary, workout, workoutSummary, state, updateState]);

  if (session.status !== "active" || !currentExercise) {
    if (session.status === "completed" && workoutSummary) {
      return <Card eyebrow="Workout Complete" title="Workout complete"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Completion" value={`${workoutSummary.completionPercentage}%`} sub={`${workoutSummary.totalReps} / ${workoutSummary.prescribedReps} target reps`} tone={workoutSummary.completionPercentage >= 100 ? "green" : "yellow"} /><Stat label="Exercises completed" value={`${workoutSummary.exercisesCompleted} / ${workoutSummary.totalExercises}`} /><Stat label="Total sets" value={workoutSummary.totalSets} sub={`${workoutSummary.prescribedSets} prescribed`} /><Stat label="Total reps" value={workoutSummary.totalReps} /><Stat label="Estimated volume" value={`${workoutSummary.estimatedVolume} lb`} /><Stat label="Flags" value={workoutSummary.highRpeFlags.length + workoutSummary.missedRepFlags.length + workoutSummary.painFlags.length} sub={`${workoutSummary.highRpeFlags.length} high RPE · ${workoutSummary.missedRepFlags.length} missed · ${workoutSummary.painFlags.length} pain`} tone={workoutSummary.painFlags.length ? "red" : workoutSummary.highRpeFlags.length || workoutSummary.missedRepFlags.length ? "yellow" : "green"} /></div><div className="mt-5 rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">Coach summary</p><p className="mt-2 text-lg font-black">{workoutSummary.coachSummary}</p></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">Best sets</h3><div className="mt-3 grid gap-2">{workoutSummary.bestSets.map((log) => <p key={log.id} className="text-sm text-zinc-300">{log.exerciseName} set {log.setNumber}: {log.weightUsed} lb x {log.repsCompleted} · RPE {log.rpe}</p>)}</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">Next-session recommendations</h3><div className="mt-3 grid gap-2">{workoutSummary.nextSessionRecommendations.map((recommendation, index) => <p key={recommendation.id ?? `${recommendation.action}-${index}`} className="text-sm text-zinc-300"><b className="text-amber-200">{recommendation.action}</b>: {recommendation.message}</p>)}</div></div></div><div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">High-RPE flags</h3>{workoutSummary.highRpeFlags.length ? workoutSummary.highRpeFlags.map((log) => <p key={log.id} className="mt-2 text-sm text-zinc-300">{log.exerciseName} set {log.setNumber}: RPE {log.rpe}</p>) : <p className="mt-2 text-sm text-zinc-500">None</p>}</div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">Missed-rep flags</h3>{workoutSummary.missedRepFlags.length ? workoutSummary.missedRepFlags.map((log) => <p key={log.id} className="mt-2 text-sm text-zinc-300">{log.exerciseName} set {log.setNumber}: {log.repsCompleted} / {log.targetReps}</p>) : <p className="mt-2 text-sm text-zinc-500">None</p>}</div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">Pain flags</h3>{workoutSummary.painFlags.length ? workoutSummary.painFlags.map((log) => <p key={log.id} className="mt-2 text-sm text-red-200">{log.exerciseName} set {log.setNumber}</p>) : <p className="mt-2 text-sm text-zinc-500">None</p>}</div></div><button onClick={onBackToPreview} className="mt-5 rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Back to workout preview</button></Card>;
    }
    return <Card eyebrow="Workout Complete" title="Workout ended"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Workout" value={workout.title} /><Stat label="Sets logged" value={completedSets} sub={`${totalSets} prescribed`} tone="yellow" /><Stat label="Exercises touched" value={new Set(session.setLogs.map((log) => log.exerciseId)).size} /></div><div className="mt-5 grid gap-3">{session.setLogs.map((log) => <div key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300"><b className="text-white">{log.exerciseName} set {log.setNumber}</b> · {log.weightUsed} lb x {log.repsCompleted} · RPE {log.rpe} · {log.formQuality}{log.pain ? " · pain flagged" : ""}</div>)}</div><button onClick={onBackToPreview} className="mt-5 rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Back to workout preview</button></Card>;
  }

  return <div className="grid gap-4 lg:grid-cols-[1fr_0.65fr]"><Card eyebrow="Active Workout" title={currentExercise.name}><div className="mb-5 rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4"><div className="flex items-center justify-between gap-3"><p className="font-black text-white">Session progress</p><p className="text-sm font-black text-amber-200">{completedSets}/{totalSets} sets · {sessionPercent}%</p></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: `${sessionPercent}%` }} /></div><p className="mt-2 text-sm text-zinc-300">{session.mode === "coach" ? "Coach mode: log honestly and follow next-set decisions." : session.mode === "tracker" ? "Tracker mode: keep the plan visible while you log." : "Manual mode: override freely, but keep clean records."}</p></div><div className="grid gap-3 sm:grid-cols-3"><Stat label="Current set" value={`${session.currentSetNumber} / ${currentExercise.prescribedSets}`} sub={`Exercise ${session.currentExerciseIndex + 1} of ${workout.exercises.length}`} /><Stat label="Target reps" value={currentExercise.prescribedReps} sub={`RPE ≤${currentExercise.prescribedRpe ?? 8}`} /><Stat label="Recommended start" value={`${recommendedWeight} lb`} sub={recommendedWeight > 0 ? "last successful working weight" : "no safe history — enter load"} tone={recommendedWeight > 0 ? "green" : "yellow"} /></div>{rest ? <div className="mt-5 rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">Rest timer</p><p className="mt-2 text-5xl font-black">{formatSeconds(rest.secondsRemaining)}</p><p className="mt-3 text-lg font-black">{rest.decision.message}</p><div className="mt-3 grid gap-2 text-sm font-medium sm:grid-cols-3"><span>Next: {rest.decision.nextWeight} lb x {rest.decision.nextReps}</span><span>Target RPE ≤{rest.decision.targetRpe}</span><span>Rest: {formatSeconds(rest.decision.restSeconds)}</span></div><p className="mt-2 text-sm">Reason: {rest.decision.reason}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><button onClick={() => setRest({ ...rest, paused: !rest.paused })} className="rounded-2xl bg-black px-4 py-3 font-black text-white">{rest.paused ? "Resume" : "Pause"}</button><button onClick={() => setRest({ ...rest, secondsRemaining: rest.secondsRemaining + 30 })} className="rounded-2xl border border-black/20 px-4 py-3 font-black text-black">Add 30 sec</button><button onClick={startNextSet} className="rounded-2xl border border-black/20 px-4 py-3 font-black text-black">Skip rest / start next set</button></div></div> : <div className="mt-5 rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">Coaching cue</p><p className="mt-2 text-lg font-black">{coachingCue(currentExercise)}</p></div>}<div className="mt-5 grid gap-3 md:grid-cols-2"><Field label="Actual weight"><input className={inputClass} type="number" disabled={Boolean(rest)} value={form.weightUsed} onChange={(e) => setForm({ ...form, weightUsed: Number(e.target.value) })} /></Field><Field label="Actual reps"><input className={inputClass} type="number" disabled={Boolean(rest)} value={form.repsCompleted} onChange={(e) => setForm({ ...form, repsCompleted: e.target.value })} /></Field><Field label="Actual RPE"><input className={inputClass} type="number" disabled={Boolean(rest)} min="1" max="10" value={form.rpe} onChange={(e) => setForm({ ...form, rpe: Number(e.target.value) })} /></Field><Field label="Pain"><select className={inputClass} disabled={Boolean(rest)} value={String(form.pain)} onChange={(e) => setForm({ ...form, pain: e.target.value === "true" })}><option value="false">No pain</option><option value="true">Pain flagged</option></select></Field><Field label="Form quality"><select className={inputClass} disabled={Boolean(rest)} value={form.formQuality} onChange={(e) => setForm({ ...form, formQuality: e.target.value as FormQuality })}><option value="solid">Solid</option><option value="minor breakdown">Minor breakdown</option><option value="missed">Missed / unsafe</option></select></Field></div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button onClick={completeSet} disabled={Boolean(rest)} className="rounded-2xl bg-amber-400 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-50">Complete Set</button><button onClick={skipExercise} className="rounded-2xl border border-white/15 px-4 py-3 text-zinc-300">Skip exercise</button><button onClick={endWorkout} className="rounded-2xl border border-red-300/30 px-4 py-3 text-red-200">End workout</button></div></Card><Card eyebrow="Current Exercise" title="Previous sets"><p className="text-sm text-zinc-400">{workout.title}</p><div className="mt-4 grid gap-3">{previousSets.length ? previousSets.map((log) => <div key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Set {log.setNumber}: {log.weightUsed} lb x {log.repsCompleted} · RPE {log.rpe} · {log.formQuality}{log.pain ? " · pain" : ""}{log.coachDecision ? <p className="mt-2 text-xs text-amber-200">Next: {log.coachDecision.nextWeight} lb x {log.coachDecision.nextReps} · {log.coachDecision.action}</p> : null}</div>) : <p className="rounded-2xl bg-white/[0.03] p-4 text-sm text-zinc-500">No sets logged for this exercise yet.</p>}<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">Session progress: {completedSets} / {totalSets} sets complete</div></div></Card></div>;
}


function Running({ state, updateState, trends, plannedDistance }: { state: AppState; updateState: (s: AppState) => void; recommendation: any; trends: any; plannedDistance: number }) {
  const [form, setForm] = useState<RunLoggerInput>({
    id: uid("run"),
    userId: state.user.id,
    date: todayIso(),
    runType: "easy",
    distance: plannedDistance,
    durationMinutes: Math.round(plannedDistance * 11),
    averagePace: 11,
    averageHeartRate: 140,
    rpe: 5,
    walkBreaks: false,
    painScore: 0,
    notes: "",
  });
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const set = (field: keyof RunLoggerInput, value: string | number | boolean) => setForm({ ...form, [field]: value });
  const currentRecord = buildRunLoggerRecord(form);
  const liveResult = evaluateRunLoggerResult(currentRecord);
  const savedRun = savedRunId ? state.runLogs.find((run) => run.id === savedRunId) : null;
  const savedResult = savedRun ? evaluateRunLoggerResult(savedRun) : null;
  const save = () => {
    const record = buildRunLoggerRecord({ ...form, id: savedRunId ?? form.id });
    const saved = saveRunLoggerEntry(state, record);
    updateState(saved.state);
    setSavedRunId(record.id);
  };
  const logs = [...(state.runLogs ?? [])].sort((a: RunLog, b: RunLog) => b.date.localeCompare(a.date));
  const runTrendCards = buildRunTrendCards(trends ?? calculateRunTrends([]));
  const decisionTone = (decision: string) => decision === "progress" ? "green" : decision === "deload" ? "red" : "yellow";
  return <div className="grid gap-4">
    <Card eyebrow="Run Logger" title="Manual run log"><div className="grid gap-3 md:grid-cols-2">
      <Field label="Date"><input className={inputClass} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
      <Field label="Run type"><select className={inputClass} value={form.runType} onChange={(e) => set("runType", e.target.value as RunType)}><option value="easy">Easy</option><option value="speed">Speed</option><option value="tempo">Tempo</option><option value="long run">Long run</option><option value="race">Race</option></select></Field>
      <Field label="Distance"><input className={inputClass} type="number" step="0.1" min="0" value={form.distance} onChange={(e) => set("distance", Number(e.target.value))} /></Field>
      <Field label="Duration"><input className={inputClass} type="number" step="1" min="0" value={form.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></Field>
      <Field label="Average pace"><input className={inputClass} type="number" step="0.1" min="0" value={form.averagePace ?? ""} onChange={(e) => set("averagePace", Number(e.target.value))} /></Field>
      <Field label="Average heart rate"><input className={inputClass} type="number" min="0" value={form.averageHeartRate} onChange={(e) => set("averageHeartRate", Number(e.target.value))} /></Field>
      <Field label="RPE 1-10"><input className={inputClass} type="number" min="1" max="10" value={form.rpe} onChange={(e) => set("rpe", Number(e.target.value))} /></Field>
      <Field label="Walk breaks"><select className={inputClass} value={String(form.walkBreaks)} onChange={(e) => set("walkBreaks", e.target.value === "true")}><option value="false">No</option><option value="true">Yes</option></select></Field>
      <Field label="Pain score 0-10"><input className={inputClass} type="number" min="0" max="10" value={form.painScore} onChange={(e) => set("painScore", Number(e.target.value))} /></Field>
      <label className="grid gap-1 text-sm text-zinc-300 md:col-span-2">Notes<textarea className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
    </div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save run log</button></Card>

    <Card eyebrow="After save" title="Run summary + next run decision">
      {savedResult ? <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3"><Stat label="Run summary" value={`${savedResult.runSummary.distance} mi`} sub={`${savedResult.runSummary.runType} · ${savedResult.runSummary.durationMinutes} min · ${savedResult.runSummary.averagePace} pace`} tone="neutral" /><Stat label="Next run" value={savedResult.nextRunDecision} sub={savedResult.recommendation} tone={decisionTone(savedResult.nextRunDecision)} /><Stat label="Pain" value={`${savedResult.runSummary.painScore}/10`} sub={savedResult.painWarning ?? "No high-pain warning"} tone={savedResult.painWarning ? "red" : "green"} /></div>
        <div className="rounded-3xl bg-sky-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">Saved run summary</p><h3 className="mt-2 text-2xl font-black">{savedResult.summary}</h3><ul className="mt-3 grid gap-1 text-sm font-bold">{savedResult.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>{savedResult.painWarning ? <p className="mt-3 rounded-2xl bg-red-950/20 p-3 text-sm font-black">Warning: {savedResult.painWarning}</p> : null}</div>
      </div> : <div className="grid gap-3 sm:grid-cols-3"><Stat label="Preview next run" value={liveResult.nextRunDecision} sub={liveResult.recommendation} tone={decisionTone(liveResult.nextRunDecision)} /><Stat label="Preview summary" value={`${liveResult.runSummary.distance} mi`} sub="Save to lock this run into history" /><Stat label="High pain warning" value={liveResult.painWarning ? "Yes" : "No"} sub={liveResult.painWarning ?? "Pain stays below high-risk threshold"} tone={liveResult.painWarning ? "red" : "green"} /></div>}
    </Card>

    <Card eyebrow="Run Trends" title="Distance, pace, RPE, long run"><div className="mb-4 grid gap-3 sm:grid-cols-2">{runTrendCards.map((card) => <Stat key={card.label} label={card.label} value={card.value} sub={card.coachCopy} tone={card.tone === "neutral" ? "neutral" : card.tone} />)}</div><div className="grid gap-4"><div><p className="mb-2 text-sm font-bold text-zinc-300">Distance trend</p><Sparkline values={trends?.distanceTrend ?? []} color="#38bdf8" /></div><div><p className="mb-2 text-sm font-bold text-zinc-300">Pace trend</p><Sparkline values={trends?.paceTrend ?? []} color="#f59e0b" /></div><div><p className="mb-2 text-sm font-bold text-zinc-300">RPE trend</p><Sparkline values={trends?.rpeTrend ?? []} color="#ef4444" /></div><div><p className="mb-2 text-sm font-bold text-zinc-300">Long-run progression</p><Sparkline values={trends?.longRunProgression ?? []} color="#22c55e" /></div></div></Card>
    <Card eyebrow="History" title="Recent running logs"><div className="grid gap-3 md:grid-cols-3">{logs.length ? logs.slice(0, 9).map((run: RunLog) => <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300"><b className="text-white">{run.date}</b><p>{run.runType ?? "easy"} · {run.actualDistance} mi · {run.durationMinutes} min · {run.averagePace} pace</p><p>HR {run.averageHr} · RPE {run.rpe} · walk breaks {run.walkBreaks ? "yes" : "no"}</p><p>Pain {run.painScore ?? (run.pain ? 7 : 0)}/10{run.notes ? ` · ${run.notes}` : ""}</p></div>) : <p className="text-zinc-400">No run logs yet. Save today’s run to start trend tracking.</p>}</div></Card>
  </div>;
}

function NutritionLogger({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const today = todayIso();
  const existing = state.nutritionLogs.find((log) => log.date === today);
  const [savedDate, setSavedDate] = useState<string | null>(null);
  const [form, setForm] = useState<NutritionLoggerInput>({
    id: existing?.id ?? uid("nutrition"),
    userId: state.user.id,
    date: existing?.date ?? today,
    dayType: "training",
    calories: existing?.calories ?? 2600,
    protein: existing?.protein ?? 220,
    carbs: existing?.carbs ?? 250,
    fat: existing?.fat ?? 65,
    fiber: existing?.fiber ?? 30,
    water: existing?.water ?? 120,
    alcohol: Boolean(existing?.alcohol),
    notes: existing?.notes ?? "",
  });
  const set = (field: keyof NutritionLoggerInput, value: string | number | boolean) => setForm({ ...form, [field]: value });
  const target = getNutritionLoggerTarget(form.dayType);
  const previewLog = buildNutritionLogRecord(form);
  const preview = evaluateNutritionLoggerAdherence(previewLog, form.dayType);
  const savedLog = savedDate ? state.nutritionLogs.find((log) => log.date === savedDate) : null;
  const save = () => {
    const saved = saveNutritionLoggerEntry(state, form);
    updateState(saved.state);
    setSavedDate(form.date);
  };
  const numberInput = (field: keyof NutritionLoggerInput, step = 1) => <input className={inputClass} type="number" step={step} min="0" value={Number(form[field])} onChange={(event) => set(field, Number(event.target.value))} />;
  return <div className="grid gap-4">
    <Card eyebrow="Nutrition Logger" title="Daily macro log">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Date"><input className={inputClass} type="date" value={form.date} onChange={(event) => set("date", event.target.value)} /></Field>
        <Field label="Day type"><select className={inputClass} value={form.dayType} onChange={(event) => set("dayType", event.target.value as NutritionLoggerDayType)}><option value="training">Training day</option><option value="rest">Rest day</option></select></Field>
        <Field label="Calories">{numberInput("calories")}</Field>
        <Field label="Protein (g)">{numberInput("protein")}</Field>
        <Field label="Carbs (g)">{numberInput("carbs")}</Field>
        <Field label="Fat (g)">{numberInput("fat")}</Field>
        <Field label="Fiber (g)">{numberInput("fiber")}</Field>
        <Field label="Water (oz)">{numberInput("water")}</Field>
        <Field label="Alcohol"><select className={inputClass} value={String(form.alcohol)} onChange={(event) => set("alcohol", event.target.value === "true")}><option value="false">No</option><option value="true">Yes</option></select></Field>
        <label className="grid gap-1 text-sm text-zinc-300 md:col-span-2"><span>Notes</span><textarea className={inputClass} rows={4} value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Meal timing, hunger, cravings, restaurant meals, etc." /></label>
      </div>
      <button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save nutrition log</button>
    </Card>
    <Card eyebrow={savedLog ? "Saved Nutrition Summary" : "Live Nutrition Preview"} title={`${form.dayType === "training" ? "Training" : "Rest"} day targets`}>
      <div className="grid gap-3 md:grid-cols-4"><Stat label="Calories target" value={target.calories} sub={`${form.calories} logged`} tone={preview.calorieAdherencePercent >= 90 && preview.calorieAdherencePercent <= 110 ? "green" : "yellow"} /><Stat label="Protein target" value={`${target.protein}g`} sub={`${form.protein}g logged`} tone={preview.proteinAdherencePercent >= 90 ? "green" : "yellow"} /><Stat label="Carbs target" value={`${target.carbs}g`} sub={`${form.carbs}g logged`} /><Stat label="Fat target" value={`${target.fat}g`} sub={`${form.fat}g logged`} /></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><RingMetric label="Calorie adherence" value={`${preview.calorieAdherencePercent}%`} percent={Math.min(preview.calorieAdherencePercent, 100)} tone={preview.calorieAdherencePercent >= 90 && preview.calorieAdherencePercent <= 110 ? "green" : "yellow"} sub="logged calories ÷ target calories" /><RingMetric label="Protein adherence" value={`${preview.proteinAdherencePercent}%`} percent={Math.min(preview.proteinAdherencePercent, 100)} tone={preview.proteinAdherencePercent >= 90 ? "green" : "yellow"} sub="logged protein ÷ target protein" /></div>
      <div className="mt-4 rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">{savedLog ? "Saved" : "Preview"}</p><h3 className="mt-2 text-2xl font-black">{form.calories} cal · {form.protein}P / {form.carbs}C / {form.fat}F</h3><p className="mt-2 text-sm font-bold">Fiber {form.fiber}g · Water {form.water} oz · Alcohol {form.alcohol ? "yes" : "no"}</p>{form.notes && <p className="mt-2 text-sm">Notes: {form.notes}</p>}</div>
    </Card>
  </div>;
}

function BodyMetrics({ state, updateState, trend }: any) {
  const [metric, setMetric] = useState<any>({ id: uid("metric"), userId: state.user.id, date: todayIso(), weight: trend.current7DayAverage || state.user.startingWeight, waist: 37.5, chest: 43, arms: 16, thighs: 24, hips: 40, notes: "" });
  const save = () => updateState({ ...state, bodyMetrics: [...state.bodyMetrics.filter((m: any) => m.date !== metric.date), metric] });
  return <div className="grid gap-4 lg:grid-cols-2"><Card eyebrow="Trend charts" title="Body metrics"><Sparkline values={state.bodyMetrics.slice(-21).map((m: any) => m.weight)} /><div className="mt-3"><Sparkline values={state.bodyMetrics.slice(-21).map((m: any) => m.waist ?? 0)} color="#22c55e" /></div><div className="mt-3 grid grid-cols-3 gap-3"><Stat label="7-day avg" value={`${trend.current7DayAverage} lb`} /><Stat label="14-day change" value={`${trend.change14Day} lb`} /><Stat label="Waist" value={`${trend.waistChange} in`} /></div></Card><Card eyebrow="Manual input" title="Measurements"><div className="grid gap-3 md:grid-cols-2">{Object.keys(metric).filter((k) => !["id","userId"].includes(k)).map((field) => <Field key={field} label={field}><input className={inputClass} type={field === "date" ? "date" : field === "notes" ? "text" : "number"} value={metric[field]} onChange={(e) => setMetric({ ...metric, [field]: e.target.type === "number" ? Number(e.target.value) : e.target.value })} /></Field>)}</div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save measurements</button></Card></div>;
}

function ProgressPhotos({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const [photo, setPhoto] = useState<ProgressPhoto>({ id: uid("photo"), userId: state.user.id, date: todayIso(), frontPhotoUrl: "", sidePhotoUrl: "", backPhotoUrl: "", notes: "" });
  const save = () => updateState({ ...state, photos: [...state.photos, photo] });
  return <Card eyebrow="Weekly comparison" title="Progress photos"><p className="mb-4 text-sm text-zinc-400">For this MVP, paste local/object-storage URLs. The Supabase schema includes photo URL fields so storage buckets can be wired in later.</p><div className="grid gap-3 md:grid-cols-2">{["date","frontPhotoUrl","sidePhotoUrl","backPhotoUrl","notes"].map((field) => <Field key={field} label={field}><input className={inputClass} type={field === "date" ? "date" : "text"} value={(photo as any)[field] ?? ""} onChange={(e) => setPhoto({ ...photo, [field]: e.target.value })} /></Field>)}</div><button onClick={save} className="mt-5 rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save photo record</button><div className="mt-5 grid gap-3 md:grid-cols-3">{state.photos.map((p) => <div key={p.id} className="rounded-2xl bg-white/[0.03] p-3 text-sm text-zinc-400"><b className="text-white">{p.date}</b><br />Front: {p.frontPhotoUrl || "—"}<br />Side: {p.sidePhotoUrl || "—"}<br />Back: {p.backPhotoUrl || "—"}</div>)}</div></Card>;
}

function ReadinessPanel({ readiness, workoutRec, injuryRisk, latestCheckIn }: any) {
  const tone = readiness.status === "Green" ? "green" : readiness.status === "Yellow" ? "yellow" : "red";
  return <Card eyebrow="Readiness Engine" title={`${readiness.status} — ${readiness.score}/100`}><div className="grid gap-3 sm:grid-cols-3"><Stat label="Status" value={readiness.status} tone={tone} /><Stat label="Reason" value={readiness.reason} /><Stat label="Injury risk" value={injuryRisk.level} sub={injuryRisk.recommendation} tone={injuryRisk.level === "High" ? "red" : injuryRisk.level === "Moderate" ? "yellow" : "green"} /></div><p className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-sm text-zinc-300">{readiness.recommendation}</p>{workoutRec && <p className="mt-3 rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-200">Workout adjustment: {workoutRec.action}. {workoutRec.reason}</p>}<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Sleep" value={`${latestCheckIn?.sleepHours ?? 0}h`} /><Stat label="Soreness" value={latestCheckIn?.soreness ?? 0} /><Stat label="Energy" value={latestCheckIn?.energy ?? 0} /><Stat label="Stress" value={latestCheckIn?.stress ?? 0} /></div></Card>;
}

function WeeklyReviewPanel({ review }: { review: ReturnType<typeof buildWeeklyReviewSummary> | null }) {
  if (!review) return <Card eyebrow="Weekly Review" title="Weekly coach review"><p className="text-zinc-400">No weekly review data is available yet.</p></Card>;
  const value = (number: number | null, suffix = "") => number === null ? "—" : `${number}${suffix}`;
  const recommendationTone = review.nextWeekRecommendation === "Progress" ? "green" : review.nextWeekRecommendation === "Repeat" ? "yellow" : "red";
  return <div className="grid gap-4">
    <Card eyebrow="Weekly Review" title={`${review.startDate} → ${review.endDate}`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Average weight" value={value(review.averageWeight, " lb")} />
        <Stat label="Weight change" value={value(review.weightChange, " lb")} tone={review.weightChange !== null && review.weightChange <= 0 ? "green" : "yellow"} />
        <Stat label="Total weekly miles" value={`${review.totalWeeklyMiles} mi`} />
        <Stat label="Long run completed" value={review.longRunCompleted ? "Yes" : "No"} tone={review.longRunCompleted ? "green" : "yellow"} />
        <Stat label="Lifts completed" value={review.liftsCompleted} />
        <Stat label="Average calories" value={value(review.averageCalories)} />
        <Stat label="Average protein" value={value(review.averageProtein, "g")} tone={review.averageProtein !== null && review.averageProtein >= 180 ? "green" : "yellow"} />
        <Stat label="Average sleep" value={value(review.averageSleep, "h")} tone={review.averageSleep !== null && review.averageSleep >= 6 ? "green" : "yellow"} />
        <Stat label="Alcohol days" value={review.alcoholDays} tone={review.alcoholDays > 1 ? "yellow" : "green"} />
        <Stat label="Pain flags" value={review.painFlags.length} tone={review.painFlags.length ? "red" : "green"} />
        <Stat label="Adherence score" value={`${review.adherenceScore}/100`} tone={review.adherenceScore >= 80 ? "green" : review.adherenceScore >= 60 ? "yellow" : "red"} />
        <Stat label="Next week" value={review.nextWeekRecommendation} tone={recommendationTone} />
      </div>
    </Card>
    <Card eyebrow="Next week's recommendation" title={review.nextWeekRecommendation}>
      <div className="rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">Coach decision</p><h3 className="mt-2 text-2xl font-black">{review.nextWeekRecommendation}</h3><p className="mt-2 text-sm font-bold">{review.recommendationReason}</p></div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm font-bold text-white">Pain flags</p>{review.painFlags.length ? <ul className="mt-2 grid gap-1 text-sm text-red-200">{review.painFlags.map((flag) => <li key={flag}>• {flag}</li>)}</ul> : <p className="mt-2 text-sm text-zinc-400">No pain flags logged this week.</p>}</div>
    </Card>
  </div>;
}

function PlanAdjustments({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const entries = [...state.adjustments].sort((a, b) => b.date.localeCompare(a.date));
  const categories = Array.from(new Set(entries.map((entry) => entry.category ?? entry.adjustmentType)));
  const automatic = entries.filter((entry) => entry.mode !== "manual override").length;
  const manual = entries.filter((entry) => entry.mode === "manual override").length;
  return <div className="grid gap-4">
    <Card eyebrow="Coach Decision / Adjustment Log" title="Explainable audit trail"><div className="grid gap-3 md:grid-cols-4"><Stat label="Total decisions" value={entries.length} /><Stat label="Automatic" value={automatic} /><Stat label="Manual overrides" value={manual} tone="yellow" /><Stat label="Categories" value={categories.length} /></div><div className="mt-5 rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">Explainability contract</p><h3 className="mt-2 text-2xl font-black">Every logged decision shows what changed, why, what data caused it, and what to do next.</h3></div></Card>
    <Card eyebrow="Decision Categories" title="What is being tracked"><div className="grid gap-2 md:grid-cols-3">{["Readiness modification", "Workout reduction", "Exercise substitution", "Set-by-set coach decision", "Future workout recommendation", "Macro target change", "Manual override", "Run progression/regression", "Recovery replacement"].map((category) => <div key={category} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300"><b className="text-white">{category}</b><p>{entries.filter((entry) => (entry.category ?? entry.adjustmentType) === category).length} logged</p></div>)}</div></Card>
    <Card eyebrow="Audit trail" title="Decision log entries"><div className="grid gap-3">{entries.length ? entries.map((a) => <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-amber-300">{a.category ?? a.adjustmentType} · {a.mode ?? "automatic"} · confidence {a.confidence ?? "—"}</p><h3 className="mt-1 font-bold text-white">{a.date}</h3></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">{a.mode === "manual override" ? "manual" : "auto"}</span></div><div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-2xl bg-black/20 p-3"><p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Original prescription</p><p className="mt-1 text-sm text-zinc-200">{a.originalPrescription ?? a.previousValue}</p></div><div className="rounded-2xl bg-black/20 p-3"><p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Adjusted prescription</p><p className="mt-1 text-sm text-zinc-200">{a.adjustedPrescription ?? a.newValue}</p></div></div><div className="mt-3 grid gap-3 lg:grid-cols-2"><div><p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Reason</p><p className="mt-1 text-sm text-zinc-300">{a.reason}</p></div><div><p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Trigger data</p><p className="mt-1 break-words text-xs text-zinc-400">{a.triggerData ?? "Legacy entry — trigger data unavailable"}</p></div></div>{a.explanation && <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100"><b>Explanation</b><ul className="mt-2 grid gap-1"><li>What changed: {a.explanation.whatChanged}</li><li>Why: {a.explanation.whyItChanged}</li><li>Data: {a.explanation.dataThatCausedIt}</li><li>Next: {a.explanation.whatToDoNext}</li></ul></div>}</div>) : <p className="text-zinc-400">No accepted adjustments yet. Coach decisions, manual overrides, running changes, and post-workout recommendations will appear here.</p>}</div><button onClick={() => updateState({ ...state, adjustments: [] })} className="mt-4 rounded-2xl border border-white/15 px-4 py-2 text-sm">Clear decision log</button></Card>
  </div>;
}
function Settings({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  return <Card eyebrow="Preferences" title="Settings"><div className="mb-5"><ModeSelector state={state} updateState={updateState} /></div><div className="grid gap-3 md:grid-cols-2"><Field label="Preferred units"><select className={inputClass} value={state.user.preferredUnits} onChange={(e) => updateState({ ...state, user: { ...state.user, preferredUnits: e.target.value as any } })}><option value="imperial">Imperial</option><option value="metric">Metric</option></select></Field><Field label="Notifications"><input className={inputClass} value="Morning check-in, weekly photos, long-run reminder" readOnly /></Field><Field label="Future Apple Health fields"><textarea className={inputClass} readOnly value="Steps, active calories, resting HR, HRV, sleep duration/stages, VO2 max, workout HR zones, running pace, recovery HR, cardio fitness trend" /></Field><Field label="Database mode"><textarea className={inputClass} readOnly value="MVP persists to localStorage now. Supabase/Postgres schema and seed SQL are included under supabase/ for production wiring." /></Field></div></Card>;
}

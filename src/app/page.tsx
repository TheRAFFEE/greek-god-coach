"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adjustWorkoutForReadiness,
  calculateAdherence,
  calculateReadiness,
  calculateWeightTrend,
  detectInjuryRisk,
  generateWeeklyReview,
  generateWorkoutPreview,
  calculateDailyFuelScore,
  calculateMealTotals,
  calculateRunTrends,
  createCoachDecisionLogEntry,
  calculateNutritionProgress,
  generateDailyPrescription,
  generateNextSetRecommendation,
  generatePostWorkoutAnalysis,
  getNextWorkoutStep,
  getRecommendedStartingWeight,
  recommendMacroAdjustment,
  recommendWorkoutAdjustment,
  generateRunningRecommendation,
  summarizeTodaysChanges,
  mockScanNutritionImage,
  normalizeScanResult,
  scanResultToMealItem,
  validateScanResultForReview,
  suggestNextMealMacros,
  syncNutritionLogFromMeals,
  getReadinessGaugeModel,
  buildWeeklyAdherenceHeatmap,
  summarizeWorkoutCompletionCards,
  buildRunTrendCards,
} from "@/lib/coach-engine";
import { getWorkoutForWeekDay, macroTargets as coachMacroTargets, workouts } from "@/lib/seed-data";
import { createAuthAwarePersistenceContext, syncAppStateToSupabase, type AuthPersistenceContext } from "@/lib/supabase-persistence";
import { loadState, resetState, saveState, todayIso, uid } from "@/lib/storage";
import type { AppMode, AppState, CoachDecision, DailyCheckIn, Exercise, FoodScanLog, FoodScanResult, FormQuality, MacroTarget, Meal, MealCategory, NutritionLog, ProgressPhoto, RunLog, ScanMode, SetLog, WorkoutSession } from "@/lib/types";

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

function PremiumProgressBar({ label, percent, detail, tone = "yellow" }: { label: string; percent: number; detail: string; tone?: "green" | "yellow" | "red" | "neutral" }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold text-white">{label}</p><p className="text-sm font-black text-white">{Math.round(percent)}%</p></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-black/50"><div className={`h-full rounded-full bg-gradient-to-r ${toneGradient(tone)}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div><p className="mt-2 text-xs text-zinc-400">{detail}</p></div>;
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
  const weeklyReview = useMemo(() => state ? generateWeeklyReview({ userId: state.user.id, week: selectedWeek, checkIns: state.checkIns.slice(-7), bodyMetrics: state.bodyMetrics.slice(-14), nutritionAdherence, trainingAdherence, strengthTrend: "stable", runningTrend: "improving" }) : null, [state, selectedWeek, nutritionAdherence, trainingAdherence]);
  const runTrends = useMemo(() => state ? calculateRunTrends(state.runLogs ?? []) : null, [state]);
  const plannedRunDistance = currentWorkout.longRunMiles ?? (currentWorkout.type.includes("run") ? Number(currentWorkout.exercises[0]?.prescribedReps.match(/[\d.]+/)?.[0] ?? 3) : 3);
  const runningRecommendation = useMemo(() => state && readiness && runTrends ? generateRunningRecommendation({ runLogs: state.runLogs ?? [], nextDayReadiness: readiness.status, plannedDistance: plannedRunDistance, runType: currentWorkout.longRunMiles ? "Long run" : "Zone 2", currentWeeklyMileage: runTrends.weeklyMileage, previousWeeklyMileage: Math.max(0, runTrends.weeklyMileage - plannedRunDistance) }) : null, [state, readiness, runTrends, plannedRunDistance, currentWorkout.longRunMiles]);
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

  if (!state || !readiness || !macroTarget || !trend || !weeklyReview || !dailyPrescription) return <main className="min-h-screen bg-black p-8 text-white">Loading coach...</main>;

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
        {active === "Dashboard" && <Dashboard state={state} prescription={dailyPrescription} readiness={readiness} trend={trend} macroTarget={macroTarget} workoutTitle={adjustedWorkout.title} nutritionAdherence={nutritionAdherence} trainingAdherence={trainingAdherence} macroRec={macroRec?.action ?? "Keep calories"} weeklyScore={weeklyReview.transformationScore} latestCheckIn={latestCheckIn} />}
        {active === "Onboarding" && <Onboarding state={state} updateState={updateState} />}
        {active === "Daily Check-In" && <DailyCheckInForm state={state} updateState={updateState} readiness={readiness} />}
        {active === "Workout" && <WorkoutPreview state={state} updateState={updateState} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} selectedDay={selectedDay} setSelectedDay={setSelectedDay} readiness={readiness} workout={adjustedWorkout} originalWorkout={currentWorkout} latestCheckIn={latestCheckIn} runningRecommendation={runningRecommendation} />}
        {active === "Running" && <Running state={state} updateState={updateState} recommendation={runningRecommendation} trends={runTrends} plannedDistance={plannedRunDistance} />}
        {active === "Nutrition" && <Nutrition state={state} updateState={updateState} target={macroTarget} adherence={nutritionAdherence} recommendation={macroRec} />}
        {active === "Body Metrics" && <BodyMetrics state={state} updateState={updateState} trend={trend} />}
        {active === "Progress Photos" && <ProgressPhotos state={state} updateState={updateState} />}
        {active === "Readiness" && <ReadinessPanel readiness={readiness} workoutRec={workoutRec} injuryRisk={latestInjuryRisk} latestCheckIn={latestCheckIn} />}
        {active === "Weekly Review" && <WeeklyReviewPanel review={weeklyReview} macroRec={macroRec} state={state} updateState={updateState} />}
        {active === "Plan Adjustments" && <PlanAdjustments state={state} updateState={updateState} />}
        {active === "Settings" && <Settings state={state} updateState={updateState} />}
      </div>
    </div>
  </main>;
}

function Dashboard({ state, prescription, readiness, trend, macroTarget, workoutTitle, nutritionAdherence, trainingAdherence, macroRec, weeklyScore, latestCheckIn }: any) {
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
  const runCards = buildRunTrendCards(calculateRunTrends(state.runLogs ?? []));
  return <div className="grid gap-5">
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
      <Card eyebrow="Body + Run Signal" title="Trends"><div className="grid gap-3"><PremiumProgressBar label="Weight trend" percent={Math.max(0, Math.min(100, 50 - trend.change14Day * 10))} detail={`${trend.current7DayAverage} lb avg · ${trend.change14Day} lb vs prior 7`} tone={trend.change14Day <= 0 ? "green" : "yellow"} /><PremiumProgressBar label="Waist trend" percent={Math.max(0, Math.min(100, 50 - trend.waistChange * 20))} detail={`${trend.waistChange} in weekly comparison`} tone={trend.waistChange <= 0 ? "green" : "yellow"} /><Stat label="Recovery snapshot" value={`${latestCheckIn?.sleepHours ?? 0}h sleep`} sub={`RHR ${latestCheckIn?.restingHr ?? "—"} · HRV ${latestCheckIn?.hrv ?? "—"}`} tone={latestCheckIn?.sleepHours >= 7 ? "green" : "yellow"} /><Sparkline values={state.bodyMetrics.slice(-14).map((m: any) => m.weight)} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{runCards.map((card) => <Stat key={card.label} label={card.label} value={card.value} sub={card.coachCopy} tone={card.tone === "neutral" ? "neutral" : card.tone} />)}</div></Card>
    </div>

    <Card eyebrow="Workout Receipts" title="Completion cards"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Completed sessions" value={completion.completedSessions} sub={`${completion.totalWorkouts} seeded workouts`} tone="green" /><Stat label="Active sessions" value={completion.activeSessions} sub="finish or end deliberately" tone={completion.activeSessions ? "yellow" : "neutral"} /><Stat label="Coach copy" value={completion.coachCopy} /></div></Card>
  </div>;
}
function Onboarding({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const u = state.user;
  const set = (field: string, value: string | number) => updateState({ ...state, user: { ...u, [field]: value } });
  return <Card eyebrow="Setup Wizard" title="Personalize the coach"><div className="grid gap-4 md:grid-cols-2">{[["Name","name"],["Age","age"],["Height","height"],["Starting weight","startingWeight"],["Goal weight","goalWeight"],["Training experience","trainingExperience"],["Current strength numbers","strengthNumbers"],["Equipment available","equipment"],["Injury history","injuryHistory"],["Primary goal","goal"]].map(([label, field]) => <Field key={field} label={label}><input className={inputClass} value={(u as any)[field]} onChange={(e) => set(field, field.includes("weight") || field === "age" ? Number(e.target.value) : e.target.value)} /></Field>)}</div></Card>;
}

function DailyCheckInForm({ state, updateState }: { state: AppState; updateState: (s: AppState) => void; readiness: any }) {
  const latest = state.checkIns.at(-1)!;
  const [form, setForm] = useState<DailyCheckIn>({ ...latest, id: uid("check"), date: todayIso(), notes: "" });
  const set = (field: keyof DailyCheckIn, value: any) => setForm({ ...form, [field]: value });
  const save = () => updateState({ ...state, checkIns: [...state.checkIns.filter((c) => c.date !== form.date), form], bodyMetrics: [...state.bodyMetrics.filter((m) => m.date !== form.date), { id: uid("metric"), userId: state.user.id, date: form.date, weight: form.weight, notes: "from check-in" }] });
  return <div className="grid gap-4 lg:grid-cols-[1fr_0.65fr]"><Card eyebrow="Daily Check-In" title="Morning readiness inputs"><div className="grid gap-3 md:grid-cols-2">{[["Date","date"],["Morning bodyweight","weight"],["Sleep hours","sleepHours"],["Sleep quality 1-10","sleepQuality"],["Soreness 1-10","soreness"],["Energy 1-10","energy"],["Stress 1-10","stress"],["Hunger 1-10","hunger"],["Motivation 1-10","motivation"],["Steps yesterday","steps"],["Resting HR","restingHr"],["HRV","hrv"],["Pain location","painLocation"],["Pain severity 1-10","painSeverity"]].map(([label, field]) => <Field key={field} label={label}><input className={inputClass} type={field === "date" ? "date" : typeof (form as any)[field] === "number" ? "number" : "text"} value={(form as any)[field]} onChange={(e) => set(field as keyof DailyCheckIn, e.target.type === "number" ? Number(e.target.value) : e.target.value)} /></Field>)}<Field label="Alcohol yesterday"><select className={inputClass} value={String(form.alcohol)} onChange={(e) => set("alcohol", e.target.value === "true")}><option value="false">No</option><option value="true">Yes</option></select></Field><Field label="Any pain/injury"><select className={inputClass} value={String(form.pain)} onChange={(e) => set("pain", e.target.value === "true")}><option value="false">No</option><option value="true">Yes</option></select></Field><Field label="Workout completed yesterday"><select className={inputClass} value={String(form.workoutCompleted)} onChange={(e) => set("workoutCompleted", e.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></Field><Field label="Macros hit yesterday"><select className={inputClass} value={String(form.macrosHit)} onChange={(e) => set("macrosHit", e.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></Field><label className="grid gap-1 text-sm text-zinc-300 md:col-span-2">Notes<textarea className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label></div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save check-in and recalculate readiness</button></Card><ReadinessPanel readiness={calculateReadiness(form, { restingHr: 58, hrv: 60 })} workoutRec={null} injuryRisk={detectInjuryRisk(form)} latestCheckIn={form} /></div>;
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

  return <div className="grid gap-4"><Card eyebrow="Session Control" title="Mode, readiness, and workout receipts"><div className="grid gap-4 lg:grid-cols-[1fr_0.75fr]"><ModeSelector state={state} updateState={updateState} /><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><Stat label="Readiness" value={`${readiness.status} — ${readiness.score}`} sub={readiness.reason} tone={tone} /><Stat label="This workout" value={`${completion.completionPercent}%`} sub={completion.coachCopy} tone={completion.activeSessions ? "yellow" : "green"} /><Stat label="Mode clarity" value={preview.modeLabel} sub={preview.focus} /></div></div></Card><Card eyebrow="Today’s Workout Preview" title={displayedWorkout.title}><div className="grid gap-3 sm:grid-cols-3"><Field label="Week"><select className={inputClass} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>Week {i+1}</option>)}</select></Field><Field label="Day"><select className={inputClass} value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field><Stat label="Readiness" value={`${readiness.status} — ${readiness.score}`} sub={readiness.reason} tone={tone} /></div><div className="mt-5 rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">{preview.modeLabel}</p><h3 className="mt-2 text-2xl font-black">{preview.primaryInstruction}</h3><p className="mt-2 text-sm font-medium">Focus: {preview.focus}</p></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">Coach notes</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-300">{preview.coachNotes.map((note) => <li key={note}>• {note}</li>)}</ul></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-white">What changed from the original plan</h3><ul className="mt-3 grid gap-2 text-sm text-zinc-300">{preview.whatChanged.map((change) => <li key={change}>• {change}</li>)}</ul></div></div>{runningRecommendation && (displayedWorkout.longRunMiles || /run|conditioning/i.test(displayedWorkout.type)) && <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm text-sky-100"><b>Running engine:</b> {runningRecommendation.action} · {runningRecommendation.message}<ul className="mt-2 grid gap-1 text-xs">{runningRecommendation.reasons.slice(0, 4).map((reason: string) => <li key={reason}>• {reason}</li>)}</ul></div>}{preview.substitutions.length > 0 && <div className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-500/10 p-4 text-sm text-yellow-100"><b>Pain-aware substitutions:</b><ul className="mt-2 grid gap-1">{preview.substitutions.map((sub) => <li key={sub}>• {sub}</li>)}</ul></div>}{futureRecommendations.length > 0 && <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100"><b>Stored next-session recommendations:</b><ul className="mt-2 grid gap-1">{futureRecommendations.slice(-6).map((recommendation) => <li key={recommendation.id ?? recommendation.message}>• {recommendation.message}</li>)}</ul></div>}<div className="mt-5 grid gap-3">{displayedWorkout.exercises.length ? displayedWorkout.exercises.map((exercise: Exercise) => {
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


function Running({ state, updateState, recommendation, trends, plannedDistance }: { state: AppState; updateState: (s: AppState) => void; recommendation: any; trends: any; plannedDistance: number }) {
  const [form, setForm] = useState<RunLog>({ id: uid("run"), userId: state.user.id, date: todayIso(), plannedDistance, actualDistance: plannedDistance, durationMinutes: Math.round(plannedDistance * 11), averagePace: 11, averageHr: 140, maxHr: 160, rpe: 5, zone2Compliance: 85, completed: true, pain: false, painLocation: "", notes: "" });
  const set = (field: keyof RunLog, value: any) => setForm({ ...form, [field]: value });
  const save = () => {
    const runDecision = recommendation ? createCoachDecisionLogEntry({
      id: uid("adj"),
      userId: state.user.id,
      date: new Date().toISOString(),
      category: "Run progression/regression",
      originalPrescription: `${form.plannedDistance} mile planned run`,
      adjustedPrescription: `${recommendation.recommendedDistance} mile next run (${recommendation.action})`,
      reason: recommendation.message,
      triggerData: { actualDistance: form.actualDistance, rpe: form.rpe, zone2Compliance: form.zone2Compliance, averagePace: form.averagePace, averageHr: form.averageHr, pain: form.pain, completed: form.completed, reasons: recommendation.reasons },
      confidence: recommendation.action === "Regress" || form.pain ? "High" : "Medium",
      mode: "automatic",
      notes: recommendation.warnings.join(" ") || "Generated after run log save.",
    }) : null;
    updateState({ ...state, runLogs: [...(state.runLogs ?? []).filter((run: RunLog) => run.date !== form.date), form], adjustments: runDecision ? [...state.adjustments, runDecision] : state.adjustments });
  };
  const logs = [...(state.runLogs ?? [])].sort((a: RunLog, b: RunLog) => b.date.localeCompare(a.date));
  const runTrendCards = buildRunTrendCards(trends ?? calculateRunTrends([]));
  return <div className="grid gap-4">
    <Card eyebrow="Running Coach" title="Progression / regression engine"><div className="grid gap-3 md:grid-cols-4"><Stat label="Recommendation" value={recommendation?.action ?? "Hold"} sub={recommendation?.message ?? "Log a baseline run to unlock progression."} tone={recommendation?.action === "Progress" ? "green" : recommendation?.action === "Regress" ? "red" : "yellow"} /><Stat label="Next distance" value={`${recommendation?.recommendedDistance ?? plannedDistance} mi`} /><Stat label="Weekly mileage" value={`${trends?.weeklyMileage ?? 0} mi`} /><Stat label="Runs logged" value={state.runLogs?.length ?? 0} /></div>{recommendation && <div className="mt-5 rounded-3xl bg-sky-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">Deterministic run order</p><h3 className="mt-2 text-2xl font-black">{recommendation.message}</h3><ul className="mt-3 grid gap-1 text-sm font-bold">{recommendation.reasons.map((reason: string) => <li key={reason}>• {reason}</li>)}</ul>{recommendation.warnings.length ? <p className="mt-3 text-sm font-black">Warnings: {recommendation.warnings.join(" ")}</p> : null}</div>}</Card>
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card eyebrow="Run Log" title="Log today’s run"><div className="grid gap-3 md:grid-cols-2">{(["date", "plannedDistance", "actualDistance", "durationMinutes", "averagePace", "averageHr", "maxHr", "rpe", "zone2Compliance", "painLocation"] as Array<keyof RunLog>).map((field) => <Field key={field} label={String(field)}><input className={inputClass} type={field === "date" || field === "painLocation" ? field === "date" ? "date" : "text" : "number"} value={(form as any)[field]} onChange={(e) => set(field, e.target.type === "number" ? Number(e.target.value) : e.target.value)} /></Field>)}<Field label="Completed"><select className={inputClass} value={String(form.completed)} onChange={(e) => set("completed", e.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></Field><Field label="Pain"><select className={inputClass} value={String(form.pain)} onChange={(e) => set("pain", e.target.value === "true")}><option value="false">No</option><option value="true">Yes</option></select></Field><label className="grid gap-1 text-sm text-zinc-300 md:col-span-2">Notes<textarea className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label></div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save run log</button></Card>
      <Card eyebrow="Run Trends" title="Distance, pace, RPE, long run"><div className="mb-4 grid gap-3 sm:grid-cols-2">{runTrendCards.map((card) => <Stat key={card.label} label={card.label} value={card.value} sub={card.coachCopy} tone={card.tone === "neutral" ? "neutral" : card.tone} />)}</div><div className="grid gap-4"><div><p className="mb-2 text-sm font-bold text-zinc-300">Distance trend</p><Sparkline values={trends?.distanceTrend ?? []} color="#38bdf8" /></div><div><p className="mb-2 text-sm font-bold text-zinc-300">Pace trend</p><Sparkline values={trends?.paceTrend ?? []} color="#f59e0b" /></div><div><p className="mb-2 text-sm font-bold text-zinc-300">RPE trend</p><Sparkline values={trends?.rpeTrend ?? []} color="#ef4444" /></div><div><p className="mb-2 text-sm font-bold text-zinc-300">Long-run progression</p><Sparkline values={trends?.longRunProgression ?? []} color="#22c55e" /></div></div></Card>
    </div>
    <Card eyebrow="History" title="Recent running logs"><div className="grid gap-3 md:grid-cols-3">{logs.length ? logs.slice(0, 9).map((run: RunLog) => <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300"><b className="text-white">{run.date}</b><p>{run.actualDistance}/{run.plannedDistance} mi · {run.durationMinutes} min · {run.averagePace} pace</p><p>HR {run.averageHr}/{run.maxHr} · RPE {run.rpe} · Z2 {run.zone2Compliance}%</p><p>{run.completed ? "Completed" : "Incomplete"}{run.pain ? ` · Pain: ${run.painLocation || "yes"}` : " · No pain"}</p></div>) : <p className="text-zinc-400">No run logs yet. Save today’s run to start trend tracking.</p>}</div></Card>
  </div>;
}

function MacroProgress({ label, consumed, target, remaining, percent, unit = "g", tone = "amber" }: { label: string; consumed: number; target: number; remaining: number; percent: number; unit?: string; tone?: "amber" | "green" | "blue" | "purple" }) {
  const color = tone === "green" ? "bg-emerald-400" : tone === "blue" ? "bg-sky-400" : tone === "purple" ? "bg-violet-400" : "bg-amber-400";
  const textUnit = unit === "cal" ? "" : unit;
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-white">{label}</p><p className="text-xs text-zinc-500">{consumed}{textUnit} / {target}{textUnit}</p></div><div className="text-right"><p className="text-xl font-black text-white">{percent}%</p><p className="text-xs text-zinc-500">{remaining}{textUnit} left</p></div></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-black/50"><div className={`${color} h-full rounded-full`} style={{ width: `${percent}%` }} /></div></div>;
}

const mealCategories: MealCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout", "Post-workout", "Custom"];

const emptyMeal = (userId: string, date: string): Meal => ({
  id: uid("meal"),
  userId,
  date,
  category: "Breakfast",
  name: "",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sodium: 0,
  water: 0,
  notes: "",
  items: [],
});

function Nutrition({ state, updateState, target, adherence, recommendation }: any) {
  const today = todayIso();
  const meals = state.meals ?? [];
  const todayMeals = meals.filter((meal: Meal) => meal.date === today);
  const existing = state.nutritionLogs.find((n: NutritionLog) => n.date === today);
  const mealTotals = calculateMealTotals(todayMeals, today);
  const derivedLog: NutritionLog = todayMeals.length ? syncNutritionLogFromMeals({ userId: state.user.id, date: today, meals: todayMeals, existingLog: existing }) : (existing ?? { id: uid("nutrition"), userId: state.user.id, date: today, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 2600, water: 0, alcohol: 0, notes: "" });
  const [form, setForm] = useState<NutritionLog>(derivedLog);
  const [targetForm, setTargetForm] = useState<MacroTarget>({ ...target });
  const [mealForm, setMealForm] = useState<Meal>(emptyMeal(state.user.id, today));
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("Nutrition Label Scan");
  const [scanImageName, setScanImageName] = useState("");
  const [scanPreview, setScanPreview] = useState("");
  const [selectedMealId, setSelectedMealId] = useState<string>(todayMeals[0]?.id ?? "new");
  const [scanResult, setScanResult] = useState<FoodScanResult | null>(null);
  const [scanIsLoading, setScanIsLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanIssues, setScanIssues] = useState<string[]>([]);
  const [scanProvider, setScanProvider] = useState("mock-deterministic");
  const coachTarget = coachMacroTargets.find((macro) => macro.week === target.week) ?? coachMacroTargets[0];
  const manualOverride = ["calories", "protein", "carbs", "fat", "fiber", "water"].some((field) => Number((target as any)[field]) !== Number((coachTarget as any)[field]));
  const progress = calculateNutritionProgress(derivedLog, target);
  const fuelScore = calculateDailyFuelScore(derivedLog, target);
  const nextMeal = suggestNextMealMacros(derivedLog, target, 3);
  const hydrationMessage = progress.water.percent >= 100 ? "Hydration target complete. Maintain with small sips." : progress.water.percent >= 75 ? "Hydration is close. One more bottle should finish the target." : progress.water.percent >= 50 ? "Hydration is halfway there. Add 24 oz over the next 1-2 hours." : "Hydration is behind. Start with 16-24 oz now and add electrolytes if training hard.";
  const syncNutrition = (nextMeals: Meal[], fallbackLog = form) => syncNutritionLogFromMeals({ userId: state.user.id, date: today, meals: nextMeals.filter((meal) => meal.date === today), existingLog: existing ?? fallbackLog });
  const saveSyncedState = (nextMeals: Meal[], fallbackLog = form) => {
    const synced = nextMeals.filter((meal) => meal.date === today).length ? syncNutrition(nextMeals, fallbackLog) : fallbackLog;
    updateState({ ...state, meals: nextMeals, nutritionLogs: [...state.nutritionLogs.filter((n: NutritionLog) => n.date !== synced.date), synced] });
  };
  const setTarget = (field: keyof MacroTarget, value: number) => setTargetForm({ ...targetForm, [field]: value });
  const setMeal = (field: keyof Meal, value: any) => setMealForm({ ...mealForm, [field]: value });
  const saveMeal = () => {
    const mealToSave = { ...mealForm, name: mealForm.name || `${mealForm.category} macro entry` };
    const nextMeals = editingMealId ? meals.map((meal: Meal) => meal.id === editingMealId ? mealToSave : meal) : [...meals, mealToSave];
    saveSyncedState(nextMeals);
    setMealForm(emptyMeal(state.user.id, today));
    setEditingMealId(null);
  };
  const editMeal = (meal: Meal) => {
    setMealForm(meal);
    setEditingMealId(meal.id);
  };
  const deleteMeal = (mealId: string) => {
    const nextMeals = meals.filter((meal: Meal) => meal.id !== mealId);
    saveSyncedState(nextMeals);
    if (editingMealId === mealId) {
      setMealForm(emptyMeal(state.user.id, today));
      setEditingMealId(null);
    }
  };
  const quickAddMeal = () => {
    const quick: Meal = { ...emptyMeal(state.user.id, today), category: "Snack", name: "Quick macro entry", calories: 300, protein: 30, carbs: 30, fat: 8, fiber: 4, sodium: 300, water: 12, notes: "Quick-add simple macro entry" };
    saveSyncedState([...meals, quick]);
  };
  const runConfiguredScan = async (fileName = scanImageName, imageDataUrl = scanPreview) => {
    setScanIsLoading(true);
    setScanError("");
    setScanIssues([]);
    try {
      const response = await fetch("/api/scan-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: scanMode, fileName, imageDataUrl }),
      });
      const payload = await response.json() as { ok?: boolean; provider?: string; result?: FoodScanResult; issues?: string[]; warning?: string; error?: { message?: string } };
      if (!response.ok || !payload.ok || !payload.result) throw new Error(payload.error?.message || "Scan failed. Try a clearer image or use mock mode.");
      setScanResult(payload.result);
      setScanProvider(payload.provider || payload.result.provider);
      setScanIssues([...(payload.issues ?? []), ...(payload.warning ? [payload.warning] : [])]);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scan failed. Try again.");
      const fallback = mockScanNutritionImage({ mode: scanMode, fileName });
      setScanResult(fallback);
      setScanProvider(fallback.provider);
      setScanIssues(["Real scan failed, so a mock fallback result is shown for local development. Review carefully before confirming."]);
    } finally {
      setScanIsLoading(false);
    }
  };
  const handleScanFile = (file?: File) => {
    if (!file) return;
    setScanImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const preview = String(reader.result || "");
      setScanPreview(preview);
      void runConfiguredScan(file.name, preview);
    };
    reader.onerror = () => setScanError("Could not read that image. Try another upload.");
    reader.readAsDataURL(file);
  };
  const setScanField = (field: keyof FoodScanResult, value: string | number) => scanResult && setScanResult({ ...scanResult, [field]: typeof value === "number" ? value : value });
  const confirmScan = () => {
    if (!scanResult) return;
    const normalized = normalizeScanResult(scanResult);
    const targetMealId = selectedMealId === "new" ? uid("meal") : selectedMealId;
    const newItem = scanResultToMealItem({ result: normalized, mealId: targetMealId, itemId: uid("item") });
    const newMeal: Meal = { ...emptyMeal(state.user.id, today), id: targetMealId, category: scanMode === "Food Photo Scan" ? "Lunch" : "Snack", name: normalized.detectedName, notes: `Created from ${normalized.isMock ? "mock" : "AI vision"} scan review.`, items: [newItem] };
    const nextMeals = selectedMealId === "new" || !meals.some((meal: Meal) => meal.id === targetMealId)
      ? [...meals, newMeal]
      : meals.map((meal: Meal) => meal.id === targetMealId ? { ...meal, items: [...meal.items, newItem], notes: [meal.notes, `Added ${normalized.isMock ? "mock" : "AI vision"} scanned item.`].filter(Boolean).join(" ") } : meal);
    const scanLog: FoodScanLog = { id: uid("scan"), userId: state.user.id, date: new Date().toISOString(), mode: scanMode, imageName: scanImageName || "uploaded-scan.jpg", imagePreviewUrl: scanPreview, selectedMealId: targetMealId, result: normalized, status: "confirmed", provider: normalized.provider, isMock: normalized.isMock, notes: normalized.isMock ? "Mock deterministic scan — not real OCR/AI." : "OpenAI vision scan reviewed and confirmed by user." };
    const synced = syncNutritionLogFromMeals({ userId: state.user.id, date: today, meals: nextMeals.filter((meal: Meal) => meal.date === today), existingLog: existing ?? form });
    updateState({ ...state, meals: nextMeals, nutritionLogs: [...state.nutritionLogs.filter((n: NutritionLog) => n.date !== synced.date), synced], foodScans: [...(state.foodScans ?? []), scanLog] });
    setScanResult(null);
    setScanImageName("");
    setScanPreview("");
    setScanOpen(false);
    setSelectedMealId(targetMealId);
  };
  const saveManualDailyLog = () => updateState({ ...state, nutritionLogs: [...state.nutritionLogs.filter((n: NutritionLog) => n.date !== form.date), form] });
  const saveManualTarget = () => updateState({
    ...state,
    macroTargets: state.macroTargets.map((macro: MacroTarget) => macro.week === target.week ? { ...targetForm, week: target.week, id: target.id, userId: target.userId } : macro),
    adjustments: [...state.adjustments, createCoachDecisionLogEntry({ id: uid("adj"), userId: state.user.id, date: new Date().toISOString(), category: "Manual override", reason: "User edited macro targets directly on the Nutrition command center.", originalPrescription: `${target.calories} cal / ${target.protein}P / ${target.carbs}C / ${target.fat}F / ${target.fiber} fiber / ${target.water} oz`, adjustedPrescription: `${targetForm.calories} cal / ${targetForm.protein}P / ${targetForm.carbs}C / ${targetForm.fat}F / ${targetForm.fiber} fiber / ${targetForm.water} oz`, triggerData: { screen: "Nutrition", source: "manual macro override", week: target.week }, confidence: "High", mode: "manual override", notes: "Coach target preserved for reset." })],
  });
  const resetCoachTarget = () => updateState({
    ...state,
    macroTargets: state.macroTargets.map((macro: MacroTarget) => macro.week === target.week ? { ...coachTarget, id: target.id, userId: target.userId } : macro),
    adjustments: [...state.adjustments, createCoachDecisionLogEntry({ id: uid("adj"), userId: state.user.id, date: new Date().toISOString(), category: "Macro target change", reason: "User reset manual macro override to the deterministic coach target.", originalPrescription: `${target.calories} cal / ${target.protein}P / ${target.carbs}C / ${target.fat}F / ${target.fiber} fiber / ${target.water} oz`, adjustedPrescription: `${coachTarget.calories} cal / ${coachTarget.protein}P / ${coachTarget.carbs}C / ${coachTarget.fat}F / ${coachTarget.fiber} fiber / ${coachTarget.water} oz`, triggerData: { screen: "Nutrition", source: "reset to coach target", week: target.week }, confidence: "High", mode: "manual override", notes: "Reset from Nutrition command center." })],
  });
  return <div className="grid gap-4">
    <Card eyebrow="Nutrition Command Center" title="Meal-based macros, hydration, and next meal"><div className="grid gap-3 md:grid-cols-5"><Stat label="Daily fuel score" value={`${fuelScore.score}/100`} sub={fuelScore.reasons.join("; ")} tone={fuelScore.score >= 85 ? "green" : fuelScore.score >= 70 ? "yellow" : "red"} /><Stat label="Meals today" value={todayMeals.length} sub="daily totals computed from meals" /><Stat label="Active target" value={`${target.calories} cal`} sub={manualOverride ? "Manual override active" : "Coach target"} tone={manualOverride ? "yellow" : "green"} /><Stat label="Nutrition adherence" value={`${adherence}%`} tone={adherence >= 85 ? "green" : adherence >= 80 ? "yellow" : "red"} /><Stat label="Coach recommendation" value={recommendation?.action ?? "Keep"} sub={recommendation?.reason} /></div><div className="mt-5 rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">Suggested next meal</p><h3 className="mt-2 text-2xl font-black">{nextMeal.message}</h3><p className="mt-2 text-sm font-bold">Hydration coach: {hydrationMessage}</p><button onClick={() => setScanOpen(!scanOpen)} className="mt-4 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white">{scanOpen ? "Close scan" : "Scan label / food photo"}</button></div></Card>
    {scanOpen && <Card eyebrow="AI Scan Lab" title="Nutrition label + food photo scan">
      <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100"><b>Review required:</b> configured provider is {scanProvider}. Real AI/OCR estimates are never added automatically; confirm only after editing the fields below. With no OPENAI_API_KEY or with GREEK_GOD_SCAN_PROVIDER=mock, this stays in deterministic mock mode.</div>
      {scanError && <div className="mt-3 rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100"><b>Scan error:</b> {scanError}</div>}
      {scanIssues.length > 0 && <div className="mt-3 rounded-2xl border border-yellow-300/30 bg-yellow-500/10 p-4 text-sm text-yellow-100"><b>Review warnings:</b><ul className="mt-2 list-disc pl-5">{scanIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-3">
          <Field label="Scan mode"><select className={inputClass} value={scanMode} onChange={(e) => { const nextMode = e.target.value as ScanMode; setScanMode(nextMode); setScanResult(null); setScanIssues([]); }}><option value="Nutrition Label Scan">Nutrition Label Scan</option><option value="Food Photo Scan">Food Photo Scan</option></select></Field>
          <Field label="Upload/camera image"><input className={inputClass} type="file" accept="image/*" capture="environment" onChange={(e) => handleScanFile(e.target.files?.[0])} /></Field>
          <button disabled={scanIsLoading} onClick={() => void runConfiguredScan(scanImageName || (scanMode === "Nutrition Label Scan" ? "greek-yogurt-label.jpg" : "salmon-rice-bowl.png"), scanPreview)} className="rounded-2xl bg-amber-400 px-4 py-3 font-black text-black disabled:opacity-60">{scanIsLoading ? "Scanning..." : "Run configured scan"}</button>
          {scanPreview ? <div role="img" aria-label="Scan preview" className="h-64 rounded-2xl border border-white/10 bg-cover bg-center" style={{ backgroundImage: `url(${scanPreview})` }} /> : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-400">Image preview appears here after upload. Real OpenAI vision requires an uploaded image; mock mode can generate deterministic test data without one.</div>}
        </div>
        <div className="grid gap-3">{scanResult ? <>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] p-3 text-xs text-zinc-300"><span>Provider: <b className="text-white">{scanResult.provider}</b></span><span className="rounded-full bg-amber-400 px-2 py-1 font-black text-black">{scanResult.isMock ? "MOCK" : "AI REVIEW"}</span></div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Detected food/label"><input className={inputClass} value={scanResult.detectedName} onChange={(e) => setScanField("detectedName", e.target.value)} /></Field>
            <Field label="Serving size"><input className={inputClass} value={scanResult.servingSize} onChange={(e) => setScanField("servingSize", e.target.value)} /></Field>
            <Field label="Servings per container"><input className={inputClass} value={scanResult.servingsPerContainer ?? ""} onChange={(e) => setScanField("servingsPerContainer", e.target.value)} /></Field>
            <Field label="Servings eaten"><input className={inputClass} type="number" step="0.1" value={scanResult.servingsEaten} onChange={(e) => setScanField("servingsEaten", Number(e.target.value))} /></Field>
            <Field label="Confidence"><input className={inputClass} type="number" value={scanResult.confidence} onChange={(e) => setScanField("confidence", Number(e.target.value))} /></Field>
            <Field label="Sugar"><input className={inputClass} type="number" value={Number(scanResult.sugar ?? 0)} onChange={(e) => setScanField("sugar", Number(e.target.value))} /></Field>
            {(["calories", "protein", "carbs", "fat", "fiber", "sodium"] as Array<keyof FoodScanResult>).map((field) => <Field key={String(field)} label={`${String(field)} per serving`}><input className={inputClass} type="number" value={Number((scanResult as any)[field] ?? 0)} onChange={(e) => setScanField(field, Number(e.target.value))} /></Field>)}
          </div>
          {scanMode === "Food Photo Scan" && <div className="grid gap-3 md:grid-cols-2"><Field label="Foods detected"><input className={inputClass} value={(scanResult.foodsDetected ?? []).join(", ")} onChange={(e) => setScanResult({ ...scanResult, foodsDetected: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></Field><Field label="Portion estimate"><input className={inputClass} value={scanResult.portionEstimate ?? ""} onChange={(e) => setScanField("portionEstimate", e.target.value)} /></Field></div>}
          <Field label="Add to meal"><select className={inputClass} value={selectedMealId} onChange={(e) => setSelectedMealId(e.target.value)}><option value="new">Create new meal from scan</option>{todayMeals.map((meal: Meal) => <option key={meal.id} value={meal.id}>{meal.name || meal.category}</option>)}</select></Field>
          <div className="rounded-2xl bg-white/[0.03] p-4 text-sm text-zinc-300"><b className="text-white">Reviewed total:</b> {normalizeScanResult(scanResult).calories} cal · {normalizeScanResult(scanResult).protein}P · {normalizeScanResult(scanResult).carbs}C · {normalizeScanResult(scanResult).fat}F · {normalizeScanResult(scanResult).fiber} fiber · {normalizeScanResult(scanResult).sodium} sodium · sugar {normalizeScanResult(scanResult).sugar ?? 0} · confidence {normalizeScanResult(scanResult).confidence}% ({normalizeScanResult(scanResult).confidenceLevel})</div>
          {validateScanResultForReview(scanResult).length > 0 && <div className="rounded-2xl border border-yellow-300/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">Before confirming, review: {validateScanResultForReview(scanResult).join(" ")}</div>}
          <div className="grid gap-3 sm:grid-cols-2"><button onClick={confirmScan} className="rounded-2xl bg-emerald-400 px-4 py-3 font-black text-black">Confirm and add macros</button><button onClick={() => setScanResult(null)} className="rounded-2xl border border-white/15 px-4 py-3 font-bold text-zinc-200">Discard result</button></div>
        </> : <p className="rounded-2xl bg-white/[0.03] p-4 text-sm text-zinc-400">Choose a mode and upload an image, or run the configured scan. Mock mode returns deterministic data; OpenAI mode returns reviewable AI/OCR estimates.</p>}</div>
      </div>
      <div className="mt-4 rounded-2xl bg-white/[0.03] p-4 text-xs text-zinc-400"><b className="text-white">Provider seam:</b> client calls /api/scan-food. The server route selects mock vs OpenAI from env, returns the same FoodScanResult shape, then the existing review/edit/confirm flow uses normalizeScanResult and scanResultToMealItem.</div>
    </Card>}
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card eyebrow="Meal-derived Daily Totals" title="Today’s intake vs target"><div className="grid gap-3 md:grid-cols-2"><MacroProgress label="Calories" consumed={progress.calories.consumed} target={progress.calories.target} remaining={progress.calories.remaining} percent={progress.calories.percent} unit="cal" /><MacroProgress label="Protein" consumed={progress.protein.consumed} target={progress.protein.target} remaining={progress.protein.remaining} percent={progress.protein.percent} tone="green" /><MacroProgress label="Carbs" consumed={progress.carbs.consumed} target={progress.carbs.target} remaining={progress.carbs.remaining} percent={progress.carbs.percent} tone="blue" /><MacroProgress label="Fat" consumed={progress.fat.consumed} target={progress.fat.target} remaining={progress.fat.remaining} percent={progress.fat.percent} tone="purple" /><MacroProgress label="Fiber" consumed={progress.fiber.consumed} target={progress.fiber.target} remaining={progress.fiber.remaining} percent={progress.fiber.percent} tone="green" /><MacroProgress label="Water" consumed={progress.water.consumed} target={progress.water.target} remaining={progress.water.remaining} percent={progress.water.percent} unit=" oz" tone="blue" /></div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3"><Stat label="Calories remaining" value={progress.calories.remaining} /><Stat label="Protein remaining" value={`${progress.protein.remaining}g`} /><Stat label="Carbs remaining" value={`${progress.carbs.remaining}g`} /><Stat label="Fat remaining" value={`${progress.fat.remaining}g`} /><Stat label="Fiber remaining" value={`${progress.fiber.remaining}g`} /><Stat label="Water remaining" value={`${progress.water.remaining} oz`} /></div></Card>
      <Card eyebrow="Hydration" title="Water tracker"><div className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5"><p className="text-sm text-sky-100">Water target</p><p className="mt-1 text-4xl font-black text-white">{target.water} oz</p><p className="mt-2 text-sm text-sky-100">Meal total: {derivedLog.water} oz · Remaining: {progress.water.remaining} oz</p><div className="mt-4 h-4 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-sky-400" style={{ width: `${progress.water.percent}%` }} /></div><p className="mt-3 text-sm text-sky-100">{hydrationMessage}</p></div><div className="mt-4 grid grid-cols-4 gap-2">{[8, 12, 16, 24].map((amount) => <button key={amount} onClick={() => { const waterMeal: Meal = { ...emptyMeal(state.user.id, today), category: "Custom", name: `Water +${amount} oz`, water: amount, notes: "Quick-add water" }; saveSyncedState([...meals, waterMeal]); }} className="rounded-2xl bg-sky-400 px-3 py-2 text-sm font-black text-black">+{amount} oz</button>)}</div></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card eyebrow={editingMealId ? "Edit Meal" : "Add Meal"} title="Meal / quick macro entry"><div className="grid gap-3 md:grid-cols-2"><Field label="Date"><input className={inputClass} type="date" value={mealForm.date} onChange={(e) => setMeal("date", e.target.value)} /></Field><Field label="Category"><select className={inputClass} value={mealForm.category} onChange={(e) => setMeal("category", e.target.value as MealCategory)}>{mealCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></Field><Field label="Meal name"><input className={inputClass} value={mealForm.name} onChange={(e) => setMeal("name", e.target.value)} /></Field>{(["calories", "protein", "carbs", "fat", "fiber", "sodium", "water"] as Array<keyof Meal>).map((field) => <Field key={String(field)} label={String(field)}><input className={inputClass} type="number" value={Number((mealForm as any)[field] ?? 0)} onChange={(e) => setMeal(field, Number(e.target.value))} /></Field>)}<label className="grid gap-1 text-sm text-zinc-300 md:col-span-2">Notes<textarea className={inputClass} value={mealForm.notes} onChange={(e) => setMeal("notes", e.target.value)} /></label></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><button onClick={saveMeal} className="rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">{editingMealId ? "Update meal" : "Add meal"}</button><button onClick={quickAddMeal} className="rounded-2xl border border-white/15 px-4 py-3 font-bold text-zinc-200">Quick-add 300 cal</button><button onClick={() => { setMealForm(emptyMeal(state.user.id, today)); setEditingMealId(null); }} className="rounded-2xl border border-white/15 px-4 py-3 font-bold text-zinc-200">Clear form</button></div><p className="mt-3 text-sm text-zinc-400">Meals can be logged as simple macro entries now. The data model also supports item-level foods under each meal for future food database/search flows.</p></Card>
      <Card eyebrow="Meal Timeline" title="Today’s meals"><div className="grid gap-3">{todayMeals.length ? todayMeals.map((meal: Meal) => <div key={meal.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-amber-300">{meal.category}</p><h3 className="mt-1 font-bold text-white">{meal.name || "Untitled meal"}</h3><p className="mt-1 text-sm text-zinc-400">{meal.calories + meal.items.reduce((sum, item) => sum + item.calories, 0)} cal · {meal.protein + meal.items.reduce((sum, item) => sum + item.protein, 0)}P · {meal.carbs + meal.items.reduce((sum, item) => sum + item.carbs, 0)}C · {meal.fat + meal.items.reduce((sum, item) => sum + item.fat, 0)}F · {meal.fiber + meal.items.reduce((sum, item) => sum + item.fiber, 0)} fiber · {meal.water + meal.items.reduce((sum, item) => sum + item.water, 0)} oz water</p>{meal.notes && <p className="mt-1 text-xs text-zinc-500">{meal.notes}</p>}</div><div className="flex gap-2"><button onClick={() => editMeal(meal)} className="rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-200">Edit</button><button onClick={() => deleteMeal(meal.id)} className="rounded-xl border border-red-300/30 px-3 py-2 text-sm text-red-200">Delete</button></div></div></div>) : <EmptyState title="No meals logged today" copy="Add a meal, quick-add a macro entry, or scan a label/photo to light up today’s macro rings." />}</div><div className="mt-4 rounded-2xl bg-white/[0.03] p-4 text-sm text-zinc-300"><b className="text-white">Computed totals:</b> {mealTotals.calories} cal · {mealTotals.protein}P · {mealTotals.carbs}C · {mealTotals.fat}F · {mealTotals.fiber} fiber · {mealTotals.sodium} sodium · {mealTotals.water} oz water</div></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card eyebrow="Compatibility" title="Synced daily NutritionLog"><p className="mb-3 text-sm text-zinc-400">When meals exist for today, this daily log is generated from meal totals so adherence, fuel score, and weekly review logic keep working.</p><div className="grid gap-3 md:grid-cols-2">{(["date", "calories", "protein", "carbs", "fat", "fiber", "water", "alcohol", "sodium"] as Array<keyof NutritionLog>).map((field) => <Field key={field} label={field}><input className={inputClass} type={field === "date" ? "date" : "number"} value={(todayMeals.length ? derivedLog as any : form as any)[field]} onChange={(e) => setForm({ ...form, [field]: e.target.type === "number" ? Number(e.target.value) : e.target.value })} readOnly={todayMeals.length && field !== "alcohol"} /></Field>)}<label className="grid gap-1 text-sm text-zinc-300 md:col-span-2">Notes<textarea className={inputClass} value={(todayMeals.length ? derivedLog.notes : form.notes)} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label></div><button onClick={saveManualDailyLog} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save legacy daily log</button></Card>
      <Card eyebrow="Targets" title="Coach target / manual override"><div className="grid gap-3 md:grid-cols-2">{(["calories", "protein", "carbs", "fat", "fiber", "water"] as Array<keyof MacroTarget>).map((field) => <Field key={String(field)} label={String(field)}><input className={inputClass} type="number" value={Number((targetForm as any)[field] ?? 0)} onChange={(e) => setTarget(field, Number(e.target.value))} /></Field>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={saveManualTarget} className="rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save manual override</button><button onClick={resetCoachTarget} className="rounded-2xl border border-white/15 px-4 py-3 font-bold text-zinc-200">Reset to coach target</button></div><p className="mt-3 text-sm text-zinc-400">Manual overrides are logged in Plan Adjustments. Reset restores the seeded coach target for this week.</p><div className="mt-4 rounded-2xl bg-white/[0.03] p-4 text-sm text-zinc-300"><b className="text-white">Coach target:</b> {coachTarget.calories} cal · {coachTarget.protein}g protein · {coachTarget.carbs}g carbs · {coachTarget.fat}g fat · {coachTarget.fiber}g fiber · {coachTarget.water} oz water</div></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card eyebrow="History" title="Recent synced nutrition logs"><div className="grid gap-3">{state.nutritionLogs.slice(-6).reverse().map((log: NutritionLog) => <div key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300"><b className="text-white">{log.date}</b><p>{log.calories} cal · {log.protein}P · {log.carbs}C · {log.fat}F</p><p>{log.fiber}g fiber · {log.water} oz water · alcohol {log.alcohol}</p></div>)}</div></Card>
      <Card eyebrow="Scan history" title="Mock scan audit"><div className="grid gap-3">{(state.foodScans ?? []).slice(-6).reverse().map((scan: FoodScanLog) => <div key={scan.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-amber-300">{scan.mode} · {scan.provider}</p><b className="text-white">{scan.result.detectedName}</b></div><span className="rounded-full bg-amber-400 px-2 py-1 text-xs font-black text-black">MOCK</span></div><p className="mt-2">{scan.result.calories} cal · {scan.result.protein}P · {scan.result.carbs}C · {scan.result.fat}F · confidence {scan.result.confidence}%</p><p className="mt-1 text-xs text-zinc-500">{scan.date} · {scan.imageName || "no image name"}</p></div>) || <p className="text-zinc-400">No scans confirmed yet.</p>}{!(state.foodScans ?? []).length && <p className="rounded-2xl bg-white/[0.03] p-4 text-sm text-zinc-400">No scans confirmed yet. Use the Scan button above to create mock scan history.</p>}</div></Card>
    </div>
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

function WeeklyReviewPanel({ review, macroRec, state, updateState }: any) {
  const accept = () => macroRec && updateState({ ...state, adjustments: [...state.adjustments, createCoachDecisionLogEntry({ id: uid("adj"), userId: state.user.id, date: new Date().toISOString(), category: "Macro target change", reason: macroRec.reason, originalPrescription: String(macroRec.action.includes("calories") ? macroRec.newCalories + 175 : "current"), adjustedPrescription: String(macroRec.newCalories), triggerData: { source: "Weekly Review", action: macroRec.action, nutritionAdherence: review.nutritionAdherence, weightChange: review.weightChange, waistChange: review.waistChange }, confidence: "Medium", mode: "manual override", notes: "Accepted from weekly review" })] });
  return <Card eyebrow="Every 7 days" title="Weekly coach review"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Avg weight" value={`${review.avgWeight} lb`} /><Stat label="Weight change" value={`${review.weightChange} lb`} /><Stat label="Waist change" value={`${review.waistChange} in`} /><Stat label="Score" value={`${review.transformationScore}/100`} tone="green" /><Stat label="Training" value={`${review.trainingAdherence}%`} /><Stat label="Nutrition" value={`${review.nutritionAdherence}%`} /><Stat label="Sleep" value={`${review.avgSleep}h`} /><Stat label="Steps" value={review.avgSteps} /></div><p className="mt-5 rounded-2xl bg-white/[0.04] p-4 text-zinc-300">{review.recommendation}</p><p className="mt-3 rounded-2xl bg-amber-400/10 p-4 text-amber-200">Macro recommendation: {macroRec?.action}. {macroRec?.reason}</p><div className="mt-4 flex gap-3"><button onClick={accept} className="rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Accept adjustment</button><button className="rounded-2xl border border-white/15 px-4 py-3 text-zinc-300">Reject / keep plan</button></div></Card>;
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

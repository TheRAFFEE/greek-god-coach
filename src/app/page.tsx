"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adjustWorkoutForReadiness,
  calculateReadiness,
  calculateWeightTrend,
  calculateRunTrends,
  createCoachDecisionLogEntry,
  generateDailyPrescription,
  generateNextSetRecommendation,
  generatePostWorkoutAnalysis,
  getNextWorkoutStep,
  getRecommendedStartingWeight,
  generateRunningRecommendation,
  buildRunTrendCards,
} from "@/lib/coach-engine";
import { evaluateDailyRecoveryStatus, upsertDailyCheckIn } from "@/lib/daily-checkin";
import { getWorkoutForWeekDay } from "@/lib/seed-data";
import { buildWeightTrendDashboard } from "@/lib/weight-trend";
import { buildRunLoggerRecord, saveRunLoggerEntry, type RunLoggerInput } from "@/lib/run-logger";
import { buildWorkoutLoggerSession, saveWorkoutLoggerEntry, type WorkoutLoggerExerciseInput, type WorkoutLoggerInput, type WorkoutLoggerType } from "@/lib/workout-logger";
import { buildNutritionLogRecord, evaluateNutritionLoggerAdherence, getNutritionLoggerTarget, saveNutritionLoggerEntry, type NutritionLoggerDayType, type NutritionLoggerInput } from "@/lib/nutrition-logger";
import { buildWeeklyReviewSummary } from "@/lib/weekly-review";
import { buildHomeCommandCenter } from "@/lib/home-command-center";
import { appNavigation, type PrimaryNavigationId } from "@/lib/navigation";
import { createAuthAwarePersistenceContext, syncAppStateToSupabase, type AuthPersistenceContext } from "@/lib/supabase-persistence";
import { loadState, saveState, todayIso, uid } from "@/lib/storage";
import type { AppState, CoachDecision, DailyCheckIn, Exercise, FormQuality, ProgressPhoto, RunType, SetLog, WorkoutSession } from "@/lib/types";

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

function RingMetric({ label, value, percent, tone = "yellow", sub }: { label: string; value: string; percent: number; tone?: "green" | "yellow" | "red" | "neutral"; sub?: string }) {
  const stroke = tone === "green" ? "#34d399" : tone === "red" ? "#fb7185" : tone === "yellow" ? "#fbbf24" : "#a1a1aa";
  return <div className="rounded-3xl border border-white/10 bg-black/25 p-4"><div className="flex items-center gap-3"><svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90"><circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,.1)" strokeWidth="7" fill="none" /><circle cx="28" cy="28" r="22" stroke={stroke} strokeWidth="7" strokeLinecap="round" fill="none" strokeDasharray={`${Math.max(0, Math.min(100, percent)) * 1.38} 138`} /></svg><div><p className="text-xs text-zinc-500">{label}</p><p className="text-lg font-black text-white">{value}</p>{sub && <p className="text-xs text-zinc-400">{sub}</p>}</div></div></div>;
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
  const [active, setActive] = useState<PrimaryNavigationId>("Home");
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
  const nextRunLabel = runningRecommendation ? `${runningRecommendation.action}: ${runningRecommendation.recommendedDistance} mi` : `${plannedRunDistance} mi planned`;
  const dailyPrescription = useMemo(() => state && latestCheckIn && macroTarget && readiness ? generateDailyPrescription({ readiness, checkIn: latestCheckIn, workout: currentWorkout, macroTarget, nutritionLogs: state.nutritionLogs, bodyMetrics: state.bodyMetrics, trainingAdherence, postWorkoutRecommendations: state.postWorkoutRecommendations, runningRecommendation: runningRecommendation ?? undefined }) : null, [state, latestCheckIn, macroTarget, readiness, currentWorkout, trainingAdherence, runningRecommendation]);
  const homeCommandCenter = useMemo(() => state && macroTarget && readiness && dailyPrescription ? buildHomeCommandCenter(state, { today: todayIso(), readinessStatus: readiness.status, todaysWorkout: adjustedWorkout.title, todaysRun: nextRunLabel, macroTarget, coachRecommendation: dailyPrescription.exactWorkoutRecommendation }) : null, [state, macroTarget, readiness, dailyPrescription, adjustedWorkout.title, nextRunLabel]);
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
  if (!state || !readiness || !macroTarget || !trend || !weeklyReview || !dailyPrescription || !homeCommandCenter) return <main className="min-h-screen bg-black p-8 text-white">Loading coach...</main>;

  const updateState = (next: AppState) => setState(next);
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#3f2f12,transparent_30%),linear-gradient(135deg,#050505,#111111_50%,#050505)] text-zinc-100">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-black/70 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><p className="text-xs uppercase tracking-[0.4em] text-amber-300">Greek God Coach</p><h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">12-week transformation command center</h1></div>
          <div className="flex gap-2"><span className="hidden rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-400 md:inline">{persistenceStatus}</span><button onClick={() => setActive("Log")} className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black">Start Day</button></div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">{appNavigation.map((tab) => <button key={tab.id} onClick={() => setActive(tab.id)} className={classNames("whitespace-nowrap rounded-full px-4 py-2 text-sm", active === tab.id ? "bg-white text-black" : "bg-white/5 text-zinc-300")}>{tab.label}</button>)}</nav>
      </header>

      <div className="py-3">
        {active === "Home" && <Dashboard model={homeCommandCenter} onStartDay={() => setActive("Log")} />}
        {active === "Train" && <TrainScreen state={state} updateState={updateState} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} selectedDay={selectedDay} setSelectedDay={setSelectedDay} readiness={readiness} workout={adjustedWorkout} originalWorkout={currentWorkout} latestCheckIn={latestCheckIn} runningRecommendation={runningRecommendation} runTrends={runTrends} plannedRunDistance={plannedRunDistance} />}
        {active === "Log" && <LogScreen state={state} updateState={updateState} readiness={readiness} trend={trend} />}
        {active === "Progress" && <ProgressScreen state={state} updateState={updateState} weeklyReview={weeklyReview} />}
        {active === "More" && <MoreScreen state={state} updateState={updateState} />}
      </div>
    </div>
  </main>;
}

function Dashboard({ model, onStartDay }: { model: ReturnType<typeof buildHomeCommandCenter>; onStartDay: () => void }) {
  const readinessTone = model.readinessStatus === "Green" ? "text-emerald-300" : model.readinessStatus === "Yellow" ? "text-amber-300" : "text-red-300";
  const metric = (label: string, value: string | number, tone = "text-white") => <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p><p className={`mt-1 truncate text-lg font-black ${tone}`}>{value}</p></div>;
  return <section className="rounded-3xl border border-amber-300/30 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.18),transparent_35%),rgba(69,26,3,.18)] p-4 shadow-2xl shadow-black/30">
    <p className="text-xs uppercase tracking-[0.25em] text-amber-300/80">Home</p>
    <h2 className="mt-1 text-2xl font-black text-white">Today’s coach brief</h2>
    <div className="mt-4 grid grid-cols-2 gap-3">
      {metric("Readiness", model.readinessStatus, readinessTone)}
      {metric("Today’s plan", `${model.todaysWorkout} · ${model.todaysRun}`)}
      {metric("Calories", model.caloriesRemaining)}
      {metric("Weight", model.currentWeight === null ? "—" : `${model.currentWeight} lb`)}
    </div>
    <button type="button" onClick={onStartDay} className="mt-4 w-full rounded-2xl bg-amber-400 px-4 py-3 text-base font-black text-black shadow-lg shadow-amber-950/20">Start Day</button>
  </section>;
}

function TrainScreen({ state, updateState, selectedWeek, setSelectedWeek, selectedDay, setSelectedDay, readiness, workout, originalWorkout, latestCheckIn, runningRecommendation, plannedRunDistance }: any) {
  return <TrainingPlan state={state} updateState={updateState} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} selectedDay={selectedDay} setSelectedDay={setSelectedDay} readiness={readiness} workout={workout} originalWorkout={originalWorkout} latestCheckIn={latestCheckIn} runningRecommendation={runningRecommendation} plannedRunDistance={plannedRunDistance} />;
}

function LogScreen({ state, updateState, readiness, trend }: any) {
  const [section, setSection] = useState<"checkin" | "workout" | "run" | "nutrition" | "body">("checkin");
  const options = [
    ["checkin", "Daily check-in"],
    ["workout", "Workout logging"],
    ["run", "Run logging"],
    ["nutrition", "Nutrition logging"],
    ["body", "Body metrics logging"],
  ] as const;
  return <div className="grid gap-4">
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">{options.map(([id, label]) => <button key={id} type="button" onClick={() => setSection(id)} className={classNames("rounded-2xl px-3 py-3 text-sm font-black", section === id ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300")}>{label}</button>)}</section>
    {section === "checkin" && <DailyCheckInForm state={state} updateState={updateState} readiness={readiness} />}
    {section === "workout" && <WorkoutLogger state={state} updateState={updateState} />}
    {section === "run" && <Running state={state} updateState={updateState} plannedDistance={3} />}
    {section === "nutrition" && <NutritionLogger state={state} updateState={updateState} />}
    {section === "body" && <BodyMetrics state={state} updateState={updateState} trend={trend} />}
  </div>;
}

function ProgressScreen({ state, updateState, weeklyReview }: { state: AppState; updateState: (s: AppState) => void; weeklyReview: ReturnType<typeof buildWeeklyReviewSummary> | null }) {
  const [section, setSection] = useState<"weight" | "run" | "review" | "photos" | "race" | "adherence">("weight");
  const weightDashboard = buildWeightTrendDashboard(state.bodyMetrics ?? [], { startingWeight: 233, goalWeight: 199.9 });
  const runTrends = calculateRunTrends(state.runLogs ?? []);
  const raceDays = buildHomeCommandCenter(state, { today: todayIso(), readinessStatus: "Green", todaysWorkout: "", todaysRun: "", macroTarget: state.macroTargets[0], coachRecommendation: "" }).daysUntilRace;
  const options = [
    ["weight", "Weight trends"],
    ["run", "Pace trends / Mileage trends"],
    ["review", "Weekly review"],
    ["photos", "Progress photos"],
    ["race", "Race countdown"],
    ["adherence", "Adherence metrics"],
  ] as const;
  return <div className="grid gap-4">
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{options.map(([id, label]) => <button key={id} type="button" onClick={() => setSection(id)} className={classNames("rounded-2xl px-3 py-3 text-sm font-black", section === id ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300")}>{label}</button>)}</section>
    {section === "weight" && <WeightTrendDashboardCard dashboard={weightDashboard} />}
    {section === "run" && <RunProgress trends={runTrends} />}
    {section === "review" && <WeeklyReviewPanel review={weeklyReview} />}
    {section === "photos" && <ProgressPhotos state={state} updateState={updateState} />}
    {section === "race" && <Card eyebrow="Race Countdown" title="Half marathon countdown"><Stat label="Days until race" value={raceDays} sub="January 17" tone="yellow" /></Card>}
    {section === "adherence" && <Card eyebrow="Adherence Metrics" title="Execution consistency"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Training adherence" value={`${weeklyReview?.adherenceScore ?? 0}/100`} tone={(weeklyReview?.adherenceScore ?? 0) >= 80 ? "green" : "yellow"} /><Stat label="Weekly miles" value={`${weeklyReview?.totalWeeklyMiles ?? 0} mi`} /><Stat label="Lifts completed" value={weeklyReview?.liftsCompleted ?? 0} /></div></Card>}
  </div>;
}

function MoreScreen({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  return <div className="grid gap-5">
    <Settings state={state} updateState={updateState} />
    <Onboarding state={state} updateState={updateState} />
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
  return <Card eyebrow="Goals" title="Goals"><div className="grid gap-4 md:grid-cols-2">{[["Name","name"],["Age","age"],["Height","height"],["Starting weight","startingWeight"],["Goal weight","goalWeight"],["Training experience","trainingExperience"],["Current strength numbers","strengthNumbers"],["Equipment available","equipment"],["Injury history","injuryHistory"],["Primary goal","goal"]].map(([label, field]) => <Field key={field} label={label}><input className={inputClass} value={(u as any)[field]} onChange={(e) => set(field, field.includes("weight") || field === "age" ? Number(e.target.value) : e.target.value)} /></Field>)}</div></Card>;
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
  const set = (field: keyof WorkoutLoggerInput, value: string | number | boolean | WorkoutLoggerExerciseInput[]) => setForm({ ...form, [field]: value });
  const setExercise = (index: number, field: keyof WorkoutLoggerExerciseInput, value: string | number | boolean) => set("exercises", form.exercises.map((exercise, i) => i === index ? { ...exercise, [field]: value } : exercise));
  const save = () => updateState(saveWorkoutLoggerEntry(state, buildWorkoutLoggerSession(form), { sorenessLevel: form.sorenessLevel, sleepHours: form.sleepHours }).state);
  return <Card eyebrow="Workout Logging" title="Log a workout"><div className="grid gap-3 md:grid-cols-2">
    <Field label="Workout date"><input className={inputClass} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
    <Field label="Workout type"><select className={inputClass} value={form.workoutType} onChange={(e) => set("workoutType", e.target.value as WorkoutLoggerType)}><option value="upper strength">Upper strength</option><option value="lower strength">Lower strength</option><option value="Greek god hypertrophy">Greek god hypertrophy</option><option value="recovery">Recovery</option></select></Field>
    <Field label="Sleep hours"><input className={inputClass} type="number" step="0.1" value={form.sleepHours} onChange={(e) => set("sleepHours", Number(e.target.value))} /></Field>
    <Field label="Soreness 1-10"><input className={inputClass} type="number" min="1" max="10" value={form.sorenessLevel} onChange={(e) => set("sorenessLevel", Number(e.target.value))} /></Field>
    <Field label="Completed"><select className={inputClass} value={String(form.completed)} onChange={(e) => set("completed", e.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></Field>
  </div><div className="mt-4 grid gap-3">{form.exercises.map((exercise, index) => <div key={exercise.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="mb-3 font-bold text-white">Exercise {index + 1}</p><div className="grid gap-3 md:grid-cols-3"><Field label="Exercise"><input className={inputClass} value={exercise.name} onChange={(e) => setExercise(index, "name", e.target.value)} /></Field><Field label="Sets"><input className={inputClass} type="number" min="0" value={exercise.sets} onChange={(e) => setExercise(index, "sets", Number(e.target.value))} /></Field><Field label="Reps"><input className={inputClass} type="number" min="0" value={exercise.reps} onChange={(e) => setExercise(index, "reps", Number(e.target.value))} /></Field><Field label="Weight"><input className={inputClass} type="number" min="0" value={exercise.weight} onChange={(e) => setExercise(index, "weight", Number(e.target.value))} /></Field><Field label="RPE"><input className={inputClass} type="number" min="1" max="10" value={exercise.rpe} onChange={(e) => setExercise(index, "rpe", Number(e.target.value))} /></Field><Field label="Exercise completed"><select className={inputClass} value={String(exercise.completed)} onChange={(e) => setExercise(index, "completed", e.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></Field><label className="grid gap-1 text-sm text-zinc-300 md:col-span-3">Pain notes<textarea className={inputClass} value={exercise.painNotes} onChange={(e) => setExercise(index, "painNotes", e.target.value)} /></label></div></div>)}</div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save workout log</button></Card>;
}

function TrainingPlan({ state, updateState, selectedWeek, setSelectedWeek, selectedDay, setSelectedDay, readiness, workout, originalWorkout, latestCheckIn, runningRecommendation, plannedRunDistance }: { state: AppState; updateState: (s: AppState) => void; selectedWeek: number; setSelectedWeek: (n: number) => void; selectedDay: number; setSelectedDay: (n: number) => void; readiness: any; workout: any; originalWorkout: any; latestCheckIn?: DailyCheckIn; runningRecommendation?: any; plannedRunDistance: number }) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const displayedWorkout = workout;
  const tone = readiness.status === "Green" ? "green" : readiness.status === "Yellow" ? "yellow" : "red";
  const activeSession = (activeSessionId ? state.workoutSessions.find((session) => session.id === activeSessionId) : null)
    ?? [...state.workoutSessions].reverse().find((session) => session.workoutId === displayedWorkout.id && session.status === "active");

  const startWorkout = () => {
    const now = new Date().toISOString();
    const session: WorkoutSession = {
      id: uid("session"),
      userId: state.user.id,
      workoutId: displayedWorkout.id,
      workoutTitle: displayedWorkout.title,
      mode: "coach",
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

  return <Card eyebrow="Train" title="Today’s training plan">
    <div className="grid gap-3 md:grid-cols-3">
      <Field label="Week"><select className={inputClass} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>Week {i+1}</option>)}</select></Field>
      <Field label="Day"><select className={inputClass} value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
      <Stat label="Readiness" value={`${readiness.status} — ${readiness.score}`} sub={readiness.reason} tone={tone} />
    </div>
    <button onClick={startWorkout} className="mt-4 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Start Training</button>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-amber-300">Today’s workout</p><h3 className="mt-2 text-xl font-black text-white">{displayedWorkout.title}</h3><div className="mt-3 grid gap-2">{displayedWorkout.exercises.length ? displayedWorkout.exercises.map((exercise: Exercise) => <p key={exercise.id} className="rounded-xl bg-black/20 p-3 text-sm text-zinc-300"><b className="text-white">{exercise.order}. {exercise.name}</b> · {exercise.prescribedSets} x {exercise.prescribedReps} · RPE ≤{exercise.prescribedRpe ?? 8}</p>) : <p className="text-red-200">Recovery replacement: walk, mobility, hydration, sleep, or full rest.</p>}</div></div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-sky-300">Today’s run</p><h3 className="mt-2 text-xl font-black text-white">{runningRecommendation ? `${runningRecommendation.action}: ${runningRecommendation.recommendedDistance} mi` : `${plannedRunDistance} mi planned`}</h3><p className="mt-2 text-sm text-zinc-400">{runningRecommendation?.message ?? originalWorkout.notes ?? "Run stays conversational unless today’s workout says otherwise."}</p>{latestCheckIn?.pain ? <p className="mt-3 rounded-xl bg-red-950/40 p-3 text-sm text-red-200">Pain flag: keep training pain-free.</p> : null}</div>
    </div>
  </Card>;
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


function Running({ state, updateState, plannedDistance }: { state: AppState; updateState: (s: AppState) => void; plannedDistance: number }) {
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
  const set = (field: keyof RunLoggerInput, value: string | number | boolean) => setForm({ ...form, [field]: value });
  const save = () => updateState(saveRunLoggerEntry(state, buildRunLoggerRecord(form)).state);
  return <Card eyebrow="Run Logging" title="Log a run"><div className="grid gap-3 md:grid-cols-2">
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
  </div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save run log</button></Card>;
}

function RunProgress({ trends }: { trends: ReturnType<typeof calculateRunTrends> }) {
  const runTrendCards = buildRunTrendCards(trends);
  return <Card eyebrow="Run Trends" title="Pace and mileage trends"><div className="mb-4 grid gap-3 sm:grid-cols-2">{runTrendCards.map((card) => <Stat key={card.label} label={card.label} value={card.value} sub={card.coachCopy} tone={card.tone === "neutral" ? "neutral" : card.tone} />)}</div><div className="grid gap-4"><div><p className="mb-2 text-sm font-bold text-zinc-300">Mileage trend</p><Sparkline values={trends.distanceTrend ?? []} color="#38bdf8" /></div><div><p className="mb-2 text-sm font-bold text-zinc-300">Pace trend</p><Sparkline values={trends.paceTrend ?? []} color="#f59e0b" /></div></div></Card>;
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
  return <Card eyebrow="Body Metrics Logging" title="Measurements"><div className="grid gap-3 md:grid-cols-2">{Object.keys(metric).filter((k) => !["id","userId"].includes(k)).map((field) => <Field key={field} label={field}><input className={inputClass} type={field === "date" ? "date" : field === "notes" ? "text" : "number"} value={metric[field]} onChange={(e) => setMetric({ ...metric, [field]: e.target.type === "number" ? Number(e.target.value) : e.target.value })} /></Field>)}</div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save measurements</button></Card>;
}

function ProgressPhotos({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const [photo, setPhoto] = useState<ProgressPhoto>({ id: uid("photo"), userId: state.user.id, date: todayIso(), frontPhotoUrl: "", sidePhotoUrl: "", backPhotoUrl: "", notes: "" });
  const save = () => updateState({ ...state, photos: [...state.photos, photo] });
  return <Card eyebrow="Weekly comparison" title="Progress photos"><p className="mb-4 text-sm text-zinc-400">For this MVP, paste local/object-storage URLs. The Supabase schema includes photo URL fields so storage buckets can be wired in later.</p><div className="grid gap-3 md:grid-cols-2">{["date","frontPhotoUrl","sidePhotoUrl","backPhotoUrl","notes"].map((field) => <Field key={field} label={field}><input className={inputClass} type={field === "date" ? "date" : "text"} value={(photo as any)[field] ?? ""} onChange={(e) => setPhoto({ ...photo, [field]: e.target.value })} /></Field>)}</div><button onClick={save} className="mt-5 rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save photo record</button><div className="mt-5 grid gap-3 md:grid-cols-3">{state.photos.map((p) => <div key={p.id} className="rounded-2xl bg-white/[0.03] p-3 text-sm text-zinc-400"><b className="text-white">{p.date}</b><br />Front: {p.frontPhotoUrl || "—"}<br />Side: {p.sidePhotoUrl || "—"}<br />Back: {p.backPhotoUrl || "—"}</div>)}</div></Card>;
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

function Settings({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  return <Card eyebrow="Settings" title="Settings and Integrations"><div className="grid gap-3 md:grid-cols-2"><Field label="Preferred units"><select className={inputClass} value={state.user.preferredUnits} onChange={(e) => updateState({ ...state, user: { ...state.user, preferredUnits: e.target.value as any } })}><option value="imperial">Imperial</option><option value="metric">Metric</option></select></Field><Field label="Notifications"><input className={inputClass} value="Morning check-in, weekly photos, long-run reminder" readOnly /></Field><Field label="Future Apple Health fields"><textarea className={inputClass} readOnly value="Steps, active calories, resting HR, HRV, sleep duration/stages, VO2 max, workout HR zones, running pace, recovery HR, cardio fitness trend" /></Field><Field label="Database mode"><textarea className={inputClass} readOnly value="MVP persists to localStorage now. Supabase/Postgres schema and seed SQL are included under supabase/ for production wiring." /></Field></div></Card>;
}

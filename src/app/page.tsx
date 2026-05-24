"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adjustWorkoutForReadiness,
  calculateAdherence,
  calculateReadiness,
  calculateWeightTrend,
  detectInjuryRisk,
  estimatedOneRepMax,
  generateWeeklyReview,
  recommendMacroAdjustment,
  recommendProgression,
  recommendWorkoutAdjustment,
} from "@/lib/coach-engine";
import { getWorkoutForWeekDay, workouts } from "@/lib/seed-data";
import { loadState, resetState, saveState, todayIso, uid } from "@/lib/storage";
import type { AppState, DailyCheckIn, Exercise, ExerciseLog, NutritionLog, ProgressPhoto, ReadinessStatus } from "@/lib/types";

const tabs = ["Dashboard", "Onboarding", "Daily Check-In", "Workout", "Nutrition", "Body Metrics", "Progress Photos", "Readiness", "Weekly Review", "Plan Adjustments", "Settings"];

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
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => setState(loadState()), []);
  useEffect(() => { if (state) saveState(state); }, [state]);

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
  const macroRec = useMemo(() => state && trend && macroTarget && latestCheckIn ? recommendMacroAdjustment({ currentCalories: macroTarget.calories, weightChange14Day: trend.change14Day, weeklyLossRate: trend.weeklyLossRate, waistChange: trend.waistChange, nutritionAdherence, trainingAdherence, energy: latestCheckIn.energy, hunger: latestCheckIn.hunger, sleep: latestCheckIn.sleepHours, performanceTrend: "stable", upcomingWorkoutType: currentWorkout.type }) : null, [state, trend, macroTarget, latestCheckIn, nutritionAdherence, trainingAdherence, currentWorkout.type]);
  const workoutRec = useMemo(() => latestCheckIn && readiness ? recommendWorkoutAdjustment({ readinessStatus: readiness.status, soreness: latestCheckIn.soreness, pain: latestCheckIn.pain, painLocation: latestCheckIn.painLocation, painSeverity: latestCheckIn.painSeverity, missedReps: false, upcomingWorkoutType: currentWorkout.type }) : null, [latestCheckIn, readiness, currentWorkout.type]);

  if (!state || !readiness || !macroTarget || !trend || !weeklyReview) return <main className="min-h-screen bg-black p-8 text-white">Loading coach...</main>;

  const updateState = (next: AppState) => setState(next);
  const latestInjuryRisk = latestCheckIn ? detectInjuryRisk(latestCheckIn) : { level: "Low", recommendation: "No check-in yet." };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#3f2f12,transparent_30%),linear-gradient(135deg,#050505,#111111_50%,#050505)] text-zinc-100">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-black/70 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><p className="text-xs uppercase tracking-[0.4em] text-amber-300">Greek God Coach</p><h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl">12-week transformation command center</h1><p className="mt-2 max-w-3xl text-sm text-zinc-400">Not a passive tracker: the app compares planned vs. actual performance, recovery, macros, wearable trends, and body metrics to recommend the next best action.</p></div>
          <div className="flex gap-2"><button onClick={() => updateState(resetState())} className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300">Reset demo</button><button onClick={() => setActive("Daily Check-In")} className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black">Check in</button></div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button key={tab} onClick={() => setActive(tab)} className={classNames("whitespace-nowrap rounded-full px-4 py-2 text-sm", active === tab ? "bg-white text-black" : "bg-white/5 text-zinc-300")}>{tab}</button>)}</nav>
      </header>

      <div className="py-6">
        {active === "Dashboard" && <Dashboard state={state} readiness={readiness} trend={trend} macroTarget={macroTarget} workoutTitle={adjustedWorkout.title} nutritionAdherence={nutritionAdherence} trainingAdherence={trainingAdherence} macroRec={macroRec?.action ?? "Keep calories"} weeklyScore={weeklyReview.transformationScore} latestCheckIn={latestCheckIn} />}
        {active === "Onboarding" && <Onboarding state={state} updateState={updateState} />}
        {active === "Daily Check-In" && <DailyCheckInForm state={state} updateState={updateState} readiness={readiness} />}
        {active === "Workout" && <WorkoutTracker state={state} updateState={updateState} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} selectedDay={selectedDay} setSelectedDay={setSelectedDay} readinessStatus={readiness.status} workout={adjustedWorkout} originalType={currentWorkout.type} />}
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

function Dashboard({ state, readiness, trend, macroTarget, workoutTitle, nutritionAdherence, trainingAdherence, macroRec, weeklyScore, latestCheckIn }: any) {
  const tone = readiness.status === "Green" ? "green" : readiness.status === "Yellow" ? "yellow" : "red";
  return <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
    <Card eyebrow="Today" title="Coach dashboard"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Week / Phase" value={`W${state.currentWeek}`} sub={workouts.find((w) => w.week === state.currentWeek)?.phase} /><Stat label="Readiness" value={`${readiness.score}`} sub={readiness.status} tone={tone} /><Stat label="Macros" value={`${macroTarget.calories}`} sub={`${macroTarget.protein}P ${macroTarget.carbs}C ${macroTarget.fat}F`} /><Stat label="Transformation" value={`${weeklyScore}/100`} sub="weekly score" tone="green" /></div><div className="mt-5 rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-bold uppercase tracking-[0.25em]">Next action</p><h3 className="mt-2 text-2xl font-black">{readiness.status === "Green" ? "Full send — controlled aggression." : readiness.status === "Yellow" ? "Modify, don't quit." : "Recover hard. Adaptation happens now."}</h3><p className="mt-2 text-sm font-medium">{readiness.recommendation}</p></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Stat label="Today’s workout" value={workoutTitle} sub="adjusted by readiness" /><Stat label="Nutrition adherence" value={`${nutritionAdherence}%`} sub={macroRec} /><Stat label="Training adherence" value={`${trainingAdherence}%`} sub="last 7 days" /></div></Card>
    <Card eyebrow="Trends" title="Weight, waist, wearable signal"><div className="grid grid-cols-2 gap-3"><Stat label="7-day avg weight" value={`${trend.current7DayAverage} lb`} sub={`${trend.change14Day} lb vs prior 7`} /><Stat label="Waist trend" value={`${trend.waistChange} in`} sub="weekly comparison" /><Stat label="Steps" value={latestCheckIn?.steps ?? 0} sub="10k minimum" /><Stat label="Sleep / RHR / HRV" value={`${latestCheckIn?.sleepHours ?? 0}h`} sub={`${latestCheckIn?.restingHr ?? "—"} bpm / ${latestCheckIn?.hrv ?? "—"} ms`} /></div><div className="mt-4"><Sparkline values={state.bodyMetrics.slice(-14).map((m: any) => m.weight)} /></div></Card>
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

function WorkoutTracker({ state, updateState, selectedWeek, setSelectedWeek, selectedDay, setSelectedDay, readinessStatus, workout, originalType }: { state: AppState; updateState: (s: AppState) => void; selectedWeek: number; setSelectedWeek: (n: number) => void; selectedDay: number; setSelectedDay: (n: number) => void; readinessStatus: ReadinessStatus; workout: any; originalType: string }) {
  const [logs, setLogs] = useState<Record<string, ExerciseLog>>({});
  const save = () => updateState({ ...state, currentWeek: selectedWeek, exerciseLogs: [...state.exerciseLogs, ...Object.entries(logs).map(([exerciseId, log]) => ({ ...log, id: uid("elog"), userId: state.user.id, exerciseId, date: todayIso() }))] });
  return <Card eyebrow="Workout Tracker" title="Planned vs. actual"><div className="grid gap-3 sm:grid-cols-3"><Field label="Week"><select className={inputClass} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>Week {i+1}</option>)}</select></Field><Field label="Day"><select className={inputClass} value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field><Stat label="Readiness adjustment" value={readinessStatus} sub={originalType} tone={readinessStatus === "Green" ? "green" : readinessStatus === "Yellow" ? "yellow" : "red"} /></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="text-lg font-bold">{workout.title}</h3><p className="mt-1 text-sm text-zinc-400">{workout.notes}</p>{workout.finisher && <p className="mt-2 text-sm text-amber-300">Finisher: {workout.finisher}</p>}</div><div className="mt-4 grid gap-3">{workout.exercises.length ? workout.exercises.map((exercise: Exercise) => <ExerciseCard key={exercise.id} exercise={exercise} logs={logs} setLogs={setLogs} />) : <p className="rounded-2xl bg-red-950/40 p-4 text-red-200">Red day replacement: walk, mobility, easy Zone 2, or full rest.</p>}</div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save workout logs</button></Card>;
}

function ExerciseCard({ exercise, logs, setLogs }: { exercise: Exercise; logs: Record<string, ExerciseLog>; setLogs: (l: Record<string, ExerciseLog>) => void }) {
  const log = logs[exercise.id] ?? { setsCompleted: exercise.prescribedSets, repsCompleted: parseInt(exercise.prescribedReps) * exercise.prescribedSets || 0, weightUsed: 0, rpe: exercise.prescribedRpe ?? 8, restTime: 90, pain: false, notes: "" };
  const progression = recommendProgression({ exerciseName: exercise.name, category: exercise.category, prescribedSets: exercise.prescribedSets, prescribedReps: exercise.prescribedReps, previousWeight: log.weightUsed || 0, log });
  const set = (field: keyof ExerciseLog, value: any) => setLogs({ ...logs, [exercise.id]: { ...log, [field]: value } });
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="font-bold text-white">{exercise.order}. {exercise.name}</h4><p className="text-sm text-zinc-400">Target: {exercise.prescribedSets} x {exercise.prescribedReps} · RPE ≤{exercise.prescribedRpe}</p></div><p className="text-xs text-amber-300">{progression.recommendation}</p></div><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">{[["Sets","setsCompleted"],["Reps","repsCompleted"],["Weight","weightUsed"],["RPE","rpe"],["Rest sec","restTime"]].map(([label, field]) => <Field key={field} label={label}><input className={inputClass} type="number" value={(log as any)[field]} onChange={(e) => set(field as keyof ExerciseLog, Number(e.target.value))} /></Field>)}<Field label="Pain"><select className={inputClass} value={String(log.pain)} onChange={(e) => set("pain", e.target.value === "true")}><option value="false">No</option><option value="true">Yes</option></select></Field></div>{log.weightUsed > 0 && <p className="mt-2 text-xs text-zinc-400">Estimated 1RM: {estimatedOneRepMax(log.weightUsed, Math.max(1, Math.round(log.repsCompleted / Math.max(1, log.setsCompleted))))} lb · Suggested next: {progression.nextWeight} lb</p>}</div>;
}

function Nutrition({ state, updateState, target, adherence, recommendation }: any) {
  const [form, setForm] = useState<NutritionLog>({ id: uid("nutrition"), userId: state.user.id, date: todayIso(), calories: target.calories, protein: target.protein, carbs: target.carbs, fat: target.fat, fiber: target.fiber, sodium: 2600, water: target.water, alcohol: 0, notes: "" });
  const set = (field: keyof NutritionLog, value: any) => setForm({ ...form, [field]: value });
  const save = () => updateState({ ...state, nutritionLogs: [...state.nutritionLogs.filter((n: NutritionLog) => n.date !== form.date), form] });
  return <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]"><Card eyebrow="Targets" title="Macros"><div className="grid grid-cols-2 gap-3"><Stat label="Calories" value={target.calories} /><Stat label="Protein" value={`${target.protein}-${target.proteinMax ?? target.protein}g`} /><Stat label="Carbs" value={`${target.carbs}g`} /><Stat label="Fat" value={`${target.fat}g`} /><Stat label="Adherence" value={`${adherence}%`} tone={adherence >= 85 ? "green" : adherence >= 80 ? "yellow" : "red"} /><Stat label="Coach" value={recommendation?.action ?? "Keep"} sub={recommendation?.reason} /></div></Card><Card eyebrow="Daily Log" title="Consumed"><div className="grid gap-3 md:grid-cols-2">{Object.entries(form).filter(([k]) => !["id","userId","notes"].includes(k)).map(([field, value]) => <Field key={field} label={field}><input className={inputClass} type={field === "date" ? "date" : "number"} value={value as any} onChange={(e) => set(field as keyof NutritionLog, e.target.type === "number" ? Number(e.target.value) : e.target.value)} /></Field>)}<label className="grid gap-1 text-sm text-zinc-300 md:col-span-2">Notes<textarea className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label></div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save nutrition log</button></Card></div>;
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
  const accept = () => macroRec && updateState({ ...state, adjustments: [...state.adjustments, { id: uid("adj"), userId: state.user.id, date: todayIso(), adjustmentType: macroRec.action, reason: macroRec.reason, previousValue: String(macroRec.action.includes("calories") ? macroRec.newCalories + 175 : "current"), newValue: String(macroRec.newCalories), notes: "Accepted from weekly review" }] });
  return <Card eyebrow="Every 7 days" title="Weekly coach review"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Avg weight" value={`${review.avgWeight} lb`} /><Stat label="Weight change" value={`${review.weightChange} lb`} /><Stat label="Waist change" value={`${review.waistChange} in`} /><Stat label="Score" value={`${review.transformationScore}/100`} tone="green" /><Stat label="Training" value={`${review.trainingAdherence}%`} /><Stat label="Nutrition" value={`${review.nutritionAdherence}%`} /><Stat label="Sleep" value={`${review.avgSleep}h`} /><Stat label="Steps" value={review.avgSteps} /></div><p className="mt-5 rounded-2xl bg-white/[0.04] p-4 text-zinc-300">{review.recommendation}</p><p className="mt-3 rounded-2xl bg-amber-400/10 p-4 text-amber-200">Macro recommendation: {macroRec?.action}. {macroRec?.reason}</p><div className="mt-4 flex gap-3"><button onClick={accept} className="rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Accept adjustment</button><button className="rounded-2xl border border-white/15 px-4 py-3 text-zinc-300">Reject / keep plan</button></div></Card>;
}

function PlanAdjustments({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  return <Card eyebrow="Audit trail" title="Plan adjustments"><div className="grid gap-3">{state.adjustments.length ? state.adjustments.map((a) => <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><b>{a.date} · {a.adjustmentType}</b><p className="text-sm text-zinc-400">{a.reason}</p><p className="text-xs text-zinc-500">{a.previousValue} → {a.newValue}</p></div>) : <p className="text-zinc-400">No accepted adjustments yet. Weekly review recommendations can be accepted here.</p>}</div><button onClick={() => updateState({ ...state, adjustments: [] })} className="mt-4 rounded-2xl border border-white/15 px-4 py-2 text-sm">Clear adjustment log</button></Card>;
}

function Settings({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  return <Card eyebrow="Preferences" title="Settings"><div className="grid gap-3 md:grid-cols-2"><Field label="Preferred units"><select className={inputClass} value={state.user.preferredUnits} onChange={(e) => updateState({ ...state, user: { ...state.user, preferredUnits: e.target.value as any } })}><option value="imperial">Imperial</option><option value="metric">Metric</option></select></Field><Field label="Notifications"><input className={inputClass} value="Morning check-in, weekly photos, long-run reminder" readOnly /></Field><Field label="Future Apple Health fields"><textarea className={inputClass} readOnly value="Steps, active calories, resting HR, HRV, sleep duration/stages, VO2 max, workout HR zones, running pace, recovery HR, cardio fitness trend" /></Field><Field label="Database mode"><textarea className={inputClass} readOnly value="MVP persists to localStorage now. Supabase/Postgres schema and seed SQL are included under supabase/ for production wiring." /></Field></div></Card>;
}

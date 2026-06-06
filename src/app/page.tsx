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
import { deriveDailyCompletionStatus, evaluateDailyRecoveryStatus, upsertDailyCheckIn } from "@/lib/daily-checkin";
import { createInitialState, getWorkoutForWeekDay, workouts } from "@/lib/seed-data";
import { buildWeightTrendDashboard } from "@/lib/weight-trend";
import { saveTrainRunLog, type TrainRunLogInput } from "@/lib/run-logger";
import { evaluateTraining, type TrainingEngineResult } from "@/lib/training-engine";
import { buildNutritionUiV2Model, createMealFromNutritionUiV2ManualEntry, createMealFromNutritionUiV2SavedFood, syncNutritionLogFromNutritionUiV2Meals, type NutritionUiMealCategory } from "@/lib/nutrition-ui";
import { buildConfirmedFoodAiMealLog, buildFoodAiMealFromMealLog, buildFoodAiReviewDraft, foodAiMealCategoryToMealLogType, type FoodAiReviewDraft, type FoodAiMode } from "@/lib/food-ai";
import { buildWeeklyReviewSummary } from "@/lib/weekly-review";
import { buildCompactAppChrome } from "@/lib/app-chrome";
import { buildHomeCommandCenter, getScheduledRunForTraining, getTodayRunForDate } from "@/lib/home-command-center";
import { buildHomeDailyDashboard } from "@/lib/home-daily-dashboard";
import { buildProgressInsightsModel, type ProgressInsightTone } from "@/lib/progress-insights-ui";
import { buildRaceCalendarUiModel, type RaceCalendarUiModel } from "@/lib/race-calendar-ui";
import { buildRaceCalendarSettingsModel, saveRaceCalendarSettings, type RaceCalendarSettingsForm, type RaceCalendarSettingsModel } from "@/lib/race-calendar-settings-ui";
import { buildMissionControlUiModel, type MissionControlUiModel } from "@/lib/mission-control-ui";
import { evaluatePhysique } from "@/lib/physique-engine";
import { evaluateOrchestrator } from "@/lib/orchestrator-engine";
import { appNavigation, type PrimaryNavigationId } from "@/lib/navigation";
import { createAuthAwarePersistenceContext, syncAppStateToSupabase, type AuthPersistenceContext } from "@/lib/supabase-persistence";
import { buildDataConfidenceNote, buildFoodScanProviderLabel, type DataConfidenceFocus, type DataConfidenceNote } from "@/lib/pre-test-cleanup-ui";
import { buildBackupDashboardModel, createBackupPayload, LAST_BACKUP_DATE_KEY, parseAndValidateBackupJson, restoreBackupPayload, type BackupValidationResult } from "@/lib/backup-restore";
import { buildBodyMetricsSummary, buildLogSections, buildPhotoSectionSummary, humanizeDataQualityReason, type LogSectionId } from "@/lib/log-tab-ui";
import { buildPlannerSessionFromAppState } from "@/lib/training-planner-adapter";
import { buildHomeTrainingModel, type HomeAdapterResult } from "@/lib/home-adapter";
import { buildHomeAdapterPilotPreview, isHomeAdapterPilotEnabled, type HomeAdapterPilotPreviewState } from "@/lib/home-adapter-pilot";
import { buildPlannerShadowObservabilityPanel, toLegacyComparableFromTrainingEngine, type PlannerShadowObservabilityPanel } from "@/lib/planner-shadow-observability";
import { buildPlannerTrainPreviewPanel, type PlannerTrainPreviewPanel } from "@/lib/planner-train-preview";
import { buildPlannerTrainScreenV1, shouldRenderLegacyPlannerShadowPanel, type PlannerTrainScreenV1 } from "@/lib/planner-train-screen-v1";
import { loadRecoveryBackup, loadStateWithRecovery, saveState, todayIso, uid, type StateLoadResult } from "@/lib/storage";
import type { AppState, CoachDecision, DailyCheckIn, Exercise, FoodScanResult, FormQuality, ProgressPhoto, RunType, SetLog, WorkoutSession } from "@/lib/types";

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

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) {
  return <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center"><p className="text-lg font-black text-white">{title}</p><p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{copy}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function DataConfidenceNotice({ note }: { note: DataConfidenceNote }) {
  const tone = note.confidence === "High" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : note.confidence === "Medium" ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-red-300/25 bg-red-300/10 text-red-100";
  return <div className={classNames("rounded-2xl border p-3 text-xs", tone)}><p className="font-black uppercase tracking-[0.18em]">{note.label}: {note.confidence}</p><p className="mt-1 opacity-90">{note.missingData.length ? `Missing: ${note.missingData.map(humanizeDataQualityReason).join("; ")}. Recommendations are useful for testing but should be treated as lower confidence until logged data fills in.` : "Enough recent data is present for this recommendation area."}</p></div>;
}

function useDataConfidence(state: AppState, focus: DataConfidenceFocus) {
  return useMemo(() => buildDataConfidenceNote(state, focus, todayIso()), [state, focus]);
}

function downloadAppStateBackup(state: AppState) {
  if (typeof window === "undefined") return;
  const exportedAt = new Date().toISOString();
  const payload = createBackupPayload(state, exportedAt);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `greek-god-coach-backup-${exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  window.localStorage.setItem(LAST_BACKUP_DATE_KEY, exportedAt);
}

const inputClass = "rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white outline-none ring-amber-400/30 focus:ring-2";

type ProgressSectionId = "weight" | "run" | "review" | "photos" | "race" | "adherence" | "goals" | "performance" | "physique" | "recovery" | "nutrition" | "strength" | "coachSummary" | "missing";

function Sparkline({ values, color = "#fbbf24" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-24 rounded-2xl bg-white/[0.03]" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${90 - ((v - min) / span) * 80}`).join(" ");
  return <svg viewBox="0 0 100 100" className="h-24 w-full overflow-visible rounded-2xl bg-white/[0.03] p-2"><polyline fill="none" stroke={color} strokeWidth="3" points={points} vectorEffect="non-scaling-stroke" /></svg>;
}

function heightInches(height: string | number | undefined) {
  if (typeof height === "number") return height;
  const text = String(height ?? "");
  const match = text.match(/(\d+)\D+(\d+)/);
  return match ? Number(match[1]) * 12 + Number(match[2]) : 71;
}

function latestBodyMetrics(state: AppState) {
  return [...(state.bodyMetrics ?? [])].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

function priorBodyMetrics(state: AppState) {
  return [...(state.bodyMetrics ?? [])].sort((a, b) => a.date.localeCompare(b.date)).at(-2);
}

export default function Home() {
  const [state, setState] = useState<AppState | null>(null);
  const [active, setActive] = useState<PrimaryNavigationId>("Home");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeLogSection, setActiveLogSection] = useState<LogSectionId>("checkin");
  const [activeProgressSection, setActiveProgressSection] = useState<ProgressSectionId>("weight");
  const [plannerDebugEnabled, setPlannerDebugEnabled] = useState(false);
  const [homeAdapterPilotEnabled, setHomeAdapterPilotEnabled] = useState(false);
  const [persistenceContext, setPersistenceContext] = useState<AuthPersistenceContext | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState("localStorage fallback");
  const [stateLoadResult, setStateLoadResult] = useState<StateLoadResult | null>(null);

  useEffect(() => {
    const result = loadStateWithRecovery();
    setStateLoadResult(result);
    if (result.state) setState(result.state);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const queryDebugPlanner = new URLSearchParams(window.location.search).get("debugPlanner") === "true";
    setPlannerDebugEnabled(queryDebugPlanner);
    setHomeAdapterPilotEnabled(isHomeAdapterPilotEnabled({ search: window.location.search }));
  }, []);
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
  const today = todayIso();
  const todayPlanDayIndex = useMemo(() => {
    const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    return day === 0 ? 6 : day - 1;
  }, [today]);
  const baseline = useMemo(() => ({ restingHr: 58, hrv: 60 }), []);
  const readiness = useMemo(() => latestCheckIn ? calculateReadiness(latestCheckIn, baseline) : null, [latestCheckIn, baseline]);
  const currentWorkout = useMemo(() => getWorkoutForWeekDay(selectedWeek, selectedDay), [selectedWeek, selectedDay]);
  const todayWorkout = useMemo(() => getWorkoutForWeekDay(state?.currentWeek ?? selectedWeek, todayPlanDayIndex), [state?.currentWeek, selectedWeek, todayPlanDayIndex]);
  const adjustedWorkout = useMemo(() => readiness ? adjustWorkoutForReadiness(currentWorkout, readiness.status) : currentWorkout, [currentWorkout, readiness]);
  const adjustedTodayWorkout = useMemo(() => readiness ? adjustWorkoutForReadiness(todayWorkout, readiness.status) : todayWorkout, [todayWorkout, readiness]);
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
  const todayRunDisplay = useMemo(() => state ? getTodayRunForDate({ today, currentWeek: state.currentWeek, workouts, staleRunLabel: "Hold: 3 mi", completedRunDates: (state.runLogs ?? []).filter((run) => run.completed).map((run) => run.date) }) : null, [state, today]);
  const plannedRunDistance = todayRunDisplay?.distanceMiles ?? 0;
  const runningRecommendation = useMemo(() => state && readiness && runTrends && todayRunDisplay && plannedRunDistance > 0 ? generateRunningRecommendation({ runLogs: state.runLogs ?? [], nextDayReadiness: readiness.status, plannedDistance: plannedRunDistance, runType: todayRunDisplay.type === "long" ? "Long run" : todayRunDisplay.type === "tempo" ? "Tempo" : todayRunDisplay.type === "speed" ? "Speed" : "Zone 2", currentWeeklyMileage: runTrends.weeklyMileage, previousWeeklyMileage: Math.max(0, runTrends.weeklyMileage - plannedRunDistance) }) : null, [state, readiness, runTrends, todayRunDisplay, plannedRunDistance]);
  const nextRunLabel = todayRunDisplay ? (runningRecommendation ? `${todayRunDisplay.required ? "" : "Optional: "}${runningRecommendation.action}: ${runningRecommendation.recommendedDistance} mi` : todayRunDisplay.label) : "No run scheduled today";
  const scheduledRunForTraining = useMemo(() => getScheduledRunForTraining(todayRunDisplay, nextRunLabel, runningRecommendation?.recommendedDistance), [todayRunDisplay, nextRunLabel, runningRecommendation?.recommendedDistance]);
  const dailyPrescription = useMemo(() => state && latestCheckIn && macroTarget && readiness ? generateDailyPrescription({ readiness, checkIn: latestCheckIn, workout: todayWorkout, macroTarget, nutritionLogs: state.nutritionLogs, bodyMetrics: state.bodyMetrics, trainingAdherence, postWorkoutRecommendations: state.postWorkoutRecommendations, runningRecommendation: runningRecommendation ?? undefined }) : null, [state, latestCheckIn, macroTarget, readiness, todayWorkout, trainingAdherence, runningRecommendation]);
  const homeCommandCenter = useMemo(() => state && macroTarget && readiness && dailyPrescription ? buildHomeCommandCenter(state, { today, readinessStatus: readiness.status, todaysWorkout: adjustedTodayWorkout.title, todaysRun: nextRunLabel, macroTarget, coachRecommendation: dailyPrescription.exactWorkoutRecommendation, scheduledWorkout: adjustedTodayWorkout, scheduledRun: scheduledRunForTraining, runDurationMinutes: todayRunDisplay?.estimatedMinutes ?? 0 }) : null, [state, macroTarget, readiness, dailyPrescription, today, adjustedTodayWorkout, nextRunLabel, todayRunDisplay?.estimatedMinutes, scheduledRunForTraining]);
  const missionControlContext = useMemo(() => {
    if (!state || !homeCommandCenter) return null;
    const latest = latestBodyMetrics(state);
    const prior = priorBodyMetrics(state);
    const physiqueEngineResult = evaluatePhysique({
      weight: latest?.weight,
      waist: latest?.waist,
      neck: (latest as { neck?: number } | undefined)?.neck,
      height: heightInches(state.user.height),
      priorWeight: prior?.weight,
      priorWaist: prior?.waist,
      priorNeck: (prior as { neck?: number } | undefined)?.neck,
      proteinAdherence: homeCommandCenter.performanceEngineResult.nutritionTrend.score,
      calorieAdherence: homeCommandCenter.performanceEngineResult.nutritionTrend.score,
      workoutAdherence: homeCommandCenter.performanceEngineResult.adherenceTrend.score,
      strengthTrend: homeCommandCenter.performanceEngineResult.strengthTrend.status,
      photoCount: state.photos?.length ?? 0,
      photoConsistency: state.photos?.length ? 80 : 0,
    });
    const orchestratorEngineResult = evaluateOrchestrator({
      progressionEngineResult: homeCommandCenter.progressionEngineResult,
      goalTrackingEngineResult: homeCommandCenter.goalTrackingEngineResult,
      trainingEngineResult: homeCommandCenter.trainingEngineResult,
      performanceEngineResult: homeCommandCenter.performanceEngineResult,
      physiqueEngineResult,
    });
    const raceCalendar = buildRaceCalendarUiModel(state, { today: todayIso() });
    const missionControl = buildMissionControlUiModel({
      orchestratorEngineResult,
      performanceEngineResult: homeCommandCenter.performanceEngineResult,
      physiqueEngineResult,
      goalTrackingEngineResult: homeCommandCenter.goalTrackingEngineResult,
      raceCalendarEngineResult: raceCalendar.engineResults.raceCalendar,
      progressionEngineResult: homeCommandCenter.progressionEngineResult,
      trainingEngineResult: homeCommandCenter.trainingEngineResult,
    });
    return { missionControl };
  }, [state, homeCommandCenter]);
  const missionControl = missionControlContext?.missionControl ?? null;
  const plannerShadowPanel = useMemo(() => {
    if (!plannerDebugEnabled || !state || !homeCommandCenter || !readiness) return null;
    const plannerReadiness = {
      score: readiness.score,
      status: readiness.status,
      confidence: "High" as const,
      reasons: [],
      reason: readiness.reason,
      recommendation: readiness.recommendation,
      recommendationType: readiness.status === "Green" ? "full_training" as const : readiness.status === "Yellow" ? "modified_training" as const : "recovery_focus" as const,
      trainingGuidance: readiness.recommendation,
      recoveryGuidance: [],
      dataQualityWarnings: [],
    };
    const plannerSession = buildPlannerSessionFromAppState({
      state,
      date: today,
      selectedWeek: state.currentWeek,
      currentWeek: state.currentWeek,
      workouts,
      readinessResult: plannerReadiness,
      progressionResult: homeCommandCenter.progressionEngineResult,
      goalTrackingResult: homeCommandCenter.goalTrackingEngineResult,
      runningRecommendation: runningRecommendation ?? null,
    });
    return buildPlannerShadowObservabilityPanel({
      debug: { developerToggle: plannerDebugEnabled },
      plannerSession,
      legacy: toLegacyComparableFromTrainingEngine(homeCommandCenter.trainingEngineResult),
      runtimeOutputs: {
        runtimeState: state,
        homeOutput: homeCommandCenter,
        trainOutput: homeCommandCenter.trainingEngineResult,
        logOutput: buildLogSections(),
        recommendations: { dailyPrescription, runningRecommendation },
      },
    });
  }, [state, homeCommandCenter, today, readiness, runningRecommendation, dailyPrescription, plannerDebugEnabled]);
  const plannerTrainPreviewPanel = useMemo(() => {
    if (!plannerDebugEnabled || !state || !homeCommandCenter || !readiness) return null;
    const plannerReadiness = {
      score: readiness.score,
      status: readiness.status,
      confidence: "High" as const,
      reasons: [],
      reason: readiness.reason,
      recommendation: readiness.recommendation,
      recommendationType: readiness.status === "Green" ? "full_training" as const : readiness.status === "Yellow" ? "modified_training" as const : "recovery_focus" as const,
      trainingGuidance: readiness.recommendation,
      recoveryGuidance: [],
      dataQualityWarnings: [],
    };
    const plannerSession = buildPlannerSessionFromAppState({
      state,
      date: today,
      selectedWeek: state.currentWeek,
      currentWeek: state.currentWeek,
      workouts,
      readinessResult: plannerReadiness,
      progressionResult: homeCommandCenter.progressionEngineResult,
      goalTrackingResult: homeCommandCenter.goalTrackingEngineResult,
      runningRecommendation: runningRecommendation ?? null,
    });
    return buildPlannerTrainPreviewPanel({
      debug: { developerToggle: plannerDebugEnabled },
      plannerSession,
      runtimeGuards: {
        state,
        logs: state,
        recommendations: { dailyPrescription, runningRecommendation },
        readiness,
        progression: homeCommandCenter.progressionEngineResult,
        homeOutput: homeCommandCenter,
        trainOutput: homeCommandCenter.trainingEngineResult,
        logOutput: buildLogSections(),
      },
    });
  }, [state, homeCommandCenter, today, readiness, runningRecommendation, dailyPrescription, plannerDebugEnabled]);
  const plannerTrainScreenV1 = useMemo(() => {
    if (!plannerDebugEnabled || !state || !homeCommandCenter || !readiness) return null;
    const plannerReadiness = {
      score: readiness.score,
      status: readiness.status,
      confidence: "High" as const,
      reasons: [],
      reason: readiness.reason,
      recommendation: readiness.recommendation,
      recommendationType: readiness.status === "Green" ? "full_training" as const : readiness.status === "Yellow" ? "modified_training" as const : "recovery_focus" as const,
      trainingGuidance: readiness.recommendation,
      recoveryGuidance: [],
      dataQualityWarnings: [],
    };
    const plannerSession = buildPlannerSessionFromAppState({
      state,
      date: today,
      selectedWeek: state.currentWeek,
      currentWeek: state.currentWeek,
      workouts,
      readinessResult: plannerReadiness,
      progressionResult: homeCommandCenter.progressionEngineResult,
      goalTrackingResult: homeCommandCenter.goalTrackingEngineResult,
      runningRecommendation: runningRecommendation ?? null,
    });
    const legacyComparable = toLegacyComparableFromTrainingEngine(homeCommandCenter.trainingEngineResult);
    return buildPlannerTrainScreenV1({
      debug: { developerToggle: plannerDebugEnabled },
      plannerSession,
      legacySession: { sessionType: legacyComparable.sessionType, warnings: homeCommandCenter.trainingEngineResult.warnings.map((warning) => warning.message) },
      runtimeGuards: {
        state,
        logs: state,
        recommendations: { dailyPrescription, runningRecommendation },
        readiness,
        progression: homeCommandCenter.progressionEngineResult,
        homeOutput: homeCommandCenter,
        trainOutput: homeCommandCenter.trainingEngineResult,
        logOutput: buildLogSections(),
      },
    });
  }, [state, homeCommandCenter, today, readiness, runningRecommendation, dailyPrescription, plannerDebugEnabled]);
  const homeAdapterPilotPreview = useMemo<HomeAdapterPilotPreviewState>(() => {
    if (!homeAdapterPilotEnabled) return buildHomeAdapterPilotPreview({ enabled: false, adapterResult: null });
    if (!state || !homeCommandCenter || !readiness || !dailyPrescription) return buildHomeAdapterPilotPreview({ enabled: true, adapterResult: null });
    const plannerReadiness = {
      score: readiness.score,
      status: readiness.status,
      confidence: "High" as const,
      reasons: [],
      reason: readiness.reason,
      recommendation: readiness.recommendation,
      recommendationType: readiness.status === "Green" ? "full_training" as const : readiness.status === "Yellow" ? "modified_training" as const : "recovery_focus" as const,
      trainingGuidance: readiness.recommendation,
      recoveryGuidance: [],
      dataQualityWarnings: [],
    };
    const plannerSession = buildPlannerSessionFromAppState({
      state,
      date: today,
      selectedWeek: state.currentWeek,
      currentWeek: state.currentWeek,
      workouts,
      readinessResult: plannerReadiness,
      progressionResult: homeCommandCenter.progressionEngineResult,
      goalTrackingResult: homeCommandCenter.goalTrackingEngineResult,
      runningRecommendation: runningRecommendation ?? null,
    });
    const adapterResult: HomeAdapterResult = buildHomeTrainingModel({
      mode: "pilot",
      requestDate: today,
      session: plannerSession,
      readinessResult: plannerReadiness,
      progressionResult: homeCommandCenter.progressionEngineResult,
      goalTrackingResult: homeCommandCenter.goalTrackingEngineResult,
      recommendation: { coachRecommendation: dailyPrescription.exactWorkoutRecommendation, runningRecommendation: runningRecommendation ?? null },
      workoutSessions: state.workoutSessions,
      runLogs: state.runLogs,
      auditHash: `audit-hash-${plannerSession.id}`,
      provenance: { source: "home-adapter-pilot", plannerVersion: "developer-only", adapterVersion: "home-adapter-v1" },
    });
    return buildHomeAdapterPilotPreview({ enabled: true, adapterResult });
  }, [homeAdapterPilotEnabled, state, homeCommandCenter, readiness, dailyPrescription, today, runningRecommendation]);
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
  if (stateLoadResult?.status === "corrupt") {
    return <RecoveryScreen
      result={stateLoadResult}
      onContinueFresh={() => {
        const freshState = createInitialState();
        saveState(freshState);
        setState(freshState);
        setStateLoadResult({ status: "ready", state: freshState, recoveryOptions: stateLoadResult.recoveryOptions });
      }}
      onRestoreSnapshot={() => {
        const recovered = loadRecoveryBackup("snapshot");
        if (!recovered) return;
        saveState(recovered);
        setState(recovered);
        setStateLoadResult({ status: "ready", state: recovered, recoveryOptions: { hasSnapshot: true, hasPreRestoreBackup: stateLoadResult.recoveryOptions.hasPreRestoreBackup } });
      }}
      onRestorePreRestore={() => {
        const recovered = loadRecoveryBackup("pre_restore_backup");
        if (!recovered) return;
        saveState(recovered);
        setState(recovered);
        setStateLoadResult({ status: "ready", state: recovered, recoveryOptions: { hasSnapshot: stateLoadResult.recoveryOptions.hasSnapshot, hasPreRestoreBackup: true } });
      }}
    />;
  }
  if (!state || !readiness || !macroTarget || !trend || !weeklyReview || !dailyPrescription || !homeCommandCenter || !missionControl) return <main className="min-h-screen bg-black p-8 text-white">Loading coach...</main>;

  const updateState = (next: AppState) => setState(next);
  const appChrome = buildCompactAppChrome({ currentWeek: selectedWeek });
  const showLegacyPlannerShadowPanel = shouldRenderLegacyPlannerShadowPanel({
    plannerDebugEnabled,
    legacyShadowPanelVisible: Boolean(plannerShadowPanel?.visible),
    plannerTrainScreenV1Visible: Boolean(plannerTrainScreenV1?.visible),
    activeScreen: active,
  });

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#3f2f12,transparent_30%),linear-gradient(135deg,#050505,#111111_50%,#050505)] text-zinc-100">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-black/85 px-4 py-1.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="shrink-0 leading-tight"><p className="text-sm font-black tracking-tight text-white">{appChrome.title}</p><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/80">{appChrome.subtitle}</p></div>
          <nav className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1">{appNavigation.map((tab) => <button key={tab.id} onClick={() => setActive(tab.id)} className={classNames("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", active === tab.id ? "bg-white text-black" : "bg-white/5 text-zinc-300")}>{tab.label}</button>)}</nav>
          <span className="hidden shrink-0 rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-500 lg:inline">{persistenceStatus}</span>
        </div>
      </header>

      <div className="py-2">
        {active === "Home" && <Dashboard model={homeCommandCenter} missionControl={missionControl} homeAdapterPilotPreview={homeAdapterPilotPreview} onStartWorkout={() => setActive("Train")} />}
        {active === "Train" && <TrainScreen state={state} updateState={updateState} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} selectedDay={selectedDay} setSelectedDay={setSelectedDay} readiness={readiness} workout={adjustedWorkout} originalWorkout={currentWorkout} latestCheckIn={latestCheckIn} runningRecommendation={runningRecommendation} runTrends={runTrends} plannedRunDistance={plannedRunDistance} scheduledRun={scheduledRunForTraining} trainingEngineResult={homeCommandCenter.trainingEngineResult} plannerTrainPreviewPanel={plannerTrainPreviewPanel} plannerTrainScreenV1={plannerTrainScreenV1} />}
        {active === "Log" && <LogScreen state={state} updateState={updateState} readiness={readiness} trend={trend} section={activeLogSection} setSection={setActiveLogSection} />}
        {active === "Progress" && <ProgressScreen state={state} updateState={updateState} weeklyReview={weeklyReview} section={activeProgressSection} setSection={setActiveProgressSection} />}
        {active === "More" && <MoreScreen state={state} updateState={updateState} />}
        {showLegacyPlannerShadowPanel && plannerShadowPanel && <PlannerShadowDeveloperPanel panel={plannerShadowPanel} />}
      </div>
    </div>
  </main>;
}

function PlannerShadowDeveloperPanel({ panel }: { panel: PlannerShadowObservabilityPanel }) {
  if (!panel.visible || !panel.comparison) return null;
  return <aside className="mt-4 rounded-3xl border border-fuchsia-300/30 bg-fuchsia-950/20 p-4 text-xs text-fuchsia-50" data-testid="planner-shadow-developer-panel" aria-label="Planner Shadow Comparison">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="font-black uppercase tracking-[0.24em] text-fuchsia-200">Developer only · read only</p>
        <h2 className="mt-1 text-lg font-black text-white">{panel.title}</h2>
      </div>
      <span className="rounded-full border border-fuchsia-200/30 px-3 py-1 font-black uppercase tracking-[0.16em] text-fuchsia-100">Advisory only</span>
    </div>
    <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {panel.rows.map((row) => <div key={row.label} className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-200/80">{row.label}</dt>
        <dd className="mt-1 break-words font-bold text-white">{row.value}</dd>
      </div>)}
    </dl>
    {panel.comparison.mismatches.length ? <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="font-black uppercase tracking-[0.16em] text-fuchsia-200/80">Mismatches</p>
      <ul className="mt-2 grid gap-1 text-zinc-200">
        {panel.comparison.mismatches.map((mismatch) => <li key={mismatch.id}>{mismatch.severity}: {mismatch.field} · legacy {String(mismatch.legacyValue ?? "None")} vs planner {String(mismatch.plannerValue ?? "None")}</li>)}
      </ul>
    </div> : null}
  </aside>;
}

function PlannerTrainScreenV1DeveloperPanel({ screen }: { screen: PlannerTrainScreenV1 }) {
  if (!screen.visible) return null;
  return <section className="rounded-3xl border border-sky-300/30 bg-zinc-950/90 p-4 text-white shadow-2xl shadow-black/30" data-testid="planner-train-screen-v1" aria-label="PlannerTrainScreenV1">
    <div className="rounded-3xl border border-sky-300/20 bg-sky-400/10 p-5">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-200">Developer only · read only · advisory preview</p>
      <h2 className="mt-2 text-3xl font-black">{screen.topCard.title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Session Type" value={screen.topCard.sessionType} tone="green" />
        <Stat label="Primary Objective" value={screen.topCard.primaryObjective} />
        <Stat label="Estimated Duration" value={screen.topCard.estimatedDuration} />
        <Stat label="Stress Rating" value={screen.topCard.stressRating} />
      </div>
    </div>
    <Card className="mt-4" eyebrow="Primary Prescription" title={screen.primaryPrescription.title}>
      <p className="rounded-2xl bg-black/20 p-3 text-sm font-black text-sky-100">Primary: {screen.primaryPrescription.kind}</p>
      {screen.primaryPrescription.details.length ? <div className="mt-3 grid gap-2">{screen.primaryPrescription.details.map((item) => <p key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-200">{item}</p>)}</div> : <p className="mt-3 text-sm text-zinc-400">No primary work required.</p>}
    </Card>
    {screen.supportWork.length ? <Card className="mt-4" eyebrow="Support Work" title="Support work stays separate from primary work">
      <div className="grid gap-3 sm:grid-cols-2">
        {screen.supportWork.map((item) => <div key={`${item.kind}-${item.title}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Support: {item.kind}</p>
          <p className="mt-1 font-black text-white">{item.title}</p>
          {item.items.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">{item.items.map((entry) => <li key={entry}>{entry}</li>)}</ul> : null}
        </div>)}
      </div>
    </Card> : null}
    <Card className="mt-4" eyebrow="Logging" title="Required logging only">
      <div className="grid gap-3 sm:grid-cols-2">
        {screen.logging.showRunLogging ? <Stat label="Run Logging" value="Required" tone="green" /> : <Stat label="Run Logging" value="Hidden" tone="neutral" />}
        {screen.logging.showLiftLogging ? <Stat label="Lift Logging" value="Required" tone="green" /> : <Stat label="Lift Logging" value="Hidden" tone="neutral" />}
      </div>
    </Card>
    <details className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
      <summary className="cursor-pointer font-black text-zinc-100">Developer comparison</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Stat label="Legacy Session" value={screen.comparison.legacySession} />
        <Stat label="Planner Session" value={screen.comparison.plannerSession} />
        <Stat label="Match" value={screen.comparison.match ? "Yes" : "No"} tone={screen.comparison.match ? "green" : "yellow"} />
        <Stat label="Warnings" value={screen.comparison.warnings.join(" | ") || "None"} />
      </div>
    </details>
  </section>;
}

function PlannerTrainPreviewDeveloperPanel({ panel }: { panel: PlannerTrainPreviewPanel }) {
  if (!panel.visible || !panel.preview) return null;
  return <aside className="mt-4 rounded-3xl border border-sky-300/30 bg-sky-950/20 p-4 text-xs text-sky-50" data-testid="planner-train-preview-panel" aria-label="Planner Train Preview">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="font-black uppercase tracking-[0.24em] text-sky-200">Developer only · read only</p>
        <h2 className="mt-1 text-lg font-black text-white">{panel.title}</h2>
      </div>
      <span className="rounded-full border border-sky-200/30 px-3 py-1 font-black uppercase tracking-[0.16em] text-sky-100">Advisory only</span>
    </div>
    <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {panel.rows.map((row) => <div key={row.label} className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200/80">{row.label}</dt>
        <dd className="mt-1 break-words font-bold text-white">{row.value}</dd>
      </div>)}
    </dl>
  </aside>;
}

function RecoveryScreen({ result, onRestoreSnapshot, onRestorePreRestore, onContinueFresh }: { result: Extract<StateLoadResult, { status: "corrupt" }>; onRestoreSnapshot: () => void; onRestorePreRestore: () => void; onContinueFresh: () => void }) {
  return <main className="min-h-screen bg-black p-6 text-white">
    <div className="mx-auto max-w-3xl rounded-3xl border border-red-300/30 bg-red-950/30 p-6 shadow-2xl shadow-black/40">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-red-200">Recovery mode</p>
      <h1 className="mt-2 text-3xl font-black">Saved app data needs attention</h1>
      <p className="mt-3 text-zinc-200">{result.message} Your data was not silently erased.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <button type="button" disabled={!result.recoveryOptions.hasSnapshot} onClick={onRestoreSnapshot} className="rounded-2xl bg-emerald-400 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">Restore latest snapshot</button>
        <button type="button" disabled={!result.recoveryOptions.hasPreRestoreBackup} onClick={onRestorePreRestore} className="rounded-2xl bg-amber-400 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">Revert pre-restore backup</button>
        <button type="button" onClick={onContinueFresh} className="rounded-2xl border border-white/15 px-4 py-3 font-black text-white">Continue with fresh state</button>
      </div>
    </div>
  </main>;
}

function Dashboard({ model, missionControl, homeAdapterPilotPreview, onStartWorkout }: { model: ReturnType<typeof buildHomeCommandCenter>; missionControl: MissionControlUiModel; homeAdapterPilotPreview: HomeAdapterPilotPreviewState; onStartWorkout: () => void }) {
  const dailyDashboard = buildHomeDailyDashboard({ home: model, missionControl });
  const sectionTone = (label: string, value: string) => {
    if (label === "Recovery status") return value.includes("Green") ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : value.includes("Red") ? "border-red-300/25 bg-red-300/10 text-red-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100";
    if (label === "Primary mission") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    return "border-white/10 bg-white/[0.04] text-zinc-100";
  };

  return <section className="grid gap-2 rounded-3xl border border-amber-300/30 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.16),transparent_34%),rgba(10,10,10,.94)] p-3 shadow-2xl shadow-black/30">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300/80">Home</p>
      <h2 className="text-xl font-black text-white">{dailyDashboard.question}</h2>
    </div>

    <div className="grid gap-1.5">
      {dailyDashboard.sections.map((section) => <div key={section.label} className={`rounded-xl border px-3 py-2 ${sectionTone(section.label, section.value)}`}>
        <p className="text-[9px] font-black uppercase tracking-[0.16em] opacity-70">{section.label}</p>
        <p className="text-sm font-black leading-tight">{section.value}</p>
        {section.sub && <p className="text-[11px] leading-tight opacity-70">{section.sub}</p>}
      </div>)}
    </div>

    <details className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-300">
      <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{dailyDashboard.why.title}</summary>
      <div className="mt-3 grid gap-2">
        {dailyDashboard.why.items.map((item) => <div key={item.label} className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
          <p className="mt-1 font-bold text-white">{item.value}</p>
          {item.sub && <p className="mt-1 text-xs text-zinc-500">{item.sub}</p>}
        </div>)}
      </div>
    </details>

    <button type="button" onClick={onStartWorkout} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-black shadow-lg shadow-amber-950/20">{dailyDashboard.ctas[0].label}</button>

    {homeAdapterPilotPreview.enabled && <section className="rounded-2xl border border-sky-300/30 bg-sky-950/20 p-4 text-xs text-sky-50" data-testid="home-adapter-pilot-preview" aria-label="Developer Preview">
      <p className="font-black uppercase tracking-[0.24em] text-sky-200">Developer Preview</p>
      {homeAdapterPilotPreview.state === "unavailable" ? <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-amber-50">
        <p className="text-sm font-black">{homeAdapterPilotPreview.title}</p>
        <p className="mt-1 text-xs">{homeAdapterPilotPreview.message}</p>
      </div> : <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {homeAdapterPilotPreview.rows.map((row) => <div key={row.label} className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200/80">{row.label}</p>
          <p className="mt-1 break-words font-bold text-white">{row.value}</p>
        </div>)}
      </div>}
    </section>}
  </section>;
}

function TrainScreen({ state, updateState, selectedWeek, setSelectedWeek, selectedDay, setSelectedDay, readiness, workout, latestCheckIn, runningRecommendation, scheduledRun, trainingEngineResult, plannerTrainPreviewPanel, plannerTrainScreenV1 }: any) {
  if (plannerTrainScreenV1?.visible) return <PlannerTrainScreenV1DeveloperPanel screen={plannerTrainScreenV1} />;
  return <TrainingPlan state={state} updateState={updateState} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} selectedDay={selectedDay} setSelectedDay={setSelectedDay} readiness={readiness} workout={workout} latestCheckIn={latestCheckIn} runningRecommendation={runningRecommendation} scheduledRun={scheduledRun} trainingEngineResult={trainingEngineResult} plannerTrainPreviewPanel={plannerTrainPreviewPanel} />;
}

function LogScreen({ state, updateState, readiness, trend, section, setSection }: { state: AppState; updateState: (s: AppState) => void; readiness: any; trend: any; section: LogSectionId; setSection: (section: LogSectionId) => void }) {
  const options = buildLogSections();
  return <div className="grid gap-4">
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">{options.map((option) => <button key={option.id} type="button" onClick={() => setSection(option.id)} className={classNames("rounded-2xl px-3 py-3 text-sm font-black", section === option.id ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300")}>{option.label}</button>)}</section>
    <Card eyebrow="Log = reporting" title={options.find((option) => option.id === section)?.label ?? "Daily Check-In"}>
      <p className="text-sm text-zinc-400">{options.find((option) => option.id === section)?.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">{(options.find((option) => option.id === section)?.fields ?? []).map((field) => <span key={field} className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">{field}</span>)}</div>
    </Card>
    {section === "checkin" && <DailyCheckInForm state={state} updateState={updateState} readiness={readiness} />}
    {section === "nutrition" && <NutritionLogger state={state} updateState={updateState} />}
    {section === "body" && <BodyMetrics state={state} updateState={updateState} trend={trend} />}
    {section === "photos" && <ProgressPhotos state={state} updateState={updateState} />}
  </div>;
}

function insightTone(tone: ProgressInsightTone): "green" | "yellow" | "red" | "neutral" {
  if (tone === "positive") return "green";
  if (tone === "warning") return "yellow";
  if (tone === "negative") return "red";
  return "neutral";
}

function ProgressScreen({ state, updateState, weeklyReview, section, setSection }: { state: AppState; updateState: (s: AppState) => void; weeklyReview: ReturnType<typeof buildWeeklyReviewSummary> | null; section: ProgressSectionId; setSection: (section: ProgressSectionId) => void }) {
  const weightDashboard = buildWeightTrendDashboard(state.bodyMetrics ?? [], { startingWeight: 233, goalWeight: 199.9 });
  const runTrends = calculateRunTrends(state.runLogs ?? []);
  const commandCenter = buildHomeCommandCenter(state, { today: todayIso(), readinessStatus: "Green", todaysWorkout: "", todaysRun: "", macroTarget: state.macroTargets[0], coachRecommendation: "" });
  const raceCalendar = buildRaceCalendarUiModel(state, { today: todayIso() });
  const raceSettings = buildRaceCalendarSettingsModel(state);
  const insights = buildProgressInsightsModel({ performanceEngineResult: commandCenter.performanceEngineResult, goalTrackingEngineResult: commandCenter.goalTrackingEngineResult, progressionEngineResult: commandCenter.progressionEngineResult });
  const options: [ProgressSectionId, string][] = [
    ["weight", "Weight trends"],
    ["run", "Pace trends / Mileage trends"],
    ["review", "Weekly review"],
    ["photos", "Progress photos"],
    ["race", "Race countdown"],
    ["adherence", "Adherence metrics"],
    ["goals", "Goal Status"],
    ["performance", "Performance"],
    ["physique", "Physique"],
    ["recovery", "Recovery"],
    ["nutrition", "Nutrition"],
    ["strength", "Strength"],
  ];
  return <div className="grid gap-4">
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{options.map(([id, label]) => <button key={id} type="button" onClick={() => setSection(id)} className={classNames("rounded-2xl px-3 py-3 text-sm font-black", section === id ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300")}>{label}</button>)}</section>

    <Card eyebrow="Performance Overview" title="Am I improving?">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Overall Performance Score" value={insights.overview.scoreLabel} tone={insightTone(insights.overview.tone)} />
        <Stat label="Status" value={insights.overview.status} tone={insightTone(insights.overview.tone)} />
        <Stat label="Confidence" value={insights.overview.confidence} />
        <Stat label="Data quality" value={insights.overview.dataQualityLabel} tone={insights.overview.dataQualityScore >= 75 ? "green" : insights.overview.dataQualityScore >= 50 ? "yellow" : "red"} />
      </div>
    </Card>

    <Card eyebrow="Performance Domains" title="What is trending up or down?">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{insights.domains.map((domain) => <div key={domain.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{domain.label}</p><p className={classNames("mt-2 text-2xl font-black", insightTone(domain.tone) === "green" ? "text-emerald-300" : insightTone(domain.tone) === "yellow" ? "text-amber-300" : insightTone(domain.tone) === "red" ? "text-red-300" : "text-white")}>{domain.status}</p><p className="mt-1 text-sm text-zinc-300">Score: {domain.scoreLabel}</p><p className="mt-2 text-xs text-zinc-400">Trend: {domain.trend}</p><p className="mt-2 text-xs text-zinc-500">{domain.explanation}</p></div>)}</div>
    </Card>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card eyebrow="Primary Opportunity" title={insights.primaryOpportunity.title}><p className="text-sm leading-6 text-zinc-300">{insights.primaryOpportunity.explanation}</p></Card>
      <Card eyebrow="Primary Risk" title={insights.primaryRisk.title}><p className="text-sm leading-6 text-zinc-300">{insights.primaryRisk.explanation}</p></Card>
    </div>

    <Card eyebrow="Goal Tracking" title="Which goal is most at risk?">
      <div className="grid gap-3 md:grid-cols-4">{insights.goalTracking.map((goal) => <Stat key={goal.label} label={goal.label} value={goal.status} sub={`Confidence: ${goal.confidence}`} tone={insightTone(goal.tone)} />)}</div>
    </Card>

    <Card eyebrow="Weekly Decision" title="What should I focus on next week?">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Training progression" value={insights.weeklyDecision.weeklyDecision} tone={insights.weeklyDecision.weeklyDecision === "Progress" ? "green" : insights.weeklyDecision.weeklyDecision === "Recovery Focus" || insights.weeklyDecision.weeklyDecision === "Deload" ? "red" : "yellow"} />
        <Stat label="Nutrition decision" value={insights.weeklyDecision.nutritionDecision} />
        <Stat label="Decision confidence" value={insights.weeklyDecision.confidence} sub={`Data quality: ${insights.weeklyDecision.dataQualityScore}/100`} />
      </div>
      {insights.weeklyDecision.reasons.length ? <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-300">{insights.weeklyDecision.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
    </Card>

    <Card eyebrow="Audit Snapshot" title="Latest engine audit entries">
      <div className="grid gap-2">{insights.auditSnapshot.map((entry) => <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-sm font-black text-white">{entry.domain}: {entry.decision} · {entry.score}/100</p><p className="mt-1 text-xs text-zinc-400">{entry.reason}</p><p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-600">Confidence: {entry.confidence}</p></div>)}</div>
    </Card>

    <Card eyebrow="Trend Cards" title="Simple trend snapshot">
      <div className="grid gap-3 md:grid-cols-4">{insights.trendCards.map((card) => <Stat key={card.label} label={card.label} value={card.status} sub={card.summary} tone={insightTone(card.tone)} />)}</div>
    </Card>

    <Card eyebrow="Coach Summary" title="Progress insight"><p className="text-base leading-7 text-zinc-200">{insights.coachSummary}</p></Card>

    {section === "weight" && <WeightTrendDashboardCard dashboard={weightDashboard} />}
    {section === "run" && <RunProgress trends={runTrends} />}
    {section === "review" && <WeeklyReviewPanel review={weeklyReview} state={state} />}
    {section === "photos" && <ProgressPhotos state={state} updateState={updateState} />}
    {section === "race" && <RaceCalendarPanel model={raceCalendar} settings={raceSettings} onSaveSettings={(form) => updateState(saveRaceCalendarSettings(state, form))} />}
    {section === "adherence" && <Card eyebrow="Adherence Metrics" title="Execution consistency"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Training adherence" value={`${weeklyReview?.adherenceScore ?? 0}/100`} tone={(weeklyReview?.adherenceScore ?? 0) >= 80 ? "green" : "yellow"} /><Stat label="Weekly miles" value={`${weeklyReview?.totalWeeklyMiles ?? 0} mi`} /><Stat label="Lifts completed" value={weeklyReview?.liftsCompleted ?? 0} /></div></Card>}
    {section === "goals" && <Card eyebrow="Goal Status" title="Goal tracking engine results"><div className="grid gap-3 md:grid-cols-4">{insights.goalTracking.map((goal) => <Stat key={goal.label} label={goal.label} value={goal.status} sub={`Confidence: ${goal.confidence}`} tone={insightTone(goal.tone)} />)}</div></Card>}
    {section === "performance" && <Card eyebrow="Performance" title="Performance Snapshot"><div className="grid gap-3 sm:grid-cols-4"><Stat label="Overall Performance Score" value={insights.overview.scoreLabel} tone={insightTone(insights.overview.tone)} /><Stat label="Status" value={insights.overview.status} tone={insightTone(insights.overview.tone)} /><Stat label="Confidence" value={insights.overview.confidence} /><Stat label="Data quality" value={insights.overview.dataQualityLabel} /></div></Card>}
    {section === "physique" && <Card eyebrow="Physique" title="Physique Snapshot"><p className="text-sm text-zinc-300">Physique data is summarized from the existing Physique Engine in Mission Control. Use Body Metrics and Progress Photos to improve this signal.</p></Card>}
    {section === "recovery" && <Card eyebrow="Recovery" title="Recovery Signal"><p className="text-sm text-zinc-300">Data not available yet.</p></Card>}
    {section === "nutrition" && <Card eyebrow="Nutrition" title="Nutrition Decision"><div className="grid gap-3 sm:grid-cols-2"><Stat label="Nutrition decision" value={insights.weeklyDecision.nutritionDecision} /><Stat label="Decision confidence" value={insights.weeklyDecision.confidence} /></div></Card>}
    {section === "strength" && <Card eyebrow="Strength" title="Strength Trend"><p className="text-sm text-zinc-300">Data not available yet.</p></Card>}
    {section === "coachSummary" && <Card eyebrow="Coach Summary" title="Progress insight"><p className="text-base leading-7 text-zinc-200">{insights.coachSummary}</p></Card>}
    {section === "missing" && <Card eyebrow="Mission Control" title="Data not available yet."><p className="text-sm text-zinc-300">Data not available yet.</p></Card>}
  </div>;
}

function RaceCalendarPanel({ model, settings, onSaveSettings }: { model: RaceCalendarUiModel; settings: RaceCalendarSettingsModel; onSaveSettings: (form: RaceCalendarSettingsForm) => void }) {
  const [form, setForm] = useState<RaceCalendarSettingsForm>(settings.form);
  const updateForm = (field: keyof RaceCalendarSettingsForm, value: string | number) => setForm((current) => ({ ...current, [field]: value }));
  const submitSettings = () => onSaveSettings(form);
  return <div className="grid gap-4">
    <Card eyebrow="Race Settings" title="Personalize calendar planning">
      {!settings.hasSettings && <div className="mb-4"><EmptyState title="Missing race settings" copy={settings.emptyState} /></div>}
      <div className="grid gap-3 md:grid-cols-5">
        <Field label="Race date"><input className={inputClass} type="date" value={form.raceDate} onChange={(event) => updateForm("raceDate", event.target.value)} /></Field>
        <Field label="Race type"><select className={inputClass} value={form.raceType} onChange={(event) => updateForm("raceType", event.target.value as RaceCalendarSettingsForm["raceType"])}><option value="HalfMarathon">Half Marathon</option><option value="Marathon">Marathon</option><option value="10K">10K</option><option value="5K">5K</option><option value="Other">Other</option></select></Field>
        <Field label="Target pace"><input className={inputClass} type="number" step="0.01" min="1" value={form.targetRacePace} onChange={(event) => updateForm("targetRacePace", Number(event.target.value))} /></Field>
        <Field label="Longest run"><input className={inputClass} type="number" step="0.1" min="0" value={form.currentLongestRun} onChange={(event) => updateForm("currentLongestRun", Number(event.target.value))} /></Field>
        <Field label="Weekly mileage"><input className={inputClass} type="number" step="0.1" min="0" value={form.currentWeeklyMileage} onChange={(event) => updateForm("currentWeeklyMileage", Number(event.target.value))} /></Field>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2 sm:grid-cols-5">{settings.summary.map((item) => <p key={item.label} className="rounded-2xl bg-white/[0.03] px-3 py-2 text-xs text-zinc-400"><span className="block font-black uppercase tracking-[0.16em] text-zinc-500">{item.label}</span><span className="text-sm font-bold text-white">{item.value}</span></p>)}</div>
        <button type="button" onClick={submitSettings} className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-black text-black">Save race settings</button>
      </div>
      <p className="mt-4 text-xs text-zinc-500">{settings.caveat}</p>
    </Card>

    <Card eyebrow="Race Calendar" title="Half marathon countdown">
      {model.hasLowData && <div className="mb-4"><EmptyState title={model.emptyState.title} copy={model.emptyState.copy} /></div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={model.countdown.label} value={model.countdown.value} sub={model.countdown.sub} tone="yellow" />
        <Stat label="Current phase" value={model.thisWeek.phase} sub={model.thisWeek.focus} />
        <Stat label="Current training week" value={model.thisWeek.trainingWeek} />
        <Stat label={model.readiness.label} value={model.readiness.value} sub={model.readiness.sub} tone={model.readiness.value === "Ahead" || model.readiness.value === "OnTrack" ? "green" : model.readiness.value === "Behind" ? "red" : "yellow"} />
      </div>
    </Card>

    <div className="grid gap-4 lg:grid-cols-3">
      <Card eyebrow="This week" title={model.thisWeek.focus}>
        <div className="grid gap-3">
          <Stat label="Target long run" value={model.thisWeek.targetLongRun} />
          <Stat label="Target weekly mileage" value={model.thisWeek.targetWeeklyMileage} />
        </div>
      </Card>
      <Card eyebrow={model.nextMilestone.label} title={model.nextMilestone.value}>
        <p className="text-sm leading-6 text-zinc-300">{model.nextMilestone.sub}</p>
      </Card>
      <Card eyebrow={model.peakTaper.title} title="Peak and taper targets">
        <div className="grid gap-3">
          <Stat label="Next deload week" value={model.peakTaper.nextDeloadWeek} />
          <Stat label="Expected peak week" value={model.peakTaper.expectedPeakWeek} />
          <Stat label="Expected peak long run" value={model.peakTaper.expectedPeakLongRun} />
          <Stat label="Expected peak mileage" value={model.peakTaper.expectedPeakMileage} />
        </div>
      </Card>
    </div>

    <Card eyebrow="Training Roadmap" title="Upcoming calendar weeks preview">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {model.roadmapPreview.map((week) => <div key={week.weekLabel} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{week.weekLabel}</p><p className="mt-1 text-lg font-black text-white">{week.phase}</p></div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-amber-200">{week.mileageTrend}</span>
          </div>
          <p className="mt-3 text-sm font-bold text-zinc-200">{week.focus}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400"><p>Long run: <span className="font-bold text-white">{week.targetLongRun}</span></p><p>Mileage: <span className="font-bold text-white">{week.targetWeeklyMileage}</span></p></div>
        </div>)}
      </div>
      <p className="mt-4 text-xs text-zinc-500">Read-only roadmap from Race Calendar Engine V1 and Adaptive Training Calendar Engine V1. Daily workouts and runs are still owned by Train/Training Engine.</p>
    </Card>
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
  const currentDate = todayIso();
  const todayEntry = state.checkIns.find((entry) => entry.date === currentDate);
  const completionStatus = deriveDailyCompletionStatus(state, currentDate);
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
    workoutCompleted: completionStatus.workoutCompleted,
    runCompleted: completionStatus.runCompleted,
    macrosHit: latest?.macrosHit ?? false,
    notes: "",
  };
  const [form, setForm] = useState<DailyCheckIn>({ ...fallback, ...todayEntry, id: todayEntry?.id ?? uid("check"), date: currentDate, workoutCompleted: completionStatus.workoutCompleted, runCompleted: completionStatus.runCompleted, notes: todayEntry?.notes ?? "" });
  const [savedStatus, setSavedStatus] = useState<ReturnType<typeof evaluateDailyRecoveryStatus> | null>(todayEntry ? evaluateDailyRecoveryStatus(todayEntry) : null);
  const previewStatus = evaluateDailyRecoveryStatus(form);
  const displayedStatus = savedStatus ?? previewStatus;
  const displayedCompletionStatus = deriveDailyCompletionStatus(state, form.date);
  const readinessNote = useDataConfidence(state, "readiness");
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
    const entry: DailyCheckIn = { ...form, ...displayedCompletionStatus, userId: state.user.id, id: form.id || uid("check") };
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
        <div className="grid gap-1">
          <Field label="Yesterday's Steps">{numberInput("steps", 0, 100000)}</Field>
          <p className="text-xs text-zinc-500">Total steps completed during the previous calendar day.</p>
          <p className="text-xs text-zinc-600">Future: auto-populate from Apple Health or wearable integrations when available.</p>
        </div>
        <Field label="Alcohol yesterday">{yesNo("alcohol")}</Field>
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
      <div className="mt-4"><DataConfidenceNotice note={readinessNote} /></div>
      <div className="mt-4 grid gap-3">
        <Stat label="Sleep" value={`${form.sleepHours}h`} tone={form.sleepHours >= 6.5 ? "green" : form.sleepHours >= 5 ? "yellow" : "red"} />
        <Stat label="Soreness" value={`${form.soreness}/10`} tone={form.soreness <= 5 ? "green" : form.soreness <= 7 ? "yellow" : "red"} />
        <Stat label="Stress" value={`${form.stress}/10`} tone={form.stress <= 3 ? "green" : form.stress === 4 ? "yellow" : "red"} />
        <Stat label="Energy" value={`${form.energy}/10`} tone={form.energy >= 3 ? "green" : form.energy === 2 ? "yellow" : "red"} />
        <Stat label="Alcohol" value={form.alcohol ? "Yes" : "No"} tone={form.alcohol ? "yellow" : "green"} />
        <Stat label="Workout completed" value={displayedCompletionStatus.workoutCompleted ? "Yes" : "No"} sub="Auto-detected from workout logs" tone={displayedCompletionStatus.workoutCompleted ? "green" : "neutral"} />
        <Stat label="Run completed" value={displayedCompletionStatus.runCompleted ? "Yes" : "No"} sub="Auto-detected from run logs" tone={displayedCompletionStatus.runCompleted ? "green" : "neutral"} />
      </div>
      <p className="mt-4 text-xs text-zinc-500">Rules applied from /05_API_and_Data/adjustment_rules.md: Red overrides Yellow; otherwise Green means follow plan, Yellow means modify dose.</p>
    </Card>
  </div>;
}

function TrainingPlan({ state, updateState, selectedWeek, setSelectedWeek, selectedDay, setSelectedDay, readiness, workout, latestCheckIn, runningRecommendation, scheduledRun, trainingEngineResult: providedTrainingEngineResult, plannerTrainPreviewPanel }: { state: AppState; updateState: (s: AppState) => void; selectedWeek: number; setSelectedWeek: (n: number) => void; selectedDay: number; setSelectedDay: (n: number) => void; readiness: any; workout: any; latestCheckIn?: DailyCheckIn; runningRecommendation?: any; scheduledRun: { type: string; title?: string; distanceMiles: number; estimatedMinutes?: number } | null; trainingEngineResult: TrainingEngineResult; plannerTrainPreviewPanel?: PlannerTrainPreviewPanel | null }) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const displayedWorkout = workout;
  const tone = readiness.status === "Green" ? "green" : readiness.status === "Yellow" ? "yellow" : "red";
  const plannedRun = scheduledRun?.distanceMiles ?? 0;
  const trainingEngineResult = providedTrainingEngineResult ?? evaluateTraining({
    currentDate: todayIso(),
    trainingPlan: null,
    selectedWeek,
    selectedDay,
    readinessResult: readiness,
    progressionResult: { weeklyDecision: "Repeat", nutritionDecision: "Maintain Calories", goalStatus: { "Fat Loss": "At Risk", Physique: "At Risk", Strength: "At Risk", "Half Marathon": "At Risk" }, confidence: "Low", dataQuality: { score: 40, confidence: "Low", missingInputs: ["progressionResult"], penalties: [], warnings: ["Need canonical progression output"] }, reasons: [], warnings: [], auditEntries: [] } as any,
    goalTrackingResult: { overallStatus: "Insufficient Data", confidence: "Low", dataQualityScore: 40, warnings: ["Need goal tracking output"], priorityGoal: "half_marathon", recommendations: [] } as any,
    scheduledWorkout: displayedWorkout,
    scheduledRun,
    availableMinutes: 90,
    userPreferences: { includeWarmup: true, includeCooldown: true },
  });
  const trainBlocks = trainingEngineResult.todayPlan;
  const liftScheduled = Boolean(trainingEngineResult.workout);
  const runScheduled = Boolean(trainingEngineResult.run);
  const activeSession = (activeSessionId ? state.workoutSessions.find((session) => session.id === activeSessionId) : null)
    ?? [...state.workoutSessions].reverse().find((session) => session.workoutId === displayedWorkout.id && session.status === "active");
  const workoutNote = useDataConfidence(state, "workout");
  const runningNote = useDataConfidence(state, "running");
  const today = todayIso();
  const liftCompleted = liftScheduled ? state.workoutSessions.some((session) => session.workoutId === displayedWorkout.id && session.status === "completed" && (session.startedAt.slice(0, 10) === today || session.endedAt?.slice(0, 10) === today)) : null;
  const todayRun = runScheduled ? state.runLogs.find((run) => run.date === today && run.completed) : null;
  const runCompleted = runScheduled ? Boolean(todayRun) : null;
  const majorWarnings = [
    ...trainingEngineResult.warnings.map((warning) => warning.message),
    ...(latestCheckIn?.pain ? [`Pain flag: ${latestCheckIn.painLocation || "unspecified"} ${latestCheckIn.painSeverity}/10. Keep training pain-free.`] : []),
    ...(runningRecommendation?.warnings ?? []),
  ];

  const startWorkout = () => {
    if (!liftScheduled) return;
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

  return <section className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4 shadow-2xl shadow-black/30">
    <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-amber-300/80">Train</p>
      <h2 className="mt-1 text-2xl font-black text-white">Today’s complete training session</h2>
      <p className="mt-2 text-sm text-zinc-300">Train is now the only place to execute/log workouts and runs. Follow the blocks in order.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-5">{trainBlocks.map((block, index) => <div key={`${block.kind}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{index + 1}. {block.kind}</p><p className="mt-1 text-sm font-black text-white">{block.title}</p><p className="mt-1 text-xs text-zinc-400">{block.description}</p></div>)}</div>
    </div>

    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-amber-300">Lift / workout block</p><h3 className="mt-2 text-xl font-black text-white">{trainingEngineResult.workout?.title ?? "No lift scheduled"}</h3><div className="mt-3 grid gap-2">{trainingEngineResult.workout ? trainingEngineResult.workout.items.map((item) => <p key={item} className="rounded-xl bg-black/20 p-3 text-sm text-zinc-300">{item}</p>) : <p className="text-zinc-400">Skip directly from warm-up to run or cooldown.</p>}</div><div className="mt-3"><DataConfidenceNotice note={workoutNote} /></div>{liftScheduled && <button onClick={startWorkout} className="mt-3 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Start Lift / Workout</button>}</div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-sky-300">Run block</p><h3 className="mt-2 text-xl font-black text-white">{trainingEngineResult.run?.title ?? "No run scheduled"}</h3><p className="mt-2 text-sm text-zinc-400">{trainingEngineResult.run?.description ?? "No run logging needed today."}</p>{latestCheckIn?.pain ? <p className="mt-3 rounded-xl bg-red-950/40 p-3 text-sm text-red-200">Pain flag: keep training pain-free.</p> : null}<div className="mt-3"><DataConfidenceNotice note={runningNote} /></div></div>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <SessionInstructionBlock title="Warm-up" items={trainingEngineResult.warmup?.items ?? []} />
      <SessionInstructionBlock title="Workout" items={trainingEngineResult.workout?.items ?? []} />
      <SessionInstructionBlock title="Run" items={trainingEngineResult.run?.items ?? []} />
      <SessionInstructionBlock title="Cooldown" items={trainingEngineResult.cooldown?.items ?? []} />
    </div>

    {plannerTrainPreviewPanel?.visible && <PlannerTrainPreviewDeveloperPanel panel={plannerTrainPreviewPanel} />}

    {runScheduled && <div className="mt-4"><TrainRunLogger state={state} updateState={updateState} plannedDistance={plannedRun} runType={(scheduledRun?.type === "long" ? "long run" : scheduledRun?.type === "tempo" ? "tempo" : scheduledRun?.type === "speed" ? "interval" : "easy") as RunType} existingRun={todayRun ?? undefined} /></div>}

    <Card className="mt-4" eyebrow="Session Summary" title="Training day status">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Lift completed" value={liftCompleted === null ? "Not scheduled" : liftCompleted ? "Yes" : "No"} tone={liftCompleted === null ? "neutral" : liftCompleted ? "green" : "yellow"} />
        <Stat label="Run completed" value={runCompleted === null ? "Not scheduled" : runCompleted ? "Yes" : "No"} tone={runCompleted === null ? "neutral" : runCompleted ? "green" : "yellow"} />
        <Stat label="Readiness used" value={`${readiness.status} — ${readiness.score}`} sub={readiness.reason} tone={tone} />
        <Stat label="Next action" value={liftScheduled && !liftCompleted ? "Start lift" : runScheduled && !runCompleted ? "Log run" : "Cooldown + recover"} />
      </div>
      {majorWarnings.length ? <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-950/30 p-4 text-sm text-red-100"><p className="font-black">Major warnings</p><ul className="mt-2 list-disc space-y-1 pl-5">{majorWarnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul></div> : <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">No major training warnings from today’s readiness/run recommendation.</p>}
    </Card>

    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <Field label="Week"><select className={inputClass} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>Week {i+1}</option>)}</select></Field>
      <Field label="Day"><select className={inputClass} value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
      <Stat label="Readiness" value={`${readiness.status} — ${readiness.score}`} sub={readiness.reason} tone={tone} />
    </div>
  </section>;
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


function SessionInstructionBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-black text-white">{title}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-300">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function TrainRunLogger({ state, updateState, plannedDistance, runType, existingRun }: { state: AppState; updateState: (s: AppState) => void; plannedDistance: number; runType: RunType; existingRun?: AppState["runLogs"][number] }) {
  const [form, setForm] = useState<TrainRunLogInput>({
    id: existingRun?.id ?? uid("run"),
    userId: state.user.id,
    date: existingRun?.date ?? todayIso(),
    runType: existingRun?.runType ?? runType,
    plannedDistance: existingRun?.plannedDistance ?? plannedDistance,
    actualDistance: existingRun?.actualDistance ?? plannedDistance,
    durationMinutes: existingRun?.durationMinutes ?? Math.round(plannedDistance * 11),
    averagePace: existingRun?.averagePace ?? 11,
    averageHeartRate: existingRun?.averageHr ?? 140,
    rpe: existingRun?.rpe ?? 5,
    pain: existingRun?.pain ?? false,
    painScore: existingRun?.painScore ?? 0,
    notes: existingRun?.notes ?? "",
    walkBreaks: existingRun?.walkBreaks ?? false,
  });
  const [result, setResult] = useState<string | null>(null);
  const set = (field: keyof TrainRunLogInput, value: string | number | boolean) => setForm({ ...form, [field]: value });
  const save = () => {
    const saved = saveTrainRunLog(state, form);
    updateState(saved.state);
    setResult(saved.result.summary);
  };
  return <Card eyebrow="Train Run Execution" title="Log today’s run"><div className="grid gap-3 md:grid-cols-2">
    <Field label="Date"><input className={inputClass} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
    <Field label="Run type"><select className={inputClass} value={form.runType} onChange={(e) => set("runType", e.target.value as RunType)}><option value="easy">Easy</option><option value="speed">Speed</option><option value="tempo">Tempo</option><option value="long run">Long run</option><option value="race">Race</option></select></Field>
    <Field label="Planned distance"><input className={inputClass} type="number" step="0.1" min="0" value={form.plannedDistance} onChange={(e) => set("plannedDistance", Number(e.target.value))} /></Field>
    <Field label="Actual distance"><input className={inputClass} type="number" step="0.1" min="0" value={form.actualDistance} onChange={(e) => set("actualDistance", Number(e.target.value))} /></Field>
    <Field label="Duration"><input className={inputClass} type="number" step="1" min="0" value={form.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></Field>
    <Field label="Average pace"><input className={inputClass} type="number" step="0.1" min="0" value={form.averagePace ?? ""} onChange={(e) => set("averagePace", Number(e.target.value))} /></Field>
    <Field label="Average heart rate"><input className={inputClass} type="number" min="0" value={form.averageHeartRate} onChange={(e) => set("averageHeartRate", Number(e.target.value))} /></Field>
    <Field label="RPE 1-10"><input className={inputClass} type="number" min="1" max="10" value={form.rpe} onChange={(e) => set("rpe", Number(e.target.value))} /></Field>
    <Field label="Pain"><select className={inputClass} value={String(form.pain)} onChange={(e) => set("pain", e.target.value === "true")}><option value="false">No</option><option value="true">Yes</option></select></Field>
    <Field label="Pain score 0-10"><input className={inputClass} type="number" min="0" max="10" value={form.painScore ?? 0} onChange={(e) => set("painScore", Number(e.target.value))} /></Field>
    <Field label="Walk breaks"><select className={inputClass} value={String(form.walkBreaks ?? false)} onChange={(e) => set("walkBreaks", e.target.value === "true")}><option value="false">No</option><option value="true">Yes</option></select></Field>
    <label className="grid gap-1 text-sm text-zinc-300 md:col-span-2">Notes<textarea className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
  </div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save run from Train</button>{result ? <p className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">{result}</p> : null}</Card>;
}

function RunProgress({ trends }: { trends: ReturnType<typeof calculateRunTrends> }) {
  const runTrendCards = buildRunTrendCards(trends);
  return <Card eyebrow="Run Trends" title="Pace and mileage trends"><div className="mb-4 grid gap-3 sm:grid-cols-2">{runTrendCards.map((card) => <Stat key={card.label} label={card.label} value={card.value} sub={card.coachCopy} tone={card.tone === "neutral" ? "neutral" : card.tone} />)}</div><div className="grid gap-4"><div><p className="mb-2 text-sm font-bold text-zinc-300">Mileage trend</p><Sparkline values={trends.distanceTrend ?? []} color="#38bdf8" /></div><div><p className="mb-2 text-sm font-bold text-zinc-300">Pace trend</p><Sparkline values={trends.paceTrend ?? []} color="#f59e0b" /></div></div></Card>;
}

function NutritionLogger({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const today = todayIso();
  const macroTarget = state.macroTargets.find((target) => target.week === state.currentWeek) ?? state.macroTargets[0];
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<NutritionUiMealCategory>("Breakfast");
  const [manualMeal, setManualMeal] = useState({ name: "", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, water: 0, notes: "" });
  const [savedFoodId, setSavedFoodId] = useState("saved-greek-yogurt");
  const [savedFoodServings, setSavedFoodServings] = useState(1);
  const [foodAiMode, setFoodAiMode] = useState<FoodAiMode>("Nutrition Label Scan");
  const [foodAiFileName, setFoodAiFileName] = useState("");
  const [foodAiImageDataUrl, setFoodAiImageDataUrl] = useState("");
  const [foodAiServings, setFoodAiServings] = useState(1);
  const [foodAiDraft, setFoodAiDraft] = useState<FoodAiReviewDraft | null>(null);
  const [foodAiStatus, setFoodAiStatus] = useState("Upload an image to start FOOD_AI_V1.");
  const [foodAiScanning, setFoodAiScanning] = useState(false);
  const [foodAiProvider, setFoodAiProvider] = useState<string | undefined>();
  const [foodAiError, setFoodAiError] = useState<string | undefined>();
  const [foodAiEdits, setFoodAiEdits] = useState({ name: "", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 });
  const [foodAiIssues, setFoodAiIssues] = useState<string[]>([]);
  const model = buildNutritionUiV2Model(state, { date, macroTarget });
  const nutritionNote = useDataConfidence(state, "nutrition");
  const foodAiProviderLabel = buildFoodScanProviderLabel({ provider: foodAiProvider ?? foodAiDraft?.provider, error: foodAiError, hasDraft: Boolean(foodAiDraft), scanning: foodAiScanning });
  const setManual = (field: keyof typeof manualMeal, value: string | number) => setManualMeal({ ...manualMeal, [field]: value });
  const syncStateWithMeals = (nextMeals: AppState["meals"]) => {
    const existingLog = state.nutritionLogs.find((log) => log.date === date);
    const nextLog = syncNutritionLogFromNutritionUiV2Meals({ userId: state.user.id, date, meals: nextMeals, existingLog, macroTarget });
    updateState({ ...state, meals: nextMeals, nutritionLogs: [...state.nutritionLogs.filter((log) => log.date !== date), nextLog] });
  };
  const saveManualMeal = () => {
    if (!manualMeal.name.trim()) return;
    const meal = createMealFromNutritionUiV2ManualEntry({ id: uid("meal"), userId: state.user.id, date, category, name: manualMeal.name.trim(), calories: Number(manualMeal.calories), protein: Number(manualMeal.protein), carbs: Number(manualMeal.carbs), fat: Number(manualMeal.fat), fiber: Number(manualMeal.fiber), water: Number(manualMeal.water), notes: manualMeal.notes });
    syncStateWithMeals([...state.meals.filter((entry) => entry.id !== meal.id), meal]);
    setManualMeal({ name: "", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, water: 0, notes: "" });
  };
  const saveSavedFood = () => {
    const savedFood = model.savedFoods.find((food) => food.id === savedFoodId) ?? model.savedFoods[0];
    if (!savedFood) return;
    const meal = createMealFromNutritionUiV2SavedFood({ id: uid("meal"), userId: state.user.id, date, category, savedFood, servings: savedFoodServings });
    syncStateWithMeals([...state.meals.filter((entry) => entry.id !== meal.id), meal]);
  };
  const onFoodAiFile = async (file: File | null) => {
    if (!file) return;
    setFoodAiFileName(file.name);
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.readAsDataURL(file);
    });
    setFoodAiImageDataUrl(imageDataUrl);
    setFoodAiError(undefined);
    setFoodAiProvider(undefined);
    setFoodAiStatus(`${file.name} ready for ${foodAiMode}.`);
  };
  const runFoodAiScan = async () => {
    if (!foodAiImageDataUrl) { setFoodAiStatus("Upload an image before running FOOD_AI_V1."); return; }
    setFoodAiScanning(true);
    setFoodAiError(undefined);
    setFoodAiStatus(foodAiMode === "Nutrition Label Scan" ? "OCR extracting nutrition label..." : "AI estimating meal photo macros...");
    try {
      const endpoint = foodAiMode === "Nutrition Label Scan" ? "/api/food-ai/label" : "/api/food-ai/photo";
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: foodAiFileName, imageDataUrl: foodAiImageDataUrl }) });
      const payload = await response.json() as { ok: boolean; provider?: string; model?: string; result?: FoodScanResult; issues?: string[]; warning?: string; error?: { message?: string } };
      if (!response.ok || !payload.ok || !payload.result) throw new Error(payload.error?.message ?? "FOOD_AI_V1 scan failed.");
      const draft = buildFoodAiReviewDraft({ result: payload.result, servingsEaten: foodAiServings, imageUrl: foodAiImageDataUrl });
      setFoodAiDraft(draft);
      setFoodAiEdits({ name: draft.name, calories: draft.perServing.calories, protein: draft.perServing.protein, carbs: draft.perServing.carbs, fat: draft.perServing.fat, fiber: draft.perServing.fiber, sodium: draft.perServing.sodium });
      setFoodAiIssues(payload.issues ?? []);
      setFoodAiProvider(payload.provider ?? draft.provider);
      setFoodAiError(undefined);
      setFoodAiStatus(payload.warning ?? "Scan ready for user review.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "FOOD_AI_V1 scan failed.";
      setFoodAiError(message);
      setFoodAiStatus(message);
    } finally {
      setFoodAiScanning(false);
    }
  };
  const updateFoodAiEdit = (field: keyof typeof foodAiEdits, value: string | number) => {
    const next = { ...foodAiEdits, [field]: value };
    setFoodAiEdits(next);
    if (foodAiDraft) setFoodAiDraft(buildFoodAiReviewDraft({ result: { id: foodAiDraft.scanId, mode: foodAiDraft.mode, detectedName: foodAiDraft.name, servingSize: foodAiDraft.servingSize, servingsEaten: 1, calories: foodAiDraft.perServing.calories, protein: foodAiDraft.perServing.protein, carbs: foodAiDraft.perServing.carbs, fat: foodAiDraft.perServing.fat, fiber: foodAiDraft.perServing.fiber, sodium: foodAiDraft.perServing.sodium, confidence: foodAiDraft.providerConfidence, provider: foodAiDraft.provider, isMock: foodAiDraft.provider.includes("mock") }, servingsEaten: foodAiServings, edits: next, imageUrl: foodAiDraft.imageUrl }));
  };
  const confirmFoodAiMeal = () => {
    if (!foodAiDraft) return;
    const mealLog = buildConfirmedFoodAiMealLog({ id: uid("meal-log"), date, mealType: foodAiMealCategoryToMealLogType(category), draft: foodAiDraft });
    const meal = buildFoodAiMealFromMealLog({ mealLog, id: uid("meal"), userId: state.user.id });
    syncStateWithMeals([...state.meals.filter((entry) => entry.id !== meal.id), meal]);
    setFoodAiDraft(null);
    setFoodAiStatus(`${mealLog.name} saved as ${mealLog.source} (${mealLog.confidence} Confidence).`);
  };
  const removeMeal = (mealId: string) => syncStateWithMeals(state.meals.filter((meal) => meal.id !== mealId));
  const progressTone = (percent: number, key: string) => key === "calories" ? percent >= 90 && percent <= 105 ? "from-emerald-300 to-emerald-500" : percent > 105 ? "from-red-300 to-red-500" : "from-amber-300 to-orange-400" : percent >= 90 ? "from-emerald-300 to-emerald-500" : "from-amber-300 to-orange-400";
  const format = (value: number, unit: string) => `${value}${unit === "cal" ? "" : unit}`;
  return <div className="grid gap-4">
    <Card eyebrow="Nutrition UI V2" title="Daily nutrition dashboard" className="border-emerald-300/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.18),transparent_35%),rgba(6,78,59,.12)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-zinc-400">Built from Nutrition V2 targets, meal logs, macro progress, adherence scoring, and FOOD_AI_V1 scanner review when you use image scans.</p><h3 className="mt-2 text-3xl font-black text-white">{model.totals.calories} / {model.target.calories} calories</h3></div>
        <Field label="Dashboard date"><input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      </div>
      <div className="mt-4"><DataConfidenceNotice note={nutritionNote} /></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {model.progress.map((item) => <div key={item.key} className="rounded-3xl border border-white/10 bg-black/25 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{item.label}</p><p className="mt-1 text-2xl font-black text-white">{format(item.consumed, item.unit)} <span className="text-sm text-zinc-500">consumed</span></p></div><p className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-zinc-200">{item.percentComplete}%</p></div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full bg-gradient-to-r ${progressTone(item.percentComplete, item.key)}`} style={{ width: `${item.percentComplete}%` }} /></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><span className="rounded-xl bg-white/[0.04] p-2 text-zinc-300">Consumed<br /><b className="text-white">{format(item.consumed, item.unit)}</b></span><span className="rounded-xl bg-white/[0.04] p-2 text-zinc-300">Remaining<br /><b className="text-white">{format(item.remaining, item.unit)}</b></span><span className="rounded-xl bg-white/[0.04] p-2 text-zinc-300">Target<br /><b className="text-white">{format(item.target, item.unit)}</b></span></div>
        </div>)}
      </div>
    </Card>

    <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
      <Card eyebrow="Meal Cards" title="Breakfast · Lunch · Dinner · Snack">
        <div className="grid gap-3 md:grid-cols-2">{model.mealCards.map((mealCard) => <div key={mealCard.category} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between"><h3 className="text-lg font-black text-white">{mealCard.category}</h3><span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-200">{mealCard.calories} cal</span></div>
          <p className="mt-2 text-sm text-zinc-400">{mealCard.protein}P / {mealCard.carbs}C / {mealCard.fat}F · Fiber {mealCard.fiber}g · Water {mealCard.water}oz</p>
          <div className="mt-3 grid gap-2">{mealCard.entries.length ? mealCard.entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl bg-black/25 p-3 text-sm"><div><p className="font-bold text-white">{entry.name}</p><p className="text-xs text-zinc-500">{entry.source === "saved-food" ? "Saved food" : entry.source === "nutrition-label-scan" ? "Nutrition label scan" : entry.source === "meal-photo-ai" ? "Meal photo AI" : "Manual meal entry"} · {entry.calories} cal · {entry.protein}g protein</p></div><button type="button" onClick={() => removeMeal(entry.id)} className="rounded-xl border border-white/10 px-3 py-1 text-xs font-bold text-zinc-300">Remove</button></div>) : <p className="rounded-2xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No {mealCard.category.toLowerCase()} logged yet.</p>}</div>
        </div>)}</div>
      </Card>

      <Card eyebrow="Meal Entry" title="Manual meal entry + saved foods">
        <div className="grid gap-3">
          <Field label="Meal card"><select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value as NutritionUiMealCategory)}><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></Field>
          <div className="rounded-3xl border border-white/10 bg-black/25 p-4"><p className="font-black text-white">Manual meal entry</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Meal name"><input className={inputClass} value={manualMeal.name} onChange={(event) => setManual("name", event.target.value)} placeholder="Chicken bowl" /></Field><Field label="Calories"><input className={inputClass} type="number" min="0" value={manualMeal.calories} onChange={(event) => setManual("calories", Number(event.target.value))} /></Field><Field label="Protein"><input className={inputClass} type="number" min="0" value={manualMeal.protein} onChange={(event) => setManual("protein", Number(event.target.value))} /></Field><Field label="Carbs"><input className={inputClass} type="number" min="0" value={manualMeal.carbs} onChange={(event) => setManual("carbs", Number(event.target.value))} /></Field><Field label="Fat"><input className={inputClass} type="number" min="0" value={manualMeal.fat} onChange={(event) => setManual("fat", Number(event.target.value))} /></Field><Field label="Fiber"><input className={inputClass} type="number" min="0" value={manualMeal.fiber} onChange={(event) => setManual("fiber", Number(event.target.value))} /></Field><Field label="Water"><input className={inputClass} type="number" min="0" value={manualMeal.water} onChange={(event) => setManual("water", Number(event.target.value))} /></Field><Field label="Notes"><input className={inputClass} value={manualMeal.notes} onChange={(event) => setManual("notes", event.target.value)} /></Field></div><button type="button" onClick={saveManualMeal} className="mt-4 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Add manual meal</button></div>
          <div className="rounded-3xl border border-white/10 bg-black/25 p-4"><p className="font-black text-white">Saved foods</p><div className="mt-3 grid gap-3"><Field label="Saved food"><select className={inputClass} value={savedFoodId} onChange={(event) => setSavedFoodId(event.target.value)}>{model.savedFoods.map((food) => <option key={food.id} value={food.id}>{food.name} · {food.calories} cal · {food.protein}P</option>)}</select></Field><Field label="Servings"><input className={inputClass} type="number" min="0.25" step="0.25" value={savedFoodServings} onChange={(event) => setSavedFoodServings(Number(event.target.value))} /></Field></div><button type="button" onClick={saveSavedFood} className="mt-4 w-full rounded-2xl border border-emerald-300/30 bg-emerald-300/15 px-4 py-3 font-black text-emerald-100">Add saved food</button></div>
          <div className="rounded-3xl border border-white/10 bg-black/25 p-4"><p className="font-black text-white">FOOD_AI_V1 scanners</p><p className="mt-1 text-xs text-zinc-500">Nutrition Label Scanner uses OCR/review/servings confirmation. Meal Photo Scanner estimates macros and stays Medium Confidence after confirmation.</p><div className="mt-3 grid gap-3"><Field label="Scanner"><select className={inputClass} value={foodAiMode} onChange={(event) => { setFoodAiMode(event.target.value as FoodAiMode); setFoodAiDraft(null); }}><option>Nutrition Label Scan</option><option>Food Photo Scan</option></select></Field><Field label="Upload image"><input className={inputClass} type="file" accept="image/*" onChange={(event) => { void onFoodAiFile(event.target.files?.[0] ?? null); }} /></Field><Field label="Servings eaten"><input className={inputClass} type="number" min="0.25" step="0.25" value={foodAiServings} onChange={(event) => { const servings = Number(event.target.value); setFoodAiServings(servings); if (foodAiDraft) setFoodAiDraft(buildFoodAiReviewDraft({ result: { id: foodAiDraft.scanId, mode: foodAiDraft.mode, detectedName: foodAiDraft.name, servingSize: foodAiDraft.servingSize, servingsEaten: 1, calories: foodAiDraft.perServing.calories, protein: foodAiDraft.perServing.protein, carbs: foodAiDraft.perServing.carbs, fat: foodAiDraft.perServing.fat, fiber: foodAiDraft.perServing.fiber, sodium: foodAiDraft.perServing.sodium, confidence: foodAiDraft.providerConfidence, provider: foodAiDraft.provider, isMock: foodAiDraft.provider.includes("mock") }, servingsEaten: servings, edits: foodAiEdits, imageUrl: foodAiDraft.imageUrl })); }} /></Field><button type="button" disabled={foodAiScanning} onClick={runFoodAiScan} className="rounded-2xl bg-sky-300 px-4 py-3 font-black text-black disabled:opacity-50">{foodAiScanning ? "Scanning..." : foodAiMode === "Nutrition Label Scan" ? "Run label OCR" : "Run meal photo AI"}</button></div><div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-300">{foodAiProviderLabel.label}</p><p className="mt-1 text-xs text-zinc-400">{foodAiProviderLabel.detail}</p><p className="mt-2 text-xs text-zinc-500">Status: {foodAiStatus}</p></div>{foodAiIssues.length ? <ul className="mt-2 grid gap-1 text-xs text-yellow-200">{foodAiIssues.map((issue) => <li key={issue}>• {issue}</li>)}</ul> : null}{foodAiDraft ? <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 p-3"><p className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">Review before confirm</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="Name"><input className={inputClass} value={foodAiEdits.name} onChange={(event) => updateFoodAiEdit("name", event.target.value)} /></Field><Field label="Calories / serving"><input className={inputClass} type="number" min="0" value={foodAiEdits.calories} onChange={(event) => updateFoodAiEdit("calories", Number(event.target.value))} /></Field><Field label="Protein / serving"><input className={inputClass} type="number" min="0" value={foodAiEdits.protein} onChange={(event) => updateFoodAiEdit("protein", Number(event.target.value))} /></Field><Field label="Carbs / serving"><input className={inputClass} type="number" min="0" value={foodAiEdits.carbs} onChange={(event) => updateFoodAiEdit("carbs", Number(event.target.value))} /></Field><Field label="Fat / serving"><input className={inputClass} type="number" min="0" value={foodAiEdits.fat} onChange={(event) => updateFoodAiEdit("fat", Number(event.target.value))} /></Field><Field label="Fiber / serving"><input className={inputClass} type="number" min="0" value={foodAiEdits.fiber} onChange={(event) => updateFoodAiEdit("fiber", Number(event.target.value))} /></Field></div><p className="mt-3 text-sm text-zinc-300">Totals: <b className="text-white">{foodAiDraft.totals.calories} cal · {foodAiDraft.totals.protein}P / {foodAiDraft.totals.carbs}C / {foodAiDraft.totals.fat}F · Fiber {foodAiDraft.totals.fiber}g</b></p><p className="mt-1 text-xs text-zinc-400">{foodAiDraft.reviewWarning}</p><button type="button" onClick={confirmFoodAiMeal} className="mt-3 w-full rounded-2xl bg-emerald-300 px-4 py-3 font-black text-black">Confirm and save MealLog</button></div> : null}</div>
        </div>
      </Card>
    </section>

    <Card eyebrow="Adherence Cards" title="Today · 7 Day · 30 Day">
      <div className="grid gap-3 md:grid-cols-3">{model.adherenceCards.map((card) => <div key={card.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{card.label}</p><p className="mt-1 text-3xl font-black text-white">{card.macroAdherence}/100</p><div className="mt-3 grid gap-2 text-sm"><span className="flex justify-between rounded-xl bg-black/25 p-2"><b>Macro adherence</b><span>{card.macroAdherence}%</span></span><span className="flex justify-between rounded-xl bg-black/25 p-2"><b>Protein adherence</b><span>{card.proteinAdherence}%</span></span><span className="flex justify-between rounded-xl bg-black/25 p-2"><b>Calorie adherence</b><span>{card.calorieAdherence}%</span></span><span className="flex justify-between rounded-xl bg-black/25 p-2"><b>Logging consistency</b><span>{card.loggingConsistency}%</span></span></div></div>)}</div>
    </Card>
  </div>;
}

function BodyMetrics({ state, updateState, trend }: any) {
  const summary = buildBodyMetricsSummary(state.bodyMetrics ?? []);
  const [metric, setMetric] = useState<any>({ id: uid("metric"), userId: state.user.id, date: todayIso(), weight: trend.current7DayAverage || state.user.startingWeight, waist: 37.5, neck: 16, hips: 40, chest: 43, arms: 16, thighs: 24, notes: "" });
  const save = () => updateState({ ...state, bodyMetrics: [...state.bodyMetrics.filter((m: any) => m.date !== metric.date), metric] });
  const value = (number: number | null, suffix = "") => number === null ? "—" : `${number}${suffix}`;
  const change = (number: number | null, suffix = "") => number === null ? "Need more measurements" : `${number > 0 ? "+" : ""}${number}${suffix}`;
  const fields = ["date", "weight", "waist", "neck", "hips", "chest", "arms", "thighs", "notes"];
  return <div className="grid gap-4">
    <Card eyebrow="Body Metrics Summary" title="Measurement trend">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Current weight" value={value(summary.currentWeight, " lb")} sub={summary.message} />
        <Stat label="Weight change 7 days" value={change(summary.weightChange7Days, " lb")} tone={summary.weightChange7Days !== null && summary.weightChange7Days <= 0 ? "green" : "yellow"} />
        <Stat label="Waist change 7 days" value={change(summary.waistChange7Days, " in")} tone={summary.waistChange7Days !== null && summary.waistChange7Days <= 0 ? "green" : "yellow"} />
      </div>
    </Card>
    <Card eyebrow="Body Metrics" title="Weekly measurements"><div className="grid gap-3 md:grid-cols-2">{fields.map((field) => <Field key={field} label={field}><input className={inputClass} type={field === "date" ? "date" : field === "notes" ? "text" : "number"} value={metric[field] ?? ""} onChange={(e) => setMetric({ ...metric, [field]: e.target.type === "number" ? Number(e.target.value) : e.target.value })} /></Field>)}</div><button onClick={save} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save measurements</button></Card>
  </div>;
}

function ProgressPhotos({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const summary = buildPhotoSectionSummary(state.photos ?? []);
  const [photo, setPhoto] = useState<ProgressPhoto>({ id: uid("photo"), userId: state.user.id, date: todayIso(), frontPhotoUrl: "", sidePhotoUrl: "", backPhotoUrl: "", notes: "" });
  const save = () => updateState({ ...state, photos: [...state.photos, photo] });
  const photoFields = [
    ["frontPhotoUrl", "Front"],
    ["sidePhotoUrl", "Side"],
    ["backPhotoUrl", "Back"],
  ] as const;
  return <Card eyebrow="Progress Photos" title="Front / Side / Back">
    <p className="mb-4 text-sm text-zinc-400">Upload or paste saved-picture references for the three standard angles. Latest upload date: <span className="font-bold text-white">{summary.latestUploadDate ?? "No photos yet"}</span>.</p>
    <div className="grid gap-3 md:grid-cols-3">{summary.slots.map((slot) => <div key={slot.field} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><p className="text-sm font-black text-white">{slot.label}</p><p className="mt-1 break-all text-xs text-zinc-400">Latest: {slot.latestUrl ?? "—"}</p></div>)}</div>
    <div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="date"><input className={inputClass} type="date" value={photo.date} onChange={(e) => setPhoto({ ...photo, date: e.target.value })} /></Field>{photoFields.map(([field, label]) => <Field key={field} label={`${label} photo`}><input className={inputClass} type="text" placeholder={`${label} saved picture reference`} value={(photo as any)[field] ?? ""} onChange={(e) => setPhoto({ ...photo, [field]: e.target.value })} /></Field>)}<Field label="notes"><input className={inputClass} type="text" value={photo.notes ?? ""} onChange={(e) => setPhoto({ ...photo, notes: e.target.value })} /></Field></div>
    <button onClick={save} className="mt-5 rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Save photo record</button>
    <div className="mt-5 grid gap-3 md:grid-cols-3">{state.photos.map((p) => <div key={p.id} className="rounded-2xl bg-white/[0.03] p-3 text-sm text-zinc-400"><b className="text-white">{p.date}</b><br />Front: {p.frontPhotoUrl || "—"}<br />Side: {p.sidePhotoUrl || "—"}<br />Back: {p.backPhotoUrl || "—"}</div>)}</div>
  </Card>;
}

function WeeklyReviewPanel({ review, state }: { review: ReturnType<typeof buildWeeklyReviewSummary> | null; state: AppState }) {
  const weeklyNote = useDataConfidence(state, "weekly-review");
  if (!review) return <Card eyebrow="Weekly Review" title="Weekly coach review"><p className="text-zinc-400">No weekly review data is available yet.</p><div className="mt-4"><DataConfidenceNotice note={weeklyNote} /></div></Card>;
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
      <div className="mt-4"><DataConfidenceNotice note={weeklyNote} /></div>
    </Card>
    <Card eyebrow="Next week's recommendation" title={review.nextWeekRecommendation}>
      <div className="rounded-3xl bg-amber-400 p-5 text-black"><p className="text-xs font-black uppercase tracking-[0.25em]">Coach decision</p><h3 className="mt-2 text-2xl font-black">{review.nextWeekRecommendation}</h3><p className="mt-2 text-sm font-bold">{review.recommendationReason}</p></div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm font-bold text-white">Pain flags</p>{review.painFlags.length ? <ul className="mt-2 grid gap-1 text-sm text-red-200">{review.painFlags.map((flag) => <li key={flag}>• {flag}</li>)}</ul> : <p className="mt-2 text-sm text-zinc-400">No pain flags logged this week.</p>}</div>
    </Card>
  </div>;
}

function Settings({ state, updateState }: { state: AppState; updateState: (s: AppState) => void }) {
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => typeof window === "undefined" ? null : window.localStorage.getItem(LAST_BACKUP_DATE_KEY));
  const [importValidation, setImportValidation] = useState<BackupValidationResult | null>(null);
  const [importStatus, setImportStatus] = useState("Select a backup JSON file to validate it before restore.");
  const dashboard = buildBackupDashboardModel(state, lastBackupDate);
  const healthTone = dashboard.health.status === "GREEN" ? "text-emerald-300" : dashboard.health.status === "YELLOW" ? "text-amber-300" : "text-red-300";

  const exportBackup = () => {
    downloadAppStateBackup(state);
    const exportedAt = new Date().toISOString();
    if (typeof window !== "undefined") window.localStorage.setItem(LAST_BACKUP_DATE_KEY, exportedAt);
    setLastBackupDate(exportedAt);
    setImportStatus("Backup exported. Keep the JSON somewhere safe outside this browser.");
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const validation = parseAndValidateBackupJson(text);
    setImportValidation(validation);
    setImportStatus(`${validation.status}: ${validation.messages.join(" ")}`);
  };

  const confirmRestore = () => {
    if (!importValidation?.payload || importValidation.status === "INVALID") return;
    const restore = restoreBackupPayload(importValidation.payload, { persist: true });
    if (restore.status !== "restored") {
      setImportStatus(`Restore failed: ${restore.messages.join(" ")}`);
      return;
    }
    updateState(restore.state);
    setImportStatus(`Restore complete. Verified workouts ${restore.restoredCounts.workouts}, runs ${restore.restoredCounts.runs}, meals ${restore.restoredCounts.meals}, body metrics ${restore.restoredCounts.bodyMetrics}, photos ${restore.restoredCounts.photos}.`);
  };

  return <Card eyebrow="More" title="Settings and Integrations">
    <div className="mb-4 rounded-3xl border border-amber-300/25 bg-amber-300/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-200">Data Protection</p>
      <h3 className="mt-1 text-xl font-black text-white">Backup / Restore</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <Stat label="Backup Status" value={dashboard.health.status} sub={dashboard.backupStatus} tone={dashboard.health.status === "GREEN" ? "green" : dashboard.health.status === "YELLOW" ? "yellow" : "red"} />
        <Stat label="Last Backup Date" value={dashboard.lastBackupDate ? dashboard.lastBackupDate.slice(0, 10) : "Never"} />
        <Stat label="Schema Version" value={dashboard.schemaVersion} />
        <Stat label="Runs" value={dashboard.counts.runs} />
        <Stat label="Workouts" value={dashboard.counts.workouts} />
      </div>
      <p className={`mt-3 text-sm font-bold ${healthTone}`}>{dashboard.health.message}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <button type="button" onClick={exportBackup} className="rounded-2xl bg-amber-400 px-4 py-3 font-black text-black">Export Backup</button>
        <Field label="Import Backup"><input className={inputClass} type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} /></Field>
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
        <p className="font-black text-white">Validation / preview</p>
        <p className="mt-1">{importStatus}</p>
        {importValidation?.summary && <p className="mt-2 text-xs text-zinc-400">Preview: workouts {importValidation.summary.workouts} · runs {importValidation.summary.runs} · meals {importValidation.summary.meals} · body metrics {importValidation.summary.bodyMetrics} · photos {importValidation.summary.photos}</p>}
        <button type="button" disabled={!importValidation?.payload || importValidation.status === "INVALID"} onClick={confirmRestore} className="mt-3 rounded-2xl bg-emerald-400 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">Confirm Restore</button>
      </div>
    </div>
    <div className="grid gap-3 md:grid-cols-2"><Field label="Preferred units"><select className={inputClass} value={state.user.preferredUnits} onChange={(e) => updateState({ ...state, user: { ...state.user, preferredUnits: e.target.value as any } })}><option value="imperial">Imperial</option><option value="metric">Metric</option></select></Field><Field label="Notifications"><input className={inputClass} value="Morning check-in, weekly photos, long-run reminder" readOnly /></Field><Field label="Future Apple Health fields"><textarea className={inputClass} readOnly value="Steps, active calories, resting HR, HRV, sleep duration/stages, VO2 max, workout HR zones, running pace, recovery HR, cardio fitness trend" /></Field><Field label="Database mode"><textarea className={inputClass} readOnly value="MVP persists to localStorage now. Supabase/Postgres schema and seed SQL are included under supabase/ for production wiring." /></Field></div>
  </Card>;
}

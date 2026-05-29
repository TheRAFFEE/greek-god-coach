import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppState, FoodScanLog, Meal, PlanAdjustment, RunLog, SetLog, WorkoutSession } from "./types";
import { createBrowserSupabaseClient } from "./supabase-client";
import { saveState } from "./storage";

export type PersistenceMode = "localStorage" | "supabase";

export interface AuthPersistenceContext {
  mode: PersistenceMode;
  client: SupabaseClient | null;
  authUserId?: string;
  databaseUserId?: string;
}

export function createLocalPersistenceContext(): AuthPersistenceContext {
  return { mode: "localStorage", client: null };
}

export async function createAuthAwarePersistenceContext(): Promise<AuthPersistenceContext> {
  const client = createBrowserSupabaseClient();
  if (!client) return createLocalPersistenceContext();
  const { data } = await client.auth.getUser();
  if (!data.user) return { mode: "localStorage", client };
  const { data: profile } = await client.from("users").select("id").eq("auth_user_id", data.user.id).maybeSingle();
  return { mode: profile?.id ? "supabase" : "localStorage", client, authUserId: data.user.id, databaseUserId: profile?.id };
}

const stripUndefined = <T extends Record<string, unknown>>(row: T): T => JSON.parse(JSON.stringify(row));

export function toWorkoutSessionRow(session: WorkoutSession, userId: string) {
  return stripUndefined({ id: session.id, user_id: userId, workout_id: session.workoutId, workout_title: session.workoutTitle, mode: session.mode, started_at: session.startedAt, ended_at: session.endedAt, status: session.status, current_exercise_index: session.currentExerciseIndex, current_set_number: session.currentSetNumber, coach_decisions: session.coachDecisions ?? null });
}

export function toSetLogRow(log: SetLog, userId: string) {
  return stripUndefined({ id: log.id, session_id: log.sessionId, user_id: userId, workout_id: log.workoutId, exercise_id: log.exerciseId, exercise_name: log.exerciseName, set_number: log.setNumber, target_reps: log.targetReps, target_rpe: log.targetRpe, weight_used: log.weightUsed, reps_completed: log.repsCompleted, rpe: log.rpe, pain: log.pain, form_quality: log.formQuality, completed_at: log.completedAt, coach_decision: log.coachDecision ?? null, notes: log.notes ?? null });
}

export function toMealRow(meal: Meal, userId: string) {
  return stripUndefined({ id: meal.id, user_id: userId, date: meal.date, category: meal.category, name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, fiber: meal.fiber, sodium: meal.sodium, water: meal.water, notes: meal.notes });
}

export function toMealItemRows(meal: Meal, userId: string) {
  return meal.items.map((item) => stripUndefined({ id: item.id, meal_id: meal.id, user_id: userId, name: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, fiber: item.fiber, sodium: item.sodium, water: item.water, notes: item.notes }));
}

export function toRunLogRow(run: RunLog, userId: string) {
  return stripUndefined({ id: run.id, user_id: userId, date: run.date, planned_distance: run.plannedDistance, actual_distance: run.actualDistance, duration_minutes: run.durationMinutes, average_pace: run.averagePace, average_hr: run.averageHr, max_hr: run.maxHr, rpe: run.rpe, zone2_compliance: run.zone2Compliance, completed: run.completed, pain: run.pain, pain_location: run.painLocation, notes: run.notes });
}

export function toFoodScanRow(scan: FoodScanLog, userId: string) {
  return stripUndefined({ id: scan.id, user_id: userId, date: scan.date, mode: scan.mode, image_name: scan.imageName, image_preview_url: scan.imagePreviewUrl, selected_meal_id: scan.selectedMealId ?? null, result: scan.result, status: scan.status, provider: scan.provider, is_mock: scan.isMock, notes: scan.notes });
}

export function toCoachDecisionRow(adjustment: PlanAdjustment, userId: string) {
  return stripUndefined({ id: adjustment.id, user_id: userId, date: adjustment.date, category: adjustment.category ?? adjustment.adjustmentType, original_prescription: adjustment.originalPrescription ?? adjustment.previousValue, adjusted_prescription: adjustment.adjustedPrescription ?? adjustment.newValue, reason: adjustment.reason, trigger_data: adjustment.triggerData ? JSON.parse(adjustment.triggerData) : null, confidence: adjustment.confidence ?? null, mode: adjustment.mode ?? null, explanation: adjustment.explanation ?? null, notes: adjustment.notes });
}

async function upsertRows(client: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows);
  if (error) throw error;
}

export async function syncAppStateToSupabase(state: AppState, context: AuthPersistenceContext): Promise<{ mode: PersistenceMode; syncedTables: string[] }> {
  if (context.mode !== "supabase" || !context.client || !context.databaseUserId) {
    saveState(state);
    return { mode: "localStorage", syncedTables: [] };
  }

  const userId = context.databaseUserId;
  const syncedTables: string[] = [];
  await upsertRows(context.client, "workout_sessions", state.workoutSessions.map((session) => toWorkoutSessionRow(session, userId))); syncedTables.push("workout_sessions");
  await upsertRows(context.client, "set_logs", state.setLogs.map((log) => toSetLogRow(log, userId))); syncedTables.push("set_logs");
  await upsertRows(context.client, "meals", state.meals.map((meal) => toMealRow(meal, userId))); syncedTables.push("meals");
  await upsertRows(context.client, "meal_items", state.meals.flatMap((meal) => toMealItemRows(meal, userId))); syncedTables.push("meal_items");
  await upsertRows(context.client, "run_logs", state.runLogs.map((run) => toRunLogRow(run, userId))); syncedTables.push("run_logs");
  await upsertRows(context.client, "food_scan_logs", state.foodScans.map((scan) => toFoodScanRow(scan, userId))); syncedTables.push("food_scan_logs");
  await upsertRows(context.client, "coach_decision_logs", state.adjustments.map((adjustment) => toCoachDecisionRow(adjustment, userId))); syncedTables.push("coach_decision_logs");
  await upsertRows(context.client, "macro_target_history", state.macroTargets.map((target, index) => ({ id: target.id ?? `macro-target-${target.week ?? index}`, user_id: userId, week: target.week ?? index + 1, calories: target.calories, protein: target.protein, protein_max: target.proteinMax ?? null, carbs: target.carbs, fat: target.fat, fiber: target.fiber, water: target.water, source: "app_state" }))); syncedTables.push("macro_target_history");

  saveState(state);
  return { mode: "supabase", syncedTables };
}

export const supabaseCrud = {
  workoutSessions: { table: "workout_sessions", toRow: toWorkoutSessionRow },
  setLogs: { table: "set_logs", toRow: toSetLogRow },
  meals: { table: "meals", toRow: toMealRow, toItemRows: toMealItemRows },
  runLogs: { table: "run_logs", toRow: toRunLogRow },
  foodScans: { table: "food_scan_logs", toRow: toFoodScanRow },
  coachDecisionLogs: { table: "coach_decision_logs", toRow: toCoachDecisionRow },
} as const;

import type { AppState } from "./types";
import { createInitialState } from "./seed-data";

const key = "greek-god-coach:v1";

export function loadState(): AppState {
  if (typeof window === "undefined") return createInitialState();
  const raw = window.localStorage.getItem(key);
  if (!raw) return createInitialState();
  try {
    return { ...createInitialState(), ...JSON.parse(raw) } as AppState;
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(state));
}

export function resetState() {
  if (typeof window !== "undefined") window.localStorage.removeItem(key);
  return createInitialState();
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

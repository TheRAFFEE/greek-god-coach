import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePersistenceConfig } from "./coach-engine";

export type SupabasePersistenceConfig = ReturnType<typeof getSupabasePersistenceConfig>;

export function getBrowserSupabaseConfig(env: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}): SupabasePersistenceConfig {
  return getSupabasePersistenceConfig(env);
}

export function createBrowserSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const SUPABASE_STORAGE_BUCKETS = {
  progressPhotos: "progress-photos",
  foodScanImages: "food-scan-images",
  nutritionLabelImages: "nutrition-label-images",
} as const;

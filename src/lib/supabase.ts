import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim());
}

function ensureClient(): SupabaseClient {
  if (!client) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing Supabase env vars. Create site/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example)."
      );
    }
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

/** Lazily creates the client on first use so the app can render a config hint when env is missing. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const c = ensureClient();
    const value = Reflect.get(c, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(c) : value;
  }
});

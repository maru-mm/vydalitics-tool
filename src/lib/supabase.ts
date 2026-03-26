import { createClient, SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  __supabase?: SupabaseClient;
};

export function getSupabase(): SupabaseClient {
  if (globalForSupabase.__supabase) return globalForSupabase.__supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const missing = [
      !url && "SUPABASE_URL",
      !key && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean).join(", ");
    throw new Error(`Supabase env vars missing: ${missing}`);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForSupabase.__supabase = client;
  }

  return client;
}

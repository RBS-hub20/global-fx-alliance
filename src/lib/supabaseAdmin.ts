import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * Uses the service-role key, which bypasses row-level security — so this module
 * must never be imported into a client component. It is only reachable from the
 * `/api/ib/*` route handlers, which run on Node.
 *
 * The key is read from `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix, so
 * Next will not inline it into the browser bundle). The URL is public either way.
 */

export const TABLE = "verified_users";
export const PROOF_BUCKET = "verification-proofs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  return !!url && !!serviceKey;
}

/** Null when the project is not configured, so callers degrade instead of throwing. */
export function supabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  if (!client) {
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

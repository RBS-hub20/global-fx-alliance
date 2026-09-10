"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client.
 *
 * Anon key only — every read it can perform is bounded by row-level security,
 * so a member can reach their own profile row and nothing else. The service-role
 * key never comes near this file; it lives in `supabaseAdmin.ts`, which is only
 * imported by route handlers.
 *
 * `createBrowserClient` from @supabase/ssr keeps the session in a cookie as well
 * as localStorage, which is what lets a server route or middleware read it. The
 * plain `createClient` stores it in localStorage alone, where nothing on the
 * server can see it.
 */

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createBrowserClient(url, key);
  return client;
}

export type MemberStatus = "pending" | "approved" | "rejected" | "banned";

export interface Profile {
  id: string;
  email: string;
  account_number: string;
  server: string | null;
  broker: string;
  status: MemberStatus;
  created_at: string;
  /*
   * Optional because a project that has not run
   * supabase/profiles_add_name_columns.sql has no such columns, and rows
   * created before it have them null. Read them through @/lib/displayName,
   * which handles both cases.
   */
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  bio?: string | null;
  country?: string | null;
  trading_style?: string | null;
  updated_at?: string | null;
  note?: string | null;
  reviewed_at?: string | null;
}

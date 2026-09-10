import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "./supabaseServer";
import { supabaseAdmin } from "./supabaseAdmin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared preamble for every bot route: a real session, and a service-role
 * client to act with once ownership has been checked in code.
 *
 * The service key bypasses RLS, so every query made with `db` below must carry
 * its own `.eq("user_id", user.id)`. That is the trade for being able to write
 * columns the browser is not allowed to touch.
 */
export interface BotContext { user: User; db: SupabaseClient }

export async function botContext(): Promise<BotContext | NextResponse> {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });

  return { user, db };
}

/* ------------------------------------------------------------- rate limit */

/*
 * In-memory, per-instance. Enough to stop a stuck client hammering the bridge;
 * not a defence against a distributed attempt, because serverless instances do
 * not share this map. A real limiter belongs in the database or at the edge —
 * noted rather than pretended.
 */
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

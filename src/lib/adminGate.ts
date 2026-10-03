import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireUser } from "./supabaseServer";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Who may open /admin.
 *
 * This is a second, separate gate from `adminAuth.ts`, which checks a shared
 * secret in the `x-admin-token` header. That one is right for the review
 * endpoints — they are called from a panel where an operator pastes the token —
 * but wrong for a console someone opens in a browser: a shared token in a page
 * cannot be revoked per person, says nothing about *who* acted, and would end
 * up pasted into a client bundle or a URL. Here the identity is the signed-in
 * Supabase user, matched against an allow-list of addresses.
 *
 * Set it in Vercel:
 *
 *   GFXA_ADMIN_EMAILS=you@example.com,partner@example.com
 *
 * With the variable unset nobody is an admin, including the person who deployed
 * it. That is deliberate — an admin console that defaults to open is worse than
 * one that needs an environment variable — but it does mean a fresh deploy
 * answers /admin with a 404 until the list is set.
 */

export function adminEmails(): string[] {
  return (process.env.GFXA_ADMIN_EMAILS ?? "")
    .split(/[,\s;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function adminListConfigured(): boolean {
  return adminEmails().length > 0;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = adminEmails();
  // Empty list is "nobody", never "everybody".
  if (!list.length) return false;
  return list.includes(email.trim().toLowerCase());
}

export interface AdminContext {
  user: User;
  /** Service role: the console reads every member's rows by design. */
  db: SupabaseClient;
}

/**
 * For the page. Null means "do not acknowledge that this route exists" — the
 * caller answers with notFound() rather than a 403, so a signed-in member
 * poking at /admin learns nothing about who the admins are.
 */
export async function adminContext(): Promise<AdminContext | null> {
  const user = await requireUser();
  if (!user || !isAdminEmail(user.email)) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  return { user, db };
}

/** For the API routes. Same decision, expressed as a response. */
export async function adminApi(): Promise<AdminContext | NextResponse> {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ ok: false, message: "Not an admin." }, { status: 403 });
  }
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });
  }
  return { user, db };
}

/**
 * True when the error is "this table has not been created yet", which for a
 * console means "show an empty state and name the migration", not "502".
 */
export function tableMissing(message: string | undefined | null): boolean {
  return !!message && /relation .* does not exist|could not find the table|schema cache/i.test(message);
}

/** Start of the current day in the operator's timezone, as an ISO instant. */
export function startOfDay(timeZone = "Asia/Manila"): string {
  const now = new Date();
  // en-CA renders as YYYY-MM-DD, which Date can parse back with an offset.
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  // The offset for that zone, derived rather than hard-coded, so this survives
  // a timezone change and does not quietly drift by an hour under DST.
  const probe = new Date(`${local}T00:00:00Z`);
  const shown = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .format(probe)
    .match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? "+00:00";
  return new Date(`${local}T00:00:00${shown}`).toISOString();
}

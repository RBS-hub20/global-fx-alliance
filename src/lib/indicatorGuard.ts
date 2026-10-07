import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireUser } from "./supabaseServer";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Who may request an indicator invite.
 *
 * Two gates, both real rows rather than anything the browser asserts:
 *
 *   profiles.status = 'approved'            an admin let them in
 *   verified_users.status = 'verified'      a broker deposit was confirmed
 *
 * Stricter than the Academy, which needs only the first. That is what the brief
 * asked for and it is the right shape here: an Academy page costs us nothing to
 * show, while an invite-only script is a seat on TradingView that has to be
 * revoked by hand.
 *
 * The showcase itself is visible to any signed-in member — hiding the catalogue
 * from people who have not deposited removes the reason to deposit. What the
 * gate controls is the request button.
 */
export interface IndicatorContext {
  user: User;
  db: SupabaseClient;
  approved: boolean;
  depositVerified: boolean;
  eligible: boolean;
  /** Shown on the disabled button, so the member knows which gate is shut. */
  reason: string | null;
}

export async function indicatorContext(): Promise<IndicatorContext | NextResponse> {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });

  const [profile, deposit] = await Promise.all([
    db.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    // Matched on the address because verified_users predates profiles and is
    // keyed by email, not by auth id.
    db.from("verified_users").select("status")
      .eq("email", (user.email ?? "").trim().toLowerCase())
      .eq("status", "verified")
      .limit(1),
  ]);

  const approved = profile.data?.status === "approved";
  const depositVerified = (deposit.data ?? []).length > 0;
  const eligible = approved && depositVerified;

  const reason = eligible
    ? null
    : !approved
      ? "Your membership is still in review."
      : "Verify your broker deposit to unlock indicators.";

  return { user, db, approved, depositVerified, eligible, reason };
}

/** For the write route: turns an ineligible context into the 403. */
export function requireEligible(ctx: IndicatorContext): NextResponse | null {
  if (ctx.eligible) return null;
  return NextResponse.json({ ok: false, message: ctx.reason, eligible: false }, { status: 403 });
}

/** True when the migration has not been run, so the tab degrades quietly. */
export function notInstalled(message: string | undefined | null): boolean {
  return !!message && /relation .* does not exist|could not find the table|schema cache/i.test(message);
}

/**
 * TradingView handles are 2–25 characters of letters, digits and underscores. A
 * leading @ is accepted and stripped, since that is how people write them.
 */
export function cleanHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const h = raw.trim().replace(/^@+/, "");
  return /^[A-Za-z0-9_]{2,25}$/.test(h) ? h : null;
}

/** A year from approval. */
export const ACCESS_DAYS = 365;
export const expiryFrom = (from = new Date()): string =>
  new Date(from.getTime() + ACCESS_DAYS * 86400_000).toISOString();

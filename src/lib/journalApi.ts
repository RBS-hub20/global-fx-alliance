import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireUser } from "./supabaseServer";
import { supabaseAdmin } from "./supabaseAdmin";
import type { JournalTrade } from "./journalPro";

/** Shared gate for every journal route: a session, and a configured server. */
export async function journalContext(): Promise<{ user: User; db: SupabaseClient } | NextResponse> {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });
  return { user, db };
}

export function notInstalled(message: string | undefined | null): boolean {
  return !!message && /relation .* does not exist|could not find the table|schema cache/i.test(message);
}

export const needsMigration = NextResponse.json(
  { ok: true, installed: false, message: "Journal tables not installed — run supabase/20251011_journal.sql." },
  { status: 200, headers: { "Cache-Control": "no-store" } }
);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const text = (v: unknown, max = 2000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null => {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (allowed as readonly string[]).includes(t) ? (t as T) : null;
};

const OUTCOMES = ["win", "loss", "be"] as const;
const SESSIONS = ["asia", "london", "ny", "dubai"] as const;
const DIRECTIONS = ["buy", "sell"] as const;

/**
 * A trade row from whatever the client sent.
 *
 * Every field is coerced and bounded here rather than trusted. The free-text
 * tags are deliberately not restricted to a fixed list — a member who wants a
 * setup called "asian range fade" should be able to have one, and the analytics
 * group by whatever strings they use.
 */
export function toRow(body: Record<string, unknown>, userId: string) {
  return {
    user_id: userId,
    symbol: text(body.symbol, 24) ?? "XAU/USD",
    direction: oneOf(body.direction, DIRECTIONS) ?? "buy",
    entry_price: num(body.entryPrice),
    exit_price: num(body.exitPrice),
    size: num(body.size),
    risk_usd: num(body.riskUsd),
    risk_percent: num(body.riskPercent),
    rr: num(body.rr),
    outcome: oneOf(body.outcome, OUTCOMES),
    pnl: num(body.pnl),
    fees: num(body.fees) ?? 0,
    setup_type: text(body.setupType, 40),
    mistake_tag: text(body.mistakeTag, 40),
    emotion: text(body.emotion, 40),
    session: oneOf(body.session, SESSIONS),
    opened_at: text(body.openedAt, 40),
    closed_at: text(body.closedAt, 40),
    screenshot_url: text(body.screenshotUrl, 500),
    notes: text(body.notes, 4000),
  };
}

type Row = Record<string, unknown>;

/** Database row -> the shape the client and the analytics use. */
export function toTrade(r: Row): JournalTrade {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: String(r.id),
    symbol: String(r.symbol ?? "XAU/USD"),
    direction: r.direction === "sell" ? "sell" : "buy",
    entryPrice: n(r.entry_price),
    exitPrice: n(r.exit_price),
    size: n(r.size),
    riskUsd: n(r.risk_usd),
    riskPercent: n(r.risk_percent),
    rr: n(r.rr),
    outcome: (r.outcome as JournalTrade["outcome"]) ?? null,
    pnl: n(r.pnl),
    fees: n(r.fees),
    setupType: (r.setup_type as string) ?? null,
    mistakeTag: (r.mistake_tag as string) ?? null,
    emotion: (r.emotion as string) ?? null,
    session: (r.session as JournalTrade["session"]) ?? null,
    openedAt: (r.opened_at as string) ?? null,
    closedAt: (r.closed_at as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

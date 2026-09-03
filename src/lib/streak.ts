import { supabaseAdmin } from "./supabaseAdmin";
import { handleFor } from "./handle";

/**
 * Daily check-in streaks.
 *
 * Dates are handled in UTC throughout: "yesterday" has to mean the same thing
 * for a reader in Manila and one in London, or a streak breaks or double-counts
 * depending on where someone happens to be standing.
 */

export const STREAK_TABLE = "user_streaks";

const DAILY_REP = 10;
const WEEK_BONUS = 100;
const MONTH_BONUS = 500;

export interface StreakRow {
  email: string;
  current_streak: number;
  longest_streak: number;
  last_checkin: string | null;
  total_checkins: number;
  rep_earned: number;
}

export interface CheckInResult {
  ok: boolean;
  streak: number;
  longest: number;
  totalCheckins: number;
  rep: number;
  repEarned: number;
  isNewDay: boolean;
  message: string;
  error?: string;
}

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** Whole days between two YYYY-MM-DD strings. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / 86400_000);
}

function bonusFor(streak: number): number {
  return DAILY_REP + (streak % 30 === 0 ? MONTH_BONUS : 0) + (streak % 7 === 0 ? WEEK_BONUS : 0);
}

export async function getStreak(email: string): Promise<StreakRow | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from(STREAK_TABLE)
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return error ? null : (data as StreakRow | null);
}

export async function checkIn(email: string): Promise<CheckInResult> {
  const db = supabaseAdmin();
  const addr = email.trim().toLowerCase();
  const empty: CheckInResult = {
    ok: false, streak: 0, longest: 0, totalCheckins: 0, rep: 0, repEarned: 0,
    isNewDay: false, message: "Check-in is unavailable right now.",
  };
  if (!db) return { ...empty, error: "Supabase is not configured." };

  const today = utcDay();
  const existing = await getStreak(addr);

  if (!existing) {
    const row = {
      email: addr,
      current_streak: 1,
      longest_streak: 1,
      last_checkin: today,
      total_checkins: 1,
      rep_earned: DAILY_REP,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from(STREAK_TABLE).insert(row);
    if (error) return { ...empty, error: error.message };
    return {
      ok: true, streak: 1, longest: 1, totalCheckins: 1,
      rep: DAILY_REP, repEarned: DAILY_REP, isNewDay: true,
      message: "First check-in — day 1.",
    };
  }

  const gap = existing.last_checkin ? daysBetween(existing.last_checkin, today) : Number.NaN;

  if (gap === 0) {
    return {
      ok: true,
      streak: existing.current_streak,
      longest: existing.longest_streak,
      totalCheckins: existing.total_checkins,
      rep: existing.rep_earned,
      repEarned: 0,
      isNewDay: false,
      message: "Already checked in today.",
    };
  }

  // A gap of exactly one day continues the run; anything longer — or a missing
  // or malformed date — starts a fresh one rather than silently extending it.
  const continued = gap === 1;
  const streak = continued ? existing.current_streak + 1 : 1;
  const earned = bonusFor(streak);
  const longest = Math.max(existing.longest_streak, streak);

  const { error } = await db
    .from(STREAK_TABLE)
    .update({
      current_streak: streak,
      longest_streak: longest,
      last_checkin: today,
      total_checkins: existing.total_checkins + 1,
      rep_earned: existing.rep_earned + earned,
      updated_at: new Date().toISOString(),
    })
    .eq("email", addr);

  if (error) return { ...empty, error: error.message };

  const milestone =
    streak % 30 === 0 ? ` 30-day milestone — +${MONTH_BONUS} rep.`
    : streak % 7 === 0 ? ` 7-day milestone — +${WEEK_BONUS} rep.`
    : "";

  return {
    ok: true,
    streak,
    longest,
    totalCheckins: existing.total_checkins + 1,
    rep: existing.rep_earned + earned,
    repEarned: earned,
    isNewDay: true,
    message: continued ? `Day ${streak}.${milestone}` : `Streak reset — day 1. Longest was ${longest}.`,
  };
}

export interface LeaderRow {
  handle: string;
  currentStreak: number;
  longestStreak: number;
  rep: number;
  totalCheckins: number;
  checkedInToday: boolean;
}

export type LeaderSort = "current_streak" | "rep_earned" | "longest_streak";

/** Public board — handles only, never the addresses they were derived from. */
export async function getLeaderboard(limit = 10, sort: LeaderSort = "current_streak"): Promise<LeaderRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from(STREAK_TABLE)
    .select("email,current_streak,longest_streak,rep_earned,total_checkins,last_checkin")
    .order(sort, { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error || !data) return [];
  const today = utcDay();
  return (data as StreakRow[]).map((r) => ({
    handle: handleFor(r.email),
    currentStreak: r.current_streak,
    longestStreak: r.longest_streak,
    rep: r.rep_earned,
    totalCheckins: r.total_checkins,
    checkedInToday: r.last_checkin === today,
  }));
}

/**
 * How many members checked in today.
 *
 * A real count of a real thing. The brief asked to pad it with "random 5-15 for
 * demo if count low" — an invented presence number is the one figure on a
 * community page nobody can sanity-check, so it is reported as it is and the UI
 * says "quiet" when it is quiet.
 */
export async function activeToday(): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;
  const { count, error } = await db
    .from(STREAK_TABLE)
    .select("email", { count: "exact", head: true })
    .eq("last_checkin", utcDay());
  return error ? 0 : count ?? 0;
}

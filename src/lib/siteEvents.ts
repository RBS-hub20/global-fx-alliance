import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * First-party counting for the funnel pages.
 *
 * The Meta Pixel already fires PageView and Lead, but Meta's numbers live in
 * Events Manager and cannot be read back out without the Insights API — so a
 * console that claimed to show "visitors now" from the pixel would be showing
 * nothing. These rows are the console's own source, written by
 * /api/events/track, and they are the only traffic numbers in /admin that are
 * real.
 *
 * What is kept is in supabase/20251003_admin_monitoring.sql: page, campaign,
 * country, device class, and a daily-rotating visitor hash. No IP address, no
 * user-agent string, no full referrer, no query string.
 */

export const TRACKED_EVENTS = ["page_view", "lead"] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

/**
 * The public funnel only.
 *
 * `/dashboard` is deliberately not here. A signed-in member's navigation is not
 * marketing data, and writing a row per dashboard tab change would turn this
 * table into a behaviour log of named people. An unrecognised path is dropped
 * rather than stored, which also keeps the table from being filled with junk by
 * anyone who finds the endpoint.
 */
const PATH_OK = /^\/(?:|join|links|l\/[a-z0-9-]{1,40})$/;

export function allowedPath(path: string | undefined): string | null {
  if (!path) return null;
  // Query and hash are discarded before the check, so ?utm_… cannot smuggle
  // anything into the stored value.
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return PATH_OK.test(clean) ? clean : null;
}

/** Coarse enough to be useful, coarse enough not to be a fingerprint. */
export function deviceFrom(ua: string): "mobile" | "tablet" | "desktop" {
  if (/\b(ipad|tablet|playbook|silk)\b/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * sha256(ip + ua + salt + today) truncated to 16 hex characters.
 *
 * The date is inside the hash on purpose: it makes same-day repeat visits
 * countable as one visitor and makes the value useless as an identifier
 * tomorrow. The salt stops anyone who knows an address from confirming whether
 * it visited — it falls back to the service-role key, which is already secret
 * and present wherever this runs, so there is no extra variable to forget.
 */
export function visitorHash(ip: string, ua: string, day = new Date().toISOString().slice(0, 10)): string {
  const salt = process.env.GFXA_EVENT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "unsalted";
  return createHash("sha256").update(`${ip}|${ua}|${salt}|${day}`).digest("hex").slice(0, 16);
}

/** Host only. A full referrer can carry someone else's query string. */
export function referrerHost(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "").slice(0, 80) || null;
  } catch {
    return null;
  }
}

export const clip = (v: unknown, max = 120): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

/*
 * Per-instance throttle.
 *
 * Honest about what this is: Vercel runs many instances, so a determined
 * flooder spreads across them and this stops very little. It is here to catch
 * the realistic case — a loop in a page, or a crawler re-firing the beacon —
 * not to be a rate limiter. The real protection is that the table is tiny per
 * row, the path allow-list is closed, and prune_site_events() exists.
 */
const seen = new Map<string, { n: number; until: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

export function throttled(key: string): boolean {
  const now = Date.now();
  const hit = seen.get(key);
  if (!hit || hit.until < now) {
    seen.set(key, { n: 1, until: now + WINDOW_MS });
    // Array.from, not for..of over the Map: this project compiles without
    // downlevelIteration.
    if (seen.size > 5000) Array.from(seen.keys()).forEach((k) => { if ((seen.get(k)?.until ?? 0) < now) seen.delete(k); });
    return false;
  }
  hit.n += 1;
  return hit.n > MAX_PER_WINDOW;
}

export interface EventRow {
  event: TrackedEvent;
  path: string;
  visitor: string;
  country: string | null;
  device: "mobile" | "tablet" | "desktop";
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  start_param: string | null;
}

/** False when the table is absent or Supabase is unset; never throws. */
export async function writeEvent(row: EventRow): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;
  const { error } = await db.from("site_events").insert(row);
  return !error;
}

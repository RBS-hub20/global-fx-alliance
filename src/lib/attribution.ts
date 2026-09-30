"use client";

/**
 * Ad attribution for the Telegram funnel.
 *
 * A visitor arrives from Meta with UTMs on the URL, reads for a while, maybe
 * navigates, then taps through to the bot. The parameters are captured on
 * arrival and kept for 30 days, so the click still carries them later.
 *
 * The bot sees them through the deep link's `start` payload, which Telegram
 * restricts to A-Za-z0-9_- and 64 characters — a campaign called "Gold Ideas"
 * would break the link, so everything is sanitised rather than interpolated raw.
 */

const KEY = "gfxa-attribution";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

export type Attribution = Partial<Record<(typeof FIELDS)[number], string>> & { at?: number };

/** Telegram's payload alphabet. Empty segments disappear rather than doubling the separator. */
export function sanitiseSegment(value: string | undefined | null): string {
  if (!value) return "";
  return value.trim().replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/** `join_page_Gold_Ideas_Video1`, capped at Telegram's 64 characters. */
export function buildStartParam(base: string, attribution: Attribution): string {
  const parts = [sanitiseSegment(base), sanitiseSegment(attribution.utm_campaign), sanitiseSegment(attribution.utm_content)]
    .filter(Boolean);
  return parts.join("_").slice(0, 64).replace(/_$/, "");
}

export function telegramLink(botUrl: string, base: string, attribution: Attribution): string {
  return `${botUrl}?start=${encodeURIComponent(buildStartParam(base, attribution))}`;
}

/** Reads the current URL, merges over anything stored, and persists for 30 days. */
export function captureAttribution(search: string): Attribution {
  const params = new URLSearchParams(search);
  const fresh: Attribution = {};
  for (const f of FIELDS) {
    const v = params.get(f);
    if (v) fresh[f] = v;
  }

  let stored: Attribution = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Attribution;
      // Older than the window: treat as absent rather than crediting a campaign
      // the visitor saw last month.
      if (parsed.at && Date.now() - parsed.at < TTL_MS) stored = parsed;
    }
  } catch { /* private mode, or someone edited the value */ }

  if (!Object.keys(fresh).length) return stored;

  const merged: Attribution = { ...stored, ...fresh, at: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* private mode */ }
  return merged;
}

export function readAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  return captureAttribution(window.location.search);
}

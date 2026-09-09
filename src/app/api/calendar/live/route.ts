import { NextResponse } from "next/server";
import { CALENDAR } from "@/lib/data";

export const runtime = "edge";

/**
 * The economic calendar for the current week.
 *
 * Source is ForexFactory's public weekly JSON — keyless, dated, and covering
 * Monday to Sunday, which is what makes "This Week" and multi-day countdowns
 * real rather than decorative.
 *
 * **The feed carries no `actual`.** Not one of its entries has ever populated
 * that field, so `actual` is always null here and a passed event means only
 * that its scheduled time has gone by — not that a figure printed, and
 * certainly not what the figure was. Anything else would be inventing data at
 * the exact point a reader is deciding whether the number surprised the market.
 *
 * On upstream failure it falls back to the curated schedule in lib/data, marked
 * `curated` in the response so no caller mistakes one for the other.
 */

const FEED = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const FRESH_MS = 10 * 60_000;

const FLAG: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CAD: "🇨🇦",
  AUD: "🇦🇺", NZD: "🇳🇿", CHF: "🇨🇭", CNY: "🇨🇳", All: "🌐",
};

type Impact = "High" | "Medium" | "Low";

interface Row {
  id: string;
  /** UTC wall clock, HH:MM. */
  time: string;
  /** UTC calendar day, YYYY-MM-DD. */
  date: string;
  timestamp: string;
  currency: string;
  flag: string;
  title: string;
  impact: Impact;
  actual: string | null;
  forecast: string;
  previous: string;
  released: boolean;
  detail?: string;
  affects?: string;
}

interface FeedItem {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A bank holiday is not a release, but it does move a session. */
function normaliseImpact(raw: string | undefined): Impact {
  const v = (raw ?? "").toLowerCase();
  if (v === "high") return "High";
  if (v === "medium") return "Medium";
  return "Low";
}

let cache: { at: number; rows: Row[] } | null = null;

async function fetchFeed(): Promise<Row[] | null> {
  try {
    const res = await fetch(FEED, { cache: "no-store" });
    if (!res.ok) return null;
    const raw = (await res.json()) as FeedItem[];
    if (!Array.isArray(raw) || !raw.length) return null;

    const now = Date.now();
    const rows: Row[] = [];

    for (const item of raw) {
      // The feed stamps an offset (-04:00), so Date parses it to the right
      // instant and every field below is derived in UTC from there.
      const ms = Date.parse(item.date ?? "");
      if (!Number.isFinite(ms) || !item.title) continue;
      const d = new Date(ms);
      const currency = (item.country ?? "All").toUpperCase();

      rows.push({
        id: `${d.toISOString()}-${currency}-${item.title}`.replace(/\s+/g, "_"),
        time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
        date: d.toISOString().slice(0, 10),
        timestamp: d.toISOString(),
        currency,
        flag: FLAG[currency] ?? FLAG[item.country ?? ""] ?? "🌐",
        title: item.title,
        impact: normaliseImpact(item.impact),
        // Always null: see the note at the top of this file.
        actual: null,
        forecast: item.forecast ?? "",
        previous: item.previous ?? "",
        released: ms <= now,
      });
    }

    rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

/** The curated set, dated onto today so the shape matches the live rows. */
function curatedRows(): Row[] {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minutesNow = now.getUTCHours() * 60 + now.getUTCMinutes();

  return CALENDAR.map((e) => {
    const [h, m] = e.time.split(":").map(Number);
    const released = h * 60 + m <= minutesNow;
    return {
      id: e.id,
      time: e.time,
      date: day,
      timestamp: new Date(`${day}T${e.time}:00Z`).toISOString(),
      currency: e.currency,
      flag: e.flag,
      title: e.title,
      impact: e.impact,
      // The curated set does carry hand-written figures; they only appear once
      // the scheduled time has passed, and the response says they are curated.
      actual: released ? e.actual || null : null,
      forecast: e.forecast,
      previous: e.previous,
      released,
      detail: e.detail,
      affects: e.affects,
    };
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const currency = (params.get("currency") ?? "all").toUpperCase();
  const importance = (params.get("importance") ?? "all").toLowerCase();

  let rows: Row[] | null = null;
  let source: "forexfactory" | "cache" | "curated" = "forexfactory";

  if (cache && Date.now() - cache.at < FRESH_MS) {
    rows = cache.rows;
    source = "cache";
  } else {
    rows = await fetchFeed();
    if (rows) cache = { at: Date.now(), rows };
    else if (cache) { rows = cache.rows; source = "cache"; }
  }

  if (!rows) { rows = curatedRows(); source = "curated"; }

  let events = rows;
  if (currency !== "ALL") events = events.filter((e) => e.currency === currency);
  if (importance !== "all") events = events.filter((e) => e.impact.toLowerCase() === importance);

  const today = new Date().toISOString().slice(0, 10);

  return NextResponse.json(
    {
      events,
      count: events.length,
      today,
      timezone: "UTC",
      highImpact: events.filter((e) => e.impact === "High").length,
      pending: events.filter((e) => !e.released).length,
      source,
      isLive: source !== "curated",
      /** Stated plainly so no client renders a figure this feed cannot supply. */
      actualsAvailable: source === "curated",
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } }
  );
}

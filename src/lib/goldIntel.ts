/**
 * Numbers behind the Gold Intelligence tab. Pure: no fetching, no clock except
 * through `now` arguments.
 */

import type { BiasRead } from "./biasModel";

export interface Bar { time: number; close: number }

/* ---------------------------------------------------------------- sampling */

/** Evenly spaced sample, oldest first — same rule as the dashboard ticker. */
export function sample(values: number[], points = 40): number[] {
  if (values.length <= points) return values;
  const step = values.length / points;
  return Array.from({ length: points }, (_, i) => values[Math.floor(i * step)]);
}

/** Change across the last `n` bars, so a percentage and its sparkline agree. */
export function changeOver(closes: number[], n: number): { change: number; pct: number } {
  if (closes.length < 2) return { change: 0, pct: 0 };
  const last = closes[closes.length - 1];
  const first = closes[Math.max(0, closes.length - 1 - n)];
  const change = last - first;
  return { change, pct: first ? (change / first) * 100 : 0 };
}

/* --------------------------------------------------------------- crosses */

/**
 * XAU/EUR from XAU/USD ÷ EUR/USD, bar by bar.
 *
 * Each gold bar is divided by the FX close at or before its own time, never a
 * later one — using the latest FX price for every historical bar would draw a
 * sparkline that is really just gold's shape with a fixed scale.
 */
export function crossSeries(gold: Bar[], fx: Bar[]): Bar[] {
  const f = [...fx].sort((a, b) => a.time - b.time);
  const out: Bar[] = [];
  let j = 0;
  for (const g of [...gold].sort((a, b) => a.time - b.time)) {
    while (j + 1 < f.length && f[j + 1].time <= g.time) j++;
    if (!f.length || f[j].time > g.time || !f[j].close) continue;
    out.push({ time: g.time, close: g.close / f[j].close });
  }
  return out;
}

/* ----------------------------------------------------------- correlation */

const dayKey = (t: number) => new Date((t > 1e12 ? t : t * 1000)).toISOString().slice(0, 10);

/** Daily percentage returns keyed by UTC date. */
export function dailyReturns(bars: Bar[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const b of [...bars].sort((a, c) => a.time - c.time)) byDay.set(dayKey(b.time), b.close);
  const days = Array.from(byDay.keys()).sort();
  const out = new Map<string, number>();
  for (let i = 1; i < days.length; i++) {
    const prev = byDay.get(days[i - 1])!, cur = byDay.get(days[i])!;
    if (prev) out.set(days[i], (cur - prev) / prev);
  }
  return out;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] ** 2; syy += ys[i] ** 2; sxy += xs[i] * ys[i]; }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n, vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return null;
  return cov / Math.sqrt(vx * vy);
}

/**
 * Correlation of daily returns over the last `window` shared trading days.
 *
 * Returns, not prices: two series that both trended up for a year show a price
 * correlation near 1 whether or not they have anything to do with each other.
 * Only dates both markets traded count — BTC trades weekends, Treasuries do not.
 */
export function returnCorrelation(a: Bar[], b: Bar[], window = 60): { r: number | null; n: number } {
  const ra = dailyReturns(a), rb = dailyReturns(b);
  const shared = Array.from(ra.keys()).filter((d) => rb.has(d)).sort().slice(-window);
  return { r: pearson(shared.map((d) => ra.get(d)!), shared.map((d) => rb.get(d)!)), n: shared.length };
}

/* ------------------------------------------------------------- seasonals */

export interface SeasonalCurve { year: number; points: { doy: number; pct: number }[]; ytd: number }

const doyOf = (d: Date) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;

/** Each year rebased to its first close: % change from 1 Jan, by day of year. */
export function seasonalCurves(bars: Bar[], years: number[]): SeasonalCurve[] {
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  return years.map((year) => {
    const inYear = sorted.filter((b) => new Date(b.time > 1e12 ? b.time : b.time * 1000).getUTCFullYear() === year);
    if (!inYear.length) return { year, points: [], ytd: 0 };
    const base = inYear[0].close;
    const points = inYear.map((b) => ({
      doy: doyOf(new Date(b.time > 1e12 ? b.time : b.time * 1000)),
      pct: ((b.close - base) / base) * 100,
    }));
    return { year, points, ytd: points[points.length - 1].pct };
  });
}

/* ------------------------------------------------------------------ gauge */

export type Zone = "Strong sell" | "Sell" | "Neutral" | "Buy" | "Strong buy";

/**
 * Needle position, −1 (strong sell) to +1 (strong buy), from the same
 * GFXA-Structure read the Market Analysis bias card shows. One model, two
 * displays — the gauge cannot disagree with the card.
 *
 * The share runs 50–95 (the model shrinks toward 50 and caps at 95), so that
 * range is what maps onto the half-dial.
 */
export function gaugeValue(read: Pick<BiasRead, "side" | "share" | "thin">): number {
  if (read.thin || read.side === "neutral") return 0;
  const magnitude = Math.max(0, Math.min(1, (read.share - 50) / 45));
  return read.side === "bullish" ? magnitude : -magnitude;
}

export function zoneFor(v: number): Zone {
  if (v <= -0.6) return "Strong sell";
  if (v <= -0.2) return "Sell";
  if (v < 0.2) return "Neutral";
  if (v < 0.6) return "Buy";
  return "Strong buy";
}

/* -------------------------------------------------------------- catalysts */

export interface CalendarEvent {
  id?: string; title: string; currency: string; impact: string;
  timestamp: string | null; time?: string; forecast?: string | null; previous?: string | null; released?: boolean;
}

export type ImpactLevel = "HIGH" | "MEDIUM" | "LOW";
export const impactOf = (s: string): ImpactLevel => (/high/i.test(s) ? "HIGH" : /med/i.test(s) ? "MEDIUM" : "LOW");

/**
 * What on the calendar moves gold: US releases of medium or high impact, and
 * central-bank speeches anywhere that set the global rate path (Fed, ECB).
 * Everything else — an AUD job-ads print, a Swiss trade balance — is noise
 * for XAU/USD and is left out.
 */
export function isGoldCatalyst(e: CalendarEvent): boolean {
  const impact = impactOf(e.impact);
  if (impact === "LOW") return false;
  if (e.currency === "USD") return true;
  return /\b(fomc|fed|powell|ecb|lagarde|monetary policy|rate decision|main refinancing)\b/i.test(e.title);
}

/** Upcoming gold catalysts, soonest first. Keeps anything released in the last 5 minutes as "just out". */
export function upcomingCatalysts(events: CalendarEvent[], now: Date, limit = 6): CalendarEvent[] {
  const floor = now.getTime() - 5 * 60_000;
  return events
    .filter((e) => e.timestamp && isGoldCatalyst(e) && Date.parse(e.timestamp) >= floor)
    .sort((a, b) => Date.parse(a.timestamp!) - Date.parse(b.timestamp!))
    .slice(0, limit);
}

export interface NewsWindow { active: boolean; event: CalendarEvent | null; minutes: number | null }

/**
 * A high-impact gold catalyst within the next 30 minutes, or out within the
 * last 15. This is the page's own read of the calendar — it is shown beside,
 * not written into, the engine's news_block, which only the bridge sets.
 */
export function newsWindow(events: CalendarEvent[], now: Date, aheadMin = 30, afterMin = 15): NewsWindow {
  const t = now.getTime();
  const hit = events
    .filter((e) => e.timestamp && isGoldCatalyst(e) && impactOf(e.impact) === "HIGH")
    .map((e) => ({ e, dt: (Date.parse(e.timestamp!) - t) / 60_000 }))
    .filter(({ dt }) => dt <= aheadMin && dt >= -afterMin)
    .sort((a, b) => Math.abs(a.dt) - Math.abs(b.dt))[0];
  return hit ? { active: true, event: hit.e, minutes: Math.round(hit.dt) } : { active: false, event: null, minutes: null };
}

export function countdownLabel(timestamp: string, now: Date): string {
  const mins = Math.round((Date.parse(timestamp) - now.getTime()) / 60_000);
  if (mins <= 0 && mins >= -5) return "LIVE";
  if (mins < 0) return "out";
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return `in ${h}h ${String(m).padStart(2, "0")}m`;
  return `in ${Math.floor(h / 24)}d ${h % 24}h`;
}

/* ------------------------------------------------------------------- COT */

export interface CotRow {
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: string;
  comm_positions_long_all: string; comm_positions_short_all: string;
  noncomm_positions_long_all: string; noncomm_positions_short_all: string;
}

export interface CotRead {
  date: string;
  commercialNet: number; commercialPct: number;
  specNet: number; specPct: number;
  /** Week-on-week change in the speculative net, in contracts. */
  specChange: number | null;
}

/** Net positions as a share of open interest, from the CFTC legacy report. */
export function readCot(rows: CotRow[]): CotRead | null {
  const [cur, prev] = [...rows].sort((a, b) => b.report_date_as_yyyy_mm_dd.localeCompare(a.report_date_as_yyyy_mm_dd));
  if (!cur) return null;
  const n = (s: string) => Number(s) || 0;
  const oi = n(cur.open_interest_all);
  if (!oi) return null;
  const comm = n(cur.comm_positions_long_all) - n(cur.comm_positions_short_all);
  const spec = n(cur.noncomm_positions_long_all) - n(cur.noncomm_positions_short_all);
  const prevSpec = prev ? n(prev.noncomm_positions_long_all) - n(prev.noncomm_positions_short_all) : null;
  return {
    date: cur.report_date_as_yyyy_mm_dd.slice(0, 10),
    commercialNet: comm, commercialPct: (comm / oi) * 100,
    specNet: spec, specPct: (spec / oi) * 100,
    specChange: prevSpec === null ? null : spec - prevSpec,
  };
}

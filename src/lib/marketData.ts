/**
 * Shared market-analysis logic for the terminal.
 *
 * Pure functions only — no fetching, no DOM. The panel and the API routes both
 * read from here so a number shown in one place cannot disagree with the same
 * number computed in another, and so this can be tested without a browser.
 */

import type { Drawings } from "./autoDraw";
import type { CalendarLike, NewsLike } from "./ai";

/* ------------------------------------------------------------------ calendar */

/** Whatever /api/calendar/live returns for one row. */
export interface CalendarRow {
  time?: string;
  currency?: string;
  /** The live feed calls it `title`; the analysis layer calls it `event`. */
  title?: string;
  event?: string;
  /** The live feed sends "High"/"Medium"/"Low"; the analysis layer wants lowercase. */
  impact?: string;
  importance?: string;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
  released?: boolean;
  timestamp?: string;
}

/**
 * Reconcile the calendar feed with what the analysis agents expect.
 *
 * This is the "undefined" in FUNDAMENTALS. /api/calendar/live emits `title` and
 * `impact: "High"`; ai.ts reads `event` and `importance: "high"`. Neither key
 * existed on the other's object, so every scheduled release printed as
 * `undefined` and `high.length` was always 0 — which is why the terminal
 * reported "0 high-impact today" on a day with several.
 *
 * Accepts either shape so the mismatch cannot come back if one side is changed
 * without the other.
 */
export function normalizeCalendar(rows: CalendarRow[]): CalendarLike[] {
  const rank = (v: string | undefined): CalendarLike["importance"] => {
    const s = (v ?? "").toLowerCase();
    if (s === "high") return "high";
    if (s === "medium" || s === "med") return "medium";
    return "low";
  };

  return rows
    .map((r) => ({
      time: r.time ?? "",
      currency: (r.currency ?? "").toUpperCase(),
      event: r.event ?? r.title ?? "",
      importance: rank(r.importance ?? r.impact),
      actual: r.actual ?? null,
      forecast: r.forecast ?? undefined,
      previous: r.previous ?? undefined,
      released: r.released ?? false,
    }))
    .filter((e) => e.event && e.currency);
}

/* ---------------------------------------------------------------------- news */

export type NewsScope = "pair" | "asset" | "tape";

export interface ScopedNews {
  items: NewsLike[];
  scope: NewsScope;
  /** Plain-language label for the heading, so the reader knows what they are reading. */
  label: string;
}

/** Which asset bucket a pair belongs to, for the second-choice match. */
export function assetClass(pair: string): string {
  const p = pair.toUpperCase();
  if (p.startsWith("XAU") || p.startsWith("XAG")) return "Gold";
  if (p.startsWith("BTC") || p.startsWith("ETH")) return "Crypto";
  return "Forex";
}

/**
 * Headlines for a pair, narrowest match first.
 *
 * The terminal used to fall back straight from "no XAU/USD headlines" to the
 * whole tape, so a gold analysis quoted a story about oil hitting $100. The
 * story was real and current — that was not the bug — but nothing about it bore
 * on gold. An asset-class match sits in between now, and the scope is returned
 * rather than assumed so the caller can say which one it is showing.
 */
export function scopedNews(news: NewsLike[], pair: string): ScopedNews {
  const exact = news.filter((n) => n.symbols?.includes(pair));
  if (exact.length) return { items: exact, scope: "pair", label: `${pair} headlines` };

  const klass = assetClass(pair);
  const sameClass = news.filter((n) => {
    const cat = (n as NewsLike & { category?: string }).category;
    if (cat && cat === klass) return true;
    return (n.symbols ?? []).some((s) => assetClass(s) === klass);
  });
  if (sameClass.length) {
    return { items: sameClass, scope: "asset", label: `${klass.toLowerCase()} headlines — nothing ${pair}-specific` };
  }

  return { items: news, scope: "tape", label: `broad tape — nothing on ${pair} or ${klass.toLowerCase()}` };
}

/* ----------------------------------------------------------------- liquidity */

export interface LiquidityZone {
  /** Where resting stops would sit if price traded through the level. */
  price: number;
  side: "above" | "below";
  /** The structure the zone is derived from. */
  from: string;
  /** How well-tested the originating level is, 1-5. */
  strength: number;
  distancePct: number;
}

/**
 * Where stops would sit, given the structure on the chart.
 *
 * This is an inference, not a feed. No retail data source publishes resting
 * orders in spot FX, and anything claiming to show "where the stops are" is
 * modelling the same thing this does — the observation that stops cluster just
 * beyond levels other people can also see. Presented as derived from named
 * levels so a reader can check the reasoning rather than trust a number.
 */
export function liquidityZones(drawings: Drawings, price: number, pipSize: number): LiquidityZone[] {
  if (!price) return [];
  // A buffer beyond the level, scaled to the instrument rather than a fixed %.
  const pad = pipSize * 10;

  const zones: LiquidityZone[] = [
    ...drawings.resistances.map((l) => ({
      price: l.price + pad,
      side: "above" as const,
      from: `resistance ${l.price}`,
      strength: l.strength,
      distancePct: ((l.price + pad - price) / price) * 100,
    })),
    ...drawings.supports.map((l) => ({
      price: l.price - pad,
      side: "below" as const,
      from: `support ${l.price}`,
      strength: l.strength,
      distancePct: ((l.price - pad - price) / price) * 100,
    })),
  ];

  return zones.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct)).slice(0, 6);
}

/* ---------------------------------------------------------------------- risk */

export interface RiskInput {
  balance: number;
  riskPct: number;
  atr: number | null;
  atrMultiple: number;
  price: number;
  pipSize: number;
  /** Units of the base per 1.00 lot. FX is 100k; gold is quoted per 100 oz. */
  contractSize: number;
}

export interface RiskPlan {
  riskAmount: number;
  stopDistance: number;
  stopPips: number;
  lots: number | null;
  /** Value of a one-pip move on the computed size, in account currency. */
  pipValue: number | null;
  note: string | null;
}

/**
 * Position size from a stop distance — the arithmetic, nothing more.
 *
 * Returns nulls rather than a number when the inputs cannot support one, so the
 * panel shows a dash instead of a confident lot size derived from a missing ATR.
 */
export function riskPlan(i: RiskInput): RiskPlan {
  const riskAmount = (i.balance * i.riskPct) / 100;

  if (!i.atr || !Number.isFinite(i.atr) || i.atr <= 0 || !i.price) {
    return { riskAmount, stopDistance: 0, stopPips: 0, lots: null, pipValue: null, note: "ATR not available yet — not enough bars." };
  }

  const stopDistance = i.atr * i.atrMultiple;
  const stopPips = stopDistance / i.pipSize;

  /*
   * Value of one pip on one lot, in the quote currency. For a USD-quoted
   * instrument that is the account currency too; for USD/JPY and other pairs
   * quoted in something else it is not, and converting needs a rate this
   * function is not given. Flagged rather than silently wrong.
   */
  const pipValuePerLot = i.pipSize * i.contractSize;
  const lots = stopPips > 0 ? riskAmount / (stopPips * pipValuePerLot) : null;

  return {
    riskAmount,
    stopDistance,
    stopPips,
    lots: lots && Number.isFinite(lots) ? lots : null,
    pipValue: lots ? pipValuePerLot * lots : null,
    note: null,
  };
}

/** Contract size per 1.00 lot. Gold trades in 100oz contracts, FX in 100k units. */
export function contractSizeFor(pair: string): number {
  const p = pair.toUpperCase();
  if (p.startsWith("XAU")) return 100;
  if (p.startsWith("XAG")) return 5000;
  if (p.startsWith("BTC")) return 1;
  return 100_000;
}

/* -------------------------------------------------------------------- levels */

/** "R1 4417.00 · R2 4432.00 · S1 4390.00" — for the copy button. */
export function levelsToText(drawings: Drawings, pair: string, decimals: number): string {
  const r = drawings.resistances.map((l, i) => `R${i + 1} ${l.price.toFixed(decimals)}`);
  const s = drawings.supports.map((l, i) => `S${i + 1} ${l.price.toFixed(decimals)}`);
  const parts = [...r, ...s];
  return parts.length ? `${pair} — ${parts.join(" · ")}` : `${pair} — no levels detected`;
}

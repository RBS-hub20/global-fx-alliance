import type { Candle } from "./indicators";
import { getCandidates } from "./yahooSymbols";

/**
 * Real historical OHLC from Yahoo Finance's public chart endpoint.
 *
 * No key, no quota registration. Runs server-side (Edge) so there is no CORS
 * issue and the browser never talks to Yahoo directly.
 *
 * Every failure mode returns `null` rather than throwing, so the caller can fall
 * back to modelled candles and the dashboard never breaks because a free
 * upstream rate-limited.
 */

const TIMEOUT_MS = 5000;
/** Cap the payload; indicators need a few hundred bars at most. */
const MAX_BARS = 400;

export interface RealOhlcResult {
  ohlc: Candle[];
  source: "yahoo";
  symbolUsed: string;
  /** Yahoo's own last trade price, independent of the final bar. */
  marketPrice: number | null;
  previousClose: number | null;
  currency: string | null;
  /** FX is OTC and reports no volume; the chart hides the histogram when false. */
  hasVolume: boolean;
}

interface YahooQuote {
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  close?: (number | null)[];
  volume?: (number | null)[];
}

interface YahooResult {
  meta?: { symbol?: string; regularMarketPrice?: number; chartPreviousClose?: number; currency?: string };
  timestamp?: number[];
  indicators?: { quote?: YahooQuote[] };
}

/** Parses one Yahoo chart payload into clean candles. Exported for testing. */
export function parseYahoo(json: unknown): Omit<RealOhlcResult, "source" | "symbolUsed"> & { ohlc: Candle[] } | null {
  const chart = (json as { chart?: { result?: YahooResult[]; error?: unknown } })?.chart;
  if (!chart || chart.error) return null;

  const result = chart.result?.[0];
  const ts = result?.timestamp;
  const q = result?.indicators?.quote?.[0];
  if (!Array.isArray(ts) || !ts.length || !q) return null;

  const ohlc: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    // Yahoo pads gaps with nulls; a bar missing any leg is unusable.
    if (
      typeof o !== "number" || typeof h !== "number" ||
      typeof l !== "number" || typeof c !== "number" ||
      !Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)
    ) continue;

    const v = q.volume?.[i];
    ohlc.push({
      time: ts[i],
      open: o,
      // Repair inverted extremes rather than dropping the bar — the chart
      // library rejects a candle whose high is below its body.
      high: Math.max(h, o, c),
      low: Math.min(l, o, c),
      close: c,
      volume: typeof v === "number" && Number.isFinite(v) ? v : 0,
    });
  }

  if (ohlc.length < 2) return null;

  // Strictly ascending time; duplicates break lightweight-charts.
  ohlc.sort((a, b) => a.time - b.time);
  const deduped: Candle[] = [];
  for (const bar of ohlc) {
    if (deduped.length && deduped[deduped.length - 1].time === bar.time) deduped[deduped.length - 1] = bar;
    else deduped.push(bar);
  }

  const trimmed = deduped.slice(-MAX_BARS);

  return {
    ohlc: trimmed,
    marketPrice: typeof result?.meta?.regularMarketPrice === "number" ? result.meta.regularMarketPrice : null,
    previousClose: typeof result?.meta?.chartPreviousClose === "number" ? result.meta.chartPreviousClose : null,
    currency: result?.meta?.currency ?? null,
    hasVolume: trimmed.some((b) => b.volume > 0),
  };
}

/** Last upstream HTTP status, so callers can distinguish throttling from a miss. */
let lastStatus = 0;

export function lastUpstreamStatus(): number {
  return lastStatus;
}

async function fetchOne(symbol: string, range: string, interval: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}` +
      `&includePrePost=false&events=div%7Csplit`;

    // No spoofed browser headers. Measured against the live endpoint, sending a
    // Mozilla User-Agent made Yahoo *more* likely to answer 429 (3-4 successes
    // in 5) than sending nothing at all (5 in 5) — it throttles requests that
    // look like browser scraping harder than plain programmatic ones.
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) {
      lastStatus = res.status;
      return null;
    }
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Tries each mapped symbol in order and returns the first that yields candles. */
export async function fetchYahooOHLC(
  pair: string,
  range = "1d",
  interval = "5m"
): Promise<RealOhlcResult | null> {
  lastStatus = 0;
  for (const symbol of getCandidates(pair)) {
    const json = await fetchOne(symbol, range, interval);
    if (!json) continue;
    const parsed = parseYahoo(json);
    if (parsed) return { ...parsed, source: "yahoo", symbolUsed: symbol };
  }
  return null;
}

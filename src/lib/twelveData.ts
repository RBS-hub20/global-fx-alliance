import type { Candle } from "./indicators";
import { specFor, type Timeframe } from "./timeframes";

/**
 * Twelve Data provider.
 *
 * Free tier is 800 requests/day and 8/minute, which is comfortable behind the
 * cache in marketProvider. It covers metals (XAU/USD, XAG/USD) that Yahoo only
 * exposes as a futures proxy, and it is not subject to the per-IP throttling
 * that makes Yahoo unreliable from shared edge addresses.
 *
 * Entirely optional: with no API key configured every function returns null and
 * the chain falls through to Yahoo, so nothing breaks.
 */

const BASE = "https://api.twelvedata.com";
const TIMEOUT_MS = 5000;

export function hasTwelveDataKey(): boolean {
  return !!process.env.TWELVE_DATA_API_KEY;
}

/** Twelve Data uses the same BASE/QUOTE notation the app already uses. */
export function toTwelveSymbol(symbol: string): string {
  return symbol.toUpperCase().trim();
}

async function call<T>(path: string): Promise<T | null> {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${path}&apikey=${encodeURIComponent(key)}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as T & { code?: number; status?: string };
    // Twelve Data reports quota and key errors with HTTP 200 and a body code.
    if (json && (json.code === 401 || json.code === 429 || json.status === "error")) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface TwelvePrice {
  price: number;
  source: "TwelveData";
  timestamp: number;
}

export async function fetchTwelvePrice(symbol: string): Promise<TwelvePrice | null> {
  const json = await call<{ price?: string }>(`price?symbol=${encodeURIComponent(toTwelveSymbol(symbol))}`);
  const price = json?.price ? Number.parseFloat(json.price) : NaN;
  if (!Number.isFinite(price) || price <= 0) return null;
  return { price, source: "TwelveData", timestamp: Date.now() };
}

export interface TwelveCandles {
  candles: Candle[];
  source: "TwelveData";
  interval: string;
}

interface TimeSeriesValue {
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
}

/**
 * Twelve Data returns newest-first with zone-less datetimes; both are normalised
 * here — ascending order and UTC — so the rest of the app can treat every
 * provider identically.
 */
export async function fetchTwelveCandles(
  symbol: string,
  tf: Timeframe,
  outputsize = 200
): Promise<TwelveCandles | null> {
  const spec = specFor(tf);
  const json = await call<{ values?: TimeSeriesValue[] }>(
    `time_series?symbol=${encodeURIComponent(toTwelveSymbol(symbol))}` +
      `&interval=${encodeURIComponent(spec.twelve)}&outputsize=${Math.min(Math.max(outputsize, 20), 5000)}&order=ASC`
  );
  if (!json?.values?.length) return null;

  const candles: Candle[] = [];
  for (const v of json.values) {
    const o = Number.parseFloat(v.open ?? "");
    const h = Number.parseFloat(v.high ?? "");
    const l = Number.parseFloat(v.low ?? "");
    const c = Number.parseFloat(v.close ?? "");
    if (![o, h, l, c].every((n) => Number.isFinite(n))) continue;

    const raw = (v.datetime ?? "").trim();
    // "2026-09-01 14:30:00" carries no zone; pin it to UTC rather than letting
    // the runtime apply its own offset.
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    const time = m
      ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) / 1000)
      : Math.floor(Date.parse(raw) / 1000);
    if (!Number.isFinite(time)) continue;

    const vol = Number.parseFloat(v.volume ?? "0");
    candles.push({
      time,
      open: o,
      high: Math.max(h, o, c),
      low: Math.min(l, o, c),
      close: c,
      volume: Number.isFinite(vol) ? vol : 0,
    });
  }

  if (candles.length < 2) return null;
  candles.sort((a, b) => a.time - b.time);
  return { candles, source: "TwelveData", interval: spec.twelve };
}

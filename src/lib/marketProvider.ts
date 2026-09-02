import type { Candle } from "./indicators";
import { fetchYahooOHLC } from "./fetchRealOHLC";
import { fetchTwelveCandles, fetchTwelvePrice, hasTwelveDataKey } from "./twelveData";
import { aggregateCandles, specFor, type Timeframe } from "./timeframes";
import { candlesFor, getPair, PAIRS } from "./market";

/**
 * Unified market data with an explicit fallback chain.
 *
 * Order: cache → Twelve Data (keyed, not IP-throttled) → Yahoo (keyless) →
 * cached-but-stale → modelled. Every result says which rung it came from, so
 * nothing downstream has to guess whether a number is real.
 *
 * Yahoo throttles shared edge addresses hard, which is why a keyed provider sits
 * ahead of it; but Yahoo stays in the chain so the app keeps working with no key
 * configured at all.
 */

const FRESH_MS = 60_000;
const STALE_MS = 15 * 60_000;

export type Provenance = "TwelveData" | "Yahoo" | "Cache" | "Modeled";

export interface CandleResult {
  candles: Candle[];
  price: number;
  source: Provenance;
  isReal: boolean;
  /** Upstream ticker actually used, where one applies. */
  symbolUsed: string | null;
  ageSeconds: number;
  stale: boolean;
  timeframe: Timeframe;
  /** True when 2H/4H bars were rolled up from 1H. */
  aggregated: boolean;
}

interface Entry {
  at: number;
  candles: Candle[];
  price: number;
  source: Provenance;
  symbolUsed: string | null;
  aggregated: boolean;
}

const cache = new Map<string, Entry>();

function put(key: string, e: Omit<Entry, "at">) {
  cache.set(key, { ...e, at: Date.now() });
  if (cache.size > 300) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

const asResult = (e: Entry, tf: Timeframe, stale: boolean): CandleResult => ({
  candles: e.candles,
  price: e.price,
  source: stale ? "Cache" : e.source,
  isReal: true,
  symbolUsed: e.symbolUsed,
  ageSeconds: Math.round((Date.now() - e.at) / 1000),
  stale,
  timeframe: tf,
  aggregated: e.aggregated,
});

/**
 * Real candles for a symbol at a candle size, or modelled ones clearly marked.
 * `anchor` re-bases the modelled fallback onto a price the caller trusts.
 */
export async function getRealCandles(
  symbol: string,
  tf: Timeframe,
  anchor?: number
): Promise<CandleResult> {
  const key = `${symbol}:${tf}`;
  const spec = specFor(tf);
  const hit = cache.get(key);

  if (hit && Date.now() - hit.at < FRESH_MS) return asResult(hit, tf, false);

  // 1. Twelve Data — keyed, covers metals natively, no per-IP throttling.
  if (hasTwelveDataKey()) {
    const td = await fetchTwelveCandles(symbol, tf, 250);
    if (td && td.candles.length >= 20) {
      const price = td.candles[td.candles.length - 1].close;
      put(key, { candles: td.candles, price, source: "TwelveData", symbolUsed: symbol, aggregated: false });
      return asResult(cache.get(key) as Entry, tf, false);
    }
  }

  // 2. Yahoo — keyless. 2H/4H do not exist upstream, so roll them up from 1H.
  const y = await fetchYahooOHLC(symbol, spec.yahoo.range, spec.yahoo.interval);
  if (y && y.ohlc.length >= 20) {
    const aggregated = spec.aggregateFromHours !== null;
    const candles = aggregated
      ? aggregateCandles(y.ohlc, spec.aggregateFromHours! * 3600)
      : y.ohlc;
    if (candles.length >= 10) {
      const price = y.marketPrice ?? candles[candles.length - 1].close;
      put(key, { candles, price, source: "Yahoo", symbolUsed: y.symbolUsed, aggregated });
      return asResult(cache.get(key) as Entry, tf, false);
    }
  }

  // 3. A real price from minutes ago beats a modelled one.
  if (hit && Date.now() - hit.at < STALE_MS) return asResult(hit, tf, true);

  // 4. Modelled, re-based onto the caller's anchor when there is one.
  const known = PAIRS.some((p) => p.symbol === symbol);
  const pair = getPair(symbol);
  const modelled = candlesFor(pair.symbol, "1D", anchor);
  const scale = anchor && modelled.length ? anchor / modelled[modelled.length - 1].close : 1;
  const candles =
    scale === 1
      ? modelled
      : modelled.map((b) => ({
          ...b,
          open: b.open * scale, high: b.high * scale, low: b.low * scale, close: b.close * scale,
        }));

  return {
    candles: known ? candles : [],
    price: anchor ?? pair.price,
    source: "Modeled",
    isReal: false,
    symbolUsed: null,
    ageSeconds: 0,
    stale: false,
    timeframe: tf,
    aggregated: false,
  };
}

export interface PriceResult {
  price: number;
  source: Provenance;
  isReal: boolean;
  symbolUsed: string | null;
  ageSeconds: number;
  stale: boolean;
}

/** Spot price only — cheaper than pulling a full series when that is all a caller needs. */
export async function getRealPrice(symbol: string): Promise<PriceResult> {
  if (hasTwelveDataKey()) {
    const td = await fetchTwelvePrice(symbol);
    if (td) {
      return { price: td.price, source: "TwelveData", isReal: true, symbolUsed: symbol, ageSeconds: 0, stale: false };
    }
  }

  const candles = await getRealCandles(symbol, "1H");
  return {
    price: candles.price,
    source: candles.source,
    isReal: candles.isReal,
    symbolUsed: candles.symbolUsed,
    ageSeconds: candles.ageSeconds,
    stale: candles.stale,
  };
}

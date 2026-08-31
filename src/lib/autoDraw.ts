/**
 * Auto-drawing: turns raw candles into the levels a chartist would mark by hand.
 *
 * Pure math on top of lib/indicators — no network. Everything is filtered so the
 * chart shows a handful of levels that actually earned their place rather than
 * every pivot in the window.
 */

import {
  computeIndicators, detectSwings, detectTrend, findSupportResistance,
  type Candle, type IndicatorSnapshot, type Level, type Trend,
} from "./indicators";

export interface FairValueGap {
  /** Top of the imbalance. */
  high: number;
  /** Bottom of the imbalance. */
  low: number;
  type: "bullish" | "bearish";
  startTime: number;
  endTime: number;
  index: number;
  /** Gap size as a share of price. */
  sizePct: number;
}

/**
 * A three-candle imbalance: price moved so fast that candle 1 and candle 3 never
 * overlap, leaving a band nothing traded in. Bullish when the gap is left below
 * a thrust up, bearish when left above a thrust down.
 */
export function detectFairValueGaps(candles: Candle[], minSizePct = 0.03): FairValueGap[] {
  const out: FairValueGap[] = [];
  if (candles.length < 3) return out;

  for (let i = 2; i < candles.length; i++) {
    const a = candles[i - 2];
    const c = candles[i];
    const mid = candles[i - 1].close || 1;

    // Bullish: candle 3's low sits above candle 1's high.
    if (c.low > a.high) {
      const sizePct = ((c.low - a.high) / mid) * 100;
      if (sizePct >= minSizePct) {
        out.push({
          high: c.low, low: a.high, type: "bullish",
          startTime: a.time, endTime: c.time, index: i, sizePct,
        });
      }
    }

    // Bearish: candle 3's high sits below candle 1's low.
    if (c.high < a.low) {
      const sizePct = ((a.low - c.high) / mid) * 100;
      if (sizePct >= minSizePct) {
        out.push({
          high: a.low, low: c.high, type: "bearish",
          startTime: a.time, endTime: c.time, index: i, sizePct,
        });
      }
    }
  }
  return out;
}

export interface TrendLine {
  p1: { time: number; price: number };
  p2: { time: number; price: number };
  direction: Trend["direction"];
  touches: number;
}

export interface Drawings {
  supports: Level[];
  resistances: Level[];
  trendline: TrendLine | null;
  fvgs: FairValueGap[];
  emaLevels: { ema20: number | null; ema50: number | null; ema200: number | null };
  indicators: IndicatorSnapshot | null;
  price: number;
}

const EMPTY: Drawings = {
  supports: [], resistances: [], trendline: null, fvgs: [],
  emaLevels: { ema20: null, ema50: null, ema200: null }, indicators: null, price: 0,
};

/**
 * The full auto-analysis for a candle set: top 3 supports and resistances by
 * strength, the dominant trendline, the two most recent unfilled-looking FVGs,
 * and the moving-average levels.
 */
export function generateDrawings(candles: Candle[], lookback = 5): Drawings {
  if (!candles.length) return EMPTY;

  const price = candles[candles.length - 1].close;
  const indicators = computeIndicators(candles);
  const swings = detectSwings(candles, lookback);
  const levels = findSupportResistance(swings, price, 0.1, candles.length);

  // Drop single-touch pivots when we have better candidates — a level nothing
  // ever retested is just a wick.
  const meaningful = levels.filter((l) => l.strength >= 2);
  const pool = meaningful.length >= 3 ? meaningful : levels;

  const byStrength = (a: Level, b: Level) =>
    b.strength - a.strength ||
    // Tie-break on proximity: a level near price matters more than a far one.
    Math.abs(a.price - price) - Math.abs(b.price - price);

  // Select on strength, then present nearest-first: traders read S1/R1 as the
  // next level price will meet, not the strongest one on the chart.
  const nearestFirst = (a: Level, b: Level) =>
    Math.abs(a.price - price) - Math.abs(b.price - price);

  const supports = pool
    .filter((l) => l.type === "support")
    .sort(byStrength)
    .slice(0, 3)
    .sort(nearestFirst);
  const resistances = pool
    .filter((l) => l.type === "resistance")
    .sort(byStrength)
    .slice(0, 3)
    .sort(nearestFirst);

  const trend = detectTrend(swings);
  const trendline: TrendLine | null = trend
    ? {
        p1: { time: trend.startTime, price: trend.startPrice },
        p2: { time: trend.endTime, price: trend.endPrice },
        direction: trend.direction,
        touches: trend.touches,
      }
    : null;

  // Most recent first, capped at two so the chart stays readable.
  const fvgs = detectFairValueGaps(candles)
    .filter((g) => g.index > candles.length * 0.4)
    .sort((a, b) => b.index - a.index)
    .slice(0, 2);

  return {
    supports,
    resistances,
    trendline,
    fvgs,
    emaLevels: {
      ema20: indicators?.ema20 ?? null,
      ema50: indicators?.ema50 ?? null,
      ema200: indicators?.ema200 ?? null,
    },
    indicators,
    price,
  };
}

/** Short human label for a level, e.g. "S1 1.1700 (3x)". */
export function levelLabel(l: Level, i: number, decimals: number): string {
  return `${l.type === "support" ? "S" : "R"}${i + 1} ${l.price.toFixed(decimals)} (${l.touches}x)`;
}

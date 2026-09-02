/**
 * Market engine.
 *
 * One deterministic source for every instrument the app quotes. Series are
 * generated from a seeded PRNG and detrended onto the quoted close, so the same
 * pair + range always renders identically on the server and the client — a
 * Math.random() walk here would break hydration on every load.
 */

export type Range = "1D" | "1W" | "1M" | "3M" | "1Y";

export const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y"];

export interface Pair {
  symbol: string;
  name: string;
  base: string;
  quote: string;
  price: number;
  change: number;
  changePct: number;
  /** Price display precision. */
  decimals: number;
  /** One pip in price terms — 0.0001 majors, 0.01 JPY, 0.1 metals. */
  pipSize: number;
  high24: number;
  low24: number;
  /** Typical spread, in pips. */
  spread: number;
  rsi: number;
  support: number;
  resistance: number;
  ma20: number;
  ma50: number;
  ma200: number;
  seed: number;
}

export const PAIRS: Pair[] = [
  {
    symbol: "EUR/USD", name: "Euro / US Dollar", base: "EUR", quote: "USD",
    price: 1.1742, change: 0.0049, changePct: 0.42, decimals: 4, pipSize: 0.0001,
    high24: 1.1768, low24: 1.1689, spread: 0.6,
    rsi: 68, support: 1.17, resistance: 1.18, ma20: 1.1698, ma50: 1.1615, ma200: 1.1402,
    seed: 11,
  },
  {
    symbol: "GBP/USD", name: "British Pound / US Dollar", base: "GBP", quote: "USD",
    price: 1.3521, change: -0.0024, changePct: -0.18, decimals: 4, pipSize: 0.0001,
    high24: 1.3574, low24: 1.3502, spread: 0.9,
    rsi: 46, support: 1.348, resistance: 1.359, ma20: 1.3548, ma50: 1.3502, ma200: 1.3288,
    seed: 23,
  },
  {
    symbol: "USD/JPY", name: "US Dollar / Japanese Yen", base: "USD", quote: "JPY",
    price: 147.42, change: 0.46, changePct: 0.31, decimals: 2, pipSize: 0.01,
    high24: 147.68, low24: 146.81, spread: 0.8,
    rsi: 61, support: 146.5, resistance: 148.2, ma20: 146.94, ma50: 145.7, ma200: 142.15,
    seed: 37,
  },
  {
    // Re-based to the current market. The previous reference (2,648.90) was set
    // when the seeded engine was written and had drifted ~40% from spot, so any
    // fallback quoted a reference entry that was not merely modelled but wrong.
    symbol: "XAU/USD", name: "Gold / US Dollar", base: "XAU", quote: "USD",
    price: 4422.9, change: 33.36, changePct: 0.76, decimals: 2, pipSize: 0.1,
    high24: 4448.0, low24: 4381.2, spread: 22,
    rsi: 72, support: 4360, resistance: 4470, ma20: 4386.5, ma50: 4298.4, ma200: 4062.7,
    seed: 59,
  },
  {
    symbol: "AUD/USD", name: "Australian Dollar / US Dollar", base: "AUD", quote: "USD",
    price: 0.6684, change: 0.0019, changePct: 0.29, decimals: 4, pipSize: 0.0001,
    high24: 0.6701, low24: 0.6658, spread: 0.9,
    rsi: 57, support: 0.664, resistance: 0.672, ma20: 0.6659, ma50: 0.6612, ma200: 0.6531,
    seed: 71,
  },
  {
    symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar", base: "NZD", quote: "USD",
    price: 0.6013, change: -0.0007, changePct: -0.11, decimals: 4, pipSize: 0.0001,
    high24: 0.6031, low24: 0.6002, spread: 1.4,
    rsi: 48, support: 0.598, resistance: 0.605, ma20: 0.6022, ma50: 0.5994, ma200: 0.5918,
    seed: 83,
  },
  {
    symbol: "USD/CHF", name: "US Dollar / Swiss Franc", base: "USD", quote: "CHF",
    price: 0.8452, change: -0.002, changePct: -0.24, decimals: 4, pipSize: 0.0001,
    high24: 0.8488, low24: 0.8441, spread: 1.1,
    rsi: 42, support: 0.842, resistance: 0.851, ma20: 0.8481, ma50: 0.8524, ma200: 0.8702,
    seed: 97,
  },
  {
    symbol: "BTC/USD", name: "Bitcoin / US Dollar", base: "BTC", quote: "USD",
    price: 78467.43, change: 1243.10, changePct: 1.61, decimals: 2, pipSize: 1,
    high24: 79210.0, low24: 76980.0, spread: 12,
    rsi: 59, support: 76500, resistance: 80200, ma20: 77120, ma50: 74880, ma200: 68440,
    seed: 127,
  },
  {
    symbol: "EUR/GBP", name: "Euro / British Pound", base: "EUR", quote: "GBP",
    price: 0.8684, change: 0.0047, changePct: 0.55, decimals: 4, pipSize: 0.0001,
    high24: 0.8698, low24: 0.8629, spread: 1.0,
    rsi: 64, support: 0.862, resistance: 0.872, ma20: 0.8641, ma50: 0.8598, ma200: 0.8494,
    seed: 109,
  },
];

export const PAIR_BY_SYMBOL: Record<string, Pair> = Object.fromEntries(
  PAIRS.map((p) => [p.symbol, p])
);

export function getPair(symbol: string): Pair {
  return PAIR_BY_SYMBOL[symbol] ?? PAIRS[0];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random walk pinned to `from` and `to`: a raw walk is generated, then the
 * cumulative drift error is linearly detrended so the last point lands exactly
 * on the quoted close.
 */
export function walk(seed: number, n: number, from: number, to: number, vol: number): number[] {
  const rnd = mulberry32(seed);
  const raw: number[] = [from];
  for (let i = 1; i < n; i++) raw.push(raw[i - 1] + (rnd() - 0.5) * vol);
  const drift = to - raw[n - 1];
  return raw.map((v, i) => Number((v + (drift * i) / (n - 1)).toFixed(6)));
}

/**
 * How far each range has travelled, as a multiple of the pair's 1D move. Chosen
 * so EUR/USD reproduces its published 1W/1M/3M/1Y figures exactly.
 */
const RANGE_PCT_MULT: Record<Range, number> = {
  "1D": 1,
  "1W": 2.74,
  "1M": 5.24,
  "3M": 11.5,
  "1Y": 19.76,
};

const RANGE_SHAPE: Record<Range, { n: number; vol: number; seed: number }> = {
  "1D": { n: 96, vol: 1, seed: 101 },
  "1W": { n: 84, vol: 1.7, seed: 202 },
  "1M": { n: 90, vol: 2.9, seed: 303 },
  "3M": { n: 92, vol: 4.8, seed: 404 },
  "1Y": { n: 120, vol: 8.6, seed: 505 },
};

export interface Series {
  points: number[];
  labels: string[];
  changePct: number;
  high: number;
  low: number;
}

function labelsFor(range: Range, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    switch (range) {
      case "1D": {
        const mins = Math.round(t * 24 * 60);
        out.push(
          `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
        );
        break;
      }
      case "1W":
        out.push(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][Math.min(6, Math.round(t * 6))]);
        break;
      case "1M":
        out.push(`D${Math.max(1, Math.round(t * 30))}`);
        break;
      case "3M":
        out.push(["Jun", "Jul", "Aug", "Sep"][Math.min(3, Math.round(t * 3))]);
        break;
      case "1Y":
        out.push(["Sep", "Nov", "Jan", "Mar", "May", "Jul", "Sep"][Math.min(6, Math.round(t * 6))]);
        break;
    }
  }
  return out;
}

const cache = new Map<string, Series>();

/** Price history for a pair over a range, always ending on the live quote. */
export function seriesFor(symbol: string, range: Range): Series {
  const key = `${symbol}:${range}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const pair = getPair(symbol);
  const shape = RANGE_SHAPE[range];
  const changePct = Number((pair.changePct * RANGE_PCT_MULT[range]).toFixed(2));
  const from = pair.price / (1 + changePct / 100);
  // Volatility scales with the instrument's own price so gold and EUR/USD move
  // by comparable *percentages* rather than comparable absolute amounts.
  const vol = pair.price * 0.0011 * shape.vol;

  const points = walk(shape.seed + pair.seed, shape.n, from, pair.price, vol);
  const series: Series = {
    points,
    labels: labelsFor(range, shape.n),
    changePct,
    high: Math.max(...points),
    low: Math.min(...points),
  };
  cache.set(key, series);
  return series;
}

/** Short sparkline for ticker cards. */
export function sparkFor(symbol: string): number[] {
  return seriesFor(symbol, "1D").points.filter((_, i) => i % 3 === 0);
}

export interface Technicals {
  trend: "Bullish" | "Bearish";
  momentum: "Strong" | "Moderate" | "Weak";
  volatility: "High" | "Medium" | "Low";
  rsi: number;
  rsiLabel: "Overbought" | "Neutral" | "Oversold";
  support: number;
  resistance: number;
  mas: { label: string; value: number; bias: "Above" | "Below" }[];
}

export function technicalsFor(symbol: string): Technicals {
  const p = getPair(symbol);
  const abs = Math.abs(p.changePct);
  return {
    trend: p.changePct >= 0 ? "Bullish" : "Bearish",
    momentum: abs >= 0.5 ? "Strong" : abs >= 0.25 ? "Moderate" : "Weak",
    volatility: abs >= 0.6 ? "High" : abs >= 0.25 ? "Medium" : "Low",
    rsi: p.rsi,
    rsiLabel: p.rsi >= 70 ? "Overbought" : p.rsi <= 30 ? "Oversold" : "Neutral",
    support: p.support,
    resistance: p.resistance,
    mas: [
      { label: "MA 20", value: p.ma20, bias: p.price >= p.ma20 ? "Above" : "Below" },
      { label: "MA 50", value: p.ma50, bias: p.price >= p.ma50 ? "Above" : "Below" },
      { label: "MA 200", value: p.ma200, bias: p.price >= p.ma200 ? "Above" : "Below" },
    ],
  };
}

export interface Levels {
  bias: "Long" | "Short";
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  rr: string;
}

/**
 * Illustrative structure levels derived from the pair's own support/resistance.
 * Educational framing only — never presented as a recommendation.
 */
export function levelsFor(symbol: string): Levels {
  const p = getPair(symbol);
  const long = p.changePct >= 0;
  const round = (v: number) => Number(v.toFixed(p.decimals));

  const entry = round(p.price);
  const stop = round(long ? p.support : p.resistance);
  const risk = Math.abs(entry - stop);
  const target1 = round(long ? entry + risk * 1.5 : entry - risk * 1.5);
  const target2 = round(long ? entry + risk * 2.5 : entry - risk * 2.5);

  return { bias: long ? "Long" : "Short", entry, stop, target1, target2, rr: "1 : 2.5" };
}

/** Pip value per standard lot, in the account currency (USD). */
export function pipValuePerLot(symbol: string, lots: number, price: number): number {
  const p = getPair(symbol);
  const contract = p.symbol.startsWith("XAU") ? 100 : 100_000;
  const raw = p.pipSize * contract * lots;
  // Quote-currency pip values convert back to USD at the current rate.
  if (p.quote === "USD") return raw;
  return raw / (price || p.price);
}

/* ------------------------------------------------------------------- candles */

export interface OhlcBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const RANGE_BAR_SECONDS: Record<Range, number> = {
  "1D": 15 * 60,
  "1W": 2 * 3600,
  "1M": 8 * 3600,
  "3M": 24 * 3600,
  "1Y": 3 * 24 * 3600,
};

const candleCache = new Map<string, OhlcBar[]>();

/**
 * OHLC bars for a pair/range, built from the same detrended walk that drives the
 * line series so the candles and the quoted close never disagree. Wick sizes come
 * from the same seeded PRNG, so the chart is byte-identical on every render.
 *
 * `anchor` lets a caller re-base the whole series onto a live price without
 * changing its shape — used when an upstream quote is available.
 */
export function candlesFor(symbol: string, range: Range = "1D", anchor?: number): OhlcBar[] {
  const key = `${symbol}:${range}:${anchor ?? ""}`;
  const hit = candleCache.get(key);
  if (hit) return hit;

  const pair = getPair(symbol);
  const series = seriesFor(symbol, range);
  const scale = anchor && pair.price ? anchor / pair.price : 1;
  const points = series.points.map((p) => p * scale);

  const rnd = mulberry32(pair.seed * 7919 + range.length * 104729);
  const step = RANGE_BAR_SECONDS[range];
  // End the series on the most recent completed bar boundary.
  const end = Math.floor(Date.now() / 1000 / step) * step;
  const start = end - (points.length - 1) * step;

  const bars: OhlcBar[] = points.map((close, i) => {
    // Most bars open where the last one closed, but real markets gap on news
    // and session opens. Without occasional gaps a three-candle imbalance can
    // never form, and fair-value-gap detection would be permanently empty.
    const prev = i === 0 ? close : points[i - 1];
    const gapRoll = rnd();
    const gap = gapRoll < 0.08 ? (rnd() - 0.5) * close * 0.0045 : 0;
    const open = i === 0 ? close : prev + gap;
    const body = Math.abs(close - open);
    // Wicks scale with the bar's own body plus a floor, so quiet bars still
    // show a little range instead of collapsing to a flat line.
    const reach = body * (0.4 + rnd() * 0.9) + close * 0.0004 * (0.3 + rnd());
    const high = Math.max(open, close) + reach * rnd();
    const low = Math.min(open, close) - reach * rnd();
    const volume = Math.round(500 + rnd() * 1500 + body / (close || 1) * 250_000);
    const r = (v: number) => Number(v.toFixed(pair.decimals + 2));
    return { time: start + i * step, open: r(open), high: r(high), low: r(low), close: r(close), volume };
  });

  // The final bar must close exactly on the quoted price.
  const lastBar = bars[bars.length - 1];
  if (lastBar) {
    const target = Number((anchor ?? pair.price).toFixed(pair.decimals));
    lastBar.close = target;
    lastBar.high = Math.max(lastBar.high, target);
    lastBar.low = Math.min(lastBar.low, target);
  }

  candleCache.set(key, bars);
  return bars;
}

/**
 * Technical indicators — pure math, no network, no dependencies.
 *
 * Every series function returns an array the same length as its input, with
 * `null` in the warm-up positions where the indicator is not yet defined. That
 * keeps indices aligned with the candle array so a chart can plot them without
 * offset bookkeeping. Anything that cannot be computed at all returns `null`
 * rather than throwing or silently returning garbage.
 */

export interface Candle {
  /** Unix seconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Series = (number | null)[];

const closes = (c: Candle[]) => c.map((x) => x.close);

/* ------------------------------------------------------------ moving average */

export function sma(values: number[], period: number): Series {
  if (period < 1 || values.length < period) return values.map(() => null);
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  if (period < 1 || values.length < period) return values.map(() => null);
  const out: Series = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values, the conventional start.
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/* ------------------------------------------------------------------- momentum */

/** Wilder-smoothed RSI. 0-100; >70 overbought, <30 oversold. */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);

  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export interface Macd {
  macd: Series;
  signal: Series;
  histogram: Series;
  bias: "bullish" | "bearish" | "neutral";
  /** Latest histogram reading, or null while warming up. */
  last: number | null;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): Macd | null {
  if (values.length < slow + signalPeriod) return null;

  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const line: Series = values.map((_, i) =>
    fastE[i] !== null && slowE[i] !== null ? (fastE[i] as number) - (slowE[i] as number) : null
  );

  // The signal EMA runs on the defined part of the MACD line only.
  const defined = line.filter((v): v is number => v !== null);
  const signalDefined = ema(defined, signalPeriod);
  const offset = line.findIndex((v) => v !== null);

  const signal: Series = new Array(values.length).fill(null);
  signalDefined.forEach((v, i) => {
    if (v !== null) signal[offset + i] = v;
  });

  const histogram: Series = values.map((_, i) =>
    line[i] !== null && signal[i] !== null ? (line[i] as number) - (signal[i] as number) : null
  );

  const last = [...histogram].reverse().find((v) => v !== null) ?? null;
  const lineLast = [...line].reverse().find((v) => v !== null) ?? 0;
  // Deadband. On a perfectly linear series the histogram converges to exactly
  // zero and floating-point noise lands at ~1e-15, which must not read as a
  // bearish crossover.
  const eps = Math.max(Math.abs(lineLast) * 1e-6, 1e-12);
  const bias =
    last === null || Math.abs(last) <= eps ? "neutral" : last > 0 ? "bullish" : "bearish";

  return { macd: line, signal, histogram, bias, last };
}

/* ----------------------------------------------------------------- volatility */

export interface Bollinger {
  upper: Series;
  middle: Series;
  lower: Series;
  /** Band width as a share of the middle band — a squeeze/expansion read. */
  widthPct: number | null;
}

export function bollinger(values: number[], period = 20, stdDev = 2): Bollinger | null {
  if (values.length < period) return null;
  const middle = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const win = values.slice(i - period + 1, i + 1);
    const mean = middle[i] as number;
    const variance = win.reduce((a, v) => a + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + stdDev * sd;
    lower[i] = mean - stdDev * sd;
  }

  const i = values.length - 1;
  const widthPct =
    upper[i] !== null && lower[i] !== null && middle[i]
      ? (((upper[i] as number) - (lower[i] as number)) / (middle[i] as number)) * 100
      : null;

  return { upper, middle, lower, widthPct };
}

/** Wilder-smoothed Average True Range. */
export function atr(candles: Candle[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1].close;
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev)));
  }

  let prev = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/* ------------------------------------------------------------ market structure */

export interface Swing {
  index: number;
  time: number;
  price: number;
  type: "high" | "low";
}

/**
 * Pivot swings: a bar whose high is the highest (or low the lowest) within
 * `lookback` bars either side. Bars at the very edges cannot be confirmed, so
 * they are skipped rather than guessed.
 */
export function detectSwings(candles: Candle[], lookback = 5): Swing[] {
  const out: Swing[] = [];
  if (candles.length < lookback * 2 + 1) return out;

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) out.push({ index: i, time: candles[i].time, price: candles[i].high, type: "high" });
    if (isLow) out.push({ index: i, time: candles[i].time, price: candles[i].low, type: "low" });
  }
  return out;
}

export interface Level {
  price: number;
  /** 1-5. Touch count, bumped for a recent rejection wick. */
  strength: number;
  touches: number;
  type: "support" | "resistance";
  lastIndex: number;
}

/**
 * Clusters swings that sit within `tolerancePct` of each other into levels. A
 * level touched repeatedly is stronger than a single pivot, which is the whole
 * point of drawing it.
 */
export function findSupportResistance(
  swings: Swing[],
  currentPrice: number,
  tolerancePct = 0.1,
  totalBars = 0
): Level[] {
  if (!swings.length || !Number.isFinite(currentPrice) || currentPrice <= 0) return [];

  const clusters: { prices: number[]; lastIndex: number }[] = [];
  for (const s of [...swings].sort((a, b) => a.price - b.price)) {
    const hit = clusters.find(
      (c) =>
        Math.abs(c.prices[c.prices.length - 1] - s.price) / currentPrice <= tolerancePct / 100
    );
    if (hit) {
      hit.prices.push(s.price);
      hit.lastIndex = Math.max(hit.lastIndex, s.index);
    } else {
      clusters.push({ prices: [s.price], lastIndex: s.index });
    }
  }

  return clusters.map((c) => {
    const price = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
    const touches = c.prices.length;
    // A level tested recently carries more weight than one from long ago.
    const recent = totalBars > 0 && c.lastIndex > totalBars * 0.6 ? 1 : 0;
    return {
      price,
      touches,
      strength: Math.max(1, Math.min(5, touches + recent)),
      type: price < currentPrice ? ("support" as const) : ("resistance" as const),
      lastIndex: c.lastIndex,
    };
  });
}

export interface Trend {
  direction: "up" | "down" | "sideways";
  startPrice: number;
  endPrice: number;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  touches: number;
  /** Price change per bar. */
  slope: number;
}

/**
 * Fits a trend from the swing sequence: rising lows are an uptrend, falling
 * highs a downtrend. Anything shallower than `flatPct` per the whole leg is
 * called sideways rather than forced into a direction.
 */
export function detectTrend(swings: Swing[], flatPct = 0.15): Trend | null {
  if (swings.length < 2) return null;

  const lows = swings.filter((s) => s.type === "low");
  const highs = swings.filter((s) => s.type === "high");

  const leg = (pts: Swing[]) => {
    if (pts.length < 2) return null;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const span = b.index - a.index;
    if (span <= 0) return null;
    return { a, b, slope: (b.price - a.price) / span };
  };

  const lowLeg = leg(lows);
  const highLeg = leg(highs);
  const chosen =
    lowLeg && highLeg
      ? Math.abs(lowLeg.slope) >= Math.abs(highLeg.slope)
        ? lowLeg
        : highLeg
      : lowLeg ?? highLeg;
  if (!chosen) return null;

  const { a, b, slope } = chosen;
  const movePct = a.price === 0 ? 0 : ((b.price - a.price) / a.price) * 100;
  const direction: Trend["direction"] =
    Math.abs(movePct) < flatPct ? "sideways" : movePct > 0 ? "up" : "down";

  const source = chosen === lowLeg ? lows : highs;

  return {
    direction,
    startPrice: a.price,
    endPrice: b.price,
    startIndex: a.index,
    endIndex: b.index,
    startTime: a.time,
    endTime: b.time,
    touches: source.length,
    slope,
  };
}

/* --------------------------------------------------------------- convenience */

export interface IndicatorSnapshot {
  price: number;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  rsiLabel: "Overbought" | "Neutral" | "Oversold" | "n/a";
  macd: Macd | null;
  bollinger: Bollinger | null;
  atr: number | null;
  atrPct: number | null;
  series: { ema20: Series; ema50: Series; ema200: Series; rsi: Series };
}

const tail = (s: Series) => [...s].reverse().find((v) => v !== null) ?? null;

/** Everything the chart and the AI need, computed once per candle set. */
export function computeIndicators(candles: Candle[]): IndicatorSnapshot | null {
  if (!candles.length) return null;
  const c = closes(candles);
  const price = c[c.length - 1];

  const e20 = ema(c, 20);
  const e50 = ema(c, 50);
  const e200 = ema(c, 200);
  const r = rsi(c, 14);
  const a = tail(atr(candles, 14));
  const lastRsi = tail(r);

  return {
    price,
    ema20: tail(e20),
    ema50: tail(e50),
    ema200: tail(e200),
    rsi: lastRsi,
    rsiLabel:
      lastRsi === null ? "n/a" : lastRsi >= 70 ? "Overbought" : lastRsi <= 30 ? "Oversold" : "Neutral",
    macd: macd(c),
    bollinger: bollinger(c),
    atr: a,
    atrPct: a !== null && price ? (a / price) * 100 : null,
    series: { ema20: e20, ema50: e50, ema200: e200, rsi: r },
  };
}

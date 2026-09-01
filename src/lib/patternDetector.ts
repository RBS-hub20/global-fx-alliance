/**
 * Candlestick / structure pattern detection over real OHLC.
 *
 * Runs on the same candles the chart draws and reuses the auto-drawn levels, so
 * a flagged pattern always corresponds to something visible. Confidence is
 * raised only when two independent signals agree — a pattern alone is weaker
 * than a pattern occurring at a level price has already respected.
 */

import { detectSwings, findSupportResistance, rsi, type Candle } from "./indicators";
import { detectFairValueGaps } from "./autoDraw";

export type Direction = "bullish" | "bearish";
export type Confidence = "high" | "medium" | "low";

export interface Pattern {
  id: string;
  type: string;
  symbol: string;
  timeframe: string;
  direction: Direction;
  confidence: Confidence;
  description: string;
  price: number;
  time: number;
  /** Level the pattern formed against, when there is one. */
  level: number | null;
}

const body = (c: Candle) => Math.abs(c.close - c.open);
const isUp = (c: Candle) => c.close > c.open;
const isDown = (c: Candle) => c.close < c.open;

function near(price: number, level: number, tolerancePct: number): boolean {
  if (!level) return false;
  return Math.abs(price - level) / level <= tolerancePct / 100;
}

/**
 * Detects patterns on the most recent candles. Only the tail is scanned — a
 * bullish engulfing from 200 bars ago is history, not a signal.
 */
export function detectPatterns(
  ohlc: Candle[],
  symbol: string,
  timeframe = "15m",
  decimals = 4
): Pattern[] {
  const out: Pattern[] = [];
  if (!Array.isArray(ohlc) || ohlc.length < 20) return out;

  const price = ohlc[ohlc.length - 1].close;
  const swings = detectSwings(ohlc, 5);
  const levels = findSupportResistance(swings, price, 0.1, ohlc.length);
  const supports = levels.filter((l) => l.type === "support").sort((a, b) => b.strength - a.strength);
  const resistances = levels.filter((l) => l.type === "resistance").sort((a, b) => b.strength - a.strength);

  const rsiSeries = rsi(ohlc.map((c) => c.close), 14);
  const fmt = (v: number) => v.toFixed(decimals);
  const scanFrom = Math.max(1, ohlc.length - 12);

  // Round to the instrument's own precision — raw float closes carry 15 digits
  // and would render as 4420.39990234375 in the UI.
  const round = (v: number) => Number(v.toFixed(decimals));

  // Direction and a sequence number are part of the id: a bullish and a bearish
  // fair-value-gap retest can land on the same symbol, type and timestamp, which
  // collided as a duplicate React key.
  let seq = 0;
  const push = (p: Omit<Pattern, "id">) =>
    out.push({
      ...p,
      price: round(p.price),
      level: p.level === null ? null : round(p.level),
      id: `${symbol}-${p.type}-${p.direction}-${p.time}-${seq++}`.replace(/[^A-Za-z0-9-]/g, ""),
    });

  /* ------------------------------------------------- engulfing candles */
  for (let i = scanFrom; i < ohlc.length; i++) {
    const prev = ohlc[i - 1];
    const cur = ohlc[i];
    if (body(prev) === 0 || body(cur) === 0) continue;
    // Require a decisive candle, not a marginally larger doji.
    if (body(cur) < body(prev) * 1.1) continue;

    const bullish = isDown(prev) && isUp(cur) && cur.close >= prev.open && cur.open <= prev.close;
    const bearish = isUp(prev) && isDown(cur) && cur.close <= prev.open && cur.open >= prev.close;
    if (!bullish && !bearish) continue;

    const level = bullish ? supports[0]?.price ?? null : resistances[0]?.price ?? null;
    const atLevel = level !== null && near(cur.close, level, 0.25);

    push({
      type: bullish ? "Bullish Engulfing" : "Bearish Engulfing",
      symbol,
      timeframe,
      direction: bullish ? "bullish" : "bearish",
      confidence: atLevel ? "high" : "medium",
      description: atLevel
        ? `Engulfing candle at ${fmt(level as number)}, a level price has already respected — two signals agreeing.`
        : `Engulfing candle at ${fmt(cur.close)} with no nearby level, so the pattern is on its own.`,
      price: cur.close,
      time: cur.time,
      level: atLevel ? level : null,
    });
  }

  /* ------------------------------------------- support / resistance tests */
  const last = ohlc[ohlc.length - 1];
  const s0 = supports[0];
  if (s0 && near(last.low, s0.price, 0.2) && isUp(last)) {
    push({
      type: "Support Bounce",
      symbol,
      timeframe,
      direction: "bullish",
      confidence: s0.touches >= 3 ? "high" : "medium",
      description: `Price tested ${fmt(s0.price)} (${s0.touches} touches) and closed higher.`,
      price: last.close,
      time: last.time,
      level: s0.price,
    });
  }

  const r0 = resistances[0];
  if (r0 && near(last.high, r0.price, 0.2) && isDown(last)) {
    push({
      type: "Resistance Rejection",
      symbol,
      timeframe,
      direction: "bearish",
      confidence: r0.touches >= 3 ? "high" : "medium",
      description: `Price tested ${fmt(r0.price)} (${r0.touches} touches) and closed lower.`,
      price: last.close,
      time: last.time,
      level: r0.price,
    });
  }

  /* ------------------------------------------------------- RSI divergence */
  const lows = swings.filter((s) => s.type === "low").slice(-2);
  const highs = swings.filter((s) => s.type === "high").slice(-2);

  if (lows.length === 2) {
    const [a, b] = lows;
    const ra = rsiSeries[a.index];
    const rb = rsiSeries[b.index];
    // Price makes a lower low while RSI makes a higher low.
    if (ra !== null && rb !== null && b.price < a.price && rb > ra) {
      push({
        type: "Bullish RSI Divergence",
        symbol,
        timeframe,
        direction: "bullish",
        confidence: rb - ra > 5 ? "high" : "medium",
        description: `Price made a lower low at ${fmt(b.price)} but RSI rose from ${ra.toFixed(1)} to ${rb.toFixed(1)} — selling pressure easing.`,
        price: b.price,
        time: b.time,
        level: null,
      });
    }
  }

  if (highs.length === 2) {
    const [a, b] = highs;
    const ra = rsiSeries[a.index];
    const rb = rsiSeries[b.index];
    if (ra !== null && rb !== null && b.price > a.price && rb < ra) {
      push({
        type: "Bearish RSI Divergence",
        symbol,
        timeframe,
        direction: "bearish",
        confidence: ra - rb > 5 ? "high" : "medium",
        description: `Price made a higher high at ${fmt(b.price)} but RSI fell from ${ra.toFixed(1)} to ${rb.toFixed(1)} — buying pressure fading.`,
        price: b.price,
        time: b.time,
        level: null,
      });
    }
  }

  /* --------------------------------------------------- fair-value-gap fill */
  for (const gap of detectFairValueGaps(ohlc).slice(-3)) {
    // Only interesting once price has come back to the imbalance.
    if (price >= gap.low && price <= gap.high && gap.index < ohlc.length - 2) {
      push({
        type: "Fair Value Gap Retest",
        symbol,
        timeframe,
        direction: gap.type,
        confidence: "medium",
        description: `Price returned into the ${gap.type} imbalance at ${fmt(gap.low)}–${fmt(gap.high)}.`,
        price,
        time: last.time,
        level: (gap.high + gap.low) / 2,
      });
    }
  }

  const order: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
  return out
    .sort((a, b) => order[a.confidence] - order[b.confidence] || b.time - a.time)
    .slice(0, 6);
}

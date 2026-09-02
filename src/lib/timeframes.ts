import type { Candle } from "./indicators";

/**
 * Chart Snap timeframes.
 *
 * Distinct from the dashboard's `Range` (which describes how much *history* a
 * chart shows). This describes candle size, which is what a screenshot is
 * actually on.
 */
export const TIMEFRAMES = ["5M", "15M", "1H", "2H", "4H", "D1"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export interface TimeframeSpec {
  label: Timeframe;
  /** Twelve Data `interval`. */
  twelve: string;
  /**
   * Yahoo `interval`, plus the range needed to return enough bars.
   * Yahoo has no 2h or 4h interval, so those are aggregated from 1h.
   */
  yahoo: { interval: string; range: string };
  /** Hours per bar when aggregation is required, else null. */
  aggregateFromHours: number | null;
  seconds: number;
}

export const TIMEFRAME_SPEC: Record<Timeframe, TimeframeSpec> = {
  "5M":  { label: "5M",  twelve: "5min",  yahoo: { interval: "5m",  range: "5d"  }, aggregateFromHours: null, seconds: 300 },
  "15M": { label: "15M", twelve: "15min", yahoo: { interval: "15m", range: "1mo" }, aggregateFromHours: null, seconds: 900 },
  "1H":  { label: "1H",  twelve: "1h",    yahoo: { interval: "60m", range: "3mo" }, aggregateFromHours: null, seconds: 3600 },
  // Yahoo tops out at 90m for intraday, so 2H and 4H are built from 60m bars.
  "2H":  { label: "2H",  twelve: "2h",    yahoo: { interval: "60m", range: "3mo" }, aggregateFromHours: 2, seconds: 7200 },
  "4H":  { label: "4H",  twelve: "4h",    yahoo: { interval: "60m", range: "3mo" }, aggregateFromHours: 4, seconds: 14400 },
  "D1":  { label: "D1",  twelve: "1day",  yahoo: { interval: "1d",  range: "1y"  }, aggregateFromHours: null, seconds: 86400 },
};

export function isTimeframe(v: string | null | undefined): v is Timeframe {
  return !!v && (TIMEFRAMES as readonly string[]).includes(v);
}

export function specFor(tf: Timeframe): TimeframeSpec {
  return TIMEFRAME_SPEC[tf] ?? TIMEFRAME_SPEC["1H"];
}

/**
 * Rolls smaller candles up into larger ones. Buckets are aligned to the epoch so
 * the same input always produces the same boundaries regardless of when it runs.
 */
export function aggregateCandles(candles: Candle[], bucketSeconds: number): Candle[] {
  if (!candles.length || bucketSeconds <= 0) return candles;

  const buckets = new Map<number, Candle>();
  for (const c of candles) {
    const key = Math.floor(c.time / bucketSeconds) * bucketSeconds;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { time: key, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      // Candles arrive in time order, so the latest close wins.
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

/**
 * Noise scales inversely with candle size, so a level needs more confirmation on
 * a 5-minute chart than on a daily one before it deserves "high" confidence.
 */
export function touchesForHighConfidence(tf: Timeframe): number {
  switch (tf) {
    case "5M":
    case "15M":
      return 3;
    case "1H":
    case "2H":
      return 3;
    default:
      return 2;
  }
}

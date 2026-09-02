/**
 * Server-side fact gathering for the AI routes.
 *
 * The model is never asked to recall a price, a level or a statistic. Everything
 * it is allowed to state is computed here from the same providers the charts and
 * the radar use, rendered as a plain-text CONTEXT block, and handed over with an
 * instruction to use nothing else. That makes hallucinated numbers a prompt
 * violation rather than a plausible completion.
 */

import { getRealCandles, type CandleResult } from "./marketProvider";
import { computeIndicators, detectSwings, detectTrend, findSupportResistance, type Level } from "./indicators";
import { detectPatterns, type Pattern } from "./patternDetector";
import { getPair, PAIRS } from "./market";
import { getCurrentSessionInfo, getGreeting, humanMinutes } from "./sessionTime";
import type { Timeframe } from "./timeframes";

export const AI_MAJORS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "BTC/USD"];

export interface Quote {
  symbol: string;
  price: number;
  changePct: number;
  decimals: number;
  source: CandleResult["source"];
  isReal: boolean;
  symbolUsed: string | null;
  bars: number;
  aggregated: boolean;
}

function quoteFrom(symbol: string, r: CandleResult): Quote {
  const pair = getPair(symbol);
  const n = r.candles.length;
  // Change is measured across the returned window, not quoted from a static
  // table, so it always matches the candles the same call returned.
  const first = n ? r.candles[Math.max(0, n - 24)].close : r.price;
  const changePct = first ? ((r.price - first) / first) * 100 : 0;
  return {
    symbol,
    price: r.price,
    changePct,
    decimals: pair.decimals,
    source: r.source,
    isReal: r.isReal,
    symbolUsed: r.symbolUsed,
    bars: n,
    aggregated: r.aggregated,
  };
}

export interface InstrumentRead {
  quote: Quote;
  patterns: Pattern[];
  levels: { support: Level[]; resistance: Level[] };
  rsi: number | null;
  rsiLabel: string;
  atr: number | null;
  trend: string | null;
  candles: CandleResult["candles"];
}

/** One instrument, read end to end: quote, structure, patterns. */
export async function readInstrument(symbol: string, tf: Timeframe = "1H"): Promise<InstrumentRead> {
  const r = await getRealCandles(symbol, tf);
  const pair = getPair(symbol);
  const quote = quoteFrom(symbol, r);

  if (r.candles.length < 20) {
    return { quote, patterns: [], levels: { support: [], resistance: [] }, rsi: null, rsiLabel: "n/a", atr: null, trend: null, candles: r.candles };
  }

  const ind = computeIndicators(r.candles);
  const swings = detectSwings(r.candles);
  const all = findSupportResistance(swings, r.price, 0.1, r.candles.length);
  const trend = detectTrend(swings);

  return {
    quote,
    patterns: detectPatterns(r.candles, symbol, tf, pair.decimals),
    levels: {
      support: all.filter((l) => l.type === "support").sort((a, b) => b.price - a.price).slice(0, 3),
      resistance: all.filter((l) => l.type === "resistance").sort((a, b) => a.price - b.price).slice(0, 3),
    },
    rsi: ind?.rsi ?? null,
    rsiLabel: ind?.rsiLabel ?? "n/a",
    atr: ind?.atr ?? null,
    trend: trend ? trend.direction : null,
    candles: r.candles,
  };
}

/** Quotes plus patterns across the majors, for the broad-market prompts. */
export async function readMarket(symbols: string[] = AI_MAJORS, tf: Timeframe = "1H") {
  const reads = await Promise.all(
    symbols.filter((s) => PAIRS.some((p) => p.symbol === s)).map((s) => readInstrument(s, tf))
  );
  const order = { high: 0, medium: 1, low: 2 } as const;
  const patterns = reads
    .flatMap((r) => r.patterns)
    .sort((a, b) => order[a.confidence] - order[b.confidence] || b.time - a.time);
  return { reads, patterns };
}

/* ------------------------------------------------------------ prompt rendering */

export function sessionContext(now = new Date()) {
  const info = getCurrentSessionInfo(now);
  const line = [
    getGreeting(info),
    info.sessions.map((s) => `${s.name} ${s.status}`).join(", "),
    info.next ? `${info.next.name} opens in ${humanMinutes(info.next.minutesToOpen)}` : "",
    `${info.dubaiClock} Dubai`,
  ]
    .filter(Boolean)
    .join(" · ");
  return { info, line };
}

const fmt = (n: number, d: number) => n.toFixed(d);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export function quoteLine(q: Quote): string {
  const prov = q.isReal ? `real via ${q.source}${q.symbolUsed && q.symbolUsed !== q.symbol ? ` (${q.symbolUsed})` : ""}` : "MODELLED, not a real quote";
  return `${q.symbol} ${fmt(q.price, q.decimals)} ${pct(q.changePct)} — ${prov}, ${q.bars} bars${q.aggregated ? ", rolled up from 1H" : ""}`;
}

export function instrumentContext(r: InstrumentRead): string {
  const d = r.quote.decimals;
  const lines = [`- ${quoteLine(r.quote)}`];
  if (r.levels.support.length)
    lines.push(`  support: ${r.levels.support.map((l) => `${fmt(l.price, d)} (${plural(l.touches, "touch")})`).join(", ")}`);
  if (r.levels.resistance.length)
    lines.push(`  resistance: ${r.levels.resistance.map((l) => `${fmt(l.price, d)} (${plural(l.touches, "touch")})`).join(", ")}`);
  if (r.rsi !== null) lines.push(`  RSI(14) ${r.rsi.toFixed(1)} (${r.rsiLabel})${r.trend ? `, trend ${r.trend}` : ""}${r.atr ? `, ATR ${fmt(r.atr, d)}` : ""}`);
  if (r.patterns.length)
    lines.push(`  patterns: ${r.patterns.slice(0, 4).map((p) => `${p.type} ${p.direction} ${p.confidence} at ${fmt(p.price, d)}`).join("; ")}`);
  else lines.push("  patterns: none detected");
  return lines.join("\n");
}

export function patternContext(patterns: Pattern[]): string {
  if (!patterns.length) return "PATTERN RADAR: nothing on the board.";
  const high = patterns.filter((p) => p.confidence === "high").length;
  return [
    `PATTERN RADAR: ${patterns.length} live, ${high} at high confidence.`,
    ...patterns.slice(0, 8).map((p) => `- ${p.symbol} ${p.type} (${p.direction}, ${p.confidence}) at ${p.price} — ${p.description}`),
  ].join("\n");
}

/** Sources are assembled in code so the model cannot embellish provenance. */
export function buildSources(opts: {
  quotes?: Quote[];
  patternCount?: number;
  journal?: { totalTrades: number; isReal: boolean } | null;
  extra?: string[];
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const q of opts.quotes ?? []) {
    const label = q.isReal
      ? `${q.source} ${q.symbolUsed ?? q.symbol} ${fmt(q.price, q.decimals)} real`
      : `${q.symbol} modelled`;
    if (!seen.has(label)) { seen.add(label); out.push(label); }
  }
  if (opts.patternCount !== undefined) out.push(`Pattern Radar (${opts.patternCount})`);
  if (opts.journal?.totalTrades)
    out.push(opts.journal.isReal ? `Your journal (${opts.journal.totalTrades} trades, aggregated)` : `Sample journal (${opts.journal.totalTrades} trades)`);
  out.push(...(opts.extra ?? []));
  return out;
}

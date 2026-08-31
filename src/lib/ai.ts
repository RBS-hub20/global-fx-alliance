/**
 * GFXA Terminal — a four-agent market analyst.
 *
 * No model and no network. Each agent reads the same computed indicators,
 * auto-drawn levels, calendar and headlines the rest of the dashboard is showing,
 * so the narrative can never contradict the chart. It explains structure and
 * declines to issue signals.
 */

import type { Candle, IndicatorSnapshot } from "./indicators";
import type { Drawings } from "./autoDraw";
import { CALENDAR } from "./data";
import { NEWS } from "./content";
import { PAIRS, getPair, levelsFor, seriesFor, technicalsFor } from "./market";

export const DISCLAIMER =
  "Educational only — not financial advice. Do your own research.";

/* ------------------------------------------------------------------ context */

export interface CalendarLike {
  time: string;
  currency: string;
  event: string;
  importance: "low" | "medium" | "high";
  actual?: string | null;
  forecast?: string;
  previous?: string;
  released?: boolean;
}

export interface NewsLike {
  title: string;
  source: string;
  time: string;
  sentiment: "bullish" | "bearish" | "neutral";
  symbols: string[];
}

export interface TerminalContext {
  pair: string;
  price: number;
  changePct: number;
  decimals: number;
  ohlc: Candle[];
  indicators: IndicatorSnapshot | null;
  drawings: Drawings;
  calendar: CalendarLike[];
  news: NewsLike[];
  /** Whole board, for cross-asset flow. */
  board?: { symbol: string; changePct: number }[];
  source?: "live" | "fallback";
}

export interface ReportSection {
  key: "TECHNICALS" | "FUNDAMENTALS" | "FLOW" | "RISK";
  lines: string[];
}

export interface TerminalReport {
  pair: string;
  price: number;
  changePct: number;
  decimals: number;
  sections: ReportSection[];
  disclaimer: string;
  source: "live" | "fallback";
}

/* ------------------------------------------------------------ pair detection */

const ALIASES: [RegExp, string][] = [
  [/\b(eur\s*[/\-]?\s*usd|eurusd|euro|fiber)\b/i, "EUR/USD"],
  [/\b(gbp\s*[/\-]?\s*usd|gbpusd|cable|sterling|pound)\b/i, "GBP/USD"],
  [/\b(usd\s*[/\-]?\s*jpy|usdjpy|yen)\b/i, "USD/JPY"],
  [/\b(xau\s*[/\-]?\s*usd|xauusd|gold|bullion)\b/i, "XAU/USD"],
  [/\b(aud\s*[/\-]?\s*usd|audusd|aussie)\b/i, "AUD/USD"],
  [/\b(nzd\s*[/\-]?\s*usd|nzdusd|kiwi)\b/i, "NZD/USD"],
  [/\b(usd\s*[/\-]?\s*chf|usdchf|swissy|franc)\b/i, "USD/CHF"],
  [/\b(eur\s*[/\-]?\s*gbp|eurgbp)\b/i, "EUR/GBP"],
];

/** Pull an instrument out of free text; falls back to the caller's default. */
export function detectPair(query: string, fallback = "EUR/USD"): string {
  for (const [re, symbol] of ALIASES) if (re.test(query)) return symbol;
  return fallback;
}

const fmt = (v: number | null | undefined, d: number) =>
  v === null || v === undefined || !Number.isFinite(v) ? "n/a" : v.toFixed(d);

/* ------------------------------------------------------------------- agents */

/** Structure, momentum and the levels that matter. */
export function technicalAgent(ctx: TerminalContext): string[] {
  const { drawings, indicators: ind, decimals: d, price } = ctx;
  const lines: string[] = [];

  const tl = drawings.trendline;
  lines.push(
    `Structure    ${tl ? tl.direction.toUpperCase() : "UNDEFINED"}${
      tl ? ` · ${tl.touches} confirmed pivots` : ""
    }`
  );

  if (ind) {
    const stack =
      ind.ema20 !== null && ind.ema50 !== null && ind.ema200 !== null
        ? ind.ema20 > ind.ema50 && ind.ema50 > ind.ema200
          ? "stacked bullish (20>50>200)"
          : ind.ema20 < ind.ema50 && ind.ema50 < ind.ema200
            ? "stacked bearish (20<50<200)"
            : "interleaved — no clean trend"
        : "warming up";
    lines.push(`EMA          ${stack}`);
    lines.push(
      `             20 ${fmt(ind.ema20, d)} · 50 ${fmt(ind.ema50, d)} · 200 ${fmt(ind.ema200, d)}`
    );
    lines.push(
      `RSI(14)      ${fmt(ind.rsi, 1)} — ${ind.rsiLabel}${
        ind.rsiLabel === "Overbought"
          ? " (stretched, but overbought in a trend just means trending)"
          : ind.rsiLabel === "Oversold"
            ? " (stretched to the downside)"
            : ""
      }`
    );
    if (ind.macd) lines.push(`MACD         histogram ${fmt(ind.macd.last, 5)} — ${ind.macd.bias}`);
    if (ind.bollinger?.widthPct !== null && ind.bollinger?.widthPct !== undefined) {
      const w = ind.bollinger.widthPct;
      lines.push(
        `Bollinger    width ${w.toFixed(2)}% — ${w < 1 ? "squeeze, expansion often follows" : w > 3 ? "expanded, moves are mature" : "normal"}`
      );
    }
  }

  const s = drawings.supports;
  const r = drawings.resistances;
  lines.push(
    `Support      ${s.length ? s.map((l, i) => `S${i + 1} ${l.price.toFixed(d)} (${l.touches}x)`).join(" · ") : "none in range"}`
  );
  lines.push(
    `Resistance   ${r.length ? r.map((l, i) => `R${i + 1} ${l.price.toFixed(d)} (${l.touches}x)`).join(" · ") : "none in range"}`
  );

  const nearest = [...s, ...r].sort(
    (a, b) => Math.abs(a.price - price) - Math.abs(b.price - price)
  )[0];
  if (nearest) {
    const dist = Math.abs(nearest.price - price);
    lines.push(
      `Nearest      ${nearest.type} at ${nearest.price.toFixed(d)}, ${dist.toFixed(d)} away (${((dist / price) * 100).toFixed(2)}%)`
    );
  }

  if (drawings.fvgs.length) {
    lines.push(
      `Imbalance    ${drawings.fvgs
        .map((g) => `${g.type} FVG ${g.low.toFixed(d)}–${g.high.toFixed(d)}`)
        .join(" · ")}`
    );
  }

  return lines;
}

/** What is scheduled, what already printed, and what the wires are saying. */
export function fundamentalAgent(ctx: TerminalContext): string[] {
  const { pair, calendar, news } = ctx;
  const [base, quote] = pair.split("/");
  const lines: string[] = [];

  const relevant = calendar.filter((e) => e.currency === base || e.currency === quote);
  const pending = relevant.filter((e) => !e.released);
  const high = relevant.filter((e) => e.importance === "high");

  lines.push(
    `Event risk   ${high.length} high-impact on ${base}/${quote} today · ${pending.length} still to come`
  );

  if (pending.length) {
    pending.slice(0, 3).forEach((e) => {
      lines.push(
        `             ${e.time} ${e.currency} ${e.event}${e.forecast ? ` · fcst ${e.forecast}` : ""}${e.previous ? ` vs prev ${e.previous}` : ""}`
      );
    });
  } else if (relevant.length) {
    lines.push(`             All scheduled releases have printed — the session is data-clear.`);
  } else {
    lines.push(`             Nothing scheduled on either leg today.`);
  }

  const wires = news.filter((n) => n.symbols.includes(pair));
  // Falling back to the whole wire is fine, but it must be labelled — presenting
  // unrelated headlines as pair-relevant is worse than saying there are none.
  const pool = wires.length ? wires : news;
  const onTopic = wires.length > 0;
  const bull = pool.filter((n) => n.sentiment === "bullish").length;
  const bear = pool.filter((n) => n.sentiment === "bearish").length;

  if (onTopic) {
    lines.push(
      `Wire tone    ${bull} bullish / ${bear} bearish across ${pool.length} ${pair} headlines — ${
        bull > bear ? "net constructive" : bear > bull ? "net negative" : "mixed"
      }`
    );
  } else {
    lines.push(
      `Wire tone    no ${pair}-specific headlines on the wire — showing broad tape instead`
    );
  }
  pool.slice(0, 2).forEach((n) => {
    lines.push(`             "${n.title.slice(0, 88)}" — ${n.source}`);
  });

  return lines;
}

/** Cross-asset: is this a dollar story or a story about the other leg? */
export function flowAgent(ctx: TerminalContext): string[] {
  const { pair, board } = ctx;
  const rows = board?.length ? board : PAIRS.map((p) => ({ symbol: p.symbol, changePct: p.changePct }));
  const lines: string[] = [];

  // A pair quoted in USD rising means the dollar is falling, and vice versa.
  const usdMoves = rows
    .filter((r) => r.symbol.includes("USD"))
    .map((r) => (r.symbol.startsWith("USD") ? r.changePct : -r.changePct));
  const usdBias = usdMoves.reduce((a, b) => a + b, 0) / (usdMoves.length || 1);
  const stronger = usdMoves.filter((v) => v > 0).length;

  lines.push(
    `USD          ${usdBias >= 0 ? "firmer" : "softer"} on the day, avg ${usdBias >= 0 ? "+" : ""}${usdBias.toFixed(2)}% across ${usdMoves.length} legs (stronger in ${stronger})`
  );
  lines.push(
    `Breadth      ${Math.abs(stronger - (usdMoves.length - stronger)) <= 1 ? "mixed — likely an idiosyncratic move, not a dollar move" : "broad — this reads as a dollar story"}`
  );

  const gold = rows.find((r) => r.symbol === "XAU/USD");
  if (gold) {
    lines.push(
      `Gold         ${gold.changePct >= 0 ? "+" : ""}${gold.changePct.toFixed(2)}% — ${
        gold.changePct > 0 && usdBias < 0
          ? "rising with a softer dollar, the textbook pairing"
          : gold.changePct > 0 && usdBias > 0
            ? "rising despite a firmer dollar, which usually means a real-yield or haven bid"
            : "offered"
      }`
    );
  }

  const cross = pair === "EUR/USD" ? "EUR/GBP" : pair === "GBP/USD" ? "EUR/GBP" : null;
  const crossRow = cross ? rows.find((r) => r.symbol === cross) : null;
  if (crossRow) {
    lines.push(
      `Cross-check  ${cross} ${crossRow.changePct >= 0 ? "+" : ""}${crossRow.changePct.toFixed(2)}% — use it to separate ${pair.split("/")[0]} demand from dollar weakness`
    );
  }

  const risk = rows.find((r) => r.symbol === "AUD/USD");
  if (risk) {
    lines.push(
      `Risk proxy   AUD/USD ${risk.changePct >= 0 ? "+" : ""}${risk.changePct.toFixed(2)}% — ${risk.changePct >= 0 ? "risk-on lean" : "risk-off lean"}`
    );
  }

  return lines;
}

/** Volatility, range and what that implies for sizing. */
export function riskAgent(ctx: TerminalContext): string[] {
  const { indicators: ind, ohlc, decimals: d, price, drawings } = ctx;
  const lines: string[] = [];

  if (ind?.atr !== null && ind?.atr !== undefined) {
    lines.push(
      `ATR(14)      ${fmt(ind.atr, d)} (${fmt(ind.atrPct, 2)}% of price) — ${
        (ind.atrPct ?? 0) > 0.8 ? "elevated" : (ind.atrPct ?? 0) < 0.3 ? "compressed" : "normal"
      }`
    );
    const stop = ind.atr * 1.5;
    lines.push(
      `Stop guide   1.5×ATR ≈ ${stop.toFixed(d)} (${((stop / price) * 100).toFixed(2)}%) — a stop inside this is inside the noise`
    );
  } else {
    lines.push(`ATR(14)      warming up — not enough bars for a volatility read`);
  }

  if (ohlc.length) {
    const window = ohlc.slice(-Math.min(96, ohlc.length));
    const hi = Math.max(...window.map((b) => b.high));
    const lo = Math.min(...window.map((b) => b.low));
    const pos = hi === lo ? 50 : ((price - lo) / (hi - lo)) * 100;
    lines.push(`Range        ${lo.toFixed(d)} – ${hi.toFixed(d)} · price sits ${pos.toFixed(0)}% up the range`);
  }

  const inval = drawings.supports[0]?.price ?? drawings.resistances[0]?.price;
  if (inval !== undefined) {
    lines.push(
      `Invalidation ${inval.toFixed(d)} — the nearest level the current read depends on`
    );
  }

  lines.push(`Sizing       risk ÷ (stop in pips × pip value) — the Trading Calculator does the arithmetic`);
  return lines;
}

/* --------------------------------------------------------------- orchestrator */

/**
 * Runs all four agents over one context and returns a structured report. Async
 * to match the terminal's call site, which awaits its data fetches first.
 */
export async function getTerminalAnalysis(
  query: string,
  ctx: TerminalContext
): Promise<TerminalReport> {
  return {
    pair: ctx.pair,
    price: ctx.price,
    changePct: ctx.changePct,
    decimals: ctx.decimals,
    source: ctx.source ?? "fallback",
    sections: [
      { key: "TECHNICALS", lines: technicalAgent(ctx) },
      { key: "FUNDAMENTALS", lines: fundamentalAgent(ctx) },
      { key: "FLOW", lines: flowAgent(ctx) },
      { key: "RISK", lines: riskAgent(ctx) },
    ],
    disclaimer: DISCLAIMER,
  };
}

/** Plain-text rendering of a report, for copy/paste and the chat tab. */
export function reportToText(r: TerminalReport): string {
  const head = `GFXA TERMINAL v1.0 — ${r.pair}   ${r.price.toFixed(r.decimals)}   ${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`;
  const body = r.sections
    .map((s) => `▸ ${s.key}\n${s.lines.map((l) => `  ${l}`).join("\n")}`)
    .join("\n\n");
  return `${head}\n${"═".repeat(58)}\n\n${body}\n\n${"─".repeat(58)}\n${r.disclaimer}`;
}

/* ------------------------------------------------- chat tab (string answers) */

function analyse(symbol: string): string {
  const p = getPair(symbol);
  const t = technicalsFor(symbol);
  const l = levelsFor(symbol);
  const d = seriesFor(symbol, "1D");
  return [
    `**${p.symbol} — ${p.price.toFixed(p.decimals)}** (${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(2)}% on the day)`,
    ``,
    `Price is ${p.changePct >= 0 ? "up" : "down"} on the session, trading between ${d.low.toFixed(p.decimals)} and ${d.high.toFixed(p.decimals)}. Structure reads **${t.trend.toLowerCase()}** with ${t.momentum.toLowerCase()} momentum and ${t.volatility.toLowerCase()} volatility.`,
    ``,
    `RSI is at **${t.rsi}** (${t.rsiLabel.toLowerCase()}). Price sits ${t.mas[0].bias.toLowerCase()} the 20-day average at ${t.mas[0].value.toFixed(p.decimals)} and ${t.mas[2].bias.toLowerCase()} the 200-day at ${t.mas[2].value.toFixed(p.decimals)}.`,
    ``,
    `The levels that matter: support around **${t.support.toFixed(p.decimals)}**, resistance around **${t.resistance.toFixed(p.decimals)}**. On the current structure a ${l.bias.toLowerCase()} idea would be invalidated at ${l.stop.toFixed(p.decimals)}.`,
    ``,
    `For the full four-agent breakdown, open **Market Analysis** and run \`analyze ${p.symbol}\` in the terminal.`,
    ``,
    `What I would not tell you is whether to take it. ${DISCLAIMER}`,
  ].join("\n");
}

function eventsToday(): string {
  const pending = CALENDAR.filter((e) => !e.actual);
  const high = CALENDAR.filter((e) => e.impact === "High");
  return [
    `**Today's calendar** — ${high.length} high-impact releases, ${pending.length} still to come.`,
    ``,
    ...pending
      .slice(0, 6)
      .map(
        (e) =>
          `- **${e.time} UTC** · ${e.currency} · ${e.title} (${e.impact}) — forecast ${e.forecast}, previous ${e.previous}`
      ),
    ``,
    DISCLAIMER,
  ].join("\n");
}

function goldStory(): string {
  const p = getPair("XAU/USD");
  const t = technicalsFor("XAU/USD");
  return [
    `**Gold is at ${p.price.toFixed(2)}, ${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(2)}% on the day.**`,
    ``,
    `The move has been yield-driven rather than a haven bid — real yields have fallen through the week and gold's beta to that has been unusually tight. That distinction matters: a yield-driven rally behaves very differently from a panic bid when it unwinds.`,
    ``,
    `RSI at **${t.rsi}** puts it in ${t.rsiLabel.toLowerCase()} territory. Structure: support near ${t.support.toFixed(2)}, resistance near ${t.resistance.toFixed(2)}.`,
    ``,
    DISCLAIMER,
  ].join("\n");
}

function dollarStrength(): string {
  const rows = PAIRS.filter((p) => p.symbol.includes("USD") && p.base !== "XAU").map((p) => {
    const usdMove = p.base === "USD" ? p.changePct : -p.changePct;
    return `- ${p.symbol}: USD ${usdMove >= 0 ? "stronger" : "softer"} by ${Math.abs(usdMove).toFixed(2)}%`;
  });
  return [
    `**Dollar scorecard.**`,
    ``,
    ...rows,
    ``,
    `Breadth is what separates a dollar story from a single-currency story. If the move shows up on every leg it is the dollar; if it is concentrated in one pair it is not.`,
    ``,
    DISCLAIMER,
  ].join("\n");
}

/** Keyword-routed answers for the AI Tools chat. */
export function answer(question: string): string {
  const q = question.trim();
  if (!q) return "Ask me about a pair, today's calendar, or what is driving the dollar.";

  const matched = ALIASES.find(([re]) => re.test(q));
  const symbol = matched?.[1] ?? null;

  // The refusal is checked before anything else. "Should I buy EUR/USD?"
  // mentions a pair, and routing on the pair first would answer a request for a
  // recommendation with an analysis instead of declining it.
  if (/\b(should i|shall i|buy|sell|entry|signal|tip|recommend|worth it|go long|go short)\b/i.test(q)) {
    return [
      `I won't give you a signal or tell you what to trade — that is the one thing this assistant is deliberately not for.`,
      ``,
      `What I can do is lay out the structure so you can decide: ask me to analyse a pair by name, ask what is on today's calendar, or ask what is driving the dollar.`,
    ].join("\n");
  }

  if (/\b(event|calendar|news|releases?|data|today)\b/i.test(q) && !symbol) return eventsToday();
  if (symbol === "XAU/USD" && /\b(why|moved|move|driving|happened)\b/i.test(q)) return goldStory();
  if (/\b(dollar|usd)\s*(strength|weakness|index|scorecard)\b/i.test(q) || /\bcompare\b.*\busd\b/i.test(q))
    return dollarStrength();
  if (symbol) return analyse(symbol);

  if (/\b(risk|size|sizing|stop|lot|lots|leverage|margin)\b/i.test(q)) {
    return [
      `**Sizing, in one line:** risk amount = balance × risk %, then lots = risk amount ÷ (stop in pips × pip value per lot).`,
      ``,
      `The Trading Calculator tab does this for any pair, including the currency conversion when the quote currency is not the dollar.`,
      ``,
      DISCLAIMER,
    ].join("\n");
  }

  return [
    `I can help with a few things specifically:`,
    ``,
    `- **Analyse a pair** — name any of ${PAIRS.slice(0, 4).map((p) => p.symbol).join(", ")}`,
    `- **Today's events** — what is scheduled and what tends to move on it`,
    `- **Dollar strength** — a scorecard across the majors`,
    `- **Risk and sizing** — the formulas, not the decision`,
    ``,
    `For the full Bloomberg-style breakdown, use the terminal in **Market Analysis**.`,
    ``,
    DISCLAIMER,
  ].join("\n");
}

export const SUMMARY = [
  `**Market summary — session close.**`,
  ``,
  `Risk is modestly bid and the dollar is on the back foot. Core PCE undershot at 2.6%, the softest since early 2021, and the Fed minutes dropped the built-in hiking bias.`,
  ``,
  `**FX:** EUR/USD is the cleanest expression, pressing the shelf that has capped it twice this month. Sterling is the outlier after a broad retail-sales miss. USD/JPY is unmoved by a BoJ hold that was fully priced.`,
  ``,
  `**Metals:** Gold up for a fifth straight session, driven by falling real yields rather than a haven bid.`,
  ``,
  `**What to watch:** the London/New York overlap — both the EUR/USD breakout and the gold extension rest on the same dollar input.`,
  ``,
  DISCLAIMER,
].join("\n");

export function tradeIdea(symbol: string): string {
  const p = getPair(symbol);
  const t = technicalsFor(symbol);
  const l = levelsFor(symbol);
  return [
    `**${p.symbol} — study idea, ${l.bias.toLowerCase()} structure**`,
    ``,
    `**Thesis.** Trend reads ${t.trend.toLowerCase()} with ${t.momentum.toLowerCase()} momentum; price is ${t.mas[0].bias.toLowerCase()} its 20-day average. RSI ${t.rsi} (${t.rsiLabel.toLowerCase()}).`,
    ``,
    `**Reference entry** ${l.entry.toFixed(p.decimals)}`,
    `**Invalidation** ${l.stop.toFixed(p.decimals)}`,
    `**First objective** ${l.target1.toFixed(p.decimals)}`,
    `**Second objective** ${l.target2.toFixed(p.decimals)}`,
    `**Structural R:R** ${l.rr}`,
    ``,
    `**What would kill it.** A close beyond the invalidation, or a high-impact release that changes the rate story underneath it.`,
    ``,
    `This is a worked example for study. ${DISCLAIMER}`,
  ].join("\n");
}

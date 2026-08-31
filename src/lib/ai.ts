/**
 * Canned market assistant.
 *
 * Keyword routing over the app's own data — no model, no network. It reads the
 * real quotes, technicals and calendar so answers stay consistent with whatever
 * the rest of the dashboard is showing, and it declines anything that would be
 * a recommendation.
 */

import { CALENDAR } from "./data";
import { PAIRS, getPair, levelsFor, seriesFor, technicalsFor } from "./market";

const SYMBOL_ALIASES: [RegExp, string][] = [
  [/\b(eur\s*\/?\s*usd|euro dollar|fiber)\b/i, "EUR/USD"],
  [/\b(gbp\s*\/?\s*usd|cable|pound dollar)\b/i, "GBP/USD"],
  [/\b(usd\s*\/?\s*jpy|dollar yen)\b/i, "USD/JPY"],
  [/\b(xau\s*\/?\s*usd|gold|bullion)\b/i, "XAU/USD"],
  [/\b(aud\s*\/?\s*usd|aussie)\b/i, "AUD/USD"],
  [/\b(nzd\s*\/?\s*usd|kiwi)\b/i, "NZD/USD"],
  [/\b(usd\s*\/?\s*chf|swissy|franc)\b/i, "USD/CHF"],
  [/\b(eur\s*\/?\s*gbp)\b/i, "EUR/GBP"],
];

function detectSymbol(q: string): string | null {
  for (const [re, symbol] of SYMBOL_ALIASES) if (re.test(q)) return symbol;
  return null;
}

const DISCLAIMER =
  "This is market education, not financial advice — nothing here is a recommendation to buy or sell.";

function analyse(symbol: string): string {
  const p = getPair(symbol);
  const t = technicalsFor(symbol);
  const l = levelsFor(symbol);
  const d = seriesFor(symbol, "1D");
  const dir = p.changePct >= 0 ? "up" : "down";

  return [
    `**${p.symbol} — ${p.price.toFixed(p.decimals)}** (${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(2)}% on the day)`,
    ``,
    `Price is ${dir} on the session, trading between ${d.low.toFixed(p.decimals)} and ${d.high.toFixed(p.decimals)}. Structure reads **${t.trend.toLowerCase()}** with ${t.momentum.toLowerCase()} momentum and ${t.volatility.toLowerCase()} volatility.`,
    ``,
    `RSI is at **${t.rsi}** (${t.rsiLabel.toLowerCase()}). Price sits ${t.mas[0].bias.toLowerCase()} the 20-day average at ${t.mas[0].value.toFixed(p.decimals)} and ${t.mas[2].bias.toLowerCase()} the 200-day at ${t.mas[2].value.toFixed(p.decimals)}.`,
    ``,
    `The levels that matter: support around **${t.support.toFixed(p.decimals)}**, resistance around **${t.resistance.toFixed(p.decimals)}**. On the current structure a ${l.bias.toLowerCase()} idea would be invalidated at ${l.stop.toFixed(p.decimals)}.`,
    ``,
    `What I would not tell you is whether to take it. ${DISCLAIMER}`,
  ].join("\n");
}

function eventsToday(): string {
  const pending = CALENDAR.filter((e) => !e.actual);
  const high = CALENDAR.filter((e) => e.impact === "High");
  const lines = pending
    .slice(0, 6)
    .map((e) => `- **${e.time} UTC** · ${e.currency} · ${e.title} (${e.impact}) — forecast ${e.forecast}, previous ${e.previous}`);

  return [
    `**Today's calendar** — ${high.length} high-impact releases, ${pending.length} still to come.`,
    ``,
    ...lines,
    ``,
    `The one to plan around is ${CALENDAR.find((e) => e.impact === "High" && !e.actual)?.title ?? "the next high-impact print"}. ${DISCLAIMER}`,
  ].join("\n");
}

function goldStory(): string {
  const p = getPair("XAU/USD");
  const t = technicalsFor("XAU/USD");
  return [
    `**Gold is at ${p.price.toFixed(2)}, ${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(2)}% on the day.**`,
    ``,
    `The move has been yield-driven rather than a haven bid — ten-year real yields have fallen through the week and gold's beta to that has been unusually tight. That distinction matters: a yield-driven rally behaves very differently from a panic bid when it unwinds.`,
    ``,
    `RSI at **${t.rsi}** puts it in ${t.rsiLabel.toLowerCase()} territory, and positioning data suggests the leveraged-fund net long is crowded. Crowded is not the same as wrong, but it changes how a reversal would behave.`,
    ``,
    `Structure: support near ${t.support.toFixed(2)}, resistance near ${t.resistance.toFixed(2)}. ${DISCLAIMER}`,
  ].join("\n");
}

function dollarStrength(): string {
  const vsUsd = PAIRS.filter((p) => p.quote === "USD" && p.base !== "XAU");
  const usdBase = PAIRS.filter((p) => p.base === "USD");
  // A pair quoted in USD rising means the dollar is falling, and vice versa.
  const weakAgainst = vsUsd.filter((p) => p.changePct > 0).length;
  const strongAgainst = usdBase.filter((p) => p.changePct > 0).length;

  const rows = [...vsUsd, ...usdBase]
    .map((p) => {
      const usdMove = p.base === "USD" ? p.changePct : -p.changePct;
      return `- ${p.symbol}: USD ${usdMove >= 0 ? "stronger" : "softer"} by ${Math.abs(usdMove).toFixed(2)}%`;
    })
    .join("\n");

  return [
    `**Dollar scorecard.** The USD is softer against ${weakAgainst} of the ${vsUsd.length} majors quoted in dollars, and stronger in ${strongAgainst} of the ${usdBase.length} pairs where it is the base.`,
    ``,
    rows,
    ``,
    `The move is broad rather than concentrated, which usually points at a dollar story rather than a story about any one counter-currency. Core PCE is the release that would confirm or break it. ${DISCLAIMER}`,
  ].join("\n");
}

export function answer(question: string): string {
  const q = question.trim();
  if (!q) return "Ask me about a pair, today's calendar, or what is driving the dollar.";

  const symbol = detectSymbol(q);

  if (/\b(event|calendar|news|releases?|data|today)\b/i.test(q) && !symbol) return eventsToday();
  if (symbol === "XAU/USD" && /\b(why|moved|move|driving|happened)\b/i.test(q)) return goldStory();
  if (/\b(dollar|usd)\s*(strength|weakness|index|scorecard)\b/i.test(q) || /\bcompare\b.*\busd\b/i.test(q))
    return dollarStrength();
  if (symbol) return analyse(symbol);

  if (/\b(should i|buy|sell|entry|signal|tip|recommend)\b/i.test(q)) {
    return [
      `I won't give you a signal or tell you what to trade — that is the one thing this assistant is deliberately not for.`,
      ``,
      `What I can do is lay out the structure so you can decide: ask me to analyse a pair by name, ask what is on today's calendar, or ask what is driving the dollar right now.`,
    ].join("\n");
  }

  if (/\b(risk|position siz|lot|stop)\b/i.test(q)) {
    return [
      `**Sizing, in one line:** risk amount = balance × risk %, then lots = risk amount ÷ (stop in pips × pip value per lot).`,
      ``,
      `The Trading Calculator tab does this for any pair, including the currency conversion when the quote currency is not the dollar. The number most people get wrong is the pip value, not the arithmetic.`,
      ``,
      `${DISCLAIMER}`,
    ].join("\n");
  }

  return [
    `I can help with a few things specifically:`,
    ``,
    `- **Analyse a pair** — name any of ${PAIRS.slice(0, 4).map((p) => p.symbol).join(", ")} and I'll walk the structure`,
    `- **Today's events** — what is scheduled and what tends to move on it`,
    `- **Dollar strength** — a scorecard across the majors`,
    `- **Risk and sizing** — the formulas, not the decision`,
    ``,
    `${DISCLAIMER}`,
  ].join("\n");
}

export const SUMMARY = [
  `**Market summary — session close.**`,
  ``,
  `Risk is modestly bid and the dollar is on the back foot. Core PCE undershot at 2.6%, the softest since early 2021, and the Fed minutes dropped the built-in hiking bias — rate futures now price roughly a 70% chance of a hold.`,
  ``,
  `**FX:** EUR/USD is the cleanest expression, +0.42% and pressing the 1.1760 shelf that has capped it twice this month. Sterling is the outlier, −0.18% after a broad retail-sales miss. USD/JPY is unmoved by a BoJ hold that was fully priced.`,
  ``,
  `**Metals:** Gold +0.76% for a fifth straight session, driven by falling real yields rather than a haven bid. RSI at 72 with crowded positioning.`,
  ``,
  `**What to watch:** the London/New York overlap. Both the EUR/USD breakout and the gold extension have been carried by dollar softness, so they stand or fall on the same input.`,
  ``,
  `Education and market intelligence only — not financial advice.`,
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
    `**Invalidation** ${l.stop.toFixed(p.decimals)} — below the level the thesis depends on`,
    `**First objective** ${l.target1.toFixed(p.decimals)}`,
    `**Second objective** ${l.target2.toFixed(p.decimals)}`,
    `**Structural R:R** ${l.rr}`,
    ``,
    `**What would kill it.** A close beyond the invalidation, or a high-impact release that changes the rate story underneath it.`,
    ``,
    `This is a worked example for study. It is not a signal, not a recommendation, and not financial advice.`,
  ].join("\n");
}

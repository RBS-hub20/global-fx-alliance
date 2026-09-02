import { readInstrument, type InstrumentRead } from "./aiContext";
import { readStructure, type StructureRead } from "./structureRead";
import { buildTradePlan, DEFAULT_PROFILE, type TradePlan, type TradeProfile } from "./chartSnap";
import { journalToContext, type JournalAggregate } from "./aiProvider";
import { sessionContext } from "./aiContext";
import { getPair } from "./market";
import type { Timeframe } from "./timeframes";

/**
 * One snap, shared by the assistant's `/snap` command and the Chart Snap tab so
 * both surfaces answer identically for the same instrument and candle size.
 *
 * The structure read and the risk arithmetic are computed here; the model only
 * writes the prose around them, from the CONTEXT this builds.
 */

export interface SnapResult {
  symbol: string;
  timeframe: Timeframe;
  instrument: InstrumentRead;
  read: StructureRead;
  plan: TradePlan;
  session: string;
  /** Prompt block — every figure the model is allowed to use. */
  context: string;
}

export async function runSnap(
  symbol: string,
  timeframe: Timeframe,
  journal: JournalAggregate | null,
  profile: TradeProfile = DEFAULT_PROFILE
): Promise<SnapResult> {
  const instrument = await readInstrument(symbol, timeframe);
  const { info, line: session } = sessionContext();
  const pair = getPair(symbol);

  const hourDubai = info.dubaiClock.slice(0, 2);
  const pairAgg =
    journal?.bestPair?.symbol === symbol
      ? journal.bestPair
      : journal?.worstPair?.symbol === symbol
        ? journal.worstPair
        : null;

  const read = readStructure({
    symbol,
    timeframe,
    candles: instrument.candles,
    price: instrument.quote.price,
    supports: instrument.levels.support,
    resistances: instrument.levels.resistance,
    patterns: instrument.patterns,
    rsi: instrument.rsi,
    rsiLabel: instrument.rsiLabel,
    atr: instrument.atr,
    sessionLine: session,
    journal: journal
      ? {
          isReal: journal.isReal,
          pairWinRate: pairAgg?.winRate ?? null,
          pairTrades: pairAgg?.trades ?? null,
          worstHour: journal.worstHourDubai?.hour ?? null,
          bestHour: journal.bestHourDubai?.hour ?? null,
          currentHourDubai: hourDubai,
        }
      : null,
  });

  const plan = buildTradePlan({
    symbol,
    price: instrument.quote.price,
    atr: instrument.atr,
    supports: instrument.levels.support,
    resistances: instrument.levels.resistance,
    pattern: read.pattern,
    profile,
  });

  const d = pair.decimals;
  const f = (v: number) => v.toFixed(d);

  const context = [
    "CONTEXT — the only facts you may state. Never add a number of your own.",
    "",
    `INSTRUMENT: ${symbol} on ${timeframe} candles.`,
    `QUOTE: ${f(instrument.quote.price)} — ${instrument.quote.isReal ? `real via ${instrument.quote.source}${instrument.quote.symbolUsed && instrument.quote.symbolUsed !== symbol ? ` (${instrument.quote.symbolUsed})` : ""}` : "MODELLED, not a real quote — say so"}, ${instrument.quote.bars} bars.`,
    `SESSION: ${session}`,
    "",
    `STRUCTURE READ: ${read.label} (${read.state}), bias ${read.bias}, ${read.confidence} confidence.`,
    read.level
      ? `LEVEL IN PLAY: ${read.level.type} ${f(read.level.price)}, touched ${read.level.touches}, ${f(read.distance ?? 0)} away — that is ${((read.distance ?? 0) / pair.pipSize).toFixed(1)} pips, ${read.distanceAtr}×ATR. Quote distances with the unit given; never call points "pips".`
      : "LEVEL IN PLAY: none — price is mid-range.",
    "",
    "OBSERVATIONS:",
    ...read.observations.map((o) => `- ${o}`),
    "",
    "WHAT WOULD BREAK IT:",
    ...read.cautions.map((c) => `- ${c}`),
    "",
    "WORKED RISK EXAMPLE (already computed — quote exactly, never recalculate):",
    `- reference price ${f(plan.entry)}`,
    `- invalidation ${f(plan.stopLoss)} — ${f(Math.abs(plan.entry - plan.stopLoss))} away, which is ${plan.stopPips} pips (${plan.stopBasis})`,
    `- objectives ${f(plan.target1)} (${plan.rr1}) and ${f(plan.target2)} (${plan.rr2})`,
    `- on the profile's $${DEFAULT_PROFILE.balance.toLocaleString()} illustration risking ${plan.riskPctOfBalance}% ($${plan.riskUsd}), that is ${plan.lots} lots`,
    "",
    journalToContext(journal),
    "",
    "COMMUNITY POSITIONING: not measured — never cite a percentage.",
  ].join("\n");

  return { symbol, timeframe, instrument, read, plan, session, context };
}

/**
 * The ask for the explainer.
 *
 * Explicitly forbids order language. The reader asked for "bakit" — why the
 * structure reads the way it does — and that is answerable; "place this order"
 * is not something this product does.
 */
export function explainerPrompt(snap: SnapResult): string {
  return [
    `Write the "Bakit ganito ang basa?" explainer for ${snap.symbol} on ${snap.timeframe}, about 170 words.`,
    "",
    "Use these bold labels, each its own short paragraph:",
    "**Ano ang nakikita.** what the structure is doing, naming the level and the distance.",
    "**Bakit ganito.** why that reads the way it does — the level's touch count, the pattern, RSI, the session.",
    "**Ang libro mo.** what the reader's own aggregated history says about this instrument or this hour, if the context has it.",
    "**Halimbawa ng risk.** the worked example, quoting the computed geometry verbatim, framed as illustration.",
    "**Bakit pwedeng mali.** what would break the read — be as specific and as long here as in the sections above.",
    "",
    "Taglish: natural mix of Filipino and English the way a Manila trading desk actually talks, but professional — no slang padding.",
    "",
    "HARD: this is an observation of structure and a study example, never an instruction. Do not write BUY, SELL, BUY LIMIT, SELL LIMIT,",
    "'enter', 'take the trade', 'place an order', or any wording that tells the reader to transact. Describe what price is doing and what",
    "would invalidate it. If the reader wants a decision, that is theirs to make.",
  ].join("\n");
}

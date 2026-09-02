import { NextResponse } from "next/server";
import { SYSTEM_PROMPT, callAI, hasOpenAIKey, journalToContext, type JournalAggregate } from "@/lib/aiProvider";
import { buildSources, instrumentContext, readInstrument, sessionContext } from "@/lib/aiContext";
import { isTimeframe, type Timeframe } from "@/lib/timeframes";
import { DISCLAIMER } from "@/lib/ai";
import { getPair, PAIRS } from "@/lib/market";

export const runtime = "edge";

/**
 * A worked example for study on one instrument and candle size.
 *
 * The arithmetic — invalidation, objective, risk-to-reward — is computed here
 * from real ATR rather than asked of the model, so the numbers in the example
 * are internally consistent even if the prose around them is generated.
 */

export async function POST(request: Request) {
  if (!hasOpenAIKey()) {
    return NextResponse.json({ available: false, provider: "Local" }, { headers: { "Cache-Control": "no-store" } });
  }

  let pair = "EUR/USD";
  let tf: Timeframe = "15M";
  let journal: JournalAggregate | null = null;
  try {
    const body = (await request.json()) as { pair?: string; timeframe?: string; journal?: JournalAggregate | null };
    if (body.pair && PAIRS.some((p) => p.symbol === body.pair)) pair = body.pair;
    if (isTimeframe(body.timeframe)) tf = body.timeframe;
    journal = body.journal ?? null;
  } catch {
    /* defaults stand */
  }

  const { line: session } = sessionContext();
  const read = await readInstrument(pair, tf);
  const spec = getPair(pair);
  const d = read.quote.decimals;
  // Quoted at the instrument's own precision, so entry, stop and targets are all
  // stated on the same scale rather than mixing a raw feed price with rounded levels.
  const price = Number(read.quote.price.toFixed(d));

  // Risk geometry from measured volatility, not from the model.
  const rawAtr = read.atr && read.atr > 0 ? read.atr : price * 0.0012;
  // A quiet session can put ATR below the spread — on EUR/USD at 15M that
  // produced a two-pip invalidation, which costs more to cross than it risks.
  // The floor keeps the worked example something a reader could actually study.
  const atr = Math.max(rawAtr, spec.spread * spec.pipSize * 2);
  const nearestSupport = read.levels.support[0]?.price ?? null;
  const stop = Number((nearestSupport && price - nearestSupport < atr * 2 ? nearestSupport - atr * 0.25 : price - atr).toFixed(d));
  const risk = Math.max(price - stop, spec.spread * spec.pipSize * 2);
  const target1 = Number((price + risk).toFixed(d));
  const target2 = Number((price + risk * 2).toFixed(d));
  // The instrument's own pip definition — 0.0001 on the majors, 0.01 on JPY
  // crosses, 0.1 on gold. Deriving one from the decimal count got this wrong by
  // a factor of ten and reported sub-pip stops on EUR/USD.
  const stopPips = Number((risk / spec.pipSize).toFixed(1));

  const geometry = [
    `RISK GEOMETRY (already computed — quote these exactly, do not recalculate):`,
    `- reference price ${price.toFixed(d)}`,
    `- invalidation ${stop.toFixed(d)} (${stopPips} pips away, from ATR ${atr.toFixed(d)}${atr > rawAtr ? ` floored at twice the ${spec.spread}-pip spread` : ""}${nearestSupport ? ` and support ${nearestSupport.toFixed(d)}` : ""})`,
    `- first objective ${target1.toFixed(d)} (1:1), second ${target2.toFixed(d)} (1:2)`,
  ].join("\n");

  const context = [
    "CONTEXT — the only facts you may state:",
    "",
    `SESSION: ${session}`,
    "",
    `INSTRUMENT (${pair}, ${tf} candles):\n${instrumentContext(read)}`,
    "",
    geometry,
    "",
    journalToContext(journal),
    "",
    "COMMUNITY POSITIONING: not measured — do not cite any.",
  ].join("\n");

  const ask = [
    `Write a worked example for study on ${pair} at ${tf}, about 160 words. It is never a signal.`,
    "Structure it with bold labels: **Structure.**, **Radar.**, **Your record.**, **Session.**, **Worked risk example.**, **How it fails.**",
    "In the risk example use a $1,000 account risking 2% ($20) and quote the geometry given above verbatim.",
    "In 'Your record' use the reader's own aggregated figures and say plainly if this instrument or this hour is one they lose on.",
    "In 'How it fails' name the specific condition that would invalidate the structure.",
    read.quote.isReal ? "" : "State clearly that this instrument returned modelled data, not a real quote.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callAI(SYSTEM_PROMPT, `${context}\n\n${ask}`, 700);
  if (!result) {
    return NextResponse.json(
      { available: false, provider: "Local", note: "AI unavailable — composed locally" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      available: true,
      provider: result.provider,
      idea: `${result.text}\n\nWorked example for study. Never a signal or recommendation. ${DISCLAIMER}`,
      pair,
      timeframe: tf,
      realPrice: price,
      isReal: read.quote.isReal,
      source: read.quote.source,
      bars: read.quote.bars,
      entry: price,
      stop,
      stopPips,
      target1,
      target2,
      rr1: 1,
      rr2: 2,
      confidence: read.patterns[0]?.confidence ?? null,
      sources: buildSources({
        quotes: [read.quote],
        patternCount: read.patterns.length,
        journal: journal ? { totalTrades: journal.totalTrades, isReal: journal.isReal } : null,
        extra: ["Auto S/R", "Session clock"],
      }),
      session,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

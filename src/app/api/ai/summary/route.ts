import { NextResponse } from "next/server";
import { SYSTEM_PROMPT, callAI, hasOpenAIKey, journalToContext, type JournalAggregate } from "@/lib/aiProvider";
import { AI_MAJORS, buildSources, instrumentContext, patternContext, readMarket, sessionContext } from "@/lib/aiContext";
import { DISCLAIMER } from "@/lib/ai";

export const runtime = "edge";

/**
 * A written read of the session, narrated by the model from real quotes, real
 * patterns and the reader's aggregated book. Without a key the client composes
 * the same material itself.
 */

export async function POST(request: Request) {
  if (!hasOpenAIKey()) {
    return NextResponse.json({ available: false, provider: "Local" }, { headers: { "Cache-Control": "no-store" } });
  }

  let journal: JournalAggregate | null = null;
  try {
    const body = (await request.json()) as { journal?: JournalAggregate | null };
    journal = body.journal ?? null;
  } catch {
    /* the summary is still useful without a book */
  }

  const { line: session } = sessionContext();
  const market = await readMarket(AI_MAJORS, "1H");
  const quotes = market.reads.map((r) => r.quote);

  const context = [
    "CONTEXT — the only facts you may state:",
    "",
    `SESSION: ${session}`,
    "",
    `INSTRUMENTS:\n${market.reads.map(instrumentContext).join("\n")}`,
    "",
    patternContext(market.patterns),
    "",
    journalToContext(journal),
  ].join("\n");

  const ask = [
    "Write the session read for the dashboard, about 130 words.",
    "Cover, in this order and each as its own short paragraph led by a bold label:",
    "**Session.** what is open and what opens next.",
    "**FX.** the currency pairs and where they sit against their own levels.",
    "**Metals & crypto.** gold and bitcoin.",
    "**Radar.** what the scanner found, naming the highest-confidence one.",
    "**Your book.** the reader's own aggregated behaviour and the single habit that costs them most.",
    "Be specific with the figures given. Do not invent any.",
  ].join("\n");

  const result = await callAI(SYSTEM_PROMPT, `${context}\n\n${ask}`, 600);
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
      summary: `${result.text}\n\n${DISCLAIMER}`,
      sources: buildSources({
        quotes,
        patternCount: market.patterns.length,
        journal: journal ? { totalTrades: journal.totalTrades, isReal: journal.isReal } : null,
        extra: ["Session clock"],
      }),
      session,
      patternCount: market.patterns.length,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

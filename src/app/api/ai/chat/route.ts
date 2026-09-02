import { NextResponse } from "next/server";
import { SYSTEM_PROMPT, callAI, hasOpenAIKey, journalToContext, type JournalAggregate } from "@/lib/aiProvider";
import {
  AI_MAJORS, buildSources, instrumentContext, patternContext, readInstrument, readMarket, sessionContext,
} from "@/lib/aiContext";
import { PAIRS } from "@/lib/market";
import { COMMANDS } from "@/lib/aiCommandList";

export const runtime = "edge";

/**
 * Narrated answers for the market assistant.
 *
 * When no key is configured this returns `available: false` immediately, before
 * doing any upstream work, and the client answers from the deterministic command
 * engine instead — which reads the same real data without a model. The LLM is an
 * upgrade to the writing, never the source of the facts.
 */

const MAX_MESSAGE = 500;
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, { at: number; body: unknown }>();

function cached(key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
  return null;
}

function store(key: string, body: unknown) {
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 200) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

export async function GET() {
  return NextResponse.json(
    { available: hasOpenAIKey(), model: hasOpenAIKey() ? "gpt-4o-mini" : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Which instrument, if any, the question is about. */
function detectSymbol(message: string): string | null {
  const m = message.toUpperCase();
  for (const p of PAIRS) {
    if (m.includes(p.symbol) || m.includes(p.symbol.replace("/", ""))) return p.symbol;
  }
  if (/\b(GOLD|XAU|BULLION)\b/.test(m)) return "XAU/USD";
  if (/\b(BITCOIN|BTC)\b/.test(m)) return "BTC/USD";
  if (/\b(EURO|EUR)\b/.test(m)) return "EUR/USD";
  if (/\b(CABLE|STERLING|POUND|GBP)\b/.test(m)) return "GBP/USD";
  if (/\b(YEN|JPY)\b/.test(m)) return "USD/JPY";
  return null;
}

export async function POST(request: Request) {
  if (!hasOpenAIKey()) {
    return NextResponse.json({ available: false, provider: "Local" }, { headers: { "Cache-Control": "no-store" } });
  }

  let body: { message?: string; journal?: JournalAggregate | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ available: false, provider: "Local", error: "bad request" }, { status: 400 });
  }

  const message = (body.message ?? "").toString().slice(0, MAX_MESSAGE).trim();
  if (!message) {
    return NextResponse.json({ available: false, provider: "Local", error: "empty message" }, { status: 400 });
  }
  const journal = body.journal ?? null;

  const key = `${message.toLowerCase()}|${journal?.totalTrades ?? 0}|${journal?.netPL ?? 0}|${Math.floor(Date.now() / CACHE_TTL_MS)}`;
  const hit = cached(key);
  if (hit) return NextResponse.json(hit, { headers: { "Cache-Control": "no-store" } });

  const isHelp = /^\/(help|commands|\?)\b/i.test(message);
  const symbol = isHelp ? null : detectSymbol(message);
  const { line: session } = sessionContext();

  // A named instrument gets a deep read; a broad question gets the majors.
  // `/help` needs neither, so it skips the upstream calls entirely.
  const focus = symbol ? await readInstrument(symbol, "1H") : null;
  const market = isHelp
    ? { reads: [], patterns: [] }
    : await readMarket(symbol ? AI_MAJORS.filter((s) => s !== symbol).slice(0, 3) : AI_MAJORS, "1H");

  const quotes = [...(focus ? [focus.quote] : []), ...market.reads.map((r) => r.quote)];
  const patterns = [...(focus?.patterns ?? []), ...market.patterns];

  const context = [
    "CONTEXT — these are the only facts you may state. Do not add numbers of your own.",
    "",
    `SESSION: ${session}`,
    "",
    focus ? `FOCUS INSTRUMENT:\n${instrumentContext(focus)}` : "",
    "",
    `OTHER INSTRUMENTS:\n${market.reads.map(instrumentContext).join("\n")}`,
    "",
    patternContext(patterns),
    "",
    journalToContext(journal),
    "",
    "COMMUNITY POSITIONING: not measured. The platform has no live positioning feed — say so if asked rather than quoting a percentage.",
  ]
    .filter(Boolean)
    .join("\n");

  const vocabulary = COMMANDS.map((c) => `${c.cmd}${c.args ? ` ${c.args}` : ""} — ${c.what}`).join("\n");
  const commandHelp = isHelp
    ? [
        "",
        "",
        "The reader asked for the command list. Open with one short line, then list exactly these and nothing else,",
        "one per line, each starting with a dash and wrapping the command itself in backticks:",
        vocabulary,
      ].join("\n")
    : message.startsWith("/")
      ? `\n\nThe reader typed a slash command. Answer it directly and completely from the context above. The full vocabulary is: ${COMMANDS.map((c) => c.cmd).join(", ")}.`
      : "";

  const result = await callAI(SYSTEM_PROMPT, `${context}\n\nREADER: ${message}${commandHelp}`, 700);

  if (!result) {
    // Quota, timeout or a malformed reply — the client falls back rather than
    // showing an error, because the local engine can still answer this.
    return NextResponse.json(
      { available: false, provider: "Local", note: "AI unavailable — answered locally" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const payload = {
    available: true,
    provider: result.provider,
    answer: result.text,
    sources: isHelp
      ? ["GFXA command reference"]
      : buildSources({
          quotes,
          patternCount: patterns.length,
          journal: journal ? { totalTrades: journal.totalTrades, isReal: journal.isReal } : null,
          extra: ["Session clock"],
        }),
    session,
    patternCount: patterns.length,
    symbol,
  };

  store(key, payload);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

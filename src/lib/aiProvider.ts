/**
 * LLM provider for the market assistant.
 *
 * The model is a writer, never a source. Every figure it is allowed to use is
 * computed server-side from the market provider, the pattern scanner and the
 * reader's aggregated journal, then handed to it in the prompt with an explicit
 * instruction not to invent numbers. The `sources` line shown in the UI is
 * assembled in code, not by the model, so it cannot be embellished.
 *
 * With no key configured this returns null and callers fall back to the
 * deterministic command engine, which answers from the same real data without
 * an LLM at all.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 20_000;

export type AiProvider = "OpenAI" | "Local";

export interface AiResult {
  text: string;
  provider: AiProvider;
  note?: string;
}

export function hasOpenAIKey(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export const SYSTEM_PROMPT = [
  "You are GFXA AI, the market assistant inside Global FX Alliance.",
  "",
  "HARD RULES",
  "- Educational only. Never financial advice, never a signal, never 'buy' or 'sell' instructions.",
  "- You explain structure; you do not tell anyone what to trade.",
  "- Use ONLY the figures given in the CONTEXT block. Never invent or estimate a price, level, win rate, percentage or date. If a figure is not in the context, say it is unavailable.",
  "- Do not restate a number with different precision than given.",
  "- Never claim other traders are watching something, and never cite community positioning as measured — the platform has no live positioning feed.",
  "",
  "STYLE",
  "- Direct and specific, like a desk analyst briefing a colleague. No hype, no emoji.",
  "- Reference the reader's own aggregated stats when they are relevant — worst hour, weak pair, revenge sizing, hold-time asymmetry. That personal read is the point.",
  "- Use **bold** for figures that matter and '- ' for bullets. Keep under 220 words unless asked otherwise.",
  "- Do not append a Sources line; the interface adds one.",
].join("\n");

/**
 * Calls the model. Returns null on any failure — missing key, quota, timeout,
 * malformed response — so the caller can fall back rather than surface an error.
 */
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 700
): Promise<AiResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return { text, provider: "OpenAI" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------- context types */

/**
 * Aggregated journal statistics only.
 *
 * Individual trades never reach this shape and never leave the browser — the
 * reader's statement is parsed client-side and only these rollups are sent.
 */
export interface JournalAggregate {
  totalTrades: number;
  winRate: number;
  netPL: number;
  isReal: boolean;
  bestHourDubai?: { hour: string; winRate: number; trades: number; net: number } | null;
  worstHourDubai?: { hour: string; winRate: number; trades: number; net: number } | null;
  bestPair?: { symbol: string; winRate: number; trades: number; net: number } | null;
  worstPair?: { symbol: string; winRate: number; trades: number; net: number } | null;
  bestSession?: { name: string; winRate: number; net: number } | null;
  worstSession?: { name: string; winRate: number; net: number } | null;
  avgWinHoldMin?: number | null;
  avgLossHoldMin?: number | null;
  holdsLosersLonger?: boolean;
  revengeDetected?: boolean;
  revengeFrom?: number | null;
  revengeTo?: number | null;
  lastLoss?: {
    symbol: string; side: string; lots: number; net: number;
    closedUTC: string | null; dubaiHour: string | null; heldMinutes: number | null;
  } | null;
}

/** Renders the aggregate as prompt text. Omits anything absent rather than guessing. */
export function journalToContext(j: JournalAggregate | null | undefined): string {
  if (!j || !j.totalTrades) return "JOURNAL: none imported.";
  const money = (n: number) => `${n < 0 ? "-" : "+"}$${Math.abs(n).toFixed(2)}`;
  const lines = [
    `JOURNAL (${j.isReal ? "the reader's own imported statement" : "a sample statement, not their real history"}):`,
    `- ${j.totalTrades} trades, ${j.winRate.toFixed(0)}% win rate, ${money(j.netPL)} net`,
  ];
  if (j.bestHourDubai) lines.push(`- best hour ${j.bestHourDubai.hour}:00 Dubai — ${j.bestHourDubai.winRate.toFixed(0)}% over ${j.bestHourDubai.trades} trades, ${money(j.bestHourDubai.net)}`);
  if (j.worstHourDubai) lines.push(`- worst hour ${j.worstHourDubai.hour}:00 Dubai — ${j.worstHourDubai.winRate.toFixed(0)}% over ${j.worstHourDubai.trades} trades, ${money(j.worstHourDubai.net)}`);
  if (j.bestPair) lines.push(`- best instrument ${j.bestPair.symbol} — ${j.bestPair.winRate.toFixed(0)}% over ${j.bestPair.trades}, ${money(j.bestPair.net)}`);
  if (j.worstPair) lines.push(`- worst instrument ${j.worstPair.symbol} — ${j.worstPair.winRate.toFixed(0)}% over ${j.worstPair.trades}, ${money(j.worstPair.net)}`);
  if (j.bestSession) lines.push(`- best session by money ${j.bestSession.name} (${money(j.bestSession.net)}, ${j.bestSession.winRate.toFixed(0)}% win rate)`);
  if (j.worstSession) lines.push(`- worst session by money ${j.worstSession.name} (${money(j.worstSession.net)}, ${j.worstSession.winRate.toFixed(0)}%)`);
  if (j.avgWinHoldMin != null && j.avgLossHoldMin != null)
    lines.push(`- holds winners ${j.avgWinHoldMin}m vs losers ${j.avgLossHoldMin}m${j.holdsLosersLonger ? " (losers held materially longer)" : ""}`);
  if (j.revengeDetected) lines.push(`- revenge sizing present: size went ${j.revengeFrom} -> ${j.revengeTo} lots after three consecutive losses`);
  if (j.lastLoss)
    lines.push(
      `- most recent loss: ${j.lastLoss.symbol} ${j.lastLoss.side} ${j.lastLoss.lots} lots, ${money(j.lastLoss.net)}, closed ${j.lastLoss.closedUTC ?? "unknown"} UTC${j.lastLoss.dubaiHour ? ` (${j.lastLoss.dubaiHour}:00 Dubai)` : ""}${j.lastLoss.heldMinutes != null ? `, held ${j.lastLoss.heldMinutes}m` : ""}`
    );
  return lines.join("\n");
}

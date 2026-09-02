"use client";

import { DISCLAIMER, answer, detectPair } from "./ai";
import { getBestWorst, getJournalContext, getLastLoss, getPairStats } from "./journalStore";
import { getCurrentSessionInfo, getGreeting, humanMinutes } from "./sessionTime";
import { SENTIMENT } from "./data";
import { getPair } from "./market";

/**
 * Slash-command layer for the market assistant.
 *
 * Everything answered here is grounded in something the app can actually show:
 * real quotes and candles from the market endpoint, real patterns from the
 * radar, the reader's own imported statement, and the session clock. Where a
 * number is illustrative rather than measured it is labelled in the response
 * itself, because an assistant that quietly invents community data is worse
 * than one that admits it has none.
 */

export interface CommandResult {
  isCommand: boolean;
  text: string;
  sources: string[];
}

export { COMMANDS, type CommandDef } from "./aiCommandList";
import { COMMANDS } from "./aiCommandList";

const j2 = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

interface MarketResp {
  pair: string; price: number; changePct: number; decimals: number;
  source: string; symbolUsed: string | null; isReal: boolean; bars: number;
}
interface PatternResp {
  patterns: { symbol: string; type: string; direction: string; confidence: string; description: string; price: number; timeframe: string }[];
  isReal: boolean;
}
interface NewsResp {
  stories: { title: string; source: string; timeAgo: string; sentiment: string; symbols: string[] }[];
  isReal: boolean;
  provider: string;
}

/** Journal-only commands answer instantly; the rest fetch live context. */
export async function runCommand(rawInput: string): Promise<CommandResult> {
  const input = rawInput.trim();
  const lower = input.toLowerCase();
  const notCommand: CommandResult = { isCommand: false, text: "", sources: [] };
  if (!input.startsWith("/")) return notCommand;

  const bw = getBestWorst();
  const journalTag = bw.isReal
    ? `Your journal (${bw.count} trades)`
    : `Sample journal (${bw.count} demo trades — import your own in Journal Analytics)`;

  /* ------------------------------------------------------------- /help */
  if (/^\/help\b/.test(lower)) {
    return {
      isCommand: true,
      sources: [],
      text: [
        "**COMMANDS**",
        ...COMMANDS.map((c) => `- \`${c.cmd}${c.args ? " " + c.args : ""}\` — ${c.what}`),
        "",
        "Anything not starting with `/` is treated as a normal question. I explain structure — I don't hand out signals.",
      ].join("\n"),
    };
  }

  /* ------------------------------------------------------ /explain last loss */
  if (/^\/explain\s+last\s+loss/.test(lower)) {
    const loss = getLastLoss();
    if (!loss) {
      return { isCommand: true, sources: [journalTag], text: "No losing trades in the loaded history." };
    }
    const closed = loss.closeTime ? new Date(loss.closeTime) : null;
    const dubaiHour = closed ? String((closed.getUTCHours() + 4) % 24).padStart(2, "0") : null;
    const worstHour = bw.worstHourDubai;
    const atWorstHour = dubaiHour !== null && worstHour?.key === dubaiHour;
    const pairStats = getPairStats(loss.symbol);

    const mkt = await getJSON<MarketResp>(`/api/market/live?pair=${encodeURIComponent(loss.symbol)}`);
    const pat = await getJSON<PatternResp>(`/api/patterns/live?symbols=${encodeURIComponent(loss.symbol)}`);
    const relevant = pat?.patterns?.filter((p) => p.symbol === loss.symbol) ?? [];

    const lines = [
      `**Your last loss — ${loss.symbol} ${loss.type} ${loss.lot} lots**`,
      "",
      `Closed ${closed ? closed.toISOString().slice(0, 16).replace("T", " ") : "—"} UTC${dubaiHour ? ` (${dubaiHour}:00 Dubai)` : ""} for **${money(loss.net)}**${loss.durationMinutes !== null ? `, held ${loss.durationMinutes}m` : ""}.`,
      "",
      "**What the history says**",
      atWorstHour
        ? `- That is your **worst hour** — ${worstHour?.winRate.toFixed(0)}% win rate across ${worstHour?.trades} trades for ${money(worstHour?.net ?? 0)}.`
        : worstHour
          ? `- Not your worst hour (that is ${worstHour.key}:00 Dubai at ${worstHour.winRate.toFixed(0)}%).`
          : "",
      pairStats
        ? `- On ${loss.symbol} overall you are ${pairStats.winRate.toFixed(0)}% across ${pairStats.trades} trades for ${money(pairStats.net)}.`
        : "",
      bw.holdsLosersLonger && loss.durationMinutes !== null && bw.avgWinHold
        ? `- You hold losers ~${((bw.avgLossHold ?? 0) / Math.max(bw.avgWinHold, 1)).toFixed(1)}× longer than winners (${bw.avgWinHold}m vs ${bw.avgLossHold}m). This one ran ${loss.durationMinutes}m.`
        : "",
      bw.revenge.detected
        ? `- **Revenge sizing is present in this history** — after three consecutive losses size went from ${bw.revenge.occurrences[0]?.from} to ${bw.revenge.occurrences[0]?.to} lots. That is the pattern that turns a bad day into a bad month.`
        : "",
      "",
      "**Where price is now**",
      mkt
        ? `- ${mkt.pair} ${mkt.price.toFixed(mkt.decimals)} (${j2(mkt.changePct)}%)${mkt.isReal ? ` — real ${mkt.symbolUsed}` : " — modelled"}.`
        : "- Live price unavailable right now.",
      relevant.length
        ? `- Radar currently flags: ${relevant.slice(0, 2).map((p) => `${p.type} (${p.confidence})`).join(", ")}.`
        : "- No pattern flagged on this instrument right now.",
      "",
      `This is a read of what happened, not a verdict on the trade. ${DISCLAIMER}`,
    ].filter(Boolean);

    return {
      isCommand: true,
      text: lines.join("\n"),
      sources: [
        journalTag,
        mkt?.isReal ? `Yahoo ${mkt.symbolUsed} real` : "Modelled price",
        relevant.length ? `Pattern Radar (${relevant.length})` : "Pattern Radar",
      ],
    };
  }

  /* ------------------------------------------------------------- /my best hour */
  if (/^\/my\s+best\s+hour/.test(lower) || /^\/my\s+hours?/.test(lower)) {
    const b = bw.bestHourDubai;
    const w = bw.worstHourDubai;
    if (!b && !w) return { isCommand: true, sources: [journalTag], text: "Not enough trades to rank hours yet." };
    return {
      isCommand: true,
      sources: [journalTag],
      text: [
        "**Your hours — Dubai time (UTC+4)**",
        "",
        b ? `- **Best ${b.key}:00** — ${b.winRate.toFixed(0)}% win rate over ${b.trades} trades, ${money(b.net)}.` : "",
        w ? `- **Worst ${w.key}:00** — ${w.winRate.toFixed(0)}% win rate over ${w.trades} trades, ${money(w.net)}.` : "",
        "",
        w && w.net < 0
          ? `Not trading ${w.key}:00 at all would have changed your net by ${money(-w.net)} across this history. Hours are only ranked where there are at least three trades.`
          : "Hours are only ranked where there are at least three trades.",
        "",
        DISCLAIMER,
      ].filter(Boolean).join("\n"),
    };
  }

  /* ------------------------------------------------------------ /my worst pair */
  if (/^\/my\s+(worst|best)\s+pair/.test(lower)) {
    const wantWorst = /worst/.test(lower);
    const t = wantWorst ? bw.worstPair : bw.bestPair;
    if (!t) return { isCommand: true, sources: [journalTag], text: "Not enough trades to rank instruments yet." };
    return {
      isCommand: true,
      sources: [journalTag],
      text: [
        `**Your ${wantWorst ? "worst" : "best"} instrument — ${t.key}**`,
        "",
        `- ${t.winRate.toFixed(0)}% win rate across ${t.trades} trades for **${money(t.net)}**.`,
        wantWorst && t.net < 0 ? `- Removing ${t.key} entirely would have changed your net by ${money(-t.net)}.` : "",
        bw.bestPair && wantWorst ? `- Your best is ${bw.bestPair.key} at ${bw.bestPair.winRate.toFixed(0)}%.` : "",
        "",
        DISCLAIMER,
      ].filter(Boolean).join("\n"),
    };
  }

  /* --------------------------------------------------------------- /my revenge */
  if (/^\/my\s+revenge/.test(lower)) {
    const r = bw.revenge;
    return {
      isCommand: true,
      sources: [journalTag],
      text: r.detected
        ? [
            "**Revenge sizing — detected**",
            "",
            ...r.occurrences.map(
              (o) => `- ${o.at ? o.at.slice(0, 10) : "unknown date"}: size went **${o.from} → ${o.to} lots** immediately after three consecutive losses.`
            ),
            "",
            bw.overtrading.detected
              ? `Overtrading is present too — ${bw.overtrading.count} closes inside one hour.`
              : "No overtrading clusters alongside it.",
            "",
            `Sizing up to recover a loss changes the maths against you: a bigger position needs a smaller adverse move to do real damage. ${DISCLAIMER}`,
          ].join("\n")
        : [
            "**Revenge sizing — not detected**",
            "",
            "No case in this history where size jumped more than 50% straight after three consecutive losses.",
            "",
            DISCLAIMER,
          ].join("\n"),
    };
  }

  /* ------------------------------------------------------------------ /session */
  if (/^\/session/.test(lower)) {
    const info = getCurrentSessionInfo(new Date(), bw.bySession.map((s) => ({ key: s.key, winRate: s.winRate, trades: s.trades })));
    return {
      isCommand: true,
      sources: [journalTag, "Session clock"],
      text: [
        `**${info.dubaiClock} Dubai — session board**`,
        "",
        ...info.sessions.map((s) => {
          const state =
            s.status === "ACTIVE"
              ? `ACTIVE, closes in ${humanMinutes(s.minutesToClose)}`
              : s.status === "UPCOMING"
                ? `opens in ${humanMinutes(s.minutesToOpen)}`
                : "closed";
          const mine = s.personalWinRate !== null ? ` · you ${s.personalWinRate.toFixed(0)}% over ${s.personalTrades}` : "";
          return `- **${s.name}** — ${state}${mine}`;
        }),
        "",
        // Sessions are ranked by net P/L, so the sentence must quote net — reporting
        // "strongest" alongside a lower win rate than the "weakest" reads as a bug.
        bw.bestSession && bw.worstSession
          ? `By money, your best session is **${bw.bestSession.key}** (${money(bw.bestSession.net)}, ${bw.bestSession.winRate.toFixed(0)}% win rate) and your worst is **${bw.worstSession.key}** (${money(bw.worstSession.net)}, ${bw.worstSession.winRate.toFixed(0)}%). Win rate and profit do not always agree — a high win rate with small wins can still lose money.`
          : "",
        "",
        DISCLAIMER,
      ].filter(Boolean).join("\n"),
    };
  }

  /* ------------------------------------------------------------ /pattern radar */
  if (/^\/pattern(\s+radar)?/.test(lower)) {
    const symbol = detectPair(input, "EUR/USD");
    const pat = await getJSON<PatternResp>(`/api/patterns/live?symbols=${encodeURIComponent(symbol)}`);
    const found = pat?.patterns?.filter((p) => p.symbol === symbol) ?? [];
    return {
      isCommand: true,
      sources: [pat?.isReal ? "Pattern Radar · real Yahoo OHLC" : "Pattern Radar · modelled"],
      text: found.length
        ? [
            `**Pattern Radar — ${symbol}**`,
            "",
            ...found.map(
              (p) => `- **${p.type}** (${p.confidence}) on ${p.timeframe} at ${p.price} — ${p.description}`
            ),
            "",
            `A pattern is an observation, not a prediction. ${DISCLAIMER}`,
          ].join("\n")
        : `**Pattern Radar — ${symbol}**\n\nNothing flagged on ${symbol} right now, which usually means it is ranging.\n\n${DISCLAIMER}`,
    };
  }

  /* ------------------------------------------------- /community sentiment */
  if (/^\/community/.test(lower)) {
    const symbol = detectPair(input, "EUR/USD");
    const bull = SENTIMENT.find((s) => s.label === "Bullish")?.value ?? 0;
    const bear = SENTIMENT.find((s) => s.label === "Bearish")?.value ?? 0;
    const neutral = SENTIMENT.find((s) => s.label === "Neutral")?.value ?? 0;
    return {
      isCommand: true,
      sources: ["Illustrative aggregate — not live member positioning"],
      text: [
        `**Community positioning — ${symbol}**`,
        "",
        `- Bullish ${bull}% · Neutral ${neutral}% · Bearish ${bear}%`,
        "",
        "**These are illustrative figures, not a live poll.** The Alliance has no member-positioning feed yet, so this is a placeholder shape rather than a measurement — treat it as UI, not data. Real aggregates will appear here once there are members to aggregate.",
        "",
        `For something measured, try \`/pattern radar ${symbol}\` — that reads real price. ${DISCLAIMER}`,
      ].join("\n"),
    };
  }

  /* ---------------------------------------------------------------- /why moved */
  if (/^\/why/.test(lower)) {
    const symbol = detectPair(input, "EUR/USD");
    const p = getPair(symbol);
    const [mkt, news, pat] = await Promise.all([
      getJSON<MarketResp>(`/api/market/live?pair=${encodeURIComponent(symbol)}`),
      getJSON<NewsResp>(`/api/news/live?pair=${encodeURIComponent(symbol)}&limit=4`),
      getJSON<PatternResp>(`/api/patterns/live?symbols=${encodeURIComponent(symbol)}`),
    ]);
    const found = pat?.patterns?.filter((x) => x.symbol === symbol) ?? [];
    const mine = getPairStats(symbol);

    return {
      isCommand: true,
      sources: [
        mkt?.isReal ? `Yahoo ${mkt.symbolUsed} real (${mkt.bars} bars)` : "Modelled price",
        news?.isReal ? `${news.provider} live` : "Curated headlines",
        "Pattern Radar",
        journalTag,
      ],
      text: [
        `**${symbol} — what is behind the move**`,
        "",
        mkt
          ? `**Price.** ${mkt.price.toFixed(mkt.decimals)}, ${j2(mkt.changePct)}% ${mkt.isReal ? `on real ${mkt.symbolUsed} data` : "on modelled data"}.`
          : "**Price.** Unavailable right now.",
        "",
        "**Wire.**",
        ...(news?.stories?.length
          ? news.stories.slice(0, 3).map((s) => `- ${s.title} — ${s.source}, ${s.timeAgo} (${s.sentiment})`)
          : ["- No headlines tagged to this instrument right now."]),
        "",
        "**Structure.**",
        ...(found.length
          ? found.slice(0, 3).map((x) => `- ${x.type} (${x.confidence}) at ${x.price} — ${x.description}`)
          : ["- Nothing flagged by the radar on this instrument."]),
        "",
        mine
          ? `**You on ${symbol}.** ${mine.winRate.toFixed(0)}% win rate across ${mine.trades} trades for ${money(mine.net)}.`
          : `**You on ${symbol}.** No trades on this instrument in the loaded history.`,
        "",
        `${p.name}. ${DISCLAIMER}`,
      ].join("\n"),
    };
  }

  /* --------------------------------------------------------------- unknown */
  return {
    isCommand: true,
    sources: [],
    text: `\`${input.split(/\s+/)[0]}\` isn't a command I know. Type \`/help\` for the list.`,
  };
}

/** Free-text questions, enriched with whatever real context matches. */
export async function answerWithContext(question: string): Promise<CommandResult> {
  const base = answer(question);
  const symbol = detectPair(question, "");
  if (!symbol) return { isCommand: false, text: base, sources: [] };

  const [mkt, pat] = await Promise.all([
    getJSON<MarketResp>(`/api/market/live?pair=${encodeURIComponent(symbol)}`),
    getJSON<PatternResp>(`/api/patterns/live?symbols=${encodeURIComponent(symbol)}`),
  ]);
  const found = pat?.patterns?.filter((x) => x.symbol === symbol) ?? [];
  const mine = getPairStats(symbol);
  const ctx = getJournalContext();

  const extra = [
    "",
    "---",
    mkt ? `**Live now.** ${mkt.pair} ${mkt.price.toFixed(mkt.decimals)} (${j2(mkt.changePct)}%)${mkt.isReal ? ` — real ${mkt.symbolUsed}` : ""}.` : "",
    found.length ? `**Radar.** ${found.slice(0, 2).map((x) => `${x.type} (${x.confidence})`).join(", ")}.` : "",
    mine ? `**Your record.** ${mine.winRate.toFixed(0)}% over ${mine.trades} trades, ${money(mine.net)}${ctx.isReal ? "" : " (sample statement)"}.` : "",
  ].filter(Boolean);

  return {
    isCommand: false,
    text: base + (extra.length > 2 ? "\n" + extra.join("\n") : ""),
    sources: [
      mkt?.isReal ? `Yahoo ${mkt.symbolUsed} real` : "",
      found.length ? "Pattern Radar" : "",
      mine ? (ctx.isReal ? `Your journal (${ctx.count})` : `Sample journal (${ctx.count})`) : "",
    ].filter(Boolean),
  };
}

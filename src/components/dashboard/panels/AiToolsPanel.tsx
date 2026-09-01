"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, BookOpen, ChevronRight, Eraser, FileText, Lightbulb, Loader2, Radar, Sparkles,
} from "lucide-react";
import { Card, CardHead, PanelHeader, Select, Skeleton, Toast } from "@/components/ui/Primitives";
import { DISCLAIMER } from "@/lib/ai";
import { COMMANDS, answerWithContext, runCommand } from "@/lib/aiCommands";
import { getBestWorst, getPairStats } from "@/lib/journalStore";
import { getCurrentSessionInfo, getGreeting, humanMinutes, type SessionInfo } from "@/lib/sessionTime";
import { PAIRS } from "@/lib/market";
import { KEYS, usePersistentState } from "@/lib/storage";
import { EVENTS, trackEvent } from "@/lib/analytics";
import { tabHref } from "@/lib/tabs";

/** Signed currency. Written once because the inline form was dropping the minus
 *  sign on negative values, which turned a losing book into a winning one. */
const signedMoney = (n: number) => `${n < 0 ? "-" : "+"}$${Math.abs(n).toFixed(2)}`;

interface Msg {
  role: "user" | "ai";
  text: string;
  sources?: string[];
  at?: string;
}

const GREETING_MSG: Msg = {
  role: "ai",
  text: "Ask me about a pair, today's calendar, or what is driving the dollar. I explain structure — I don't hand out signals. Type `/help` for what I can read.",
};

/** Renders **bold**, `code` and `- ` bullets — the only markup the engine emits. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <span key={i} className="block h-2.5" />;
        if (/^---+$/.test(line.trim()))
          return <span key={i} className="my-2 block h-px bg-[#00ff88]/15" />;
        const bullet = line.startsWith("- ");
        const content = bullet ? line.slice(2) : line;
        const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        const rendered = parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={j} className="font-semibold text-[#fbbf24]">{p.slice(2, -2)}</strong>
          ) : p.startsWith("`") && p.endsWith("`") ? (
            <code key={j} className="rounded bg-[#00ff88]/10 px-1 text-[#00ff88]">{p.slice(1, -1)}</code>
          ) : (
            <span key={j}>{p}</span>
          )
        );
        return bullet ? (
          <span key={i} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#00ff88]" aria-hidden />
            <span>{rendered}</span>
          </span>
        ) : (
          <span key={i} className="block">{rendered}</span>
        );
      })}
    </>
  );
}

export function AiToolsPanel() {
  const { value: history, setValue: setHistory, hydrated } = usePersistentState<Msg[]>(
    KEYS.chat,
    [GREETING_MSG]
  );
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [journal, setJournal] = useState<ReturnType<typeof getBestWorst> | null>(null);
  const [radar, setRadar] = useState<{ symbol: string; type: string; confidence: string; price: number }[]>([]);

  // Session clock + journal context, refreshed once a minute.
  useEffect(() => {
    const tick = () => {
      const bw = getBestWorst();
      setJournal(bw);
      setSession(
        getCurrentSessionInfo(
          new Date(),
          bw.bySession.map((s) => ({ key: s.key, winRate: s.winRate, trades: s.trades }))
        )
      );
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/patterns/live");
        if (!r.ok) return;
        const j = await r.json();
        if (alive && Array.isArray(j.patterns)) setRadar(j.patterns.slice(0, 6));
      } catch {
        /* radar is optional context */
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [history, thinking]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1900);
  };

  const send = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || thinking) return;

      if (/^\/clear$/i.test(q)) {
        setHistory([GREETING_MSG]);
        setInput("");
        flash("Conversation cleared");
        return;
      }

      setHistory((prev) => [...prev, { role: "user", text: q, at: new Date().toISOString() }]);
      setInput("");
      setThinking(true);
      trackEvent(EVENTS.terminalQuery, { query: q.slice(0, 80), surface: "ai-tools" });

      try {
        const res = q.startsWith("/") ? await runCommand(q) : await answerWithContext(q);
        setHistory((prev) => [
          ...prev,
          { role: "ai", text: res.text, sources: res.sources, at: new Date().toISOString() },
        ]);
      } catch {
        setHistory((prev) => [
          ...prev,
          { role: "ai", text: "Something went wrong reading that. Try again, or `/help` for the command list." },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [setHistory, thinking]
  );

  /* --------------------------------------------- prompts from real context */
  const prompts = useMemo(() => {
    const out: string[] = [];
    if (journal?.worstPair && journal.worstPair.net < 0) out.push(`/my worst pair`);
    const high = radar.find((p) => p.confidence === "high");
    if (high) out.push(`/pattern radar ${high.symbol}`);
    if (journal?.worstHourDubai) out.push("/my best hour");
    if (session?.active.length || session?.next) out.push("/session");
    if (journal?.revenge.detected) out.push("/my revenge");
    out.push("/explain last loss");
    out.push("/help");
    return Array.from(new Set(out)).slice(0, 6);
  }, [journal, radar, session]);

  const placeholder = journal
    ? journal.isReal
      ? `Ask about your last loss, your best hour, or why gold moved — I can read your ${journal.count} trades. Type /help`
      : `Ask about a pair, the session, or type /help — journal answers use a ${journal.count}-trade sample until you import your own`
    : "Ask AI…  (type /help)";

  return (
    <div className="space-y-5">
      <PanelHeader title="GFXA AI Tools" />

      {/* Session + greeting strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl glass px-4 py-3">
        {session ? (
          <>
            <span className="text-[13px] text-ink">{getGreeting(session)}</span>
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              {session.sessions.map((s) => (
                <span
                  key={s.name}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    s.status === "ACTIVE"
                      ? "border-brand-green/35 bg-brand-green/[0.1] text-brand-green"
                      : s.status === "UPCOMING"
                        ? "border-brand-blue/30 bg-brand-blue/[0.08] text-brand-blue"
                        : "border-white/[0.08] bg-white/[0.03] text-ink-muted"
                  }`}
                >
                  {s.status === "ACTIVE" ? (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-60 animate-pulseRing" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-green" />
                    </span>
                  ) : null}
                  {s.name}
                  {s.personalWinRate !== null ? (
                    <span className="num-mono opacity-80">{s.personalWinRate.toFixed(0)}%</span>
                  ) : null}
                </span>
              ))}
              <span className="num-mono rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-ink-muted">
                {session.dubaiClock} Dubai
              </span>
            </span>
          </>
        ) : (
          <Skeleton className="h-4 w-72" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* ------------------------------------------------------ assistant */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-[#00ff88]/20 bg-[#0a0a0a] shadow-glow">
          <header className="flex items-center justify-between gap-3 border-b border-[#00ff88]/15 px-5 py-4">
            <h3 className="flex items-center gap-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88]">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              Market Assistant
              {journal ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] ${
                    journal.isReal ? "bg-brand-green/[0.13] text-brand-green" : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
                  }`}
                >
                  {journal.isReal ? `JOURNAL ${journal.count}` : `SAMPLE ${journal.count}`}
                </span>
              ) : null}
            </h3>
            <button
              type="button"
              onClick={() => { setHistory([GREETING_MSG]); flash("Conversation cleared"); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#00ff88]/25 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#00ff88]/70 transition-all duration-200 hover:border-[#00ff88]/60 hover:text-[#00ff88]"
            >
              <Eraser className="h-3.5 w-3.5" strokeWidth={1.9} />
              Clear
            </button>
          </header>

          <div className="max-h-[540px] min-h-[340px] flex-1 space-y-3 overflow-y-auto bg-[#0a0a0a] p-5">
            {hydrated
              ? history.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[92%]">
                      <div
                        className={`rounded-lg px-4 py-3 font-mono text-[12.5px] leading-relaxed ${
                          m.role === "user"
                            ? "bg-[#2A7FFF] text-white"
                            : "border border-[#00ff88]/15 bg-[#00ff88]/[0.04] text-[#c8d0dc]"
                        }`}
                      >
                        <Rich text={m.text} />
                      </div>
                      {m.role === "ai" && m.sources?.length ? (
                        <p className="mt-1.5 px-1 font-mono text-[10px] leading-relaxed text-[#8A93A8]">
                          Sources: {m.sources.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              : null}

            {thinking ? (
              <div className="flex justify-start">
                <div className="flex gap-1.5 rounded-lg border border-[#00ff88]/15 bg-[#00ff88]/[0.04] px-4 py-3.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-pulseRing rounded-full bg-[#00ff88]" style={{ animationDelay: `${i * 0.16}s` }} />
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-[#00ff88]/15 p-5">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2 rounded-lg border border-[#00ff88]/25 bg-black/40 p-1.5 transition-colors duration-200 focus-within:border-[#00ff88]/60"
            >
              <span className="pl-2 font-mono text-[13px] font-bold text-[#00ff88]" aria-hidden>&gt;</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                aria-label="Ask the market assistant"
                className="min-w-0 flex-1 bg-transparent px-1 py-2 font-mono text-[13px] text-[#00ff88] placeholder:text-[#00ff88]/30 outline-none"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!input.trim() || thinking}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00ff88] text-black transition-all duration-200 hover:bg-[#4dffa8] active:scale-95 disabled:opacity-30"
              >
                {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.4} />}
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {prompts.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => send(c)}
                  className="rounded border border-[#00ff88]/20 px-2.5 py-1 text-left font-mono text-[11px] text-[#00ff88]/70 transition-all duration-200 hover:border-[#00ff88]/50 hover:text-[#00ff88]"
                >
                  {c}
                </button>
              ))}
            </div>

            <p className="mt-4 border-t border-[#00ff88]/10 pt-3.5 font-mono text-[10.5px] leading-relaxed text-[#fbbf24]/70">
              Answers are assembled from this platform&apos;s own data — real quotes, the pattern
              scanner, your imported statement and the session clock. Education &amp; market
              intelligence. Not financial advice.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------- side tools */}
        <div className="space-y-5">
          <MarketSummaryCard journal={journal} session={session} radar={radar} />
          <TradeIdeaCard journal={journal} session={session} />
          <Card>
            <CardHead title="Commands" icon={BookOpen} />
            <ul className="divide-y divide-white/[0.06]">
              {COMMANDS.slice(0, 7).map((c) => (
                <li key={c.cmd}>
                  <button
                    type="button"
                    onClick={() => send(`${c.cmd}${c.args ? " EUR/USD" : ""}`)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-200 hover:bg-white/[0.02]"
                  >
                    <code className="shrink-0 font-mono text-[11.5px] text-brand-blue">{c.cmd}</code>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">{c.what}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-muted/50" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

/* ------------------------------------------------------------ summary card */

function ActionRow({ pair }: { pair?: string }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.08] pt-4">
      <Link href={tabHref("market-analysis", pair)} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-ink transition-all duration-200 hover:border-brand-blue/40 hover:text-white">
        View chart
      </Link>
      <Link href={tabHref("journal-analytics")} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-ink transition-all duration-200 hover:border-brand-blue/40 hover:text-white">
        Check journal
      </Link>
      <Link href={tabHref("pattern-radar")} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-ink transition-all duration-200 hover:border-brand-blue/40 hover:text-white">
        Pattern radar
      </Link>
      <Link href={tabHref("discussions")} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-ink transition-all duration-200 hover:border-brand-blue/40 hover:text-white">
        Discuss
      </Link>
    </div>
  );
}

function MarketSummaryCard({
  journal, session, radar,
}: {
  journal: ReturnType<typeof getBestWorst> | null;
  session: SessionInfo | null;
  radar: { symbol: string; type: string; confidence: string; price: number }[];
}) {
  const [text, setText] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const majors = ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD"];
      const [quotes, news] = await Promise.all([
        Promise.all(
          majors.map(async (m) => {
            try {
              const r = await fetch(`/api/market/live?pair=${encodeURIComponent(m)}`);
              return r.ok ? await r.json() : null;
            } catch {
              return null;
            }
          })
        ),
        fetch("/api/news/live?limit=3").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      const live = quotes.filter(Boolean) as { pair: string; price: number; changePct: number; decimals: number; isReal: boolean; symbolUsed: string | null }[];
      const fx = live.filter((q) => !q.pair.startsWith("XAU") && !q.pair.startsWith("BTC"));
      const gold = live.find((q) => q.pair === "XAU/USD");
      const btc = live.find((q) => q.pair === "BTC/USD");
      const high = radar.filter((p) => p.confidence === "high");

      const lines = [
        session ? `**Session.** ${getGreeting(session)} ${session.active.map((s) => `${s.name}${s.personalWinRate !== null ? ` (you ${s.personalWinRate.toFixed(0)}%)` : ""}`).join(", ")}${session.next ? ` · ${session.next.name} opens in ${humanMinutes(session.next.minutesToOpen)}.` : ""}` : "",
        "",
        fx.length ? `**FX.** ${fx.map((q) => `${q.pair} ${q.price.toFixed(q.decimals)} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%)`).join(" · ")}` : "",
        gold ? `**Metals.** XAU/USD ${gold.price.toFixed(2)} (${gold.changePct >= 0 ? "+" : ""}${gold.changePct.toFixed(2)}%)${gold.isReal ? ` on real ${gold.symbolUsed}` : ""}.` : "",
        btc ? `**Crypto.** BTC/USD ${btc.price.toFixed(2)} (${btc.changePct >= 0 ? "+" : ""}${btc.changePct.toFixed(2)}%).` : "",
        "",
        `**Radar.** ${radar.length} patterns on the board${high.length ? `, ${high.length} at high confidence — ${high.slice(0, 2).map((p) => `${p.symbol} ${p.type}`).join(", ")}` : ""}.`,
        news?.stories?.length ? `**Wire.** ${news.stories[0].title} — ${news.stories[0].source}, ${news.stories[0].timeAgo}.` : "",
        "",
        journal
          ? `**Your book${journal.isReal ? "" : " (sample)"}.** ${journal.count} trades, ${journal.summary.winRate.toFixed(0)}% win rate, ${signedMoney(journal.summary.netPL)} net.${journal.holdsLosersLonger && journal.avgWinHold ? ` You hold losers ${((journal.avgLossHold ?? 0) / Math.max(journal.avgWinHold, 1)).toFixed(1)}× longer than winners.` : ""}${journal.revenge.detected ? " Revenge sizing is present." : ""}${journal.worstHourDubai ? ` Worst hour ${journal.worstHourDubai.key}:00 Dubai at ${journal.worstHourDubai.winRate.toFixed(0)}%.` : ""}`
          : "",
        "",
        DISCLAIMER,
      ].filter(Boolean);

      setText(lines.join("\n"));
      setSources([
        live.some((q) => q.isReal) ? "Yahoo real quotes" : "Modelled quotes",
        news?.isReal ? `${news.provider} live` : "Curated wire",
        `Pattern Radar (${radar.length})`,
        journal ? (journal.isReal ? `Your journal (${journal.count})` : `Sample journal (${journal.count})`) : "",
      ].filter(Boolean));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHead
        title="AI Market Summary"
        icon={FileText}
        right={
          <span className="rounded-full bg-brand-green/[0.13] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-brand-green">
            Real inputs
          </span>
        }
      />
      <div className="p-5">
        {busy ? (
          <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-4/6" /></div>
        ) : text ? (
          <>
            <div className="text-[13px] leading-relaxed text-ink-muted"><Rich text={text} /></div>
            {sources.length ? (
              <p className="mt-3 text-[10.5px] text-ink-muted/70">Sources: {sources.join(" · ")}</p>
            ) : null}
            <ActionRow />
          </>
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-muted">
            A written read of the session — quotes, the wire, what the radar found, and how your own
            book is behaving.
          </p>
        )}
        <button type="button" onClick={generate} disabled={busy} className="btn-primary mt-5 w-full !py-2.5 text-[12.5px] disabled:opacity-50">
          {busy ? "Reading the tape…" : text ? "Regenerate summary" : "Generate summary"}
        </button>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- trade idea card */

function TradeIdeaCard({
  journal, session,
}: {
  journal: ReturnType<typeof getBestWorst> | null;
  session: SessionInfo | null;
}) {
  const [pair, setPair] = useState("EUR/USD");
  const [tf, setTf] = useState("15M");
  const [text, setText] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const [mkt, pat] = await Promise.all([
        fetch(`/api/market/live?pair=${encodeURIComponent(pair)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/patterns/live?symbols=${encodeURIComponent(pair)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      const found = (pat?.patterns ?? []).filter((p: { symbol: string }) => p.symbol === pair);
      const top = found[0] ?? null;
      // Per-instrument record, so the example is grounded in how this reader
      // actually trades this pair rather than their overall average.
      const mine = getPairStats(pair);
      const conf = top?.confidence ?? "low";
      setConfidence(conf);

      const d = mkt?.decimals ?? 4;
      const price = mkt?.price ?? 0;
      const atr = Math.max(price * 0.0012, 10 ** -d * 10);
      const stop = Number((price - atr).toFixed(d));
      const target = Number((price + atr * 2).toFixed(d));

      const lines = [
        `**${pair} · ${tf} — educational example (not a signal)**`,
        "",
        `**Structure.** ${mkt ? `Price ${price.toFixed(d)} (${mkt.changePct >= 0 ? "+" : ""}${mkt.changePct.toFixed(2)}%)${mkt.isReal ? ` on real ${mkt.symbolUsed}, ${mkt.bars} bars` : " on modelled data"}.` : "Price unavailable."}`,
        top
          ? `**Radar.** ${top.type} at ${top.price} — ${top.confidence} confidence. ${top.description}`
          : "**Radar.** Nothing flagged on this instrument right now, so there is no structural trigger to build around.",
        "",
        journal
          ? `**Your record${journal.isReal ? "" : " (sample)"}.** ${
              mine
                ? `On ${pair} you are ${mine.winRate.toFixed(0)}% across ${mine.trades} trades for ${signedMoney(mine.net)}.`
                : `No ${pair} trades in the loaded history.`
            } Overall ${journal.count} trades at ${journal.summary.winRate.toFixed(0)}%.${journal.bestHourDubai ? ` Strongest hour ${journal.bestHourDubai.key}:00 Dubai, weakest ${journal.worstHourDubai?.key}:00.` : ""}`
          : "",
        session
          ? `**Session.** ${session.active.length ? `${session.active.map((s) => s.name).join(", ")} open` : "Between sessions"}${session.next ? `, ${session.next.name} in ${humanMinutes(session.next.minutesToOpen)}` : ""}.${journal?.bestSession ? ` Your most profitable session is ${journal.bestSession.key} (${signedMoney(journal.bestSession.net)}).` : ""}`
          : "",
        "",
        `**Worked risk example.** On a $1,000 account risking 2% ($20): entry ${price.toFixed(d)}, invalidation ${stop.toFixed(d)}, objective ${target.toFixed(d)} — roughly 1:2. Position size follows from the stop distance; the Trading Calculator does that arithmetic exactly.`,
        "",
        `**How it fails.** ${top ? `The ${top.type.toLowerCase()} is one observation, not confirmation — a close beyond ${stop.toFixed(d)} invalidates it.` : "With no structural trigger, this is a level exercise rather than a setup."} High-impact data during the session can override structure entirely.`,
        "",
        `Worked example for study. Never a signal or recommendation. ${DISCLAIMER}`,
      ].filter(Boolean);

      setText(lines.join("\n"));
      setSources([
        mkt?.isReal ? `Yahoo ${mkt.symbolUsed} real` : "Modelled price",
        found.length ? `Pattern Radar (${found.length})` : "Pattern Radar",
        journal ? (journal.isReal ? `Your journal (${journal.count})` : `Sample journal (${journal.count})`) : "",
        "Session clock",
      ].filter(Boolean));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHead
        title="AI Trade Idea"
        icon={Lightbulb}
        right={
          confidence ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                confidence === "high" ? "bg-brand-green/[0.13] text-brand-green" : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
              }`}
            >
              {confidence}
            </span>
          ) : null
        }
      />
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Pair" value={pair} onChange={(e) => setPair(e.target.value)}>
            {PAIRS.map((p) => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
          </Select>
          <Select label="Timeframe" value={tf} onChange={(e) => setTf(e.target.value)}>
            {["5M", "15M", "1H"].map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>

        {busy ? (
          <div className="mt-4 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>
        ) : text ? (
          <>
            <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-[13px] leading-relaxed text-ink-muted">
              <Rich text={text} />
            </div>
            {sources.length ? <p className="mt-3 text-[10.5px] text-ink-muted/70">Sources: {sources.join(" · ")}</p> : null}
            <ActionRow pair={pair} />
          </>
        ) : null}

        <button type="button" onClick={generate} disabled={busy} className="btn-primary mt-4 w-full !py-2.5 text-[12.5px] disabled:opacity-50">
          <Radar className="h-4 w-4" strokeWidth={2.2} />
          {busy ? "Reading structure…" : text ? "Regenerate" : "Generate idea"}
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-ink-muted/70">
          Worked examples for study. Never a signal or a recommendation.
        </p>
      </div>
    </Card>
  );
}

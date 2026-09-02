"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, BookOpen, ChevronRight, Eraser, FileText, Lightbulb, Loader2, Radar, Sparkles,
} from "lucide-react";
import { Card, CardHead, PanelHeader, Select, Skeleton, Toast } from "@/components/ui/Primitives";
import { AiMark } from "@/components/brand/AiMark";
import { DISCLAIMER } from "@/lib/ai";
import { COMMANDS, answerWithContext, runCommand } from "@/lib/aiCommands";
import { getBestWorst, getPairStats } from "@/lib/journalStore";
import { buildJournalAggregate } from "@/lib/journalAggregate";
import type { JournalAggregate } from "@/lib/aiProvider";
import { TIMEFRAMES, type Timeframe } from "@/lib/timeframes";
import { parseCommand } from "@/lib/commandParser";
import type { StructureRead } from "@/lib/structureRead";
import type { TradePlan } from "@/lib/chartSnap";
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
  /** Which engine wrote it — the badge on a reply must match how it was made. */
  provider?: "OpenAI" | "Local";
  /** Present on /snap replies: the computed read the prose was written from. */
  snap?: SnapReply;
}

export interface SnapReply {
  symbol: string;
  timeframe: string;
  price: number;
  decimals: number;
  isReal: boolean;
  source: string;
  symbolUsed: string | null;
  bars: number;
  read: Pick<StructureRead, "state" | "label" | "bias" | "confidence" | "level" | "distance" | "distanceAtr" | "rsi" | "rsiLabel" | "cautions"> & {
    pattern: { type: string; direction: string; confidence: string } | null;
  };
  plan: TradePlan;
}

/**
 * Posts to an AI route, returning null whenever the model is unavailable —
 * no key, quota exhausted, timeout, network. Every caller then falls back to the
 * deterministic composition, so the feature degrades to what it was rather than
 * to an error.
 */
async function askAI<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.available ? (j as T) : null;
  } catch {
    return null;
  }
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


/* -------------------------------------------------------------- structure card */

const BIAS_TONE: Record<string, string> = {
  bullish: "border-brand-green/40 bg-brand-green/[0.1] text-brand-green",
  bearish: "border-danger/40 bg-danger/[0.1] text-danger",
  neutral: "border-white/[0.14] bg-white/[0.05] text-ink",
};

/**
 * The computed half of a /snap reply.
 *
 * It reports what the structure is doing, not what to do about it — the badge
 * carries a bias and a level, never an order type. The risk block underneath is
 * the same illustrative geometry Chart Snap shows, on the profile's example
 * balance rather than the reader's own.
 */
function SnapCard({ snap }: { snap: SnapReply }) {
  const d = snap.decimals;
  const f = (v: number) => v.toFixed(d);
  const r = snap.read;

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-white/[0.1] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12px] font-bold text-white">{snap.symbol}</span>
        <span className="rounded border border-white/[0.12] px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">{snap.timeframe}</span>
        <span className="num-mono text-[12px] text-ink">{f(snap.price)}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
            snap.isReal ? "bg-brand-green/[0.13] text-brand-green" : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
          }`}
        >
          {snap.isReal ? `Real · ${snap.source}` : "Modelled"}
        </span>
        <span className="ml-auto text-[10px] text-ink-muted">{snap.bars} bars</span>
      </div>

      <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${BIAS_TONE[r.bias] ?? BIAS_TONE.neutral}`}>
        <span className="text-[12.5px] font-semibold">{r.label}</span>
        {r.level ? (
          <span className="num-mono text-[12px] opacity-90">
            {f(r.level.price)} · {r.level.touches} {r.level.touches === 1 ? "touch" : "touches"}
            {r.distanceAtr !== null ? ` · ${r.distanceAtr}×ATR away` : ""}
          </span>
        ) : null}
        <span className="ml-auto rounded-full bg-black/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]">
          {r.confidence} confidence
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px] sm:grid-cols-3">
        {[
          ["Reference", f(snap.plan.entry)],
          ["Invalidation", `${f(snap.plan.stopLoss)} (${snap.plan.stopPips}p)`],
          ["Objective 1", `${f(snap.plan.target1)} · ${snap.plan.rr1}`],
          ["Objective 2", `${f(snap.plan.target2)} · ${snap.plan.rr2}`],
          ["RSI(14)", r.rsi !== null ? `${r.rsi.toFixed(1)} ${r.rsiLabel}` : "n/a"],
          ["Pattern", r.pattern ? `${r.pattern.type} (${r.pattern.confidence})` : "none flagged"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">{k}</span>
            <span className="num-mono text-ink">{v}</span>
          </div>
        ))}
      </div>

      <p className="text-[10.5px] leading-relaxed text-ink-muted/80">
        Geometry is illustrative, sized on the profile&apos;s example balance — not a position for your account.
        {snap.plan.stopBasis ? ` Invalidation from ${snap.plan.stopBasis}.` : ""}
      </p>

      <details className="group">
        <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-[#fbbf24]">
          Bakit pwedeng mali — {r.cautions.length} ways this read breaks
        </summary>
        <ul className="mt-2 space-y-1.5">
          {r.cautions.map((c, i) => (
            <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-muted">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#fbbf24]" aria-hidden />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-3">
        <Link href={tabHref("market-analysis", snap.symbol)} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink transition-colors hover:border-brand-blue/40 hover:text-white">View chart</Link>
        <Link href={tabHref("journal-analytics")} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink transition-colors hover:border-brand-blue/40 hover:text-white">Check journal</Link>
        <Link href={tabHref("pattern-radar")} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink transition-colors hover:border-brand-blue/40 hover:text-white">Pattern radar</Link>
        <Link href={tabHref("chart-snap")} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink transition-colors hover:border-brand-blue/40 hover:text-white">Chart Snap</Link>
      </div>
    </div>
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

  const [aiOn, setAiOn] = useState<boolean | null>(null);
  // What /snap falls back to when the command omits pair or timeframe.
  const [cmdPair, setCmdPair] = useState("XAU/USD");
  const [cmdTf, setCmdTf] = useState<Timeframe>("1H");
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

  // Whether a model is wired up, so the badge is honest before the first reply.
  useEffect(() => {
    let alive = true;
    fetch("/api/ai/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setAiOn(!!j?.available); })
      .catch(() => { if (alive) setAiOn(false); });
    return () => { alive = false; };
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

      // /pair only moves the dropdown — no reason to spend a model call on it.
      const parsed = parseCommand(q);
      if (parsed.type === "pair") {
        if (parsed.pair) {
          setCmdPair(parsed.pair);
          setInput("");
          flash(`Pair set to ${parsed.pair}`);
        } else {
          flash("Unknown instrument — try /pair XAU/USD");
        }
        return;
      }
      if (parsed.type === "snap" || parsed.type === "screenshot") {
        if (parsed.pair) setCmdPair(parsed.pair);
        if (parsed.timeframe) setCmdTf(parsed.timeframe);
      }

      setHistory((prev) => [...prev, { role: "user", text: q, at: new Date().toISOString() }]);
      setInput("");
      setThinking(true);
      trackEvent(EVENTS.terminalQuery, { query: q.slice(0, 80), surface: "ai-tools" });

      try {
        // Aggregated statistics only — the trade list never leaves the browser.
        const journalAgg = buildJournalAggregate();
        const llm = await askAI<{ answer: string; sources: string[]; kind?: string; snap?: SnapReply } & Partial<SnapReply>>(
          "/api/ai/chat",
          { message: q, journal: journalAgg, pair: cmdPair, timeframe: cmdTf }
        );

        if (llm) {
          setAiOn(true);
          const snap =
            llm.kind === "snap" && llm.read && llm.plan
              ? ({
                  symbol: llm.symbol, timeframe: llm.timeframe, price: llm.price, decimals: llm.decimals,
                  isReal: llm.isReal, source: llm.source, symbolUsed: llm.symbolUsed, bars: llm.bars,
                  read: llm.read, plan: llm.plan,
                } as SnapReply)
              : undefined;
          setHistory((prev) => [
            ...prev,
            { role: "ai", text: llm.answer, sources: llm.sources, provider: "OpenAI", snap, at: new Date().toISOString() },
          ]);
        } else {
          setAiOn(false);
          const res = q.startsWith("/") ? await runCommand(q) : await answerWithContext(q);
          setHistory((prev) => [
            ...prev,
            { role: "ai", text: res.text, sources: res.sources, provider: "Local", at: new Date().toISOString() },
          ]);
        }
      } catch {
        setHistory((prev) => [
          ...prev,
          { role: "ai", text: "Something went wrong reading that. Try again, or `/help` for the command list." },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [setHistory, thinking, cmdPair, cmdTf]
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
    out.push(`/snap ${journal?.worstPair?.key ?? "XAU/USD"} 1H`);
    out.push("/explain last loss");
    out.push("/help");
    return Array.from(new Set(out)).slice(0, 6);
  }, [journal, radar, session]);

  const placeholder = journal
    ? journal.isReal
      ? `Type /snap XAU/USD 1H, ask about your last loss, or /help — I can read your ${journal.count} trades`
      : `Type /snap XAU/USD 1H or /help — journal answers use a ${journal.count}-trade sample until you import your own`
    : "Type /snap XAU/USD 1H or /help";

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
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00ff88]/30 bg-black/40">
                <AiMark
                  width={19}
                  height={19}
                  title="GFXA AI"
                  className="drop-shadow-[0_0_6px_rgba(0,217,255,0.55)]"
                />
              </span>
              Market Assistant
              {aiOn !== null ? (
                <span
                  title={aiOn ? "Answers written by GPT-4o-mini from this platform's real data" : "Answers composed on-device from this platform's real data — no model configured"}
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] ${
                    aiOn ? "bg-brand-green/[0.13] text-brand-green" : "bg-white/[0.06] text-ink-muted"
                  }`}
                >
                  {aiOn ? "REAL • OPENAI" : "LOCAL ENGINE"}
                </span>
              ) : null}
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
                      {m.snap ? <SnapCard snap={m.snap} /> : null}
                      {m.role === "ai" && m.sources?.length ? (
                        <p className="mt-1.5 px-1 font-mono text-[10px] leading-relaxed text-[#8A93A8]">
                          {m.provider ? (
                            <span className={m.provider === "OpenAI" ? "text-brand-green/70" : "text-[#8A93A8]"}>
                              {m.provider === "OpenAI" ? "GPT-4o-mini" : "Local engine"} ·{" "}
                            </span>
                          ) : null}
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

            <div className="mt-3 flex flex-wrap items-end gap-2 border-b border-[#00ff88]/10 pb-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#00ff88]/50">Pair</span>
                <select
                  value={cmdPair}
                  onChange={(e) => setCmdPair(e.target.value)}
                  aria-label="Instrument for /snap"
                  className="rounded border border-[#00ff88]/25 bg-black/50 px-2 py-1.5 font-mono text-[11.5px] text-[#00ff88] outline-none focus:border-[#00ff88]/60"
                >
                  {PAIRS.map((p) => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#00ff88]/50">Timeframe</span>
                <select
                  value={cmdTf}
                  onChange={(e) => setCmdTf(e.target.value as Timeframe)}
                  aria-label="Timeframe for /snap"
                  className="rounded border border-[#00ff88]/25 bg-black/50 px-2 py-1.5 font-mono text-[11.5px] text-[#00ff88] outline-none focus:border-[#00ff88]/60"
                >
                  {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <button
                type="button"
                onClick={() => send(`/snap ${cmdPair} ${cmdTf}`)}
                disabled={thinking}
                className="rounded border border-[#00ff88]/40 bg-[#00ff88]/10 px-3 py-1.5 font-mono text-[11.5px] font-semibold text-[#00ff88] transition-all duration-200 hover:bg-[#00ff88]/20 disabled:opacity-40"
              >
                Snap structure
              </button>
              <span className="text-[10.5px] leading-tight text-ink-muted/70">
                Reads the live chart. Structure and levels — not a trade call.
              </span>
            </div>

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
            <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-[#8A93A8]">
              {aiOn
                ? "Privacy: your statement stays in this browser. Only aggregated statistics — trade count, win rate, best and worst hour, pair and session, and a one-line summary of your last loss — are sent to OpenAI to write the reply. Individual trades, prices, account and broker details are never sent."
                : "Privacy: nothing leaves this browser. Replies are composed on-device from your imported statement and this platform's market endpoints."}
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
  const [provider, setProvider] = useState<"OpenAI" | "Local" | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      // The model narrates facts the route computed; if it is not available the
      // local composition below reads the same endpoints itself.
      const llm = await askAI<{ summary: string; sources: string[] }>("/api/ai/summary", {
        journal: buildJournalAggregate(),
      });
      if (llm) {
        setText(llm.summary);
        setSources(llm.sources);
        setProvider("OpenAI");
        return;
      }
      setProvider("Local");

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
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
              provider === "OpenAI" ? "bg-brand-green/[0.13] text-brand-green" : "bg-white/[0.06] text-ink-muted"
            }`}
          >
            {provider === "OpenAI" ? "GPT-4o-mini" : provider === "Local" ? "Local engine" : "Real inputs"}
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
  const [provider, setProvider] = useState<"OpenAI" | "Local" | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const llm = await askAI<{
        idea: string; sources: string[]; confidence: string | null;
      }>("/api/ai/idea", { pair, timeframe: tf, journal: buildJournalAggregate() });
      if (llm) {
        setText(llm.idea);
        setSources(llm.sources);
        setConfidence(llm.confidence);
        setProvider("OpenAI");
        return;
      }
      setProvider("Local");

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
          <span className="flex items-center gap-1.5">
            {provider ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                  provider === "OpenAI" ? "bg-brand-green/[0.13] text-brand-green" : "bg-white/[0.06] text-ink-muted"
                }`}
              >
                {provider === "OpenAI" ? "GPT-4o-mini" : "Local engine"}
              </span>
            ) : null}
            {confidence ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                  confidence === "high" ? "bg-brand-green/[0.13] text-brand-green" : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
                }`}
              >
                {confidence}
              </span>
            ) : null}
          </span>
        }
      />
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Pair" value={pair} onChange={(e) => setPair(e.target.value)}>
            {PAIRS.map((p) => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
          </Select>
          <Select label="Timeframe" value={tf} onChange={(e) => setTf(e.target.value)}>
            {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
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

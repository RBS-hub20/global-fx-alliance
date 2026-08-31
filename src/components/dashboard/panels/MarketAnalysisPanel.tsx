"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, Minus, MoveUpRight, Ruler, Terminal } from "lucide-react";
import { Card, CardHead, Change, PanelHeader, Pills, Skeleton } from "@/components/ui/Primitives";
import { TickerTape } from "@/components/dashboard/TickerTape";
import { generateDrawings, type Drawings } from "@/lib/autoDraw";
import type { Candle } from "@/lib/indicators";
import { PAIRS, RANGES, candlesFor, getPair, type Range } from "@/lib/market";
import {
  detectPair, getTerminalAnalysis, DISCLAIMER,
  type CalendarLike, type NewsLike, type TerminalReport,
} from "@/lib/ai";

// lightweight-charts touches the DOM on construction, so it never renders on the server.
const TradingViewChart = dynamic(
  () => import("@/components/chart/TradingViewChart").then((m) => m.TradingViewChart),
  { ssr: false, loading: () => <Skeleton className="h-[460px] w-full" /> }
);

const DRAWING_TOOLS = [
  { label: "Trendline", icon: MoveUpRight },
  { label: "Support / Resistance", icon: Minus },
  { label: "Measure", icon: Ruler },
];

const COMMANDS = [
  "analyze EUR/USD",
  "what happened to gold?",
  "today's events",
  "usd strength",
];

export function MarketAnalysisPanel({ pair }: { pair?: string }) {
  const initial = pair && getPair(pair).symbol === pair ? pair : "EUR/USD";
  const [symbol, setSymbol] = useState(initial);
  const [range, setRange] = useState<Range>("1D");
  const [tool, setTool] = useState<string | null>(null);

  // Seeded candles render immediately; the live fetch replaces them if it lands.
  const [ohlc, setOhlc] = useState<Candle[]>(() => candlesFor(initial, "1D"));
  const [live, setLive] = useState<{ price: number; changePct: number; source: string } | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);

  const [input, setInput] = useState("");
  const [report, setReport] = useState<TerminalReport | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const outRef = useRef<HTMLDivElement>(null);

  const p = getPair(symbol);
  const drawings: Drawings = useMemo(() => generateDrawings(ohlc), [ohlc]);

  /* ------------------------------------------------------- live candle fetch */
  useEffect(() => {
    let alive = true;
    setLoadingChart(true);

    (async () => {
      // Instant seeded fallback so the chart never waits on the network.
      const seeded = candlesFor(symbol, range);
      if (alive) setOhlc(seeded);

      try {
        const res = await fetch(
          `/api/market/live?pair=${encodeURIComponent(symbol)}&range=${range}`
        );
        if (!res.ok) return;
        const j = await res.json();
        if (!alive || !Array.isArray(j.ohlc) || !j.ohlc.length) return;
        setOhlc(j.ohlc);
        setLive({ price: j.price, changePct: j.changePct, source: j.source });
      } catch {
        // Seeded data is already on screen; nothing to recover.
      } finally {
        if (alive) setLoadingChart(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [symbol, range]);

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [report, log]);

  /* ------------------------------------------------------------ terminal run */
  const run = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query || running) return;

      setLog((l) => [...l, `> ${query}`]);
      setInput("");

      if (/^\/?help$/i.test(query)) {
        setLog((l) => [
          ...l,
          "COMMANDS  analyze <pair> · news <pair> · calendar · correlation · levels · clear",
          `PAIRS     ${PAIRS.map((x) => x.symbol).join(" · ")}`,
        ]);
        return;
      }
      if (/^\/?clear$/i.test(query)) {
        setLog([]);
        setReport(null);
        return;
      }

      setRunning(true);
      const target = detectPair(query, symbol);
      if (target !== symbol) setSymbol(target);

      try {
        // All three feeds in parallel; each already falls back server-side.
        const [mkt, cal, news] = await Promise.all([
          fetch(`/api/market/live?pair=${encodeURIComponent(target)}&range=${range}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/calendar/live").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/news/live?limit=8`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);

        const tp = getPair(target);
        const bars: Candle[] = mkt?.ohlc?.length ? mkt.ohlc : candlesFor(target, range);
        const draw = generateDrawings(bars);

        const board = await Promise.all(
          PAIRS.map(async (x) => {
            if (x.symbol === target && mkt) return { symbol: x.symbol, changePct: mkt.changePct };
            return { symbol: x.symbol, changePct: x.changePct };
          })
        );

        const r = await getTerminalAnalysis(query, {
          pair: tp.symbol,
          price: mkt?.price ?? tp.price,
          changePct: mkt?.changePct ?? tp.changePct,
          decimals: tp.decimals,
          ohlc: bars,
          indicators: draw.indicators,
          drawings: draw,
          calendar: (cal?.events ?? []) as CalendarLike[],
          news: (news?.items ?? []) as NewsLike[],
          board,
          source: mkt?.source === "live" ? "live" : "fallback",
        });
        setReport(r);
      } finally {
        setRunning(false);
      }
    },
    [range, running, symbol]
  );

  const price = live?.price ?? p.price;
  const changePct = live?.changePct ?? p.changePct;

  return (
    <div className="space-y-5">
      <PanelHeader title="Market Analysis" />
      <TickerTape />

      <Pills options={PAIRS.map((x) => ({ value: x.symbol, label: x.symbol }))} value={symbol} onChange={setSymbol} />

      <Card>
        <header className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h3 className="text-[16px] font-bold tracking-tight text-white">{p.symbol}</h3>
            <span className="h-4 w-px bg-white/10" aria-hidden />
            <span className="num-mono text-[22px] font-bold leading-none text-white">
              {price.toFixed(p.decimals)}
            </span>
            <Change pct={changePct} />
            <span
              className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] ${
                live?.source === "live"
                  ? "bg-brand-green/[0.13] text-brand-green"
                  : "bg-white/[0.06] text-ink-muted"
              }`}
            >
              {live?.source === "live" ? "Live quote" : "Modeled"}
            </span>
            {loadingChart ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" /> : null}
          </div>

          <div className="flex items-center gap-1" role="tablist" aria-label="Chart range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={r === range}
                onClick={() => setRange(r)}
                className={`relative shrink-0 px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-200 ${
                  r === range ? "text-white" : "text-ink-muted hover:text-ink"
                }`}
              >
                {r}
                {r === range ? (
                  <span className="absolute inset-x-2 -bottom-[13px] h-[2px] rounded-full bg-brand-blue" />
                ) : null}
              </button>
            ))}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-5 py-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted/70">Tools</span>
          {DRAWING_TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={tool === t.label}
              onClick={() => setTool(tool === t.label ? null : t.label)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-all duration-200 ${
                tool === t.label
                  ? "border-brand-blue/50 bg-brand-blue/[0.14] text-brand-blue shadow-glow"
                  : "border-white/[0.08] bg-white/[0.03] text-ink-muted hover:border-brand-blue/30 hover:text-ink"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              {t.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-ink-muted">
            {tool ? `${tool} armed — manual drawing not available in this preview.` : "Levels below are drawn automatically."}
          </span>
        </div>

        <div className="px-2 py-3 sm:px-4">
          <TradingViewChart
            pair={symbol}
            ohlc={ohlc}
            drawings={drawings}
            decimals={p.decimals}
            height={460}
          />
        </div>
      </Card>

      {/* Auto-drawn level inventory */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LevelCard title="Auto Support" items={drawings.supports} decimals={p.decimals} tone="green" />
        <LevelCard title="Auto Resistance" items={drawings.resistances} decimals={p.decimals} tone="red" />
        <Card>
          <CardHead title="Structure" />
          <div className="space-y-2.5 p-5 text-[13px]">
            <Row k="Trend" v={drawings.trendline ? drawings.trendline.direction.toUpperCase() : "—"} />
            <Row k="Pivots" v={String(drawings.trendline?.touches ?? 0)} />
            <Row k="RSI(14)" v={drawings.indicators?.rsi?.toFixed(1) ?? "n/a"} />
            <Row k="MACD" v={drawings.indicators?.macd?.bias ?? "n/a"} />
            <Row k="ATR(14)" v={drawings.indicators?.atr?.toFixed(p.decimals) ?? "n/a"} />
            <Row k="FVG zones" v={String(drawings.fvgs.length)} />
          </div>
        </Card>
      </div>

      {/* Bloomberg terminal */}
      <section className="overflow-hidden rounded-2xl border border-[#00ff88]/20 bg-[#0a0a0a] shadow-glow">
        <header className="flex items-center justify-between gap-3 border-b border-[#00ff88]/15 px-5 py-3">
          <h3 className="flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
            <Terminal className="h-3.5 w-3.5" strokeWidth={2.2} />
            GFXA Terminal v1.0
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#fbbf24]/70">
            multi-agent · type /help
          </span>
        </header>

        <div ref={outRef} className="max-h-[520px] overflow-y-auto px-5 py-4 font-mono text-[12px] leading-relaxed">
          {log.length === 0 && !report ? (
            <p className="text-[#00ff88]/60">
              GFXA TERMINAL ready. Try <span className="text-[#fbbf24]">analyze EUR/USD</span> or{" "}
              <span className="text-[#fbbf24]">/help</span>.
            </p>
          ) : null}

          {log.map((l, i) => (
            <p key={i} className={l.startsWith(">") ? "text-[#fbbf24]" : "text-[#00ff88]/80"}>
              {l}
            </p>
          ))}

          {running ? <p className="mt-2 text-[#00ff88]/60">running agents…</p> : null}

          {report && !running ? (
            <div className="mt-3">
              <p className="text-[#00ff88]">
                GFXA TERMINAL v1.0 — {report.pair}{" "}
                <span className="text-[#fbbf24]">{report.price.toFixed(report.decimals)}</span>{" "}
                <span className={report.changePct >= 0 ? "text-[#00D094]" : "text-[#FF4D4D]"}>
                  {report.changePct >= 0 ? "+" : ""}
                  {report.changePct.toFixed(2)}%
                </span>{" "}
                <span className="text-[#8A93A8]">[{report.source}]</span>
              </p>
              <p className="text-[#00ff88]/25">{"═".repeat(56)}</p>

              {report.sections.map((s) => (
                <div key={s.key} className="mt-3 border-l-2 border-[#00ff88]/25 pl-3">
                  <p className="text-[#00ff88] font-bold">▸ {s.key}</p>
                  {s.lines.map((l, i) => (
                    <p key={i} className="whitespace-pre-wrap text-[#c8d0dc]">
                      {l}
                    </p>
                  ))}
                </div>
              ))}

              <p className="mt-3 text-[#00ff88]/25">{"─".repeat(56)}</p>
              <p className="text-[#fbbf24]/80">{report.disclaimer}</p>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(input);
          }}
          className="flex items-center gap-2 border-t border-[#00ff88]/15 px-5 py-3"
        >
          <ChevronRight className="h-4 w-4 shrink-0 text-[#00ff88]" strokeWidth={2.6} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="analyze EUR/USD"
            aria-label="Terminal command"
            className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-[#00ff88] placeholder:text-[#00ff88]/30 outline-none"
          />
          <button
            type="submit"
            disabled={running || !input.trim()}
            className="shrink-0 rounded border border-[#00ff88]/40 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#00ff88] transition-all duration-200 hover:bg-[#00ff88]/10 disabled:opacity-30"
          >
            Run
          </button>
        </form>

        <div className="flex flex-wrap gap-2 border-t border-[#00ff88]/10 px-5 py-3">
          {COMMANDS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => run(c)}
              className="rounded border border-[#00ff88]/20 px-2.5 py-1 font-mono text-[10.5px] text-[#00ff88]/70 transition-all duration-200 hover:border-[#00ff88]/50 hover:text-[#00ff88]"
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <p className="text-[11.5px] leading-relaxed text-ink-muted/70">
        Candles are modeled from a seeded engine and re-based onto the live quote when one is
        available; they are not real historical prints. {DISCLAIMER}
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{k}</span>
      <span className="num-mono font-semibold text-white">{v}</span>
    </div>
  );
}

function LevelCard({
  title, items, decimals, tone,
}: {
  title: string;
  items: Drawings["supports"];
  decimals: number;
  tone: "green" | "red";
}) {
  return (
    <Card>
      <CardHead title={title} />
      <div className="p-5">
        {items.length === 0 ? (
          <p className="text-[13px] text-ink-muted">None detected in this window.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((l, i) => (
              <li key={l.price} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className={`num-mono text-[11px] font-bold ${tone === "green" ? "text-brand-green" : "text-brand-danger"}`}
                  >
                    {tone === "green" ? "S" : "R"}{i + 1}
                  </span>
                  <span className="num-mono text-[14px] font-semibold text-white">
                    {l.price.toFixed(decimals)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-muted">{l.touches}x</span>
                  <span className="flex gap-0.5" aria-label={`Strength ${l.strength} of 5`}>
                    {Array.from({ length: 5 }, (_, n) => (
                      <span
                        key={n}
                        className={`h-3 w-1 rounded-sm ${
                          n < l.strength
                            ? tone === "green"
                              ? "bg-brand-green"
                              : "bg-brand-danger"
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

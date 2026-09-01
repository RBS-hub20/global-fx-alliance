"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, Clock, ExternalLink,
  Loader2, RefreshCw, TrendingUp, TriangleAlert,
} from "lucide-react";
import { Card, CardHead, Modal, PanelHeader, Pills, Skeleton } from "@/components/ui/Primitives";
import { CALENDAR } from "@/lib/data";
import { PAIRS } from "@/lib/market";

const FILTERS = ["All", "Forex", "Gold", "Central Banks", "Economy", "Crypto"] as const;
const REFRESH_MS = 120_000;

interface Story {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  timeAgo: string;
  category: string;
  sentiment: string;
  symbols: string[];
  importance: "high" | "medium";
  isReal: boolean;
  badge: "LIVE" | "SAMPLE";
}

interface Wire {
  stories: Story[];
  source: "live" | "sample";
  provider: string;
  isReal: boolean;
  footnote?: string;
  timestamp: string;
}

const TONE: Record<string, string> = {
  bullish: "bg-brand-green/[0.13] text-brand-green",
  bearish: "bg-brand-danger/[0.13] text-brand-danger",
  neutral: "bg-white/[0.06] text-ink-muted",
};

export function MarketNewsPanel() {
  const [wire, setWire] = useState<Wire | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [open, setOpen] = useState<Story | null>(null);
  const [quotes, setQuotes] = useState(
    PAIRS.map((p) => ({ symbol: p.symbol, price: p.price, changePct: p.changePct, decimals: p.decimals, isReal: false }))
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/news/live?limit=12");
      if (!res.ok) return;
      const j = (await res.json()) as Wire;
      if (Array.isArray(j.stories)) {
        setWire(j);
        setFetchedAt(Date.now());
      }
    } catch {
      // Keep whatever is on screen; the interval will try again.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Live quotes for Top Movers, from the same endpoint the chart uses.
  useEffect(() => {
    let alive = true;
    (async () => {
      const next = await Promise.all(
        PAIRS.map(async (p) => {
          const seeded = { symbol: p.symbol, price: p.price, changePct: p.changePct, decimals: p.decimals, isReal: false };
          try {
            const res = await fetch(`/api/market/live?pair=${encodeURIComponent(p.symbol)}`);
            if (!res.ok) return seeded;
            const j = await res.json();
            return {
              symbol: p.symbol,
              price: typeof j.price === "number" ? j.price : p.price,
              changePct: typeof j.changePct === "number" ? j.changePct : p.changePct,
              decimals: typeof j.decimals === "number" ? j.decimals : p.decimals,
              isReal: !!j.isReal,
            };
          } catch {
            return seeded;
          }
        })
      );
      if (alive) setQuotes(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const stories = useMemo(
    () =>
      !wire ? [] : filter === "All" ? wire.stories : wire.stories.filter((s) => s.category === filter),
    [wire, filter]
  );

  // Top Movers must agree with the chart. Reading the static PAIRS table here
  // showed gold at its seeded 2,648.90 on the same screen the chart was drawing
  // real Yahoo candles near 4,485.
  const movers = useMemo(
    () =>
      [...quotes].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5),
    [quotes]
  );
  const isLive = wire?.isReal === true;

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Market News"
        action={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11.5px] text-ink-muted transition-all duration-200 hover:border-brand-blue/40 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
            Refresh
          </button>
        }
      />

      {/* Wire status — states exactly what you are looking at */}
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 ${
          isLive
            ? "border-brand-green/25 bg-brand-green/[0.06]"
            : "border-[#fbbf24]/25 bg-[#fbbf24]/[0.06]"
        }`}
      >
        {loading && !wire ? (
          <span className="inline-flex items-center gap-2 text-[12.5px] text-ink-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Fetching live wire…
          </span>
        ) : isLive ? (
          <>
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-60 animate-pulseRing" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-green">
                Live wire
              </span>
            </span>
            <span className="text-[12.5px] text-ink">{wire?.provider}</span>
            <span className="text-[12px] text-ink-muted">
              · {wire?.stories.length} stories
              {fetchedAt ? ` · updated ${new Date(fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
              {" · auto-refresh 2m"}
            </span>
          </>
        ) : (
          <>
            <TriangleAlert className="h-4 w-4 shrink-0 text-[#fbbf24]" strokeWidth={2} />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#fbbf24]">
              Sample mode
            </span>
            <span className="text-[12.5px] text-ink-muted">
              {wire?.footnote ?? "Live wire unavailable — showing illustrative headlines. Retrying."}
            </span>
          </>
        )}
      </div>

      <Pills options={FILTERS} value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {loading && !wire ? (
            <>
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </>
          ) : stories.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-[13.5px] text-ink-muted">Nothing on the wire in this category.</p>
            </Card>
          ) : (
            stories.map((n) => (
              <article
                key={n.id}
                className="rounded-2xl glass p-5 transition-all duration-200 hover:border-brand-blue/25"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11.5px] text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" strokeWidth={1.9} />
                    {n.timeAgo}
                  </span>
                  <span className="h-3 w-px bg-white/10" aria-hidden />
                  <span className="font-semibold text-ink">{n.source}</span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.1em]">
                    {n.category}
                  </span>
                  {n.importance === "high" ? (
                    <span className="rounded-full bg-brand-danger/[0.14] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-danger">
                      High impact
                    </span>
                  ) : null}

                  <span className="ml-auto flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] ${TONE[n.sentiment] ?? TONE.neutral}`}
                    >
                      {n.sentiment}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] ${
                        n.isReal
                          ? "bg-brand-green/[0.13] text-brand-green"
                          : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
                      }`}
                    >
                      {n.isReal ? (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-60 animate-pulseRing" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-green" />
                        </span>
                      ) : null}
                      {n.badge}
                    </span>
                  </span>
                </div>

                <h3 className="mt-3 text-[17px] font-bold leading-snug tracking-tight text-white">
                  {n.url ? (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1.5 transition-colors duration-200 hover:text-brand-blue"
                    >
                      {n.title}
                      <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 opacity-50" strokeWidth={2} />
                    </a>
                  ) : (
                    n.title
                  )}
                </h3>

                {n.summary ? (
                  <button type="button" onClick={() => setOpen(n)} className="mt-2 block text-left">
                    <p className="line-clamp-2 text-[13.5px] leading-relaxed text-ink-muted">
                      {n.summary}
                    </p>
                  </button>
                ) : null}

                {n.symbols.length ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {n.symbols.map((sym) => (
                      <span
                        key={sym}
                        className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-medium text-brand-blue"
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}

          <p className="pt-1 text-[11.5px] leading-relaxed text-ink-muted/70">
            Sources: ForexLive, Investing.com and FXStreet RSS. Sentiment and symbol tags are
            auto-detected from the headline by keyword and are indicative only. Educational only —
            not financial advice.
          </p>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHead
              title="Top Movers"
              icon={TrendingUp}
              right={
                <span
                  className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] ${
                    quotes.some((q) => q.isReal)
                      ? "bg-brand-green/[0.13] text-brand-green"
                      : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
                  }`}
                >
                  {quotes.some((q) => q.isReal) ? "Real" : "Modeled"}
                </span>
              }
            />
            <ul className="divide-y divide-white/[0.06]">
              {movers.map((p) => {
                const up = p.changePct >= 0;
                return (
                  <li key={p.symbol} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="text-[13px] font-semibold text-white">{p.symbol}</span>
                    <span className="flex items-center gap-2">
                      <span className="num-mono text-[12.5px] text-ink-muted">
                        {p.price.toFixed(p.decimals)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 num-mono text-[12.5px] font-semibold ${
                          up ? "text-brand-green" : "text-brand-danger"
                        }`}
                      >
                        {up ? <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} /> : <ArrowDownRight className="h-3 w-3" strokeWidth={2.4} />}
                        {Math.abs(p.changePct).toFixed(2)}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHead title="Next Up" icon={CalendarDays} />
            <ul className="divide-y divide-white/[0.06]">
              {CALENDAR.filter((e) => !e.actual).slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="num-mono w-[42px] shrink-0 text-[12.5px] font-semibold text-ink">
                    {e.time}
                  </span>
                  <span aria-hidden className="text-[13px]">{e.flag}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{e.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase ${
                      e.impact === "High"
                        ? "bg-brand-danger/[0.14] text-brand-danger"
                        : e.impact === "Medium"
                          ? "bg-[#FFB020]/[0.14] text-[#FFB020]"
                          : "bg-white/[0.06] text-ink-muted"
                    }`}
                  >
                    {e.impact}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.source ?? ""} wide>
        {open ? (
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11.5px] text-ink-muted">
              <span>{open.timeAgo}</span>
              <span className="h-3 w-px bg-white/10" aria-hidden />
              <span>{open.category}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${TONE[open.sentiment] ?? TONE.neutral}`}>
                {open.sentiment}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] ${
                  open.isReal ? "bg-brand-green/[0.13] text-brand-green" : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
                }`}
              >
                {open.badge}
              </span>
            </div>

            <h3 className="mt-3 text-[20px] font-bold leading-snug tracking-tight text-white">
              {open.title}
            </h3>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-muted">{open.summary}</p>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-4">
              {open.symbols.map((s) => (
                <span key={s} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-ink-muted">
                  {s}
                </span>
              ))}
              {open.url ? (
                <a
                  href={open.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-blue transition-colors hover:text-white"
                >
                  Read on {open.source}
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                </a>
              ) : (
                <span className="ml-auto text-[11.5px] text-ink-muted/70">
                  Sample headline — no source link
                </span>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Loader2, Radar, RefreshCw, TrendingDown, TrendingUp,
} from "lucide-react";
import { Card, CardHead, Pills, Skeleton } from "@/components/ui/Primitives";
import { tabHref } from "@/lib/tabs";

export interface RadarPattern {
  id: string;
  type: string;
  symbol: string;
  timeframe: string;
  direction: "bullish" | "bearish";
  confidence: "high" | "medium" | "low";
  description: string;
  price: number;
  time: number;
  level: number | null;
}

interface Feed {
  patterns: RadarPattern[];
  count: number;
  source: string;
  isReal: boolean;
  timeframe: string;
  scanned: { symbol: string; source: string; bars: number }[];
}

const FILTERS = ["All", "Bullish", "Bearish", "High only"] as const;
const REFRESH_MS = 60_000;

function ago(unixSeconds: number, now: number): string {
  const mins = Math.floor((now - unixSeconds * 1000) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export function usePatternFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/patterns/live");
      if (!res.ok) return;
      const j = (await res.json()) as Feed;
      if (Array.isArray(j.patterns)) setFeed(j);
    } catch {
      // Keep the previous scan; the interval retries.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { feed, loading, reload: load };
}

export function PatternCard({ p, now }: { p: RadarPattern; now: number }) {
  const bull = p.direction === "bullish";
  return (
    <article className="rounded-2xl glass p-5 transition-all duration-200 hover:border-brand-blue/25">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            bull ? "bg-brand-green/[0.13] text-brand-green" : "bg-brand-danger/[0.13] text-brand-danger"
          }`}
        >
          {bull ? <TrendingUp className="h-4 w-4" strokeWidth={2.2} /> : <TrendingDown className="h-4 w-4" strokeWidth={2.2} />}
        </span>
        <span className="text-[15px] font-bold tracking-tight text-white">{p.symbol}</span>
        <span className="text-[13px] text-ink">{p.type}</span>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
          {p.timeframe}
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
            p.confidence === "high"
              ? "bg-brand-green/[0.13] text-brand-green"
              : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
          }`}
        >
          {p.confidence} confidence
        </span>
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">{p.description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.08] pt-3.5">
        <span className="num-mono text-[13px] font-semibold text-white">{p.price}</span>
        {p.level !== null ? (
          <span className="text-[11.5px] text-ink-muted">
            level <span className="num-mono text-ink">{p.level}</span>
          </span>
        ) : null}
        <span className="text-[11.5px] text-ink-muted/70">{ago(p.time, now)}</span>
        <Link
          href={tabHref("market-analysis", p.symbol)}
          className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-blue transition-colors duration-200 hover:text-white"
        >
          View chart
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        </Link>
      </div>
    </article>
  );
}

/** Compact widget for the main dashboard. */
export function PatternRadarWidget() {
  const { feed, loading } = usePatternFeed();
  const now = Date.now();
  const top = (feed?.patterns ?? []).slice(0, 2);

  return (
    <Card>
      <CardHead
        title="Pattern Radar"
        icon={Radar}
        right={
          <Link
            href={tabHref("pattern-radar")}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-blue transition-colors hover:text-white"
          >
            All patterns
            <ArrowRight className="h-3 w-3" strokeWidth={2.4} />
          </Link>
        }
      />
      <div className="p-5">
        {loading && !feed ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : top.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            No patterns on the scan right now — the majors are ranging.
          </p>
        ) : (
          <ul className="space-y-3">
            {top.map((p) => (
              <li key={p.id}>
                <Link
                  href={tabHref("market-analysis", p.symbol)}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200 hover:border-brand-blue/30"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      p.direction === "bullish"
                        ? "bg-brand-green/[0.13] text-brand-green"
                        : "bg-brand-danger/[0.13] text-brand-danger"
                    }`}
                  >
                    {p.direction === "bullish" ? <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.2} /> : <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.2} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-white">
                      {p.symbol} · {p.type}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink-muted">
                      {p.timeframe} · {p.price}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase ${
                      p.confidence === "high"
                        ? "bg-brand-green/[0.13] text-brand-green"
                        : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
                    }`}
                  >
                    {p.confidence}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** Full panel. */
export function PatternRadarPanel() {
  const { feed, loading, reload } = usePatternFeed();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const now = Date.now();

  const shown = useMemo(() => {
    const all = feed?.patterns ?? [];
    switch (filter) {
      case "Bullish": return all.filter((p) => p.direction === "bullish");
      case "Bearish": return all.filter((p) => p.direction === "bearish");
      case "High only": return all.filter((p) => p.confidence === "high");
      default: return all;
    }
  }, [feed, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white">
          Pattern Radar
          {feed?.isReal ? (
            <span className="rounded-full bg-brand-green/[0.13] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-green">
              Real · Yahoo + auto S/R
            </span>
          ) : null}
        </h2>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11.5px] text-ink-muted transition-all duration-200 hover:border-brand-blue/40 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          Rescan
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl glass px-4 py-3 text-[12px] text-ink-muted">
        {loading && !feed ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Scanning real candles…
          </span>
        ) : (
          <>
            <span className="text-ink">
              <span className="num-mono font-semibold text-white">{feed?.count ?? 0}</span> patterns
            </span>
            <span>· {feed?.scanned.length ?? 0} instruments on {feed?.timeframe}</span>
            <span>· auto-rescan 60s</span>
            <span className="ml-auto">
              Detected from real OHLC and the same auto-drawn levels the chart uses.
            </span>
          </>
        )}
      </div>

      <Pills options={FILTERS} value={filter} onChange={setFilter} />

      {loading && !feed ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-6 py-14 text-center">
          <Radar className="mx-auto h-6 w-6 text-ink-muted" strokeWidth={1.8} />
          <p className="mt-4 text-[14px] font-semibold text-white">
            No {filter === "All" ? "" : filter.toLowerCase() + " "}patterns right now
          </p>
          <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-ink-muted">
            The scan found nothing worth flagging — that usually means the majors are ranging.
            Check Market Pulse for which session is active.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((p) => (
            <PatternCard key={p.id} p={p} now={now} />
          ))}
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed text-ink-muted/70">
        Patterns are detected mechanically from real price data. A pattern is an observation, not a
        prediction and not a signal — confidence reflects only how many independent conditions
        agreed. Educational only — not financial advice.
      </p>
    </div>
  );
}

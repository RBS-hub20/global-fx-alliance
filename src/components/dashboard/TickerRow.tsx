"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, WifiOff } from "lucide-react";
import { Sparkline } from "@/components/ui/Sparkline";
import { QUOTES } from "@/lib/data";

/**
 * The dashboard ticker.
 *
 * It used to render `QUOTES` from lib/data — a hardcoded set that still carried
 * gold at 2,648.90, roughly $1,700 below spot, while the chart beneath it drew
 * real candles. The seeded numbers now only fill the first paint, and are
 * replaced by /api/market/quotes as soon as it answers.
 *
 * On a failed refresh the last good quotes stay on screen behind an "offline"
 * badge rather than being blanked: the previous price is the most accurate thing
 * available, provided nobody is told it is current.
 */

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  decimals: number;
  spark: number[];
  isReal: boolean;
  source?: string;
}

const SEED: Quote[] = QUOTES.map((q) => ({
  symbol: q.symbol,
  price: q.price,
  change: q.change,
  changePct: q.changePct,
  decimals: q.decimals,
  spark: q.spark,
  isReal: false,
}));

export function TickerRow() {
  const [quotes, setQuotes] = useState<Quote[]>(SEED);
  const [live, setLive] = useState(false);
  const [offline, setOffline] = useState(false);
  const [updated, setUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market/quotes");
      if (!res.ok) { setOffline(true); return; }
      const j = await res.json();
      if (!Array.isArray(j.quotes) || !j.quotes.length) { setOffline(true); return; }
      setQuotes(j.quotes as Quote[]);
      setLive(true);
      setOffline(false);
      setUpdated(
        new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      );
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void load();
    // The endpoint caches for 30s and the provider for 60s, so a faster poll
    // returns identical numbers and spends the upstream request budget.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[11px] text-ink-muted">
        {offline ? (
          <>
            <WifiOff className="h-3.5 w-3.5 text-[#fbbf24]" strokeWidth={2} />
            <span className="text-[#fbbf24]">Offline — showing the last prices received</span>
          </>
        ) : live ? (
          <>
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-brand-green opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
            </span>
            <span className="font-semibold uppercase tracking-[0.12em] text-brand-green">Live</span>
            {updated ? <span className="num-mono">Updated {updated}</span> : null}
          </>
        ) : (
          <span>Loading live prices…</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quotes.map((q) => {
          const up = q.changePct >= 0;
          return (
            <article
              key={q.symbol}
              className="group rounded-xl glass p-4 transition-all duration-200 hover:border-brand-blue/25"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-ink">
                    {q.symbol}
                    {!q.isReal ? (
                      <span className="rounded bg-[#fbbf24]/[0.14] px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#fbbf24]">
                        Modelled
                      </span>
                    ) : null}
                  </h3>
                  <p className="mt-1.5 num-mono text-[22px] font-bold leading-none text-white">
                    {q.price.toFixed(q.decimals)}
                  </p>
                </div>
                <Sparkline points={q.spark} positive={up} width={96} height={40} className="shrink-0 opacity-90" />
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                {up ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-brand-green" strokeWidth={2.4} />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-brand-danger" strokeWidth={2.4} />
                )}
                <span className={`num-mono text-[13px] font-semibold ${up ? "text-brand-green" : "text-brand-danger"}`}>
                  {up ? "+" : ""}
                  {q.changePct.toFixed(2)}%
                </span>
                <span className="num-mono text-[12px] text-ink-muted">
                  {up ? "+" : ""}
                  {q.change.toFixed(q.decimals)}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ArrowRight } from "lucide-react";
import { Sparkline } from "@/components/ui/Sparkline";
import { PanelHeader, LiveDot } from "@/components/ui/Primitives";
import { PAIRS, seriesFor, sparkFor } from "@/lib/market";
import { tabHref } from "@/lib/tabs";

export function MarketOverviewPanel() {
  return (
    <div className="space-y-6">
      <PanelHeader title="Market Overview" action={<LiveDot label="Live" />} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PAIRS.map((p) => {
          const up = p.changePct >= 0;
          const day = seriesFor(p.symbol, "1D");
          return (
            <Link
              key={p.symbol}
              href={tabHref("market-analysis", p.symbol)}
              className="group rounded-2xl glass p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-glow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-bold tracking-tight text-white">{p.symbol}</h3>
                  <p className="mt-0.5 truncate text-[11px] text-ink-muted">{p.name}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-blue" />
              </div>

              <p className="mt-4 num-mono text-[28px] font-bold leading-none text-white">
                {p.price.toFixed(p.decimals)}
              </p>

              <div className="mt-2.5 flex items-center gap-1.5">
                {up ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-brand-green" strokeWidth={2.4} />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-brand-danger" strokeWidth={2.4} />
                )}
                <span
                  className={`num-mono text-[13px] font-semibold ${
                    up ? "text-brand-green" : "text-brand-danger"
                  }`}
                >
                  {up ? "+" : ""}
                  {p.changePct.toFixed(2)}%
                </span>
                <span className="num-mono text-[12px] text-ink-muted">
                  {up ? "+" : ""}
                  {p.change.toFixed(p.decimals)}
                </span>
              </div>

              <div className="mt-4">
                <Sparkline points={sparkFor(p.symbol)} positive={up} width={220} height={46} className="w-full opacity-90" />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-3.5 text-[11px]">
                <div>
                  <dt className="text-ink-muted/70">24h High</dt>
                  <dd className="num-mono mt-0.5 font-semibold text-ink">
                    {Math.max(p.high24, day.high).toFixed(p.decimals)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted/70">24h Low</dt>
                  <dd className="num-mono mt-0.5 font-semibold text-ink">
                    {Math.min(p.low24, day.low).toFixed(p.decimals)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted/70">Spread</dt>
                  <dd className="num-mono mt-0.5 font-semibold text-ink">{p.spread.toFixed(1)}p</dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </div>

      <p className="text-[11.5px] leading-relaxed text-ink-muted/70">
        Indicative pricing for education and discussion. Not a quote, and not executable.
      </p>
    </div>
  );
}

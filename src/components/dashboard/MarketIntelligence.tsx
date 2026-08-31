"use client";

import { useState } from "react";
import { Activity, BrainCircuit, Landmark } from "lucide-react";
import { PriceChart } from "@/components/ui/PriceChart";
import { AI_INSIGHT, EURUSD, FUNDAMENTALS, RANGES, TECHNICALS, type Range } from "@/lib/data";

export function MarketIntelligence() {
  const [range, setRange] = useState<Range>("1D");
  const series = EURUSD[range];
  const last = series.points[series.points.length - 1];
  const up = series.changePct >= 0;

  return (
    <section className="rounded-2xl glass">
      <header className="flex flex-col gap-4 border-b border-white/[0.08] px-6 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-[15px] font-bold tracking-tight text-white">EUR/USD</h2>
          <span className="h-4 w-px bg-white/10" aria-hidden />
          <span className="num-mono text-[20px] font-bold leading-none text-white">
            {last.toFixed(4)}
          </span>
          <span
            className={`num-mono rounded-full px-2.5 py-1 text-[12px] font-semibold ${
              up
                ? "bg-brand-green/[0.13] text-brand-green"
                : "bg-brand-danger/[0.13] text-brand-danger"
            }`}
          >
            {up ? "+" : ""}
            {series.changePct.toFixed(2)}%
          </span>
        </div>

        <div
          className="-mx-1 flex items-center gap-1 overflow-x-auto px-1"
          role="tablist"
          aria-label="Chart range"
        >
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

      <div className="px-3 py-5 sm:px-5">
        <PriceChart points={series.points} labels={series.labels} decimals={4} height={320} />
      </div>

      <div className="grid grid-cols-1 divide-y divide-white/[0.08] border-t border-white/[0.08] md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            <Activity className="h-3.5 w-3.5" strokeWidth={2} />
            Technical
          </h3>
          <dl className="mt-4 space-y-3">
            {TECHNICALS.map((t) => (
              <div key={t.label} className="flex items-center justify-between text-[13px]">
                <dt className="text-ink-muted">{t.label}</dt>
                <dd
                  className={`font-semibold ${
                    t.tone === "up" ? "text-brand-green" : "text-ink"
                  }`}
                >
                  {t.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            <Landmark className="h-3.5 w-3.5" strokeWidth={2} />
            Fundamental
          </h3>
          <ul className="mt-4 space-y-3">
            {FUNDAMENTALS.map((f) => (
              <li key={f} className="flex gap-2.5 text-[13px] leading-relaxed text-ink">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-blue" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            <BrainCircuit className="h-3.5 w-3.5" strokeWidth={2} />
            AI Insight
          </h3>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">{AI_INSIGHT}</p>
        </div>
      </div>
    </section>
  );
}

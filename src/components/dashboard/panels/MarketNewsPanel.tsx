"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Clock, TrendingUp } from "lucide-react";
import { Card, CardHead, Modal, PanelHeader, Pills } from "@/components/ui/Primitives";
import { NEWS, NEWS_FILTERS, type NewsItem, type Sentiment } from "@/lib/content";
import { CALENDAR } from "@/lib/data";
import { PAIRS } from "@/lib/market";

const TONE: Record<Sentiment, string> = {
  Bullish: "bg-brand-green/[0.13] text-brand-green",
  Bearish: "bg-brand-danger/[0.13] text-brand-danger",
  Neutral: "bg-white/[0.06] text-ink-muted",
};

export function MarketNewsPanel() {
  const [filter, setFilter] = useState<(typeof NEWS_FILTERS)[number]>("All");
  const [open, setOpen] = useState<NewsItem | null>(null);

  const items = useMemo(
    () => (filter === "All" ? NEWS : NEWS.filter((n) => n.category === filter)),
    [filter]
  );

  const movers = [...PAIRS].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5);

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Market News"
        action={<span className="text-[11.5px] text-ink-muted">{items.length} stories</span>}
      />

      <Pills options={NEWS_FILTERS} value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {items.map((n) => (
            <article key={n.id} className="rounded-2xl glass transition-all duration-200 hover:border-brand-blue/25">
              <button
                type="button"
                onClick={() => setOpen(n)}
                className="w-full p-5 text-left"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11.5px] text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" strokeWidth={1.9} />
                    {n.time}
                  </span>
                  <span className="h-3 w-px bg-white/10" aria-hidden />
                  <span className="font-semibold text-ink">{n.source}</span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.1em]">
                    {n.category}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] ${TONE[n.sentiment]}`}
                  >
                    {n.sentiment}
                  </span>
                </div>

                <h3 className="mt-3 text-[17px] font-bold leading-snug tracking-tight text-white">
                  {n.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-ink-muted">
                  {n.summary}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {n.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-medium text-ink-muted"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto text-[11.5px] text-brand-blue">{n.affects}</span>
                </div>
              </button>
            </article>
          ))}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHead title="Top Movers" icon={TrendingUp} />
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
                        {up ? (
                          <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" strokeWidth={2.4} />
                        )}
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
              {CALENDAR.filter((e) => !e.actual)
                .slice(0, 5)
                .map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="num-mono w-[42px] shrink-0 text-[12.5px] font-semibold text-ink">
                      {e.time}
                    </span>
                    <span aria-hidden className="text-[13px]">
                      {e.flag}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {e.title}
                    </span>
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
              <span>{open.time}</span>
              <span className="h-3 w-px bg-white/10" aria-hidden />
              <span>{open.category}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${TONE[open.sentiment]}`}>
                {open.sentiment}
              </span>
            </div>
            <h3 className="mt-3 text-[20px] font-bold leading-snug tracking-tight text-white">
              {open.title}
            </h3>
            <p className="mt-4 text-[14px] font-medium leading-relaxed text-ink">{open.summary}</p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-muted">{open.body}</p>
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-4">
              {open.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-ink-muted"
                >
                  {t}
                </span>
              ))}
              <span className="ml-auto text-[12px] text-ink-muted">
                Most relevant to <span className="font-semibold text-brand-blue">{open.affects}</span>
              </span>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

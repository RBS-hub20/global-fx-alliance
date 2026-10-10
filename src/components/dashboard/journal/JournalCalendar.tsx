"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHead, money } from "@/components/ui/Primitives";
import { byDay, byWeekday, monthGrid, type JournalTrade } from "@/lib/journalPro";

/**
 * A month of results, one square per day.
 *
 * Intensity is net relative to the best and worst day in the month, not an
 * absolute scale — a £40 day in a quiet month should read as a good day, and
 * fixing the scale across months would flatten every ordinary week into grey.
 *
 * Days outside the month are drawn faintly rather than dropped, so the grid is
 * a calendar and not a jumble of squares.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function JournalCalendar({
  trades, onOpenDay,
}: {
  trades: JournalTrade[];
  onOpenDay: (day: string) => void;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() });

  const days = useMemo(() => byDay(trades), [trades]);
  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const weekdays = useMemo(() => byWeekday(trades), [trades]);

  const monthName = new Date(Date.UTC(cursor.y, cursor.m, 1))
    .toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  // Scale from this month's own extremes.
  const inMonth = grid.filter((d) => Number(d.slice(5, 7)) - 1 === cursor.m);
  const nets = inMonth.map((d) => days.get(d)?.net ?? 0).filter((n) => n !== 0);
  const best = Math.max(1, ...nets.map((n) => Math.abs(n)));

  const monthTotal = inMonth.reduce((a, d) => a + (days.get(d)?.net ?? 0), 0);
  const monthTrades = inMonth.reduce((a, d) => a + (days.get(d)?.trades ?? 0), 0);

  const step = (by: number) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m + by, 1));
    setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card className="p-5">
        <CardHead
          title={monthName}
          icon={CalendarDays}
          right={
            <span className="flex items-center gap-2">
              <span className={`num-mono text-[12px] font-semibold ${monthTotal >= 0 ? "text-brand-green" : "text-brand-danger"}`}>
                {money(monthTotal)}
              </span>
              <span className="num-mono text-[11px] text-ink-muted">{monthTrades} trades</span>
              <button type="button" onClick={() => step(-1)} aria-label="Previous month"
                className="rounded border border-white/[0.1] p-1 text-ink-muted hover:text-white">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next month"
                className="rounded border border-white/[0.1] p-1 text-ink-muted hover:text-white">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </span>
          }
        />

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => (
            <span key={w} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted/70">{w}</span>
          ))}

          {grid.map((day) => {
            const stat = days.get(day);
            const outside = Number(day.slice(5, 7)) - 1 !== cursor.m;
            const net = stat?.net ?? 0;
            const strength = stat ? Math.min(1, Math.abs(net) / best) : 0;
            const hasTrades = !!stat?.trades;

            return (
              <button
                key={day}
                type="button"
                disabled={!hasTrades}
                onClick={() => onOpenDay(day)}
                title={hasTrades ? `${day} · ${stat!.trades} trades · ${money(net)}` : day}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[11px] transition-all duration-200 ${
                  hasTrades ? "cursor-pointer hover:scale-[1.04] hover:border-brand-accent/50" : "cursor-default"
                } ${outside ? "opacity-25" : ""} border-white/[0.07]`}
                style={
                  hasTrades
                    ? {
                        background: net >= 0
                          ? `rgba(0,255,136,${0.1 + strength * 0.38})`
                          : `rgba(255,92,92,${0.1 + strength * 0.38})`,
                      }
                    : undefined
                }
              >
                <span className={`num-mono ${hasTrades ? "font-bold text-white" : "text-ink-muted/60"}`}>
                  {Number(day.slice(8, 10))}
                </span>
                {hasTrades ? (
                  <span className={`num-mono text-[9.5px] ${net >= 0 ? "text-brand-green" : "text-brand-danger"}`}>
                    {money(net, 0)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-muted/70">
          Shade is that day&apos;s net against the best and worst day of this month, so a quiet month still reads.
          Days with trades open the review for that day.
        </p>
      </Card>

      <Card>
        <CardHead title="By day of week" />
        {weekdays.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12.5px] text-ink-muted">
            Log a few trades and the pattern by weekday shows up here.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {weekdays.map((w) => {
              const widest = Math.max(...weekdays.map((x) => Math.abs(x.net)), 1);
              return (
                <li key={w.key} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-[38px] shrink-0 text-[12.5px] font-semibold text-white">{w.key}</span>
                  <span className="relative h-1.5 flex-1 rounded-full bg-white/[0.04]">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-white/[0.14]" />
                    <span
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        background: w.net >= 0 ? "#00ff88" : "#ff5c5c",
                        left: w.net >= 0 ? "50%" : `${50 - (Math.abs(w.net) / widest) * 50}%`,
                        width: `${Math.max((Math.abs(w.net) / widest) * 50, 1)}%`,
                      }}
                    />
                  </span>
                  <span className="num-mono w-[30px] shrink-0 text-right text-[11.5px] text-ink-muted">{w.trades}</span>
                  <span className="num-mono w-[38px] shrink-0 text-right text-[12px] text-ink">{w.winRate}%</span>
                  <span className={`num-mono w-[62px] shrink-0 text-right text-[12px] ${w.net >= 0 ? "text-brand-green" : "text-brand-danger"}`}>
                    {money(w.net)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

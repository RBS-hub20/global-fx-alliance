"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Card, Modal, PanelHeader, Pills } from "@/components/ui/Primitives";
import { CALENDAR, CALENDAR_CURRENCIES, type CalendarEvent } from "@/lib/data";
import { countdownFor, type Countdown } from "@/lib/eventCountdown";

const SCOPES = ["Today", "This Week", "High Impact"] as const;

const IMPACT: Record<CalendarEvent["impact"], string> = {
  High: "bg-brand-danger/[0.14] text-brand-danger",
  Medium: "bg-[#FFB020]/[0.14] text-[#FFB020]",
  Low: "bg-white/[0.06] text-ink-muted",
};

/** Badge tone per phase. */
const PHASE_STYLE: Record<Countdown["phase"], string> = {
  imminent: "bg-brand-danger/[0.16] text-brand-danger",
  live: "bg-brand-danger/[0.2] text-brand-danger",
  upcoming: "bg-white/[0.06] text-ink-muted",
  released: "bg-brand-green/[0.13] text-brand-green",
  missed: "bg-white/[0.04] text-ink-muted/60",
};

export function CalendarPanel() {
  /*
   * Null until mounted. Reading the clock during render puts a different minute
   * in the server HTML than the browser produces, and every row here is derived
   * from it — so the whole table would mismatch on hydration.
   */
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [scope, setScope] = useState<(typeof SCOPES)[number]>("Today");
  const [currency, setCurrency] = useState<(typeof CALENDAR_CURRENCIES)[number]>("All");
  const [open, setOpen] = useState<CalendarEvent | null>(null);

  const rows = useMemo(() => {
    let out = CALENDAR;
    if (scope === "High Impact") out = out.filter((e) => e.impact === "High");
    if (currency !== "All") out = out.filter((e) => e.currency === currency);
    return out;
  }, [scope, currency]);

  /** One countdown per row, recomputed on each tick. */
  const timing = useMemo(() => {
    const map = new Map<string, Countdown>();
    if (!now) return map;
    for (const e of rows) map.set(e.id, countdownFor(e.time, e.actual, now));
    return map;
  }, [rows, now]);

  /**
   * The next high-impact release still ahead — the one row worth drawing the
   * eye to. Chronological order is preserved; only the emphasis moves.
   */
  const nextHighId = useMemo(() => {
    let best: { id: string; away: number } | null = null;
    for (const e of rows) {
      if (e.impact !== "High") continue;
      const c = timing.get(e.id);
      if (!c || c.minutesAway <= 0 || c.phase === "released") continue;
      if (!best || c.minutesAway < best.away) best = { id: e.id, away: c.minutesAway };
    }
    return best?.id ?? null;
  }, [rows, timing]);

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Economic Calendar"
        action={
          <span className="num-mono text-[11.5px] text-ink-muted">
            {now
              ? `All times UTC · now ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`
              : "All times UTC"}
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <Pills options={SCOPES} value={scope} onChange={setScope} />
        <span className="hidden h-5 w-px bg-white/10 sm:block" aria-hidden />
        <Pills options={CALENDAR_CURRENCIES} value={currency} onChange={setCurrency} size="sm" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {["Time", "Currency", "Event", "Impact", "Actual", "Forecast", "Previous"].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted/70 ${
                      i >= 4 ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-ink-muted">
                    No events match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((e) => {
                  const c = timing.get(e.id);
                  const spent = c?.phase === "released" || c?.phase === "missed";
                  const hot = e.impact === "High" && (c?.phase === "imminent" || c?.phase === "live");
                  return (
                  <tr
                    key={e.id}
                    onClick={() => setOpen(e)}
                    className={`cursor-pointer transition-colors duration-200 hover:bg-white/[0.03] ${
                      spent ? "opacity-55" : ""
                    } ${hot ? "bg-brand-danger/[0.05] shadow-[inset_2px_0_0_0_var(--tw-shadow-color)] shadow-brand-danger" : ""} ${
                      !hot && e.id === nextHighId ? "shadow-[inset_2px_0_0_0_var(--tw-shadow-color)] shadow-brand-blue/70" : ""
                    }`}
                  >
                    <td className="num-mono whitespace-nowrap px-4 py-3.5 text-[13px] font-semibold text-ink">
                      <span className="flex flex-col gap-1">
                        <span>{e.time}</span>
                        {c ? (
                          <span
                            className={`inline-flex items-center gap-1 self-start rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${PHASE_STYLE[c.phase]}`}
                          >
                            {c.phase === "live" ? (
                              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                                <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-brand-danger opacity-70" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-danger" />
                              </span>
                            ) : null}
                            {c.label}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] text-ink-muted">
                      <span aria-hidden className="mr-1.5">{e.flag}</span>
                      {e.currency}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-ink">{e.title}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${IMPACT[e.impact]}`}>
                        {e.impact}
                      </span>
                    </td>
                    <td className={`num-mono px-4 py-3.5 text-right text-[13px] font-semibold ${e.actual ? "text-white" : "text-ink-muted/50"}`}>
                      {e.actual || "—"}
                    </td>
                    <td className="num-mono px-4 py-3.5 text-right text-[13px] text-ink-muted">{e.forecast}</td>
                    <td className="num-mono px-4 py-3.5 text-right text-[13px] text-ink-muted">{e.previous}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ""} wide>
        {open ? (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="num-mono rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] font-semibold text-white">
                {open.time} UTC
              </span>
              <span className="text-[13px] text-ink-muted">
                <span aria-hidden className="mr-1.5">{open.flag}</span>
                {open.currency}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] ${IMPACT[open.impact]}`}>
                {open.impact} impact
              </span>
            </div>

            <p className="mt-5 text-[13.5px] leading-relaxed text-ink-muted">{open.detail}</p>

            <dl className="mt-6 grid grid-cols-3 gap-3">
              {[
                { k: "Actual", v: open.actual || "Pending", tone: open.actual ? "text-white" : "text-ink-muted" },
                { k: "Forecast", v: open.forecast, tone: "text-ink" },
                { k: "Previous", v: open.previous, tone: "text-ink" },
              ].map((r) => (
                <div key={r.k} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3.5">
                  <dt className="text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{r.k}</dt>
                  <dd className={`num-mono mt-1.5 text-[16px] font-bold ${r.tone}`}>{r.v}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-5 flex items-center gap-2 border-t border-white/[0.08] pt-4 text-[12px] text-ink-muted">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
              Most relevant to <span className="font-semibold text-brand-blue">{open.affects}</span>
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

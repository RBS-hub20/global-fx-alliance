import { CalendarDays } from "lucide-react";
import { CALENDAR, type CalendarEvent } from "@/lib/data";

const IMPACT: Record<CalendarEvent["impact"], string> = {
  High: "bg-brand-danger/[0.14] text-brand-danger",
  Medium: "bg-[#FFB020]/[0.14] text-[#FFB020]",
  Low: "bg-white/[0.06] text-ink-muted",
};

export function EconomicCalendar() {
  return (
    <section id="economic-calendar" className="rounded-2xl glass">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-6 py-4">
        <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-white">
          <CalendarDays className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />
          Today&apos;s Economic Calendar
        </h2>
        <span className="text-[11px] text-ink-muted">All times UTC</span>
      </header>

      <ul className="divide-y divide-white/[0.06]">
        {CALENDAR.slice(0, 5).map((e) => (
          <li
            key={`${e.time}-${e.title}`}
            className="flex items-center gap-4 px-6 py-3.5 transition-colors duration-200 hover:bg-white/[0.02]"
          >
            <span className="num-mono w-[46px] shrink-0 text-[13px] font-semibold text-ink">
              {e.time}
            </span>
            <span className="flex w-[62px] shrink-0 items-center gap-1.5 text-[12px] text-ink-muted">
              <span aria-hidden>{e.flag}</span>
              {e.currency}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{e.title}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${IMPACT[e.impact]}`}
            >
              {e.impact}
            </span>
            <span className="hidden w-[104px] shrink-0 text-right text-[12px] text-ink-muted sm:block">
              <span className="num-mono text-ink">{e.forecast}</span>
              <span className="mx-1.5 text-ink-muted/50">vs</span>
              <span className="num-mono">{e.previous}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

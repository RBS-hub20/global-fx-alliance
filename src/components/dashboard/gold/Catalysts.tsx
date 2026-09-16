"use client";

import { CARD, EntryZoneChart, Gate, Head, MODE_MEANING, MODE_STYLE, mode } from "@/components/dashboard/terminal/TerminalBits";
import type { BiasRead } from "@/lib/biasModel";
import type { BotStatus } from "@/lib/botTypes";
import { countdownLabel, impactOf, type CalendarEvent, type CotRead, type NewsWindow } from "@/lib/goldIntel";
import { dubaiClock } from "@/lib/goldWire";
import { Spark } from "./Spark";

export interface Mover {
  symbol: string; label: string; price: number; change: number; pct: number;
  decimals: number; spark: number[]; isReal: boolean; source: string; note?: string;
}

const SIDE_CHIP = {
  bullish: "border-[#00ff88]/40 bg-[#00ff88]/[0.1] text-[#00ff88]",
  bearish: "border-[#ff4d4d]/40 bg-[#ff4d4d]/[0.1] text-[#ff4d4d]",
  neutral: "border-[#262626] text-[#a3a3a3]",
} as const;

const IMPACT_COLOUR = { HIGH: "#ff4d4d", MEDIUM: "#facc15", LOW: "#525252" } as const;

export function Catalysts({ movers, events, now, window: win, read, status, statusLoaded, cot, cotSource }: {
  movers: Mover[] | null;
  events: CalendarEvent[] | null;
  now: Date;
  window: NewsWindow;
  read: BiasRead | null;
  status: BotStatus | null;
  statusLoaded: boolean;
  cot: CotRead | null;
  cotSource: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ------------------------------------------------------ top movers */}
      <div className={CARD}>
        <Head right={<span className="font-mono text-[10px] text-[#525252]">24h · 1H bars</span>}>TOP MOVERS · GOLD</Head>
        <ul className="divide-y divide-[#262626]">
          {movers === null ? (
            [0, 1, 2, 3].map((i) => <li key={i} className="m-3 h-9 animate-pulse rounded bg-[#0a0a0a]" />)
          ) : movers.length === 0 ? (
            <li className="px-4 py-4 font-mono text-[11.5px] text-[#a3a3a3]">Gold prices are not available right now.</li>
          ) : movers.map((m) => (
            <li key={m.symbol} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="num-mono text-[12.5px] font-bold text-[#e5e5e5]">{m.symbol}</p>
                <p className="truncate font-mono text-[9.5px] text-[#525252]">{m.note ?? m.label}</p>
              </div>
              <Spark values={m.spark} up={m.pct >= 0} width={64} height={24} />
              <div className="text-right">
                <p className="num-mono whitespace-nowrap text-[13px] font-bold text-[#e5e5e5]">
                  {m.price.toLocaleString("en-US", { minimumFractionDigits: m.decimals, maximumFractionDigits: m.decimals })}
                </p>
                <p className={`num-mono whitespace-nowrap text-[11px] ${m.pct >= 0 ? "text-[#00ff88]" : "text-[#ff4d4d]"}`}>
                  {m.pct >= 0 ? "+" : ""}{m.pct.toFixed(2)}%
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* --------------------------------------------------------- next up */}
      <div className={CARD}>
        <Head right={<span className="font-mono text-[10px] text-[#525252]">Dubai time</span>}>NEXT CATALYSTS</Head>

        {win.active && win.event ? (
          <div className="mx-3 mt-3 rounded border border-[#facc15]/40 bg-[#facc15]/10 px-3 py-2">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#facc15]">
              YELLOW · news window
            </p>
            <p className="mt-0.5 text-[11.5px] text-[#e5e5e5]">
              {win.event.title} {win.minutes !== null && win.minutes > 0 ? `in ${win.minutes}m` : win.minutes === 0 ? "now" : `${Math.abs(win.minutes ?? 0)}m ago`}
            </p>
            {/* The page's calendar read and the engine's flag are shown side by side,
                never merged: only the bridge can actually stop a trade. */}
            <p className="mt-1 font-mono text-[10px] text-[#a3a3a3]">
              engine news_block: {status?.news_block === true ? "blocking" : status?.news_block === false ? "not blocking" : "not reported"}
            </p>
          </div>
        ) : null}

        <ul className="divide-y divide-[#262626]">
          {events === null ? (
            [0, 1, 2, 3].map((i) => <li key={i} className="m-3 h-9 animate-pulse rounded bg-[#0a0a0a]" />)
          ) : events.length === 0 ? (
            <li className="px-4 py-4 font-mono text-[11.5px] text-[#a3a3a3]">No gold catalysts left on this week&apos;s calendar.</li>
          ) : events.map((e) => {
            const impact = impactOf(e.impact);
            const cd = e.timestamp ? countdownLabel(e.timestamp, now) : "—";
            return (
              <li key={`${e.id ?? e.title}-${e.timestamp}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="num-mono w-[42px] shrink-0 text-[12px] text-[#e5e5e5]">{e.timestamp ? dubaiClock(e.timestamp) : "--:--"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-[#e5e5e5]" title={e.title}>{e.title}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] text-[#525252]">{e.currency}</span>
                    <span className="flex gap-0.5" aria-label={`${impact} impact`}>
                      {[0, 1, 2].map((n) => (
                        <span key={n} className="h-1 w-3 rounded-full"
                          style={{ background: n < (impact === "HIGH" ? 3 : impact === "MEDIUM" ? 2 : 1) ? IMPACT_COLOUR[impact] : "#262626" }} />
                      ))}
                    </span>
                    <span className="font-mono text-[9px] font-bold" style={{ color: IMPACT_COLOUR[impact] }}>{impact}</span>
                  </div>
                </div>
                <span className={`num-mono shrink-0 whitespace-nowrap text-[11px] ${cd === "LIVE" ? "animate-pulse font-bold text-[#00ff88]" : "text-[#a3a3a3]"}`}>{cd}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ------------------------------------------------------ gfxa bias */}
      <div className={CARD}>
        <Head>GFXA BIAS</Head>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#525252]">model</span>
            {read ? (
              <span className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${SIDE_CHIP[read.side]}`}>
                {read.side} {read.thin ? "—" : `${read.share}%`}
              </span>
            ) : <span className="h-5 w-24 animate-pulse rounded bg-[#0a0a0a]" />}
            <span className="font-mono text-[9.5px] text-[#525252]">GFXA-Structure · 1H</span>
          </div>

          {/* The engine block reuses the AI Bot tab's gates and mode colours. */}
          {!statusLoaded ? (
            <div className="h-16 animate-pulse rounded bg-[#0a0a0a]" />
          ) : !status ? (
            <p className="rounded border border-[#262626] bg-[#0a0a0a] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[#a3a3a3]">
              Engine has not reported yet. Direction, confidence and regime appear here when the VPS writes its first
              status row — nothing is simulated.
            </p>
          ) : (
            <div className="rounded-lg border border-[#262626] border-l-2 bg-[#0a0a0a] px-3 py-2.5" style={{ borderLeftColor: mode(status.current_mode) }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded border px-1.5 py-px font-mono text-[9.5px] font-bold uppercase ${MODE_STYLE[status.current_mode]}`}>{status.current_mode}</span>
                <span className="num-mono text-[13px] font-bold text-[#e5e5e5]">
                  {status.direction ? status.direction.replace("_", " ") : "direction —"}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10.5px] text-[#a3a3a3]">
                confidence {status.confidence != null ? `${Number(status.confidence).toFixed(0)}%` : "—"} · regime {status.regime ?? "—"}
              </p>
              <p className="mt-1 text-[10.5px] text-[#525252]">{MODE_MEANING[status.current_mode]}</p>
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
                <Gate label="Guardian" state={status.guardian_passed} okText="passed" badText="blocked" />
                <Gate label="Journal" state={status.journal_ok} okText="green" badText="flagged" />
                <Gate label="News" state={status.news_block === null ? null : !status.news_block} okText="clear" badText="blocked" />
              </p>
            </div>
          )}

          <EntryZoneChart
            symbol="XAUUSD"
            low={status?.entry_zone_low != null ? Number(status.entry_zone_low) : null}
            high={status?.entry_zone_high != null ? Number(status.entry_zone_high) : null}
          />

          <div className="rounded border border-[#262626] bg-[#0a0a0a] px-3 py-2.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#525252]">
              _&gt; positioning · COT{cot ? ` · ${cot.date}` : ""}
            </p>
            {cot ? (
              <>
                <p className="num-mono mt-1 text-[12.5px] text-[#e5e5e5]">
                  Speculators net long <span className="text-[#00ff88]">{cot.specPct.toFixed(1)}%</span>
                  {cot.specChange !== null ? (
                    <span className="text-[10.5px] text-[#a3a3a3]"> ({cot.specChange >= 0 ? "+" : ""}{cot.specChange.toLocaleString("en-US")} w/w)</span>
                  ) : null}
                </p>
                <p className="num-mono text-[12.5px] text-[#e5e5e5]">
                  Commercials net {cot.commercialNet < 0 ? "short" : "long"}{" "}
                  <span className={cot.commercialNet < 0 ? "text-[#ff4d4d]" : "text-[#00ff88]"}>{Math.abs(cot.commercialPct).toFixed(1)}%</span>
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#525252]">
                  Share of open interest. Commercials in gold are producers and dealers hedging, so they sit net short by
                  structure — the signal is in how far speculators stretch. {cotSource ? `${cotSource}.` : ""}
                </p>
              </>
            ) : (
              <p className="mt-1 font-mono text-[11px] text-[#a3a3a3]">CFTC positioning not available right now.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

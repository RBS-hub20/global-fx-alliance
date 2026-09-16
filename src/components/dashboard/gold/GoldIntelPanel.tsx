"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { generateDrawings } from "@/lib/autoDraw";
import { readBias } from "@/lib/biasModel";
import type { Candle } from "@/lib/indicators";
import type { BotStatus } from "@/lib/botTypes";
import { newsWindow, upcomingCatalysts, type CalendarEvent, type CotRead } from "@/lib/goldIntel";
import { dubaiClock } from "@/lib/goldWire";
import { LiveWire, type WireSource, type WireStory } from "./LiveWire";
import { Technicals, type Correlation, type Seasonal } from "./Technicals";
import { Catalysts, type Mover } from "./Catalysts";

/**
 * Market News, rebuilt as XAU/USD-only intelligence.
 *
 * Every number on this tab comes from one of four places, and nothing is
 * invented to fill a gap:
 *   - /api/market-news/live-wire   filtered desk headlines         30s
 *   - /api/market-news/gold-context spot, futures, XAU/EUR, XAU/GBP 30s
 *   - /api/market-news/gold-macro  seasonals, correlations, COT    hourly
 *   - bot_status                   the engine, over Realtime
 * plus the calendar and the 1H candles the Market Analysis tab already uses.
 *
 * The model read is generateDrawings + readBias on those candles — the same
 * two calls the Market Analysis bias card makes, not a second implementation.
 */

const EVERY = { wire: 30_000, movers: 30_000, candles: 60_000, calendar: 300_000, macro: 3_600_000, clock: 30_000 };

/** setInterval that skips ticks while the browser tab is hidden. */
function usePoll(fn: () => void, ms: number) {
  useEffect(() => {
    fn();
    const id = setInterval(() => { if (document.visibilityState === "visible") fn(); }, ms);
    const onShow = () => { if (document.visibilityState === "visible") fn(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onShow); };
  }, [fn, ms]);
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export function GoldIntelPanel() {
  const { session } = useAuth();
  const supabase = supabaseBrowser();

  const [wire, setWire] = useState<{ stories: WireStory[]; sources: WireSource[]; at: string } | null>(null);
  const [wireLoading, setWireLoading] = useState(true);
  const [movers, setMovers] = useState<Mover[] | null>(null);
  const [candles, setCandles] = useState<{ bars: Candle[]; price: number; label: string } | null>(null);
  const [calendar, setCalendar] = useState<CalendarEvent[] | null>(null);
  const [macro, setMacro] = useState<{
    seasonals: Seasonal[]; seasonalSource: string | null; correlations: Correlation[];
    correlationBasis: string | null; cot: CotRead | null; cotSource: string | null;
  } | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  /* ---------------------------------------------------------------- polls */

  usePoll(useCallback(async () => {
    const j = await getJson<{ stories: WireStory[]; sources: WireSource[]; timestamp: string }>("/api/market-news/live-wire");
    setWireLoading(false);
    // A failed poll keeps the last good wire rather than blanking it.
    if (j) setWire({ stories: j.stories, sources: j.sources, at: j.timestamp });
  }, []), EVERY.wire);

  usePoll(useCallback(async () => {
    const j = await getJson<{ movers: Mover[] }>("/api/market-news/gold-context");
    if (j) setMovers(j.movers);
    else setMovers((m) => m ?? []);
  }, []), EVERY.movers);

  usePoll(useCallback(async () => {
    const j = await getJson<{ candles: Candle[]; price: number; isReal: boolean; source: string }>("/api/chart-snap/live?pair=XAU%2FUSD&tf=1H");
    if (j?.candles?.length) setCandles({ bars: j.candles, price: j.price, label: `XAU/USD · 1H · ${j.isReal ? j.source : "modelled"}` });
  }, []), EVERY.candles);

  usePoll(useCallback(async () => {
    const j = await getJson<{ events: CalendarEvent[] }>("/api/calendar/live");
    setCalendar(j?.events ?? []);
  }, []), EVERY.calendar);

  usePoll(useCallback(async () => {
    const j = await getJson<{
      seasonals: Seasonal[]; seasonalSource: string | null; correlations: Correlation[];
      correlationBasis: string | null; cot: CotRead | null; cotSource: string | null;
    }>("/api/market-news/gold-macro");
    if (j) setMacro(j);
  }, []), EVERY.macro);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), EVERY.clock);
    return () => clearInterval(id);
  }, []);

  /* ------------------------------------------------------- engine status */

  useEffect(() => {
    if (!session) { setStatusLoaded(true); return; }
    let alive = true;
    (async () => {
      const j = await getJson<{ status: BotStatus | null }>("/api/bot/status?symbol=XAUUSD");
      if (!alive) return;
      setStatus(j?.status ?? null);
      setStatusLoaded(true);
    })();

    if (!supabase) return () => { alive = false; };
    // Same channel shape as the AI Bot tab, so both tabs react to one engine write.
    const channel = supabase
      .channel(`gfxa-gold-intel-${session.user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bot_status", filter: `user_id=eq.${session.user.id}` },
        (p) => { const row = p.new as BotStatus; if (row?.current_symbol === "XAUUSD") setStatus(row); })
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [session, supabase]);

  /* ------------------------------------------------------------- derived */

  const drawings = useMemo(() => (candles ? generateDrawings(candles.bars) : null), [candles]);
  const read = useMemo(() => (drawings && candles ? readBias(drawings, candles.price, 2) : null), [drawings, candles]);
  const events = useMemo(() => (calendar ? upcomingCatalysts(calendar, now) : null), [calendar, now]);
  const win = useMemo(() => newsWindow(calendar ?? [], now), [calendar, now]);
  const spot = movers?.find((m) => m.symbol === "XAUUSD") ?? null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
          <span className="text-[#00ff88]/50">_&gt;</span> XAUUSD MARKET INTELLIGENCE
        </h2>
        {spot ? (
          <span className="num-mono whitespace-nowrap text-[15px] font-bold text-[#e5e5e5]">
            {spot.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
            <span className={`text-[12px] ${spot.pct >= 0 ? "text-[#00ff88]" : "text-[#ff4d4d]"}`}>
              {spot.pct >= 0 ? "▲ +" : "▼ "}{spot.pct.toFixed(2)}%
            </span>
          </span>
        ) : null}
        {win.active ? (
          <span className="rounded border border-[#facc15] bg-[#facc15]/10 px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#facc15]">
            YELLOW · news window
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[10.5px] text-[#525252]">{dubaiClock(now)} Dubai</span>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <LiveWire stories={wire?.stories ?? (wireLoading ? null : [])} sources={wire?.sources ?? []}
            updated={wire ? dubaiClock(wire.at) : null} loading={wireLoading} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Technicals
            read={read}
            indicators={drawings?.indicators ?? null}
            price={candles?.price ?? null}
            candlesLabel={candles?.label ?? "XAU/USD · 1H"}
            status={status}
            seasonals={macro?.seasonals ?? []}
            seasonalSource={macro?.seasonalSource ?? null}
            correlations={macro?.correlations ?? []}
            correlationBasis={macro?.correlationBasis ?? null}
          />
        </div>
      </div>

      <Catalysts movers={movers} events={events} now={now} window={win} read={read}
        status={status} statusLoaded={statusLoaded} cot={macro?.cot ?? null} cotSource={macro?.cotSource ?? null} />

      <p className="font-mono text-[10.5px] leading-relaxed text-[#a3a3a3]">
        Educational only — not financial advice. Headlines are classified by fixed rules, the gauge is structural weight
        rather than probability, and engine fields appear only when the VPS has written them.
      </p>
    </div>
  );
}

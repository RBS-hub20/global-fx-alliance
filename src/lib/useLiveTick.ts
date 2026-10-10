"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "./supabaseClient";

/**
 * The latest price for one symbol, pushed rather than polled.
 *
 * A daemon on the VPS holds the single TwelveData WebSocket the plan allows and
 * writes what it sees into market_ticks; this listens to that row through
 * Supabase Realtime. One upstream connection serves every open tab, and the
 * TwelveData key never leaves the VPS.
 *
 * Deliberately additive. The panel keeps its existing polled price and uses this
 * only while it is actually arriving — if the daemon stops, `live` goes false
 * within ninety seconds and the page carries on exactly as it did before. A
 * stale push is worse than a slow poll on a page about prices.
 */

export interface LiveTick {
  symbol: string;
  price: number;
  changePercent: number | null;
  rsi: number | null;
  bbWidth: number | null;
  ema50Dist: number | null;
  adx: number | null;
  observedAt: string;
}

/** How long after the last message the stream still counts as live. */
const STALE_MS = 90_000;

const row = (r: Record<string, unknown>): LiveTick | null => {
  const price = Number(r.price);
  if (!Number.isFinite(price)) return null;
  const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    symbol: String(r.symbol ?? ""),
    price,
    changePercent: n(r.change_percent),
    rsi: n(r.rsi),
    bbWidth: n(r.bb_width),
    ema50Dist: n(r.ema50_dist),
    adx: n(r.adx),
    observedAt: String(r.observed_at ?? new Date().toISOString()),
  };
};

export function useLiveTick(symbol: string): { tick: LiveTick | null; live: boolean } {
  const [tick, setTick] = useState<LiveTick | null>(null);
  const [live, setLive] = useState(false);
  const lastAt = useRef(0);

  useEffect(() => {
    const db = supabaseBrowser();
    if (!db) return;
    let alive = true;

    const accept = (r: Record<string, unknown> | null | undefined) => {
      if (!alive || !r) return;
      const t = row(r);
      if (!t) return;
      lastAt.current = Date.now();
      setTick(t);
      setLive(true);
    };

    // The row as it stands, so the first paint is not empty while waiting for a
    // tick that may be a minute away on a quiet market.
    void db.from("market_ticks").select("*").eq("symbol", symbol).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const observed = Date.parse(String(data.observed_at ?? ""));
        // Seed the value but do not claim it is live — the daemon may be down.
        const t = row(data as Record<string, unknown>);
        if (alive && t) {
          setTick(t);
          setLive(Number.isFinite(observed) && Date.now() - observed < STALE_MS);
          if (Number.isFinite(observed)) lastAt.current = observed;
        }
      });

    const channel = db
      .channel(`market_ticks:${symbol}`)
      .on(
        "postgres_changes",
        // UPDATE as well as INSERT: the table holds one row per symbol and the
        // relay upserts it, so after the first tick every message is an update.
        { event: "*", schema: "public", table: "market_ticks", filter: `symbol=eq.${symbol}` },
        (payload) => accept(payload.new as Record<string, unknown>)
      )
      .subscribe();

    // Nothing arriving is itself information; without this the page would show
    // a frozen number under a green light.
    const timer = setInterval(() => {
      if (alive && lastAt.current && Date.now() - lastAt.current > STALE_MS) setLive(false);
    }, 15_000);

    return () => {
      alive = false;
      clearInterval(timer);
      void db.removeChannel(channel);
    };
  }, [symbol]);

  return { tick, live };
}

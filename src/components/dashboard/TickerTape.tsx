"use client";

import { useEffect, useRef, useState } from "react";
import { PAIRS } from "@/lib/market";

interface Tick {
  symbol: string;
  price: number;
  changePct: number;
  decimals: number;
  live: boolean;
}

const TAPE = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "AUD/USD", "USD/CHF", "NZD/USD", "EUR/GBP"];

/** Seeded values render first so the tape never starts empty or shifts layout. */
const SEED: Tick[] = TAPE.map((symbol) => {
  const p = PAIRS.find((x) => x.symbol === symbol) ?? PAIRS[0];
  return { symbol, price: p.price, changePct: p.changePct, decimals: p.decimals, live: false };
});

/**
 * Bloomberg-style scrolling tape. Polls the live endpoint once a minute and
 * marks which quotes came back live; the seeded values stay on screen if a
 * refresh fails, so the strip never blanks out.
 */
export function TickerTape() {
  const [ticks, setTicks] = useState<Tick[]>(SEED);
  const [updated, setUpdated] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    const load = async () => {
      const next = await Promise.all(
        TAPE.map(async (symbol): Promise<Tick> => {
          const seeded = SEED.find((s) => s.symbol === symbol) as Tick;
          try {
            const res = await fetch(`/api/market/live?pair=${encodeURIComponent(symbol)}`);
            if (!res.ok) return seeded;
            const j = await res.json();
            return {
              symbol,
              price: typeof j.price === "number" ? j.price : seeded.price,
              changePct: typeof j.changePct === "number" ? j.changePct : seeded.changePct,
              decimals: typeof j.decimals === "number" ? j.decimals : seeded.decimals,
              live: j.source === "live",
            };
          } catch {
            return seeded;
          }
        })
      );
      if (!alive.current) return;
      setTicks(next);
      setUpdated(
        new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
      );
    };

    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, []);

  // Rendered twice so the marquee loops without a visible seam.
  const strip = [...ticks, ...ticks];

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#070A12]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#070A12] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#070A12] to-transparent" />

      <div className="flex w-max animate-ticker items-center gap-6 py-2.5 will-change-transform hover:[animation-play-state:paused]">
        {strip.map((t, i) => {
          const up = t.changePct > 0;
          const flat = t.changePct === 0;
          const tone = flat ? "text-[#fbbf24]" : up ? "text-brand-green" : "text-brand-danger";
          return (
            <span key={`${t.symbol}-${i}`} className="flex shrink-0 items-center gap-2 whitespace-nowrap px-1">
              <span className="text-[11.5px] font-semibold tracking-tight text-ink">{t.symbol}</span>
              <span className="num-mono text-[12px] font-bold text-white">
                {t.price.toFixed(t.decimals)}
              </span>
              <span className={`num-mono text-[11.5px] font-semibold ${tone}`}>
                {flat ? "▬" : up ? "▲" : "▼"}
                {up ? "+" : ""}
                {t.changePct.toFixed(2)}%
              </span>
              <span className="text-white/10">|</span>
            </span>
          );
        })}
      </div>

      <div className="absolute right-2 top-1/2 z-20 -translate-y-1/2">
        <span className="rounded-full border border-white/[0.08] bg-[#070A12] px-2 py-0.5 text-[9.5px] uppercase tracking-[0.12em] text-ink-muted">
          {ticks.some((t) => t.live) ? "Live" : "Modeled"}
          {updated ? ` ${updated}` : ""}
        </span>
      </div>
    </div>
  );
}

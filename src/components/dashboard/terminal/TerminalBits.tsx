"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Terminal building blocks shared by the AI Bot tab and the Gold Intelligence
 * tab. Moved here from AiBotPanel so the engine's mode, gates and entry zone
 * render from one implementation in both places — two copies would drift the
 * first time either tab's styling changed.
 */

export const CARD = "rounded-lg border border-[#262626] bg-[#141414]";
export const GREEN = "#00ff88";
export const MODE_STYLE: Record<string, string> = {
  GREEN: "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]",
  YELLOW: "border-[#facc15] bg-[#facc15]/10 text-[#facc15]",
  RED: "border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]",
};
export const MODE_MEANING: Record<string, string> = {
  GREEN: "Conditions the engine was told to trade. Proposals may appear.",
  YELLOW: "Waiting. Trend or volatility is not where it wants it — no proposals.",
  RED: "Stood down. Daily loss limit, spread, or news window.",
};

export function Head({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 border-b border-[#262626] px-4 py-2.5">
      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
        <span className="text-[#00ff88]/50">_&gt;</span> {children}
      </h3>
      {right ? <span className="ml-auto">{right}</span> : null}
    </header>
  );
}

export const mode = (m: string) => (m === "GREEN" ? GREEN : m === "RED" ? "#ef4444" : "#facc15");

/** One gate in the mode strip. Null is "not reported", which is not "passed". */
export function Gate({ label, state, okText, badText }: {
  label: string; state: boolean | null; okText: string; badText: string;
}) {
  const colour = state === null ? "#525252" : state ? GREEN : "#ef4444";
  return (
    <span className="flex items-center gap-1" style={{ color: colour }}>
      <span className="h-1 w-1 rounded-full" style={{ background: colour }} />
      {label} {state === null ? "—" : state ? okText : badText}
    </span>
  );
}

/**
 * Entry zone over the real price line.
 *
 * The candles come from /api/chart-snap/live — the same provider chain the
 * Market Analysis chart uses — so the line here and the chart on the other tab
 * describe one series. The band is whatever the engine wrote; with no zone set
 * this is just the price line rather than an invented box.
 */
export function EntryZoneChart({ symbol, low, high }: { symbol: string; low: number | null; high: number | null }) {
  const [closes, setCloses] = useState<number[] | null>(null);

  const pair = useMemo(() => {
    const s = symbol.toUpperCase().replace("/", "");
    return s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : symbol;
  }, [symbol]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/chart-snap/live?pair=${encodeURIComponent(pair)}&tf=15M`);
        const j = await res.json();
        if (!alive || !Array.isArray(j.candles)) return;
        setCloses(j.candles.slice(-80).map((c: { close: number }) => c.close));
      } catch { if (alive) setCloses([]); }
    })();
    return () => { alive = false; };
  }, [pair]);

  if (closes === null) return <div className="h-[110px] animate-pulse rounded-lg bg-[#0a0a0a]" />;
  if (closes.length < 2) return null;

  const W = 600, H = 110, PAD = 6;
  const lo = Math.min(...closes, ...(low !== null ? [low] : []));
  const hi = Math.max(...closes, ...(high !== null ? [high] : []));
  const span = hi - lo || 1;
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
  const x = (i: number) => (i / (closes.length - 1)) * W;
  const points = closes.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" ");

  return (
    <div className="overflow-hidden rounded-lg border border-[#262626] bg-[#0a0a0a]">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[110px] w-full" preserveAspectRatio="none" role="img"
        aria-label={low !== null ? `${pair} with entry zone ${low} to ${high}` : `${pair} price`}>
        {low !== null && high !== null ? (
          <>
            <rect x="0" y={y(high)} width={W} height={Math.max(1, y(low) - y(high))} fill="#00ff88" opacity="0.09" />
            <line x1="0" x2={W} y1={y(high)} y2={y(high)} stroke="#00ff88" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
            <line x1="0" x2={W} y1={y(low)} y2={y(low)} stroke="#00ff88" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
          </>
        ) : null}
        <polyline points={points} fill="none" stroke="#00ff88" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex items-center gap-2 border-t border-[#262626] px-3 py-1.5">
        <span className={`rounded border px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${
          low !== null ? "border-[#00ff88] text-[#00ff88]" : "border-[#262626] text-[#525252]"
        }`}>
          entry zone
        </span>
        <span className="num-mono text-[10.5px] text-[#a3a3a3]">
          {low !== null && high !== null ? `${low.toFixed(2)} – ${high.toFixed(2)}` : "none set"}
        </span>
        <span className="num-mono ml-auto text-[10px] text-[#525252]">{pair} · 15M · {closes.length} bars</span>
      </div>
    </div>
  );
}

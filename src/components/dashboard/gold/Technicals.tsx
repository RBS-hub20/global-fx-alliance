"use client";

import { useState } from "react";
import { CARD, Head } from "@/components/dashboard/terminal/TerminalBits";
import type { IndicatorSnapshot } from "@/lib/indicators";
import type { BiasRead } from "@/lib/biasModel";
import type { BotStatus } from "@/lib/botTypes";
import { gaugeValue, zoneFor, type Zone } from "@/lib/goldIntel";

export interface Seasonal { year: number; ytd: number; points: { doy: number; pct: number }[] }
export interface Correlation { label: string; symbol: string; r: number | null; n: number }

const ZONE_COLOUR: Record<Zone, string> = {
  "Strong sell": "#ff4d4d", Sell: "#ff8a8a", Neutral: "#a3a3a3", Buy: "#00ff88", "Strong buy": "#00ff88",
};

/* ------------------------------------------------------------------ gauge */

/** Half-dial. −1 on the left, +1 on the right; bands match zoneFor's cut-offs. */
function Gauge({ value }: { value: number }) {
  const cx = 100, cy = 100, r = 78;
  const at = (v: number) => {
    const a = Math.PI - ((v + 1) / 2) * Math.PI;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };
  const arc = (from: number, to: number) => {
    const a = at(from), b = at(to);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };
  const bands: [number, number, string, number][] = [
    [-1, -0.6, "#ff4d4d", 1], [-0.6, -0.2, "#ff8a8a", 1], [-0.2, 0.2, "#262626", 1], [0.2, 0.6, "#00ff88", 0.5], [0.6, 1, "#00ff88", 1],
  ];
  const tip = at(value);
  const needle = { x: cx + (tip.x - cx) * 0.86, y: cy + (tip.y - cy) * 0.86 };

  return (
    <svg viewBox="0 0 200 112" className="mx-auto block w-full max-w-[280px]" role="img" aria-label={`Technicals gauge: ${zoneFor(value)}`}>
      <path d={arc(-1, 1)} stroke="#262626" strokeWidth="14" fill="none" />
      {bands.map(([a, b, c, o]) => (
        <path key={a} d={arc(a + 0.012, b - 0.012)} stroke={c} strokeOpacity={o} strokeWidth="10" fill="none" />
      ))}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#e5e5e5" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#e5e5e5" />
      <text x="16" y="110" fill="#525252" fontSize="8" fontFamily="ui-monospace, monospace">STRONG SELL</text>
      <text x="184" y="110" fill="#525252" fontSize="8" fontFamily="ui-monospace, monospace" textAnchor="end">STRONG BUY</text>
    </svg>
  );
}

/* -------------------------------------------------------------- seasonals */

const MONTHS: [string, number][] = [["Jan", 1], ["Apr", 91], ["Jul", 182], ["Oct", 274]];
const YEAR_STYLE = [
  { stroke: "#00ff88", width: 1.8, dash: undefined },
  { stroke: "#a3a3a3", width: 1.2, dash: undefined },
  // #262626 disappears on a #141414 card; one step lighter stays legible.
  { stroke: "#525252", width: 1.2, dash: undefined },
  { stroke: "#3f3f3f", width: 1, dash: "3 3" },
  { stroke: "#333333", width: 1, dash: "3 3" },
];

function Seasonals({ curves, source }: { curves: Seasonal[]; source: string | null }) {
  const [more, setMore] = useState(false);
  const shown = curves.filter((c) => c.points.length).slice(0, more ? 5 : 3);
  if (!shown.length) {
    return <p className="font-mono text-[11px] text-[#a3a3a3]">Seasonal history not available right now.</p>;
  }

  const W = 320, H = 120;
  const all = shown.flatMap((c) => c.points.map((p) => p.pct));
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  const span = hi - lo || 1;
  const x = (doy: number) => ((doy - 1) / 365) * W;
  const y = (pct: number) => 4 + (1 - (pct - lo) / span) * (H - 16);
  const available = curves.filter((c) => c.points.length).length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full" preserveAspectRatio="none" role="img" aria-label="Gold seasonality by year">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="#262626" strokeDasharray="2 3" />
        {[...shown].reverse().map((c) => {
          const i = curves.filter((k) => k.points.length).indexOf(c);
          const st = YEAR_STYLE[i] ?? YEAR_STYLE[4];
          return (
            <polyline key={c.year} fill="none" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash}
              vectorEffect="non-scaling-stroke" points={c.points.map((p) => `${x(p.doy).toFixed(1)},${y(p.pct).toFixed(1)}`).join(" ")} />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9.5px] text-[#525252]">
        {MONTHS.map(([m]) => <span key={m}>{m}</span>)}
        <span>Dec</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {shown.map((c, i) => (
          <span key={c.year} className="flex items-center gap-1.5 font-mono text-[10.5px]">
            <span className="inline-block h-0.5 w-3" style={{ background: YEAR_STYLE[i].stroke }} />
            <span className="text-[#a3a3a3]">{c.year}</span>
            <span className={c.ytd >= 0 ? "text-[#00ff88]" : "text-[#ff4d4d]"}>{c.ytd >= 0 ? "+" : ""}{c.ytd.toFixed(1)}%</span>
          </span>
        ))}
        {available > 3 ? (
          <button type="button" onClick={() => setMore((m) => !m)} className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-[#525252] hover:text-[#00ff88]">
            {more ? "fewer" : "more seasonals"}
          </button>
        ) : null}
      </div>
      {source ? <p className="mt-1 font-mono text-[9.5px] text-[#525252]">{source} · % from each year&apos;s first close</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ panel */

export function Technicals({
  read, indicators, price, candlesLabel, status, seasonals, seasonalSource, correlations, correlationBasis,
}: {
  read: BiasRead | null;
  indicators: IndicatorSnapshot | null;
  price: number | null;
  candlesLabel: string;
  status: BotStatus | null;
  seasonals: Seasonal[];
  seasonalSource: string | null;
  correlations: Correlation[];
  correlationBasis: string | null;
}) {
  const [more, setMore] = useState(false);
  const value = read ? gaugeValue(read) : 0;
  const zone = zoneFor(value);

  const ema50Dist = indicators?.ema50 && price ? ((price - indicators.ema50) / indicators.ema50) * 100 : null;
  const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d));

  // Engine value when the bridge has reported one; otherwise this page's own
  // read of the same 1H candles, and labelled so the two are never confused.
  const row: { label: string; value: string; src: string }[] = [
    { label: "RSI 14", value: fmt(indicators?.rsi, 1), src: "1H" },
    { label: "ADX H1", value: status?.adx_h1 != null ? Number(status.adx_h1).toFixed(0) : "—", src: status?.adx_h1 != null ? "engine" : "not reported" },
    status?.bb_width
      ? { label: "BB width", value: status.bb_width, src: "engine" }
      : { label: "BB width", value: indicators?.bollinger?.widthPct != null ? `${indicators.bollinger.widthPct.toFixed(2)}%` : "—", src: "1H" },
    status?.ema_distance
      ? { label: "EMA dist", value: status.ema_distance, src: "engine" }
      : { label: "EMA50 dist", value: ema50Dist === null ? "—" : `${ema50Dist >= 0 ? "+" : ""}${ema50Dist.toFixed(2)}%`, src: "1H" },
  ];

  return (
    <div className={CARD}>
      <Head right={<span className="hidden font-mono text-[10px] text-[#525252] sm:inline">{candlesLabel}</span>}>XAUUSD TECHNICALS</Head>

      <div className="space-y-4 p-4">
        {!read || !indicators ? (
          <div className="h-[150px] animate-pulse rounded bg-[#0a0a0a]" />
        ) : (
          <div className="rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 pb-3 pt-2">
            <Gauge value={value} />
            <p className="num-mono -mt-1 text-center text-[22px] font-bold uppercase leading-none" style={{ color: ZONE_COLOUR[zone] }}>
              {zone}
            </p>
            <p className="mt-1.5 text-center font-mono text-[10px] text-[#525252]">
              GFXA-Structure · {read.thin ? "thin read" : `${read.share}% ${read.side}`} · structural weight, not probability
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {row.map((r) => (
            <div key={r.label} className="rounded border border-[#262626] bg-[#0a0a0a] px-2.5 py-2">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#525252]">{r.label}</p>
              <p className="num-mono mt-0.5 whitespace-nowrap text-[15px] font-bold text-[#e5e5e5]">{r.value}</p>
              <p className="font-mono text-[9px] text-[#525252]">{r.src}</p>
            </div>
          ))}
        </div>

        {status?.pattern_radar_signal ? (
          <p className="rounded border border-[#262626] bg-[#0a0a0a] px-3 py-2 font-mono text-[11px] text-[#e5e5e5]">
            <span className="text-[#525252]">engine pattern </span>{status.pattern_radar_signal}
            {status.pattern_price != null ? <span className="text-[#a3a3a3]"> at {Number(status.pattern_price).toFixed(2)}</span> : null}
            {status.pattern_detail ? <span className="mt-0.5 block text-[10.5px] text-[#a3a3a3]">{status.pattern_detail}</span> : null}
          </p>
        ) : null}

        <div>
          <button type="button" onClick={() => setMore((m) => !m)} className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#a3a3a3] hover:text-[#00ff88]">
            <span className="text-[#00ff88]/50">_&gt;</span> {more ? "fewer technicals" : "more technicals"}
          </button>
          {more && read ? (
            <ul className="mt-2 divide-y divide-[#262626] rounded border border-[#262626] bg-[#0a0a0a] font-mono text-[11px]">
              {[
                ["EMA 20", fmt(indicators?.ema20), indicators?.ema20 && price ? (price > indicators.ema20 ? "above" : "below") : ""],
                ["EMA 50", fmt(indicators?.ema50), indicators?.ema50 && price ? (price > indicators.ema50 ? "above" : "below") : ""],
                ["EMA 200", fmt(indicators?.ema200), indicators?.ema200 && price ? (price > indicators.ema200 ? "above" : "below") : "needs 200 bars"],
                ["RSI 14", fmt(indicators?.rsi, 1), indicators?.rsiLabel ?? ""],
                ["MACD hist", fmt(indicators?.macd?.last, 3), indicators?.macd?.bias ?? ""],
                ["Bollinger width", indicators?.bollinger?.widthPct != null ? `${indicators.bollinger.widthPct.toFixed(2)}%` : "—", ""],
                ["ATR 14", fmt(indicators?.atr), indicators?.atrPct != null ? `${indicators.atrPct.toFixed(2)}% of price` : ""],
              ].map(([k, v, note]) => (
                <li key={k} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[#a3a3a3]">{k}</span>
                  <span className="ml-auto whitespace-nowrap text-[#e5e5e5]">{v}</span>
                  <span className="w-[92px] text-right text-[10px] text-[#525252]">{note}</span>
                </li>
              ))}
              {read.factors.map((f) => (
                <li key={f.name} className="flex items-center gap-2 px-3 py-1.5">
                  <span className={f.side === "bullish" ? "text-[#00ff88]" : f.side === "bearish" ? "text-[#ff4d4d]" : "text-[#525252]"}>
                    {f.side === "bullish" ? "▲" : f.side === "bearish" ? "▼" : "•"}
                  </span>
                  <span className="text-[10.5px] text-[#a3a3a3]">{f.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="border-t border-[#262626] pt-3">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#525252]">_&gt; seasonality</p>
          <Seasonals curves={seasonals} source={seasonalSource} />
        </div>

        <div className="border-t border-[#262626] pt-3">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#525252]">_&gt; correlation</p>
          {correlations.length === 0 ? (
            <p className="font-mono text-[11px] text-[#a3a3a3]">Correlations not available right now.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {correlations.map((c) => (
                <div key={c.label} className="rounded border border-[#262626] bg-[#0a0a0a] px-2.5 py-2">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#525252]">{c.label}</p>
                  <p className="num-mono mt-0.5 text-[15px] font-bold" style={{ color: c.r === null ? "#525252" : c.r < 0 ? "#ff4d4d" : "#00ff88" }}>
                    {c.r === null ? "—" : `${c.r > 0 ? "+" : ""}${c.r.toFixed(2)}`}
                  </p>
                  <div className="relative mt-1 h-1 rounded-full bg-[#262626]">
                    <span className="absolute left-1/2 top-0 h-1 w-px bg-[#525252]" />
                    {c.r !== null ? (
                      <span className="absolute top-0 h-1 rounded-full" style={{
                        left: c.r < 0 ? `${50 + c.r * 50}%` : "50%", width: `${Math.abs(c.r) * 50}%`,
                        background: c.r < 0 ? "#ff4d4d" : "#00ff88",
                      }} />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          {correlationBasis ? <p className="mt-1.5 font-mono text-[9.5px] text-[#525252]">{correlationBasis}</p> : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Activity, BrainCircuit, Landmark, Minus, MoveUpRight, Ruler, Target } from "lucide-react";
import { PriceChart } from "@/components/ui/PriceChart";
import { Card, CardHead, Change, Pills, PanelHeader } from "@/components/ui/Primitives";
import { PAIRS, RANGES, getPair, levelsFor, seriesFor, technicalsFor, type Range } from "@/lib/market";
import { CALENDAR } from "@/lib/data";

const DRAWING_TOOLS = [
  { label: "Trendline", icon: MoveUpRight },
  { label: "Support / Resistance", icon: Minus },
  { label: "Measure", icon: Ruler },
];

export function MarketAnalysisPanel({ pair }: { pair?: string }) {
  const [symbol, setSymbol] = useState(pair && getPair(pair).symbol === pair ? pair : "EUR/USD");
  const [range, setRange] = useState<Range>("1D");
  const [tool, setTool] = useState<string | null>(null);

  const p = getPair(symbol);
  const series = seriesFor(symbol, range);
  const tech = technicalsFor(symbol);
  const levels = levelsFor(symbol);
  const events = CALENDAR.filter((e) => e.affects === symbol || p.symbol.includes(e.currency));

  return (
    <div className="space-y-6">
      <PanelHeader title="Market Analysis" />

      <Pills
        options={PAIRS.map((x) => ({ value: x.symbol, label: x.symbol }))}
        value={symbol}
        onChange={setSymbol}
      />

      <Card>
        <header className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h3 className="text-[16px] font-bold tracking-tight text-white">{p.symbol}</h3>
            <span className="h-4 w-px bg-white/10" aria-hidden />
            <span className="num-mono text-[22px] font-bold leading-none text-white">
              {p.price.toFixed(p.decimals)}
            </span>
            <Change pct={series.changePct} />
            <span className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">{range}</span>
          </div>

          <div className="flex items-center gap-1" role="tablist" aria-label="Chart range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={r === range}
                onClick={() => setRange(r)}
                className={`relative shrink-0 px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-200 ${
                  r === range ? "text-white" : "text-ink-muted hover:text-ink"
                }`}
              >
                {r}
                {r === range ? (
                  <span className="absolute inset-x-2 -bottom-[13px] h-[2px] rounded-full bg-brand-blue" />
                ) : null}
              </button>
            ))}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-5 py-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted/70">
            Tools
          </span>
          {DRAWING_TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={tool === t.label}
              onClick={() => setTool(tool === t.label ? null : t.label)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-all duration-200 ${
                tool === t.label
                  ? "border-brand-blue/50 bg-brand-blue/[0.14] text-brand-blue shadow-glow"
                  : "border-white/[0.08] bg-white/[0.03] text-ink-muted hover:border-brand-blue/30 hover:text-ink"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              {t.label}
            </button>
          ))}
          {tool ? (
            <span className="ml-auto text-[11px] text-ink-muted">
              {tool} armed — drawing is not available in this preview.
            </span>
          ) : null}
        </div>

        <div className="px-3 py-5 sm:px-5">
          <PriceChart
            key={`${symbol}-${range}`}
            points={series.points}
            labels={series.labels}
            decimals={p.decimals}
            height={500}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Technical */}
        <Card>
          <CardHead title="Technical Analysis" icon={Activity} />
          <div className="space-y-4 p-5">
            <Row label="Trend">
              <span
                className={`font-semibold ${
                  tech.trend === "Bullish" ? "text-brand-green" : "text-brand-danger"
                }`}
              >
                {tech.trend}
              </span>
            </Row>
            <Row label="Momentum">
              <span className="font-semibold text-ink">{tech.momentum}</span>
            </Row>

            <div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">RSI (14)</span>
                <span className="num-mono font-semibold text-white">
                  {tech.rsi}{" "}
                  <span
                    className={`ml-1 text-[11px] font-medium ${
                      tech.rsiLabel === "Overbought"
                        ? "text-brand-danger"
                        : tech.rsiLabel === "Oversold"
                          ? "text-brand-green"
                          : "text-ink-muted"
                    }`}
                  >
                    {tech.rsiLabel}
                  </span>
                </span>
              </div>
              <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <span className="absolute inset-y-0 left-[30%] w-px bg-white/20" />
                <span className="absolute inset-y-0 left-[70%] w-px bg-white/20" />
                <span
                  className="block h-full rounded-full bg-brand-blue"
                  style={{ width: `${tech.rsi}%` }}
                />
              </div>
            </div>

            <Row label="Support">
              <span className="num-mono font-semibold text-brand-green">
                {tech.support.toFixed(p.decimals)}
              </span>
            </Row>
            <Row label="Resistance">
              <span className="num-mono font-semibold text-brand-danger">
                {tech.resistance.toFixed(p.decimals)}
              </span>
            </Row>

            <div className="border-t border-white/[0.08] pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Moving Averages
              </p>
              <div className="mt-3 space-y-2.5">
                {tech.mas.map((m) => (
                  <div key={m.label} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-muted">{m.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="num-mono text-ink">{m.value.toFixed(p.decimals)}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          m.bias === "Above"
                            ? "bg-brand-green/[0.13] text-brand-green"
                            : "bg-brand-danger/[0.13] text-brand-danger"
                        }`}
                      >
                        {m.bias}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Fundamental */}
        <Card>
          <CardHead title="Fundamental" icon={Landmark} />
          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Scheduled events
            </p>
            <ul className="mt-3 space-y-3">
              {(events.length ? events : CALENDAR).slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-start gap-2.5">
                  <span className="num-mono mt-px w-[42px] shrink-0 text-[12px] font-semibold text-ink">
                    {e.time}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug text-ink">{e.title}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-muted">
                      {e.currency} · {e.impact} impact
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-4 border-t border-white/[0.08] pt-4">
              <Row label={`${p.base} strength`}>
                <span className="font-semibold text-ink">
                  {p.changePct >= 0 ? "Firming" : "Softening"}
                </span>
              </Row>
              <Row label="Rate expectations">
                <span className="font-semibold text-ink">
                  {p.quote === "USD" ? "Fed on hold" : "Data dependent"}
                </span>
              </Row>
              <Row label="Positioning">
                <span className="font-semibold text-ink">
                  {tech.rsi >= 70 ? "Crowded long" : tech.rsi <= 30 ? "Crowded short" : "Balanced"}
                </span>
              </Row>
            </div>
          </div>
        </Card>

        {/* Levels */}
        <Card>
          <CardHead title="Trading Levels" icon={Target} />
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-ink-muted">Structure bias</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${
                  levels.bias === "Long"
                    ? "bg-brand-green/[0.13] text-brand-green"
                    : "bg-brand-danger/[0.13] text-brand-danger"
                }`}
              >
                {levels.bias}
              </span>
            </div>

            <dl className="mt-5 space-y-3">
              {[
                { k: "Reference entry", v: levels.entry, tone: "text-white" },
                { k: "Invalidation", v: levels.stop, tone: "text-brand-danger" },
                { k: "Target 1", v: levels.target1, tone: "text-brand-green" },
                { k: "Target 2", v: levels.target2, tone: "text-brand-green" },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between text-[13px]">
                  <dt className="text-ink-muted">{r.k}</dt>
                  <dd className={`num-mono font-semibold ${r.tone}`}>
                    {r.v.toFixed(p.decimals)}
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-white/[0.08] pt-3 text-[13px]">
                <dt className="text-ink-muted">Risk / reward</dt>
                <dd className="num-mono font-semibold text-brand-blue">{levels.rr}</dd>
              </div>
            </dl>

            <p className="mt-5 flex gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-ink-muted">
              <BrainCircuit className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.9} />
              Levels are derived from visible structure for teaching purposes. They are not a
              recommendation, a signal, or financial advice.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

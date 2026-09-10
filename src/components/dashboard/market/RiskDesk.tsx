"use client";

import { useMemo, useState } from "react";
import { Card, CardHead } from "@/components/ui/Primitives";
import { contractSizeFor, riskPlan } from "@/lib/marketData";

/**
 * ATR gauge and position sizing.
 *
 * Arithmetic only — account balance times risk percent, divided by the stop
 * distance. It sizes a stop the reader chooses; it does not propose an entry,
 * a direction or a trade, because none of those follow from ATR.
 *
 * The balance stays in this component and is never sent anywhere.
 */

const ATR_MULTIPLES = [1, 1.5, 2, 2.5, 3];

export function RiskDesk({
  pair, price, atr, atrPct, decimals, pipSize,
}: {
  pair: string;
  price: number;
  atr: number | null;
  atrPct: number | null;
  decimals: number;
  pipSize: number;
}) {
  const [balance, setBalance] = useState(5000);
  const [riskPct, setRiskPct] = useState(1);
  const [mult, setMult] = useState(1.5);

  const plan = useMemo(
    () => riskPlan({ balance, riskPct, atr, atrMultiple: mult, price, pipSize, contractSize: contractSizeFor(pair) }),
    [balance, riskPct, atr, mult, price, pipSize, pair]
  );

  /*
   * Where this ATR sits against its own typical range, as a share of price.
   * Below ~0.35% of price is compressed for most instruments and above ~1.2% is
   * expanded; the gauge is a rough position between the two, not a percentile —
   * a real percentile needs a history of ATR readings this component is not given.
   */
  const gauge = atrPct === null ? null : Math.max(0, Math.min(100, ((atrPct - 0.15) / (1.4 - 0.15)) * 100));
  const regime = gauge === null ? "—" : gauge < 30 ? "compressed" : gauge > 70 ? "expanded" : "normal";

  /* Quote-currency caveat: pip value is computed in the quote currency. */
  const quoteCcy = pair.split("/")[1] ?? "USD";
  const usdQuoted = quoteCcy === "USD";

  return (
    <Card>
      <CardHead title="Risk desk" />
      <div className="space-y-4 p-5">
        {/* --- ATR gauge --- */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-ink-muted">ATR(14)</span>
            <span className="num-mono text-[15px] font-bold text-white">
              {atr === null ? "n/a" : atr.toFixed(decimals)}
              {atrPct !== null ? <span className="ml-1.5 text-[11px] font-normal text-ink-muted">{atrPct.toFixed(2)}% of price</span> : null}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-green transition-all duration-500"
              style={{ width: `${gauge ?? 0}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.1em] text-ink-muted/70">
            <span>compressed</span>
            <span className="font-bold text-ink">{regime}</span>
            <span>expanded</span>
          </div>
        </div>

        {/* --- stop multiple --- */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-ink-muted">Stop distance</span>
            <span className="num-mono text-[14px] font-semibold text-white">
              {plan.stopDistance ? `${plan.stopDistance.toFixed(decimals)} · ${plan.stopPips.toFixed(1)} pips` : "—"}
            </span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {ATR_MULTIPLES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMult(m)}
                aria-pressed={m === mult}
                className={`flex-1 rounded border px-2 py-1.5 text-[11.5px] font-semibold transition-colors ${
                  m === mult
                    ? "border-brand-blue/50 bg-brand-blue/[0.14] text-brand-blue"
                    : "border-white/[0.08] text-ink-muted hover:text-ink"
                }`}
              >
                {m}×
              </button>
            ))}
          </div>
        </div>

        {/* --- sizing --- */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">Account</span>
            <input
              type="number"
              min={0}
              value={balance}
              onChange={(e) => setBalance(Math.max(0, Number(e.target.value) || 0))}
              className="num-mono rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-blue/50"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">Risk {riskPct}%</span>
            <input
              type="range"
              min={0.25}
              max={3}
              step={0.25}
              value={riskPct}
              onChange={(e) => setRiskPct(Number(e.target.value))}
              className="mt-2 w-full accent-[#2D6BFF]"
            />
          </label>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3.5">
          <Line k="Risk per trade" v={`$${plan.riskAmount.toFixed(2)}`} />
          <Line k="Position size" v={plan.lots === null ? "—" : `${plan.lots.toFixed(2)} lots`} strong />
          <Line
            k={`Per pip (${quoteCcy})`}
            v={plan.pipValue === null ? "—" : `${plan.pipValue.toFixed(2)}`}
          />
          {plan.note ? <p className="mt-2 text-[11.5px] text-[#fbbf24]">{plan.note}</p> : null}
          {!usdQuoted && plan.lots !== null ? (
            <p className="mt-2 text-[11.5px] leading-relaxed text-[#fbbf24]">
              {pair} is quoted in {quoteCcy}, so the per-pip figure is in {quoteCcy} — convert to your
              account currency before sizing. This calculator is not given that rate and will not guess it.
            </p>
          ) : null}
        </div>

        <p className="text-[11px] leading-relaxed text-ink-muted/70">
          Sizing arithmetic for a stop you choose. Not an entry, a direction or a trade.
        </p>
      </div>
    </Card>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[12px] text-ink-muted">{k}</span>
      <span className={`num-mono ${strong ? "text-[16px] font-bold text-brand-green" : "text-[13px] font-semibold text-white"}`}>{v}</span>
    </div>
  );
}

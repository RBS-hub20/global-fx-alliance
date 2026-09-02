/**
 * Chart Snap — turns a screenshot plus an instrument choice into a worked,
 * real-data trade plan.
 *
 * Deliberately does **not** claim to read the image. There is no vision model
 * here, and inventing a pattern from a random draw while showing a confidence
 * badge would be fabricated analysis attached to a position-sizing decision.
 * Instead the reader names the instrument and timeframe — which they know from
 * their own chart — and every number below comes from live candles, the real
 * pattern scanner and their own statement.
 */

import { getPair, pipValuePerLot } from "./market";
import type { Pattern } from "./patternDetector";

export type Style = "Conservative" | "Balanced" | "Aggressive";
export type RiskMode = "percent" | "fixed";

export interface TradeProfile {
  mode: RiskMode;
  balance: number;
  riskPct: number;
  fixedRisk: number;
  style: Style;
  useProfile: boolean;
}

export const DEFAULT_PROFILE: TradeProfile = {
  mode: "percent",
  balance: 10000,
  riskPct: 1,
  fixedRisk: 100,
  style: "Balanced",
  useProfile: true,
};

/**
 * Style changes how far the invalidation sits from entry and how far objectives
 * are projected — not how much is risked. Risk stays whatever the profile says.
 */
const STYLE_SPEC: Record<Style, { stopAtr: number; t1: number; t2: number; note: string }> = {
  Conservative: { stopAtr: 2.0, t1: 1.0, t2: 2.0, note: "wider invalidation, nearer objectives" },
  Balanced: { stopAtr: 1.5, t1: 1.5, t2: 3.0, note: "standard 1.5×ATR stop" },
  Aggressive: { stopAtr: 1.0, t1: 2.0, t2: 4.0, note: "tight invalidation, more of it gets stopped" },
};

export interface TradePlan {
  direction: "bullish" | "bearish" | "range";
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  rr1: string;
  rr2: string;
  stopDistance: number;
  stopPips: number;
  lots: number;
  riskUsd: number;
  riskPctOfBalance: number;
  style: Style;
  styleNote: string;
  /** Where the invalidation came from — a real level, or volatility. */
  stopBasis: string;
}

export interface PlanInputs {
  symbol: string;
  price: number;
  atr: number | null;
  supports: { price: number; touches: number }[];
  resistances: { price: number; touches: number }[];
  pattern: Pattern | null;
  profile: TradeProfile;
}

/**
 * Builds the plan from real structure. The invalidation prefers an actual level
 * price has respected; ATR is only the fallback when no level sits on the
 * correct side.
 */
export function buildTradePlan(i: PlanInputs): TradePlan {
  const pair = getPair(i.symbol);
  const d = pair.decimals;
  const round = (v: number) => Number(v.toFixed(d));

  const direction: TradePlan["direction"] =
    i.pattern?.direction === "bullish" ? "bullish" : i.pattern?.direction === "bearish" ? "bearish" : "range";

  const spec = STYLE_SPEC[i.profile.style];
  const atr = i.atr && i.atr > 0 ? i.atr : i.price * 0.0012;
  const long = direction !== "bearish";

  // Prefer a real level on the invalidation side, with a small buffer beyond it.
  const levelBelow = [...i.supports].filter((s) => s.price < i.price).sort((a, b) => b.price - a.price)[0];
  const levelAbove = [...i.resistances].filter((r) => r.price > i.price).sort((a, b) => a.price - b.price)[0];
  const structural = long ? levelBelow : levelAbove;

  const atrStop = long ? i.price - atr * spec.stopAtr : i.price + atr * spec.stopAtr;
  const buffer = atr * 0.25;
  const structuralStop = structural ? (long ? structural.price - buffer : structural.price + buffer) : null;

  // Use the structural stop only when it is a sane distance — a level 5×ATR away
  // would produce a position size of essentially nothing.
  const useStructural =
    structuralStop !== null && Math.abs(i.price - structuralStop) <= atr * spec.stopAtr * 2.5;

  const stopLoss = round(useStructural ? (structuralStop as number) : atrStop);
  const stopDistance = Math.abs(i.price - stopLoss);
  const target1 = round(long ? i.price + stopDistance * spec.t1 : i.price - stopDistance * spec.t1);
  const target2 = round(long ? i.price + stopDistance * spec.t2 : i.price - stopDistance * spec.t2);

  const riskUsd =
    i.profile.mode === "fixed"
      ? Math.max(i.profile.fixedRisk, 0)
      : Math.max((i.profile.balance * i.profile.riskPct) / 100, 0);

  const stopPips = stopDistance / pair.pipSize;
  const perLot = pipValuePerLot(i.symbol, 1, i.price);
  const lots = stopPips > 0 && perLot > 0 ? riskUsd / (stopPips * perLot) : 0;

  return {
    direction,
    entry: round(i.price),
    stopLoss,
    target1,
    target2,
    rr1: `1 : ${spec.t1.toFixed(1)}`,
    rr2: `1 : ${spec.t2.toFixed(1)}`,
    stopDistance: round(stopDistance),
    stopPips: Number(stopPips.toFixed(1)),
    lots: Number(lots.toFixed(2)),
    riskUsd: Number(riskUsd.toFixed(2)),
    riskPctOfBalance: i.profile.balance > 0 ? Number(((riskUsd / i.profile.balance) * 100).toFixed(2)) : 0,
    style: i.profile.style,
    // When a real level sets the invalidation, the style's ATR multiple did not
    // apply — saying "tight invalidation" then would misdescribe the plan.
    styleNote: useStructural
      ? `objectives at ${spec.t1}R and ${spec.t2}R; the stop came from structure rather than the ${spec.stopAtr}×ATR default`
      : spec.note,
    stopBasis: useStructural && structural
      ? `${long ? "support" : "resistance"} at ${structural.price.toFixed(d)} (${structural.touches} touches), plus a buffer`
      : `${spec.stopAtr}×ATR — no level sat close enough on that side`,
  };
}

/** Plain-text plan for the clipboard. */
export function planToText(symbol: string, timeframe: string, plan: TradePlan, decimals: number): string {
  const f = (v: number) => v.toFixed(decimals);
  return [
    `GFXA Chart Snap — ${symbol} ${timeframe}`,
    `Educational example. Not a signal.`,
    ``,
    `Bias        ${plan.direction}`,
    `Entry       ${f(plan.entry)}`,
    `Invalidation${" "}${f(plan.stopLoss)}  (${plan.stopPips} pips — ${plan.stopBasis})`,
    `Target 1    ${f(plan.target1)}  (${plan.rr1})`,
    `Target 2    ${f(plan.target2)}  (${plan.rr2})`,
    `Size        ${plan.lots} lots for $${plan.riskUsd} risk (${plan.riskPctOfBalance}%)`,
    `Style       ${plan.style} — ${plan.styleNote}`,
    ``,
    `Levels and patterns come from live market data, not from the image.`,
    `Educational only — not financial advice.`,
  ].join("\n");
}

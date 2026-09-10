/**
 * GFXA-Structure — the terminal's own read of the chart.
 *
 * A weighted vote across the structure already on screen: the trendline, RSI,
 * MACD, where price sits against its moving averages, the nearest tested level,
 * and unfilled fair-value gaps. Every input is something the panel is already
 * rendering, so the card can never disagree with the chart above it, and no
 * extra request is made to produce it.
 *
 * What the percentage means, precisely: the share of the total factor weight
 * pointing one way. 65% bearish means roughly two-thirds of what this model
 * looks at is bearish — it is NOT a 65% chance that price falls. Nothing here
 * is backtested against outcomes, so it cannot carry a probability, and the
 * card says so rather than letting a number imply one.
 *
 * Pure: no fetching, no DOM, no clock.
 */

import type { Drawings } from "./autoDraw";

export type BiasSide = "bullish" | "bearish" | "neutral";

export interface BiasFactor {
  /** Short label, e.g. "Trend". */
  name: string;
  /** The sentence shown in the reasoning list. */
  detail: string;
  side: BiasSide;
  /** Contribution to the vote, 0-3. */
  weight: number;
}

export interface BiasRead {
  side: BiasSide;
  /** Share of directional weight on the winning side, 50-100. */
  share: number;
  factors: BiasFactor[];
  /** Directional weight actually available — low means a thin read. */
  evidence: number;
  /** Set when there is too little structure to say anything. */
  thin: boolean;
}

const N = (v: number, d: number) => v.toFixed(d);

/**
 * Reads the structure. `decimals` only affects how prices are written into the
 * reasoning lines.
 */
export function readBias(drawings: Drawings, price: number, decimals: number): BiasRead {
  const f: BiasFactor[] = [];
  const ind = drawings.indicators;

  /* ---------------------------------------------------------------- trend */
  if (drawings.trendline) {
    const t = drawings.trendline;
    const up = t.direction === "up";
    const flat = t.direction !== "up" && t.direction !== "down";
    f.push({
      name: "Trend",
      detail: `Trend ${t.direction.toUpperCase()} (${t.touches} pivots)`,
      side: flat ? "neutral" : up ? "bullish" : "bearish",
      // A line held by more pivots is worth more, to a point.
      weight: flat ? 0 : Math.min(3, 1 + t.touches / 8),
    });
  }

  /* ------------------------------------------------------------------ rsi */
  if (ind?.rsi !== null && ind?.rsi !== undefined) {
    const r = ind.rsi;
    const side: BiasSide = r >= 55 ? "bullish" : r <= 45 ? "bearish" : "neutral";
    const label =
      r >= 70 ? "overbought" : r <= 30 ? "oversold" : r >= 55 ? "bullish (>55)" : r <= 45 ? "neutral-bearish (<50)" : "neutral";
    f.push({
      name: "RSI",
      detail: `RSI(14) ${N(r, 1)} — ${label}`,
      side,
      // Distance from 50, so 47 counts for less than 28.
      weight: Math.min(2, Math.abs(r - 50) / 12),
    });
  }

  /* ----------------------------------------------------------------- macd */
  if (ind?.macd) {
    f.push({
      name: "MACD",
      detail: `MACD ${ind.macd.bias}`,
      side: ind.macd.bias,
      weight: ind.macd.bias === "neutral" ? 0 : 1.2,
    });
  }

  /* ------------------------------------------------------------------ ema */
  if (ind?.ema50 !== null && ind?.ema50 !== undefined && price) {
    const above = price > ind.ema50;
    f.push({
      name: "EMA50",
      detail: `Price ${above ? "above" : "below"} EMA50 ${N(ind.ema50, decimals)}`,
      side: above ? "bullish" : "bearish",
      weight: 1,
    });
  }

  /* --------------------------------------------------------------- levels */
  const nearestSupport = [...drawings.supports].sort((a, b) => Math.abs(price - a.price) - Math.abs(price - b.price))[0];
  const nearestResistance = [...drawings.resistances].sort((a, b) => Math.abs(price - a.price) - Math.abs(price - b.price))[0];

  if (nearestSupport && nearestResistance && price) {
    const toS = Math.abs(price - nearestSupport.price);
    const toR = Math.abs(price - nearestResistance.price);
    /*
     * Position in the range, not a bounce prediction. Sitting on support is
     * read as constructive because that is where buyers have previously shown
     * up — it is not a claim that they will again.
     */
    const nearSupport = toS < toR;
    const level = nearSupport ? nearestSupport : nearestResistance;
    f.push({
      name: "Level",
      detail: `${nearSupport ? "S" : "R"}1 ${N(level.price, decimals)} ${level.touches}x tested — ${
        level.strength >= 4 ? "strong" : level.strength >= 2 ? "tested" : "untested"
      }, ${nearSupport ? "below" : "above"} price`,
      side: nearSupport ? "bullish" : "bearish",
      weight: Math.min(1.8, 0.6 + level.strength * 0.3),
    });
  }

  /* ------------------------------------------------------------------ fvg */
  const below = drawings.fvgs.filter((g) => g.high < price);
  const above = drawings.fvgs.filter((g) => g.low > price);
  if (drawings.fvgs.length) {
    // An unfilled gap is a magnet in its own direction: below price it is a
    // shelf, above price it is a target.
    const net = below.length - above.length;
    const g = (below[0] ?? above[0]);
    f.push({
      name: "FVG",
      detail: `${drawings.fvgs.length} FVG zone${drawings.fvgs.length === 1 ? "" : "s"}${
        g ? ` — ${N(g.low, decimals)}–${N(g.high, decimals)} unfilled ${g.high < price ? "support below" : "target above"}` : ""
      }`,
      side: net > 0 ? "bullish" : net < 0 ? "bearish" : "neutral",
      weight: Math.min(1.4, Math.abs(net) * 0.7),
    });
  }

  /* ---------------------------------------------------------------- tally */
  const bull = f.filter((x) => x.side === "bullish").reduce((s, x) => s + x.weight, 0);
  const bear = f.filter((x) => x.side === "bearish").reduce((s, x) => s + x.weight, 0);
  const evidence = bull + bear;

  // Under this, the factors are so thin or so evenly split that naming a side
  // would be noise dressed as a call.
  if (evidence < 1.5 || Math.abs(bull - bear) / evidence < 0.12) {
    return { side: "neutral", share: 50, factors: f, evidence, thin: evidence < 1.5 };
  }

  const side: BiasSide = bull > bear ? "bullish" : "bearish";
  const share = Math.round((Math.max(bull, bear) / evidence) * 100);
  return { side, share, factors: f, evidence, thin: false };
}

/* ------------------------------------------------------------- divergence */

export type DivergenceState = "diverging" | "aligned" | "split" | "unknown";

export interface Divergence {
  state: DivergenceState;
  headline: string;
  detail: string;
}

/**
 * How the model's read sits against the room's.
 *
 * `unknown` while nobody has voted — an empty poll is not agreement, and
 * calling it "aligned" would manufacture a consensus out of one opinion.
 */
export function compareBias(
  model: BiasRead,
  community: { side: BiasSide | null; share: number; votes: number },
  pair: string
): Divergence {
  if (!community.votes || !community.side) {
    return {
      state: "unknown",
      headline: "No community read yet",
      detail: `Nobody has voted on ${pair} today. The model reads ${model.side}.`,
    };
  }

  if (model.side === "neutral" || community.side === "neutral") {
    return {
      state: "split",
      headline: "Partial agreement",
      detail: `Model ${model.side} ${model.share}% · room ${community.side} ${community.share}% — one side is undecided.`,
    };
  }

  if (model.side === community.side) {
    return {
      state: "aligned",
      headline: `Aligned — both ${model.side}`,
      detail: `Model ${model.share}% ${model.side} · ${community.share}% of ${community.votes} member${
        community.votes === 1 ? "" : "s"
      } agree. Agreement is not confirmation — it often means the move is already priced.`,
    };
  }

  return {
    state: "diverging",
    headline: `Divergence — model ${model.side}, room ${community.side}`,
    detail: `Model reads ${model.share}% ${model.side} from structure; ${community.share}% of ${
      community.votes
    } member${community.votes === 1 ? "" : "s"} voted ${community.side}. Worth a look at which one you can argue.`,
  };
}

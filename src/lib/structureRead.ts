import type { Candle, Level } from "./indicators";
import type { Pattern } from "./patternDetector";
import { getPair } from "./market";
import type { Timeframe } from "./timeframes";

/**
 * Reads what the structure is doing on one instrument at one candle size.
 *
 * **This deliberately does not emit an order instruction.** The obvious shape
 * for this engine is BUY / SELL / BUY_LIMIT / SELL_LIMIT, and every input it
 * would need is right here — but a directive order type attached to a price and
 * a position size, tuned to one reader's own win-rate history, is personalised
 * trading advice however it is labelled, and this platform's own promise is that
 * it explains structure rather than handing out signals.
 *
 * So the states below carry exactly the same information the order types would
 * — including the distinction the reader actually cares about, whether price has
 * already reacted off a level or is still approaching it — expressed as an
 * observation of the chart rather than an instruction to the reader. The risk
 * arithmetic stays where it already lives, in `buildTradePlan`, framed as the
 * worked example it is.
 */

export type Bias = "bullish" | "bearish" | "neutral";

export type StructureState =
  /** Price has reacted up off a support it is sitting on. */
  | "BOUNCING_SUPPORT"
  /** Bullish bias, but price is still above the support that matters. */
  | "APPROACHING_SUPPORT"
  /** Price has been turned away by a resistance it is sitting on. */
  | "REJECTING_RESISTANCE"
  /** Bearish bias, but price is still below the resistance that matters. */
  | "APPROACHING_RESISTANCE"
  /** Nothing close enough on either side to read from. */
  | "MID_RANGE";

export interface StructureRead {
  state: StructureState;
  /** Short label for the badge. */
  label: string;
  bias: Bias;
  confidence: "high" | "medium" | "low";
  /** The level the read is built around, when there is one. */
  level: { price: number; touches: number; type: "support" | "resistance" } | null;
  distance: number | null;
  distanceAtr: number | null;
  price: number;
  rsi: number | null;
  rsiLabel: string;
  atr: number | null;
  pattern: Pattern | null;
  /** Factual observations behind the read — the "bakit". */
  observations: string[];
  /** What would break it. Never shorter than the observations list. */
  cautions: string[];
}

export interface ReadInputs {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  price: number;
  supports: Level[];
  resistances: Level[];
  patterns: Pattern[];
  rsi: number | null;
  rsiLabel: string;
  atr: number | null;
  sessionLine?: string | null;
  /** Aggregated journal figures, when the reader has a book loaded. */
  journal?: {
    isReal: boolean;
    pairWinRate?: number | null;
    pairTrades?: number | null;
    worstHour?: string | null;
    currentHourDubai?: string | null;
    bestHour?: string | null;
  } | null;
}

const LABEL: Record<StructureState, string> = {
  BOUNCING_SUPPORT: "Bouncing off support",
  APPROACHING_SUPPORT: "Approaching support",
  REJECTING_RESISTANCE: "Rejecting resistance",
  APPROACHING_RESISTANCE: "Approaching resistance",
  MID_RANGE: "Mid-range — no level in play",
};

/** Has price already turned at this level, or is it still on the way? */
function hasReacted(candles: Candle[], level: number, up: boolean): boolean {
  const recent = candles.slice(-4);
  if (recent.length < 2) return false;
  // Up: something in the last few bars traded into the level and closed above it.
  return up
    ? recent.some((c) => c.low <= level) && recent[recent.length - 1].close > level
    : recent.some((c) => c.high >= level) && recent[recent.length - 1].close < level;
}

export function readStructure(i: ReadInputs): StructureRead {
  const pair = getPair(i.symbol);
  const d = pair.decimals;
  const f = (v: number) => v.toFixed(d);
  // Distances are quoted with their unit. Left bare, the model narrating this
  // guessed one — it called 7.16 points of gold "7.16 pips", which is off by ten.
  const dist = (v: number) => `${f(v)} (${(v / pair.pipSize).toFixed(1)} pips)`;
  const atr = i.atr && i.atr > 0 ? i.atr : i.price * 0.0012;

  const support = [...i.supports].filter((s) => s.price <= i.price).sort((a, b) => b.price - a.price)[0] ?? null;
  const resistance = [...i.resistances].filter((r) => r.price >= i.price).sort((a, b) => a.price - b.price)[0] ?? null;

  const dSup = support ? i.price - support.price : Infinity;
  const dRes = resistance ? resistance.price - i.price : Infinity;

  // "In play" is measured in volatility, not points — 8 points is close on gold
  // and a canyon on EUR/USD.
  const NEAR = atr * 1.2;
  const supportInPlay = dSup <= NEAR;
  const resistanceInPlay = dRes <= NEAR;

  // Pick the pattern that speaks to the level in play. Taking patterns[0] blindly
  // produced reads like "bouncing off support / bearish", where the badge
  // contradicted itself because the strongest pattern happened to point the other
  // way. When nothing agrees, that disagreement is itself the finding.
  const wantBullish = supportInPlay && (!resistanceInPlay || dSup <= dRes);
  const agreeingPattern =
    i.patterns.find((p) => (wantBullish ? p.direction === "bullish" : p.direction === "bearish")) ?? null;
  const top = agreeingPattern ?? i.patterns[0] ?? null;
  const conflicted = !!top && !!i.patterns.length && !agreeingPattern && (supportInPlay || resistanceInPlay);

  let state: StructureState = "MID_RANGE";
  let level: StructureRead["level"] = null;
  let distance: number | null = null;

  const preferSupport = wantBullish && supportInPlay;
  const preferResistance = resistanceInPlay && !preferSupport;

  if (preferSupport && support) {
    state = hasReacted(i.candles, support.price, true) ? "BOUNCING_SUPPORT" : "APPROACHING_SUPPORT";
    level = { price: Number(support.price.toFixed(d)), touches: support.touches, type: "support" };
    distance = dSup;
  } else if (preferResistance && resistance) {
    state = hasReacted(i.candles, resistance.price, false) ? "REJECTING_RESISTANCE" : "APPROACHING_RESISTANCE";
    level = { price: Number(resistance.price.toFixed(d)), touches: resistance.touches, type: "resistance" };
    distance = dRes;
  }

  /* ------------------------------------------------------------ observations */

  const observations: string[] = [];
  observations.push(
    level
      ? `Price ${f(i.price)} is ${dist(distance as number)} from ${level.type} ${f(level.price)}, a level it has touched ${level.touches} ${level.touches === 1 ? "time" : "times"} — ${((distance as number) / atr).toFixed(2)}×ATR away.`
      : `Price ${f(i.price)} sits between levels, with the nearest support ${support ? f(support.price) : "unmapped"} and resistance ${resistance ? f(resistance.price) : "unmapped"}. Nothing is close enough to read from.`
  );

  if (top) {
    observations.push(
      `The scanner found ${top.type.toLowerCase()} (${top.direction}, ${top.confidence} confidence) at ${f(top.price)}. ${top.description}`
    );
  } else {
    observations.push("No candlestick pattern is flagged on this instrument right now, so there is no trigger to read alongside the level.");
  }

  if (conflicted && top) {
    observations.push(
      `The level and the candle disagree: price is at ${level ? level.type : "a level"} while the strongest pattern on the board is ${top.direction}. That is a reason to wait for one of them to resolve, not a reading in either direction.`
    );
  }

  if (i.rsi !== null) {
    observations.push(`RSI(14) is ${i.rsi.toFixed(1)} — ${i.rsiLabel.toLowerCase()}.`);
  }
  if (i.sessionLine) observations.push(i.sessionLine);

  if (i.journal?.pairTrades) {
    const label = i.journal.isReal ? "your record" : "the sample book";
    observations.push(
      `On ${i.symbol} ${label} is ${(i.journal.pairWinRate ?? 0).toFixed(0)}% across ${i.journal.pairTrades} trades.`
    );
  }

  /* ---------------------------------------------------------------- cautions */

  const cautions: string[] = [];
  if (level) {
    cautions.push(
      level.type === "support"
        ? `A close below ${f(level.price)} breaks the level the whole read rests on, and the same level then acts as resistance.`
        : `A close above ${f(level.price)} breaks the level the whole read rests on, and the same level then acts as support.`
    );
    cautions.push(
      `Levels this obvious are where stops cluster. Price trading through ${f(level.price)} and immediately reversing is a stop run, not a break — the two look identical until the candle closes.`
    );
  } else {
    cautions.push("Mid-range price has no level to fail at, which is exactly why it offers nothing to measure risk against.");
  }
  if (top && top.confidence !== "high") {
    cautions.push(`The pattern is ${top.confidence}, not high, confidence — it formed without a level agreeing with it.`);
  }
  cautions.push("High-impact data during the session overrides structure entirely; check the calendar before treating any of this as stable.");

  if (i.journal?.worstHour && i.journal.currentHourDubai === i.journal.worstHour) {
    cautions.push(
      `It is ${i.journal.currentHourDubai}:00 Dubai — the hour ${i.journal.isReal ? "your own book" : "the sample book"} performs worst in.`
    );
  }
  if (i.journal?.pairTrades && (i.journal.pairWinRate ?? 100) < 40) {
    cautions.push(
      `${i.symbol} is an instrument ${i.journal.isReal ? "you" : "the sample book"} historically ${(i.journal.pairWinRate ?? 0).toFixed(0)}% on — the structure being readable does not make it one that has worked.`
    );
  }

  /* -------------------------------------------------------------- confidence */

  const agreeing = !!level && !!agreeingPattern;

  const confidence: StructureRead["confidence"] =
    agreeing && agreeingPattern!.confidence === "high" && level!.touches >= 2
      ? "high"
      : agreeing
        ? "medium"
        : "low";

  // Neutral whenever the state and the pattern point different ways — a badge
  // reading "bouncing off support / bearish" tells the reader nothing usable.
  const bias: Bias =
    state === "MID_RANGE" || conflicted
      ? "neutral"
      : state === "BOUNCING_SUPPORT" || state === "APPROACHING_SUPPORT"
        ? "bullish"
        : "bearish";

  return {
    state,
    label: LABEL[state],
    bias,
    confidence,
    level,
    distance,
    distanceAtr: distance === null ? null : Number((distance / atr).toFixed(2)),
    price: i.price,
    rsi: i.rsi,
    rsiLabel: i.rsiLabel,
    atr: i.atr,
    pattern: top,
    observations,
    cautions,
  };
}

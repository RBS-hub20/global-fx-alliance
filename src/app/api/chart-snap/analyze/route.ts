import { NextResponse } from "next/server";
import { detectPatterns } from "@/lib/patternDetector";
import { detectSwings, findSupportResistance, computeIndicators } from "@/lib/indicators";
import { getPair, PAIRS } from "@/lib/market";
import { getRealCandles } from "@/lib/marketProvider";
import { isTimeframe, specFor, touchesForHighConfidence, type Timeframe } from "@/lib/timeframes";
import { buildTradePlan, DEFAULT_PROFILE, type Style, type TradeProfile } from "@/lib/chartSnap";
import { readStructure } from "@/lib/structureRead";

export const runtime = "edge";

/**
 * Chart Snap analysis.
 *
 * The uploaded image is **not** parsed — there is no vision model behind this,
 * and guessing a pattern from a picture while showing a confidence badge would
 * be inventing analysis for a decision that sizes real money. The reader names
 * the instrument and timeframe; everything returned is computed from live
 * candles, the real pattern scanner and the real auto-drawn levels.
 *
 * The image is read only to record its size and is never stored or forwarded.
 */

const MAX_BYTES = 8_000_000;

function toNum(v: FormDataEntryValue | null, fallback: number): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  let symbol = "EUR/USD";
  let timeframe: Timeframe = "1H";
  let screenshotPrice: number | null = null;
  let imageBytes = 0;
  let imageName: string | null = null;
  const profile: TradeProfile = { ...DEFAULT_PROFILE };

  try {
    const form = await request.formData();

    const file = form.get("file");
    if (file && typeof file !== "string") {
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { ok: false, message: "Image too large — keep screenshots under 8 MB." },
          { status: 413 }
        );
      }
      imageBytes = file.size;
      imageName = file.name ?? null;
    }

    const rawSymbol = (form.get("symbol") as string | null)?.toUpperCase().trim();
    if (rawSymbol && PAIRS.some((p) => p.symbol === rawSymbol)) symbol = rawSymbol;

    const rawTf = (form.get("timeframe") as string | null)?.toUpperCase().trim();
    if (isTimeframe(rawTf)) timeframe = rawTf;

    const sp = form.get("screenshotPrice");
    const spNum = typeof sp === "string" ? Number.parseFloat(sp) : NaN;
    if (Number.isFinite(spNum) && spNum > 0) screenshotPrice = spNum;

    profile.mode = (form.get("mode") as string) === "fixed" ? "fixed" : "percent";
    profile.balance = toNum(form.get("balance"), DEFAULT_PROFILE.balance);
    profile.riskPct = toNum(form.get("riskPct"), DEFAULT_PROFILE.riskPct);
    profile.fixedRisk = toNum(form.get("fixedRisk"), DEFAULT_PROFILE.fixedRisk);
    const style = form.get("style") as Style | null;
    if (style && ["Conservative", "Balanced", "Aggressive"].includes(style)) profile.style = style;
  } catch {
    // Fall through with defaults; the analysis still runs on real data.
  }

  const pair = getPair(symbol);
  const spec = specFor(timeframe);

  /* --- real candles: Twelve Data -> Yahoo -> cache -> modelled ---- */
  const feed = await getRealCandles(symbol, timeframe, screenshotPrice ?? undefined);
  const isReal = feed.isReal;
  const ohlc = feed.candles;

  /*
   * Anchor priority: a live quote, then the price the reader read off their own
   * screenshot, then modelled candles. The screenshot number is real information
   * the reader supplied, so it beats a synthetic series — and a plan is never
   * built around a modelled anchor without saying so.
   */
  const livePrice = isReal ? feed.price : null;
  const price = livePrice ?? screenshotPrice ?? ohlc[ohlc.length - 1].close;
  const anchor: "live" | "screenshot" | "modeled" =
    livePrice !== null ? "live" : screenshotPrice !== null ? "screenshot" : "modeled";

  /*
   * When neither a live quote nor a screenshot price exists, the modelled series
   * can sit far from spot. Emitting entry/stop/target numbers off that would put
   * a wrong reference price in front of someone sizing a position, so the plan is
   * withheld and the reason returned instead.
   */
  const planAvailable = anchor !== "modeled";

  // Rescale modelled candles onto the screenshot anchor so the levels derived
  // from them sit in the same price regime as the reader's chart.
  const scale = anchor === "screenshot" && ohlc.length ? price / ohlc[ohlc.length - 1].close : 1;
  const scaled =
    scale === 1
      ? ohlc
      : ohlc.map((b) => ({
          ...b,
          open: b.open * scale,
          high: b.high * scale,
          low: b.low * scale,
          close: b.close * scale,
        }));

  const swings = detectSwings(scaled, 5);
  const levels = findSupportResistance(swings, price, 0.1, scaled.length);
  const supports = levels
    .filter((l) => l.type === "support")
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map((l) => ({ price: Number(l.price.toFixed(pair.decimals)), touches: l.touches, strength: l.strength }));
  const resistances = levels
    .filter((l) => l.type === "resistance")
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map((l) => ({ price: Number(l.price.toFixed(pair.decimals)), touches: l.touches, strength: l.strength }));

  // Smaller candles are noisier, so a level needs more touches before a pattern
  // sitting on it earns "high" — three on 5M/15M, two on the daily.
  const minTouches = touchesForHighConfidence(timeframe);
  const patterns = detectPatterns(scaled, symbol, timeframe, pair.decimals).map((pt) =>
    pt.confidence === "high" &&
    pt.level !== null &&
    !([...supports, ...resistances].some((l) => Math.abs(l.price - pt.level!) < 1e-9 && l.touches >= minTouches))
      ? { ...pt, confidence: "medium" as const }
      : pt
  );
  const indicators = computeIndicators(scaled);
  const top = patterns[0] ?? null;

  const plan = buildTradePlan({
    symbol,
    price,
    atr: indicators?.atr ?? null,
    supports,
    resistances,
    pattern: top,
    profile,
  });

  // The same structure read the assistant's /snap returns, so both surfaces
  // describe one chart identically. Computed here without a model call, so it
  // lands with the rest of the analysis rather than waiting on the explainer.
  const read = readStructure({
    symbol,
    timeframe,
    candles: scaled,
    price,
    supports: levels.filter((l) => l.type === "support"),
    resistances: levels.filter((l) => l.type === "resistance"),
    patterns,
    rsi: indicators?.rsi ?? null,
    rsiLabel: indicators?.rsiLabel ?? "n/a",
    atr: indicators?.atr ?? null,
  });

  /* ------------------------------------ screenshot vs live comparison */
  const diff = screenshotPrice !== null ? price - screenshotPrice : null;
  const diffPct = diff !== null && screenshotPrice ? (diff / screenshotPrice) * 100 : null;

  return NextResponse.json(
    {
      ok: true,
      symbol,
      timeframe,
      interval: spec.twelve,
      minTouchesForHigh: minTouches,
      decimals: pair.decimals,

      read: {
        state: read.state,
        label: read.label,
        bias: read.bias,
        confidence: read.confidence,
        level: read.level,
        distance: read.distance === null ? null : Number(read.distance.toFixed(pair.decimals)),
        distanceAtr: read.distanceAtr,
        rsi: read.rsi,
        rsiLabel: read.rsiLabel,
        pattern: read.pattern
          ? { type: read.pattern.type, direction: read.pattern.direction, confidence: read.pattern.confidence }
          : null,
        observations: read.observations,
        cautions: read.cautions,
      },

      // Stated plainly so no client can present this as image analysis.
      imageAnalysed: false,
      imageNote:
        "The screenshot is displayed for your reference only. It is not parsed, stored or sent anywhere — the analysis below is computed from live market data for the instrument you selected.",
      image: { bytes: imageBytes, name: imageName },

      market: {
        price: Number(price.toFixed(pair.decimals)),
        bars: ohlc.length,
        isReal,
        source: isReal ? feed.source : anchor === "screenshot" ? "your-screenshot" : "modeled",
        provider: feed.source,
        symbolUsed: feed.symbolUsed,
        cached: feed.ageSeconds > 0,
        ageSeconds: feed.ageSeconds,
        stale: feed.stale,
        aggregated: feed.aggregated,
      },
      anchor,
      planAvailable,
      planUnavailableReason: planAvailable
        ? null
        : "Live pricing is unavailable and no screenshot price was entered, so there is no trustworthy anchor to build a plan from. Enter the price shown on your chart and run it again.",

      /*
       * Staleness is only meaningful against a real quote. When the upstream
       * misses and the series falls back to modelled candles, comparing the
       * reader's screenshot to that would report their chart as ~40% stale when
       * it is our own fallback that is off.
       */
      validation:
        screenshotPrice === null
          ? { compared: false, note: "No price entered from the screenshot, so nothing to compare." }
          : !isReal
          ? {
              compared: false,
              screenshotPrice,
              note: "Live pricing is unavailable right now, so your screenshot cannot be checked for staleness. The levels below come from modelled candles — treat them as illustrative.",
            }
          : {
              compared: true,
              screenshotPrice,
              realPrice: Number(price.toFixed(pair.decimals)),
              diff: Number((diff ?? 0).toFixed(pair.decimals)),
              diffPct: Number((diffPct ?? 0).toFixed(3)),
              isStale: Math.abs(diffPct ?? 0) > 1,
              badge: Math.abs(diffPct ?? 0) > 1 ? "STALE SCREENSHOT" : "PRICE MATCHES LIVE",
            },

      structure: { supports, resistances },
      patterns,
      indicators: indicators
        ? {
            rsi: indicators.rsi,
            rsiLabel: indicators.rsiLabel,
            atr: indicators.atr,
            atrPct: indicators.atrPct,
            macd: indicators.macd?.bias ?? null,
            ema20: indicators.ema20,
            ema200: indicators.ema200,
          }
        : null,

      tradePlan: planAvailable ? plan : null,
      profileUsed: profile,

      // The client merges its own journal; localStorage is not readable here.
      journalContext: { mergeOnClient: true },

      sources: [
        isReal
          ? `${feed.source}${feed.symbolUsed && feed.symbolUsed !== symbol ? ` ${feed.symbolUsed}` : ""} real · ${ohlc.length} ${timeframe} bars${feed.aggregated ? " (aggregated from 1H)" : ""}${feed.stale ? `, cached ${feed.ageSeconds}s ago` : ""}`
          : anchor === "screenshot"
            ? "Your screenshot price"
            : "Modelled candles",
        "Auto S/R",
        `Pattern Radar (${patterns.length})`,
      ],
      disclaimer:
        "Worked example for study. Not a signal, not a recommendation, not financial advice.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

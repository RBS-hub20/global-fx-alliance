import { NextResponse } from "next/server";
import { getRealCandles } from "@/lib/marketProvider";
import { isTimeframe, type Timeframe } from "@/lib/timeframes";
import { getPair, PAIRS } from "@/lib/market";

export const runtime = "edge";

/**
 * Candles for the live Chart Snap chart, keyed by candle size.
 *
 * `/api/market/live` is keyed by *range* — how much history a chart shows —
 * which is a different question from what candle size Chart Snap works in. This
 * serves the same provider chain the analyzer uses, so the chart the reader is
 * looking at and the plan they get back are drawn from one set of candles rather
 * than two that can disagree.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPair = (searchParams.get("pair") ?? "XAU/USD").toUpperCase();
  const symbol = PAIRS.some((p) => p.symbol === rawPair) ? rawPair : "XAU/USD";
  const rawTf = (searchParams.get("tf") ?? "1H").toUpperCase();
  const tf: Timeframe = isTimeframe(rawTf) ? rawTf : "1H";

  const feed = await getRealCandles(symbol, tf);
  const pair = getPair(symbol);
  const n = feed.candles.length;

  // Change is measured across the returned window so it always agrees with the
  // candles drawn beside it.
  const first = n ? feed.candles[Math.max(0, n - 24)].close : feed.price;
  const changePct = first ? ((feed.price - first) / first) * 100 : 0;

  const last = n ? feed.candles[n - 1] : null;

  return NextResponse.json(
    {
      symbol,
      timeframe: tf,
      decimals: pair.decimals,
      price: Number(feed.price.toFixed(pair.decimals)),
      changePct: Number(changePct.toFixed(2)),
      candles: feed.candles,
      bars: n,
      isReal: feed.isReal,
      source: feed.source,
      symbolUsed: feed.symbolUsed,
      aggregated: feed.aggregated,
      stale: feed.stale,
      ageSeconds: feed.ageSeconds,
      /** Open time of the newest bar — the client uses it to spot a candle close. */
      lastBarTime: last?.time ?? null,
      timestamp: new Date().toISOString(),
    },
    // Matches the provider's own 60s freshness window; polling faster than this
    // returns the same numbers while spending Twelve Data's 8-per-minute budget.
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } }
  );
}

import { NextResponse } from "next/server";
import { fetchYahooOHLC } from "@/lib/fetchRealOHLC";
import { detectPatterns } from "@/lib/patternDetector";
import { candlesFor, getPair, PAIRS } from "@/lib/market";
import { specFor } from "@/lib/yahooSymbols";

export const runtime = "edge";

/**
 * Pattern radar over real candles.
 *
 * Scans each requested instrument with the same detector the chart's auto-drawn
 * levels come from, so anything flagged here is visible on the chart. Falls back
 * to modelled candles per-symbol if the upstream misses, and says so, rather than
 * dropping the instrument silently.
 */

const DEFAULT = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "BTC/USD", "AUD/USD"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = (searchParams.get("symbols") ?? DEFAULT.join(","))
    .split(",")
    .map((s) => decodeURIComponent(s).toUpperCase().trim())
    .filter(Boolean)
    .slice(0, 8);

  const spec = specFor("1D");
  let anyReal = false;
  const scanned: { symbol: string; source: string; bars: number }[] = [];

  const results = await Promise.all(
    requested.map(async (symbol) => {
      const pair = getPair(symbol);
      const known = PAIRS.some((p) => p.symbol === symbol);
      const real = await fetchYahooOHLC(symbol, spec.range, spec.interval);

      const ohlc = real && real.ohlc.length >= 20 ? real.ohlc : known ? candlesFor(pair.symbol, "1D") : [];
      if (!ohlc.length) return [];

      if (real && real.ohlc.length >= 20) anyReal = true;
      scanned.push({
        symbol,
        source: real && real.ohlc.length >= 20 ? "yahoo" : "modeled",
        bars: ohlc.length,
      });

      return detectPatterns(ohlc, symbol, spec.interval, pair.decimals);
    })
  );

  const order = { high: 0, medium: 1, low: 2 } as const;
  const patterns = results
    .flat()
    .sort((a, b) => order[a.confidence] - order[b.confidence] || b.time - a.time);

  return NextResponse.json(
    {
      patterns,
      count: patterns.length,
      scanned,
      timeframe: spec.interval,
      source: anyReal ? "yahoo" : "modeled",
      isReal: anyReal,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" } }
  );
}

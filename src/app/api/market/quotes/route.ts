import { NextResponse } from "next/server";
import { getRealCandles } from "@/lib/marketProvider";
import { getPair, PAIRS } from "@/lib/market";

export const runtime = "edge";

/**
 * Live quotes for the dashboard ticker, several instruments in one request.
 *
 * Uses the same provider chain as the charts — Twelve Data, then Yahoo, then the
 * short cache, then modelled — rather than a separate free feed. A second source
 * would put a different gold price in the ticker than the chart directly beneath
 * it: Twelve Data carries spot XAU/USD while Yahoo only has the GC=F futures
 * contract, about forty points apart. Agreeing with itself matters more here
 * than shaving a dependency.
 *
 * The sparkline is drawn from the same candles as the price, so the line and the
 * number describe one series.
 */

const DEFAULT = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"];
const SPARK_POINTS = 40;

/*
 * Instruments the provider chain can serve that are not tradeable pairs in
 * PAIRS. The dollar index has a Yahoo listing (DX-Y.NYB) and comes back real,
 * so the terminal header can show it rather than a proxy computed from the
 * legs — which would be a different number wearing the same name.
 */
const EXTRA: Record<string, { name: string; decimals: number }> = {
  DXY: { name: "US Dollar Index", decimals: 3 },
};

const known = (s: string) => PAIRS.some((p) => p.symbol === s) || s in EXTRA;

/** Evenly-spaced sample of the closes, oldest first. */
function spark(closes: number[]): number[] {
  if (closes.length <= SPARK_POINTS) return closes;
  const step = closes.length / SPARK_POINTS;
  return Array.from({ length: SPARK_POINTS }, (_, i) => closes[Math.floor(i * step)]);
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("pairs");
  const requested = (raw ? raw.split(",") : DEFAULT)
    .map((s) => decodeURIComponent(s).trim().toUpperCase())
    .filter(known)
    .slice(0, 8);

  const symbols = requested.length ? requested : DEFAULT;

  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      const extra = EXTRA[symbol];
      const pair = extra
        ? { symbol, name: extra.name, decimals: extra.decimals }
        : getPair(symbol);
      const feed = await getRealCandles(symbol, "1H");
      const closes = feed.candles.map((c) => c.close);
      const n = closes.length;

      // Measured across the drawn window, so the percentage and the line agree.
      const first = n ? closes[Math.max(0, n - 24)] : feed.price;
      const change = feed.price - first;

      return {
        symbol,
        name: pair.name,
        price: Number(feed.price.toFixed(pair.decimals)),
        change: Number(change.toFixed(pair.decimals)),
        changePct: Number((first ? (change / first) * 100 : 0).toFixed(2)),
        decimals: pair.decimals,
        spark: spark(closes),
        isReal: feed.isReal,
        source: feed.source,
        symbolUsed: feed.symbolUsed,
        stale: feed.stale,
      };
    })
  );

  return NextResponse.json(
    {
      quotes,
      isReal: quotes.every((q) => q.isReal),
      anyModelled: quotes.some((q) => !q.isReal),
      timestamp: new Date().toISOString(),
    },
    // Matches the provider's own freshness window; polling faster returns the
    // same numbers while spending Twelve Data's 8-per-minute budget.
    { headers: { "Cache-Control": "public, s-maxage=30" } }
  );
}

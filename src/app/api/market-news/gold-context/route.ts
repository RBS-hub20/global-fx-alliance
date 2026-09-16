import { NextResponse } from "next/server";
import { getRealCandles } from "@/lib/marketProvider";
import { fetchYahooOHLC } from "@/lib/fetchRealOHLC";
import { changeOver, crossSeries, sample, type Bar } from "@/lib/goldIntel";

export const runtime = "edge";

/**
 * Gold-only movers: spot, COMEX futures, and gold priced in euros and pounds.
 *
 * XAU/EUR and XAU/GBP are derived, bar by bar, from XAU/USD and the FX rate at
 * each bar's own time — both from the same provider chain the charts use. They
 * are labelled derived, because no feed here quotes them directly.
 */

const toBars = (c: { time: number; close: number }[]): Bar[] => c.map((x) => ({ time: x.time, close: x.close }));

function row(symbol: string, label: string, bars: Bar[], decimals: number, meta: { isReal: boolean; source: string; note?: string }) {
  const closes = bars.map((b) => b.close);
  if (!closes.length) return null;
  // 24 one-hour bars: a day. The sparkline is drawn from the same window.
  const window = closes.slice(-48);
  const { change, pct } = changeOver(closes, 24);
  return {
    symbol, label, decimals,
    price: Number(closes[closes.length - 1].toFixed(decimals)),
    change: Number(change.toFixed(decimals)),
    pct: Number(pct.toFixed(2)),
    spark: sample(window, 40),
    ...meta,
  };
}

export async function GET() {
  const [spot, eur, gbp, fut] = await Promise.all([
    getRealCandles("XAU/USD", "1H"),
    getRealCandles("EUR/USD", "1H"),
    getRealCandles("GBP/USD", "1H"),
    fetchYahooOHLC("GC=F", "5d", "60m").catch(() => null),
  ]);

  const spotBars = toBars(spot.candles);
  const rows = [
    row("XAUUSD", "Spot gold", spotBars, 2, { isReal: spot.isReal, source: spot.source }),
    fut?.ohlc?.length
      ? row("GC=F", "COMEX futures", toBars(fut.ohlc), 2, { isReal: true, source: "Yahoo", note: "front month" })
      : null,
    eur.isReal && spot.isReal
      ? row("XAUEUR", "Gold in EUR", crossSeries(spotBars, toBars(eur.candles)), 2, { isReal: true, source: `${spot.source}`, note: "derived: XAU/USD ÷ EUR/USD" })
      : null,
    gbp.isReal && spot.isReal
      ? row("XAUGBP", "Gold in GBP", crossSeries(spotBars, toBars(gbp.candles)), 2, { isReal: true, source: `${spot.source}`, note: "derived: XAU/USD ÷ GBP/USD" })
      : null,
  ].filter(Boolean);

  return NextResponse.json(
    { movers: rows, timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } }
  );
}

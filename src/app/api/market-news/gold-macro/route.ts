import { NextResponse } from "next/server";
import { fetchYahooOHLC } from "@/lib/fetchRealOHLC";
import { readCot, returnCorrelation, seasonalCurves, type Bar, type CotRow } from "@/lib/goldIntel";

export const runtime = "nodejs";

/**
 * The slow-moving context for gold: seasonality, correlations and positioning.
 *
 * All daily or weekly data, so it is cached for an hour — polling it every 30
 * seconds would spend Yahoo's patience on numbers that change once a day.
 * Each block fails on its own: a CFTC outage should not blank the seasonals.
 */

const COT_URL =
  "https://publicreporting.cftc.gov/resource/6dca-aqww.json" +
  "?cftc_contract_market_code=088691&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=2";
const COT_TTL_MS = 12 * 3_600_000;
let cotCache: { at: number; rows: CotRow[] } | null = null;

const bars = (r: { ohlc: { time: number; close: number }[] } | null): Bar[] =>
  (r?.ohlc ?? []).map((c) => ({ time: c.time, close: c.close }));

async function cot(): Promise<CotRow[] | null> {
  if (cotCache && Date.now() - cotCache.at < COT_TTL_MS) return cotCache.rows;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(COT_URL, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return cotCache?.rows ?? null;
    const rows = (await res.json()) as CotRow[];
    cotCache = { at: Date.now(), rows };
    return rows;
  } catch {
    return cotCache?.rows ?? null;
  }
}

export async function GET() {
  // Yahoo throttles bursts from one address, so the four daily series are
  // fetched in sequence rather than all at once.
  const gold = await fetchYahooOHLC("GC=F", "5y", "1d", 1400).catch(() => null);
  const dxy = await fetchYahooOHLC("DX-Y.NYB", "6mo", "1d").catch(() => null);
  const us10y = await fetchYahooOHLC("^TNX", "6mo", "1d").catch(() => null);
  const btc = await fetchYahooOHLC("BTC-USD", "6mo", "1d").catch(() => null);
  const cotRows = await cot();

  const g = bars(gold);
  const year = new Date().getUTCFullYear();

  const corr = (label: string, symbol: string, other: Bar[]) => {
    if (!g.length || !other.length) return { label, symbol, r: null, n: 0 };
    const { r, n } = returnCorrelation(g, other, 60);
    return { label, symbol, r: r === null ? null : Number(r.toFixed(2)), n };
  };

  const seasonals = g.length
    ? seasonalCurves(g, [year, year - 1, year - 2, year - 3, year - 4]).map((c) => ({
        year: c.year,
        ytd: Number(c.ytd.toFixed(2)),
        // Every third trading day is plenty for a year-long line and a third of the payload.
        points: c.points.filter((_, i, a) => i % 3 === 0 || i === a.length - 1).map((p) => ({ doy: p.doy, pct: Number(p.pct.toFixed(2)) })),
      }))
    : [];

  return NextResponse.json(
    {
      seasonals,
      seasonalSource: gold ? "COMEX gold futures (GC=F), daily closes" : null,
      correlations: [corr("DXY", "DX-Y.NYB", bars(dxy)), corr("US10Y", "^TNX", bars(us10y)), corr("BTC", "BTC-USD", bars(btc))],
      correlationBasis: "60 shared trading days, daily returns, vs GC=F",
      cot: cotRows ? readCot(cotRows) : null,
      cotSource: "CFTC Commitments of Traders, legacy futures-only, COMEX gold 088691",
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
  );
}

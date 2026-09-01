import { NextResponse } from "next/server";
import { PAIRS, RANGES, candlesFor, getPair, type Range } from "@/lib/market";
import { fetchYahooOHLC, lastUpstreamStatus } from "@/lib/fetchRealOHLC";
import { specFor } from "@/lib/yahooSymbols";

export const runtime = "edge";

/**
 * Quote + OHLC for one instrument.
 *
 * Order of preference:
 *   1. Yahoo Finance — real historical candles, no key. Authoritative when it
 *      answers, so its price is used as-is and never sanity-gated against the
 *      seeded reference (real gold is nowhere near the modelled figure).
 *   2. exchangerate-api — spot only, for the majors. Its price re-bases modelled
 *      candles. Sanity-gated, because resolving the wrong instrument here is a
 *      real failure mode.
 *   3. Seeded engine — always available.
 *
 * The route never throws and never returns an error status for a data problem.
 * `isReal` and `source` tell the client exactly what it received so the chart can
 * label it honestly.
 */

const UPSTREAM_TIMEOUT_MS = 5000;

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Rates = Record<string, number>;

function priceFromUsdRates(symbol: string, rates: Rates): number | null {
  const [base, quote] = symbol.split("/");
  const inv = (v: number | undefined) => (typeof v === "number" && v > 0 ? 1 / v : null);
  if (quote === "USD") return inv(rates[base]);
  if (base === "USD") {
    const v = rates[quote];
    return typeof v === "number" && v > 0 ? v : null;
  }
  const b = rates[base];
  const q = rates[quote];
  if (typeof b === "number" && typeof q === "number" && b > 0) return q / b;
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("pair") ?? searchParams.get("symbol") ?? "EUR/USD";
  const symbol = decodeURIComponent(requested).toUpperCase().trim();

  const rangeParam = (searchParams.get("range") ?? "1D").toUpperCase() as Range;
  const timeframe: Range = RANGES.includes(rangeParam) ? rangeParam : "1D";
  const spec = specFor(timeframe);
  // Explicit overrides win, so the endpoint stays useful for ad-hoc queries.
  const yRange = searchParams.get("yrange") ?? spec.range;
  const yInterval = searchParams.get("interval") ?? spec.interval;

  const known = PAIRS.some((p) => p.symbol === symbol);
  const pair = getPair(symbol);
  const decimals = known ? pair.decimals : symbol.includes("JPY") ? 3 : 4;

  /* ---------------------------------------------------- 1. real candles */
  const real = await fetchYahooOHLC(symbol, yRange, yInterval);

  if (real && real.ohlc.length >= 10) {
    const bars = real.ohlc;
    const last = bars[bars.length - 1].close;
    const price = real.marketPrice ?? last;
    const base = real.previousClose ?? bars[0].open;
    const change = Number((price - base).toFixed(6));
    const changePct = base ? Number(((change / base) * 100).toFixed(2)) : 0;

    return NextResponse.json(
      {
        pair: known ? pair.symbol : symbol,
        requested: symbol,
        known,
        range: timeframe,
        yahoo: { range: yRange, interval: yInterval },
        price: Number(price.toFixed(decimals)),
        change,
        changePct,
        decimals,
        ohlc: bars,
        bars: bars.length,
        hasVolume: real.hasVolume,
        currency: real.currency,
        timestamp: new Date().toISOString(),
        source: "yahoo",
        symbolUsed: real.symbolUsed,
        isReal: true,
        seriesSource: "real",
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  }

  /* ------------------------------------- 2. spot only, modelled candles */
  let livePrice: number | null = null;
  let spotSource: "exchangerate-api" | null = null;

  if (known) {
    const rates = (await fetchJson("https://api.exchangerate-api.com/v4/latest/USD")) as
      | { rates?: Rates }
      | null;
    if (rates?.rates) {
      const p = priceFromUsdRates(symbol, rates.rates);
      // Gate the FX table: metals, indices and crypto are not in it, and a wrong
      // resolution would print a plausible-looking but wrong number.
      if (p !== null && Number.isFinite(p) && Math.abs(p - pair.price) / pair.price < 0.35) {
        livePrice = p;
        spotSource = "exchangerate-api";
      }
    }
  }

  const price = livePrice ?? pair.price;
  const ohlc = candlesFor(pair.symbol, timeframe, livePrice ?? undefined);
  const first = ohlc[0]?.open ?? price;
  const change = Number((price - first).toFixed(pair.decimals + 2));
  const changePct = first ? Number(((change / first) * 100).toFixed(2)) : 0;

  return NextResponse.json(
    {
      pair: pair.symbol,
      requested: symbol,
      known,
      range: timeframe,
      price: Number(price.toFixed(pair.decimals)),
      change,
      changePct,
      decimals: pair.decimals,
      ohlc,
      bars: ohlc.length,
      hasVolume: true,
      timestamp: new Date().toISOString(),
      source: spotSource ? "live-spot" : "modeled",
      symbolUsed: null,
      isReal: false,
      // The candles are synthesised even when the spot quote is real.
      seriesSource: "modeled",
      reason: real
        ? "yahoo_too_few_bars"
        : lastUpstreamStatus() === 429
          ? "yahoo_rate_limited"
          : "yahoo_unavailable",
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}

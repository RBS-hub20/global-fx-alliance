import { NextResponse } from "next/server";
import { PAIRS, RANGES, candlesFor, getPair, type Range } from "@/lib/market";

export const runtime = "edge";

/**
 * Live quote + OHLC for one pair.
 *
 * Tries free upstreams in order, each behind a short timeout, and falls back to
 * the seeded engine in lib/market. The route never throws and never returns an
 * error status for a data problem — a dashboard that goes blank because a free
 * API rate-limited is worse than one showing clearly-labelled fallback data. The
 * `source` field always says which one you got.
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

/** Derive a pair's price from a USD-based rate table. */
function priceFromUsdRates(symbol: string, rates: Rates): number | null {
  const [base, quote] = symbol.split("/");
  const inv = (v: number | undefined) => (typeof v === "number" && v > 0 ? 1 / v : null);

  if (quote === "USD") return inv(rates[base]);
  if (base === "USD") {
    const v = rates[quote];
    return typeof v === "number" && v > 0 ? v : null;
  }
  // Cross rate, e.g. EUR/GBP = rates.GBP / rates.EUR
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
  const range: Range = RANGES.includes(rangeParam) ? rangeParam : "1D";

  const known = PAIRS.some((p) => p.symbol === symbol);
  const pair = getPair(symbol);

  let livePrice: number | null = null;
  let source: "live" | "fallback" = "fallback";

  if (known) {
    // a) exchangerate-api — free, no key, USD-based table covering the majors.
    const rates = (await fetchJson("https://api.exchangerate-api.com/v4/latest/USD")) as
      | { rates?: Rates }
      | null;
    if (rates?.rates) {
      const p = priceFromUsdRates(symbol, rates.rates);
      // Sanity-gate the upstream: a wildly different number means we resolved the
      // wrong instrument (metals and indices are not in a plain FX table).
      if (p !== null && Number.isFinite(p) && Math.abs(p - pair.price) / pair.price < 0.35) {
        livePrice = p;
        source = "live";
      }
    }

    // b) twelvedata demo key — documented to fail without a real key; handled.
    if (livePrice === null) {
      const td = (await fetchJson(
        `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=demo`
      )) as { price?: string } | null;
      const p = td?.price ? Number.parseFloat(td.price) : NaN;
      if (Number.isFinite(p) && p > 0 && Math.abs(p - pair.price) / pair.price < 0.35) {
        livePrice = p;
        source = "live";
      }
    }
  }

  // c) Seeded fallback — always available, never throws.
  const price = livePrice ?? pair.price;
  const ohlc = candlesFor(pair.symbol, range, livePrice ?? undefined);

  const first = ohlc[0]?.open ?? price;
  const change = Number((price - first).toFixed(pair.decimals + 2));
  const changePct = first ? Number(((change / first) * 100).toFixed(2)) : 0;

  return NextResponse.json(
    {
      pair: pair.symbol,
      requested: symbol,
      known,
      range,
      price: Number(price.toFixed(pair.decimals)),
      change,
      changePct,
      decimals: pair.decimals,
      ohlc,
      timestamp: new Date().toISOString(),
      source,
      // `source` describes the spot quote only. The OHLC series is always
      // synthesised from the seeded engine and re-based onto that quote, so no
      // caller mistakes these candles for real historical prints.
      seriesSource: "modeled",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}

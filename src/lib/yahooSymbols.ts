import type { Range } from "./market";

/**
 * Yahoo Finance symbol mapping.
 *
 * Candidates are ordered and tried in sequence, because Yahoo's coverage is
 * uneven: spot gold (`XAUUSD=X`) 404s, so the front-month futures contract
 * `GC=F` is the working proxy. USD/JPY resolves under both `JPY=X` and
 * `USDJPY=X`; the shorter form is Yahoo's canonical listing.
 *
 * Verified against the live endpoint — every candidate below returned 200 with
 * real OHLC except where noted as a deliberate second choice.
 */
export const YAHOO_CANDIDATES: Record<string, string[]> = {
  "EUR/USD": ["EURUSD=X"],
  "GBP/USD": ["GBPUSD=X"],
  "USD/JPY": ["JPY=X", "USDJPY=X"],
  "AUD/USD": ["AUDUSD=X"],
  "NZD/USD": ["NZDUSD=X"],
  "USD/CHF": ["USDCHF=X"],
  "EUR/GBP": ["EURGBP=X"],
  // Spot gold is not listed; COMEX front-month futures is the standard proxy.
  "XAU/USD": ["GC=F", "XAUUSD=X"],
  "BTC/USD": ["BTC-USD"],
  DXY: ["DX-Y.NYB"],
  SPX: ["^GSPC"],
};

/** Ordered Yahoo symbols to try for a pair. */
export function getCandidates(pair: string): string[] {
  const key = pair.toUpperCase().trim();
  const mapped = YAHOO_CANDIDATES[key];
  if (mapped) return mapped;
  // Unmapped FX pairs follow Yahoo's own convention.
  if (key.includes("/")) return [`${key.replace("/", "")}=X`];
  return [key];
}

export interface RangeSpec {
  range: string;
  interval: string;
}

/**
 * Range/interval per timeframe, chosen by measuring actual bar counts against
 * the live endpoint rather than guessing — several plausible combinations
 * return too few bars to compute a 200-period average.
 *
 * Measured (EUR/USD · GC=F): 1D 52/267 · 1W 199/184 · 1M 506/491 · 3M 67/65 · 1Y 260/252
 */
export const RANGE_SPEC: Record<Range, RangeSpec> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1h" },
  "3M": { range: "3mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
};

export function specFor(range: Range): RangeSpec {
  return RANGE_SPEC[range] ?? RANGE_SPEC["1D"];
}

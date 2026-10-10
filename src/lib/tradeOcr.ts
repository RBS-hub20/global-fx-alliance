/**
 * Turning a broker screenshot into journal fields.
 *
 * The model reads the image; this decides what to believe. Everything a vision
 * model returns is a guess about pixels, so nothing here is written into the
 * journal — the route hands these values to the form, the member checks them
 * against their platform, and the platform stays the authority on what they
 * were actually paid.
 *
 * Pure, so the same code runs under the tests.
 */

export interface OcrFields {
  symbol: string | null;
  direction: "buy" | "sell" | null;
  entry: number | null;
  exit: number | null;
  size: number | null;
  pnl: number | null;
  fees: number | null;
}

/** Broker spellings seen on MT4/MT5 and the usual CFD platforms. */
const SYMBOL_ALIASES: [RegExp, string][] = [
  [/^(gold|xauusd|xau_?usd|gold\.?spot)$/i, "XAU/USD"],
  [/^(silver|xagusd|xag_?usd)$/i, "XAG/USD"],
  [/^(us30|dow|dj30|djia|dji|wallstreet30|wall\s?street)$/i, "US30"],
  [/^(us500|spx500|sp500|s&p\s?500|spx)$/i, "US500"],
  [/^(nas100|nasdaq|ndx|usatech100|us100)$/i, "NAS100"],
  [/^(ger40|dax40|dax|de40)$/i, "GER40"],
  [/^(uk100|ftse100|ftse)$/i, "UK100"],
  [/^(btcusd|bitcoin|xbtusd)$/i, "BTC/USD"],
  [/^(ethusd|ethereum)$/i, "ETH/USD"],
];

/** ISO 4217 plus the metals and the two crypto codes brokers quote as pairs. */
const CURRENCY_CODES = new Set([
  "USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF",
  "XAU", "XAG", "XPT", "XPD",
  "CNH", "CNY", "HKD", "SGD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF",
  "MXN", "ZAR", "TRY", "THB", "INR", "BRL", "RUB",
  "BTC", "ETH",
]);

/**
 * A broker's ticker, as the journal spells it.
 *
 * Suffixes are the thing that matters here: live accounts label the same
 * instrument XAUUSD, XAUUSD.m, XAUUSD#, XAUUSDpro and #XAUUSD depending on the
 * server, and left alone each becomes its own row in the statistics.
 */
export function normaliseOcrSymbol(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().toUpperCase();
  s = s.replace(/^[#$]+/, "");                       // #XAUUSD
  s = s.replace(/[._-]?(M|PRO|ECN|RAW|C|Z|MICRO|CASH)$/i, ""); // XAUUSD.m, XAUUSDpro
  s = s.replace(/[#!]+$/, "");                       // XAUUSD#
  s = s.trim();
  if (!s) return null;

  const plain = s.replace(/[\s/]/g, "");
  for (const [re, canonical] of SYMBOL_ALIASES) {
    if (re.test(s) || re.test(plain)) return canonical;
  }
  /*
   * Six letters with no separator is usually a pair written without the slash —
   * but only when both halves are real currency codes. Splitting on length
   * alone turned WHEATX into WHE/ATX, inventing a currency pair out of a
   * commodity ticker and giving it its own row in the statistics.
   */
  if (/^[A-Z]{6}$/.test(plain)) {
    const base = plain.slice(0, 3);
    const quote = plain.slice(3);
    if (CURRENCY_CODES.has(base) && CURRENCY_CODES.has(quote)) return `${base}/${quote}`;
  }
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(s)) return s;
  return s;
}

export function normaliseDirection(raw: string | null | undefined): "buy" | "sell" | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (/^(buy|bought|long|b)\b/.test(s) || s.includes("buy")) return "buy";
  if (/^(sell|sold|short|s)\b/.test(s) || s.includes("sell")) return "sell";
  return null;
}

/**
 * A number as a platform prints it.
 *
 * Handles thousands separators, currency symbols, spaces used as separators,
 * and parentheses for negatives — (2.50) is a cost on plenty of statements.
 */
export function coerceNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;

  const parenthesised = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "");
  /*
   * A comma is a thousands separator here, not a decimal point: broker UIs in
   * this market are English-locale and write 4,195.80. Spaces are stripped for
   * the same reason — plenty of platforms print 69 000.5 — so both are removed
   * rather than treated as the end of the number.
   */
  s = s.replace(/[^\d.,\-+]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return parenthesised ? -Math.abs(n) : n;
}

export function cleanFields(raw: Record<string, unknown>): OcrFields {
  return {
    symbol: normaliseOcrSymbol(raw.symbol as string),
    direction: normaliseDirection(raw.direction as string),
    entry: coerceNumber(raw.entry),
    exit: coerceNumber(raw.exit),
    size: coerceNumber(raw.size),
    pnl: coerceNumber(raw.pnl),
    // A fee is a cost however the platform signs it.
    fees: (() => { const f = coerceNumber(raw.fees); return f === null ? null : -Math.abs(f); })(),
  };
}

/* --------------------------------------------------------------- the check */

export type Confidence = "high" | "medium" | "low";

export interface Review {
  confidence: Confidence;
  found: string[];
  missing: string[];
  warnings: string[];
}

const CORE: (keyof OcrFields)[] = ["symbol", "direction", "entry", "exit", "size"];

/**
 * How much of this to trust, worked out rather than asked for.
 *
 * A vision model will happily report a confidence of 0.92 about an image it
 * misread, and that number is not calibrated against anything — printing it
 * would dress a guess up as a measurement. What is checkable is whether the
 * fields are complete and whether they agree with each other: a P/L that does
 * not follow from the entry, exit and size is the single best sign that a digit
 * was misread, and on gold and FX the arithmetic is exact.
 */
export function reviewExtraction(f: OcrFields, expectedPnl: number | null = null): Review {
  const found = CORE.filter((k) => f[k] !== null && f[k] !== undefined).map(String);
  const missing = CORE.filter((k) => f[k] === null || f[k] === undefined).map(String);
  const warnings: string[] = [];

  if (f.size !== null && f.size <= 0) warnings.push("Size reads as zero or negative.");
  if (f.entry !== null && f.entry <= 0) warnings.push("Entry price reads as zero or negative.");

  /*
   * The caller works out what the prices imply and passes it in — this module
   * stays free of imports so it can be exercised directly, and the contract
   * sizes stay in one place rather than being half-known here. Null means the
   * instrument has no standard contract size to check against, which is the
   * case for indices and crypto.
   */
  let crossChecked = false;
  if (expectedPnl !== null && f.pnl !== null) {
    crossChecked = true;
    const scale = Math.max(Math.abs(expectedPnl), Math.abs(f.pnl), 1);
    if (Math.abs(expectedPnl - f.pnl) / scale > 0.05) {
      warnings.push(
        `The P/L read as ${f.pnl} but the prices and size work out to ${expectedPnl}. One of them was misread.`
      );
    }
  }

  const confidence: Confidence =
    missing.length === 0 && warnings.length === 0 && crossChecked ? "high"
    : missing.length <= 1 && warnings.length === 0 ? "medium"
    : "low";

  return { confidence, found, missing, warnings };
}

/** A one-line description of what was read, for the banner. */
export function describe(f: OcrFields): string {
  const bits: string[] = [];
  if (f.symbol) bits.push(f.symbol);
  if (f.direction) bits.push(f.direction.toUpperCase());
  if (f.size !== null) bits.push(`${f.size}`);
  if (f.entry !== null) bits.push(`@ ${f.entry}`);
  if (f.exit !== null) bits.push(`→ ${f.exit}`);
  if (f.pnl !== null) bits.push(`P/L ${f.pnl}`);
  return bits.join(" ") || "nothing recognisable";
}

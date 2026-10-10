/**
 * Screenshot -> journal fields: broker spellings, number formats, and the
 * cross-check that decides how much of it to trust.
 *
 *   node --experimental-strip-types scripts/test-trade-ocr.mjs
 */
const LIB = new URL("../src/lib/", import.meta.url).href;
const O = await import(LIB + "tradeOcr.ts");

let pass = 0, fail = 0;
const ok = (n, c, e = "") => { c ? pass++ : fail++; console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${e ? "  → " + e : ""}`); };

console.log("=== broker symbol spellings ===");
const S = (raw, want) => ok(`"${raw}" -> ${want}`, O.normaliseOcrSymbol(raw) === want, String(O.normaliseOcrSymbol(raw)));
S("XAUUSD", "XAU/USD"); S("xauusd", "XAU/USD"); S("GOLD", "XAU/USD");
S("XAUUSD.m", "XAU/USD");   // suffixed server
S("XAUUSD#", "XAU/USD");
S("#XAUUSD", "XAU/USD");
S("XAUUSDpro", "XAU/USD");
S("EURUSD", "EUR/USD"); S("EUR/USD", "EUR/USD");
S("BTCUSD", "BTC/USD"); S("Bitcoin", "BTC/USD");
S("US30", "US30"); S("Dow", "US30"); S("DJI", "US30"); S("DJ30", "US30");
S("NAS100", "NAS100"); S("Nasdaq", "NAS100");
S("DAX40", "GER40");
ok("a 6-letter non-pair is not split", O.normaliseOcrSymbol("WHEATX") === "WHEATX", String(O.normaliseOcrSymbol("WHEATX")));
ok("a real pair still splits", O.normaliseOcrSymbol("AUDNZD") === "AUD/NZD", String(O.normaliseOcrSymbol("AUDNZD")));
ok("metal pair splits", O.normaliseOcrSymbol("XAGEUR") === "XAG/EUR", String(O.normaliseOcrSymbol("XAGEUR")));
ok("empty is null", O.normaliseOcrSymbol("") === null);

console.log("=== direction ===");
for (const [raw, want] of [["Buy","buy"],["bought","buy"],["Long","buy"],["Sell","sell"],["SOLD","sell"],["short","sell"]])
  ok(`"${raw}" -> ${want}`, O.normaliseDirection(raw) === want, String(O.normaliseDirection(raw)));
ok("nonsense is null", O.normaliseDirection("maybe") === null);

console.log("=== numbers as platforms print them ===");
const N = (raw, want) => ok(JSON.stringify(raw), O.coerceNumber(raw) === want, String(O.coerceNumber(raw)));
N("4,195.80", 4195.8); N("4195.80", 4195.8); N("$50.00", 50);
N("-2.50", -2.5); N("(2.50)", -2.5);      // parenthesised cost
N("0.10", 0.1);
N(" 69 000.5 ", 69000.5);  // space used as a thousands separator
N("", null); N("n/a", null); N(null, null);

console.log("=== fees are a cost whichever way they are signed ===");
ok("positive fee becomes negative", O.cleanFields({ fees: "2.50" }).fees === -2.5, String(O.cleanFields({ fees: "2.50" }).fees));
ok("negative fee stays negative", O.cleanFields({ fees: "-2.50" }).fees === -2.5);

console.log("=== the cross-check ===");
// gold, 0.1 lot, 4180 -> 4190 is exactly $100
const good = O.cleanFields({ symbol: "XAUUSD", direction: "Buy", entry: "4180.00", exit: "4190.00", size: "0.10", pnl: "100.00", fees: "1.20" });
let r = O.reviewExtraction(good, 100);   // 0.1 lot gold, $10 move = $100
ok("complete and consistent -> high", r.confidence === "high", `${r.confidence} ${JSON.stringify(r.warnings)}`);
ok("no warnings", r.warnings.length === 0);

const misread = O.cleanFields({ symbol: "XAUUSD", direction: "Buy", entry: "4180.00", exit: "4190.00", size: "0.10", pnl: "1000.00" });
r = O.reviewExtraction(misread, 100);  // prices imply 100, the image said 1000
ok("P/L that does not follow -> low", r.confidence === "low", r.confidence);
ok("and says so", /work out to/.test(r.warnings.join(" ")), r.warnings.join(" "));

const partial = O.cleanFields({ symbol: "EURUSD", direction: "Sell", entry: "1.0850", exit: "1.0800", size: null, pnl: null });
r = O.reviewExtraction(partial, null);
ok("one field missing -> medium", r.confidence === "medium", `${r.confidence} missing=${r.missing.join(",")}`);

const indices = O.cleanFields({ symbol: "US30", direction: "Buy", entry: "44000", exit: "44100", size: "1", pnl: "100" });
r = O.reviewExtraction(indices, null);  // no standard contract size
ok("indices cannot be cross-checked -> medium, not high", r.confidence === "medium", r.confidence);

const empty = O.reviewExtraction(O.cleanFields({}), null);
ok("nothing read -> low", empty.confidence === "low");
ok("lists what is missing", empty.missing.length === 5, empty.missing.join(","));

console.log("=== the banner line ===");
ok("describes the trade", O.describe(good) === "XAU/USD BUY 0.1 @ 4180 → 4190 P/L 100", O.describe(good));
ok("empty says so", /nothing recognisable/.test(O.describe(O.cleanFields({}))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

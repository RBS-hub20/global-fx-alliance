/**
 * Journal statement parsing — MT5 .xlsx, MT4 .html, CSV.
 *
 *   node --experimental-strip-types scripts/test-journal-parser.mjs
 *
 * The .xlsx fixture is a real workbook, base64'd below, generated to match the
 * shape MT5's "History → Report" produces: a preamble of account rows, a
 * Positions table with duplicated Time and Price columns, dates stored as Excel
 * serial numbers rather than text, sparse empty cells for S/L and T/P, and the
 * Orders section that follows. A binary reader with no fixture is a reader
 * nobody can change safely.
 */
import { Buffer } from "node:buffer";

const LIB = new URL("../src/lib/", import.meta.url).href;
const { xlsxToRows, looksLikeXlsx } = await import(LIB + "xlsxRows.ts");
const { parseTradeRows, parseStatementRows, parseTradesHTML, parseTradesCSV, computeAnalytics, isPosition } =
  await import(LIB + "journalParser.ts");
const { SAMPLE_STATEMENT_CSV } = await import(LIB + "journalSample.ts");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`);
};

const XLSX_B64 =
  "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";

const MT4_HTML = `<html><body><div>Vantage&nbsp;International</div><table>
<tr><td colspan=13>Account: 1327247</td></tr>
<tr bgcolor="#C0C0C0" align=center><td>Ticket</td><td>Open&nbsp;Time</td><td>Type</td><td>Size</td><td>Item</td>
<td>Price</td><td>S / L</td><td>T / P</td><td>Close&nbsp;Time</td><td>Price</td><td>Commission</td><td>Swap</td><td>Profit</td></tr>
<tr align=right><td>41550011</td><td>2026.10.01 08:15</td><td>buy</td><td>0.10</td><td>XAUUSD</td><td>2642.10</td><td>0.00</td><td>0.00</td><td>2026.10.01 09:00</td><td>2648.90</td><td>-1.20</td><td>0.00</td><td>68.00</td></tr>
<tr align=right><td>41550012</td><td>2026.10.01 10:05</td><td>sell</td><td>0.20</td><td>GBPUSD</td><td>1.26340</td><td>0.00</td><td>0.00</td><td>2026.10.01 13:45</td><td>1.26710</td><td>-2.40</td><td>-0.35</td><td>-74.00</td></tr>
<tr align=right><td>41550098</td><td>2026.10.04 08:00</td><td>balance</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>500.00</td></tr>
</table></body></html>`;

const toAb = (b64) => { const b = Buffer.from(b64, "base64"); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

console.log("=== isPosition: pending orders are not trades ===");
for (const t of ["buy", "sell", "Buy", "SELL ", "long", "short"]) ok(`"${t}" is a position`, isPosition(t));
for (const t of ["buy limit", "sell stop", "buy stop limit", "balance", "credit", "deposit", ""])
  ok(`"${t}" is not`, !isPosition(t));

console.log("=== MT5 .xlsx ===");
const ab = toAb(XLSX_B64);
ok("zip magic recognised", looksLikeXlsx(ab));
const rows = await xlsxToRows(ab);
ok("worksheet rows read", rows.length > 10, `${rows.length} rows`);
const x = parseTradeRows(rows, "ReportHistory-1327247.xlsx");
ok("5 positions, Orders section ignored", x.length === 5, `got ${x.length}`);
ok("symbols normalised", x.map((t) => t.symbol).join(",") === "XAU/USD,GBP/USD,XAU/USD,EUR/USD,GBP/USD", x.map((t) => t.symbol).join(","));
ok("excel serial decoded to a real date", x[0].openTime === "2026-10-01T08:15:00.000Z", String(x[0].openTime));
ok("duration from the duplicated Time columns", x[0].durationMinutes === 45, String(x[0].durationMinutes));
ok("net = profit + commission + swap", x[0].net === 66.8 && x[1].net === -76.75, `${x[0].net}, ${x[1].net}`);
ok("prices from the duplicated Price columns", x[0].openPrice === 2642.1 && x[0].closePrice === 2648.9, `${x[0].openPrice}/${x[0].closePrice}`);
ok("ticket preserved", x[0].id === "41550011", x[0].id);

console.log("=== MT4 .html ===");
const h = parseTradesHTML(MT4_HTML, "DetailedStatement.html");
ok("2 trades, balance row skipped", h.length === 2, `got ${h.length}`);
ok("&nbsp; in headers still matches", h[0].openTime === "2026-10-01T08:15:00.000Z", String(h[0].openTime));
ok("agrees with the xlsx path", h[0].net === x[0].net && h[1].net === x[1].net, `${h[0].net}, ${h[1].net}`);
ok("broker read from the statement body", h[0].broker === null || h[0].broker === "Vantage", String(h[0].broker));

console.log("=== MT5 Deals section must not double-count ===");
const d = parseTradeRows([
  ["Positions"],
  ["Time", "Position", "Symbol", "Type", "Volume", "Price", "Time", "Price", "Commission", "Swap", "Profit"],
  ["2026.10.01 08:15", "41550011", "XAUUSD", "buy", "0.10", "2642.10", "2026.10.01 09:00", "2648.90", "-1.20", "0.00", "68.00"],
  [], ["Deals"],
  ["Time", "Deal", "Symbol", "Type", "Direction", "Volume", "Price", "Order", "Commission", "Swap", "Profit"],
  ["2026.10.01 08:15", "9001", "XAUUSD", "buy", "in", "0.10", "2642.10", "41550011", "-0.60", "0.00", "0.00"],
  ["2026.10.01 09:00", "9002", "XAUUSD", "sell", "out", "0.10", "2648.90", "41550011", "-0.60", "0.00", "68.00"],
], "r.xlsx");
ok("one position, not three rows", d.length === 1, `got ${d.length}`);
ok("counted once at 66.80", d[0].net === 66.8, String(d[0].net));


console.log("=== the reported failure: misaligned header must not invent profit ===");
// 13 data columns, but a header row whose cells do not line up — which is what
// put commission and swap on the two Price columns.
const skewed = [
  ["Positions"],
  ["Time","Position","Symbol","Type","Volume","Price","Time","Price","Commission","Swap","Profit"], // 11
  ["2026.10.09 16:20","9001","XAUUSD","buy","0.10","4187.49","","","2026.10.09 16:41","4192.10","-1.20","0.00","46.10"], // 13
];
const sk = parseStatementRows(skewed, "ReportHistory-1029247.html");
ok("does not report a price as profit", !sk.trades.some((t) => Math.abs(t.net) > 1000),
   sk.trades.map((t) => t.net).join(",") || "no trades");
ok("report explains the column mapping", sk.report.mapped.length > 0, sk.report.mapped.slice(0, 4).join(" "));

console.log("=== balance operations are not trades ===");
const withOps = [
  ["Positions"],
  ["Time","Position","Symbol","Type","Volume","Price","S / L","T / P","Time","Price","Commission","Swap","Profit"],
  ["2026.10.09 16:20","9001","XAUUSD","buy","0.10","4187.49","0.00","0.00","2026.10.09 16:41","4192.10","-1.20","0.00","46.10"],
  ["2026.10.09 17:02","9002","XAUUSD","sell","0.20","4195.00","0.00","0.00","2026.10.09 18:30","4199.80","-2.40","-0.10","-96.00"],
  // cash movements, worded the way terminals word them
  ["2026.10.01 00:00","9100","","balance","","","","","","","","","132634.13"],
  ["2026.10.05 00:00","9101","","withdrawal","","","","","","","","","-140497.69"],
  ["2026.10.05 00:00","9102","Deposit","deposit","","","","","","","","","5000.00"],
  ["2026.10.06 00:00","9103","","credit","","","","","","","","","0.00"],
  ["2026.10.06 00:00","9104","","bonus","","","","","","","","","250.00"],
  ["2026.10.07 00:00","9105","XAUUSD","buy limit","0.10","4100.00","","","","","","",""],
];
const r = parseStatementRows(withOps, "ReportHistory-1029247.html");
ok("2 real positions only", r.trades.length === 2, `got ${r.trades.length}`);
ok("deposits/withdrawals counted as skipped", r.report.skippedBalance >= 4, String(r.report.skippedBalance));
ok("pending order counted as skipped", r.report.skippedPending >= 1, String(r.report.skippedPending));
const ra = computeAnalytics(r.trades);
ok("net is trading P/L, not deposits", Math.abs(ra.summary.netPL - (46.10 - 1.20 + (-96.00 - 2.40 - 0.10))) < 0.01, String(ra.summary.netPL));
ok("win rate is not 100%", ra.summary.winRate === 50, String(ra.summary.winRate));
ok("costs are commission+swap only", Math.abs(ra.summary.totalCosts + 3.70) < 0.01, String(ra.summary.totalCosts));

console.log("=== hold time cannot be 2,225 years ===");
const badTime = [
  ["Time","Position","Symbol","Type","Volume","Price","Time","Price","Commission","Swap","Profit"],
  ["not a date","9001","XAUUSD","buy","0.10","4187.49","2026.10.09 16:41","4192.10","-1.20","0.00","46.10"],
];
const bt = parseStatementRows(badTime, "x.html").trades;
ok("unparseable open time -> duration null", bt.length === 1 && bt[0].durationMinutes === null,
   bt.length ? String(bt[0].durationMinutes) : "no trade");
ok("avg winner reports n/a, not a number", computeAnalytics(bt).holdTime.avgWinnerMin === null,
   String(computeAnalytics(bt).holdTime.avgWinnerMin));

console.log("=== one instrument has no 'worst' ===");
const onePair = computeAnalytics(r.trades);
ok("best is XAU/USD", onePair.patterns.bestPair?.key === "XAU/USD", String(onePair.patterns.bestPair?.key));
ok("worst is null, not the same pair", onePair.patterns.worstPair === null, String(onePair.patterns.worstPair?.key));


console.log("=== profit and swap on one column must not double-count ===");
// The real VT Markets report: the swap alias resolved to the profit column, so
// net = profit + commission + profit and costs = commission + profit.
const collide = [
  ["Position","Symbol","Type","S / L","Volume","Price","Time","T / P","Time","Price","Commission","Profit"],
  ["9001","XAUUSD","buy","0.00","0.10","4187.49","2026.10.09 16:20:25","0.00","2026.10.09 16:41:10","4192.10","-0.40","4.60"],
  ["9002","XAUUSD","sell","0.00","0.10","4195.00","2026.10.09 17:02:11","0.00","2026.10.09 18:30:40","4199.80","-0.40","-5.20"],
];
const cl = parseStatementRows(collide, "ReportHistory-1327247.html");
const mapped = cl.report.mapped.join(" ");
ok("swap did not land on the profit column", !/swap=/.test(mapped) || !/swap=\w*\[11\]/.test(mapped), mapped);
ok("2 trades", cl.trades.length === 2, String(cl.trades.length));
ok("net is profit + commission, counted once", Math.abs(cl.trades[0].net - 4.2) < 0.001, String(cl.trades[0].net));
ok("there is a losing trade", cl.trades.some((t) => t.net < 0), cl.trades.map((t) => t.net).join(","));
const ca = computeAnalytics(cl.trades);
ok("win rate is 50%, not 100%", ca.summary.winRate === 50, String(ca.summary.winRate));
ok("costs are commission only, not profit", Math.abs(ca.summary.totalCosts + 0.8) < 0.001, String(ca.summary.totalCosts));
ok("hold time parsed from the duplicated Time columns", cl.trades[0].durationMinutes === 21, String(cl.trades[0].durationMinutes));
ok("sessions are not blank", ca.bySession.length > 0, `${ca.bySession.length} sessions`);

console.log("=== a missing close time still buckets by open time ===");
const noClose = [
  ["Position","Symbol","Type","Volume","Price","Time","Commission","Profit"],
  ["9001","XAUUSD","buy","0.10","4187.49","2026.10.09 16:20:25","-0.40","4.60"],
];
const nc = parseStatementRows(noClose, "x.html");
ok("trade kept", nc.trades.length === 1, String(nc.trades.length));
const nca = computeAnalytics(nc.trades);
ok("session chart has data", nca.bySession.length > 0, `${nca.bySession.length}`);
ok("hour chart has data", nca.byHourLocal.length > 0, `${nca.byHourLocal.length}`);

console.log("=== regression: the CSV sample is unchanged ===");
const csv = parseTradesCSV(SAMPLE_STATEMENT_CSV, "");
const s = computeAnalytics(csv).summary;
ok("54 demo trades", csv.length === 54, `got ${csv.length}`);
ok("net P/L -725.73", Math.abs(s.netPL + 725.73) < 0.01, String(s.netPL));
ok("win rate 37%", Math.round(s.winRate) === 37, String(Math.round(s.winRate)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

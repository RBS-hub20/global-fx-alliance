/**
 * Journal compliance, streaks and tag analytics.
 *
 *   node --experimental-strip-types scripts/test-journal-pro.mjs
 */
const LIB = new URL("../src/lib/", import.meta.url).href;
const J = await import(LIB + "journalPro.ts");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`);
};

const T = (o = {}) => ({
  id: Math.random().toString(36).slice(2), symbol: "XAU/USD", direction: "buy",
  entryPrice: 4180, exitPrice: 4190, size: 0.1, riskUsd: 100, riskPercent: 1, rr: 2,
  outcome: null, pnl: 0, fees: 0, setupType: null, mistakeTag: null, emotion: null,
  session: null, openedAt: "2026-10-11T08:00:00Z", closedAt: "2026-10-11T09:00:00Z", notes: null, ...o,
});

console.log("=== summary treats break-even as its own outcome ===");
const s = J.summarise([T({ pnl: 100 }), T({ pnl: -50 }), T({ pnl: 0, outcome: "be" })]);
ok("3 closed", s.trades === 3, String(s.trades));
ok("1 win, 1 loss, 1 break-even", s.wins === 1 && s.losses === 1 && s.breakEven === 1, `${s.wins}/${s.losses}/${s.breakEven}`);
ok("win rate 33.3%, not 50%", s.winRate === 33.3, String(s.winRate));
ok("profit factor 2", s.profitFactor === 2, String(s.profitFactor));
ok("net 50", s.netPL === 50, String(s.netPL));

console.log("=== fees come out of the result ===");
ok("net is pnl minus fees", J.net(T({ pnl: 100, fees: 7 })) === 93, String(J.net(T({ pnl: 100, fees: 7 }))));
ok("a fee entered negative is still a cost", J.net(T({ pnl: 100, fees: -7 })) === 93, String(J.net(T({ pnl: 100, fees: -7 }))));

console.log("=== profit factor with no losers is infinite, not zero ===");
ok("null, not 0", J.summarise([T({ pnl: 10 }), T({ pnl: 20 })]).profitFactor === null);

console.log("=== streaks ===");
const seq = [100, 120, -50, -40, -30, 80].map((p, i) =>
  T({ pnl: p, closedAt: `2026-10-${String(11 + i).padStart(2, "0")}T09:00:00Z` }));
const st = J.streaks(seq);
ok("current win 1", st.currentWin === 1, String(st.currentWin));
ok("current loss 0", st.currentLoss === 0, String(st.currentLoss));
ok("best win run 2", st.bestWin === 2, String(st.bestWin));
ok("worst loss run 3", st.worstLoss === 3, String(st.worstLoss));
const withBE = J.streaks([T({ pnl: -10, closedAt: "2026-10-11T01:00:00Z" }), T({ pnl: 0, outcome: "be", closedAt: "2026-10-11T02:00:00Z" }), T({ pnl: -10, closedAt: "2026-10-11T03:00:00Z" })]);
ok("break-even does not break a losing run", withBE.worstLoss === 2, String(withBE.worstLoss));

console.log("=== tag analytics ===");
const tagged = [
  T({ pnl: 100, setupType: "breakout" }), T({ pnl: 80, setupType: "breakout" }), T({ pnl: -40, setupType: "breakout" }),
  T({ pnl: -60, setupType: "news" }), T({ pnl: -30, setupType: "news" }),
  T({ pnl: 50 }), // untagged
];
const bySetup = J.byTag(tagged, "setupType");
ok("two setups, untagged excluded", bySetup.length === 2, bySetup.map((b) => b.key).join(","));
ok("breakout 3 trades, 66.7% win", bySetup[0].key === "breakout" && bySetup[0].trades === 3 && bySetup[0].winRate === 66.7,
   JSON.stringify(bySetup[0]));
ok("news is all losses, PF null-safe", bySetup[1].net === -90 && bySetup[1].winRate === 0, JSON.stringify(bySetup[1]));

console.log("=== compliance ===");
const settings = { accountBalance: 10000, riskPerTrade: 1, dailyLossLimit: 3, maxTrades: 3, maxLossStreak: 2 };
const day = "2026-10-11";
const todays = [
  T({ pnl: -150, closedAt: "2026-10-11T08:00:00Z" }),
  T({ pnl: -160, closedAt: "2026-10-11T09:00:00Z" }),
];
let c = J.compliance(todays, settings, day);
ok("2 trades today", c.tradesToday === 2, String(c.tradesToday));
ok("pnl today -310", c.pnlToday === -310, String(c.pnlToday));
const loss = c.rules.find((r) => r.key === "daily_loss");
ok("loss limit is $300 (3% of 10,000)", loss.limit === 300, String(loss.limit));
ok("breached at -310", loss.level === "breach", loss.level);
ok("stop is true", c.stop === true);
ok("loss streak rule breached at 2", c.rules.find((r) => r.key === "loss_streak").level === "breach");

console.log("=== compliance without an account balance ===");
const noBal = J.compliance([T({ pnl: -500, closedAt: "2026-10-11T08:00:00Z" })], { ...settings, accountBalance: null }, day);
const lr = noBal.rules.find((r) => r.key === "daily_loss");
ok("not reported as a breach", lr.level === "ok", lr.level);
ok("says what is missing", /account balance/i.test(lr.detail), lr.detail);

console.log("=== over-risk detection ===");
const over = J.compliance([T({ pnl: -50, riskPercent: 2.5, closedAt: "2026-10-11T08:00:00Z" })], settings, day);
const rp = over.rules.find((r) => r.key === "risk_per_trade");
ok("flags the trade over 1%", rp.level === "breach" && rp.value === 1, JSON.stringify(rp));

console.log("=== day boundary is local, not UTC ===");
ok("01:00 Dubai belongs to that day", J.dayOf("2026-10-11T21:30:00Z", 4) === "2026-10-12",
   J.dayOf("2026-10-11T21:30:00Z", 4));
ok("open trades are excluded from the summary", J.summarise([T({ outcome: null, exitPrice: null, pnl: 999 })]).trades === 0);

console.log("=== equity curve and day buckets ===");
const eq = J.equityCurve(seq);
ok("runs oldest first and accumulates", eq[eq.length - 1].cumulative === 180, String(eq[eq.length - 1].cumulative));
const days = J.byDay(seq);
ok("six separate days", days.size === 6, String(days.size));


console.log("=== instruments ===");
ok("XAU/USD is Gold", J.assetClassOf("XAU/USD") === "Gold");
ok("GC=F is Gold", J.assetClassOf("GC=F") === "Gold");
ok("EUR/USD is a Major", J.assetClassOf("EUR/USD") === "Majors");
ok("US30 is an Index", J.assetClassOf("US30") === "Indices");
ok("BTC/USD is Crypto", J.assetClassOf("BTC/USD") === "Crypto");
ok("DXY is Other", J.assetClassOf("DXY") === "Other");
ok("a made-up ticker is Other", J.assetClassOf("WHEATX") === "Other", J.assetClassOf("WHEATX"));
ok("empty symbol defaults to XAU/USD", J.normaliseSymbolInput("  ") === "XAU/USD");
ok("input is upper-cased and trimmed", J.normaliseSymbolInput(" eur/usd ") === "EUR/USD");

console.log("=== contract sizes: assert only what is standard ===");
ok("gold is 100 oz", J.contractSize("XAU/USD") === 100);
ok("silver is 5000 oz", J.contractSize("XAG/USD") === 5000);
ok("FX is 100,000", J.contractSize("EUR/USD") === 100000);
ok("US30 is broker-specific -> null", J.contractSize("US30") === null);
ok("BTC/USD is broker-specific -> null", J.contractSize("BTC/USD") === null);

console.log("=== P/L estimate ===");
// 0.10 lots of gold, 10 dollars of movement: 0.10 * 100 oz * $10 = $100
ok("gold buy 4180->4190, 0.1 lot = $100", J.estimatePnl("XAU/USD", 4180, 4190, 0.1, "buy") === 100,
   String(J.estimatePnl("XAU/USD", 4180, 4190, 0.1, "buy")));
ok("same trade sold is -$100", J.estimatePnl("XAU/USD", 4180, 4190, 0.1, "sell") === -100,
   String(J.estimatePnl("XAU/USD", 4180, 4190, 0.1, "sell")));
// 1 lot EUR/USD, 50 pips = $500
ok("EUR/USD 1 lot, 0.0050 = $500", J.estimatePnl("EUR/USD", 1.08, 1.085, 1, "buy") === 500,
   String(J.estimatePnl("EUR/USD", 1.08, 1.085, 1, "buy")));
// USD/JPY earns yen; 1 lot over 1.00 = 100,000 JPY / 147 ~= $680, NOT 100,000
const jpy = J.estimatePnl("USD/JPY", 147, 148, 1, "buy");
ok("USD/JPY converts back to USD", jpy !== null && jpy > 600 && jpy < 700, String(jpy));
ok("US30 returns null, not a guess", J.estimatePnl("US30", 44000, 44100, 1, "buy") === null);
ok("missing exit returns null", J.estimatePnl("XAU/USD", 4180, null, 0.1, "buy") === null);
ok("zero size returns null", J.estimatePnl("XAU/USD", 4180, 4190, 0, "buy") === null);

console.log("=== per-symbol breakdown ===");
const mixed = [
  T({ pnl: 100, symbol: "XAU/USD" }), T({ pnl: -40, symbol: "XAU/USD" }),
  T({ pnl: 60, symbol: "EUR/USD" }), T({ pnl: -90, symbol: "US30" }),
];
const bs = J.bySymbol(mixed);
ok("three symbols", bs.length === 3, bs.map((b) => b.key).join(","));
ok("XAU/USD leads on trade count", bs[0].key === "XAU/USD" && bs[0].trades === 2, JSON.stringify(bs[0]));
const ac = J.byAssetClass(mixed);
ok("three asset classes", ac.length === 3, ac.map((b) => `${b.key}:${b.trades}`).join(" "));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

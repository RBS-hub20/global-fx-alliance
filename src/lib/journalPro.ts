/**
 * Journal analytics that a broker statement cannot produce.
 *
 * An imported statement already gives price, size and P&L — the Journal
 * Analytics tab reads those. What only a hand-kept log has is why the trade was
 * taken, which mistake was made and what the member felt, and that is what the
 * tag breakdowns below are for.
 *
 * Pure, so the same code runs in the browser and under the tests.
 */

export type Outcome = "win" | "loss" | "be";
export type Session = "asia" | "london" | "ny" | "dubai";

export interface JournalTrade {
  id: string;
  symbol: string;
  direction: "buy" | "sell";
  entryPrice: number | null;
  exitPrice: number | null;
  size: number | null;
  riskUsd: number | null;
  riskPercent: number | null;
  rr: number | null;
  outcome: Outcome | null;
  pnl: number | null;
  fees: number | null;
  setupType: string | null;
  mistakeTag: string | null;
  emotion: string | null;
  session: Session | null;
  openedAt: string | null;
  closedAt: string | null;
  notes: string | null;
}

export interface JournalSettings {
  accountBalance: number | null;
  riskPerTrade: number;
  dailyLossLimit: number;
  maxTrades: number;
  maxLossStreak: number;
}

export const DEFAULT_SETTINGS: JournalSettings = {
  accountBalance: null,
  riskPerTrade: 1,
  dailyLossLimit: 3,
  maxTrades: 3,
  maxLossStreak: 2,
};

/** Net of fees — what actually hit the account. */
export const net = (t: JournalTrade): number => (t.pnl ?? 0) - Math.abs(t.fees ?? 0);

/** A trade counts as closed once it has an outcome or an exit. */
export const isClosed = (t: JournalTrade): boolean => t.outcome !== null || t.exitPrice !== null;

/** Local calendar day, not UTC — a session that ends at 01:00 Dubai is still
 *  that trader's Monday. */
export function dayOf(iso: string | null, offsetHours = 4): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + offsetHours * 3600_000).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------- summary */

export interface Summary {
  trades: number; wins: number; losses: number; breakEven: number;
  winRate: number; netPL: number; grossWin: number; grossLoss: number;
  profitFactor: number | null; expectancy: number;
  avgWin: number; avgLoss: number; best: number; worst: number;
  avgRR: number | null;
}

export function summarise(trades: JournalTrade[]): Summary {
  const closed = trades.filter(isClosed);
  const nets = closed.map(net);
  const wins = closed.filter((t) => net(t) > 0);
  const losses = closed.filter((t) => net(t) < 0);
  const grossWin = wins.reduce((a, t) => a + net(t), 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + net(t), 0));
  const rrs = closed.map((t) => t.rr).filter((r): r is number => r !== null && Number.isFinite(r));

  return {
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    // Break-even is its own outcome, not a loss. Counting it as one drags the
    // win rate down and hides that the trade was managed, not lost.
    breakEven: closed.length - wins.length - losses.length,
    winRate: closed.length ? Math.round((wins.length / closed.length) * 1000) / 10 : 0,
    netPL: round(nets.reduce((a, n) => a + n, 0)),
    grossWin: round(grossWin),
    grossLoss: round(grossLoss),
    // null means no losing trade at all, which is infinite rather than zero.
    profitFactor: grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : null,
    expectancy: closed.length ? round(nets.reduce((a, n) => a + n, 0) / closed.length) : 0,
    avgWin: wins.length ? round(grossWin / wins.length) : 0,
    avgLoss: losses.length ? round(grossLoss / losses.length) : 0,
    best: nets.length ? round(Math.max(...nets)) : 0,
    worst: nets.length ? round(Math.min(...nets)) : 0,
    avgRR: rrs.length ? Math.round((rrs.reduce((a, r) => a + r, 0) / rrs.length) * 100) / 100 : null,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/* --------------------------------------------------------------- streaks */

export interface Streaks { currentWin: number; currentLoss: number; bestWin: number; worstLoss: number }

export function streaks(trades: JournalTrade[]): Streaks {
  const closed = trades.filter(isClosed)
    .sort((a, b) => (a.closedAt ?? "").localeCompare(b.closedAt ?? ""));

  let cw = 0, cl = 0, bw = 0, wl = 0;
  for (const t of closed) {
    const n = net(t);
    // Break-even breaks neither streak: it is not a win and not a loss, and
    // treating it as either invents a run that did not happen.
    if (n > 0) { cw += 1; cl = 0; bw = Math.max(bw, cw); }
    else if (n < 0) { cl += 1; cw = 0; wl = Math.max(wl, cl); }
  }
  return { currentWin: cw, currentLoss: cl, bestWin: bw, worstLoss: wl };
}

/* ------------------------------------------------------------ tag stats */

export interface TagStat { key: string; trades: number; wins: number; winRate: number; net: number; profitFactor: number | null }

/** Win rate and net by setup, mistake, emotion or session. */
export function byTag(trades: JournalTrade[], field: "setupType" | "mistakeTag" | "emotion" | "session"): TagStat[] {
  const groups = new Map<string, JournalTrade[]>();
  for (const t of trades.filter(isClosed)) {
    const key = (t[field] ?? "").trim();
    // Untagged trades are left out rather than bucketed as "none" — a bar
    // labelled none says nothing about how to trade better.
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  return Array.from(groups.entries())
    .map(([key, list]) => {
      const s = summarise(list);
      return { key, trades: s.trades, wins: s.wins, winRate: s.winRate, net: s.netPL, profitFactor: s.profitFactor };
    })
    .sort((a, b) => b.trades - a.trades);
}

/* ------------------------------------------------------------ compliance */

export type BreachLevel = "ok" | "warn" | "breach";

export interface Rule {
  key: string;
  label: string;
  level: BreachLevel;
  value: number;
  limit: number;
  detail: string;
}

export interface Compliance {
  day: string;
  tradesToday: number;
  pnlToday: number;
  lossStreak: number;
  rules: Rule[];
  /** True when any rule is fully breached — the banner that says stop. */
  stop: boolean;
}

/**
 * The member's own rules, checked against today.
 *
 * Deliberately not advice and not a block: nothing here prevents a trade or
 * tells anyone what to do. It reports what they said their limits were and
 * where today stands against them.
 */
export function compliance(
  trades: JournalTrade[],
  settings: JournalSettings,
  today = dayOf(new Date().toISOString())
): Compliance {
  const todays = trades.filter((t) => dayOf(t.closedAt ?? t.openedAt) === today);
  const closedToday = todays.filter(isClosed);
  const pnlToday = round(closedToday.reduce((a, t) => a + net(t), 0));
  const { currentLoss } = streaks(trades);

  const rules: Rule[] = [];

  rules.push({
    key: "max_trades",
    label: "Trades today",
    level: closedToday.length >= settings.maxTrades ? "breach" : closedToday.length >= settings.maxTrades - 1 ? "warn" : "ok",
    value: closedToday.length,
    limit: settings.maxTrades,
    detail: `${closedToday.length} of ${settings.maxTrades} taken`,
  });

  /*
   * The loss limit needs an account balance to be a percentage of. Without one
   * the rule is reported as unset rather than silently measured against zero,
   * which would read as a breach on the first losing trade.
   */
  if (settings.accountBalance && settings.accountBalance > 0) {
    const limitUsd = (settings.accountBalance * settings.dailyLossLimit) / 100;
    const lossToday = Math.max(0, -pnlToday);
    rules.push({
      key: "daily_loss",
      label: "Daily loss limit",
      level: lossToday >= limitUsd ? "breach" : lossToday >= limitUsd * 0.7 ? "warn" : "ok",
      value: round(lossToday),
      limit: round(limitUsd),
      detail: `${settings.dailyLossLimit}% of ${settings.accountBalance.toLocaleString()}`,
    });

    const overRisked = closedToday.filter((t) => (t.riskPercent ?? 0) > settings.riskPerTrade + 0.001);
    rules.push({
      key: "risk_per_trade",
      label: "Risk per trade",
      level: overRisked.length ? "breach" : "ok",
      value: overRisked.length,
      limit: 0,
      detail: overRisked.length
        ? `${overRisked.length} trade${overRisked.length > 1 ? "s" : ""} over ${settings.riskPerTrade}%`
        : `all within ${settings.riskPerTrade}%`,
    });
  } else {
    rules.push({
      key: "daily_loss",
      label: "Daily loss limit",
      level: "ok",
      value: 0,
      limit: 0,
      detail: "Set an account balance to measure this",
    });
  }

  rules.push({
    key: "loss_streak",
    label: "Losing streak",
    level: currentLoss >= settings.maxLossStreak ? "breach" : currentLoss >= settings.maxLossStreak - 1 && currentLoss > 0 ? "warn" : "ok",
    value: currentLoss,
    limit: settings.maxLossStreak,
    detail: currentLoss ? `${currentLoss} in a row` : "none",
  });

  return {
    day: today,
    tradesToday: closedToday.length,
    pnlToday,
    lossStreak: currentLoss,
    rules,
    stop: rules.some((r) => r.level === "breach"),
  };
}

/** Cumulative net, oldest first — the equity curve of the journal itself. */
export function equityCurve(trades: JournalTrade[]): { day: string; net: number; cumulative: number }[] {
  const closed = trades.filter(isClosed)
    .sort((a, b) => (a.closedAt ?? "").localeCompare(b.closedAt ?? ""));
  let running = 0;
  return closed.map((t) => {
    running = round(running + net(t));
    return { day: dayOf(t.closedAt), net: round(net(t)), cumulative: running };
  });
}

/** Net per calendar day, for the heatmap. */
export function byDay(trades: JournalTrade[]): Map<string, { net: number; trades: number; wins: number }> {
  const out = new Map<string, { net: number; trades: number; wins: number }>();
  for (const t of trades.filter(isClosed)) {
    const d = dayOf(t.closedAt ?? t.openedAt);
    if (!d) continue;
    const cur = out.get(d) ?? { net: 0, trades: 0, wins: 0 };
    cur.net = round(cur.net + net(t));
    cur.trades += 1;
    if (net(t) > 0) cur.wins += 1;
    out.set(d, cur);
  }
  return out;
}

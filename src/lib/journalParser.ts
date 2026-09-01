/**
 * Cross-broker trade-history parsing and analytics.
 *
 * MT4 and MT5 exports differ between builds and brokers (Vantage, VT Markets,
 * PUPRIME all ship slightly different column sets and delimiters), so columns are
 * matched by alias rather than position. Everything here is pure so the same code
 * runs in the browser — which is where it actually runs, so a trader's history
 * never leaves their machine.
 */

export interface Trade {
  id: string;
  symbol: string;
  type: "buy" | "sell";
  lot: number;
  openTime: string | null;
  closeTime: string | null;
  openPrice: number;
  closePrice: number;
  profit: number;
  commission: number;
  swap: number;
  /** Net of commission and swap — what actually hit the account. */
  net: number;
  durationMinutes: number | null;
  broker: string | null;
}

/* ------------------------------------------------------------------- CSV */

/** Picks the delimiter that yields the most consistent column count. */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const counts: [string, number][] = [
    ["\t", (line.match(/\t/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
    [",", (line.match(/,/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Minimal RFC-4180 splitter — handles quoted fields containing the delimiter. */
export function splitRow(row: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (quoted && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const ALIASES: Record<string, string[]> = {
  ticket: ["ticket", "position", "order", "deal", "id", "#"],
  symbol: ["symbol", "item", "instrument", "pair"],
  type: ["type", "direction", "side", "action"],
  lot: ["size", "volume", "lots", "lot", "qty", "quantity"],
  openTime: ["open time", "opentime", "time", "open date", "entry time"],
  closeTime: ["close time", "closetime", "time.1", "close date", "exit time"],
  openPrice: ["open price", "openprice", "price", "entry price", "entry"],
  closePrice: ["close price", "closeprice", "price.1", "exit price", "exit"],
  profit: ["profit", "p/l", "pnl", "net profit", "result", "gross profit"],
  commission: ["commission", "comm", "fee", "fees"],
  swap: ["swap", "rollover", "interest", "storage"],
  comment: ["comment", "comments", "note", "notes"],
};

/** Maps a header row onto canonical field names. */
export function mapHeaders(headers: string[]): Record<string, number> {
  const norm = headers.map((h) => h.toLowerCase().replace(/[_\s]+/g, " ").replace(/[^a-z0-9 ./#]/g, "").trim());
  const map: Record<string, number> = {};

  for (const [field, aliases] of Object.entries(ALIASES)) {
    // Exact match first; MT5 repeats "Time" and "Price" for open and close, so
    // positional order breaks ties for the duplicated pair.
    let idx = norm.findIndex((h) => aliases.includes(h));
    if (idx === -1) idx = norm.findIndex((h) => aliases.some((a) => h.startsWith(a)));
    if (idx !== -1) map[field] = idx;
  }

  // MT5 emits Time … Time and Price … Price; the second occurrence is the close.
  const dupTime = norm.reduce<number[]>((a, h, i) => (h === "time" ? [...a, i] : a), []);
  if (dupTime.length >= 2) {
    map.openTime = dupTime[0];
    map.closeTime = dupTime[1];
  }
  const dupPrice = norm.reduce<number[]>((a, h, i) => (h === "price" ? [...a, i] : a), []);
  if (dupPrice.length >= 2) {
    map.openPrice = dupPrice[0];
    map.closePrice = dupPrice[1];
  }

  return map;
}

const num = (v: string | undefined): number => {
  if (!v) return 0;
  // Strip currency symbols, thousands separators and spaces; keep sign.
  const cleaned = v.replace(/[^0-9.\-+]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

/** MT4/MT5 timestamps are broker-server local with no zone; treated as UTC. */
export function parseTradeTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/\./g, "-");
  const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))).toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

/** Normalises broker symbol spellings: EURUSD, EURUSD.m, XAUUSD# -> EUR/USD. */
export function normaliseSymbol(raw: string): string {
  const s = (raw || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (s.length >= 6) {
    const base = s.slice(0, 3);
    const quote = s.slice(3, 6);
    if (/^[A-Z]{3}$/.test(base) && /^[A-Z]{3}$/.test(quote)) return `${base}/${quote}`;
  }
  return (raw || "").toUpperCase().trim() || "UNKNOWN";
}

export function parseTradesCSV(text: string, fileName = ""): Trade[] {
  if (!text || !text.trim()) return [];
  const delim = detectDelimiter(text);
  const rows = text.split(/\r?\n/).filter((r) => r.trim().length > 0);
  if (rows.length < 2) return [];

  // The header is the first row containing a recognisable symbol/profit column.
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = splitRow(rows[i], delim).map((c) => c.toLowerCase());
    if (cells.some((c) => /symbol|item|instrument/.test(c)) && cells.some((c) => /profit|p\/l|pnl/.test(c))) {
      headerIdx = i;
      break;
    }
  }

  const map = mapHeaders(splitRow(rows[headerIdx], delim));
  if (map.symbol === undefined || map.profit === undefined) return [];

  // Separators in exported filenames are usually hyphens or underscores.
  const SEP = "[\\s\\-_.]*";
  const brokerFromFile =
    /vantage/i.test(fileName) ? "Vantage" :
    new RegExp(`vt${SEP}market`, "i").test(fileName) ? "VT Markets" :
    new RegExp(`pu${SEP}prime`, "i").test(fileName) ? "PUPRIME" : null;

  const out: Trade[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const c = splitRow(rows[i], delim);
    if (c.length < 3) continue;

    const rawType = (c[map.type ?? -1] ?? "").toLowerCase();
    if (!/buy|sell|long|short/.test(rawType)) continue; // skips balance/credit rows

    const symbol = normaliseSymbol(c[map.symbol]);
    if (symbol === "UNKNOWN") continue;

    const openTime = parseTradeTime(c[map.openTime ?? -1]);
    const closeTime = parseTradeTime(c[map.closeTime ?? -1]);
    const profit = num(c[map.profit]);
    const commission = num(c[map.commission ?? -1]);
    const swap = num(c[map.swap ?? -1]);

    const duration =
      openTime && closeTime
        ? Math.max(0, Math.round((Date.parse(closeTime) - Date.parse(openTime)) / 60000))
        : null;

    const comment = c[map.comment ?? -1] ?? "";
    const brokerFromComment =
      /vantage/i.test(comment) ? "Vantage" :
      /vt[\s\-_.]*market/i.test(comment) ? "VT Markets" :
      /pu[\s\-_.]*prime/i.test(comment) ? "PUPRIME" : null;

    out.push({
      id: (c[map.ticket ?? -1] || `${i}`).trim(),
      symbol,
      type: /sell|short/.test(rawType) ? "sell" : "buy",
      lot: num(c[map.lot ?? -1]),
      openTime,
      closeTime,
      openPrice: num(c[map.openPrice ?? -1]),
      closePrice: num(c[map.closePrice ?? -1]),
      profit,
      commission,
      swap,
      net: Number((profit + commission + swap).toFixed(2)),
      durationMinutes: duration,
      broker: brokerFromComment ?? brokerFromFile,
    });
  }

  return out;
}

/* ------------------------------------------------------------- analytics */

export interface Bucket {
  key: string;
  trades: number;
  wins: number;
  winRate: number;
  net: number;
}

export interface JournalAnalytics {
  summary: {
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    netPL: number;
    grossWin: number;
    grossLoss: number;
    profitFactor: number | null;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    expectancy: number;
    totalCosts: number;
  };
  byPair: Bucket[];
  byHourUTC: Bucket[];
  byHourLocal: Bucket[];
  byDay: Bucket[];
  bySession: Bucket[];
  holdTime: { avgWinnerMin: number | null; avgLoserMin: number | null };
  equityCurve: number[];
  patterns: {
    revenge: { detected: boolean; occurrences: { at: string; from: number; to: number }[] };
    overtrading: { detected: boolean; worstHour: string | null; count: number };
    bestPair: Bucket | null;
    worstPair: Bucket | null;
    bestHourLocal: Bucket | null;
    worstHourLocal: Bucket | null;
    bestSession: Bucket | null;
    worstSession: Bucket | null;
    holdsLosersLonger: boolean;
  };
  brokers: string[];
  timezoneOffsetHours: number;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Session windows in UTC hours; a bar can belong to more than one. */
function sessionFor(hourUTC: number): string {
  if (hourUTC >= 13 && hourUTC < 22) return "New York";
  if (hourUTC >= 8 && hourUTC < 13) return "London";
  if (hourUTC >= 0 && hourUTC < 8) return "Tokyo";
  return "Sydney";
}

function bucketise(rows: { key: string; net: number }[]): Bucket[] {
  const m = new Map<string, { trades: number; wins: number; net: number }>();
  for (const r of rows) {
    const b = m.get(r.key) ?? { trades: 0, wins: 0, net: 0 };
    b.trades++;
    if (r.net > 0) b.wins++;
    b.net += r.net;
    m.set(r.key, b);
  }
  return Array.from(m.entries()).map(([key, b]) => ({
    key,
    trades: b.trades,
    wins: b.wins,
    winRate: b.trades ? (b.wins / b.trades) * 100 : 0,
    net: Number(b.net.toFixed(2)),
  }));
}

/** Only rank buckets with enough trades to mean anything. */
function rank(buckets: Bucket[], minTrades: number) {
  const eligible = buckets.filter((b) => b.trades >= minTrades);
  const pool = eligible.length ? eligible : buckets;
  if (!pool.length) return { best: null, worst: null };
  const sorted = [...pool].sort((a, b) => b.net - a.net || b.winRate - a.winRate);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export function computeAnalytics(trades: Trade[], tzOffsetHours = 4): JournalAnalytics {
  const closed = trades.filter((t) => t.closeTime !== null);
  const source = closed.length ? closed : trades;

  const wins = source.filter((t) => t.net > 0);
  const losses = source.filter((t) => t.net <= 0);
  const grossWin = wins.reduce((a, t) => a + t.net, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.net, 0));
  const netPL = source.reduce((a, t) => a + t.net, 0);

  // Equity curve and peak-to-trough drawdown, in chronological order.
  const chrono = [...source].sort((a, b) => (a.closeTime ?? "").localeCompare(b.closeTime ?? ""));
  const equityCurve: number[] = [0];
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of chrono) {
    const v = equityCurve[equityCurve.length - 1] + t.net;
    equityCurve.push(Number(v.toFixed(2)));
    peak = Math.max(peak, v);
    maxDrawdown = Math.max(maxDrawdown, peak - v);
  }

  const shift = (iso: string | null, hours: number) =>
    iso ? new Date(Date.parse(iso) + hours * 3600_000) : null;

  const byPair = bucketise(source.map((t) => ({ key: t.symbol, net: t.net })))
    .sort((a, b) => b.trades - a.trades);

  const hourRows = (offset: number) =>
    source
      .map((t) => {
        const d = shift(t.closeTime, offset);
        return d ? { key: String(d.getUTCHours()).padStart(2, "0"), net: t.net } : null;
      })
      .filter((v): v is { key: string; net: number } => v !== null);

  const byHourUTC = bucketise(hourRows(0)).sort((a, b) => a.key.localeCompare(b.key));
  const byHourLocal = bucketise(hourRows(tzOffsetHours)).sort((a, b) => a.key.localeCompare(b.key));

  const byDay = bucketise(
    source
      .map((t) => {
        const d = shift(t.closeTime, tzOffsetHours);
        return d ? { key: DAYS[d.getUTCDay()], net: t.net } : null;
      })
      .filter((v): v is { key: string; net: number } => v !== null)
  ).sort((a, b) => DAYS.indexOf(a.key) - DAYS.indexOf(b.key));

  const bySession = bucketise(
    source
      .map((t) => {
        const d = shift(t.closeTime, 0);
        return d ? { key: sessionFor(d.getUTCHours()), net: t.net } : null;
      })
      .filter((v): v is { key: string; net: number } => v !== null)
  );

  const avgOf = (list: Trade[]) => {
    const withDur = list.filter((t) => t.durationMinutes !== null);
    if (!withDur.length) return null;
    return Math.round(withDur.reduce((a, t) => a + (t.durationMinutes ?? 0), 0) / withDur.length);
  };
  const avgWinnerMin = avgOf(wins);
  const avgLoserMin = avgOf(losses);

  /*
   * Revenge trading: three consecutive losers, then size jumps more than 50% on
   * the next trade. This is the single most reliable account-killer visible in a
   * statement, which is why it gets its own alert rather than a chart.
   */
  const occurrences: { at: string; from: number; to: number }[] = [];
  let streak = 0;
  for (let i = 0; i < chrono.length; i++) {
    const t = chrono[i];
    if (streak >= 3 && i > 0) {
      const prevLot = chrono[i - 1].lot;
      if (prevLot > 0 && t.lot > prevLot * 1.5) {
        occurrences.push({ at: t.closeTime ?? t.openTime ?? "", from: prevLot, to: t.lot });
      }
    }
    streak = t.net <= 0 ? streak + 1 : 0;
  }

  // Overtrading: more than 10 closes inside one clock hour.
  const perHourKey = new Map<string, number>();
  for (const t of source) {
    if (!t.closeTime) continue;
    const k = t.closeTime.slice(0, 13);
    perHourKey.set(k, (perHourKey.get(k) ?? 0) + 1);
  }
  let worstHour: string | null = null;
  let worstCount = 0;
  perHourKey.forEach((count, k) => {
    if (count > worstCount) {
      worstCount = count;
      worstHour = k;
    }
  });

  const pairRank = rank(byPair, 3);
  const hourRank = rank(byHourLocal, 3);
  const sessionRank = rank(bySession, 3);

  return {
    summary: {
      trades: source.length,
      wins: wins.length,
      losses: losses.length,
      winRate: source.length ? (wins.length / source.length) * 100 : 0,
      netPL: Number(netPL.toFixed(2)),
      grossWin: Number(grossWin.toFixed(2)),
      grossLoss: Number(grossLoss.toFixed(2)),
      profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : null,
      avgWin: wins.length ? Number((grossWin / wins.length).toFixed(2)) : 0,
      avgLoss: losses.length ? Number((grossLoss / losses.length).toFixed(2)) : 0,
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      expectancy: source.length ? Number((netPL / source.length).toFixed(2)) : 0,
      totalCosts: Number(source.reduce((a, t) => a + t.commission + t.swap, 0).toFixed(2)),
    },
    byPair,
    byHourUTC,
    byHourLocal,
    byDay,
    bySession,
    holdTime: { avgWinnerMin, avgLoserMin },
    equityCurve,
    patterns: {
      revenge: { detected: occurrences.length > 0, occurrences: occurrences.slice(0, 5) },
      overtrading: { detected: worstCount > 10, worstHour, count: worstCount },
      bestPair: pairRank.best,
      worstPair: pairRank.worst,
      bestHourLocal: hourRank.best,
      worstHourLocal: hourRank.worst,
      bestSession: sessionRank.best,
      worstSession: sessionRank.worst,
      holdsLosersLonger:
        avgWinnerMin !== null && avgLoserMin !== null && avgLoserMin > avgWinnerMin * 1.3,
    },
    brokers: Array.from(new Set(source.map((t) => t.broker).filter((b): b is string => !!b))),
    timezoneOffsetHours: tzOffsetHours,
  };
}

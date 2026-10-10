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

/**
 * A broker timestamp, as a UTC instant.
 *
 * Deliberately tolerant. These values come out of whatever a terminal wrote
 * into an HTML table or a spreadsheet cell, and the formats seen in the wild
 * include MT5's `2026.10.09 16:20:25`, MT4's `2026.10.09 16:20`, ISO with a T,
 * day-first `09/10/2026 16:20`, Excel's day count, and any of those padded with
 * non-breaking spaces or carrying a trailing timezone label.
 *
 * Treated as UTC rather than guessed at: these are broker-server times with no
 * zone attached, and inventing one would shift every session bucket.
 */
export function parseTradeTime(raw: string | undefined): string | null {
  if (raw === undefined || raw === null) return null;

  // Non-breaking spaces survive an HTML export and are not matched by a literal
  // space, which is one way a perfectly good timestamp reads as unparseable.
  const text = String(raw).replace(/[   ]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  /*
   * Excel stores a date as days since 1899-12-30, and an .xlsx cell carries that
   * number rather than the text the spreadsheet displays. Bounded to roughly
   * 1954-2064 so a ticket number that wandered into a time column is not read
   * as a date.
   */
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    return new Date(Math.round((serial - 25569) * 86400_000)).toISOString();
  }

  const utc = (y: number, mo: number, d: number, h = 0, mi = 0, sec = 0): string | null => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || sec > 59) return null;
    const t = Date.UTC(y, mo - 1, d, h, mi, sec);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };

  const TIME = String.raw`(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?`;

  // Year first: 2026.10.09, 2026-10-09, 2026/10/09. The common case, and
  // unambiguous, so it is tried before anything day-first.
  const ymd = text.match(new RegExp(String.raw`^(\d{4})[./-](\d{1,2})[./-](\d{1,2})${TIME}`));
  if (ymd) {
    const got = utc(+ymd[1], +ymd[2], +ymd[3], +(ymd[4] ?? 0), +(ymd[5] ?? 0), +(ymd[6] ?? 0));
    if (got) return got;
  }

  // Day first: 09.10.2026, 09/10/2026. Read as day-month because every terminal
  // that writes this order is configured European; a US month-first file would
  // be wrong for the first twelve days of a month either way, and there is
  // nothing in the cell to tell them apart.
  const dmy = text.match(new RegExp(String.raw`^(\d{1,2})[./-](\d{1,2})[./-](\d{4})${TIME}`));
  if (dmy) {
    const got = utc(+dmy[3], +dmy[2], +dmy[1], +(dmy[4] ?? 0), +(dmy[5] ?? 0), +(dmy[6] ?? 0));
    if (got) return got;
  }

  // Anything else the platform recognises, with the zone forced off when the
  // string carries none.
  const direct = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text.replace(" ", "T")}Z`);
  if (!Number.isNaN(direct)) return new Date(direct).toISOString();

  const loose = Date.parse(text);
  return Number.isNaN(loose) ? null : new Date(loose).toISOString();
}

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

/**
 * Every table title in the export.
 *
 * An MT5 report is several tables stacked in one document and the parser reads
 * only the first that has a symbol and a profit column. Listing the rest makes
 * it obvious when the realised history is sitting further down the same file.
 */
function sectionsIn(grid: string[][]): string[] {
  const found: string[] = [];
  for (const row of grid) {
    const filled = row.filter((x) => (x ?? "").trim() !== "");
    if (filled.length === 1 && SECTION_TITLE.test(filled[0].trim())) {
      const title = filled[0].trim();
      if (!found.includes(title)) found.push(title);
    }
  }
  return found;
}

/** Single-cell rows that start a new table inside one export. */
const SECTION_TITLE = /^(positions?|orders?|deals?|working orders|open trades|open positions|closed transactions)$/i;

/** Cash movements, which are not trades however much P/L the row carries. */
const BALANCE_OP = /balance|deposit|withdraw|credit|bonus|correction|charge|dividend|interest|rollover|transfer|adjustment|commission/i;

/**
 * A closed position, as opposed to a pending order or a cash movement.
 *
 * Exact match, not a prefix. "buy limit" and "sell stop" are pending orders and
 * were slipping through a plain /buy|sell/ test; a prefix test still let
 * "buy stop limit" style values through on brokers that word them differently.
 * Anything that is not plainly buy or sell is not a position.
 */
export function isPosition(rawType: string): boolean {
  const t = rawType.toLowerCase().trim();
  if (!t) return false;
  if (BALANCE_OP.test(t)) return false;
  return /^(buy|sell|long|short)$/.test(t);
}

/**
 * Does this look like something you can trade?
 *
 * A deposit row's symbol cell is empty, or carries the word "Deposit", and a
 * blank symbol used to normalise to UNKNOWN and get dropped — but a worded one
 * became the "instrument" DEPOSIT and was counted. Accepts normalised FX pairs
 * and plain tickers (US30, NAS100, XAUUSD, BTCUSD), rejects prose.
 */
export function isTradableSymbol(symbol: string): boolean {
  const s = (symbol || "").trim().toUpperCase();
  if (!s || s === "UNKNOWN") return false;
  if (BALANCE_OP.test(s)) return false;
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(s)) return true;
  return /^[A-Z0-9._#-]{2,14}$/.test(s);
}

/**
 * Rows -> trades. The one place column matching happens.
 *
 * Every supported export funnels through here as a string[][]: a CSV split on
 * its delimiter, the cells of an MT4 HTML report's table, or an MT5 .xlsx
 * worksheet. They differ only in how the grid is obtained, so the alias
 * matching, symbol normalisation and broker detection are shared rather than
 * reimplemented per format — which is how the HTML path drifted out of support
 * in the first place.
 */
/**
 * What the parser did, so a file that comes out wrong can be diagnosed from the
 * screen instead of from a console nobody has open. Surfaced in the panel.
 */
export interface ParseReport {
  rows: number;
  headerRow: number;
  headers: string[];
  mapped: string[];
  trades: number;
  skippedBalance: number;
  skippedPending: number;
  skippedSymbol: number;
  stoppedAt: number | null;
  /*
   * One row's worth of evidence from the first trade that parsed.
   *
   * A column mapping alone was not enough to find the last bug: openTime and
   * closeTime were both matched to a Time column, both looked right in the
   * mapping, and one of them still came back null. What the cell actually
   * contained is the missing half.
   *
   * `raw` is filled for the timestamp columns only. The money columns report
   * whether they parsed as a number and nothing else, so this stays safe to
   * paste to someone.
   */
  samples: { field: string; raw: string | null; ok: boolean }[];
  /** How many of the parsed trades actually carry a close time and costs. */
  withCloseTime: number;
  withCosts: number;
  /** Every table found in the export, so it is obvious what else is in there. */
  sections: string[];
}

export interface ParseResult { trades: Trade[]; report: ParseReport }

export function parseTradeRows(rows: string[][], fileName = ""): Trade[] {
  return parseStatementRows(rows, fileName).trades;
}

export function parseStatementRows(rows: string[][], fileName = ""): ParseResult {
  const empty = (rowCount: number): ParseResult => ({
    trades: [],
    report: { rows: rowCount, headerRow: -1, headers: [], mapped: [], trades: 0,
              skippedBalance: 0, skippedPending: 0, skippedSymbol: 0, stoppedAt: null, samples: [],
              withCloseTime: 0, withCosts: 0, sections: [] },
  });

  const grid = rows.filter((r) => r.some((c) => (c ?? "").trim() !== ""));
  if (grid.length < 2) return empty(grid.length);

  /*
   * The header is the first row with a recognisable symbol and profit column.
   * Scanned deep: an MT5 report puts the account name, broker, period and a
   * blank run above the positions table, so the header can be twenty rows down.
   */
  let headerIdx = 0;
  for (let i = 0; i < Math.min(grid.length, 40); i++) {
    const cells = grid[i].map((c) => (c ?? "").toLowerCase());
    if (cells.some((c) => /symbol|item|instrument/.test(c)) && cells.some((c) => /profit|p\/l|pnl/.test(c))) {
      headerIdx = i;
      break;
    }
  }

  const map = mapHeaders(grid[headerIdx]);
  if (map.symbol === undefined || map.profit === undefined) return empty(grid.length);

  /*
   * The header must be at least as wide as the rows beneath it.
   *
   * This is the failure a real MT5 report hit. Its header row carried fewer
   * cells than its data rows, so every index past the gap addressed the wrong
   * column: profit read the commission cell, commission read a timestamp, swap
   * read the closing price. net became profit + a price, so all 343 rows came
   * out positive, the win rate read 100%, and the average "win" was $4,268 —
   * the price of gold.
   *
   * Nothing can recover the alignment from here, because which column the gap
   * belongs to is unknowable. Refusing and naming both widths is the only
   * truthful option; guessing produces exactly the numbers above.
   *
   * The modal width is used rather than the maximum, so one wide summary row
   * (they are written with colspan) does not condemn the file.
   */
  const widths = new Map<number, number>();
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const w = grid[i].length;
    if (w < 3) continue;
    widths.set(w, (widths.get(w) ?? 0) + 1);
  }
  let modalWidth = 0;
  let modalCount = 0;
  widths.forEach((count, w) => { if (count > modalCount) { modalCount = count; modalWidth = w; } });

  const headerWidth = grid[headerIdx].length;
  if (modalWidth > headerWidth) {
    const headerCells = grid[headerIdx].map((h) => (h ?? "").trim());
    return {
      trades: [],
      report: {
        rows: grid.length, headerRow: headerIdx, headers: headerCells,
        mapped: [`header has ${headerWidth} columns, the ${modalCount} rows below have ${modalWidth} — columns cannot be matched`],
        trades: 0, skippedBalance: 0, skippedPending: 0, skippedSymbol: 0, stoppedAt: null, samples: [],
        withCloseTime: 0, withCosts: 0, sections: sectionsIn(grid),
      },
    };
  }

  /*
   * No two money fields may read the same column.
   *
   * This is the check that was missing when a real MT5 report produced 343
   * "trades" at a 100% win rate: commission and swap had landed on the two Price
   * columns, so net = profit + commission + swap summed the price of gold and
   * every row came out positive. Costs paid read $1,463,963.83 — the same figure
   * as the net — which is the signature of it.
   *
   * A collision means the header did not line up with the data, and the honest
   * response is to drop the field rather than add a price to a P/L. profit is
   * the one field that cannot be dropped, so a collision there fails the parse
   * and the report says which column it landed on.
   */
  const positional = new Set(
    [map.openPrice, map.closePrice, map.openTime, map.closeTime, map.lot, map.ticket]
      .filter((i): i is number => i !== undefined)
  );
  /*
   * profit belongs in this set too.
   *
   * The first version of this guard compared commission and swap only against
   * the price and time columns, so a swap that resolved to the *profit* column
   * went straight through. On a real VT Markets report that is what happened —
   * profit=Profit[11] and swap=Swap[11], the same index — which made
   * net = profit + commission + profit and costs = commission + profit. The
   * account read 3,550 wins out of 3,550 with $0.00 of costs.
   *
   * The three money fields must be three different columns. A duplicate is
   * dropped rather than added to itself.
   */
  const taken = new Set(positional);
  taken.add(map.profit);
  for (const field of ["commission", "swap"] as const) {
    if (map[field] !== undefined && taken.has(map[field])) delete map[field];
    else if (map[field] !== undefined) taken.add(map[field]);
  }
  if (positional.has(map.profit)) {
    const headerCells = grid[headerIdx].map((h) => (h ?? "").trim());
    return {
      trades: [],
      report: {
        rows: grid.length, headerRow: headerIdx, headers: headerCells,
        mapped: [`profit=${headerCells[map.profit] ?? "?"}[${map.profit}] — collides with a price or time column`],
        trades: 0, skippedBalance: 0, skippedPending: 0, skippedSymbol: 0, stoppedAt: null, samples: [],
        withCloseTime: 0, withCosts: 0, sections: sectionsIn(grid),
      },
    };
  }

  // Separators in exported filenames are usually hyphens or underscores.
  const SEP = "[\\s\\-_.]*";
  const brokerFromFile =
    /vantage/i.test(fileName) ? "Vantage" :
    new RegExp(`vt${SEP}market`, "i").test(fileName) ? "VT Markets" :
    new RegExp(`pu${SEP}prime`, "i").test(fileName) ? "PUPRIME" : null;

  const out: Trade[] = [];
  let skippedBalance = 0;
  let skippedPending = 0;
  let skippedSymbol = 0;
  let stoppedAt: number | null = null;
  let samples: ParseReport["samples"] = [];

  for (let i = headerIdx + 1; i < grid.length; i++) {
    const c = grid[i];
    if (c.length < 3) continue;

    /*
     * Stop at the next section.
     *
     * An MT5 report is three tables in one sheet — Positions, then Orders, then
     * Deals — and MT4 statements append Working Orders. Reading straight through
     * them counted a pending order as a trade, and would have counted every
     * position twice over, since each one appears again as two deals. Measured
     * on a generated MT5 report: 5 positions came back as 6 trades.
     */
    const filled = c.filter((x) => (x ?? "").trim() !== "");
    if (filled.length === 1 && SECTION_TITLE.test(filled[0].trim())) { stoppedAt = i; break; }
    const lower = c.map((x) => (x ?? "").toLowerCase().trim());
    // A second header row means a second table.
    if (lower.some((x) => x === "symbol" || x === "item" || x === "instrument")) { stoppedAt = i; break; }

    const rawType = (c[map.type ?? -1] ?? "").toLowerCase().trim();
    if (!isPosition(rawType)) {
      if (BALANCE_OP.test(rawType)) skippedBalance++;
      else if (rawType) skippedPending++;
      continue;
    }

    const symbol = normaliseSymbol(c[map.symbol]);
    if (!isTradableSymbol(symbol)) { skippedSymbol++; continue; }

    const openTime = parseTradeTime(c[map.openTime ?? -1]);
    const closeTime = parseTradeTime(c[map.closeTime ?? -1]);
    const profit = num(c[map.profit]);
    const commission = num(c[map.commission ?? -1]);
    const swap = num(c[map.swap ?? -1]);

    /*
     * Hold time, or nothing.
     *
     * A reported average winner of 1,170,000,009 minutes — 2,225 years — came
     * from one timestamp failing to parse, landing on the 1970 epoch, and being
     * subtracted from a 2026 close. A duration that long is not a hold time, so
     * anything beyond a year is treated as unparseable rather than averaged in.
     */
    const MAX_HOLD_MIN = 365 * 24 * 60;
    const rawDuration =
      openTime && closeTime
        ? Math.round((Date.parse(closeTime) - Date.parse(openTime)) / 60000)
        : null;
    const duration =
      rawDuration === null || rawDuration < 0 || rawDuration > MAX_HOLD_MIN ? null : rawDuration;

    if (!samples.length) {
      const cell = (i: number | undefined) => (i === undefined ? undefined : c[i]);
      const timeField = (field: "openTime" | "closeTime", parsed: string | null) => ({
        field,
        // Shown, because this is the value that has to be read to fix a format.
        raw: (cell(map[field]) ?? "").slice(0, 32) || "(empty)",
        ok: parsed !== null,
      });
      const moneyField = (field: "profit" | "commission" | "swap" | "lot") => {
        const v = cell(map[field]);
        return {
          field,
          // Not disclosed — only whether a number could be read from it.
          raw: v === undefined ? "(no such column)" : null,
          ok: v !== undefined && v.trim() !== "" && Number.isFinite(Number(v.replace(/[^0-9.\-+]/g, ""))),
        };
      };
      samples = [
        timeField("openTime", openTime),
        timeField("closeTime", closeTime),
        moneyField("profit"), moneyField("commission"), moneyField("swap"), moneyField("lot"),
      ];
    }

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

  const headers = grid[headerIdx].map((h) => (h ?? "").trim());
  return {
    trades: out,
    report: {
      rows: grid.length,
      headerRow: headerIdx,
      headers,
      // Which column each field was read from, which is the first thing to look
      // at when the numbers are wrong.
      mapped: Object.entries(map).map(([field, idx]) => `${field}=${headers[idx] ?? "?"}[${idx}]`),
      trades: out.length,
      skippedBalance,
      skippedPending,
      skippedSymbol,
      stoppedAt,
      samples,
      // Zero close times across every row is the signature of a table of open
      // positions, where Profit is floating rather than realised.
      withCloseTime: out.filter((t) => t.closeTime !== null).length,
      withCosts: out.filter((t) => t.commission !== 0 || t.swap !== 0).length,
      sections: sectionsIn(grid),
    },
  };
}

/** Delimited text -> grid. */
export function csvToRows(text: string): string[][] {
  if (!text || !text.trim()) return [];
  const delim = detectDelimiter(text);
  return text.split(/\r?\n/).filter((r) => r.trim().length > 0).map((r) => splitRow(r, delim));
}

export function parseTradesCSV(text: string, fileName = ""): Trade[] {
  return parseTradeRows(csvToRows(text), fileName);
}

/* ------------------------------------------------------------------- HTML */

/**
 * An MT4/MT5 HTML report's table cells, as rows.
 *
 * Scanned with regular expressions rather than DOMParser so the same code runs
 * under Node for the tests and on the server if it is ever needed. These reports
 * are machine-generated tables with no nesting to speak of, which is the only
 * reason that is safe here — this is not a general HTML parser.
 */
export function parseTradesHTML(html: string, fileName = ""): Trade[] {
  return parseTradeRows(htmlToRows(html), fileName);
}

export function htmlToRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;

  while ((row = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = cellRe.exec(row[1])) !== null) {
      /*
       * colspan is why a real MT5 report parsed into nonsense.
       *
       * These reports group header cells — <td colspan=2> and friends — so a
       * header row of 13 visible columns is fewer <td> elements than the data
       * rows beneath it. Ignoring the attribute shifted every column left of the
       * gap: commission and swap landed on the two Price columns, profit landed
       * on a column of blanks, and the result was 343 "trades" at a 100% win
       * rate whose average win was $4,268 — the price of gold, summed.
       */
      const span = Math.min(40, Math.max(1, Number(cell[1].match(/\bcolspan\s*=\s*"?(\d+)/i)?.[1] ?? 1)));
      const value =
        cell[2]
          // <br> inside a cell is a line break, not a word join.
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&quot;/gi, '"')
          .replace(/\s+/g, " ")
          .trim();
      cells.push(value);
      // The spanned columns still exist in the grid; they are just empty.
      for (let k = 1; k < span; k++) cells.push("");
    }
    if (cells.length) rows.push(cells);
  }

  return rows;
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
  /*
   * With one instrument there is no worst one. Returning the same bucket as both
   * printed "best XAU/USD +$X" above "worst XAU/USD +$X", which reads as a
   * finding when it is only a statement that gold is all they trade.
   */
  return { best: sorted[0], worst: sorted.length > 1 ? sorted[sorted.length - 1] : null };
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

  /*
   * When a close time is missing, bucket by the open time instead of dropping
   * the trade. A statement whose close column does not parse used to leave the
   * session and hour charts completely blank, which looks like "you have never
   * traded" rather than "one column could not be read".
   */
  const when = (t: Trade) => t.closeTime ?? t.openTime;

  const byPair = bucketise(source.map((t) => ({ key: t.symbol, net: t.net })))
    .sort((a, b) => b.trades - a.trades);

  const hourRows = (offset: number) =>
    source
      .map((t) => {
        const d = shift(when(t), offset);
        return d ? { key: String(d.getUTCHours()).padStart(2, "0"), net: t.net } : null;
      })
      .filter((v): v is { key: string; net: number } => v !== null);

  const byHourUTC = bucketise(hourRows(0)).sort((a, b) => a.key.localeCompare(b.key));
  const byHourLocal = bucketise(hourRows(tzOffsetHours)).sort((a, b) => a.key.localeCompare(b.key));

  const byDay = bucketise(
    source
      .map((t) => {
        const d = shift(when(t), tzOffsetHours);
        return d ? { key: DAYS[d.getUTCDay()], net: t.net } : null;
      })
      .filter((v): v is { key: string; net: number } => v !== null)
  ).sort((a, b) => DAYS.indexOf(a.key) - DAYS.indexOf(b.key));

  const bySession = bucketise(
    source
      .map((t) => {
        const d = shift(when(t), 0);
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

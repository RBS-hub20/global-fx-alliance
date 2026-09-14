/**
 * PNL Calendar logic. Pure — no fetching, no DOM, no reading the clock except
 * through the `now` arguments — so it runs in tests exactly as in the panel.
 *
 * Days and hours are Dubai (UTC+4, no daylight saving), the same convention
 * Journal Analytics uses, so a trade lands on the same day and the same hour in
 * both places.
 */

export const DUBAI_OFFSET_H = 4;

export type CalView = "week" | "month" | "year" | "all";
export type Source = "vps" | "import" | "manual";

/** One row of the pnl_calendar view. */
export interface CalRow {
  day: string;               // YYYY-MM-DD, Dubai
  vt_account_id: string | null;
  daily_pnl: number | string;
  trades: number | string;
  wins: number | string;
  losses: number | string;
  sources: string | null;
}

export interface DayCell {
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  sources: Source[];
}

/* ------------------------------------------------------------------ dates */

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar date in Dubai for an instant. */
export function dubaiDate(at: string | Date): string {
  const d = new Date(new Date(at).getTime() + DUBAI_OFFSET_H * 3_600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Hour in Dubai as "04" — the same key Journal Analytics buckets on. */
export function dubaiHourKey(at: string | Date): string {
  const d = new Date(new Date(at).getTime() + DUBAI_OFFSET_H * 3_600_000);
  return pad(d.getUTCHours());
}

/** Parse YYYY-MM-DD as a date-only value, anchored at UTC noon so no zone can move it a day. */
function ymd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function addDays(day: string, n: number): string {
  const d = ymd(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayMon0(day: string): number {
  return (ymd(day).getUTCDay() + 6) % 7;
}

export const isWeekend = (day: string) => weekdayMon0(day) >= 5;

/** Midnight at the start of a Dubai day, as an ISO instant, for range queries on raw rows. */
export function dubaiDayStartIso(day: string): string {
  return new Date(`${day}T00:00:00+0${DUBAI_OFFSET_H}:00`).toISOString();
}

/** Inclusive range covered by a view. `all` has no bounds. */
export function periodRange(view: CalView, anchor: string): { from: string; to: string } | null {
  const d = ymd(anchor);
  if (view === "all") return null;
  if (view === "week") {
    const from = addDays(anchor, -weekdayMon0(anchor));
    return { from, to: addDays(from, 6) };
  }
  if (view === "month") {
    const from = fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)));
    const to = fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
    return { from, to };
  }
  return { from: `${d.getUTCFullYear()}-01-01`, to: `${d.getUTCFullYear()}-12-31` };
}

/** Move the anchor one unit of the view. Month stepping clamps to the 1st so 31 Jan -> Feb works. */
export function shiftAnchor(view: CalView, anchor: string, dir: -1 | 1): string {
  const d = ymd(anchor);
  if (view === "week") return addDays(anchor, 7 * dir);
  if (view === "month") return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1, 12)));
  if (view === "year") return fmt(new Date(Date.UTC(d.getUTCFullYear() + dir, 0, 1, 12)));
  return anchor;
}

export function periodLabel(view: CalView, anchor: string): string {
  const d = ymd(anchor);
  if (view === "all") return "All time";
  if (view === "year") return String(d.getUTCFullYear());
  if (view === "month") return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const r = periodRange("week", anchor)!;
  const a = ymd(r.from), b = ymd(r.to);
  const opts = { month: "short", day: "numeric", timeZone: "UTC" } as const;
  return `${a.toLocaleDateString("en-US", opts)} – ${b.toLocaleDateString("en-US", opts)}, ${b.getUTCFullYear()}`;
}

/**
 * Month as weeks of cells, Monday first. `null` pads the first and last week
 * so days sit under the right column. Weekend columns are dropped entirely when
 * hidden rather than rendered empty.
 */
export function monthGrid(anchor: string, weekends: boolean): (string | null)[][] {
  const { from, to } = periodRange("month", anchor)!;
  const cols = weekends ? 7 : 5;
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array(cols).fill(null);
  let touched = false;

  for (let day = from; day <= to; day = addDays(day, 1)) {
    const wd = weekdayMon0(day);
    if (wd === 0 && touched) { weeks.push(week); week = Array(cols).fill(null); touched = false; }
    if (wd < cols) { week[wd] = day; touched = true; }
  }
  if (touched) weeks.push(week);
  return weeks;
}

export function weekCells(anchor: string, weekends: boolean): string[] {
  const { from } = periodRange("week", anchor)!;
  return Array.from({ length: weekends ? 7 : 5 }, (_, i) => addDays(from, i));
}

/* ------------------------------------------------------------ aggregation */

/**
 * Collapse view rows into one cell per day for the chosen account.
 *
 * The view groups by account as well as day, so "All accounts" has to sum
 * across them here. Rows imported without an account only appear under All —
 * attributing them to whichever account happens to be selected would move
 * money between accounts on screen.
 */
export function aggregateDays(rows: CalRow[], accountId: string | null): Map<string, DayCell> {
  const out = new Map<string, DayCell>();
  for (const r of rows) {
    if (accountId !== null && r.vt_account_id !== accountId) continue;
    const cell = out.get(r.day) ?? { pnl: 0, trades: 0, wins: 0, losses: 0, sources: [] };
    cell.pnl = Math.round((cell.pnl + Number(r.daily_pnl)) * 100) / 100;
    cell.trades += Number(r.trades);
    cell.wins += Number(r.wins);
    cell.losses += Number(r.losses);
    for (const s of (r.sources ?? "").split(",").filter(Boolean) as Source[]) {
      if (!cell.sources.includes(s)) cell.sources.push(s);
    }
    cell.sources.sort();
    out.set(r.day, cell);
  }
  return out;
}

export interface PeriodSummary {
  total: number;
  trades: number;
  tradingDays: number;
  winDays: number;
  lossDays: number;
  flatDays: number;
  /** Days with trades that fall on a weekend — reported so hiding weekends never hides money. */
  weekendDays: number;
  weekendPnl: number;
}

/** Totals over an inclusive range, or over everything when range is null. */
export function summarise(days: Map<string, DayCell>, range: { from: string; to: string } | null): PeriodSummary {
  const s: PeriodSummary = { total: 0, trades: 0, tradingDays: 0, winDays: 0, lossDays: 0, flatDays: 0, weekendDays: 0, weekendPnl: 0 };
  for (const [day, c] of Array.from(days)) {
    if (range && (day < range.from || day > range.to)) continue;
    s.total += c.pnl;
    s.trades += c.trades;
    s.tradingDays++;
    if (c.pnl > 0) s.winDays++; else if (c.pnl < 0) s.lossDays++; else s.flatDays++;
    if (isWeekend(day)) { s.weekendDays++; s.weekendPnl += c.pnl; }
  }
  s.total = Math.round(s.total * 100) / 100;
  s.weekendPnl = Math.round(s.weekendPnl * 100) / 100;
  return s;
}

export interface MonthCard {
  key: string;   // YYYY-MM
  label: string; // "Sep 2026"
  summary: PeriodSummary;
}

/** Month cards for the year and all-time views. Year: all twelve. All: only months with trades, newest first. */
export function monthCards(days: Map<string, DayCell>, view: "year" | "all", anchor: string): MonthCard[] {
  const keys = view === "year"
    ? Array.from({ length: 12 }, (_, i) => `${anchor.slice(0, 4)}-${pad(i + 1)}`)
    : Array.from(new Set(Array.from(days.keys()).map((d) => d.slice(0, 7)))).sort().reverse();

  return keys.map((key) => {
    const range = periodRange("month", `${key}-01`)!;
    return {
      key,
      label: ymd(`${key}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      summary: summarise(days, range),
    };
  });
}

export function goalProgress(total: number, goal: number | null): number | null {
  if (!goal || goal <= 0) return null;
  return Math.max(0, Math.min(100, (total / goal) * 100));
}

/* -------------------------------------------------------------- worst hour */

/** Same shape as journalParser's Bucket, so it formats identically. */
export interface HourBucket { key: string; trades: number; wins: number; winRate: number; net: number }

/**
 * Worst Dubai hour, ranked exactly as Journal Analytics ranks it: at least 3
 * trades in the hour if any hour has that many, then lowest net, then lowest
 * win rate. Diverging here would let the calendar and the analytics strip name
 * two different "worst hours" from the same trades.
 *
 * Manual trades are excluded. They are stamped at midday because a typed-in
 * trade has no real time, and counting them would make 12:00 look busy.
 */
export function worstHour(trades: { at: string | null; pnl: number; source: Source }[]): HourBucket | null {
  const m = new Map<string, { trades: number; wins: number; net: number }>();
  for (const t of trades) {
    if (!t.at || t.source === "manual") continue;
    const key = dubaiHourKey(t.at);
    const b = m.get(key) ?? { trades: 0, wins: 0, net: 0 };
    b.trades++;
    if (t.pnl > 0) b.wins++;
    b.net += t.pnl;
    m.set(key, b);
  }
  const buckets: HourBucket[] = Array.from(m, ([key, b]) => ({
    key, trades: b.trades, wins: b.wins,
    winRate: b.trades ? (b.wins / b.trades) * 100 : 0,
    net: Number(b.net.toFixed(2)),
  }));
  const eligible = buckets.filter((b) => b.trades >= 3);
  const pool = eligible.length ? eligible : buckets;
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => b.net - a.net || b.winRate - a.winRate);
  return sorted[sorted.length - 1];
}

/** "14:00" and "38% over 13 trades". Shared with the Journal Analytics strip. */
export function formatHourBucket(b: HourBucket | null | undefined): { label: string; sub: string } {
  if (!b) return { label: "—", sub: "not enough trades" };
  return {
    label: `${String(b.key).padStart(2, "0")}:00`,
    sub: `${b.winRate.toFixed(0)}% over ${b.trades} trade${b.trades === 1 ? "" : "s"}`,
  };
}

/* ----------------------------------------------------------------- display */

export function signed(n: number): string {
  const v = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${v}`;
}

/**
 * Short form for narrow day cells. A phone gives each weekday column about 45px,
 * where "+116.74" is truncated to "+1…" — which hides the one number the cell is
 * for. Under 100 keeps cents; 100 and up drops them; thousands go to "k".
 */
export function compactSigned(n: number): string {
  const a = Math.abs(n);
  const body = a >= 1000 ? `${(a / 1000).toFixed(a >= 10_000 ? 0 : 1)}k` : a >= 100 ? a.toFixed(0) : a.toFixed(2);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${body}`;
}

export function money(n: number): string {
  const v = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${v}`;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Upload, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  aggregateDays, dubaiDate, dubaiDayStartIso, dubaiHourKey, formatHourBucket, goalProgress,
  addDays, monthCards, monthGrid, money, periodLabel, periodRange, shiftAnchor, signed,
  summarise, weekCells, worstHour, compactSigned,
  type CalRow, type CalView, type DayCell, type Source,
} from "@/lib/pnlCalendar";

/**
 * PNL Calendar — realised P&L per Dubai day.
 *
 * Reads the pnl_calendar view (security_invoker, so RLS scopes it to the
 * member) and never writes execution_logs directly: imports and manual trades
 * go through API routes that force `source`. Preferences — goal, weekends,
 * blocked hours — are the member's own table and are written directly.
 *
 * Nothing is seeded. An empty account renders an empty calendar and says why.
 */

const CARD = "rounded-lg border border-[#262626] bg-[#141414]";
const WIN = "#00ff88";
const LOSS = "#ff4d4d";
const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const VIEWS: { v: CalView; label: string }[] = [
  { v: "week", label: "Week" }, { v: "month", label: "Month" }, { v: "year", label: "Year" }, { v: "all", label: "All time" },
];

interface Account { id: string; account_number: string; server: string }
interface Prefs { monthly_goal: number | null; show_weekends: boolean; blocked_hours: number[]; default_account_id: string | null }
interface TradeRow {
  id: string; symbol: string; action: string | null; lot: number; pnl: number; source: Source;
  closed_at: string | null; executed_at: string | null; notes: string | null; vt_account_id: string | null;
}

const DEFAULT_PREFS: Prefs = { monthly_goal: null, show_weekends: false, blocked_hours: [], default_account_id: null };

function setupMessage(msg: string): string {
  return /does not exist|could not find/i.test(msg)
    ? "PNL tables not installed — run supabase/20250517_pnl_calendar.sql."
    : msg;
}

export function PnlCalendar({ accounts }: { accounts: Account[] }) {
  const { session } = useAuth();
  const supabase = supabaseBrowser();
  const today = dubaiDate(new Date());

  const [view, setView] = useState<CalView>("month");
  const [anchor, setAnchor] = useState(today);
  const [rows, setRows] = useState<CalRow[] | null>(null);
  const [periodTrades, setPeriodTrades] = useState<TradeRow[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const range = periodRange(view, anchor);

  /* ---------------------------------------------------------------- data */

  const loadRows = useCallback(async () => {
    if (!supabase || !session) return;
    const { data, error: e } = await supabase.from("pnl_calendar").select("*").order("day", { ascending: true }).limit(5000);
    if (e) { setError(setupMessage(e.message)); setRows([]); return; }
    setError(null);
    setRows((data ?? []) as CalRow[]);
  }, [supabase, session]);

  /*
   * Raw closed trades for the visible period — only what the worst-hour ranking
   * and the day modal need. The grid itself comes from the view.
   */
  const loadPeriodTrades = useCallback(async () => {
    if (!supabase || !session) return;
    let q = supabase
      .from("execution_logs")
      .select("id, symbol, action, lot, pnl, source, closed_at, executed_at, notes, vt_account_id")
      .in("status", ["EXECUTED", "MANUAL"])
      .not("pnl", "is", null)
      .order("closed_at", { ascending: true })
      .limit(5000);
    if (range) q = q.gte("closed_at", dubaiDayStartIso(range.from)).lt("closed_at", dubaiDayStartIso(addDays(range.to, 1)));
    const { data } = await q;
    setPeriodTrades(((data ?? []) as TradeRow[]).map((t) => ({ ...t, pnl: Number(t.pnl), lot: Number(t.lot) })));
  }, [supabase, session, range?.from, range?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPrefs = useCallback(async () => {
    if (!supabase || !session) return;
    const { data } = await supabase.from("member_trading_prefs").select("*").eq("user_id", session.user.id).maybeSingle();
    if (data) {
      const p: Prefs = {
        monthly_goal: data.monthly_goal === null ? null : Number(data.monthly_goal),
        show_weekends: !!data.show_weekends,
        blocked_hours: (data.blocked_hours ?? []).map(Number),
        default_account_id: data.default_account_id ?? null,
      };
      setPrefs(p);
      setAccountId(p.default_account_id);
    }
  }, [supabase, session]);

  const savePrefs = async (patch: Partial<Prefs>) => {
    if (!supabase || !session) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { error: e } = await supabase
      .from("member_trading_prefs")
      .upsert({ user_id: session.user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (e) setNotice(setupMessage(e.message));
  };

  useEffect(() => { void loadRows(); void loadPrefs(); }, [loadRows, loadPrefs]);
  useEffect(() => { void loadPeriodTrades(); }, [loadPeriodTrades]);

  // A fill from the bridge or an import on another device updates this without a reload.
  useEffect(() => {
    if (!supabase || !session) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`gfxa-pnl-${session.user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "execution_logs", filter: `user_id=eq.${session.user.id}` },
        () => {
          // An import lands hundreds of rows; one refetch after they settle, not one each.
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => { void loadRows(); void loadPeriodTrades(); }, 800);
        })
      .subscribe();
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [supabase, session, loadRows, loadPeriodTrades]);

  /* ------------------------------------------------------------- derived */

  const days = useMemo(() => aggregateDays(rows ?? [], accountId), [rows, accountId]);
  const summary = useMemo(() => summarise(days, range), [days, range?.from, range?.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthTotal = useMemo(() => summarise(days, periodRange("month", anchor)).total, [days, anchor]);
  const progress = goalProgress(monthTotal, prefs.monthly_goal);

  const scopedTrades = useMemo(
    () => periodTrades.filter((t) => accountId === null || t.vt_account_id === accountId),
    [periodTrades, accountId]
  );
  const worst = useMemo(
    () => worstHour(scopedTrades.map((t) => ({ at: t.closed_at, pnl: t.pnl, source: t.source }))),
    [scopedTrades]
  );

  /* ------------------------------------------------------------- actions */

  const onImport = async (file: File) => {
    setImporting(true);
    setNotice(null);
    const form = new FormData();
    form.append("file", file);
    if (accountId) form.append("vt_account_id", accountId);
    const res = await fetch("/api/journal/import", { method: "POST", body: form });
    const j = await res.json().catch(() => null);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok || !j?.ok) { setNotice(j?.message ?? "Import failed."); return; }
    setNotice(
      `${j.inserted} trade${j.inserted === 1 ? "" : "s"} imported to your account` +
      (j.duplicates ? ` · ${j.duplicates} already there` : "") +
      (j.skippedOpen ? ` · ${j.skippedOpen} open position${j.skippedOpen === 1 ? "" : "s"} skipped` : "")
    );
    // Jump to the month the statement ends in, so the import is visible at once.
    if (j.range?.to) { setView("month"); setAnchor(dubaiDate(j.range.to)); }
    void loadRows(); void loadPeriodTrades();
  };

  if (!session) return null;

  const loaded = rows !== null;
  const empty = loaded && !error && rows!.length === 0;
  const weekends = prefs.show_weekends;

  return (
    <div className={CARD}>
      {/* ------------------------------------------------------------ header */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#262626] px-4 py-2.5">
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
          <span className="text-[#00ff88]/50">_&gt;</span> PNL CALENDAR
        </h3>

        <div className="flex items-center gap-1">
          <button type="button" disabled={view === "all"} onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}
            aria-label="Previous" className="rounded border border-[#262626] p-1 text-[#a3a3a3] hover:text-[#e5e5e5] disabled:opacity-30">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[120px] text-center font-mono text-[12px] text-[#e5e5e5]">{periodLabel(view, anchor)}</span>
          <button type="button" disabled={view === "all"} onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}
            aria-label="Next" className="rounded border border-[#262626] p-1 text-[#a3a3a3] hover:text-[#e5e5e5] disabled:opacity-30">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {anchor !== today && view !== "all" ? (
            <button type="button" onClick={() => setAnchor(today)}
              className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#525252] hover:text-[#00ff88]">today</button>
          ) : null}
        </div>

        <div className="flex gap-1" role="tablist" aria-label="Calendar range">
          {VIEWS.map(({ v, label }) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`rounded px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] transition-colors ${
                view === v ? "bg-[#00ff88] text-[#0a0a0a]" : "border border-[#262626] text-[#a3a3a3] hover:text-[#e5e5e5]"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 sm:ml-auto">
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={importing}
            className="inline-flex items-center gap-1.5 rounded border border-[#00ff88] bg-[#141414] px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#00ff88] transition-colors hover:bg-[#00ff88]/10 disabled:opacity-40">
            {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            _&gt; Import statement
          </button>
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded border border-[#00ff88] bg-[#141414] px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#00ff88] transition-colors hover:bg-[#00ff88]/10">
            <Plus className="h-3 w-3" /> Add trade
          </button>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {error ? (
          <p className="rounded border border-[#ff4d4d]/40 bg-[#ff4d4d]/10 px-3 py-2 font-mono text-[11px] text-[#ff4d4d]">{error}</p>
        ) : null}
        {notice ? (
          <p className="flex items-start gap-2 rounded border border-[#262626] bg-[#0a0a0a] px-3 py-2 font-mono text-[11px] text-[#e5e5e5]">
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-[#525252] hover:text-[#e5e5e5]">
              <X className="h-3 w-3" />
            </button>
          </p>
        ) : null}

        {/* ---------------------------------------------------------- top cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]">Total P&amp;L · {periodLabel(view, anchor)}</p>
            <p className="num-mono mt-1 text-[24px] font-bold leading-none" style={{ color: !loaded ? "#525252" : summary.total < 0 ? LOSS : WIN }}>
              {loaded ? money(summary.total) : "—"}
            </p>
            <p className="mt-1.5 font-mono text-[10.5px] text-[#a3a3a3]">
              {summary.tradingDays} trading day{summary.tradingDays === 1 ? "" : "s"} · {summary.winDays}W-{summary.lossDays}L
              {summary.flatDays ? ` · ${summary.flatDays} flat` : ""}
            </p>
          </div>

          <GoalCard total={monthTotal} goal={prefs.monthly_goal} progress={progress} month={periodLabel("month", anchor)}
            onSave={(g) => void savePrefs({ monthly_goal: g })} />

          <label className="rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]">Weekends</span>
            <select value={weekends ? "on" : "off"} onChange={(e) => void savePrefs({ show_weekends: e.target.value === "on" })}
              className="mt-1.5 block w-full rounded border border-[#262626] bg-[#141414] px-2 py-1.5 font-mono text-[12px] text-[#e5e5e5] outline-none focus:border-[#00ff88]/50">
              <option value="off">OFF</option>
              <option value="on">ON</option>
            </select>
          </label>

          <label className="rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]">Account</span>
            <select value={accountId ?? ""}
              onChange={(e) => { const v = e.target.value || null; setAccountId(v); void savePrefs({ default_account_id: v }); }}
              className="mt-1.5 block w-full rounded border border-[#262626] bg-[#141414] px-2 py-1.5 font-mono text-[12px] text-[#e5e5e5] outline-none focus:border-[#00ff88]/50">
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>#{a.account_number} · {a.server.replace("VTMarkets-", "")}</option>
              ))}
            </select>
          </label>
        </div>

        {!weekends && summary.weekendDays > 0 ? (
          <p className="font-mono text-[10.5px] text-[#a3a3a3]">
            Total includes {summary.weekendDays} weekend day{summary.weekendDays === 1 ? "" : "s"} ({signed(summary.weekendPnl)}) — hidden while weekends are off.
          </p>
        ) : null}

        {/* --------------------------------------------------------------- body */}
        {!loaded ? (
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 20 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded bg-[#0a0a0a]" />)}
          </div>
        ) : empty ? (
          <p className="rounded-lg border border-[#262626] bg-[#0a0a0a] px-4 py-6 text-center font-mono text-[11.5px] leading-relaxed text-[#a3a3a3]">
            No trades yet — bot in YELLOW waiting for GREEN, or import a statement.
          </p>
        ) : view === "year" || view === "all" ? (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {monthCards(days, view, anchor).map((c) => (
              <button key={c.key} type="button" onClick={() => { setView("month"); setAnchor(`${c.key}-01`); }}
                className="rounded border border-[#262626] bg-[#141414] px-3 py-2.5 text-left transition-colors hover:border-[#00ff88]/40"
                style={{ borderLeftWidth: 2, borderLeftColor: c.summary.tradingDays === 0 ? "#262626" : c.summary.total < 0 ? LOSS : c.summary.total > 0 ? WIN : "#525252" }}>
                <p className="font-mono text-[10.5px] text-[#a3a3a3]">{c.label}</p>
                <p className="num-mono mt-1 text-[14px] font-bold"
                  style={{ color: c.summary.tradingDays === 0 ? "#262626" : c.summary.total < 0 ? LOSS : WIN }}>
                  {c.summary.tradingDays === 0 ? "— — —" : signed(c.summary.total)}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-[#525252]">
                  {c.summary.tradingDays ? `${c.summary.tradingDays}d · ${c.summary.winDays}W-${c.summary.lossDays}L` : "no trades"}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <div className={`grid gap-1.5 ${weekends ? "grid-cols-7" : "grid-cols-5"}`}>
              {DOW.slice(0, weekends ? 7 : 5).map((d) => (
                <p key={d} className="pb-1 text-center font-mono text-[10px] tracking-[0.1em] text-[#a3a3a3]">{d}</p>
              ))}
              {(view === "month" ? monthGrid(anchor, weekends).flat() : weekCells(anchor, weekends)).map((day, i) =>
                day ? (
                  <DayCard key={day} day={day} cell={days.get(day)} today={day === today} future={day > today}
                    onOpen={() => setOpenDay(day)} />
                ) : (
                  <div key={`pad-${i}`} aria-hidden />
                )
              )}
            </div>
          </div>
        )}

        <p className="font-mono text-[10px] leading-relaxed text-[#525252]">
          Days are Dubai time. Import uploads the statement&apos;s closed trades to your account — Journal Analytics
          below still runs on this device only. <span className="text-[#00ff88]">●</span> bridge fill{" "}
          <span className="text-[#525252]">●</span> import / manual.
        </p>
      </div>

      {openDay ? (
        <DayModal
          day={openDay}
          cell={days.get(openDay)}
          trades={scopedTrades.filter((t) => t.closed_at && dubaiDate(t.closed_at) === openDay)}
          worst={worst}
          periodName={periodLabel(view, anchor)}
          blocked={prefs.blocked_hours}
          onToggleBlock={(h) => void savePrefs({
            blocked_hours: prefs.blocked_hours.includes(h)
              ? prefs.blocked_hours.filter((x) => x !== h)
              : [...prefs.blocked_hours, h].sort((a, b) => a - b),
          })}
          onClose={() => setOpenDay(null)}
        />
      ) : null}

      {adding ? (
        <AddTradeModal
          accountId={accountId}
          today={today}
          onClose={() => setAdding(false)}
          onSaved={(msg) => { setAdding(false); setNotice(msg); void loadRows(); void loadPeriodTrades(); }}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- day cell */

function DayCard({ day, cell, today, future, onOpen }: {
  day: string; cell: DayCell | undefined; today: boolean; future: boolean; onOpen: () => void;
}) {
  const n = Number(day.slice(8));
  const ring = today ? "ring-1 ring-[#00ff88]" : "";

  if (!cell || cell.trades === 0) {
    return (
      <div className={`rounded border border-[#141414] bg-[#0a0a0a] px-1.5 py-1.5 sm:px-2 ${ring}`}>
        <p className={`font-mono text-[10px] ${future ? "text-[#525252]" : "text-[#a3a3a3]"}`}>{n}</p>
        <p className="num-mono mt-1 whitespace-nowrap text-[11px] text-[#262626] sm:text-[12px]">
          <span className="sm:hidden">—</span><span className="hidden sm:inline">— — —</span>
        </p>
      </div>
    );
  }

  const tone = cell.pnl > 0 ? WIN : cell.pnl < 0 ? LOSS : "#525252";
  const hasVps = cell.sources.includes("vps");
  const hasOther = cell.sources.some((s) => s !== "vps");

  return (
    <button type="button" onClick={onOpen} title={`Sources: ${cell.sources.join(", ")}`}
      className={`min-w-0 rounded border border-[#262626] bg-[#141414] px-1.5 py-1.5 text-left transition-colors hover:bg-[#1a1a1a] sm:px-2 ${ring}`}
      style={{ borderLeftWidth: 2, borderLeftColor: tone }}>
      <p className="flex items-center gap-1 font-mono text-[10px] text-[#a3a3a3]">
        {n}
        <span className="ml-auto flex gap-0.5">
          {hasVps ? <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88]" /> : null}
          {hasOther ? <span className="h-1.5 w-1.5 rounded-full bg-[#525252]" /> : null}
        </span>
      </p>
      <p className="num-mono mt-1 whitespace-nowrap text-[10.5px] font-bold sm:text-[13px]" style={{ color: cell.pnl === 0 ? "#e5e5e5" : tone }}
        title={signed(cell.pnl)}>
        <span className="sm:hidden">{compactSigned(cell.pnl)}</span>
        <span className="hidden sm:inline">{signed(cell.pnl)}</span>
      </p>
      <p className="font-mono text-[9.5px] text-[#a3a3a3]">
        {cell.trades}<span className="hidden sm:inline"> trade{cell.trades === 1 ? "" : "s"}</span>
      </p>
    </button>
  );
}

/* --------------------------------------------------------------- goal card */

function GoalCard({ total, goal, progress, month, onSave }: {
  total: number; goal: number | null; progress: number | null; month: string; onSave: (g: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal ? String(goal) : "");

  useEffect(() => { setDraft(goal ? String(goal) : ""); }, [goal]);

  const commit = () => {
    const v = Number(draft);
    onSave(draft.trim() === "" ? null : v > 0 ? v : goal);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]">Monthly goal · {month}</p>
        <button type="button" onClick={() => setEditing((e) => !e)} aria-label="Edit goal"
          className="ml-auto text-[#525252] hover:text-[#00ff88]"><Pencil className="h-3 w-3" /></button>
      </div>

      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); commit(); }} className="mt-1.5 flex gap-1.5">
          <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="1000"
            className="num-mono w-full rounded border border-[#262626] bg-[#141414] px-2 py-1 text-[12px] text-[#e5e5e5] outline-none focus:border-[#00ff88]/50" />
          <button type="submit" className="rounded border border-[#00ff88] px-2 font-mono text-[10px] font-bold uppercase text-[#00ff88] hover:bg-[#00ff88]/10">save</button>
        </form>
      ) : goal ? (
        <>
          <p className="num-mono mt-1 text-[15px] font-bold leading-none text-[#e5e5e5]">
            <span style={{ color: total < 0 ? LOSS : WIN }}>{money(Math.round(total)).replace(".00", "")}</span>
            <span className="text-[#525252]"> / {money(goal).replace(".00", "")}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#262626]">
            <div className="h-full rounded-full bg-[#00ff88] transition-all duration-500" style={{ width: `${progress ?? 0}%` }} />
          </div>
          <p className="mt-1 font-mono text-[10px] text-[#525252]">{(progress ?? 0).toFixed(0)}%</p>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="mt-1.5 font-mono text-[11px] text-[#a3a3a3] hover:text-[#00ff88]">
          No goal set — set one
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- modal shell */

function TerminalModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-16 sm:items-center sm:pb-4">
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 cursor-default" />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-lg rounded-lg border border-[#262626] bg-[#141414]">
        <header className="flex items-center gap-2 border-b border-[#262626] px-4 py-2.5">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
            <span className="text-[#00ff88]/50">_&gt;</span> {title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-[#525252] hover:text-[#e5e5e5]">
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- day modal */

function DayModal({ day, cell, trades, worst, periodName, blocked, onToggleBlock, onClose }: {
  day: string; cell: DayCell | undefined; trades: TradeRow[];
  worst: ReturnType<typeof worstHour>; periodName: string; blocked: number[];
  onToggleBlock: (hour: number) => void; onClose: () => void;
}) {
  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const w = formatHourBucket(worst);
  const worstH = worst ? Number(worst.key) : null;
  const isBlocked = worstH !== null && blocked.includes(worstH);

  return (
    <TerminalModal title={label} onClose={onClose}>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="num-mono text-[22px] font-bold" style={{ color: !cell || cell.pnl === 0 ? "#e5e5e5" : cell.pnl > 0 ? WIN : LOSS }}>
            {cell ? signed(cell.pnl) : "0.00"}
          </span>
          <span className="font-mono text-[11px] text-[#a3a3a3]">
            {cell?.trades ?? 0} trades · {cell?.wins ?? 0}W-{cell?.losses ?? 0}L
          </span>
        </div>

        <div className="max-h-[300px] overflow-y-auto rounded border border-[#262626]">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#0a0a0a] font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#525252]">
              <tr>
                <th className="px-2.5 py-1.5 font-medium">Time</th>
                <th className="px-2.5 py-1.5 font-medium">Trade</th>
                <th className="px-2.5 py-1.5 text-right font-medium">P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {trades.length === 0 ? (
                <tr><td colSpan={3} className="px-2.5 py-3 font-mono text-[11px] text-[#a3a3a3]">Trades for this account are not loaded for this day.</td></tr>
              ) : trades.map((t) => {
                const hour = t.source !== "manual" && t.closed_at ? dubaiHourKey(t.closed_at) : null;
                const inWorst = hour !== null && worst && hour === worst.key;
                return (
                  <tr key={t.id} className="align-top">
                    <td className="px-2.5 py-1.5 font-mono text-[11px]" style={{ color: inWorst ? LOSS : "#a3a3a3" }}>
                      {t.source === "manual" || !t.closed_at
                        ? "—"
                        : new Date(new Date(t.closed_at).getTime() + 4 * 3_600_000).toISOString().slice(11, 16)}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <p className="flex items-center gap-1.5 font-mono text-[11px] text-[#e5e5e5]">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.source === "vps" ? "bg-[#00ff88]" : "bg-[#525252]"}`} title={t.source} />
                        {t.action ?? ""} {t.symbol} <span className="text-[#525252]">{t.lot.toFixed(2)}</span>
                      </p>
                      {t.notes ? <p className="mt-0.5 text-[10.5px] text-[#a3a3a3]">{t.notes}</p> : null}
                    </td>
                    <td className="num-mono px-2.5 py-1.5 text-right text-[11.5px] font-bold" style={{ color: t.pnl > 0 ? WIN : t.pnl < 0 ? LOSS : "#e5e5e5" }}>
                      {signed(t.pnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------ worst hour / guardian */}
        <div className="rounded border border-[#262626] border-l-2 border-l-[#ff4d4d] bg-[#0a0a0a] px-3 py-2.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#525252]">_&gt; worst hour · {periodName}</p>
          <p className="num-mono mt-1 text-[15px] font-bold text-[#e5e5e5]">
            {w.label} <span className="text-[11px] font-normal text-[#a3a3a3]">{w.sub}</span>
          </p>
          {worstH !== null ? (
            <>
              <button type="button" onClick={() => onToggleBlock(worstH)}
                className={`mt-2 rounded border px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] transition-colors ${
                  isBlocked ? "border-[#262626] text-[#a3a3a3] hover:text-[#e5e5e5]" : "border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88]/10"
                }`}>
                {isBlocked ? `Unblock ${w.label}` : `_> Block ${w.label} in Guardian`}
              </button>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[#525252]">
                {isBlocked ? "Blocked. " : ""}Saved to your preferences. The bridge enforces blocked hours when it trades —
                nothing on this page stops a trade by itself. Manual entries are left out of the ranking; they have no real time.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </TerminalModal>
  );
}

/* -------------------------------------------------------------- add trade */

function AddTradeModal({ accountId, today, onClose, onSaved }: {
  accountId: string | null; today: string; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [day, setDay] = useState(today);
  const [symbol, setSymbol] = useState("XAUUSD");
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
  const [lot, setLot] = useState("0.01");
  const [pnl, setPnl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/journal/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, symbol, action, lot: Number(lot), pnl: Number(pnl), notes, vt_account_id: accountId }),
    });
    const j = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !j?.ok) { setErr(j?.message ?? "Could not save."); return; }
    onSaved(`Added ${symbol} ${signed(Number(pnl))} on ${day}.`);
  };

  const input = "num-mono w-full rounded border border-[#262626] bg-[#0a0a0a] px-2.5 py-1.5 text-[12px] text-[#e5e5e5] outline-none focus:border-[#00ff88]/50";
  const lbl = "mb-1 block text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]";

  return (
    <TerminalModal title="Add trade" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 p-4">
        <label className="col-span-2 sm:col-span-1"><span className={lbl}>Day (Dubai)</span>
          <input type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} className={input} required /></label>
        <label className="col-span-2 sm:col-span-1"><span className={lbl}>Symbol</span>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className={input} required /></label>
        <label><span className={lbl}>Action</span>
          <select value={action} onChange={(e) => setAction(e.target.value as "BUY" | "SELL")} className={input}>
            <option>BUY</option><option>SELL</option>
          </select></label>
        <label><span className={lbl}>Lot</span>
          <input inputMode="decimal" value={lot} onChange={(e) => setLot(e.target.value)} className={input} required /></label>
        <label className="col-span-2"><span className={lbl}>Net P&amp;L (after commission &amp; swap)</span>
          <input inputMode="decimal" value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="-11.61" className={input} required /></label>
        <label className="col-span-2"><span className={lbl}>Notes (optional)</span>
          <input value={notes} maxLength={280} onChange={(e) => setNotes(e.target.value)} className={input} /></label>

        {err ? <p className="col-span-2 font-mono text-[11px] text-[#ff4d4d]">{err}</p> : null}

        <p className="col-span-2 text-[10px] leading-relaxed text-[#525252]">
          {accountId ? "Saved against the selected account." : "Saved without an account — it shows under All accounts."} A manual
          trade has a day but no time, so it is left out of worst-hour ranking.
        </p>

        <button type="submit" disabled={busy || pnl.trim() === ""}
          className="col-span-2 rounded border border-[#00ff88] bg-[#141414] px-3 py-2 font-mono text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#00ff88] transition-colors hover:bg-[#00ff88]/10 disabled:opacity-40">
          {busy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : "_> Save trade"}
        </button>
      </form>
    </TerminalModal>
  );
}

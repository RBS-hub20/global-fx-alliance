"use client";

import { useMemo, useState } from "react";
import { NotebookPen, Plus, Trash2 } from "lucide-react";
import { PriceChart } from "@/components/ui/PriceChart";
import {
  Card, CardHead, EmptyState, Field, Modal, PanelHeader, Select, Skeleton, Toast, money,
} from "@/components/ui/Primitives";
import { PAIRS, getPair, pipValuePerLot } from "@/lib/market";
import { KEYS, usePersistentState } from "@/lib/storage";

interface Trade {
  id: string;
  date: string;
  symbol: string;
  side: "Long" | "Short";
  entry: number;
  exit: number | null;
  lots: number;
  notes: string;
}

const SEED: Trade[] = [
  { id: "j1", date: "2026-08-29", symbol: "EUR/USD", side: "Long", entry: 1.1668, exit: 1.1731, lots: 0.5, notes: "London open continuation off the 1.1660 shelf. Sized normally, moved stop to break-even at +30." },
  { id: "j2", date: "2026-08-28", symbol: "GBP/USD", side: "Short", entry: 1.3592, exit: 1.3548, lots: 0.4, notes: "Faded the retail sales spike. Clean setup, held to target." },
  { id: "j3", date: "2026-08-27", symbol: "XAU/USD", side: "Long", entry: 2604.5, exit: 2631.2, lots: 0.1, notes: "Yield-driven bid. Should have taken more size — the thesis was the clearest of the week." },
  { id: "j4", date: "2026-08-26", symbol: "USD/JPY", side: "Long", entry: 147.1, exit: 146.72, lots: 0.3, notes: "Boredom trade with no level behind it. Exactly the pattern the journal keeps showing." },
  { id: "j5", date: "2026-08-25", symbol: "EUR/USD", side: "Long", entry: 1.1602, exit: 1.1649, lots: 0.5, notes: "Trend continuation, textbook. Nothing to change." },
  { id: "j6", date: "2026-08-22", symbol: "AUD/USD", side: "Short", entry: 0.6702, exit: 0.6673, lots: 0.6, notes: "China PMI leak. Right idea, entered late." },
  { id: "j7", date: "2026-08-21", symbol: "EUR/GBP", side: "Long", entry: 0.8611, exit: 0.8596, lots: 0.4, notes: "Range trade that broke against me. Stop did its job." },
  { id: "j8", date: "2026-08-20", symbol: "XAU/USD", side: "Long", entry: 2588.0, exit: null, lots: 0.1, notes: "Runner from the August low. Still open, stop at 2570." },
];

function pnl(t: Trade): number | null {
  if (t.exit === null) return null;
  const p = getPair(t.symbol);
  const diff = t.exit - t.entry;
  const pips = (t.side === "Long" ? diff : -diff) / p.pipSize;
  return pips * pipValuePerLot(t.symbol, t.lots, t.exit);
}

export function JournalPanel() {
  const { value: trades, setValue: setTrades, hydrated } = usePersistentState<Trade[]>(
    KEYS.journal,
    SEED
  );
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    symbol: "EUR/USD", side: "Long" as "Long" | "Short",
    entry: "", exit: "", lots: "0.5", notes: "",
  });

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  };

  const stats = useMemo(() => {
    const closed = trades.map(pnl).filter((v): v is number => v !== null);
    const wins = closed.filter((v) => v > 0);
    const losses = closed.filter((v) => v <= 0);
    const total = closed.reduce((a, b) => a + b, 0);
    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    return {
      total,
      pct: (total / 10000) * 100,
      winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
      avgWin: wins.length ? grossWin / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      factor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
      closed: closed.length,
    };
  }, [trades]);

  /** Equity curve, oldest trade first, starting from a 10k notional account. */
  const equity = useMemo(() => {
    const ordered = [...trades].reverse();
    const points: number[] = [10000];
    const labels: string[] = ["Start"];
    for (const t of ordered) {
      const v = pnl(t);
      if (v === null) continue;
      points.push(Number((points[points.length - 1] + v).toFixed(2)));
      labels.push(t.date.slice(5));
    }
    return { points, labels };
  }, [trades]);

  const save = () => {
    const entry = Number.parseFloat(form.entry);
    if (!Number.isFinite(entry)) return;
    const exitRaw = form.exit.trim();
    const exit = exitRaw ? Number.parseFloat(exitRaw) : null;
    setTrades((prev) => [
      {
        id: `t-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        symbol: form.symbol,
        side: form.side,
        entry,
        exit: exit !== null && Number.isFinite(exit) ? exit : null,
        lots: Number.parseFloat(form.lots) || 0,
        notes: form.notes.trim(),
      },
      ...prev,
    ]);
    setForm({ symbol: "EUR/USD", side: "Long", entry: "", exit: "", lots: "0.5", notes: "" });
    setAdding(false);
    flash("Trade logged");
  };

  const remove = (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
    flash("Trade removed");
  };

  if (!hydrated) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Trading Journal"
        action={
          <button type="button" onClick={() => setAdding(true)} className="btn-primary !px-4 !py-2 text-[12.5px]">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            New Trade
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Total P/L"
          value={money(stats.total)}
          sub={`${stats.pct >= 0 ? "+" : ""}${stats.pct.toFixed(2)}%`}
          tone={stats.total >= 0 ? "up" : "down"}
        />
        <Stat label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.closed} closed`} />
        <Stat label="Avg Win / Loss" value={money(stats.avgWin, 0)} sub={`vs ${money(stats.avgLoss, 0)}`} />
        <Stat
          label="Profit Factor"
          value={Number.isFinite(stats.factor) ? stats.factor.toFixed(2) : "∞"}
          sub={stats.factor >= 1 ? "Above breakeven" : "Below breakeven"}
          tone={stats.factor >= 1 ? "up" : "down"}
        />
      </div>

      {equity.points.length > 1 ? (
        <Card>
          <CardHead title="Equity Curve" icon={NotebookPen} />
          <div className="px-3 py-5 sm:px-5">
            <PriceChart points={equity.points} labels={equity.labels} decimals={2} height={260} />
          </div>
        </Card>
      ) : null}

      {trades.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No trades logged"
          body="Record entries, exits and — more importantly — why you took the trade. The notes column is what makes a journal useful."
          action={
            <button type="button" onClick={() => setAdding(true)} className="btn-primary">
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Log your first trade
            </button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {["Date", "Pair", "Type", "Entry", "Exit", "P/L", "Status", "Notes", ""].map((h, i) => (
                    <th
                      key={h || i}
                      scope="col"
                      className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted/70 ${
                        i >= 3 && i <= 5 ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {trades.map((t) => {
                  const p = getPair(t.symbol);
                  const v = pnl(t);
                  return (
                    <tr key={t.id} className="transition-colors duration-200 hover:bg-white/[0.02]">
                      <td className="num-mono whitespace-nowrap px-4 py-3.5 text-[12.5px] text-ink-muted">{t.date}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[13px] font-semibold text-white">{t.symbol}</td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${
                          t.side === "Long" ? "bg-brand-green/[0.13] text-brand-green" : "bg-brand-danger/[0.13] text-brand-danger"
                        }`}>
                          {t.side}
                        </span>
                      </td>
                      <td className="num-mono px-4 py-3.5 text-right text-[12.5px] text-ink">{t.entry.toFixed(p.decimals)}</td>
                      <td className="num-mono px-4 py-3.5 text-right text-[12.5px] text-ink">
                        {t.exit === null ? "—" : t.exit.toFixed(p.decimals)}
                      </td>
                      <td className={`num-mono px-4 py-3.5 text-right text-[13px] font-semibold ${
                        v === null ? "text-ink-muted" : v >= 0 ? "text-brand-green" : "text-brand-danger"
                      }`}>
                        {v === null ? "—" : money(v)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                          t.exit === null ? "bg-brand-blue/[0.14] text-brand-blue" : "bg-white/[0.06] text-ink-muted"
                        }`}>
                          {t.exit === null ? "Open" : "Closed"}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-muted">
                        {t.notes || <span className="text-ink-muted/50">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => remove(t.id)}
                          aria-label={`Delete ${t.symbol} trade from ${t.date}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-ink-muted transition-all duration-200 hover:border-brand-danger/40 hover:text-brand-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-[11.5px] text-ink-muted/70">
        Journal entries are stored in this browser only. P/L is calculated from a 10,000 USD notional
        account and ignores commission and swap.
      </p>

      <Modal open={adding} onClose={() => setAdding(false)} title="Log a trade">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Pair"
            value={form.symbol}
            onChange={(e) => {
              const symbol = e.target.value;
              setForm((f) => ({ ...f, symbol, entry: String(getPair(symbol).price) }));
            }}
          >
            {PAIRS.map((p) => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
          </Select>
          <Select label="Direction" value={form.side} onChange={(e) => setForm((f) => ({ ...f, side: e.target.value as "Long" | "Short" }))}>
            <option>Long</option>
            <option>Short</option>
          </Select>
          <Field label="Entry" type="number" inputMode="decimal" step="0.0001" value={form.entry} onChange={(e) => setForm((f) => ({ ...f, entry: e.target.value }))} />
          <Field label="Exit (blank if open)" type="number" inputMode="decimal" step="0.0001" value={form.exit} onChange={(e) => setForm((f) => ({ ...f, exit: e.target.value }))} />
          <Field label="Lot Size" type="number" inputMode="decimal" step="0.01" value={form.lots} onChange={(e) => setForm((f) => ({ ...f, lots: e.target.value }))} suffix="lots" />
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Why did you take it?
          </span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="One sentence. If you can't write it, you don't have a setup."
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/60 focus:border-brand-blue/40 focus:shadow-glow"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setAdding(false)} className="btn-ghost !px-4 !py-2 text-[12.5px]">Cancel</button>
          <button
            type="button"
            onClick={save}
            disabled={!Number.isFinite(Number.parseFloat(form.entry))}
            className="btn-primary !px-4 !py-2 text-[12.5px] disabled:opacity-40"
          >
            Save trade
          </button>
        </div>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}

function Stat({
  label, value, sub, tone,
}: {
  label: string; value: string; sub: string; tone?: "up" | "down";
}) {
  return (
    <div className="rounded-2xl glass p-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className={`num-mono mt-2.5 text-[22px] font-bold leading-none ${
        tone === "up" ? "text-brand-green" : tone === "down" ? "text-brand-danger" : "text-white"
      }`}>
        {value}
      </p>
      <p className="mt-2 text-[11.5px] text-ink-muted">{sub}</p>
    </div>
  );
}

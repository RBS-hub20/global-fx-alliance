"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Clock, Download, FileUp, Loader2, ShieldCheck, Trash2, TriangleAlert, Upload,
} from "lucide-react";
import { Card, CardHead, Skeleton, Toast, money } from "@/components/ui/Primitives";
import { computeAnalytics, parseTradesCSV, type JournalAnalytics, type Trade } from "@/lib/journalParser";
import { SAMPLE_STATEMENT_CSV } from "@/lib/journalSample";
import { readStore, writeStore } from "@/lib/storage";
import { EVENTS, trackEvent } from "@/lib/analytics";

const STORE_KEY = "gfxa-journal-import";
/** Dubai — the community's home timezone. */
const TZ_OFFSET = 4;

interface Saved {
  trades: Trade[];
  fileName: string | null;
  at: string;
}

export function JournalAnalyticsPanel() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isReal, setIsReal] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore a previous import, else fall back to the sample statement.
  useEffect(() => {
    const saved = readStore<Saved | null>(STORE_KEY, null);
    if (saved?.trades?.length) {
      setTrades(saved.trades);
      setFileName(saved.fileName);
      setIsReal(true);
    } else {
      setTrades(parseTradesCSV(SAMPLE_STATEMENT_CSV, ""));
      setIsReal(false);
    }
    setHydrated(true);
  }, []);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const ingest = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      // Parsed in the browser on purpose — a trading history never leaves the device.
      const parsed = parseTradesCSV(text, file.name);
      if (!parsed.length) {
        setError(
          "No trades found in that file. In MT4: Account History → right-click → Save as Report. In MT5: History → Report. Then upload the CSV."
        );
        return;
      }
      setTrades(parsed);
      setFileName(file.name);
      setIsReal(true);
      writeStore(STORE_KEY, { trades: parsed, fileName: file.name, at: new Date().toISOString() });
      trackEvent(EVENTS.journalImported, { trades: parsed.length });
      flash(`Imported ${parsed.length} trades`);
    } catch {
      setError("That file could not be read. A plain CSV export works best.");
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = () => {
    writeStore(STORE_KEY, null);
    setTrades(parseTradesCSV(SAMPLE_STATEMENT_CSV, ""));
    setIsReal(false);
    setFileName(null);
    flash("Import cleared — showing the sample statement");
  };

  const a: JournalAnalytics | null = useMemo(
    () => (trades.length ? computeAnalytics(trades, TZ_OFFSET) : null),
    [trades]
  );

  if (!hydrated || !a) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  const s = a.summary;
  const p = a.patterns;
  const maxHour = Math.max(...a.byHourLocal.map((h) => h.trades), 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white">
          Journal Analytics
          <span
            className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] ${
              isReal ? "bg-brand-green/[0.13] text-brand-green" : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
            }`}
          >
            {isReal ? `Real · your trades${fileName ? ` · ${fileName}` : ""}` : `Sample · ${trades.length} demo trades`}
          </span>
        </h2>
        {isReal ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11.5px] text-ink-muted transition-all duration-200 hover:border-brand-danger/40 hover:text-brand-danger"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
            Clear import
          </button>
        ) : null}
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) ingest(f);
        }}
        className={`rounded-2xl border border-dashed p-6 transition-all duration-200 ${
          dragging ? "border-brand-blue/60 bg-brand-blue/[0.06]" : "border-white/[0.12] bg-white/[0.02]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-blue/25 bg-brand-blue/10 text-brand-blue">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" strokeWidth={1.8} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-white">
              Drop your MT4/MT5 statement — Vantage, VT Markets, PUPRIME, any broker
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              MT4: Account History → right-click → Save as Report. MT5: History → Report. Columns are
              matched by name, so broker-specific layouts still work.
            </p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary !px-4 !py-2.5 text-[12.5px]">
            <Upload className="h-4 w-4" strokeWidth={2.2} />
            Choose file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) ingest(f);
              e.target.value = "";
            }}
          />
        </div>

        <p className="mt-4 flex items-start gap-2 border-t border-white/[0.08] pt-3.5 text-[11.5px] leading-relaxed text-ink-muted/80">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" strokeWidth={2} />
          Parsed entirely in your browser. Your statement is never uploaded — it stays on this device
          and is saved only to this browser&apos;s local storage.
        </p>

        {error ? (
          <p role="alert" className="mt-3 rounded-lg border border-brand-danger/30 bg-brand-danger/[0.08] px-3.5 py-2.5 text-[12.5px] text-brand-danger">
            {error}
          </p>
        ) : null}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Net P/L" value={money(s.netPL)} tone={s.netPL >= 0 ? "up" : "down"} sub={`${s.trades} trades`} />
        <Stat label="Win Rate" value={`${s.winRate.toFixed(0)}%`} sub={`${s.wins}W / ${s.losses}L`} />
        <Stat
          label="Profit Factor"
          value={s.profitFactor === null ? "∞" : s.profitFactor.toFixed(2)}
          tone={(s.profitFactor ?? 0) >= 1 ? "up" : "down"}
          sub={(s.profitFactor ?? 0) >= 1 ? "above breakeven" : "below breakeven"}
        />
        <Stat label="Max Drawdown" value={money(s.maxDrawdown)} tone="down" sub={`expectancy ${money(s.expectancy)}/trade`} />
      </div>

      {/* What the numbers say */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHead title="Best / Worst Pair" />
          <div className="space-y-4 p-5">
            {p.bestPair ? <Verdict tone="up" head={p.bestPair.key} body={`${p.bestPair.winRate.toFixed(0)}% win rate · ${money(p.bestPair.net)} over ${p.bestPair.trades} trades`} /> : null}
            {p.worstPair ? <Verdict tone="down" head={p.worstPair.key} body={`${p.worstPair.winRate.toFixed(0)}% win rate · ${money(p.worstPair.net)} over ${p.worstPair.trades} trades`} /> : null}
            {p.worstPair && p.worstPair.net < 0 ? (
              <p className="border-t border-white/[0.08] pt-3.5 text-[12.5px] leading-relaxed text-ink-muted">
                Cutting {p.worstPair.key} alone would have changed your net by {money(-p.worstPair.net)}.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHead title="Session Performance" />
          <ul className="divide-y divide-white/[0.06]">
            {a.bySession.map((sess) => (
              <li key={sess.key} className="flex items-center gap-3 px-5 py-3.5">
                <span className="w-[74px] shrink-0 text-[13px] font-semibold text-white">{sess.key}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <span
                    className={`block h-full rounded-full ${sess.winRate >= 50 ? "bg-brand-green" : "bg-brand-danger"}`}
                    style={{ width: `${Math.max(sess.winRate, 3)}%` }}
                  />
                </span>
                <span className="num-mono w-[38px] shrink-0 text-right text-[12.5px] font-semibold text-ink">
                  {sess.winRate.toFixed(0)}%
                </span>
                <span className={`num-mono w-[64px] shrink-0 text-right text-[12px] ${sess.net >= 0 ? "text-brand-green" : "text-brand-danger"}`}>
                  {money(sess.net, 0)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHead title="Hold Time" icon={Clock} />
          <div className="p-5">
            <div className="space-y-3">
              <Row k="Avg winner" v={a.holdTime.avgWinnerMin === null ? "n/a" : `${a.holdTime.avgWinnerMin}m`} tone="up" />
              <Row k="Avg loser" v={a.holdTime.avgLoserMin === null ? "n/a" : `${a.holdTime.avgLoserMin}m`} tone="down" />
              <Row k="Avg win" v={money(s.avgWin)} tone="up" />
              <Row k="Avg loss" v={money(s.avgLoss)} tone="down" />
              <Row k="Costs paid" v={money(s.totalCosts)} />
            </div>
            {p.holdsLosersLonger ? (
              <p className="mt-4 border-t border-white/[0.08] pt-3.5 text-[12.5px] leading-relaxed text-ink-muted">
                You hold losers about{" "}
                <span className="font-semibold text-brand-danger">
                  {((a.holdTime.avgLoserMin ?? 0) / Math.max(a.holdTime.avgWinnerMin ?? 1, 1)).toFixed(1)}×
                </span>{" "}
                longer than winners — the most common shape of a losing month.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Hour histogram */}
      <Card>
        <CardHead
          title={`Win rate by hour · UTC+${TZ_OFFSET}`}
          right={<span className="text-[11px] text-ink-muted">bar height = trades taken</span>}
        />
        <div className="p-5">
          <div className="flex items-end gap-1">
            {Array.from({ length: 24 }, (_, h) => {
              const key = String(h).padStart(2, "0");
              const b = a.byHourLocal.find((x) => x.key === key);
              const height = b ? Math.max((b.trades / maxHour) * 100, 8) : 3;
              const good = (b?.winRate ?? 0) >= 50;
              return (
                <div key={key} className="group flex flex-1 flex-col items-center gap-1">
                  <span className="relative flex w-full justify-center" style={{ height: 96 }}>
                    <span
                      className={`absolute bottom-0 w-full rounded-t transition-all duration-200 ${
                        !b ? "bg-white/[0.05]" : good ? "bg-brand-green/70" : "bg-brand-danger/70"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    {b ? (
                      <span className="pointer-events-none absolute -top-1 z-10 hidden whitespace-nowrap rounded border border-white/10 bg-[#0B1120] px-2 py-1 text-[10px] num-mono text-ink group-hover:block">
                        {key}:00 · {b.trades} trades · {b.winRate.toFixed(0)}% · {money(b.net, 0)}
                      </span>
                    ) : null}
                  </span>
                  <span className="num-mono text-[9px] text-ink-muted/60">{key}</span>
                </div>
              );
            })}
          </div>

          {p.worstHourLocal && p.worstHourLocal.net < 0 ? (
            <p className="mt-5 text-[13px] leading-relaxed text-ink-muted">
              Your worst hour is{" "}
              <span className="font-semibold text-brand-danger">{p.worstHourLocal.key}:00</span> — {" "}
              {p.worstHourLocal.winRate.toFixed(0)}% win rate across {p.worstHourLocal.trades} trades for{" "}
              {money(p.worstHourLocal.net)}. Your best is{" "}
              <span className="font-semibold text-brand-green">{p.bestHourLocal?.key}:00</span>.
            </p>
          ) : null}
        </div>
      </Card>

      {/* Behaviour alerts */}
      {p.revenge.detected || p.overtrading.detected ? (
        <div className="space-y-4">
          {p.revenge.detected ? (
            <Alert
              tone="danger"
              title="Revenge trading detected"
              body={`After three consecutive losses you increased size from ${p.revenge.occurrences[0]?.from} to ${p.revenge.occurrences[0]?.to} lots${
                p.revenge.occurrences[0]?.at ? ` on ${p.revenge.occurrences[0].at.slice(0, 10)}` : ""
              }${p.revenge.occurrences.length > 1 ? `, and ${p.revenge.occurrences.length - 1} more time${p.revenge.occurrences.length > 2 ? "s" : ""}` : ""}. Sizing up to recover a loss is the fastest way to turn a bad day into a bad month.`}
            />
          ) : null}
          {p.overtrading.detected ? (
            <Alert
              tone="warn"
              title="Overtrading detected"
              body={`You closed ${p.overtrading.count} trades inside a single hour${p.overtrading.worstHour ? ` (${p.overtrading.worstHour.replace("T", " ")}:00 UTC)` : ""}. Clusters like this usually follow a loss rather than a setup.`}
            />
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-brand-green/25 bg-brand-green/[0.06] px-4 py-3.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-green" strokeWidth={2} />
          <p className="text-[13px] text-ink">
            No revenge-sizing or overtrading clusters found in this history.
          </p>
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed text-ink-muted/70">
        {isReal
          ? "Computed from your own statement, in your browser. Nothing was uploaded."
          : "This is a generated sample statement so the analytics have something to show. Upload your own export to replace it."}{" "}
        Broker timestamps are read as server time. Educational only — not financial advice.
      </p>

      <Toast message={toast} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-2xl glass p-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className={`num-mono mt-2.5 text-[24px] font-bold leading-none ${tone === "up" ? "text-brand-green" : tone === "down" ? "text-brand-danger" : "text-white"}`}>
        {value}
      </p>
      <p className="mt-2 text-[11.5px] text-ink-muted">{sub}</p>
    </div>
  );
}

function Verdict({ tone, head, body }: { tone: "up" | "down"; head: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone === "up" ? "bg-brand-green" : "bg-brand-danger"}`} />
      <span>
        <span className="block text-[14px] font-bold text-white">{head}</span>
        <span className="mt-0.5 block text-[12.5px] text-ink-muted">{body}</span>
      </span>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "up" | "down" }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink-muted">{k}</span>
      <span className={`num-mono font-semibold ${tone === "up" ? "text-brand-green" : tone === "down" ? "text-brand-danger" : "text-white"}`}>{v}</span>
    </div>
  );
}

function Alert({ tone, title, body }: { tone: "danger" | "warn"; title: string; body: string }) {
  const danger = tone === "danger";
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-4 ${danger ? "border-brand-danger/35 bg-brand-danger/[0.07]" : "border-[#fbbf24]/35 bg-[#fbbf24]/[0.07]"}`}>
      {danger ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-danger" strokeWidth={2.2} /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#fbbf24]" strokeWidth={2.2} />}
      <div>
        <p className={`text-[13.5px] font-bold ${danger ? "text-brand-danger" : "text-[#fbbf24]"}`}>{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink">{body}</p>
      </div>
    </div>
  );
}

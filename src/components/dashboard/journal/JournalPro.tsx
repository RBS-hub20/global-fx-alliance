"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, NotebookPen, Plus, Settings2, Trash2 } from "lucide-react";
import { Card, CardHead, EmptyState, Modal, PanelHeader, Toast, money } from "@/components/ui/Primitives";
import { JournalCalendar } from "./JournalCalendar";
import { JournalCommunity } from "./JournalCommunity";
import {
  DEFAULT_SETTINGS, SYMBOL_GROUPS, assetClassOf, byAssetClass, bySymbol, byTag, compliance, dayOf,
  equityCurve, estimatePnl, net, normaliseSymbolInput, streaks, summarise,
  type AssetClass, type JournalSettings, type JournalTrade, type Rule,
} from "@/lib/journalPro";
import { useLiveTick } from "@/lib/useLiveTick";

/**
 * The trading journal, kept by hand.
 *
 * Deliberately separate from the Journal Analytics tab, which reads an imported
 * broker statement. A statement knows price, size and P&L; it cannot know why a
 * trade was taken, which mistake was made, or what the member felt at the time.
 * Those three fields are the reason to keep a journal at all, and everything
 * below exists to turn them into something readable.
 *
 * Nothing here tells anyone what to trade. The compliance panel reports the
 * member's own stated limits against their own day — it does not block a trade
 * and does not offer advice.
 */

const SETUPS = ["breakout", "retest", "fvg", "liquidity sweep", "news", "range"];
const MISTAKES = ["early entry", "late exit", "no stop", "over risk", "revenge", "fomo", "moved stop"];
const EMOTIONS = ["confident", "patient", "fear", "greed", "tilt", "bored"];
const SESSIONS = ["asia", "london", "ny", "dubai"] as const;

const FIELD = "w-full rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 text-[13.5px] text-white outline-none transition-colors focus:border-brand-accent/50";
const LABEL = "block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted";

const TONE: Record<Rule["level"], string> = {
  ok: "border-brand-green/35 bg-brand-green/[0.07] text-brand-green",
  warn: "border-[#FFB020]/40 bg-[#FFB020]/[0.08] text-[#FFB020]",
  breach: "border-brand-danger/45 bg-brand-danger/[0.1] text-brand-danger",
};

type Draft = Partial<JournalTrade> & { id?: string };

export function JournalPro({ onLegacy }: { onLegacy: () => void }) {
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [settings, setSettings] = useState<JournalSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rules, setRules] = useState(false);
  const [filterClass, setFilterClass] = useState<"all" | AssetClass>("all");
  const [filterSymbol, setFilterSymbol] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const today = dayOf(new Date().toISOString());
  const [review, setReview] = useState<Record<string, string>>({});
  const [reviewLoaded, setReviewLoaded] = useState(false);

  /** The day a calendar square opened, and that day's saved review. */
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [openDayReview, setOpenDayReview] = useState<Record<string, unknown> | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([
        fetch("/api/journal/trades", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/journal/settings", { cache: "no-store" }).then((r) => r.json()),
      ]);
      // Not installed: hand the tab back to the old local journal rather than
      // showing an empty pro panel over a missing table.
      if (t?.installed === false || s?.installed === false) { onLegacy(); return; }
      if (t?.ok) setTrades(t.trades ?? []);
      if (s?.ok) setSettings(s.settings ?? DEFAULT_SETTINGS);
    } finally {
      setLoaded(true);
    }
  }, [onLegacy]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void fetch(`/api/journal/daily?day=${today}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.days?.[0];
        if (d) {
          setReview({
            bias: d.bias ?? "", support: d.support ?? "", resistance: d.resistance ?? "",
            entryZone: d.entry_zone ?? "", preMarketPlan: d.pre_market_plan ?? "",
            whatWentWell: d.what_went_well ?? "", whatWentWrong: d.what_went_wrong ?? "",
            whatToImprove: d.what_to_improve ?? "", tomorrowPlan: d.tomorrow_plan ?? "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setReviewLoaded(true));
  }, [today]);

  useEffect(() => {
    if (!openDay) { setOpenDayReview(null); return; }
    void fetch(`/api/journal/daily?day=${openDay}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setOpenDayReview(j?.days?.[0] ?? null))
      .catch(() => setOpenDayReview(null));
  }, [openDay]);

  const dayTrades = useMemo(
    () => (openDay ? trades.filter((t) => dayOf(t.closedAt ?? t.openedAt) === openDay) : []),
    [openDay, trades]
  );

  /*
   * The relayed price for whatever instrument the modal is on. Hooks cannot be
   * called conditionally, so this runs whether or not the modal is open; with
   * no row for that symbol it simply returns nothing and the form stays manual.
   */
  const draftSymbol = normaliseSymbolInput(draft?.symbol ?? "XAU/USD");
  const { tick, live: tickLive } = useLiveTick(draftSymbol);

  const shown = useMemo(() => trades.filter((t) => {
    if (filterClass !== "all" && assetClassOf(t.symbol) !== filterClass) return false;
    if (filterSymbol && !t.symbol.toUpperCase().includes(filterSymbol.toUpperCase())) return false;
    return true;
  }), [trades, filterClass, filterSymbol]);

  const s = useMemo(() => summarise(trades), [trades]);
  const str = useMemo(() => streaks(trades), [trades]);
  const comp = useMemo(() => compliance(trades, settings, today), [trades, settings, today]);
  const curve = useMemo(() => equityCurve(trades), [trades]);

  async function saveTrade() {
    if (!draft) return;
    setBusy(true);
    try {
      const res = await fetch("/api/journal/trades", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!res.ok || j.ok === false) { flash(j.message ?? "Could not save that trade."); return; }
      setDraft(null);
      flash(draft.id ? "Trade updated" : "Trade logged");
      void load();
    } finally { setBusy(false); }
  }

  async function removeTrade(id: string) {
    if (!window.confirm("Delete this trade from your journal?")) return;
    await fetch(`/api/journal/trades?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    flash("Trade deleted");
    void load();
  }

  async function saveRules() {
    setBusy(true);
    try {
      const res = await fetch("/api/journal/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      const j = await res.json();
      if (j?.settings) setSettings(j.settings);
      setRules(false);
      flash("Rules saved");
    } finally { setBusy(false); }
  }

  async function saveReview() {
    setBusy(true);
    try {
      await fetch("/api/journal/daily", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: today, ...review }),
      });
      flash("Review saved");
    } finally { setBusy(false); }
  }

  if (!loaded) return <div className="py-16 text-center text-[13px] text-ink-muted">Opening your journal…</div>;

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Trading Journal"
        action={
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => setRules(true)} className="btn-ghost !px-3 !py-2 text-[12px]">
              <Settings2 className="h-3.5 w-3.5" strokeWidth={2} /> Rules
            </button>
            <button type="button" onClick={() => setDraft({ symbol: "XAU/USD", direction: "buy", session: "london" })}
              className="btn-primary !px-3.5 !py-2 text-[12px]">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} /> Log trade
            </button>
          </span>
        }
      />

      {/* --------------------------------------------------- today's rules */}
      {comp.stop ? (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-danger/45 bg-brand-danger/[0.08] px-5 py-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-danger" strokeWidth={2.2} />
          <p className="text-[13px] leading-relaxed text-ink">
            <span className="font-bold text-brand-danger">You have reached a limit you set for yourself today.</span>{" "}
            {comp.rules.filter((r) => r.level === "breach").map((r) => `${r.label}: ${r.detail}`).join(" · ")}. Nothing
            here stops you trading — that is your call. It is here so the decision is made with the number in front of you.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {comp.rules.map((r) => (
          <div key={r.key} className={`rounded-xl border px-4 py-3 ${TONE[r.level]}`}>
            <p className="text-[10.5px] uppercase tracking-[0.1em] opacity-80">{r.label}</p>
            <p className="num-mono mt-1 text-[18px] font-bold">
              {r.key === "daily_loss" && r.limit > 0 ? `${money(r.value)} / ${money(r.limit)}` : `${r.value}${r.limit ? ` / ${r.limit}` : ""}`}
            </p>
            <p className="mt-0.5 text-[11px] opacity-80">{r.detail}</p>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------- the numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {([
          ["Net", money(s.netPL), s.netPL >= 0 ? "text-brand-green" : "text-brand-danger"],
          ["Win rate", `${s.winRate}%`, "text-white"],
          ["Profit factor", s.profitFactor === null ? (s.trades ? "∞" : "n/a") : s.profitFactor.toFixed(2), "text-white"],
          ["Expectancy", money(s.expectancy), s.expectancy >= 0 ? "text-brand-green" : "text-brand-danger"],
          ["Avg RR", s.avgRR === null ? "n/a" : `1:${s.avgRR.toFixed(1)}`, "text-white"],
          ["Streak", str.currentWin ? `${str.currentWin}W` : str.currentLoss ? `${str.currentLoss}L` : "—",
            str.currentLoss ? "text-brand-danger" : "text-brand-green"],
        ] as const).map(([k, v, tone]) => (
          <div key={k} className="rounded-xl glass px-4 py-3">
            <p className="text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{k}</p>
            <p className={`num-mono mt-1 text-[18px] font-bold ${tone}`}>{v}</p>
          </div>
        ))}
      </div>

      <JournalCalendar trades={trades} onOpenDay={setOpenDay} />

      {curve.length > 2 ? <MiniCurve points={curve.map((p) => p.cumulative)} /> : null}

      <JournalCommunity mine={s} />

      {/* ---------------------------------------------- what the tags say */}
      {s.trades > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TagCard title="By setup" rows={byTag(trades, "setupType")} empty="Tag a trade's setup and this fills in." />
          <TagCard title="By mistake" rows={byTag(trades, "mistakeTag")} empty="No mistakes tagged yet." invert />
          <TagCard title="By emotion" rows={byTag(trades, "emotion")} empty="Tag how you felt and this fills in." />
          <TagCard title="By session" rows={byTag(trades, "session")} empty="No sessions tagged yet." />
          <TagCard title="By instrument" rows={bySymbol(trades)} empty="Log a trade and this fills in." />
          <TagCard title="By asset class" rows={byAssetClass(trades)} empty="Log a trade and this fills in." />
        </div>
      ) : null}

      {/* ---------------------------------------------------------- the log */}
      <Card>
        <CardHead
          title={`Trades · ${shown.length === trades.length ? `${s.trades} closed` : `${shown.length} of ${trades.length}`}`}
          icon={NotebookPen}
          right={trades.length ? (
            <span className="flex items-center gap-2">
              <select value={filterClass} onChange={(e) => setFilterClass(e.target.value as "all" | AssetClass)}
                className="rounded border border-white/[0.1] bg-black/40 px-2 py-1 text-[11px] text-ink-muted outline-none focus:border-brand-accent/50">
                {(["all", "Gold", "Majors", "Indices", "Crypto", "Other"] as const).map((c) => (
                  <option key={c} value={c}>{c === "all" ? "All instruments" : c}</option>
                ))}
              </select>
              <input value={filterSymbol} onChange={(e) => setFilterSymbol(e.target.value)} placeholder="symbol"
                className="w-24 rounded border border-white/[0.1] bg-black/40 px-2 py-1 text-[11px] text-ink-muted outline-none focus:border-brand-accent/50" />
            </span>
          ) : undefined}
        />
        {trades.length === 0 ? (
          <EmptyState icon={NotebookPen} title="Nothing logged yet"
            body="Log a trade with its setup, the mistake if there was one, and how you felt. Three or four entries is enough for the breakdowns above to start saying something."
            action={<button type="button" onClick={() => setDraft({ symbol: "XAU/USD", direction: "buy" })} className="btn-primary !px-4 !py-2.5 text-[12.5px]">Log your first trade</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {["Date", "Symbol", "Dir", "Entry", "Exit", "Size", "Risk", "RR", "Setup", "Mistake", "Feel", "Session", "Net", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td>{dayOf(t.closedAt ?? t.openedAt) || "—"}</Td>
                    <Td className="font-semibold text-white">{t.symbol}</Td>
                    <Td className={t.direction === "buy" ? "text-brand-green" : "text-brand-danger"}>{t.direction}</Td>
                    <Td>{t.entryPrice ?? "—"}</Td>
                    <Td>{t.exitPrice ?? "—"}</Td>
                    <Td>{t.size ?? "—"}</Td>
                    <Td>{t.riskPercent !== null ? `${t.riskPercent}%` : t.riskUsd !== null ? money(t.riskUsd) : "—"}</Td>
                    <Td>{t.rr !== null ? `1:${t.rr}` : "—"}</Td>
                    <Td className="text-ink-muted">{t.setupType ?? "—"}</Td>
                    <Td className={t.mistakeTag ? "text-[#FFB020]" : "text-ink-muted"}>{t.mistakeTag ?? "—"}</Td>
                    <Td className="text-ink-muted">{t.emotion ?? "—"}</Td>
                    <Td className="text-ink-muted">{t.session ?? "—"}</Td>
                    <Td className={net(t) >= 0 ? "text-brand-green" : "text-brand-danger"}>{money(net(t))}</Td>
                    <Td>
                      <span className="flex gap-2">
                        <button onClick={() => setDraft(t)} className="text-ink-muted hover:text-white">Edit</button>
                        <button onClick={() => void removeTrade(t.id)} className="text-ink-muted hover:text-brand-danger" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                        </button>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------- the daily review */}
      <Card className="p-5">
        <CardHead title={`Daily review · ${today}`} />
        {reviewLoaded ? (
          <div className="grid grid-cols-1 gap-5 pt-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-accent">Before the session</p>
              <div className="grid grid-cols-3 gap-2">
                <label><span className={LABEL}>Bias</span>
                  <select className={FIELD} value={review.bias ?? ""} onChange={(e) => setReview({ ...review, bias: e.target.value })}>
                    <option value="">—</option><option value="bullish">bullish</option>
                    <option value="bearish">bearish</option><option value="neutral">neutral</option>
                  </select>
                </label>
                <label><span className={LABEL}>Support</span>
                  <input className={FIELD} value={review.support ?? ""} onChange={(e) => setReview({ ...review, support: e.target.value })} inputMode="decimal" /></label>
                <label><span className={LABEL}>Resistance</span>
                  <input className={FIELD} value={review.resistance ?? ""} onChange={(e) => setReview({ ...review, resistance: e.target.value })} inputMode="decimal" /></label>
              </div>
              <label className="block"><span className={LABEL}>The plan</span>
                <textarea rows={4} className={FIELD} placeholder="What has to happen before you take anything."
                  value={review.preMarketPlan ?? ""} onChange={(e) => setReview({ ...review, preMarketPlan: e.target.value })} /></label>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-accent">After the session</p>
              {([["whatWentWell", "What went well"], ["whatWentWrong", "What went wrong"], ["tomorrowPlan", "Tomorrow"]] as const).map(([k, label]) => (
                <label key={k} className="block"><span className={LABEL}>{label}</span>
                  <textarea rows={2} className={FIELD} value={review[k] ?? ""} onChange={(e) => setReview({ ...review, [k]: e.target.value })} /></label>
              ))}
            </div>

            <div className="lg:col-span-2">
              <button type="button" disabled={busy} onClick={() => void saveReview()} className="btn-primary !px-4 !py-2.5 text-[12.5px]">
                {busy ? "Saving…" : "Save review"}
              </button>
            </div>
          </div>
        ) : <p className="py-6 text-center text-[13px] text-ink-muted">Loading…</p>}
      </Card>

      {/* ------------------------------------------------------------ modals */}
      <Modal open={!!openDay} onClose={() => setOpenDay(null)} title={openDay ? `Review · ${openDay}` : ""} wide>
        {openDay ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-4">
              {([
                ["Trades", String(dayTrades.length)],
                ["Net", money(dayTrades.reduce((a, t) => a + net(t), 0))],
                ["Won", `${dayTrades.filter((t) => net(t) > 0).length} of ${dayTrades.length}`],
              ] as const).map(([k, v]) => (
                <span key={k}>
                  <span className="block text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{k}</span>
                  <span className="num-mono text-[16px] font-bold text-white">{v}</span>
                </span>
              ))}
            </div>

            {dayTrades.length ? (
              <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
                {dayTrades.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[12.5px]">
                    <span className={`num-mono font-semibold ${t.direction === "buy" ? "text-brand-green" : "text-brand-danger"}`}>{t.direction}</span>
                    <span className="num-mono text-ink-muted">{t.entryPrice ?? "—"} → {t.exitPrice ?? "—"}</span>
                    {t.setupType ? <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-ink-muted">{t.setupType}</span> : null}
                    {t.mistakeTag ? <span className="rounded bg-[#FFB020]/15 px-1.5 py-0.5 text-[11px] text-[#FFB020]">{t.mistakeTag}</span> : null}
                    {t.emotion ? <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-ink-muted">{t.emotion}</span> : null}
                    <span className={`num-mono ml-auto font-semibold ${net(t) >= 0 ? "text-brand-green" : "text-brand-danger"}`}>{money(net(t))}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {/* The plan and the review as they were written on the day — read
                only here, because editing a past day from a calendar square is
                how a journal quietly becomes a rewrite of history. */}
            {openDayReview ? (
              <div className="space-y-3">
                {([
                  ["Plan", openDayReview.pre_market_plan],
                  ["What went well", openDayReview.what_went_well],
                  ["What went wrong", openDayReview.what_went_wrong],
                  ["Tomorrow", openDayReview.tomorrow_plan],
                ] as const).filter(([, v]) => !!v).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-brand-accent">{k}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">{String(v)}</p>
                  </div>
                ))}
                {openDayReview.bias ? (
                  <p className="num-mono text-[12px] text-ink-muted">
                    bias {String(openDayReview.bias)}
                    {openDayReview.support ? ` · support ${String(openDayReview.support)}` : ""}
                    {openDayReview.resistance ? ` · resistance ${String(openDayReview.resistance)}` : ""}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[12.5px] text-ink-muted">No review was written for this day.</p>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit trade" : "Log a trade"} wide>
        {draft ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Symbol first: it decides the contract size, the live price and
                which asset class the trade lands in. */}
            <label className="col-span-2 block sm:col-span-1">
              <span className={LABEL}>Symbol</span>
              <input
                className={FIELD}
                list="gfxa-symbols"
                value={draft.symbol ?? "XAU/USD"}
                onChange={(e) => setDraft({ ...draft, symbol: e.target.value.toUpperCase() })}
                onBlur={(e) => setDraft({ ...draft, symbol: normaliseSymbolInput(e.target.value) })}
                placeholder="XAU/USD"
                autoCapitalize="characters"
                spellCheck={false}
              />
              {/* A list of suggestions, not a closed set — a member trading
                  something we have not listed should still be able to log it. */}
              <datalist id="gfxa-symbols">
                {SYMBOL_GROUPS.flatMap((g) => g.symbols.map((sym) => (
                  <option key={sym} value={sym}>{g.label}</option>
                )))}
              </datalist>
            </label>

            <div className="col-span-2 flex items-end pb-1 text-[11.5px] sm:col-span-2">
              {tick ? (
                <span className="flex items-center gap-1.5 text-ink-muted">
                  {tickLive ? (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-green" />
                    </span>
                  ) : null}
                  <span className="num-mono font-semibold text-white">{tick.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  {tick.changePercent !== null ? (
                    <span className={tick.changePercent >= 0 ? "text-brand-green" : "text-brand-danger"}>
                      {tick.changePercent >= 0 ? "▲ +" : "▼ "}{tick.changePercent.toFixed(2)}%
                    </span>
                  ) : null}
                  <span className="text-ink-muted/70">{tickLive ? "live" : "last seen"}</span>
                  <button type="button" onClick={() => setDraft({ ...draft, entryPrice: tick.price })}
                    className="ml-1 rounded border border-white/[0.12] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted hover:text-white">
                    → entry
                  </button>
                  <button type="button" onClick={() => setDraft({ ...draft, exitPrice: tick.price })}
                    className="rounded border border-white/[0.12] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted hover:text-white">
                    → exit
                  </button>
                </span>
              ) : (
                <span className="text-ink-muted/70">No live price for {draftSymbol} — enter it by hand.</span>
              )}
            </div>

            <Num label="Entry" v={draft.entryPrice} set={(n) => setDraft({ ...draft, entryPrice: n })} />
            <Num label="Exit" v={draft.exitPrice} set={(n) => setDraft({ ...draft, exitPrice: n })} />
            <Num label="Size (lots)" v={draft.size} set={(n) => setDraft({ ...draft, size: n })} />
            <Num label="Risk $" v={draft.riskUsd} set={(n) => setDraft({ ...draft, riskUsd: n })} />
            <Num label="Risk %" v={draft.riskPercent} set={(n) => setDraft({ ...draft, riskPercent: n })} />
            <Num label="RR (1:x)" v={draft.rr} set={(n) => setDraft({ ...draft, rr: n })} />
            <div>
              <Num label="P/L $" v={draft.pnl} set={(n) => setDraft({ ...draft, pnl: n })} />
              <PnlHint draft={draft} onUse={(n) => setDraft({ ...draft, pnl: n })} />
            </div>
            <Num label="Fees $" v={draft.fees} set={(n) => setDraft({ ...draft, fees: n })} />
            <Pick label="Direction" v={draft.direction ?? "buy"} opts={["buy", "sell"]} set={(v) => setDraft({ ...draft, direction: v as "buy" | "sell" })} />
            <Pick label="Setup" v={draft.setupType ?? ""} opts={SETUPS} set={(v) => setDraft({ ...draft, setupType: v || null })} free />
            <Pick label="Mistake" v={draft.mistakeTag ?? ""} opts={MISTAKES} set={(v) => setDraft({ ...draft, mistakeTag: v || null })} free />
            <Pick label="Felt" v={draft.emotion ?? ""} opts={EMOTIONS} set={(v) => setDraft({ ...draft, emotion: v || null })} free />
            <Pick label="Session" v={draft.session ?? ""} opts={[...SESSIONS]} set={(v) => setDraft({ ...draft, session: (v || null) as JournalTrade["session"] })} />
            <label className="col-span-2 sm:col-span-1"><span className={LABEL}>Closed</span>
              <input type="datetime-local" className={FIELD}
                value={(draft.closedAt ?? "").slice(0, 16)}
                onChange={(e) => setDraft({ ...draft, closedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
            <label className="col-span-2 block sm:col-span-3"><span className={LABEL}>Notes</span>
              <textarea rows={3} className={FIELD} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
            <div className="col-span-2 flex gap-2 sm:col-span-3">
              <button type="button" disabled={busy} onClick={() => void saveTrade()} className="btn-primary !px-4 !py-2.5 text-[12.5px]">
                {busy ? "Saving…" : draft.id ? "Save changes" : "Log trade"}
              </button>
              <button type="button" onClick={() => setDraft(null)} className="btn-ghost !px-4 !py-2.5 text-[12.5px]">Cancel</button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={rules} onClose={() => setRules(false)} title="Your rules">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          These are yours, not ours. The panel measures your day against them and says where you stand — it never blocks
          a trade.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Num label="Account balance $" v={settings.accountBalance} set={(n) => setSettings({ ...settings, accountBalance: n })} />
          <Num label="Risk per trade %" v={settings.riskPerTrade} set={(n) => setSettings({ ...settings, riskPerTrade: n ?? 1 })} />
          <Num label="Daily loss limit %" v={settings.dailyLossLimit} set={(n) => setSettings({ ...settings, dailyLossLimit: n ?? 3 })} />
          <Num label="Max trades / day" v={settings.maxTrades} set={(n) => setSettings({ ...settings, maxTrades: n ?? 3 })} />
          <Num label="Max losing streak" v={settings.maxLossStreak} set={(n) => setSettings({ ...settings, maxLossStreak: n ?? 2 })} />
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted/80">
          The loss limit is a percentage of the balance above. Without a balance it cannot be measured, so it is
          reported as unset rather than treated as zero.
        </p>
        <button type="button" disabled={busy} onClick={() => void saveRules()} className="btn-primary mt-5 !px-4 !py-2.5 text-[12.5px]">
          {busy ? "Saving…" : "Save rules"}
        </button>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}

/**
 * What the P/L works out to, offered rather than filled in.
 *
 * Never written automatically: the member's platform is the authority on what
 * they were actually paid, and a number this put in the box without being asked
 * would end up in the statistics as fact. For indices and crypto it says
 * nothing at all, because the contract size is broker-specific and a confident
 * wrong figure is worse than a blank.
 */
function PnlHint({ draft, onUse }: { draft: Draft; onUse: (n: number) => void }) {
  const estimate = estimatePnl(
    normaliseSymbolInput(draft.symbol ?? "XAU/USD"),
    draft.entryPrice ?? null, draft.exitPrice ?? null, draft.size ?? null,
    draft.direction ?? "buy"
  );
  if (estimate === null) return null;
  if (draft.pnl !== null && draft.pnl !== undefined && Math.abs(draft.pnl - estimate) < 0.01) return null;
  return (
    <button type="button" onClick={() => onUse(estimate)}
      className="mt-1 text-[11px] text-ink-muted underline-offset-2 hover:text-brand-accent hover:underline">
      works out to {money(estimate)} — use it
    </button>
  );
}

/* ------------------------------------------------------------------ bits */

const Td = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <td className={`whitespace-nowrap px-3 py-2 num-mono text-[12.5px] text-ink ${className}`}>{children}</td>
);

function Num({ label, v, set }: { label: string; v: number | null | undefined; set: (n: number | null) => void }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input className={FIELD} inputMode="decimal" value={v ?? ""}
        onChange={(e) => { const t = e.target.value.trim(); const n = Number.parseFloat(t); set(t === "" || !Number.isFinite(n) ? null : n); }} />
    </label>
  );
}

/** A select for the common values, with a free-text option — a member's own
 *  vocabulary for their own setups is more use than a fixed list. */
function Pick({ label, v, opts, set, free }: { label: string; v: string; opts: string[]; set: (v: string) => void; free?: boolean }) {
  const [custom, setCustom] = useState(false);
  if (free && (custom || (v && !opts.includes(v)))) {
    return (
      <label className="block"><span className={LABEL}>{label}</span>
        <input className={FIELD} value={v} placeholder="your own tag" onChange={(e) => set(e.target.value)} /></label>
    );
  }
  return (
    <label className="block"><span className={LABEL}>{label}</span>
      <select className={FIELD} value={v} onChange={(e) => { if (e.target.value === "__own") { setCustom(true); set(""); } else set(e.target.value); }}>
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        {free ? <option value="__own">+ own tag…</option> : null}
      </select>
    </label>
  );
}

function TagCard({ title, rows, empty, invert }: { title: string; rows: ReturnType<typeof byTag>; empty: string; invert?: boolean }) {
  if (!rows.length) return (
    <Card className="p-5"><CardHead title={title} /><p className="pt-4 text-[12.5px] text-ink-muted">{empty}</p></Card>
  );
  const widest = Math.max(...rows.map((r) => r.trades), 1);
  return (
    <Card>
      <CardHead title={title} />
      <ul className="divide-y divide-white/[0.05]">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-[108px] shrink-0 truncate text-[12.5px] text-white">{r.key}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <span className={`block h-full rounded-full ${invert ? "bg-[#FFB020]" : r.winRate >= 50 ? "bg-brand-green" : "bg-brand-danger"}`}
                style={{ width: `${Math.max((r.trades / widest) * 100, 4)}%` }} />
            </span>
            <span className="num-mono w-[34px] shrink-0 text-right text-[11.5px] text-ink-muted">{r.trades}</span>
            <span className="num-mono w-[42px] shrink-0 text-right text-[12px] font-semibold text-ink">{r.winRate}%</span>
            <span className={`num-mono w-[66px] shrink-0 text-right text-[12px] ${r.net >= 0 ? "text-brand-green" : "text-brand-danger"}`}>{money(r.net)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The journal's own equity curve — closed trades in order, nothing modelled. */
function MiniCurve({ points }: { points: number[] }) {
  const W = 720, H = 120, PAD = 4;
  const lo = Math.min(0, ...points), hi = Math.max(0, ...points);
  const span = hi - lo || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const up = points[points.length - 1] >= 0;
  return (
    <Card className="p-5">
      <CardHead title="Equity curve · your logged trades" />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Cumulative result of logged trades">
        <line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
        <path d={`${d} L${x(points.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={up ? "rgba(0,255,136,0.12)" : "rgba(255,92,92,0.12)"} />
        <path d={d} fill="none" stroke={up ? "#00ff88" : "#ff5c5c"} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </Card>
  );
}


"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Clock, FileLock2, LineChart, Play, ShieldCheck } from "lucide-react";
import { Card, CardHead, EmptyState, PanelHeader, Skeleton, Toast } from "@/components/ui/Primitives";
import type { IndicatorCard } from "./IndicatorsPanel";

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * How the indicator draws, as a diagram.
 *
 * Not a mock signal feed. The brief asked for /api/indicators/signals returning
 * placeholder BUY/SELL arrows, and that is the one thing this page must not do:
 * an arrow on a chart in a trading product reads as a call, and a fabricated one
 * is indistinguishable from a real one to the member looking at it. This shows
 * the drawing style with no prices, no pair and no direction claim, and the
 * caption says exactly what it is.
 */
function StyleDiagram() {
  return (
    <figure>
      <svg viewBox="0 0 320 150" className="w-full rounded-xl border border-white/[0.08] bg-black/30" role="img"
        aria-label="Diagram of how the indicator marks structure and liquidity">
        <defs>
          <pattern id="d-grid" width="32" height="30" patternUnits="userSpaceOnUse">
            <path d="M32 0 L0 0 0 30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="320" height="150" fill="url(#d-grid)" />
        {/* An abstract path, not a price series. */}
        <path d="M14 108 L48 92 L72 100 L104 62 L132 74 L164 40 L196 56 L232 30 L268 46 L304 24"
          fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinejoin="round" />
        {/* Zone */}
        <rect x="104" y="62" width="200" height="16" fill="rgba(0,255,136,0.12)" stroke="rgba(0,255,136,0.5)" strokeWidth="0.8" />
        <text x="110" y="59" fill="#00ff88" fontSize="7.5" fontFamily="ui-monospace, monospace">ZONE</text>
        {/* Structure break line */}
        <line x1="14" y1="40" x2="304" y2="40" stroke="rgba(255,176,32,0.65)" strokeWidth="1" strokeDasharray="4 3" />
        <text x="16" y="36" fill="#FFB020" fontSize="7.5" fontFamily="ui-monospace, monospace">STRUCTURE</text>
        {/* Sweep marker */}
        <circle cx="132" cy="74" r="3.4" fill="none" stroke="#00ff88" strokeWidth="1.2" />
        <text x="139" y="78" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="ui-monospace, monospace">sweep</text>
      </svg>
      <figcaption className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
        A diagram of what the script draws — zones, structure levels and sweeps. It is not a chart, not live data and
        not a trade call. Real previews arrive when the script is wired to market data.
      </figcaption>
    </figure>
  );
}

export function IndicatorDetail({ slug }: { slug: string }) {
  const [ind, setInd] = useState<IndicatorCard | null>(null);
  const [gate, setGate] = useState<{ eligible: boolean; reason: string | null } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/indicators/list", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j.ok === false) { setMessage(j.message || `HTTP ${res.status}`); setState("error"); return; }
      const found = (j.indicators as IndicatorCard[] | undefined)?.find((i) => i.slug === slug) ?? null;
      setGate(j.eligibility ?? null);
      setInd(found);
      setState(found ? "ready" : "missing");
      if (found?.access?.handle) setHandle(found.access.handle);
    } catch {
      setMessage("Could not load this indicator.");
      setState("error");
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  async function request() {
    setBusy(true);
    try {
      const res = await fetch("/api/indicators/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tradingviewUsername: handle }),
      });
      const j = await res.json();
      setToast(j.message ?? (res.ok ? "Request sent." : "Could not send that request."));
      setTimeout(() => setToast(null), 2800);
      if (res.ok) void load();
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link href="/dashboard?tab=indicators"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted transition-colors duration-200 hover:text-white">
      <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
      All indicators
    </Link>
  );

  if (state === "loading") {
    return <div className="space-y-5"><Skeleton className="h-6 w-32" /><Skeleton className="h-9 w-72" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (state !== "ready" || !ind) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState icon={FileLock2}
          title={state === "missing" ? "No such indicator" : "Could not load this indicator"}
          body={message ?? "It may have been retired, or the slug in the URL is wrong."} />
      </div>
    );
  }

  const held = ind.access?.status === "approved";
  const pending = ind.access?.status === "pending";

  return (
    <div className="space-y-6">
      {back}

      <PanelHeader
        title={ind.name}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/30 bg-brand-accent/[0.08] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-accent">
            <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
            {ind.badge ?? "Invite-only"}
          </span>
        }
      />

      <p className="num-mono text-[12px] text-ink-muted">{ind.symbol ?? "—"} · {ind.timeframe ?? "—"}</p>
      <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-ink-muted">{ind.description}</p>

      {/* ------------------------------------------------------- access box */}
      <Card className="p-5">
        <CardHead title="Your access" icon={ShieldCheck} />
        <div className="pt-4">
          {held && ind.access ? (
            <p className="text-[13px] text-brand-green">
              Active as <span className="num-mono font-bold">{ind.access.handle}</span> since{" "}
              {day(ind.access.approvedAt)} · expires {day(ind.access.expiresAt)}. Open it under Invite-only scripts in
              TradingView.
            </p>
          ) : pending && ind.access ? (
            <p className="text-[13px] text-[#FFB020]">
              Requested {day(ind.access.requestedAt)} as <span className="num-mono font-bold">{ind.access.handle}</span>.
              An admin adds the handle in TradingView by hand, so this is not instant.
            </p>
          ) : !gate?.eligible ? (
            <p className="text-[13px] text-ink-muted">
              <span className="font-semibold text-white">{gate?.reason}</span> Requesting an invite needs an approved
              membership and a verified broker deposit.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="min-w-[200px] flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">TradingView username</span>
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username"
                  autoCapitalize="off" autoCorrect="off" spellCheck={false}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-brand-accent/50" />
              </label>
              <button type="button" disabled={busy} onClick={() => void request()} className="btn-primary !px-4 !py-2.5 text-[12.5px]">
                {busy ? "Sending…" : "Request access"}
              </button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------ backtest */}
        <Card className="p-5">
          <CardHead title="Backtest" icon={LineChart} />
          <div className="pt-4">
            {ind.stats ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                {([
                  ["Win rate", ind.stats.winRate === null ? "—" : `${ind.stats.winRate}%`],
                  ["Profit factor", ind.stats.profitFactor === null ? "—" : String(ind.stats.profitFactor)],
                  ["Tested", ind.stats.testedMonths === null ? "—" : `${ind.stats.testedMonths} months`],
                ] as const).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-white/[0.07] bg-white/[0.02] py-3">
                    <p className="num-mono text-[17px] font-bold text-brand-accent">{v}</p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-ink-muted/70">{k}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-8 text-center">
                <Clock className="mx-auto h-5 w-5 text-ink-muted/70" strokeWidth={1.9} />
                <p className="mt-3 text-[13px] font-semibold text-white">No backtest published</p>
                <p className="mx-auto mt-1.5 max-w-[46ch] text-[12px] leading-relaxed text-ink-muted">
                  An equity curve and a trade list belong here. They are left blank rather than filled with sample
                  numbers — a win rate quoted without a test behind it is the one claim a trading product cannot make.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------ how it draws */}
        <Card className="p-5">
          <CardHead title="What it draws" />
          <div className="pt-4"><StyleDiagram /></div>
        </Card>
      </div>

      {/* --------------------------------------------------------- lessons */}
      <Card className="p-5">
        <CardHead title="How to use it" icon={Play} />
        <div className="pt-4">
          <div className="relative flex aspect-video max-w-2xl items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[radial-gradient(70%_70%_at_50%_40%,rgba(0,255,136,0.12),transparent_70%)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-brand-accent/40 bg-brand-accent/15 text-brand-accent shadow-glow">
              <Play className="ml-0.5 h-5 w-5" fill="currentColor" strokeWidth={0} />
            </span>
            <span className="absolute bottom-3 left-4 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              Walkthrough — not recorded yet
            </span>
          </div>
        </div>
      </Card>

      {/* ----------------------------------------------------------- terms */}
      <Card className="p-5">
        <CardHead title="Terms" icon={FileLock2} />
        <ul className="space-y-2 px-1 pt-4 text-[12.5px] leading-relaxed text-ink-muted">
          <li>· For members only. The invite is tied to your TradingView login and is not transferable.</li>
          <li>· No resale, redistribution or sharing of access.</li>
          <li>· No reverse engineering. The script source stays on TradingView as invite-only and is never served by this site.</li>
          <li>· Access can be revoked, which removes you from the script.</li>
          <li>· Educational. The script marks levels and structure; it does not tell you what to trade, and nothing here is financial advice.</li>
        </ul>
      </Card>

      <Toast message={toast} />
    </div>
  );
}

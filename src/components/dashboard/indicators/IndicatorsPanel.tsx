"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Clock, LineChart, Lock, ShieldCheck, TrendingUp } from "lucide-react";
import { Card, CardHead, EmptyState, Modal, PanelHeader, Skeleton, Toast } from "@/components/ui/Primitives";

export interface IndicatorCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  symbol: string | null;
  timeframe: string | null;
  badge: string | null;
  screenshotUrl: string | null;
  /** Null until a real backtest is published — see the migration's note. */
  stats: { winRate: number | null; profitFactor: number | null; testedMonths: number | null } | null;
  access: {
    status: "pending" | "approved" | "revoked";
    handle: string;
    approvedAt: string | null;
    expiresAt: string | null;
    requestedAt: string;
  } | null;
}

interface Payload {
  installed: boolean;
  indicators: IndicatorCard[];
  eligibility?: { eligible: boolean; reason: string | null; approved: boolean; depositVerified: boolean };
  message?: string;
}

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * A chart-shaped placeholder.
 *
 * Deliberately not a price series and deliberately not labelled with a pair: it
 * stands in for a screenshot that has not been taken yet, and a fake-looking
 * candle chart in a card that also quotes a win rate is how a showcase starts
 * implying results it cannot show.
 */
function ShotPlaceholder({ label }: { label: string }) {
  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[radial-gradient(70%_70%_at_50%_30%,rgba(0,255,136,0.12),transparent_70%)]">
      <svg viewBox="0 0 200 100" className="absolute inset-0 h-full w-full opacity-[0.22]" aria-hidden>
        <defs>
          <pattern id="grid-ind" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0 L0 0 0 20" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="200" height="100" fill="url(#grid-ind)" />
      </svg>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-accent/35 bg-brand-accent/10 text-brand-accent">
        <LineChart className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="absolute bottom-3 left-4 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </span>
    </div>
  );
}

function Shot({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <ShotPlaceholder label="Screenshot pending" />;
  return (
    <div className="aspect-video overflow-hidden rounded-xl border border-white/[0.08]">
      {/* Plain img, not next/image: these are operator-uploaded files that may
          not exist yet, and onError is what lets the card fall back cleanly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${name} on a chart`} onError={() => setFailed(true)}
        className="h-full w-full object-cover" loading="lazy" />
    </div>
  );
}

export function IndicatorsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<IndicatorCard | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/indicators/list", { cache: "no-store" });
      const j = (await res.json()) as Payload & { ok?: boolean; message?: string };
      if (!res.ok || j.ok === false) throw new Error(j.message || `HTTP ${res.status}`);
      setData(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load indicators.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  async function submit() {
    if (!open) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/indicators/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: open.slug, tradingviewUsername: handle }),
      });
      const j = await res.json();
      if (!res.ok || j.ok === false) { setFormError(j.message || "Could not send that request."); return; }
      setOpen(null);
      setHandle("");
      say(j.message ?? "Request sent.");
      void load();
    } catch {
      setFormError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PanelHeader title="GFXA Indicators" />
        <EmptyState icon={Lock} title="Indicators are not available" body={error} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!data.installed) {
    return (
      <div className="space-y-6">
        <PanelHeader title="GFXA Indicators" />
        <EmptyState icon={Lock} title="Not set up yet"
          body={data.message ?? "The indicator tables have not been created on this project."} />
      </div>
    );
  }

  const gate = data.eligibility;

  return (
    <div className="space-y-6">
      <PanelHeader
        title="GFXA Indicators"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/30 bg-brand-accent/[0.08] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-accent">
            <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
            Invite-only
          </span>
        }
      />

      {/* Three facts that are true today, in place of a usage or rating claim. */}
      <Card className="p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {([
            ["Indicators", String(data.indicators.length), "on TradingView"],
            ["Access", "Invite-only", "added by hand, per account"],
            ["Term", "365 days", "from the day it is approved"],
          ] as const).map(([label, value, sub]) => (
            <div key={label}>
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted/70">{label}</p>
              <p className="num-mono mt-1 text-[20px] font-bold text-white">{value}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">{sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {gate && !gate.eligible ? (
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#FFB020]/30 bg-[#FFB020]/10 text-[#FFB020]">
            <ShieldCheck className="h-4 w-4" strokeWidth={2} />
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-muted">
            <span className="font-semibold text-white">{gate.reason}</span>{" "}
            You can read everything here; requesting an invite needs an approved membership and a verified broker
            deposit.
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {data.indicators.map((ind) => {
          const status = ind.access?.status;
          const held = status === "approved";
          const pending = status === "pending";
          const disabled = !gate?.eligible || pending || held;

          return (
            <Card key={ind.id} className="flex flex-col p-5">
              <Shot src={ind.screenshotUrl} name={ind.name} />

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <h3 className="text-[16.5px] font-bold tracking-tight text-white">{ind.name}</h3>
                {ind.badge ? (
                  <span className="rounded-full border border-brand-accent/30 bg-brand-accent/[0.1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">
                    {ind.badge}
                  </span>
                ) : null}
              </div>

              <p className="num-mono mt-1 text-[11.5px] text-ink-muted/80">
                {ind.symbol ?? "—"} · {ind.timeframe ?? "—"}
              </p>

              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-muted">{ind.description}</p>

              {/* Performance, or an honest absence of it. */}
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                {ind.stats ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {([
                      ["Win rate", ind.stats.winRate === null ? "—" : `${ind.stats.winRate}%`],
                      ["Profit factor", ind.stats.profitFactor === null ? "—" : String(ind.stats.profitFactor)],
                      ["Tested", ind.stats.testedMonths === null ? "—" : `${ind.stats.testedMonths}m`],
                    ] as const).map(([k, v]) => (
                      <div key={k}>
                        <p className="num-mono text-[15px] font-bold text-brand-accent">{v}</p>
                        <p className="text-[10px] uppercase tracking-[0.1em] text-ink-muted/70">{k}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-[12px] text-ink-muted">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-ink-muted/70" strokeWidth={2} />
                    <span>
                      <span className="font-semibold text-white">Backtest pending.</span> No win rate is shown until one
                      has been run and published.
                    </span>
                  </p>
                )}
              </div>

              {held && ind.access ? (
                <p className="num-mono mt-3 text-[11.5px] text-brand-green">
                  Access active as {ind.access.handle} · expires {day(ind.access.expiresAt)}
                </p>
              ) : null}
              {pending && ind.access ? (
                <p className="num-mono mt-3 text-[11.5px] text-[#FFB020]">
                  Requested {day(ind.access.requestedAt)} as {ind.access.handle} · waiting on an admin
                </p>
              ) : null}
              {status === "revoked" ? (
                <p className="num-mono mt-3 text-[11.5px] text-ink-muted">Access was revoked. You can ask again.</p>
              ) : null}

              <div className="mt-5 flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={disabled}
                  title={!gate?.eligible ? gate?.reason ?? undefined : undefined}
                  onClick={() => { setHandle(ind.access?.handle ?? ""); setFormError(null); setOpen(ind); }}
                  className={`btn-primary !px-4 !py-2.5 text-[12.5px] ${disabled ? "pointer-events-none opacity-40" : ""}`}
                >
                  {held ? "Access granted" : pending ? "Request pending" : "Get access"}
                  {held ? <BadgeCheck className="h-4 w-4" strokeWidth={2.2} /> : <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />}
                </button>
                <Link href={`/dashboard/indicators/${ind.slug}`} className="btn-ghost !px-4 !py-2.5 text-[12.5px]">
                  Details
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <CardHead title="How access works" icon={TrendingUp} />
        <ol className="space-y-2.5 px-1 pt-4 text-[13px] leading-relaxed text-ink-muted">
          {[
            "Send your TradingView username. It has to match the account you chart on — the invite is tied to that login.",
            "An admin adds you to the invite-only script in TradingView by hand. There is no public API for this, so it is not instant.",
            "The indicator appears under Invite-only scripts in your TradingView account. The source stays hidden there; it is never served by this site.",
            "Access runs for 365 days from approval and can be revoked, which removes you from the script.",
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="num-mono mt-px shrink-0 text-[11px] font-bold text-brand-accent">0{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `Request ${open.name}` : ""}>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Your TradingView username, exactly as it appears on your profile. An admin uses it to add you to the
          invite-only script — a wrong handle is the one thing that cannot be actioned.
        </p>
        <label className="mt-4 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">TradingView username</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) void submit(); }}
            placeholder="@username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-[14px] text-white outline-none transition-colors duration-200 focus:border-brand-accent/50"
          />
        </label>
        {formError ? <p className="mt-2 text-[12px] font-semibold text-[#FF5C5C]">{formError}</p> : null}
        <p className="mt-2 text-[11.5px] text-ink-muted/80">
          Letters, digits and underscores, 2–25 characters. We store the handle and the decision, nothing else.
        </p>
        <div className="mt-5 flex gap-2.5">
          <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary !px-4 !py-2.5 text-[12.5px]">
            {busy ? "Sending…" : "Send request"}
          </button>
          <button type="button" onClick={() => setOpen(null)} className="btn-ghost !px-4 !py-2.5 text-[12.5px]">
            Cancel
          </button>
        </div>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}

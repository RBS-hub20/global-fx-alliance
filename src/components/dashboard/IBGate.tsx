"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Lock, ShieldCheck } from "lucide-react";
import { BROKERS, BROKER_INFO, captureFromUrl, getIBInfo, saveIBClick, type Broker } from "@/lib/ibTracking";

/**
 * Deposit gate for the dashboard.
 *
 * Worth being straight about what this is: a conversion step, not access
 * control. There is no accounts system in this project, the check clears from
 * devtools, and every panel behind it reads public API routes that answer
 * without it. It asks people who arrived through a partner link to complete the
 * step; it does not keep anyone out who does not want to be kept out. Real
 * gating needs authentication and the checks moved into the routes themselves.
 */

const VERIFIED_KEY = "gfxa-ib-verified";
const EMAIL_KEY = "gfxa-ib-email";

interface Status {
  verified: boolean;
  status: "pending" | "verified" | "rejected" | null;
  broker?: Broker;
  account?: string;
  depositUsd?: number | null;
  note?: string | null;
}

export function IBGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState("");

  // Attribution first, so a visitor arriving on a partner link is recorded even
  // if they never open the form.
  useEffect(() => {
    captureFromUrl(window.location.search);
    try {
      const saved = window.localStorage.getItem(EMAIL_KEY) ?? "";
      setEmail(saved);
      if (window.localStorage.getItem(VERIFIED_KEY) === "1") {
        setStatus({ verified: true, status: "verified" });
        setReady(true);
        if (!saved) return;
      }
      if (!saved) { setReady(true); return; }
      fetch(`/api/ib/status?email=${encodeURIComponent(saved)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: Status | null) => {
          if (!j) return;
          setStatus(j);
          if (j.verified) window.localStorage.setItem(VERIFIED_KEY, "1");
          else window.localStorage.removeItem(VERIFIED_KEY);
        })
        .catch(() => {})
        .finally(() => setReady(true));
    } catch {
      setReady(true);
    }
  }, []);

  const onVerified = useCallback((s: Status, addr: string) => {
    setStatus(s);
    try {
      window.localStorage.setItem(EMAIL_KEY, addr);
      if (s.verified) window.localStorage.setItem(VERIFIED_KEY, "1");
    } catch {
      /* private mode */
    }
  }, []);

  if (!ready) return <>{children}</>;
  if (status?.verified) return <>{children}</>;

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none max-h-[70vh] select-none overflow-hidden blur-[6px]">
        {children}
      </div>
      <GatePanel status={status} email={email} setEmail={setEmail} onVerified={onVerified} />
    </div>
  );
}

/* ------------------------------------------------------------------- panel */

function GatePanel({
  status, email, setEmail, onVerified,
}: {
  status: Status | null;
  email: string;
  setEmail: (v: string) => void;
  onVerified: (s: Status, email: string) => void;
}) {
  const [broker, setBroker] = useState<Broker | null>(null);
  const [account, setAccount] = useState("");
  const [server, setServer] = useState("");
  const [proof, setProof] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const info = getIBInfo();
    if (info) setBroker(info.broker);
  }, []);

  const link = broker ? `${BROKER_INFO[broker].host}/?ib=${encodeURIComponent(codeFor(broker))}` : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broker) { setMsg("Pick the broker you deposited with."); return; }
    setBusy(true);
    setMsg(null);
    try {
      const info = getIBInfo();
      const res = await fetch("/api/ib/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, broker, account, server: server || null,
          method: proof ? "screenshot" : "form",
          hasProof: proof,
          ibClickTime: info?.clickTime ?? null,
        }),
      });
      const j = await res.json();
      setMsg(j.message ?? (res.ok ? "Submitted." : "Something went wrong."));
      if (res.ok && j.ok) {
        onVerified({ verified: j.status === "verified", status: j.status, broker, account }, email);
      }
    } catch {
      setMsg("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (status?.status === "pending") {
    return (
      <Shell>
        <p className="text-[13px] leading-relaxed text-ink">
          <span className="font-semibold text-white">Submitted — waiting on review.</span> An admin
          confirms the deposit in {status.broker ? BROKER_INFO[status.broker].label : "the broker"}&apos;s
          IB portal and unlocks your access, usually within 24 hours.
          {status.account ? ` Account ${status.account}.` : ""}
        </p>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
          No broker in the community exposes deposits through a public partner API, so this step is a
          person checking, not an automated lookup.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-[13px] leading-relaxed text-ink-muted">
        Full access — live TwelveData quotes, the auto-drawn chart, Pattern Radar, journal analytics
        and the AI tools — opens once you hold a funded account under the Alliance&apos;s partner code.
      </p>

      <ol className="mt-5 space-y-1.5 text-[12.5px] text-ink-muted">
        {["Open an account through the partner link below", "Fund it with at least $100", "Send us the account number so an admin can confirm it"].map((s, i) => (
          <li key={s} className="flex gap-2.5">
            <span className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-brand-blue/40 text-[10px] font-bold text-brand-blue">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap gap-2">
        {BROKERS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => { setBroker(b); saveIBClick(b, codeFor(b)); }}
            aria-pressed={broker === b}
            className={`rounded-lg border px-3.5 py-2 text-[12.5px] font-medium transition-all duration-200 ${
              broker === b
                ? "border-brand-blue/50 bg-brand-blue/[0.12] text-white"
                : "border-white/[0.1] bg-white/[0.02] text-ink-muted hover:border-brand-blue/30 hover:text-ink"
            }`}
          >
            {BROKER_INFO[b].label}
          </button>
        ))}
      </div>

      {broker ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-brand-blue">{link}</code>
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded border border-white/[0.12] px-2 py-1 text-[11px] text-ink-muted transition-colors hover:text-white"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-5 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
          <Input label="Account number" value={account} onChange={setAccount} placeholder="e.g. 512334" required />
        </div>
        <Input
          label="Server (optional)"
          value={server}
          onChange={setServer}
          placeholder={broker ? BROKER_INFO[broker].serverHint : "e.g. VTMarkets-Live"}
        />

        <label className="flex items-start gap-2.5 text-[12px] leading-relaxed text-ink-muted">
          <input type="checkbox" checked={proof} onChange={(e) => setProof(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[#2A7FFF]" />
          <span>I&apos;ll email a deposit screenshot as well — tick this if your account is hard to find in the portal.</span>
        </label>

        <p className="rounded-lg border border-brand-green/25 bg-brand-green/[0.05] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
          <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-brand-green" strokeWidth={2} />
          We never ask for your investor or master password. The account number is enough for an admin
          to find the deposit in the broker&apos;s IB portal — anyone asking you for a trading password
          is not us.
        </p>

        <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5 text-[12.5px] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Submitting…" : "Submit for review"}
        </button>

        {msg ? <p className="text-[12px] leading-relaxed text-ink">{msg}</p> : null}
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 top-0 z-30 flex justify-center px-4 pt-10">
      <div className="w-full max-w-[560px] rounded-2xl border border-white/[0.1] bg-[#0A0F1E]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-blue/30 bg-brand-blue/10 text-brand-blue">
            <Lock className="h-4 w-4" strokeWidth={2} />
          </span>
          <h2 className="text-[15px] font-semibold text-white">Unlock the Alliance dashboard</h2>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, type = "text", required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-[12.5px] text-ink outline-none transition-colors focus:border-brand-blue/50"
      />
    </label>
  );
}

/**
 * Partner codes are public — they sit in the link the reader clicks — so they
 * ship in the bundle. `NEXT_PUBLIC_` keeps that explicit rather than pretending
 * a client-visible value is a secret.
 */
function codeFor(b: Broker): string {
  const env: Record<Broker, string | undefined> = {
    VTMarkets: process.env.NEXT_PUBLIC_IB_VTMARKETS,
    PUPrime: process.env.NEXT_PUBLIC_IB_PUPRIME,
    Vantage: process.env.NEXT_PUBLIC_IB_VANTAGE,
  };
  return env[b] || "SET_YOUR_CODE";
}

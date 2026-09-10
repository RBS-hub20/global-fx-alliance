"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Loader2, Lock, LogIn, ShieldCheck } from "lucide-react";
import { BROKERS, BROKER_INFO, saveIBClick, type Broker } from "@/lib/ibTracking";
import { useAuth } from "@/lib/AuthContext";
import { supabaseBrowser } from "@/lib/supabaseClient";

/**
 * Access gate for the dashboard.
 *
 * This is now a real boundary rather than a convention. Until this change,
 * "verified" was a flag in localStorage that anyone could set from devtools;
 * access is now a row in `profiles` that only the service-role key can promote,
 * and the session behind it is a Supabase JWT rather than a string in this
 * browser.
 *
 * What has not changed: the panels behind it still read API routes that answer
 * without a session. Closing that means checking the session inside those
 * routes, which is the next piece of work, not this one.
 */

const MIN_PASSWORD = 8;

export function IBGate({ children }: { children: React.ReactNode }) {
  const { ready, session, status, configured } = useAuth();

  // Not wired up yet: never trap anyone behind a gate that cannot open.
  if (!configured) return <>{children}</>;
  if (!ready) return <>{children}</>;
  if (session && status === "approved") return <>{children}</>;

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none max-h-[70vh] select-none overflow-hidden blur-[6px]">
        {children}
      </div>
      <div className="absolute inset-x-0 top-0 z-30 flex justify-center px-4 pt-10">
        <div className="w-full max-w-[560px] rounded-2xl border border-white/[0.1] bg-[#0A0F1E]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {session ? <StatusPanel status={status} /> : <SignUpPanel />}
        </div>
      </div>
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-blue/30 bg-brand-blue/10 text-brand-blue">
        <Lock className="h-4 w-4" strokeWidth={2} />
      </span>
      <h2 className="text-[15px] font-semibold text-white">{children}</h2>
    </div>
  );
}

function StatusPanel({ status }: { status: string | null }) {
  const { signOut, user } = useAuth();
  return (
    <>
      <Head>{status === "pending" ? "Waiting for approval" : "Access closed"}</Head>
      <p className="mt-4 text-[13px] leading-relaxed text-ink">
        {status === "pending" ? (
          <>
            <span className="font-semibold text-white">Submitted.</span> An admin confirms the deposit in
            the broker&apos;s IB portal and unlocks your access — usually within 24 hours. You stay signed
            in; nothing else to do.
          </>
        ) : status === "rejected" ? (
          "This application was not approved."
        ) : (
          "This account is blocked."
        )}
      </p>
      <p className="mt-3 text-[12px] text-ink-muted">Signed in as {user?.email}</p>
      <button type="button" onClick={() => void signOut()} className="mt-4 text-[12.5px] text-brand-blue hover:text-white">
        Sign out
      </button>
    </>
  );
}

function SignUpPanel() {
  const { refresh } = useAuth();
  const [broker, setBroker] = useState<Broker | null>(null);
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState("");
  const [server, setServer] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = broker ? `${BROKER_INFO[broker].host}/?ib=${encodeURIComponent(codeFor(broker))}` : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broker) { setMsg("Pick the broker you deposited with."); return; }
    if (pw.length < MIN_PASSWORD) { setMsg(`Use a password of at least ${MIN_PASSWORD} characters.`); return; }
    if (pw !== confirm) { setMsg("Those two passwords do not match."); return; }
    if (account.trim().length < 4) { setMsg("Enter the trading account number from your terminal."); return; }

    const supabase = supabaseBrowser();
    if (!supabase) { setMsg("Registration is unavailable right now."); return; }

    setBusy(true);
    setMsg(null);
    const addr = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({ email: addr, password: pw });
    if (error) { setBusy(false); setMsg(error.message); return; }

    const uid = data.user?.id;
    if (!uid) {
      setBusy(false);
      setMsg("Check your inbox to confirm the address, then sign in.");
      return;
    }

    /*
     * `status` is not sent. The insert policy only accepts a pending row, so
     * naming it here would be theatre — and leaving it out makes it obvious that
     * the client never chooses its own access level.
     */
    const { error: perr } = await supabase.from("profiles").insert({
      id: uid,
      email: addr,
      account_number: account.trim(),
      server: server.trim() || null,
      broker: BROKER_INFO[broker].label,
    });

    setBusy(false);
    if (perr) { setMsg(`Registered, but the application did not save: ${perr.message}`); return; }
    await refresh();
    setMsg("Submitted. Waiting for admin approval.");
  };

  return (
    <>
      <Head>Unlock the Alliance dashboard</Head>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
        Open an account through the partner link, fund it, then register below. An admin confirms it in
        the broker&apos;s portal and your access opens.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded border border-white/[0.12] px-2 py-1 text-[11px] text-ink-muted hover:text-white"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <In label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <In label="Account number" value={account} onChange={setAccount} placeholder="e.g. 512334" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <In label="Password" type="password" value={pw} onChange={setPw} autoComplete="new-password" hint={`At least ${MIN_PASSWORD} characters.`} />
          <In label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
        <In label="Server (optional)" value={server} onChange={setServer} placeholder={broker ? BROKER_INFO[broker].serverHint : "e.g. VTMarkets-Live"} required={false} />

        <p className="rounded-lg border border-brand-green/25 bg-brand-green/[0.05] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
          <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-brand-green" strokeWidth={2} />
          This password is for the Alliance dashboard only. We never ask for your investor or master
          trading password — anyone who does is not us.
        </p>

        <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5 text-[12.5px] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Submitting…" : "Create account"}
        </button>
        {msg ? <p className="text-[12px] leading-relaxed text-ink">{msg}</p> : null}
      </form>

      <Link href="/login" className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-brand-blue hover:text-white">
        <LogIn className="h-3.5 w-3.5" strokeWidth={2} />
        Already a member? Sign in
      </Link>
    </>
  );
}

function In({
  label, value, onChange, placeholder, type = "text", autoComplete, required = true, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; autoComplete?: string; required?: boolean; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand-blue/50"
      />
      {hint ? <span className="text-[11px] text-ink-muted/70">{hint}</span> : null}
    </label>
  );
}

/** Partner codes are public — they sit in the link the reader clicks. */
function codeFor(b: Broker): string {
  const env: Record<Broker, string | undefined> = {
    VTMarkets: process.env.NEXT_PUBLIC_IB_VTMARKETS,
    PUPrime: process.env.NEXT_PUBLIC_IB_PUPRIME,
    Vantage: process.env.NEXT_PUBLIC_IB_VANTAGE,
  };
  return env[b] || "SET_YOUR_CODE";
}

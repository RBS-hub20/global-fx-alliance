"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Lock, LogIn, ShieldCheck } from "lucide-react";
import { BROKERS, BROKER_INFO, saveIBClick, type Broker } from "@/lib/ibTracking";
import { useAuth } from "@/lib/AuthContext";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { splitName } from "@/lib/displayName";

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
  if (session && status === "approved") return <>{children}</>;

  /*
   * Session still resolving. Rendering children here flashed the whole dashboard
   * to someone who is not approved before the gate caught up; rendering the gate
   * here flashes a sign-up form at a member who is. Neither, briefly, is right.
   */
  if (!ready) {
    return (
      <div className="relative">
        <div aria-hidden className="pointer-events-none max-h-[70vh] select-none overflow-hidden blur-[6px]">
          {children}
        </div>
        <div className="absolute inset-x-0 top-0 z-30 flex justify-center px-4 pt-10">
          <div className="rounded-xl border border-white/[0.1] bg-[#0A0F1E]/95 px-5 py-4 text-[12.5px] text-ink-muted backdrop-blur-xl">
            Checking your access…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none max-h-[70vh] select-none overflow-hidden blur-[6px]">
        {children}
      </div>
      {/*
        * On a 390x844 phone this panel measured 866px tall and the submit button
        * sat at y=903 — past the fold, under a bottom nav that starts at 784. It
        * is now a bounded flex column: the body scrolls and the footer holds its
        * place, so the button is reachable at any height. dvh rather than vh so
        * the browser chrome and the on-screen keyboard are accounted for.
        */}
      {/*
        * Fixed to the viewport, not absolute inside <main>. Absolute inherited the
        * sticky header's offset, so a height capped at 100dvh still ended 57px
        * behind the bottom nav — with the submit button in exactly that band. The
        * padding here reserves the header above and the nav (plus the home
        * indicator) below, and max-h-full then bounds the panel to what is left.
        */}
      <div className="fixed inset-0 z-40 flex justify-center overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-24 lg:pb-10 lg:pt-28">
        <div className="flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A0F1E]/95 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
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
  const { signOut, user, refresh } = useAuth();

  /*
   * An admin approving someone who is sitting on this screen should not require
   * them to guess that a reload is needed. Only while pending, and only every
   * 30s — this is one row by primary key.
   */
  useEffect(() => {
    if (status !== "pending") return;
    const id = setInterval(() => { void refresh(); }, 30_000);
    return () => clearInterval(id);
  }, [status, refresh]);

  return (
    <div className="overflow-y-auto p-6">
      <Head>{status === "pending" ? "Waiting for approval" : status === "banned" ? "Account restricted" : "Access closed"}</Head>
      <p className="mt-4 text-[13px] leading-relaxed text-ink">
        {status === "pending" ? (
          <>
            <span className="font-semibold text-white">Submitted.</span> An admin confirms the deposit in
            the broker&apos;s IB portal and unlocks your access — usually within 24 hours. You stay signed
            in; nothing else to do.
          </>
        ) : status === "rejected" ? (
          "This application was not approved. If your access was removed, an admin can tell you why."
        ) : (
          "Account restricted. This address cannot be registered again — contact an admin if you think that is a mistake."
        )}
      </p>
      <p className="mt-3 text-[12px] text-ink-muted">Signed in as {user?.email}</p>
      <button type="button" onClick={() => void signOut()} className="mt-4 text-[12.5px] text-brand-blue hover:text-white">
        Sign out
      </button>
    </div>
  );
}

function SignUpPanel() {
  const { refresh } = useAuth();
  const [broker, setBroker] = useState<Broker | null>(null);
  const [fullName, setFullName] = useState("");
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
    if (fullName.trim().length < 2) { setMsg("Enter the name you want the Alliance to know you by."); return; }
    if (pw.length < MIN_PASSWORD) { setMsg(`Use a password of at least ${MIN_PASSWORD} characters.`); return; }
    if (pw !== confirm) { setMsg("Those two passwords do not match."); return; }
    if (account.trim().length < 4) { setMsg("Enter the trading account number from your terminal."); return; }

    const supabase = supabaseBrowser();
    if (!supabase) { setMsg("Registration is unavailable right now."); return; }

    setBusy(true);
    setMsg(null);
    const addr = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({ email: addr, password: pw });
    if (error) {
      setBusy(false);
      /*
       * A removed member re-registering lands here: Supabase Auth keeps the
       * address unique and `profiles.email` is unique too, so the same address
       * cannot come back through this form. Said plainly rather than as
       * "User already registered", which reads like a bug.
       *
       * Deliberately not a pre-flight "is this address banned?" endpoint: that
       * would answer for any address anyone typed, which is a membership
       * lookup for the whole site.
       */
      const taken = /already registered|already exists/i.test(error.message);
      setMsg(taken ? "That address is already registered. Sign in below — or contact an admin if your access was removed." : error.message);
      return;
    }

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
    const row: Record<string, unknown> = {
      id: uid,
      email: addr,
      account_number: account.trim(),
      server: server.trim() || null,
      broker: BROKER_INFO[broker].label,
      ...splitName(fullName),
    };

    /*
     * The name columns are a later migration. If the project has not run
     * supabase/profiles_add_name_columns.sql yet, PostgREST rejects the whole
     * insert over the first column it does not recognise — which would turn a
     * cosmetic feature into "nobody can register". The name is dropped instead,
     * one column at a time, so registration keeps working on the old schema.
     */
    let perr: { message: string } | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await supabase.from("profiles").insert(row);
      perr = res.error;
      if (!perr) break;
      const missing = perr.message.match(/Could not find the '([^']+)' column/)?.[1];
      if (!missing || !(missing in row) || ["id", "email", "account_number", "broker"].includes(missing)) break;
      delete row[missing];
    }

    setBusy(false);
    if (perr) { setMsg(`Registered, but the application did not save: ${perr.message}`); return; }
    await refresh();
    setMsg("Submitted. Waiting for admin approval.");
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-white/[0.07] px-6 pb-4 pt-6">
        <Head>Unlock the Alliance dashboard</Head>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <p className="text-[13px] leading-relaxed text-ink-muted">
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

      <div className="mt-5 space-y-3">
        {/*
          * Asked for rather than derived. A name cannot be read reliably off an
          * address — "afhomesresort2027" has no word boundaries in it — and the
          * fallback that guesses gets people's names wrong in public, next to
          * their posts.
          */}
        <In
          label="Your name"
          value={fullName}
          onChange={setFullName}
          placeholder="e.g. Renmar Sombilon"
          autoComplete="name"
          hint="Shown on your profile and your posts."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <In label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <In label="Account number" value={account} onChange={setAccount} placeholder="e.g. 512334" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <In label="Password" type="password" value={pw} onChange={setPw} autoComplete="new-password" />
          <In label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>

        {/*
          * The warning used to be a full bordered box under the fields, which on
          * a phone pushed the submit button off the screen entirely. It says the
          * same thing in one line beside the rule it is about.
          */}
        <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-[2px] h-3.5 w-3.5 shrink-0 text-brand-green" strokeWidth={2} />
          <span>
            At least {MIN_PASSWORD} characters. This is your Alliance password — we never ask for your
            investor or master trading password.
          </span>
        </p>

        {/* Optional, so it costs no height until someone wants it. */}
        <details className="rounded-lg border border-white/[0.08] bg-white/[0.02]">
          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] text-ink-muted">
            Add your server <span className="text-ink-muted/60">(optional)</span>
          </summary>
          <div className="px-3 pb-3">
            <In
              label="Server"
              value={server}
              onChange={setServer}
              placeholder={broker ? BROKER_INFO[broker].serverHint : "e.g. VTMarkets-Live"}
              required={false}
            />
          </div>
        </details>

      </div>
      </div>

      {/* Outside the scroll area, so it is reachable at any viewport height. */}
      <div className="shrink-0 border-t border-white/[0.07] bg-[#0A0F1E]/95 px-6 py-4">
        <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5 text-[12.5px] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Submitting…" : "Create account"}
        </button>
        {/* In the pinned footer, not the scroll area: at the bottom of a
            scrolling body this sat under the mobile nav and could not be tapped. */}
        <Link href="/login" className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] text-brand-blue hover:text-white">
          <LogIn className="h-3.5 w-3.5" strokeWidth={2} />
          Already a member? Sign in
        </Link>
        {msg ? <p className="mt-2 text-[12px] leading-relaxed text-ink">{msg}</p> : null}
      </div>
    </form>
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

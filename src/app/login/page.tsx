"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell, Field, Notice } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/AuthContext";
import { safeNext } from "@/lib/authRedirect";
import { supabaseBrowser } from "@/lib/supabaseClient";

/**
 * Sign in.
 *
 * Email and password only. The account number was collected once at signup and
 * lives on the profile row, so a member coming back on a new phone or a cleared
 * browser never has to find it again.
 */
function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, session, status, user } = useAuth();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the address exists but has not been confirmed.
  const [unverified, setUnverified] = useState(params.get("verify") === "1");
  const [resent, setResent] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  /*
   * Already signed in, approved and confirmed: skip the form. The confirmation
   * check matters — the middleware sends an unconfirmed member here, and
   * without it this effect would send them straight back, forever.
   */
  useEffect(() => {
    if (ready && session && status === "approved" && user?.email_confirmed_at) router.replace(next);
  }, [ready, session, status, user?.email_confirmed_at, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = supabaseBrowser();
    if (!supabase) { setError("Sign-in is unavailable right now."); return; }

    setBusy(true);
    setError(null);
    setUnverified(false);
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (err) {
      setBusy(false);
      if (/email not confirmed/i.test(err.message)) { setUnverified(true); return; }
      // Supabase says "Invalid login credentials" for both a wrong password and
      // an unknown address, which is the right answer: distinguishing them tells
      // an attacker which emails are registered.
      setError(err.message === "Invalid login credentials" ? "That email and password do not match." : err.message);
      return;
    }

    // Belt and braces for a project whose confirmation setting changed after
    // accounts were created: signed in, but not allowed in yet.
    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut({ scope: "local" });
      setBusy(false);
      setUnverified(true);
      return;
    }

    setBusy(false);
    router.replace(next);
  };

  const resend = async () => {
    const supabase = supabaseBrowser();
    const addr = email.trim().toLowerCase();
    if (!supabase || !addr) return;
    setResent("sending");
    const { error: err } = await supabase.auth.resend({ type: "signup", email: addr });
    setResent(err ? "failed" : "sent");
  };

  if (ready && session && status && status !== "approved") {
    return (
      <AuthShell title="You are signed in" blurb="Your membership is not open yet.">
        <Notice tone={status === "pending" ? "wait" : "error"}>
          {status === "pending"
            ? "Waiting for admin approval. We check the broker's IB portal and unlock your access — usually within 24 hours."
            : status === "rejected"
              ? "This application was not approved. Reply to your submission email if you think that is wrong."
              : "This account is blocked."}
        </Notice>
        <Link href="/" className="mt-4 inline-block text-[12.5px] text-brand-blue hover:text-white">
          Back to the site
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in"
      blurb="Email and password — nothing else. Your account number is already on file."
      footer={
        <>
          Not a member yet?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-brand-blue hover:text-white">
            Apply for access
          </Link>
        </>
      }
    >
      {params.get("signed_out") === "1" && !error && !unverified ? (
        <Notice tone="ok">Signed out. Your session was ended on every device.</Notice>
      ) : null}

      <form onSubmit={submit} noValidate className={params.get("signed_out") === "1" ? "mt-4" : ""}>
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" disabled={busy || !email || !password} className="btn-primary mt-1 w-full !py-2.5 text-[13px] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>

      {unverified ? (
        <Notice tone="wait">
          Verify your email first. We sent a confirmation link when you registered — open it, then sign in here.{" "}
          {email ? (
            <button type="button" onClick={() => void resend()} disabled={resent === "sending" || resent === "sent"}
              className="underline underline-offset-2 disabled:no-underline disabled:opacity-70">
              {resent === "sent" ? "Link sent." : resent === "sending" ? "Sending…" : resent === "failed" ? "Could not send — try again." : "Send it again"}
            </button>
          ) : (
            "Enter your email above to have it sent again."
          )}
        </Notice>
      ) : null}

      <Link href="/forgot-password" className="mt-4 inline-block text-[12.5px] text-ink-muted hover:text-white">
        Forgot your password?
      </Link>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#070A12]" />}>
      <LoginInner />
    </Suspense>
  );
}

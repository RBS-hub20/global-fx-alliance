"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, Field, Notice } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/AuthContext";
import { supabaseBrowser } from "@/lib/supabaseClient";

/**
 * Sign in.
 *
 * Email and password only. The account number was collected once at signup and
 * lives on the profile row, so a member coming back on a new phone or a cleared
 * browser never has to find it again.
 */
export default function LoginPage() {
  const router = useRouter();
  const { ready, session, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in and approved: skip the form entirely.
  useEffect(() => {
    if (ready && session && status === "approved") router.replace("/dashboard");
  }, [ready, session, status, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = supabaseBrowser();
    if (!supabase) { setError("Sign-in is unavailable right now."); return; }

    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);

    if (err) {
      // Supabase says "Invalid login credentials" for both a wrong password and
      // an unknown address, which is the right answer: distinguishing them tells
      // an attacker which emails are registered.
      setError(err.message === "Invalid login credentials" ? "That email and password do not match." : err.message);
      return;
    }
    router.replace("/dashboard");
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
          <Link href="/dashboard" className="text-brand-blue hover:text-white">Apply for access</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" disabled={busy || !email || !password} className="btn-primary mt-1 w-full !py-2.5 text-[13px] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
      <Link href="/forgot-password" className="mt-4 inline-block text-[12.5px] text-ink-muted hover:text-white">
        Forgot your password?
      </Link>
    </AuthShell>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, Field, Notice } from "@/components/auth/AuthShell";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = supabaseBrowser();
    if (!supabase) { setError("Password reset is unavailable right now."); return; }

    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);

    // Reported as sent either way: telling the visitor an address is unknown
    // turns this form into a way to enumerate members.
    if (err && !/rate/i.test(err.message)) setSent(true);
    else if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <AuthShell
      title="Reset your password"
      blurb="We will email you a link to set a new one."
      footer={<Link href="/login" className="text-brand-blue hover:text-white">Back to sign in</Link>}
    >
      {sent ? (
        <Notice tone="ok">
          If that address belongs to a member, a reset link is on its way. It expires in an hour.
        </Notice>
      ) : (
        <form onSubmit={submit} noValidate>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <button type="submit" disabled={busy || !email} className="btn-primary mt-1 w-full !py-2.5 text-[13px] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Sending…" : "Send reset link"}
          </button>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </form>
      )}
    </AuthShell>
  );
}

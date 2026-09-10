"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, Field, Notice } from "@/components/auth/AuthShell";
import { supabaseBrowser } from "@/lib/supabaseClient";

/**
 * Where the emailed reset link lands.
 *
 * Not in the brief, but without it the reset flow has no second half — the email
 * would drop the member on a page that does not exist. Supabase turns the link's
 * token into a session on arrival, so this only has to collect the new password.
 */
/** Next permits only its own exports from a page file, so this stays local. */
const MIN_PASSWORD = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) return;
    // The recovery token in the URL becomes a session before this resolves.
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters.`); return; }
    if (pw !== confirm) { setError("Those two passwords do not match."); return; }

    const supabase = supabaseBrowser();
    if (!supabase) { setError("Password reset is unavailable right now."); return; }

    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => router.replace("/login"), 1800);
  };

  return (
    <AuthShell
      title="Set a new password"
      footer={<Link href="/login" className="text-brand-blue hover:text-white">Back to sign in</Link>}
    >
      {done ? (
        <Notice tone="ok">Password changed. Taking you to sign in…</Notice>
      ) : !ready ? (
        <Notice tone="wait">
          Open this page from the link in your reset email — that link is what authorises the change.
        </Notice>
      ) : (
        <form onSubmit={submit} noValidate>
          <Field label="New password" type="password" value={pw} onChange={setPw} autoComplete="new-password" hint={`At least ${MIN_PASSWORD} characters.`} />
          <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <button type="submit" disabled={busy} className="btn-primary mt-1 w-full !py-2.5 text-[13px] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Saving…" : "Save password"}
          </button>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </form>
      )}
    </AuthShell>
  );
}

"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { SignUpPanel } from "@/components/dashboard/IBGate";
import { useAuth } from "@/lib/AuthContext";
import { safeNext } from "@/lib/authRedirect";

/**
 * Sign-up, outside the dashboard.
 *
 * The form used to exist only inside the dashboard's access gate. Once the
 * middleware started sending signed-out visitors to /login, that made it
 * unreachable: /login's "Apply for access" pointed back at /dashboard, which
 * redirected to /login. This is the same form component, so nothing about what
 * is collected or how it is stored changed.
 */
function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, session, status } = useAuth();
  const next = safeNext(params.get("next"));

  /*
   * Onward only once a profile row exists (status is set). A session with no
   * profile means the account was created but the application did not save —
   * sending that member to the dashboard would show "Access closed" with no
   * explanation, so the form stays up with its error instead.
   */
  useEffect(() => {
    if (ready && session && status) router.replace(next);
  }, [ready, session, status, next, router]);

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#0A0A0A] px-4 py-8">
      <Link href="/" className="mb-6 flex justify-center"><Logo size={34} /></Link>
      <div className="flex max-h-[calc(100dvh-7rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#141414]/95 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
        <SignUpPanel />
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0A0A0A]" />}>
      <SignupInner />
    </Suspense>
  );
}

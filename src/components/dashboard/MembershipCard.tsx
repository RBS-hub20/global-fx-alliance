import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { MEMBERSHIP_BENEFITS } from "@/lib/data";

export function MembershipCard() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-blue/30 bg-membership shadow-glow">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-brand-blue/25 blur-3xl" />

      <div className="relative p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-[0.08em] text-white">GFXA PRO</h2>
            <p className="mt-1 text-[12px] text-ink-muted">Your Membership</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/[0.15] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-green">
            <ShieldCheck className="h-3 w-3" strokeWidth={2.4} />
            Pro
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">Status</p>
            <p className="mt-1.5 text-[13.5px] font-bold text-white">PRO Verified</p>
            <p className="text-[11.5px] text-ink-muted">Member</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">Reputation</p>
            <p className="mt-1.5 num-mono text-[20px] font-bold leading-none text-white">2,480</p>
            <p className="mt-1 text-[11.5px] text-ink-muted">Top 4% globally</p>
          </div>
        </div>

        <ul className="mt-6 space-y-2.5">
          {MEMBERSHIP_BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-2.5 text-[13px] text-ink">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-blue/20">
                <Check className="h-2.5 w-2.5 text-brand-blue" strokeWidth={3} />
              </span>
              {b}
            </li>
          ))}
        </ul>

        <Link
          href="/dashboard"
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-[13px] font-semibold text-white transition-all duration-200 hover:border-white/50 hover:bg-white/[0.06] active:scale-[0.98]"
        >
          View Membership
          <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      </div>
    </section>
  );
}

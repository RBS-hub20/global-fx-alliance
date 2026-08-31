"use client";

import { useState } from "react";
import { Check, Copy, Receipt, ShieldCheck } from "lucide-react";
import { Card, CardHead, PanelHeader, Toast, money } from "@/components/ui/Primitives";
import { MEMBERSHIP_BENEFITS } from "@/lib/data";
import { BILLING } from "@/lib/content";

const REFERRAL = "https://globalfxalliance.com/join?ref=renmar";

export function MembershipPanel() {
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL);
      flash("Referral link copied");
    } catch {
      flash("Copy failed — select the link manually");
    }
  };

  return (
    <div className="space-y-6">
      <PanelHeader title="Membership" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="relative overflow-hidden rounded-2xl border border-brand-blue/30 bg-membership shadow-glow">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-blue/25 blur-3xl" />
          <div className="relative p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[20px] font-bold tracking-[0.06em] text-white">GFXA PRO</h3>
                <p className="mt-1 text-[13px] text-ink-muted">Your membership</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/[0.15] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-green">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
                Active
              </span>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                <p className="text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">Status</p>
                <p className="mt-2 text-[15px] font-bold text-white">PRO Verified</p>
                <p className="text-[12px] text-ink-muted">Renews Sep 1, 2026</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                <p className="text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">Reputation</p>
                <p className="num-mono mt-2 text-[24px] font-bold leading-none text-white">2,480</p>
                <p className="mt-1 text-[12px] text-ink-muted">Top 4% globally</p>
              </div>
            </div>

            <ul className="mt-7 space-y-3">
              {MEMBERSHIP_BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-3 text-[13.5px] text-ink">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue/20">
                    <Check className="h-3 w-3 text-brand-blue" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => flash("Opening billing portal…")}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-[13px] font-semibold text-white transition-all duration-200 hover:border-white/50 hover:bg-white/[0.06] active:scale-[0.98]"
            >
              Manage Membership
            </button>
          </div>
        </section>

        <div className="space-y-5">
          <Card>
            <CardHead title="Referral" icon={Copy} />
            <div className="p-5">
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Invite a trader. When they join, you both receive 250 reputation — never a cash
                commission.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5">
                <input
                  readOnly
                  value={REFERRAL}
                  aria-label="Your referral link"
                  className="min-w-0 flex-1 truncate bg-transparent px-2.5 py-2 text-[12.5px] text-ink-muted outline-none"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="shrink-0 rounded-lg bg-brand-blue px-3 py-2 text-[12px] font-semibold text-white transition-all duration-200 hover:bg-[#4A93FF] hover:shadow-glow active:scale-95"
                >
                  Copy
                </button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Billing History" icon={Receipt} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Date", "Plan", "Amount", "Status"].map((h, i) => (
                      <th key={h} className={`px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted/70 ${i >= 2 ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {BILLING.map((b) => (
                    <tr key={b.date}>
                      <td className="whitespace-nowrap px-5 py-3 text-[12.5px] text-ink-muted">{b.date}</td>
                      <td className="px-5 py-3 text-[12.5px] text-ink">{b.plan}</td>
                      <td className="num-mono px-5 py-3 text-right text-[12.5px] text-white">{money(b.amount, 0)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="rounded-full bg-brand-green/[0.13] px-2 py-0.5 text-[10.5px] font-semibold text-brand-green">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

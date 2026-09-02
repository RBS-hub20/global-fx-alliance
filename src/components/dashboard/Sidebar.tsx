"use client";

import Link from "next/link";
import { TabIcon } from "./TabIcon";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { TABS, TAB_GROUPS, tabHref } from "@/lib/tabs";

export function Sidebar({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-white/[0.08] bg-[#080C18]">
      <div className="flex h-[72px] shrink-0 items-center border-b border-white/[0.08] px-6">
        <Link href="/" aria-label="GLOBAL FX ALLIANCE home">
          <Logo size={34} tagline wordmarkClass="text-[13px]" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6">
        {TAB_GROUPS.map((group) => (
          <div key={group} className="mb-7 last:mb-0">
            <p className="px-3 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted/70">
              {group}
            </p>
            <ul className="space-y-0.5">
              {TABS.filter((t) => t.group === group).map((tab) => {
                const on = tab.slug === active;
                return (
                  <li key={tab.slug}>
                    <Link
                      href={tabHref(tab.slug)}
                      onClick={onNavigate}
                      aria-current={on ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ${
                        on
                          ? "bg-brand-blue text-white shadow-[0_0_20px_rgba(42,127,255,0.3)]"
                          : "text-ink-muted hover:bg-white/[0.05] hover:text-ink"
                      }`}
                    >
                      <TabIcon
                        tab={tab}
                        onFilled={on}
                        className={`h-[17px] w-[17px] shrink-0 ${
                          on ? "text-white" : "text-ink-muted group-hover:text-ink"
                        }`}
                        strokeWidth={1.8}
                      />
                      <span className="truncate">{tab.label}</span>
                      {tab.badge ? (
                        <span
                          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold num-mono ${
                            on ? "bg-white/20 text-white" : "bg-brand-blue/15 text-brand-blue"
                          }`}
                        >
                          {tab.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.08] p-4">
        <div className="rounded-xl border border-brand-blue/25 bg-membership p-4 shadow-glow">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-green" strokeWidth={2} />
            <span className="text-[12px] font-bold tracking-[0.1em] text-white">GFXA PRO</span>
          </div>
          <p className="mt-2 text-[12px] text-ink-muted">Verified Member</p>
          <p className="mt-3 num-mono text-[20px] font-bold leading-none text-white">
            2,480 <span className="text-[12px] font-medium text-ink-muted">Rep</span>
          </p>
          <Link
            href={tabHref("membership")}
            onClick={onNavigate}
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-blue transition-colors duration-200 hover:text-white"
          >
            View Membership
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </div>
  );
}

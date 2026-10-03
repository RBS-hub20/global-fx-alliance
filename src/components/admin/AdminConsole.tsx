"use client";

import { useState } from "react";
import { AcademyTab } from "./AcademyTab";
import { CrmTab } from "./CrmTab";
import { DepositsTab } from "./DepositsTab";
import { SecurityTab, SettingsTab } from "./HealthTabs";
import { OverviewTab, type Stats } from "./OverviewTab";
import { PixelTab } from "./PixelTab";
import { LiveDot, ago, useJson } from "./bits";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "crm", label: "CRM" },
  { key: "academy", label: "Academy" },
  { key: "pixel", label: "Pixel" },
  { key: "deposits", label: "Deposits" },
  { key: "security", label: "Security" },
  { key: "settings", label: "Settings" },
] as const;

type Key = (typeof TABS)[number]["key"];

export function AdminConsole({ email }: { email: string }) {
  const [tab, setTab] = useState<Key>("overview");
  /*
   * One poll for the whole console. Ten seconds matches the five-minute live
   * window — faster would re-render the same number, slower would make "here
   * now" a claim about the past.
   */
  const stats = useJson<Stats>("/api/admin/stats", 10_000);
  const live = stats.data?.now.total ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-20 border-b border-[#262626] bg-[#0a0a0a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[13px] font-bold tracking-[0.18em] text-[#00ff88]">GFXA</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#737373]">admin</span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-[#262626] bg-[#141414] px-3 py-1">
            <LiveDot live={live > 0} />
            <span className="font-mono text-[12px] font-bold tabular-nums text-white">{live}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#737373]">on site</span>
          </div>

          {/*
            * The badge the brief asked for, written as what it is. The number on
            * /join and /l/free is a target, not a headcount — profiles has far
            * fewer rows than that, and the Settings tab shows both.
            */}
          <span className="rounded-full border border-[#facc15]/30 bg-[#facc15]/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#facc15]">
            5,000+ badge · target, not a headcount
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden font-mono text-[11px] text-[#737373] sm:inline">
              {stats.updatedAt ? `updated ${ago(new Date(stats.updatedAt).toISOString())}` : "…"}
            </span>
            <span className="font-mono text-[11px] text-[#a3a3a3]">{email}</span>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                tab === t.key
                  ? "bg-[#00ff88]/10 text-[#00ff88] ring-1 ring-inset ring-[#00ff88]/40"
                  : "text-[#737373] hover:bg-[#141414] hover:text-[#d4d4d4]"}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {tab === "overview" ? <OverviewTab loaded={stats} /> : null}
        {tab === "crm" ? <CrmTab /> : null}
        {tab === "academy" ? <AcademyTab /> : null}
        {tab === "pixel" ? <PixelTab loaded={stats} /> : null}
        {tab === "deposits" ? <DepositsTab /> : null}
        {tab === "security" ? <SecurityTab /> : null}
        {tab === "settings" ? <SettingsTab /> : null}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-[11px] leading-relaxed text-[#525252]">
        Every figure here is counted from this project&apos;s own tables at request time. Where a number has no source
        in this repository — the Telegram funnel past the CTA click, Meta&apos;s own event totals — the tab says so
        instead of showing a zero that reads like a measurement.
      </footer>
    </div>
  );
}

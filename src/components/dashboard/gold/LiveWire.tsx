"use client";

import { useState } from "react";
import { CARD, Head } from "@/components/dashboard/terminal/TerminalBits";

export interface WireStory {
  id: string; title: string; url: string | null; source: string;
  publishedAt: string | null; timeAgo: string; dubai: string | null;
  tags: string[]; bias: "bullish" | "bearish" | "neutral"; impact: "HIGH" | "MEDIUM" | "LOW"; why: string;
}
export interface WireSource { provider: string; ok: boolean; items: number; kept: number }

const TABS = [
  { key: "All", match: () => true },
  { key: "Gold", match: (s: WireStory) => s.tags.includes("Gold") },
  { key: "Fed", match: (s: WireStory) => s.tags.includes("Fed") || s.tags.includes("Data") },
  // Yields ride with the dollar here: both reach gold through the same channel.
  { key: "DXY", match: (s: WireStory) => s.tags.includes("DXY") || s.tags.includes("Yields") },
] as const;

const BORDER = { bullish: "#00ff88", bearish: "#ff4d4d", neutral: "#262626" } as const;
const BIAS_TEXT = { bullish: "text-[#00ff88]", bearish: "text-[#ff4d4d]", neutral: "text-[#a3a3a3]" } as const;
const IMPACT = {
  HIGH: "border-[#ff4d4d]/50 text-[#ff4d4d]",
  MEDIUM: "border-[#facc15]/50 text-[#facc15]",
  LOW: "border-[#262626] text-[#525252]",
} as const;

export function LiveWire({ stories, sources, updated, loading }: {
  stories: WireStory[] | null; sources: WireSource[]; updated: string | null; loading: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("Gold");
  const list = (stories ?? []).filter(TABS.find((t) => t.key === tab)!.match);
  const up = sources.filter((s) => s.ok);
  const down = sources.filter((s) => !s.ok).map((s) => s.provider);

  return (
    <div className={CARD}>
      <Head right={
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#525252]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff88] opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
          </span>
          <span className="hidden sm:inline">30s ·</span> {updated ?? "—"}
        </span>
      }>
        XAUUSD LIVE WIRE
      </Head>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#262626] px-4 py-2">
        {TABS.map((t) => {
          const n = (stories ?? []).filter(t.match).length;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
              className={`rounded px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] transition-colors ${
                tab === t.key ? "bg-[#00ff88] text-[#0a0a0a]" : "border border-[#262626] text-[#a3a3a3] hover:text-[#e5e5e5]"
              }`}>
              {t.key} <span className={tab === t.key ? "opacity-60" : "text-[#525252]"}>{n}</span>
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[10px] text-[#525252]" title={down.length ? `Unreachable: ${down.join(", ")}` : undefined}>
          {up.length}/{sources.length || 3} feeds
        </span>
      </div>

      <div className="max-h-[640px] space-y-2 overflow-y-auto p-3">
        {loading && stories === null ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded bg-[#0a0a0a]" />)
        ) : !stories?.length ? (
          <p className="px-1 py-4 font-mono text-[11.5px] leading-relaxed text-[#a3a3a3]">
            {up.length === 0
              ? "No gold news yet — every feed is unreachable right now. Nothing is shown in its place."
              : "No gold news yet — nothing on the live feeds in the last 36 hours bears on XAU/USD."}
          </p>
        ) : list.length === 0 ? (
          <p className="px-1 py-4 font-mono text-[11.5px] leading-relaxed text-[#a3a3a3]">
            Nothing tagged {tab} in the last 36 hours. {stories.length} other gold-relevant stor{stories.length === 1 ? "y is" : "ies are"} under All.
          </p>
        ) : (
          list.map((s) => (
            <article key={s.id} className="rounded border border-[#262626] bg-[#141414] px-3 py-2.5" style={{ borderLeftWidth: 2, borderLeftColor: BORDER[s.bias] }}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded border px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${IMPACT[s.impact]}`}>{s.impact}</span>
                <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${BIAS_TEXT[s.bias]}`}>{s.bias}</span>
                <span className="font-mono text-[9.5px] text-[#525252]">{s.tags.join(" · ")}</span>
              </div>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block text-[13px] font-medium leading-snug text-[#e5e5e5] hover:text-[#00ff88]">
                  {s.title}
                </a>
              ) : (
                <p className="mt-1.5 text-[13px] font-medium leading-snug text-[#e5e5e5]">{s.title}</p>
              )}
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#a3a3a3]">
                <span className="font-mono text-[#525252]">why </span>{s.why}
              </p>
              <p className="mt-1.5 font-mono text-[10px] text-[#525252]">
                {s.timeAgo}{s.dubai ? ` · ${s.dubai} Dubai` : ""} · {s.source}
              </p>
            </article>
          ))
        )}
      </div>

      <p className="border-t border-[#262626] px-4 py-2 font-mono text-[10px] leading-relaxed text-[#525252]">
        Direction is a rule-based read of each headline&apos;s effect on gold — which words triggered it is fixed and
        checkable. Not AI, not advice.
      </p>
    </div>
  );
}

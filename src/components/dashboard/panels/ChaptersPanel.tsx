"use client";

import { useState } from "react";
import { ArrowLeft, Check, MapPin, MessageSquare, Users } from "lucide-react";
import { WorldMap } from "@/components/ui/WorldMap";
import { Card, CardHead, PanelHeader, Toast } from "@/components/ui/Primitives";
import { KEYS, usePersistentState } from "@/lib/storage";
import { EVENTS, trackEvent } from "@/lib/analytics";

interface ChapterRow {
  code: string;
  name: string;
  hub: string;
  flag: string;
  members: number;
  online: number;
  lead: string;
  posts: { author: string; time: string; body: string }[];
  events: { date: string; title: string }[];
}

const CHAPTER_ROWS: ChapterRow[] = [
  { code: "PH", name: "Philippines", hub: "Manila", flag: "\u{1F1F5}\u{1F1ED}", members: 342, online: 48, lead: "Maria Santos",
    posts: [
      { author: "Maria Santos", time: "12m", body: "Manila meetup confirmed for the 14th — venue details in the pinned thread." },
      { author: "PinoyTrader", time: "2h", body: "Asia session recap posted. Ranges were tight again on the majors." },
    ],
    events: [{ date: "Sep 14", title: "Manila meetup — risk management workshop" }, { date: "Sep 28", title: "Chapter analysis review" }] },
  { code: "AE", name: "UAE", hub: "Dubai", flag: "\u{1F1E6}\u{1F1EA}", members: 128, online: 19, lead: "Ahmed K.",
    posts: [
      { author: "MarketPro", time: "1h", body: "Gold desk notes for the week are up. RSI at 72 is the talking point." },
      { author: "Ahmed K.", time: "4h", body: "Anyone joining the DIFC session on Thursday?" },
    ],
    events: [{ date: "Sep 11", title: "DIFC trading floor visit" }] },
  { code: "SG", name: "Singapore", hub: "Singapore", flag: "\u{1F1F8}\u{1F1EC}", members: 89, online: 12, lead: "FXMaster",
    posts: [{ author: "FXMaster", time: "3h", body: "Asia-session playbook thread — add your setups." }],
    events: [{ date: "Sep 19", title: "Asia session strategy call" }] },
  { code: "GB", name: "United Kingdom", hub: "London", flag: "\u{1F1EC}\u{1F1E7}", members: 156, online: 31, lead: "TraderX",
    posts: [
      { author: "TraderX", time: "45m", body: "London open review: cable's retail sales reaction had real volume behind it." },
      { author: "Lena M.", time: "5h", body: "Anyone else trading the overlap only this month?" },
    ],
    events: [{ date: "Sep 09", title: "London open live session" }, { date: "Sep 23", title: "Monthly chapter call" }] },
  { code: "US", name: "United States", hub: "New York", flag: "\u{1F1FA}\u{1F1F8}", members: 203, online: 44, lead: "MarketPro",
    posts: [{ author: "MarketPro", time: "2h", body: "PCE preview thread — post your levels before the print." }],
    events: [{ date: "Sep 12", title: "NY session breakdown" }] },
  { code: "JP", name: "Japan", hub: "Tokyo", flag: "\u{1F1EF}\u{1F1F5}", members: 97, online: 9, lead: "SakuraFX",
    posts: [{ author: "SakuraFX", time: "6h", body: "BoJ held. Yen unmoved. Fully priced, as expected." }],
    events: [{ date: "Sep 17", title: "Yen crosses workshop" }] },
  { code: "MY", name: "Malaysia", hub: "Kuala Lumpur", flag: "\u{1F1F2}\u{1F1FE}", members: 74, online: 8, lead: "Aiman R.",
    posts: [{ author: "Aiman R.", time: "8h", body: "New members — introduce yourselves in the welcome thread." }],
    events: [{ date: "Sep 21", title: "Beginner track study group" }] },
  { code: "ID", name: "Indonesia", hub: "Jakarta", flag: "\u{1F1EE}\u{1F1E9}", members: 61, online: 6, lead: "Dimas P.",
    posts: [{ author: "Dimas P.", time: "10h", body: "Journaling challenge starts Monday. Two weeks, every trade logged." }],
    events: [{ date: "Sep 15", title: "Journaling challenge kickoff" }] },
];

export function ChaptersPanel() {
  const { value: joined, setValue: setJoined } = usePersistentState<string[]>(KEYS.chapters, []);
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (code: string, name: string) => {
    const isJoining = !joined.includes(code);
    setJoined((prev) => (isJoining ? [...prev, code] : prev.filter((c) => c !== code)));
    if (isJoining) trackEvent(EVENTS.chapterJoined, { chapter: code });
    setToast(isJoining ? `Joined the ${name} chapter` : `Left the ${name} chapter`);
    setTimeout(() => setToast(null), 1800);
  };

  const chapter = CHAPTER_ROWS.find((c) => c.code === open);

  if (chapter) {
    const isIn = joined.includes(chapter.code);
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted transition-colors duration-200 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          All chapters
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[34px] leading-none" aria-hidden>{chapter.flag}</span>
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-white">{chapter.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {chapter.hub} · Chapter lead {chapter.lead}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggle(chapter.code, chapter.name)}
            className={`ml-auto flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] ${
              isIn
                ? "border border-brand-green/40 bg-brand-green/[0.12] text-brand-green"
                : "bg-brand-blue text-white hover:bg-[#4A93FF] hover:shadow-glow"
            }`}
          >
            {isIn ? (<><Check className="h-4 w-4" strokeWidth={2.6} />Joined</>) : "Join Chapter"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHead title="Recent Posts" icon={MessageSquare} />
            <ul className="divide-y divide-white/[0.06]">
              {chapter.posts.map((p, i) => (
                <li key={i} className="flex gap-3 px-5 py-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[10.5px] font-bold text-ink">
                    {p.author.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-white">{p.author}</span>
                      <span className="text-[11px] text-ink-muted/70">{p.time}</span>
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">{p.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHead title="Members" icon={Users} />
              <div className="grid grid-cols-2 gap-3 p-5">
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3.5">
                  <p className="text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Total</p>
                  <p className="num-mono mt-1.5 text-[20px] font-bold text-white">{chapter.members}</p>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3.5">
                  <p className="text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Online</p>
                  <p className="num-mono mt-1.5 text-[20px] font-bold text-brand-green">{chapter.online}</p>
                </div>
              </div>
            </Card>

            <Card>
              <CardHead title="Upcoming Events" icon={MapPin} />
              <ul className="divide-y divide-white/[0.06]">
                {chapter.events.map((e, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="num-mono w-[48px] shrink-0 text-[12px] font-semibold text-brand-blue">
                      {e.date}
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] text-ink">{e.title}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Global Chapters"
        action={
          <span className="text-[12.5px] text-ink-muted">
            <span className="num-mono font-semibold text-white">{joined.length}</span> joined
          </span>
        }
      />

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(42,127,255,0.10),transparent_70%)]" />
        <div className="relative px-4 py-6">
          <WorldMap density={140} dotOpacity={0.4} hubs className="h-auto w-full" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHAPTER_ROWS.map((c) => {
          const isIn = joined.includes(c.code);
          return (
            <article key={c.code} className="flex flex-col rounded-2xl glass p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-glow">
              <button type="button" onClick={() => setOpen(c.code)} className="text-left">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[28px] leading-none" aria-hidden>{c.flag}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-brand-green">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-60 animate-pulseRing" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-green" />
                    </span>
                    <span className="num-mono">{c.online}</span> online
                  </span>
                </div>

                <h3 className="mt-4 text-[15px] font-bold tracking-tight text-white">{c.name}</h3>
                <p className="mt-0.5 text-[12px] text-ink-muted">{c.hub}</p>
                <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                  <Users className="h-3.5 w-3.5" strokeWidth={1.9} />
                  <span className="num-mono font-semibold text-white">{c.members}</span> members
                </p>
              </button>

              <button
                type="button"
                onClick={() => toggle(c.code, c.name)}
                className={`mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[12.5px] font-semibold transition-all duration-200 active:scale-[0.98] ${
                  isIn
                    ? "border border-brand-green/40 bg-brand-green/[0.12] text-brand-green"
                    : "border border-white/[0.1] bg-white/[0.03] text-ink hover:border-brand-blue/40 hover:bg-brand-blue/[0.1] hover:text-white"
                }`}
              >
                {isIn ? (<><Check className="h-3.5 w-3.5" strokeWidth={2.6} />Joined</>) : "Join Chapter"}
              </button>
            </article>
          );
        })}
      </div>

      <Toast message={toast} />
    </div>
  );
}

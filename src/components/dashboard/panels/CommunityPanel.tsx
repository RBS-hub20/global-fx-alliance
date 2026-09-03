"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Heart, MessageCircle, Send, Share2 } from "lucide-react";
import { Card, PanelHeader, Pills, Toast } from "@/components/ui/Primitives";
import { Shoutbox } from "@/components/dashboard/Shoutbox";
import { StreakBoard } from "@/components/dashboard/StreakBoard";
import { KEYS, usePersistentState } from "@/lib/storage";
import { PROFILE } from "@/lib/content";
import { getSharedPosts } from "@/lib/communityPosts";

type Kind = "Analysis" | "Question" | "Update";

interface FeedPost {
  id: string;
  author: string;
  initials: string;
  flag: string;
  country: string;
  role: string;
  verified: boolean;
  following: boolean;
  time: string;
  body: string;
  likes: number;
  comments: number;
  kind: Kind;
}

const SEED: FeedPost[] = [
  { id: "p1", author: "Maria Santos", initials: "MS", flag: "\u{1F1F5}\u{1F1ED}", country: "Philippines", role: "Pro Trader", verified: true, following: true, time: "12m", body: "EUR/USD approaching resistance zone. Watching London/NY overlap — the 1.1760 shelf has capped it twice this month and I want to see how it behaves on the third touch before committing.", likes: 24, comments: 8, kind: "Analysis" },
  { id: "p2", author: "Ahmed K.", initials: "AK", flag: "\u{1F1E6}\u{1F1EA}", country: "UAE", role: "Member", verified: false, following: false, time: "38m", body: "Anyone watching XAU/USD today? Huge volatility expected around the PCE print.", likes: 11, comments: 17, kind: "Question" },
  { id: "p3", author: "TraderX", initials: "TX", flag: "\u{1F1EC}\u{1F1E7}", country: "United Kingdom", role: "Pro Trader", verified: true, following: true, time: "1h", body: "Reminder that dollar softness is not euro strength. If you want to know which one is actually driving EUR/USD, look at EUR/GBP — it has been climbing all week, so this one is at least partly a euro story.", likes: 63, comments: 21, kind: "Analysis" },
  { id: "p4", author: "SakuraFX", initials: "SF", flag: "\u{1F1EF}\u{1F1F5}", country: "Japan", role: "Pro Trader", verified: true, following: false, time: "2h", body: "BoJ held, yen did nothing. Fully priced. USD/JPY continues to trade on US yields rather than anything domestic — I'd stop looking for a domestic catalyst.", likes: 38, comments: 9, kind: "Update" },
  { id: "p5", author: "PinoyTrader", initials: "PT", flag: "\u{1F1F5}\u{1F1ED}", country: "Philippines", role: "Member", verified: false, following: true, time: "3h", body: "Two months of journaling and the pattern is embarrassingly clear: every losing week has more trades in it than every winning week. Not sure how to fix it yet but at least I can see it now.", likes: 91, comments: 34, kind: "Update" },
  { id: "p6", author: "FXMaster", initials: "FM", flag: "\u{1F1F8}\u{1F1EC}", country: "Singapore", role: "Pro Trader", verified: true, following: false, time: "4h", body: "How are people sizing into the PCE release? I'm flat through it. If my edge doesn't come from the print, being in it is just paying the spread for a coin flip.", likes: 47, comments: 28, kind: "Question" },
  { id: "p7", author: "MarketPro", initials: "MP", flag: "\u{1F1E6}\u{1F1EA}", country: "UAE", role: "Pro Trader", verified: true, following: false, time: "6h", body: "Gold five green sessions and RSI at 72. Overbought in a trend just means trending — but it does change how a reversal would behave. Scaling rather than picking a top.", likes: 55, comments: 14, kind: "Analysis" },
  { id: "p8", author: "Lena M.", initials: "LM", flag: "\u{1F1E9}\u{1F1EA}", country: "Germany", role: "Member", verified: false, following: false, time: "8h", body: "Finished the Market Structure lesson in the Academy. The bit about what actually counts as a break was worth the whole track.", likes: 29, comments: 6, kind: "Update" },
];

const FILTERS = ["All", "Following", "Analysis", "Questions"] as const;

export function CommunityPanel() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>(SEED);

  // Analyses shared from Chart Snap live in local storage, so they actually
  // appear here rather than vanishing when the tab changes.
  useEffect(() => {
    const shared = getSharedPosts();
    if (!shared.length) return;
    setPosts((prev) => {
      // StrictMode invokes effects twice in development, so merging blindly
      // prepends the same shared posts again and collides on React keys.
      const existing = new Set(prev.map((p) => p.id));
      const incoming = shared.filter((s) => !existing.has(s.id));
      if (!incoming.length) return prev;
      return [
      ...incoming.map((s) => ({
        id: s.id, author: PROFILE.name, initials: PROFILE.initials, flag: PROFILE.flag,
        country: PROFILE.country, role: PROFILE.role, verified: true, following: true,
        time: new Date(s.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        body: s.meta ? `${s.body}\n\n${s.meta}` : s.body,
        likes: 0, comments: 0, kind: "Analysis" as Kind,
      })),
      ...prev,
      ];
    });
  }, []);
  const [toast, setToast] = useState<string | null>(null);
  const { value: liked, setValue: setLiked } = usePersistentState<string[]>(KEYS.likes, []);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  };

  const shown = useMemo(() => {
    switch (filter) {
      case "Following": return posts.filter((p) => p.following);
      case "Analysis": return posts.filter((p) => p.kind === "Analysis");
      case "Questions": return posts.filter((p) => p.kind === "Question");
      default: return posts;
    }
  }, [filter, posts]);

  const toggleLike = (id: string) => {
    setLiked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const publish = () => {
    const body = draft.trim();
    if (!body) return;
    setPosts((prev) => [
      {
        id: `own-${Date.now()}`, author: PROFILE.name, initials: PROFILE.initials,
        flag: PROFILE.flag, country: PROFILE.country, role: PROFILE.role, verified: true,
        following: true, time: "now", body, likes: 0, comments: 0, kind: "Update",
      },
      ...prev,
    ]);
    setDraft("");
    flash("Posted to the community");
  };

  return (
    <div className="space-y-6">
      <PanelHeader title="Global Community" live />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Shoutbox />
        <StreakBoard limit={10} />
      </div>

      <Card className="p-5">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#1E4C9E] to-[#0A1931] text-[11px] font-bold text-white">
            {PROFILE.initials}
          </span>
          <div className="min-w-0 flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Share an idea, a level, or a question…"
              aria-label="Create a post"
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/60 focus:border-brand-blue/40 focus:shadow-glow"
            />
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="text-[11px] text-ink-muted/70">
                Commentary and education only — no signals.
              </span>
              <button
                type="button"
                onClick={publish}
                disabled={!draft.trim()}
                className="btn-primary !px-4 !py-2 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
              >
                Post
                <Send className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Pills options={FILTERS} value={filter} onChange={setFilter} />

      <div className="space-y-4">
        {shown.map((p) => {
          const on = liked.includes(p.id);
          return (
            <Card key={p.id} className="p-5">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#1E4C9E] to-[#0A1931] text-[11px] font-bold text-white">
                  {p.initials}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[13.5px] font-semibold text-white">{p.author}</span>
                    <span className="text-[12px] text-ink-muted">
                      <span aria-hidden>{p.flag}</span> {p.country}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        p.verified ? "bg-brand-blue/[0.15] text-brand-blue" : "bg-white/[0.06] text-ink-muted"
                      }`}
                    >
                      {p.verified ? <BadgeCheck className="h-3 w-3" strokeWidth={2.4} /> : null}
                      {p.role}
                    </span>
                    <span className="ml-auto text-[11px] text-ink-muted/70">{p.time}</span>
                  </div>

                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">{p.body}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => toggleLike(p.id)}
                      aria-pressed={on}
                      className={`inline-flex items-center gap-1.5 text-[12px] transition-colors duration-200 ${
                        on ? "text-brand-danger" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      <Heart className="h-3.5 w-3.5" strokeWidth={1.9} fill={on ? "currentColor" : "none"} />
                      <span className="num-mono">{p.likes + (on ? 1 : 0)}</span> likes
                    </button>

                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.9} />
                      <span className="num-mono">{p.comments}</span> comments
                    </span>

                    <button
                      type="button"
                      onClick={() => flash("Link copied to clipboard")}
                      className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors duration-200 hover:text-ink"
                    >
                      <Share2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                      Share
                    </button>

                    <span className="ml-auto rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-medium text-ink-muted">
                      {p.kind}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Toast message={toast} />
    </div>
  );
}

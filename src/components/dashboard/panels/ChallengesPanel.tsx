"use client";

import { useState } from "react";
import { Award, Check, Clock, Trophy, Users } from "lucide-react";
import { Card, CardHead, EmptyState, PanelHeader, Pills, Toast } from "@/components/ui/Primitives";
import { CHALLENGES } from "@/lib/content";
import { KEYS, usePersistentState } from "@/lib/storage";

const MEDAL = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
const VIEWS = ["Active", "My Submissions"] as const;

export function ChallengesPanel() {
  const [view, setView] = useState<(typeof VIEWS)[number]>("Active");
  const { value: joined, setValue: setJoined, hydrated } = usePersistentState<string[]>(
    KEYS.challenges,
    []
  );
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (id: string, title: string) => {
    const isJoining = !joined.includes(id);
    setJoined((prev) => (isJoining ? [...prev, id] : prev.filter((x) => x !== id)));
    setToast(isJoining ? `Joined: ${title}` : `Left: ${title}`);
    setTimeout(() => setToast(null), 1800);
  };

  const mine = CHALLENGES.filter((c) => joined.includes(c.id));
  const shown = view === "Active" ? CHALLENGES : mine;

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Trading Challenges"
        action={
          <span className="rounded-full bg-brand-green/[0.13] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-green">
            {CHALLENGES.filter((c) => c.status === "Active").length} Active
          </span>
        }
      />

      <Pills options={VIEWS} value={view} onChange={setView} />

      {view === "My Submissions" && hydrated && mine.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="You haven't entered anything yet"
          body="Join a challenge and your entry will show up here. Submissions are judged on the quality of the reasoning, never on claimed returns."
          action={
            <button type="button" onClick={() => setView("Active")} className="btn-primary">
              Browse active challenges
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {shown.map((c) => {
            const isIn = joined.includes(c.id);
            return (
              <Card key={c.id} className="flex flex-col overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[17px] font-bold leading-snug tracking-tight text-white">
                      {c.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                        c.status === "Active"
                          ? "bg-brand-green/[0.13] text-brand-green"
                          : "bg-[#FFB020]/[0.13] text-[#FFB020]"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">{c.blurb}</p>

                  <dl className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                      <dt className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
                        <Award className="h-3 w-3" strokeWidth={2} />
                        Prize
                      </dt>
                      <dd className="num-mono mt-1.5 text-[14px] font-bold text-brand-blue">{c.prize}</dd>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                      <dt className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
                        <Clock className="h-3 w-3" strokeWidth={2} />
                        Ends
                      </dt>
                      <dd className="mt-1.5 text-[14px] font-bold text-white">{c.ends}</dd>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                      <dt className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
                        <Users className="h-3 w-3" strokeWidth={2} />
                        Entrants
                      </dt>
                      <dd className="num-mono mt-1.5 text-[14px] font-bold text-white">{c.entrants}</dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => toggle(c.id, c.title)}
                    className={`mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] ${
                      isIn
                        ? "border border-brand-green/40 bg-brand-green/[0.12] text-brand-green"
                        : "bg-brand-blue text-white hover:bg-[#4A93FF] hover:shadow-glow"
                    }`}
                  >
                    {isIn ? (
                      <>
                        <Check className="h-4 w-4" strokeWidth={2.6} />
                        Joined
                      </>
                    ) : (
                      "Join Challenge"
                    )}
                  </button>
                </div>

                <div className="mt-auto border-t border-white/[0.08]">
                  <CardHead title="Leaderboard" icon={Trophy} />
                  <ul className="divide-y divide-white/[0.06]">
                    {c.leaders.map((l) => (
                      <li key={l.name} className="flex items-center gap-3 px-5 py-3">
                        <span className="w-6 shrink-0 text-[14px]" aria-label={`Rank ${l.rank}`}>
                          {MEDAL[l.rank - 1]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
                          <span aria-hidden className="mr-1.5">{l.flag}</span>
                          {l.name}
                        </span>
                        <span className="num-mono shrink-0 text-[13px] font-semibold text-brand-blue">
                          {l.score}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed text-ink-muted/70">
        Challenges award reputation only. There is no cash prize, no entry fee, and no scoring based
        on trading returns.
      </p>

      <Toast message={toast} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, Eye, MessageSquare, Plus, Trophy } from "lucide-react";
import { Card, CardHead, Modal, PanelHeader, Toast } from "@/components/ui/Primitives";
import { THREADS, type Thread } from "@/lib/content";
import { LEADERBOARD } from "@/lib/data";

export function DiscussionsPanel() {
  const [open, setOpen] = useState<string | null>(THREADS[0].id);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const [toast, setToast] = useState<string | null>(null);

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    setThreads((prev) => [
      {
        id: `own-${Date.now()}`, title: t, author: "Renmar Sombilon", initials: "RS",
        flag: "\u{1F1F5}\u{1F1ED}", body: "You started this discussion. Replies will appear here.",
        replies: 0, views: "0", activity: "now", tags: ["New"], answers: [],
      },
      ...prev,
    ]);
    setTitle("");
    setComposing(false);
    setToast("Discussion created");
    setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Discussions"
        action={
          <button type="button" onClick={() => setComposing(true)} className="btn-primary !px-4 !py-2 text-[12.5px]">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            New Discussion
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {threads.map((t) => {
            const expanded = open === t.id;
            return (
              <Card key={t.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : t.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-start gap-4 p-5 text-left transition-colors duration-200 hover:bg-white/[0.02]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#1E4C9E] to-[#0A1931] text-[11px] font-bold text-white">
                    {t.initials}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold leading-snug tracking-tight text-white">
                      {t.title}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-muted">
                      <span>
                        <span aria-hidden>{t.flag}</span> {t.author}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" strokeWidth={1.9} />
                        <span className="num-mono">{t.replies}</span> replies
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" strokeWidth={1.9} />
                        <span className="num-mono">{t.views}</span> views
                      </span>
                      <span>· {t.activity}</span>
                    </span>
                    <span className="mt-2.5 flex flex-wrap gap-1.5">
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-medium text-ink-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </span>

                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 ${
                      expanded ? "rotate-180 text-brand-blue" : ""
                    }`}
                  />
                </button>

                {expanded ? (
                  <div className="border-t border-white/[0.08] px-5 py-5">
                    <p className="text-[13.5px] leading-relaxed text-ink">{t.body}</p>

                    {t.answers.length ? (
                      <ul className="mt-5 space-y-4 border-t border-white/[0.08] pt-5">
                        {t.answers.map((a, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[10.5px] font-bold text-ink">
                              {a.initials}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-white">{a.author}</span>
                                <span className="text-[11px] text-ink-muted/70">{a.time}</span>
                              </span>
                              <span className="mt-1.5 block text-[13px] leading-relaxed text-ink-muted">
                                {a.body}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-5 border-t border-white/[0.08] pt-5 text-[13px] text-ink-muted">
                        No replies yet.
                      </p>
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>

        <Card className="h-fit">
          <CardHead title="Top Contributors" icon={Trophy} />
          <ul className="divide-y divide-white/[0.06]">
            {LEADERBOARD.map((r) => (
              <li key={r.trader} className="flex items-center gap-3 px-5 py-3.5">
                <span className="num-mono w-5 shrink-0 text-[12px] text-ink-muted">{r.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-white">{r.trader}</span>
                  <span className="text-[11px] text-ink-muted">
                    <span aria-hidden>{r.flag}</span> {r.country}
                  </span>
                </span>
                <span className="num-mono shrink-0 text-[13px] font-semibold text-brand-blue">
                  {r.reputation.toLocaleString("en-US")}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-white/[0.08] px-5 py-3.5 text-[11px] leading-relaxed text-ink-muted/70">
            Ranked by contribution &amp; reputation — not claimed profits.
          </p>
        </Card>
      </div>

      <Modal open={composing} onClose={() => setComposing(false)} title="Start a discussion">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Title
          </span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to ask the Alliance?"
            className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[14px] text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/60 focus:border-brand-blue/40 focus:shadow-glow"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setComposing(false)} className="btn-ghost !px-4 !py-2 text-[12.5px]">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!title.trim()} className="btn-primary !px-4 !py-2 text-[12.5px] disabled:opacity-40">
            Create
          </button>
        </div>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}

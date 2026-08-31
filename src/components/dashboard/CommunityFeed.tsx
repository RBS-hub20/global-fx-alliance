import { BadgeCheck, Heart, MessageCircle } from "lucide-react";
import { POSTS } from "@/lib/data";

export function CommunityFeed() {
  return (
    <section className="rounded-2xl glass">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white">
          Global Community
        </h2>
        <span className="relative flex h-2 w-2" aria-label="Live">
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-60 animate-pulseRing" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
        </span>
      </header>

      <ul className="divide-y divide-white/[0.08]">
        {POSTS.map((p) => (
          <li key={p.id} className="p-5 transition-colors duration-200 hover:bg-white/[0.02]">
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
                      p.verified
                        ? "bg-brand-blue/[0.15] text-brand-blue"
                        : "bg-white/[0.06] text-ink-muted"
                    }`}
                  >
                    {p.verified ? <BadgeCheck className="h-3 w-3" strokeWidth={2.4} /> : null}
                    {p.role}
                  </span>
                  <span className="ml-auto text-[11px] text-ink-muted/70">{p.time}</span>
                </div>

                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">{p.body}</p>

                <div className="mt-3.5 flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                    <Heart className="h-3.5 w-3.5" strokeWidth={1.9} />
                    <span className="num-mono">{p.likes}</span> likes
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                    <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.9} />
                    <span className="num-mono">{p.comments}</span>{" "}
                    {p.tag ? "comments" : "replies"}
                  </span>
                  {p.tag ? (
                    <span className="ml-auto rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-medium text-ink-muted">
                      {p.tag}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

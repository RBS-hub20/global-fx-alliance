import Link from "next/link";
import { ArrowRight, TrendingUp, Users } from "lucide-react";
import { CHAPTERS } from "@/lib/data";

export function ChaptersPreview() {
  return (
    <section id="chapters-preview" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="kicker">GFXA Chapters</p>
          <h2 className="headline mt-4 text-[clamp(30px,4.4vw,48px)] leading-[1.06]">
            Find Your Chapter
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            Country communities inside the Alliance — your timezone, your session, your language,
            and the same global network behind them.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {CHAPTERS.map((c) => (
            <article key={c.code} className="group flex flex-col rounded-2xl glass card-hover p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[28px] leading-none" aria-hidden>
                  {c.flag}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/[0.13] px-2 py-0.5 text-[10.5px] font-semibold num-mono text-brand-green">
                  <TrendingUp className="h-3 w-3" strokeWidth={2.4} />
                  {c.growth}
                </span>
              </div>

              <h3 className="mt-5 text-[16px] font-bold tracking-tight text-white">{c.name}</h3>
              <p className="mt-1 text-[12.5px] text-ink-muted">{c.hub}</p>

              <p className="mt-4 flex items-center gap-1.5 text-[13px] text-ink-muted">
                <Users className="h-3.5 w-3.5" strokeWidth={1.9} />
                <span className="num-mono font-semibold text-white">{c.members}</span> members
              </p>

              <Link
                href={`/dashboard?ref=chapter-${c.code.toLowerCase()}`}
                className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-[12.5px] font-semibold text-ink transition-all duration-200 group-hover:border-brand-blue/40 group-hover:bg-brand-blue/[0.1] group-hover:text-white"
              >
                Join Chapter
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

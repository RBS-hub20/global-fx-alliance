import Link from "next/link";
import { ArrowRight, BookOpen, Clock, GraduationCap } from "lucide-react";
import { COURSES, type Course } from "@/lib/data";

const LEVEL_STYLE: Record<Course["level"], string> = {
  Foundation: "bg-brand-blue/[0.13] text-brand-blue",
  Intermediate: "bg-[#FFB020]/[0.13] text-[#FFB020]",
  Advanced: "bg-brand-green/[0.13] text-brand-green",
};

export function AcademyPreview() {
  return (
    <section id="academy-preview" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="kicker">GFXA Academy</p>
          <h2 className="headline mt-4 text-[clamp(30px,4.4vw,48px)] leading-[1.06]">
            Three Tracks. One Curriculum.
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            Structured from first principles to execution — taught by traders who still take the
            trades.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {COURSES.map((c, i) => (
            <article key={c.title} className="group flex flex-col rounded-2xl glass card-hover p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-blue/25 bg-brand-blue/10 text-brand-blue">
                  <GraduationCap className="h-[22px] w-[22px]" strokeWidth={1.8} />
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] ${LEVEL_STYLE[c.level]}`}
                >
                  {c.level}
                </span>
              </div>

              <span className="num-mono mt-6 block text-[12px] font-semibold text-ink-muted/60">
                Track 0{i + 1}
              </span>
              <h3 className="mt-2 text-[19px] font-bold tracking-tight text-white">{c.title}</h3>
              <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-muted">{c.blurb}</p>

              <div className="mt-6 flex items-center gap-5 border-t border-white/[0.08] pt-5 text-[12.5px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={1.9} />
                  <span className="num-mono font-semibold text-ink">{c.lessons}</span> lessons
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.9} />
                  <span className="num-mono font-semibold text-ink">{c.hours}</span>
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/dashboard?ref=academy" className="btn-primary">
            Explore Academy
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { ARTICLES } from "@/lib/data";

export function BlogPreview() {
  return (
    <section id="blog-preview" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="kicker">From the Alliance</p>
          <h2 className="headline mt-4 text-[clamp(30px,4.4vw,48px)] leading-[1.06]">
            Research, Notes &amp; Market Writing
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            What the desk is reading, thinking and arguing about — published in the open.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {ARTICLES.map((a) => (
            <Link
              key={a.title}
              href="/dashboard?ref=blog"
              className="group flex flex-col rounded-2xl glass card-hover p-7"
            >
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  {a.category}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted/70">
                  <Clock className="h-3 w-3" strokeWidth={1.9} />
                  {a.readTime}
                </span>
              </div>

              <h3 className="mt-5 text-[18px] font-bold leading-snug tracking-tight text-white transition-colors duration-200 group-hover:text-brand-blue">
                {a.title}
              </h3>
              <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-muted">{a.excerpt}</p>

              <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-5">
                <span className="text-[12px] text-ink-muted/70">{a.date}</span>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-blue">
                  Read
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

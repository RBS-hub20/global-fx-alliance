import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { SOCIALS } from "@/lib/socials";
import { DISCLAIMER } from "@/lib/data";

/**
 * The one link that goes in a TikTok or Instagram bio.
 *
 * Deliberately not indexed: it is a redirect surface for profile bios, not a
 * page that should compete with the landing page in search.
 */
export const metadata: Metadata = {
  title: "Official links",
  description: "Every official Global FX Alliance channel, in one place.",
  robots: { index: false, follow: true },
};

export default function LinksPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-5 py-14">
      <div className="flex flex-col items-center text-center">
        <Logo size={44} />
        <p className="mt-5 text-[13.5px] leading-relaxed text-ink-muted">
          The Global Community for Forex Traders. Every official channel is listed here — if a link is
          not on this page, it is not us.
        </p>
      </div>

      <div className="mt-9 space-y-2.5">
        <Link
          href="/dashboard?tab=chart-snap&ref=links"
          className="flex items-center gap-3 rounded-xl border border-brand-blue/40 bg-brand-blue/[0.12] px-4 py-3.5 transition-all duration-200 hover:bg-brand-blue/20"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-white">Open the dashboard</span>
            <span className="block text-[12px] text-ink-muted">Live charts, pattern radar, journal and AI tools</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-brand-blue" strokeWidth={2.2} />
        </Link>

        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3.5 transition-all duration-200 hover:border-brand-blue/40"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-white">globalfxalliance.io</span>
            <span className="block text-[12px] text-ink-muted">What the Alliance is, and how to join</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2.2} />
        </Link>

        {SOCIALS.map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ["--brand" as string]: s.color }}
            className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3.5 transition-all duration-200 hover:border-[var(--brand)]"
          >
            <BrandIcon id={s.id} className="h-[18px] w-[18px] shrink-0 text-[var(--brand)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-white">{s.label}</span>
              <span className="block truncate text-[12px] text-ink-muted">
                {s.handle} · {s.blurb}
              </span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.9} />
          </a>
        ))}

        {SOCIALS.length === 0 ? (
          <p className="rounded-xl border border-[#fbbf24]/25 bg-[#fbbf24]/[0.06] px-4 py-3.5 text-[12.5px] leading-relaxed text-ink">
            No social accounts are published yet. They appear here as soon as their real URLs are set —
            no placeholder handles are linked, because a guessed handle may belong to someone else.
          </p>
        ) : null}
      </div>

      <p className="mt-auto pt-10 text-center text-[11px] leading-relaxed text-ink-muted/70">
        {DISCLAIMER}
      </p>
    </main>
  );
}

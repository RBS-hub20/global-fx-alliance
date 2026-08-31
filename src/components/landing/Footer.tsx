import Link from "next/link";
import { ExternalLink, Facebook, Send, Youtube, Instagram, Music2, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { DISCLAIMER } from "@/lib/data";
import { FOOTER_COLUMNS, SOCIAL_LINKS } from "@/lib/links";

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  Facebook,
  Telegram: Send,
  YouTube: Youtube,
  TikTok: Music2,
  Instagram,
};

const linkClass =
  "inline-flex items-center gap-1.5 text-[14px] text-ink-muted transition-colors duration-200 hover:text-white";

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.08] bg-[#050810]">
      <div className="mx-auto max-w-[1280px] px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4 lg:gap-8">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" aria-label="GLOBAL FX ALLIANCE home">
              <Logo size={38} wordmarkClass="text-[15px]" />
            </Link>
            <p className="mt-5 max-w-[34ch] text-[14px] leading-relaxed text-ink-muted">
              The Global Community for Forex Traders. Connect. Learn. Analyze. Grow.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white">
                {col.title}
              </h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith("#") ? (
                      // In-page anchor: no route change, sections carry scroll-margin-top.
                      <a href={l.href} className={linkClass}>
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className={linkClass}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white">
              Social
            </h4>
            <ul className="mt-5 space-y-3">
              {SOCIAL_LINKS.map(({ label, href }) => {
                const Icon = SOCIAL_ICONS[label];
                return (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group ${linkClass}`}
                    >
                      <Icon
                        className="h-4 w-4 text-ink-muted transition-colors duration-200 group-hover:text-brand-blue"
                        strokeWidth={1.8}
                      />
                      {label}
                      <ExternalLink
                        className="h-3 w-3 text-ink-muted/50 transition-colors duration-200 group-hover:text-brand-blue"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="hairline my-12" />

        <p className="max-w-[100ch] text-[12px] leading-relaxed text-ink-muted/70">{DISCLAIMER}</p>

        <div className="mt-10 flex flex-col gap-3 text-[12px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 GLOBAL FX ALLIANCE</span>
          <span className="text-ink-muted/70">Connect. Learn. Analyze. Grow.</span>
        </div>
      </div>
    </footer>
  );
}

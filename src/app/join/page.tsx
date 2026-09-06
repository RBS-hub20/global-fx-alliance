import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Check, MessagesSquare, Radar } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { SOCIALS } from "@/lib/socials";
import { DISCLAIMER } from "@/lib/data";
import { HeroMedia } from "./HeroMedia";
import { LivePresence } from "./LivePresence";
import { JoinCta } from "./JoinCta";

/*
 * Domain: join.globalfxalliance.io
 *
 * Vercel → Settings → Domains → Add `join.globalfxalliance.io`, then a CNAME
 * record `join` → `cname.vercel-dns.com` at the DNS provider. It aliases the
 * same deployment, so `join.globalfxalliance.io/join` serves this page as soon
 * as DNS resolves — no rewrite needed and nothing else in the project changes.
 *
 * A root rewrite (`join.globalfxalliance.io/` → `/join`) would need
 * next.config.mjs, which is shared with the main site, so it is left out here
 * deliberately.
 *
 * `.io` is fine — it is the same brand as the main domain and costs nothing
 * extra; a separate `.com` would mean buying another name for no benefit.
 */

const TELEGRAM = "https://t.me/GFXAlliance";

export const metadata: Metadata = {
  title: "Join the community",
  description:
    "A global community of forex traders sharing how they read structure on XAU/USD, EUR/USD and the majors. Education only — not signals.",
  robots: { index: false, follow: true },
};

const BULLETS = [
  {
    title: "How to read market structure",
    body: "Support, break, retest — worked through on 15M and 1H charts with the levels price has actually respected. Educational examples, never a signal.",
  },
  {
    title: "How to track your own sessions",
    body: "A journal that reads your exported trade history, an economic calendar and a position-size calculator. Your numbers, not someone else's.",
  },
  {
    title: "Why people stay",
    body: "A live chat channel, daily check-in streaks and a board built from real activity. A community, not a signal group.",
  },
];

const INSIDE = [
  {
    icon: BarChart3,
    label: "Chart Snap",
    line: "XAU/USD · 1H",
    body: "Reads the live chart and says what price is doing against the levels it has respected — bouncing off support, approaching resistance, or mid-range with nothing in play.",
    note: "Educational example. Not a signal.",
  },
  {
    icon: MessagesSquare,
    label: "GFXA Chat",
    line: "trader-7f3a2b",
    body: "The community channel. Posts appear under a derived handle, never an email address, so taking part costs you no privacy.",
    note: "Public channel. Education only.",
  },
  {
    icon: Radar,
    label: "Pattern Radar",
    line: "Live scan",
    body: "Scans real candles across the majors for engulfing patterns, level rejections and fair-value gaps, and tells you how confident it is — and when it is not.",
    note: "Real data, stated provenance.",
  },
];

const STEPS = [
  { n: 1, title: "Join the Telegram channel", body: "One tap. Free, and you can leave whenever you like." },
  { n: 2, title: "Read the daily breakdowns", body: "How the sessions opened, which levels are in play, what the scanner found." },
  { n: 3, title: "Open the dashboard when you want it", body: "The charts, journal and tools live at globalfxalliance.io — there when you are ready, not before." },
];

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-[#070A12] text-[#E6EAF2]">
      {/* ------------------------------------------------------------- hero */}
      <section className="relative isolate flex min-h-[62vh] flex-col justify-end overflow-hidden px-5 pb-10 pt-8 sm:min-h-[58vh] sm:px-8 lg:min-h-[64vh]">
        <HeroMedia />

        <div className="relative mx-auto w-full max-w-[760px]">
          <div className="mb-7 flex items-center justify-between gap-4">
            <Logo size={30} />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8A93A8]">
              47+ countries
            </span>
          </div>

          <LivePresence />

          <h1 className="mt-5 text-[34px] font-bold leading-[1.06] tracking-[-0.02em] text-white sm:text-[46px] lg:text-[54px]">
            The global community
            <br />
            for forex traders
          </h1>

          <p className="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-[#8A93A8] sm:text-[16px]">
            See how traders around the world break down XAU/USD, EUR/USD and the majors — every
            session. Charts, a pattern scanner and a chat channel that explains structure rather than
            handing out calls.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- bullets */}
      <section className="px-5 pb-2 sm:px-8">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5 backdrop-blur-xl sm:p-7">
            <ul className="space-y-5">
              {BULLETS.map((b) => (
                <li key={b.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2A7FFF]/15 text-[#2A7FFF]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-semibold text-white">{b.title}</span>
                    <span className="mt-1 block text-[13.5px] leading-relaxed text-[#8A93A8]">{b.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3.5 text-center">
            <JoinCta href={TELEGRAM} where="hero" />
            <p className="text-[12.5px] text-[#8A93A8]">
              Free · Telegram channel · daily breakdowns · leave any time
            </p>
            <a href="#whats-inside" className="text-[13px] font-medium text-[#2A7FFF] transition-colors hover:text-white">
              Or see what is inside first
            </a>
          </div>

          {SOCIALS.length ? (
            <div className="mt-9 flex flex-col items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A93A8]">
                Also here
              </span>
              <ul className="flex flex-wrap items-center justify-center gap-2.5">
                {SOCIALS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${s.label} (opens in a new tab)`}
                      title={`${s.label} — ${s.handle}`}
                      style={{ ["--brand" as string]: s.color }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-[#8A93A8] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-[var(--brand)] hover:text-white"
                    >
                      <BrandIcon id={s.id} className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------ what's inside */}
      <section id="whats-inside" className="scroll-mt-8 px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[760px]">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white">What is inside</h2>
          <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-[#8A93A8]">
            Three of the tools the community uses daily. All of them read live market data and say
            where that data came from.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {INSIDE.map((c) => (
              <div key={c.label} className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2A7FFF]/25 bg-[#2A7FFF]/10 text-[#2A7FFF]">
                  <c.icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <p className="mt-3.5 text-[14px] font-semibold text-white">{c.label}</p>
                <p className="num-mono mt-0.5 text-[11.5px] text-[#8A93A8]">{c.line}</p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-[#8A93A8]">{c.body}</p>
                <p className="mt-3 text-[11px] font-medium text-[#fbbf24]/80">{c.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- who for */}
      <section id="who-for" className="scroll-mt-8 border-y border-white/[0.06] bg-white/[0.015] px-5 py-16 sm:px-8">
        <div className="mx-auto grid w-full max-w-[760px] gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#00D094]">Who it is for</h2>
            <ul className="mt-4 space-y-2.5 text-[13.5px] leading-relaxed text-[#8A93A8]">
              <li>Traders who want to understand why a level matters, not just be told about it.</li>
              <li>People who will keep a journal and look at their own numbers honestly.</li>
              <li>Anyone who learns faster with other traders in the room.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#FF4D4D]">Who it is not for</h2>
            <ul className="mt-4 space-y-2.5 text-[13.5px] leading-relaxed text-[#8A93A8]">
              <li>Anyone looking for guaranteed signals or a shortcut to profit.</li>
              <li>Anyone expecting someone else to make the decision for them.</li>
              <li>We explain structure. What you do with it is yours.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ how it works */}
      <section id="how-it-works" className="scroll-mt-8 px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[760px]">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white">
            What happens after you join
          </h2>
          <ol className="mt-6 space-y-5">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2A7FFF]/35 text-[13px] font-bold text-[#2A7FFF]">
                  {s.n}
                </span>
                <span>
                  <span className="block text-[14.5px] font-semibold text-white">{s.title}</span>
                  <span className="mt-1 block text-[13.5px] leading-relaxed text-[#8A93A8]">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-11 flex flex-col items-center gap-3.5 text-center">
            <JoinCta href={TELEGRAM} where="footer" />
            <p className="text-[12.5px] text-[#8A93A8]">Free · no spam · leave any time</p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- footer */}
      <footer className="border-t border-white/[0.07] px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-[760px] space-y-5">
          {SOCIALS.length ? (
            <ul className="flex flex-wrap items-center gap-2.5">
              {SOCIALS.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${s.label} (opens in a new tab)`}
                    style={{ ["--brand" as string]: s.color }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-[#8A93A8] transition-all duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand)] hover:text-white"
                  >
                    <BrandIcon id={s.id} className="h-[15px] w-[15px]" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-[11px] leading-relaxed text-[#8A93A8]/80">{DISCLAIMER}</p>

          <p className="text-[11px] leading-relaxed text-[#8A93A8]/70">
            This site is not affiliated with, endorsed by, or sponsored by Facebook, Meta Platforms,
            TikTok or YouTube. All trademarks belong to their respective owners.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-[#8A93A8]">
            <span>© 2026 Global FX Alliance</span>
            <Link href="/" className="transition-colors hover:text-white">Main site</Link>
            <Link href="/links" className="transition-colors hover:text-white">All official channels</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

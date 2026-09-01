"use client";

import { useEffect, useState } from "react";
import { Activity, Quote } from "lucide-react";
import { PRODUCT_STATS } from "@/lib/launch";

/**
 * Launch social proof.
 *
 * The stat row reports facts about the product that can be counted in the repo.
 * The activity strip and the quotes are demonstration content and are labelled
 * as such on screen — publishing invented member counts or attributed
 * testimonials on a live financial site would be a claim, not a design flourish.
 * Swap in real figures via lib/launch.ts when there are some.
 */

const SAMPLE_ACTIVITY = [
  "A trader in Manila opened the AI terminal",
  "EUR/USD analysis run — 4 agents, 12 levels drawn",
  "XAU/USD auto-support detected at 2,640",
  "Economic calendar checked ahead of Core PCE",
  "Position size calculated — 0.40 lots on a 25-pip stop",
  "Gold fair-value gap flagged on the 1H",
  "London chapter thread updated",
  "Trading journal entry logged and scored",
];

const AVATARS = [
  { initials: "MS", from: "#1E4C9E" },
  { initials: "AK", from: "#0B5E4A" },
  { initials: "TX", from: "#5B2A86" },
  { initials: "SF", from: "#8A4B12" },
  { initials: "PT", from: "#1E4C9E" },
  { initials: "FM", from: "#0B5E4A" },
  { initials: "LM", from: "#7A1F3D" },
  { initials: "DP", from: "#14532D" },
];

const QUOTES = [
  {
    initials: "MS",
    name: "Maria S.",
    role: "Swing trader, Manila",
    text: "The auto-drawn levels match what I'd mark by hand, and the terminal explains why it drew them. That's the part that actually teaches you something.",
  },
  {
    initials: "AK",
    name: "Ahmed K.",
    role: "Prop trader, Dubai",
    text: "Four agents on one screen — structure, the calendar, cross-asset flow and volatility. It's the pre-session checklist I was doing manually.",
  },
  {
    initials: "TX",
    name: "Tom X.",
    role: "Analyst, London",
    text: "It refuses to give signals, which is exactly why I trust the rest of it. Everything is framed as structure you can check yourself.",
  },
];

export function SocialProof() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % SAMPLE_ACTIVITY.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative py-24 lg:py-28">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="kicker">Built for traders</p>
          <h2 className="headline mt-4 text-[clamp(28px,4vw,44px)] leading-[1.06]">
            A full trading workstation, free to explore
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            Seventeen tools, eight instruments and a four-agent market terminal — open the dashboard
            and use all of it without an account.
          </p>
        </div>

        {/* What the tools actually do — stated as capability, not as a swipe at
            anyone else's community. The brokers are partners. */}
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl glass p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-blue">
              Journal Analytics
            </p>
            <h3 className="mt-3 text-[19px] font-bold tracking-tight text-white">
              Find out <span className="text-brand-green">why</span> you lose
            </h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">
              Upload an MT4 or MT5 statement from any broker and get your worst hour, your worst
              pair, session-by-session win rate, how much longer you hold losers, and a flag when
              size jumped after a losing streak. Parsed in your browser — nothing is uploaded.
            </p>
          </div>
          <div className="rounded-2xl glass p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-blue">
              Pattern Radar
            </p>
            <h3 className="mt-3 text-[19px] font-bold tracking-tight text-white">
              Find out <span className="text-brand-green">where</span> to look
            </h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">
              A continuous scan across the majors and metals on real price data — engulfing
              candles, RSI divergence, support and resistance tests, fair-value-gap retests — with
              confidence raised only when two independent conditions agree.
            </p>
          </div>
        </div>

        {/* Verified product facts */}
        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-5">
          {PRODUCT_STATS.map((s) => (
            <div key={s.label} className="bg-[rgba(16,22,38,0.8)] px-5 py-7 text-center">
              <p className="num-mono text-[30px] font-bold leading-none text-white">{s.value}</p>
              <p className="mt-2.5 text-[11px] uppercase tracking-[0.14em] text-ink-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Activity strip — demonstration content, labelled */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-xl glass px-5 py-3.5">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-60 animate-pulseRing" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
            </span>
            <Activity className="h-3 w-3" strokeWidth={2} />
            Sample activity
          </span>
          <span key={i} className="text-[13px] text-ink animate-riseIn">{SAMPLE_ACTIVITY[i]}</span>
        </div>

        {/* Avatar stack */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <div className="flex -space-x-2.5">
            {AVATARS.map((a, n) => (
              <span
                key={a.initials + n}
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#070A12] text-[11px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${a.from}, #0A1931)` }}
              >
                {a.initials}
              </span>
            ))}
          </div>
          <p className="text-[12.5px] text-ink-muted">
            Founding members are joining now — chapters open in 8 countries
          </p>
        </div>

        {/* Quotes — explicitly sample */}
        <div className="mt-14">
          <div className="mb-5 flex items-center justify-center gap-2">
            <span className="rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Sample feedback · illustrative
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {QUOTES.map((q) => (
              <figure key={q.name} className="rounded-2xl glass p-6">
                <Quote className="h-5 w-5 text-brand-blue/50" strokeWidth={2} />
                <blockquote className="mt-4 text-[13.5px] leading-relaxed text-ink">
                  {q.text}
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-white/[0.08] pt-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#1E4C9E] to-[#0A1931] text-[11px] font-bold text-white">
                    {q.initials}
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-white">{q.name}</span>
                    <span className="block text-[11.5px] text-ink-muted">{q.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-5 text-center text-[11px] text-ink-muted/70">
            Quotes above are written examples showing how the product is used, not statements from
            named customers. Member and country counts will be published here once the community is live.
          </p>
        </div>
      </div>
    </section>
  );
}

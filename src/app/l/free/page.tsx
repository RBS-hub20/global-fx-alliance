import { Logo } from "@/components/brand/Logo";
import { DISCLAIMER } from "@/lib/ai";
import { JoinCta } from "@/app/join/JoinCta";
import { GridBackdrop, SocialProofRow, StatsRow } from "@/app/join/SocialProofRow";

/**
 * Single-screen ad destination.
 *
 * One message, one action, nothing to scroll past — the long version lives at
 * /join. It shares the CTA and the proof strip with that page, so the campaign
 * payload, the Lead event and the 30-day attribution behave identically.
 */
export default function FreeLandingPage() {
  return (
    <main className="relative isolate flex min-h-[100dvh] flex-col justify-center overflow-hidden bg-[#0A0A0A] px-5 py-10 text-[#E6EAF2] sm:px-8">
      <GridBackdrop />

      <div className="mx-auto w-full max-w-[640px]">
        <Logo height={72} priority className="!h-14 sm:!h-[72px]" />

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#00FF88]/30 bg-[#00FF88]/[0.08] px-3.5 py-1.5 text-[12px] font-semibold text-[#00FF88]">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF88] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00FF88]" />
            </span>
            Free GFXA Telegram access
          </span>
          <SocialProofRow />
        </div>

        <h1 className="mt-5 text-[32px] font-bold leading-[1.07] tracking-[-0.02em] text-white sm:text-[42px]">
          Gold trade ideas.
          <br />
          Market breakdowns.
          <br />
          One serious community.
        </h1>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[#A3A3A3] sm:text-[16px]">
          See how traders break down XAU/USD and EUR/USD — charts, a pattern scanner and a chat that
          explains structure. Not signals.
        </p>

        <div className="mt-8 flex flex-col items-start gap-3.5">
          <JoinCta base="free_landing" where="free_landing" className="!w-full sm:!w-auto" />
          <p className="text-[12.5px] text-[#A3A3A3]">
            Free to start · no payment details · leave whenever you like
          </p>
        </div>

        <StatsRow className="mt-8 max-w-[420px]" />

        <p className="mt-9 text-[11px] leading-relaxed text-[#A3A3A3]/80">{DISCLAIMER}</p>
      </div>
    </main>
  );
}

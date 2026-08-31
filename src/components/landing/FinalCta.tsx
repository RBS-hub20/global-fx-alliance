import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WorldMap } from "@/components/ui/WorldMap";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden py-28 lg:py-40">
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(85%_75%_at_50%_50%,rgba(26,68,140,0.42)_0%,rgba(10,25,49,0.18)_45%,transparent_72%)]" />
      <div className="absolute inset-x-0 top-1/2 -z-20 -translate-y-1/2 opacity-[0.10]">
        <WorldMap density={120} dotOpacity={0.9} className="h-auto w-full" />
      </div>
      <div
        className="orb left-1/2 top-1/2 -z-10 h-[440px] w-[720px] -translate-x-1/2 -translate-y-1/2"
        style={{ ["--orb" as string]: "rgba(42,127,255,0.22)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-5 text-center lg:px-8">
        <h2 className="headline mx-auto max-w-[26ch] text-[clamp(34px,6.4vw,68px)] leading-[1.02]">
          THE MARKET IS GLOBAL.
          <br />
          YOUR COMMUNITY SHOULD BE TOO.
        </h2>
        <p className="mx-auto mt-7 max-w-[46ch] text-[17px] leading-relaxed text-ink-muted">
          Become part of GLOBAL FX ALLIANCE.
        </p>
        <div className="mt-11">
          <Link
            href="/dashboard?ref=final-cta"
            className="btn-primary !px-9 !py-4 text-[15px] shadow-glow-lg"
          >
            JOIN GLOBAL FX ALLIANCE
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  );
}

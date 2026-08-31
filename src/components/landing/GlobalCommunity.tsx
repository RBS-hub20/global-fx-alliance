import { WorldMap } from "@/components/ui/WorldMap";
import { ChapterPills } from "./ChapterPills";

export function GlobalCommunity() {
  return (
    <section id="global-community" className="relative overflow-hidden py-24 lg:py-32">
      <div
        className="orb left-[18%] top-1/2 h-[380px] w-[380px] -translate-y-1/2"
        style={{ ["--orb" as string]: "rgba(42,127,255,0.16)" }}
      />
      <div className="relative mx-auto max-w-[1280px] px-5 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(42,127,255,0.12),transparent_70%)]" />
            <WorldMap density={132} dotOpacity={0.38} hubs className="h-auto w-full" />
          </div>

          <div>
            <p className="kicker">Traders from around the world</p>
            <h2 className="headline mt-4 text-[clamp(30px,4vw,44px)] leading-[1.06]">
              From Local Traders to a Global Alliance
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
              Chapters are forming across Asia-Pacific, the Gulf, Europe and the Americas — every
              one of them trading the same market from a different chair.
            </p>

            <ChapterPills />

            <div className="mt-9 inline-flex items-center gap-3.5 rounded-xl glass px-5 py-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-60 animate-pulseRing" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-green" />
              </span>
              <span className="text-[13px] uppercase tracking-[0.14em] text-ink-muted">
                Active Now
              </span>
              <span className="num-mono text-[18px] font-bold text-white">1,247</span>
              <span className="text-[13px] text-ink-muted">online</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

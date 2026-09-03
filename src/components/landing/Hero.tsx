import Link from "next/link";
import { SocialRow } from "@/components/brand/SocialRow";
import { hasSocials } from "@/lib/socials";
import { ArrowRight } from "lucide-react";
import { WorldMap } from "@/components/ui/WorldMap";

const STATS = [
  { value: "47+", label: "Countries" },
  { value: "12k+", label: "Traders" },
  { value: "24/7", label: "Market Intelligence" },
];

/** Decorative candle field behind the hero copy. */
function CandleField() {
  const candles = [
    [4, 62, 20], [10, 55, 26], [16, 68, 16], [22, 48, 30], [28, 58, 22],
    [34, 40, 34], [40, 52, 24], [46, 36, 30], [52, 46, 26], [58, 30, 36],
    [64, 42, 28], [70, 26, 32], [76, 38, 24], [82, 22, 34], [88, 34, 26],
    [94, 18, 30],
  ] as const;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-x-0 bottom-0 h-[42%] w-full"
      aria-hidden
    >
      {candles.map(([x, y, h], i) => (
        <g key={i} opacity={0.11}>
          <rect x={x + 0.55} y={y - 6} width="0.16" height={h + 12} fill={i % 3 === 2 ? "#8A93A8" : "#2A7FFF"} />
          <rect
            x={x}
            y={y}
            width="1.3"
            height={h}
            fill={i % 3 === 2 ? "#8A93A8" : i % 2 === 0 ? "#00D094" : "#2A7FFF"}
          />
        </g>
      ))}
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pb-28 pt-[136px] lg:pb-36 lg:pt-[168px]">
      {/* Atmospheric wash. Transparent rather than opaque: the body carries a
          viewport-fixed navy gradient, so an opaque section background would cut
          a visible seam where the section ends. */}
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(125%_90%_at_50%_-8%,rgba(30,80,164,0.5)_0%,rgba(12,32,64,0.28)_42%,transparent_72%)]" />

      {/* dotted world map with glowing connection lines */}
      <div className="absolute inset-x-0 top-[18%] -z-20 opacity-[0.15]">
        <WorldMap density={168} dotOpacity={0.85} hubs className="h-auto w-full" />
      </div>

      <CandleField />

      {/* glow orbs */}
      <div
        className="orb left-[1%] top-[4%] -z-10 h-[520px] w-[520px]"
        style={{ ["--orb" as string]: "rgba(42,127,255,0.30)" }}
      />
      <div
        className="orb bottom-[3%] right-[1%] -z-10 h-[520px] w-[520px]"
        style={{ ["--orb" as string]: "rgba(0,208,148,0.16)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-5 text-center lg:px-8">
        <p className="kicker animate-riseIn">The world of Forex, connected.</p>

        <h1
          className="headline mx-auto mt-6 max-w-[14ch] text-[clamp(42px,8.5vw,72px)] leading-[0.98] animate-riseIn"
          style={{ animationDelay: "60ms" }}
        >
          GLOBAL FX ALLIANCE
        </h1>

        <p
          className="mx-auto mt-5 max-w-[40ch] text-[clamp(18px,2.6vw,24px)] font-medium leading-snug text-brand-silver animate-riseIn"
          style={{ animationDelay: "120ms" }}
        >
          The Global Community for Forex Traders
        </p>

        <p
          className="mx-auto mt-6 max-w-[600px] text-[16px] leading-relaxed text-ink-muted animate-riseIn"
          style={{ animationDelay: "180ms" }}
        >
          Join a growing global network of Forex traders, analysts, educators, and market
          enthusiasts. Learn, connect, share insights, and grow together.
        </p>

        <div
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-riseIn"
          style={{ animationDelay: "240ms" }}
        >
          <Link href="/dashboard?tab=chart-snap&ref=hero" className="btn-primary w-full sm:w-auto">
            JOIN THE ALLIANCE
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </Link>
          <a href="#global-community" className="btn-ghost w-full sm:w-auto">
            EXPLORE THE COMMUNITY
          </a>
        </div>

        {hasSocials ? (
          <div className="mt-7 flex flex-col items-center gap-2.5 animate-riseIn" style={{ animationDelay: "300ms" }}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Follow the Alliance</span>
            <SocialRow size="sm" />
          </div>
        ) : null}

        {/* floating stats bar */}
        <div
          className="mx-auto mt-16 grid w-full max-w-[720px] grid-cols-1 divide-y divide-white/[0.08] rounded-2xl glass shadow-glow sm:grid-cols-3 sm:divide-x sm:divide-y-0 animate-riseIn"
          style={{ animationDelay: "300ms" }}
        >
          {STATS.map((s) => (
            <div key={s.label} className="px-6 py-6">
              <div className="num-mono text-[28px] font-bold leading-none text-white">{s.value}</div>
              <div className="mt-2 text-[12px] uppercase tracking-[0.14em] text-ink-muted">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

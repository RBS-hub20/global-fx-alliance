import Link from "next/link";
import { ArrowRight, Activity, BrainCircuit, Landmark } from "lucide-react";
import { PriceChart } from "@/components/ui/PriceChart";
import { EURUSD, QUOTES } from "@/lib/data";

const SIGNALS = [
  { icon: Activity, label: "Trend", value: "Bullish", accent: true },
  { icon: Landmark, label: "Session", value: "London / NY" },
  { icon: BrainCircuit, label: "AI read", value: "Constructive" },
];

/** Teaser for the dashboard's intelligence surface - the same EUR/USD series. */
export function MarketIntelligencePreview() {
  const eur = QUOTES[0];
  const series = EURUSD["1M"];

  return (
    <section id="market-intelligence-preview" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="kicker">Market Intelligence</p>
          <h2 className="headline mt-4 text-[clamp(30px,4.4vw,48px)] leading-[1.06]">
            Market Intelligence Preview
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            Every pair, read three ways — technical structure, the fundamental backdrop, and an AI
            summary that tells you what it does not know.
          </p>
        </div>

        <div className="mt-16 overflow-hidden rounded-2xl glass shadow-glow">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-white/[0.08] px-6 py-4">
            <h3 className="text-[15px] font-bold tracking-tight text-white">{eur.symbol}</h3>
            <span className="h-4 w-px bg-white/10" aria-hidden />
            <span className="num-mono text-[20px] font-bold leading-none text-white">
              {eur.price.toFixed(eur.decimals)}
            </span>
            <span className="num-mono rounded-full bg-brand-green/[0.13] px-2.5 py-1 text-[12px] font-semibold text-brand-green">
              +{series.changePct.toFixed(2)}%
            </span>
            <span className="ml-auto text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              1 Month
            </span>
          </header>

          <div className="px-3 py-5 sm:px-5">
            <PriceChart points={series.points} labels={series.labels} decimals={4} height={240} />
          </div>

          <div className="grid grid-cols-1 divide-y divide-white/[0.08] border-t border-white/[0.08] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {SIGNALS.map(({ icon: Icon, label, value, accent }) => (
              <div key={label} className="flex items-center gap-3 px-6 py-4">
                <Icon className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.9} />
                <span className="text-[12px] uppercase tracking-[0.12em] text-ink-muted">
                  {label}
                </span>
                <span
                  className={`ml-auto text-[13.5px] font-semibold ${
                    accent ? "text-brand-green" : "text-ink"
                  }`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/dashboard?ref=intelligence" className="btn-primary">
            View Full Intelligence
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  );
}

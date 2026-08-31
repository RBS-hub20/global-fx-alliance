import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/ui/Sparkline";
import { QUOTES } from "@/lib/data";

export function TickerRow() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {QUOTES.map((q) => {
        const up = q.changePct >= 0;
        return (
          <article
            key={q.symbol}
            className="group rounded-xl glass p-4 transition-all duration-200 hover:border-brand-blue/25"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold tracking-tight text-ink">{q.symbol}</h3>
                <p className="mt-1.5 num-mono text-[22px] font-bold leading-none text-white">
                  {q.price.toFixed(q.decimals)}
                </p>
              </div>
              <Sparkline points={q.spark} positive={up} width={96} height={40} className="shrink-0 opacity-90" />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {up ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-brand-green" strokeWidth={2.4} />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-brand-danger" strokeWidth={2.4} />
              )}
              <span
                className={`num-mono text-[13px] font-semibold ${
                  up ? "text-brand-green" : "text-brand-danger"
                }`}
              >
                {up ? "+" : ""}
                {q.changePct.toFixed(2)}%
              </span>
              <span className="num-mono text-[12px] text-ink-muted">
                {up ? "+" : ""}
                {q.change.toFixed(q.decimals)}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

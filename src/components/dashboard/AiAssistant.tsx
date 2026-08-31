"use client";

import { useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { AI_CHIPS } from "@/lib/data";

export function AiAssistant() {
  const [value, setValue] = useState("");

  return (
    <section id="ai-assistant" className="relative overflow-hidden rounded-2xl border border-brand-blue/25 bg-[rgba(10,17,32,0.9)] shadow-glow backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-brand-blue/20 blur-3xl" />

      <div className="relative p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-blue/30 bg-brand-blue/10 text-brand-blue">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </span>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white">
            GFXA AI Market Assistant
          </h2>
        </div>

        <p className="mt-5 text-[15px] font-semibold leading-snug text-ink">
          What&apos;s happening in the market today?
        </p>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            setValue("");
          }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1.5 backdrop-blur-xl transition-colors duration-200 focus-within:border-brand-blue/40">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ask AI..."
              aria-label="Ask the GFXA AI market assistant"
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13.5px] text-ink placeholder:text-ink-muted/70 outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white transition-all duration-200 hover:bg-[#4A93FF] active:scale-95"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {AI_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue(c)}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-left text-[12px] text-ink-muted transition-all duration-200 hover:border-brand-blue/30 hover:bg-brand-blue/[0.08] hover:text-ink"
            >
              {c}
            </button>
          ))}
        </div>

        <p className="mt-5 border-t border-white/[0.08] pt-4 text-[11px] leading-relaxed text-ink-muted/70">
          AI is provided for education &amp; market intelligence. Not financial advice.
        </p>
      </div>
    </section>
  );
}

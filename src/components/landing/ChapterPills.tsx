"use client";

import { useEffect, useState } from "react";
import { HIGHLIGHT_CHAPTERS } from "@/lib/links";
import { HUBS } from "@/lib/geo";

/**
 * Chapter pills under the world map. The Chapters nav item scrolls here and
 * dispatches HIGHLIGHT_CHAPTERS, which briefly rings the pills so it is obvious
 * what the link was pointing at — Community and Chapters share this section.
 */
export function ChapterPills() {
  const [lit, setLit] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onHighlight = () => {
      setLit(true);
      clearTimeout(timer);
      timer = setTimeout(() => setLit(false), 2400);
    };
    window.addEventListener(HIGHLIGHT_CHAPTERS, onHighlight);
    return () => {
      window.removeEventListener(HIGHLIGHT_CHAPTERS, onHighlight);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="mt-8 flex flex-wrap gap-2">
      {HUBS.map((h) => (
        <a
          key={h.code}
          href="#chapters-preview"
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium text-ink transition-all duration-200 hover:border-brand-blue/30 hover:bg-brand-blue/[0.07] ${
            lit
              ? "border-brand-blue/60 bg-brand-blue/[0.12] shadow-glow"
              : "border-white/[0.08] bg-white/[0.03]"
          }`}
        >
          <span aria-hidden>{h.flag}</span>
          {h.name}
        </a>
      ))}
      <a
        href="#chapters-preview"
        className="inline-flex items-center rounded-full border border-dashed border-white/10 px-3.5 py-1.5 text-[13px] text-ink-muted transition-colors duration-200 hover:border-brand-blue/30 hover:text-ink"
      >
        …and expanding
      </a>
    </div>
  );
}

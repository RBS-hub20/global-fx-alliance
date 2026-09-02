"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { readStore, writeStore } from "@/lib/storage";

/**
 * Launch banner.
 *
 * Replaces the waitlist strip: the platform is open, so the ask is to join
 * rather than to wait. It points at the dashboard gate rather than at a broker
 * directly — the gate is where the reader picks a broker and where attribution
 * is recorded, and sending traffic straight to a broker before the partner code
 * is configured would hand the referral away for nothing.
 *
 * The navbar is `fixed top-0`, so a banner in normal flow sits underneath it and
 * the two draw over each other — visible on the old strip too, just less so
 * because it never wrapped. The banner is fixed as well and publishes its own
 * height as `--gfxa-banner-h`, which the navbar and the page padding read. On
 * dismiss the variable returns to 0 and everything closes up.
 */

const DISMISS_KEY = "gfxa-live-banner-dismissed";

export function LiveBanner() {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const publishHeight = useCallback((px: number) => {
    document.documentElement.style.setProperty("--gfxa-banner-h", `${px}px`);
  }, []);

  // Only after mount, so server and client markup match and a reader who
  // dismissed it is not shown it again on the next page.
  useEffect(() => {
    setShow(!readStore<boolean>(DISMISS_KEY, false));
  }, []);

  // Measured rather than assumed: the copy wraps at narrow widths, and a
  // hard-coded offset would be wrong on exactly the screens that wrap.
  useLayoutEffect(() => {
    if (!show) {
      publishHeight(0);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const sync = () => publishHeight(el.offsetHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      publishHeight(0);
    };
  }, [show, publishHeight]);

  if (!show) return null;

  return (
    <div ref={ref} className="fixed inset-x-0 top-0 z-[60] border-b border-brand-green/20 bg-gradient-to-r from-[#07130F] via-[#0A2A1E] to-[#07130F]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-5 py-2.5 pr-10 text-center lg:px-8">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-brand-green opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-green">Live now</span>
        <span className="text-[13px] text-ink">
          <span className="hidden sm:inline">The Alliance is open — a funded account under our partner code unlocks the pro tools.</span>
          <span className="sm:hidden">The Alliance is open.</span>
        </span>
        <Link
          href="/dashboard?tab=chart-snap&ref=live-banner"
          className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/[0.12] px-3 py-1 text-[12px] font-semibold text-brand-green transition-all duration-200 hover:bg-brand-green/20"
        >
          Join the Alliance
          <ArrowRight className="h-3 w-3" strokeWidth={2.4} />
        </Link>
        <button
          type="button"
          onClick={() => { setShow(false); writeStore(DISMISS_KEY, true); }}
          aria-label="Dismiss"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

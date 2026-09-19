"use client";

import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

/**
 * The one action on the page.
 *
 * A real anchor rather than `window.open`: it survives middle-click, "open in
 * new tab" and a reader with JavaScript blocked. The whole page exists to
 * deliver this click, so it should not depend on a script running.
 */
export function JoinCta({
  href,
  where,
  label = "Join the community",
  className = "",
}: {
  href: string;
  where: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("join_telegram_click", { where })}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#00FF88] px-8 py-4 font-mono text-[15px] font-bold text-[#0a0a0a] shadow-[0_12px_34px_-12px_rgba(0,255,136,0.95)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#33ffa0] hover:shadow-[0_18px_44px_-12px_rgba(0,255,136,1)] sm:w-auto ${className}`}
    >
      {label}
      <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
    </a>
  );
}

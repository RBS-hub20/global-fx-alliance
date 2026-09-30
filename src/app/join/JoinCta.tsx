"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { readAttribution, telegramLink } from "@/lib/attribution";

export const GFXA_BOT = "https://t.me/gfxa_access_bot";

/**
 * The one action on the page.
 *
 * A real anchor, not window.open: it survives middle-click, "open in new tab"
 * and a reader with JavaScript blocked. The href is rendered with the plain
 * start payload and upgraded on mount once the visitor's campaign is known —
 * so the link works immediately and carries attribution when there is any.
 */
export function JoinCta({
  base,
  where,
  label = "Message the team on Telegram",
  className = "",
}: {
  /** Start payload before campaign values are appended, e.g. "join_page". */
  base: string;
  where: string;
  label?: string;
  className?: string;
}) {
  const [href, setHref] = useState(`${GFXA_BOT}?start=${base}`);

  useEffect(() => {
    setHref(telegramLink(GFXA_BOT, base, readAttribution()));
  }, [base]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackEvent("join_telegram_click", { where });
        // Before the tab opens, so it is recorded even if focus leaves at once.
        try {
          window.fbq?.("track", "Lead", { content_name: `${base}_telegram_cta`, content_category: "Telegram" });
        } catch { /* a blocked pixel must not swallow the click */ }
      }}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#00FF88] px-8 py-4 font-mono text-[15px] font-bold text-[#0a0a0a] shadow-[0_12px_34px_-12px_rgba(0,255,136,0.95)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#33ffa0] hover:shadow-[0_18px_44px_-12px_rgba(0,255,136,1)] sm:w-auto ${className}`}
    >
      {label}
      <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
    </a>
  );
}

"use client";

import { readAttribution } from "./attribution";

/**
 * Sends one first-party event to /api/events/track.
 *
 * Separate from `pixel.ts` on purpose: that one hands numbers to Meta, this one
 * keeps numbers we can read back. Both fire on the same actions, and the counts
 * in /admin are these, not Meta's.
 *
 * `sendBeacon` so the request survives the tab closing or navigating to
 * Telegram — a Lead fired from a link click is exactly the case a normal fetch
 * loses. Guarded end to end; counting must never break a page.
 */
export function sendBeacon(event: "page_view" | "lead", extra?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    const a = readAttribution();
    const payload = JSON.stringify({
      event,
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      utm_source: a.utm_source,
      utm_medium: a.utm_medium,
      utm_campaign: a.utm_campaign,
      utm_content: a.utm_content,
      ...extra,
    });
    const url = "/api/events/track";
    if (navigator.sendBeacon?.(url, new Blob([payload], { type: "text/plain;charset=UTF-8" }))) return;
    // Older Safari returns false when the beacon queue is full.
    void fetch(url, { method: "POST", body: payload, keepalive: true }).catch(() => {});
  } catch {
    /* analytics is best-effort */
  }
}

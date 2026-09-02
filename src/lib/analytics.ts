"use client";

/**
 * Thin wrapper over Vercel Analytics custom events.
 *
 * `window.va` only exists once the Analytics script has injected itself, and it
 * is absent entirely in development and for visitors blocking analytics — so
 * every call is guarded. Tracking must never be able to break an interaction.
 */

type Props = Record<string, string | number | boolean | null>;

declare global {
  interface Window {
    va?: (event: "beforeSend" | "event" | "pageview", properties?: unknown) => void;
  }
}

export const EVENTS = {
  terminalQuery: "terminal_query",
  pairSelected: "pair_selected",
  timeframeChanged: "chart_timeframe_changed",
  tabChanged: "tab_changed",
  calculatorUsed: "calculator_used",
  watchlistAdd: "watchlist_add",
  chapterJoined: "chapter_joined",
  journalImported: "journal_imported",
  patternViewed: "pattern_viewed",
  chartSnap: "chart_snap_analyzed",
} as const;

export function trackEvent(name: string, props?: Props): void {
  if (typeof window === "undefined") return;
  try {
    window.va?.("event", { name, data: props ?? {} });
  } catch {
    // Analytics is best-effort; a failure here must not surface to the user.
  }
}

"use client";

import { readStore } from "./storage";
import { computeAnalytics, parseTradesCSV, type JournalAnalytics, type Trade } from "./journalParser";
import { SAMPLE_STATEMENT_CSV } from "./journalSample";

/**
 * Read-only access to whatever the Journal Analytics tab imported.
 *
 * The statement lives in this browser only, so everything here is client-side.
 * When nothing has been imported the sample statement is returned with
 * `isReal: false`, and every consumer is expected to say so rather than passing
 * demo numbers off as the reader's own history.
 */

const IMPORT_KEY = "gfxa-journal-import";
export const JOURNAL_TZ_OFFSET = 4; // Dubai

interface Saved {
  trades: Trade[];
  fileName: string | null;
  at: string;
}

export interface JournalContext {
  trades: Trade[];
  analytics: JournalAnalytics;
  isReal: boolean;
  fileName: string | null;
  count: number;
}

export function getJournalTrades(): Trade[] {
  const saved = readStore<Saved | null>(IMPORT_KEY, null);
  return saved?.trades?.length ? saved.trades : [];
}

/** Imported history when present, otherwise the sample — flagged either way. */
export function getJournalContext(): JournalContext {
  const imported = getJournalTrades();
  if (imported.length) {
    const saved = readStore<Saved | null>(IMPORT_KEY, null);
    return {
      trades: imported,
      analytics: computeAnalytics(imported, JOURNAL_TZ_OFFSET),
      isReal: true,
      fileName: saved?.fileName ?? null,
      count: imported.length,
    };
  }
  const trades = parseTradesCSV(SAMPLE_STATEMENT_CSV, "");
  return {
    trades,
    analytics: computeAnalytics(trades, JOURNAL_TZ_OFFSET),
    isReal: false,
    fileName: null,
    count: trades.length,
  };
}

export function getJournalAnalytics(): JournalAnalytics | null {
  const ctx = getJournalContext();
  return ctx.analytics.summary.trades ? ctx.analytics : null;
}

/** Most recent losing trade, chronologically. */
export function getLastLoss(): Trade | null {
  const { trades } = getJournalContext();
  const losses = trades
    .filter((t) => t.net <= 0 && t.closeTime)
    .sort((a, b) => (b.closeTime ?? "").localeCompare(a.closeTime ?? ""));
  return losses[0] ?? null;
}

/** Per-symbol slice, for answering "how do I do on this pair". */
export function getPairStats(symbol: string) {
  const { analytics } = getJournalContext();
  return analytics.byPair.find((p) => p.key === symbol.toUpperCase()) ?? null;
}

export function getBestWorst() {
  const { analytics, isReal, count } = getJournalContext();
  const p = analytics.patterns;
  return {
    isReal,
    count,
    bestPair: p.bestPair,
    worstPair: p.worstPair,
    bestHourDubai: p.bestHourLocal,
    worstHourDubai: p.worstHourLocal,
    bestSession: p.bestSession,
    worstSession: p.worstSession,
    avgWinHold: analytics.holdTime.avgWinnerMin,
    avgLossHold: analytics.holdTime.avgLoserMin,
    holdsLosersLonger: p.holdsLosersLonger,
    revenge: p.revenge,
    overtrading: p.overtrading,
    summary: analytics.summary,
    bySession: analytics.bySession,
  };
}

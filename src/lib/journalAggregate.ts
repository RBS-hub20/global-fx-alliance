"use client";

import { getBestWorst, getLastLoss, JOURNAL_TZ_OFFSET } from "./journalStore";
import type { JournalAggregate } from "./aiProvider";

/**
 * Builds the only journal shape that is ever allowed off this device.
 *
 * The imported statement stays in localStorage. What leaves is this rollup:
 * counts, rates, best/worst buckets and one summarised loss. No trade list, no
 * per-trade prices, no account number, no broker name, no file name. If a field
 * is not on `JournalAggregate` it does not reach the network — which is why the
 * assembly lives here rather than being spread through the panel.
 */
export function buildJournalAggregate(): JournalAggregate | null {
  const bw = getBestWorst();
  if (!bw.summary.trades) return null;

  const loss = getLastLoss();
  const dubaiHour = loss?.closeTime
    ? String((new Date(loss.closeTime).getUTCHours() + JOURNAL_TZ_OFFSET) % 24).padStart(2, "0")
    : null;

  const bucket = (b: { key: string; winRate: number; trades: number; net: number } | null) =>
    b ? { hour: b.key, winRate: b.winRate, trades: b.trades, net: b.net } : null;
  const pair = (b: { key: string; winRate: number; trades: number; net: number } | null) =>
    b ? { symbol: b.key, winRate: b.winRate, trades: b.trades, net: b.net } : null;
  const sess = (b: { key: string; winRate: number; net: number } | null) =>
    b ? { name: b.key, winRate: b.winRate, net: b.net } : null;

  const revengeAt = bw.revenge.occurrences[0] ?? null;

  return {
    totalTrades: bw.summary.trades,
    winRate: bw.summary.winRate,
    netPL: bw.summary.netPL,
    isReal: bw.isReal,
    bestHourDubai: bucket(bw.bestHourDubai),
    worstHourDubai: bucket(bw.worstHourDubai),
    bestPair: pair(bw.bestPair),
    worstPair: pair(bw.worstPair),
    bestSession: sess(bw.bestSession),
    worstSession: sess(bw.worstSession),
    avgWinHoldMin: bw.avgWinHold,
    avgLossHoldMin: bw.avgLossHold,
    holdsLosersLonger: bw.holdsLosersLonger,
    revengeDetected: bw.revenge.detected,
    revengeFrom: revengeAt?.from ?? null,
    revengeTo: revengeAt?.to ?? null,
    lastLoss: loss
      ? {
          symbol: loss.symbol,
          side: loss.type,
          lots: loss.lot,
          net: loss.net,
          closedUTC: loss.closeTime,
          dubaiHour,
          heldMinutes: loss.durationMinutes,
        }
      : null,
  };
}

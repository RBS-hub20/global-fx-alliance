import { createHash } from "node:crypto";
import type { Trade } from "./journalParser";

/**
 * Statement trades -> execution_logs rows. Server-side (node:crypto), pure
 * otherwise, and kept out of the route so it can be tested.
 */

export interface ImportRow {
  user_id: string;
  vt_account_id: string | null;
  symbol: string;
  action: "BUY" | "SELL";
  price: number | null;
  lot: number;
  pnl: number;
  source: "import";
  status: "MANUAL";
  ticket_id: string;
  executed_at: string | null;
  closed_at: string | null;
  expires_at: string | null;
}

/**
 * Dedupe key — what makes importing September twice a no-op instead of a
 * doubled month.
 *
 * Built from the trade's content rather than its row number, which shifts
 * whenever the export covers a longer range. The MT5 ticket is folded in when
 * the file has one, so two genuinely identical grid positions stay distinct;
 * without a ticket column, the occurrence count inside the file does that job
 * and is stable when the same file is imported again.
 */
export function toImportRows(trades: Trade[], userId: string, accountId: string | null): {
  rows: ImportRow[]; skippedOpen: number;
} {
  // Open positions have no realised P&L and no day to sit on yet.
  const closed = trades.filter((t) => t.closeTime && t.lot > 0);
  const seen = new Map<string, number>();

  const rows = closed.map((t): ImportRow => {
    const hasTicket = /^\d{5,}$/.test(t.id);
    const content = [t.symbol, t.type, t.lot, t.openTime, t.closeTime, t.net.toFixed(2), hasTicket ? t.id : ""].join("|");
    const n = (seen.get(content) ?? 0) + 1;
    seen.set(content, n);

    return {
      user_id: userId,
      vt_account_id: accountId,
      symbol: t.symbol.replace("/", ""),
      action: t.type === "buy" ? "BUY" : "SELL",
      price: t.openPrice || null,
      lot: t.lot,
      pnl: Math.round(t.net * 100) / 100,
      source: "import",
      status: "MANUAL",
      ticket_id: createHash("sha256").update(`${content}#${n}`).digest("hex").slice(0, 32),
      executed_at: t.openTime ?? t.closeTime,
      closed_at: t.closeTime,
      expires_at: t.closeTime,
    };
  });

  return { rows, skippedOpen: trades.length - closed.length };
}

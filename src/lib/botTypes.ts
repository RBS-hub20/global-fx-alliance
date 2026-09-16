/** A bot_status row as the browser receives it. Columns from 20250515 and 20250516. */
export interface BotStatus {
  current_symbol: string; current_mode: "GREEN" | "YELLOW" | "RED";
  adx_h1: number | null; bb_width: string | null; ema_distance: string | null;
  vt_balance: number | null; daily_pnl_percent: number | null;
  pattern_radar_signal: string | null; risk_locked: boolean; updated_at: string;
  // 20250516_bot_status_detail.sql — null until the engine writes them.
  confidence: number | null; direction: string | null; regime: string | null;
  guardian_passed: boolean | null; journal_ok: boolean | null; news_block: boolean | null;
  pattern_price: number | null; pattern_detail: string | null;
  entry_zone_low: number | null; entry_zone_high: number | null;
}

import type { Timeframe } from "./timeframes";

/**
 * Mapping to TradingView's own tickers.
 *
 * Used for an outbound "open on TradingView" link, not for an embedded widget.
 * The Advanced Chart widget would draw a *different* feed from the one the
 * analyzer prices against — TradingView's gold is a broker spot feed, ours is
 * Twelve Data spot or Yahoo's GC=F futures, and those sit about forty points
 * apart. A chart showing one number beside a plan built on another is the exact
 * confusion this panel exists to avoid, so the chart is drawn from the analyzer's
 * own candles and TradingView stays a place to cross-check.
 */

const TV_SYMBOL: Record<string, string> = {
  "XAU/USD": "OANDA:XAUUSD",
  "XAG/USD": "OANDA:XAGUSD",
  "EUR/USD": "FX:EURUSD",
  "GBP/USD": "FX:GBPUSD",
  "USD/JPY": "FX:USDJPY",
  "AUD/USD": "FX:AUDUSD",
  "NZD/USD": "FX:NZDUSD",
  "USD/CHF": "FX:USDCHF",
  "EUR/GBP": "FX:EURGBP",
  "BTC/USD": "BINANCE:BTCUSDT",
};

export function getTradingViewSymbol(symbol: string): string {
  return TV_SYMBOL[symbol.toUpperCase()] ?? `FX:${symbol.replace("/", "").toUpperCase()}`;
}

/** TradingView's interval codes. */
export function getTVInterval(tf: Timeframe): string {
  return { "5M": "5", "15M": "15", "1H": "60", "2H": "120", "4H": "240", D1: "D" }[tf] ?? "60";
}

export function tradingViewUrl(symbol: string, tf: Timeframe): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(getTradingViewSymbol(symbol))}&interval=${getTVInterval(tf)}`;
}

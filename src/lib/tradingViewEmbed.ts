import type { Timeframe } from "./timeframes";

const TV_SYMBOL: Record<string, string> = {
  "EUR/USD": "FX:EURUSD",
  "GBP/USD": "FX:GBPUSD",
  "USD/JPY": "FX:USDJPY",
  "AUD/USD": "FX:AUDUSD",
  "USD/CHF": "FX:USDCHF",
  "USD/CAD": "FX:USDCAD",
  "NZD/USD": "FX:NZDUSD",
  "XAU/USD": "OANDA:XAUUSD",
  "XAG/USD": "OANDA:XAGUSD",
};

export function getTVSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  const clean = upper.replace("/", "");
  return TV_SYMBOL[upper]?? `FX:${clean}`;
}

export function getTVInterval(tf: Timeframe): string {
  const map = {
    "1M": "1",
    "5M": "5",
    "15M": "15",
    "1H": "60",
    "2H": "120",
    "4H": "240",
    "D1": "D",
  } as const;
  return map[tf]?? "60";
}

export function getTradingViewEmbed(symbol: string, timeframe: Timeframe) {
  return {
    tvSymbol: getTVSymbol(symbol),
    interval: getTVInterval(timeframe),
  };
}

// FIX: Ito yung hinahanap ni ChartSnapPanel.tsx — kaya Error kanina
export function tradingViewUrl(symbol: string, timeframe: Timeframe): string {
  const { tvSymbol, interval } = getTradingViewEmbed(symbol, timeframe);
  return `https://www.tradingview.com/chart/?symbol=${tvSymbol}&interval=${interval}`;
}
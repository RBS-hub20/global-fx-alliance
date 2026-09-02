import { PAIRS } from "./market";
import { TIMEFRAMES, type Timeframe } from "./timeframes";

/**
 * One parser for the slash commands, shared by the assistant and Chart Snap so
 * `/snap XAU/USD 1H` means the same thing in both places.
 *
 * Pair and timeframe are optional everywhere: what the reader omits falls back
 * to whatever the dropdowns currently hold, which is why the caller passes its
 * own defaults in rather than the parser inventing them.
 */

export type CommandType = "snap" | "screenshot" | "pair" | "help" | "clear" | "other";

export interface ParsedCommand {
  type: CommandType;
  /** Present only when the input named one explicitly. */
  pair: string | null;
  timeframe: Timeframe | null;
  /** Whatever followed the verb, for commands that take free text. */
  rest: string;
}

/** "XAUUSD", "xau/usd", "gold", "cable" -> a symbol the registry knows. */
export function resolvePair(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.toUpperCase().trim();
  const direct = PAIRS.find((p) => p.symbol === t || p.symbol.replace("/", "") === t.replace("/", ""));
  if (direct) return direct.symbol;

  const aliases: Record<string, string> = {
    GOLD: "XAU/USD", BULLION: "XAU/USD", XAU: "XAU/USD",
    SILVER: "XAG/USD", XAG: "XAG/USD",
    BITCOIN: "BTC/USD", BTC: "BTC/USD",
    CABLE: "GBP/USD", STERLING: "GBP/USD", POUND: "GBP/USD", GBP: "GBP/USD",
    EURO: "EUR/USD", EUR: "EUR/USD", FIBER: "EUR/USD",
    YEN: "USD/JPY", JPY: "USD/JPY", GOPHER: "USD/JPY",
    AUSSIE: "AUD/USD", AUD: "AUD/USD",
    KIWI: "NZD/USD", NZD: "NZD/USD",
    SWISSY: "USD/CHF", CHF: "USD/CHF",
  };
  const mapped = aliases[t];
  // An alias is only useful if the registry actually carries that instrument.
  return mapped && PAIRS.some((p) => p.symbol === mapped) ? mapped : null;
}

function findTimeframe(tokens: string[]): Timeframe | null {
  for (const tok of tokens) {
    const up = tok.toUpperCase();
    if ((TIMEFRAMES as readonly string[]).includes(up)) return up as Timeframe;
  }
  return null;
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  const none: ParsedCommand = { type: "other", pair: null, timeframe: null, rest: trimmed };
  if (!trimmed.startsWith("/")) return none;

  const [verbRaw, ...tokens] = trimmed.slice(1).split(/\s+/);
  const verb = verbRaw.toLowerCase();
  const rest = tokens.join(" ");

  const type: CommandType =
    verb === "snap" ? "snap"
    : verb === "screenshot" || verb === "shot" ? "screenshot"
    : verb === "pair" || verb === "symbol" ? "pair"
    : verb === "help" || verb === "commands" || verb === "?" ? "help"
    : verb === "clear" ? "clear"
    : "other";

  if (type === "other" || type === "help" || type === "clear") {
    return { type, pair: null, timeframe: null, rest };
  }

  const timeframe = findTimeframe(tokens);
  // Whichever token is not the timeframe is the candidate pair. Tried joined too,
  // so "/snap XAU USD 1H" resolves as well as "/snap XAU/USD 1H".
  const pairTokens = tokens.filter((t) => t.toUpperCase() !== timeframe);
  const pair = resolvePair(pairTokens.join("/")) ?? resolvePair(pairTokens[0]) ?? null;

  return { type, pair, timeframe, rest };
}

/** True when the assistant should answer this with a structure read. */
export function isReadCommand(input: string): boolean {
  const t = parseCommand(input).type;
  return t === "snap" || t === "screenshot";
}

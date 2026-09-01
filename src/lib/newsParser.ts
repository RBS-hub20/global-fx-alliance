/**
 * RSS parsing for the market wire — pure, dependency-free, Edge-safe.
 *
 * Deliberately regex-based rather than pulling in an XML parser: the feeds are a
 * flat <item> list, and a parser library would cost more bundle than the whole
 * feature. Every function here is pure so it can be tested without network.
 */

export interface RawItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  category: string;
}

export type Sentiment = "bullish" | "bearish" | "neutral";
export type Category = "Forex" | "Gold" | "Central Banks" | "Economy" | "Crypto";

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&apos;": "'", "&#39;": "'", "&nbsp;": " ", "&hellip;": "…",
  "&mdash;": "—", "&ndash;": "–", "&rsquo;": "’", "&lsquo;": "‘",
  "&ldquo;": "“", "&rdquo;": "”",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** Strips tags and CDATA, collapses whitespace. */
export function stripHTML(html: string): string {
  return decodeEntities(
    html
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  // Tolerates attributes on the opening tag, e.g. <guid isPermaLink="true">.
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripHTML(m[1]) : "";
}

export function parseRSS(xml: string): RawItem[] {
  if (!xml || typeof xml !== "string") return [];
  const blocks = xml.split(/<item(?:\s[^>]*)?>/i).slice(1);
  const out: RawItem[] = [];

  for (const raw of blocks) {
    const block = raw.split(/<\/item>/i)[0] ?? raw;
    const title = tag(block, "title");
    if (!title) continue;
    out.push({
      title,
      link: tag(block, "link") || tag(block, "guid"),
      pubDate: tag(block, "pubDate") || tag(block, "dc:date"),
      description: tag(block, "description") || tag(block, "content:encoded"),
      category: tag(block, "category"),
    });
  }
  return out;
}

/**
 * Feeds disagree on date format. RFC-822 ("Tue, 01 Sep 2026 06:36:31 GMT") parses
 * correctly everywhere, but Investing.com emits "2026-09-01 06:30:04" with no zone —
 * which JS treats as *local* time. That silently shifts timestamps by the host's
 * offset and would differ between a dev machine and Vercel's UTC edge, so the
 * zone-less form is pinned to UTC explicitly.
 */
export function parseDate(pubDate: string): Date | null {
  const v = (pubDate ?? "").trim();
  if (!v) return null;

  const zoneless = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (zoneless) {
    const [, y, mo, d, h, mi, s] = zoneless;
    const t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
    return Number.isNaN(t) ? null : new Date(t);
  }

  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function timeAgo(pubDate: string, now: number = Date.now()): string {
  const d = parseDate(pubDate);
  if (!d) return "recently";
  const secs = Math.floor((now - d.getTime()) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1d ago" : `${days}d ago`;
}

const BULL = /\b(rise[sn]?|rising|gain(s|ed)?|rally|rallie[sd]|surge[sd]?|jump(s|ed)?|climb(s|ed)?|advance[sd]?|strengthen(s|ed)?|higher|beat(s)?|upbeat|optimis|bullish|recover(s|y|ed)?|rebound)/i;
const BEAR = /\b(fall(s|en|ing)?|drop(s|ped)?|slump(s|ed)?|slide[sd]?|sink(s|ing)?|tumble[sd]?|plunge[sd]?|weaken(s|ed)?|lower|miss(es|ed)?|pressure[sd]?|selloff|sell-off|bearish|decline[sd]?|retreat)/i;

/**
 * Naive keyword sentiment. Headlines are short and often ironic, so this is a
 * rough tint for scanning, not an analytical claim — the UI labels it
 * auto-detected for exactly that reason.
 */
export function detectSentiment(text: string): Sentiment {
  const t = text.toLowerCase();
  const bull = BULL.test(t);
  const bear = BEAR.test(t);
  if (bull && !bear) return "bullish";
  if (bear && !bull) return "bearish";
  return "neutral";
}

export function detectSymbols(text: string): string[] {
  const t = text.toLowerCase();
  const hits = new Set<string>();
  if (/\b(eur|euro|ecb|eurozone|euro-zone)\b/.test(t)) hits.add("EUR/USD");
  if (/\b(gbp|sterling|pound|boe|cable|uk)\b/.test(t)) hits.add("GBP/USD");
  if (/\b(jpy|yen|boj|japan)\b/.test(t)) hits.add("USD/JPY");
  if (/\b(gold|xau|bullion)\b/.test(t)) hits.add("XAU/USD");
  // Ticker forms (ETHUSD, BTCUSD) have no internal word boundary, so the bare
  // coin names alone miss them. BTC/USD is the only crypto instrument tracked,
  // so it stands in for the asset class.
  if (/\b(btc|bitcoin|crypto|ether|ethereum|altcoin)\b|\b(btc|eth|xrp|sol|ada|doge)usd\b/.test(t))
    hits.add("BTC/USD");
  if (/\b(aud|aussie|rba|australia)\b/.test(t)) hits.add("AUD/USD");
  if (/\b(nzd|kiwi|rbnz)\b/.test(t)) hits.add("NZD/USD");
  if (/\b(chf|franc|snb|swiss)\b/.test(t)) hits.add("USD/CHF");
  // Dollar-side stories default to the most-traded expression of them.
  if (!hits.size && /\b(usd|dollar|dxy|fed|fomc|treasury|yields?)\b/.test(t)) hits.add("EUR/USD");
  return Array.from(hits);
}

export function detectCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/\b(gold|xau|bullion|silver|metals?)\b/.test(t)) return "Gold";
  if (/\b(btc|bitcoin|crypto|ether|ethereum|blockchain|altcoin)\b|\b(btc|eth|xrp|sol|ada|doge)usd\b/.test(t))
    return "Crypto";
  if (/\b(fed|fomc|ecb|boe|boj|rba|snb|central bank|rate decision|policy|powell|lagarde)\b/.test(t))
    return "Central Banks";
  if (/\b(cpi|inflation|gdp|payroll|nfp|unemployment|pmi|retail sales|jobless|sentiment)\b/.test(t))
    return "Economy";
  return "Forex";
}

export function detectImportance(text: string): "high" | "medium" {
  return /\b(fed|fomc|ecb|boj|boe|nfp|non-farm|cpi|inflation|rate decision|payrolls?|gdp|powell|lagarde|emergency|intervention)\b/i.test(
    text
  )
    ? "high"
    : "medium";
}

/** Stable id from the title — deterministic across requests, no crypto needed. */
export function hashId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function truncate(text: string, max = 200): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

import { NextResponse } from "next/server";
import { NEWS } from "@/lib/content";

export const runtime = "edge";

/**
 * Market headlines.
 *
 * Attempts a public RSS feed first, then falls back to the curated desk notes in
 * lib/content. Most newswire feeds block cross-origin server fetches or rate-limit
 * hard, so the fallback is the expected path rather than an error case — `source`
 * says which one you got.
 */

const FEEDS = ["https://www.forexlive.com/feed/", "https://www.investing.com/rss/news_25.rss"];
const TIMEOUT_MS = 5000;

function tag(text: string): { sentiment: "bullish" | "bearish" | "neutral"; symbols: string[] } {
  const t = text.toLowerCase();
  const bull = /(rally|surge|jump|gain|rise|climb|strengthen|higher|beat)/.test(t);
  const bear = /(fall|drop|slump|slide|weaken|lower|miss|tumble|plunge)/.test(t);

  const symbols: string[] = [];
  if (/(euro|eur\/usd|ecb)/.test(t)) symbols.push("EUR/USD");
  if (/(sterling|pound|gbp|boe)/.test(t)) symbols.push("GBP/USD");
  if (/(yen|jpy|boj)/.test(t)) symbols.push("USD/JPY");
  if (/(gold|bullion|xau)/.test(t)) symbols.push("XAU/USD");
  if (/(aussie|aud|rba)/.test(t)) symbols.push("AUD/USD");
  if (!symbols.length && /(dollar|dxy|fed|fomc)/.test(t)) symbols.push("EUR/USD");

  return {
    sentiment: bull && !bear ? "bullish" : bear && !bull ? "bearish" : "neutral",
    symbols: symbols.length ? symbols : ["EUR/USD"],
  };
}

/** Minimal RSS title/link extraction — avoids pulling in an XML parser at the edge. */
function parseRss(xml: string, source: string, limit: number) {
  const items = xml.split(/<item[\s>]/i).slice(1, limit + 1);
  return items
    .map((chunk) => {
      const title = chunk
        .match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]
        ?.trim();
      const date = chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
      if (!title) return null;
      return { title, source, time: date ?? "recent", ...tag(title) };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("pair")?.toUpperCase();
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 20);

  for (const feed of FEEDS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(feed, { signal: ctrl.signal, cache: "no-store" });
      if (res.ok) {
        const parsed = parseRss(await res.text(), new URL(feed).hostname, limit);
        if (parsed.length) {
          const items = symbol ? parsed.filter((n) => n.symbols.includes(symbol)) : parsed;
          return NextResponse.json(
            { count: items.length, items: items.length ? items : parsed, source: "live" },
            { headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=360" } }
          );
        }
      }
    } catch {
      // Try the next feed, then the curated fallback.
    } finally {
      clearTimeout(timer);
    }
  }

  const curated = NEWS.map((n) => ({
    title: n.title,
    source: n.source,
    time: n.time,
    sentiment: n.sentiment.toLowerCase() as "bullish" | "bearish" | "neutral",
    symbols: [n.affects],
    summary: n.summary,
  }));
  const items = symbol ? curated.filter((n) => n.symbols.includes(symbol)) : curated;

  return NextResponse.json(
    { count: items.length, items: (items.length ? items : curated).slice(0, limit), source: "curated" },
    { headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=360" } }
  );
}

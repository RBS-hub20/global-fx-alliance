import { NextResponse } from "next/server";
import { NEWS } from "@/lib/content";
import {
  detectCategory, detectImportance, detectSentiment, detectSymbols,
  hashId, parseDate, parseRSS, timeAgo, truncate,
} from "@/lib/newsParser";

export const runtime = "edge";

/**
 * Market news wire.
 *
 * Reads public RSS from real forex desks, parses it in-process (no XML library —
 * the feeds are a flat <item> list and a parser would cost more bundle than the
 * feature), and classifies each headline.
 *
 * If every source fails the route still answers 200, but flagged `isReal: false`
 * with a SAMPLE badge. It never dresses curated copy up as a live wire.
 */

const SOURCES = [
  { provider: "ForexLive", url: "https://www.forexlive.com/feed/" },
  { provider: "Investing.com", url: "https://www.investing.com/rss/news_25.rss" },
  // ForexFactory's RSS answers 403 to server requests; FXStreet works and is
  // a better third leg.
  { provider: "FXStreet", url: "https://www.fxstreet.com/rss/news" },
] as const;

const TIMEOUT_MS = 5000;
const LIMIT = 10;

export interface Story {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  timeAgo: string;
  category: string;
  sentiment: string;
  symbols: string[];
  importance: "high" | "medium";
  isReal: boolean;
  badge: "LIVE" | "SAMPLE";
}

/** No custom headers: measured against Yahoo, spoofed browser agents get throttled harder. */
async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.text();
    return body && body.includes("<item") ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function toStory(
  item: { title: string; link: string; pubDate: string; description: string },
  provider: string,
  now: number
): Story {
  const date = parseDate(item.pubDate);
  const url = /^https?:\/\//i.test(item.link) ? item.link : null;

  /*
   * Classify on the headline, not the body. Wire descriptions are market
   * round-ups that name every asset in passing: an ETH story whose blurb
   * mentions bullion was landing in "Gold", and "retail sales slump" read
   * neutral because the body carried an offsetting bullish word. The body is
   * only consulted when the headline yields nothing.
   */
  const title = item.title;
  const body = item.description;

  const titleSymbols = detectSymbols(title);
  const symbols = titleSymbols.length ? titleSymbols : detectSymbols(body);

  const titleCategory = detectCategory(title);
  const category = titleCategory !== "Forex" ? titleCategory : detectCategory(body);

  const titleSentiment = detectSentiment(title);
  const sentiment = titleSentiment !== "neutral" ? titleSentiment : detectSentiment(body);

  return {
    id: hashId(item.title),
    title: item.title,
    summary: truncate(item.description, 200),
    source: provider,
    url,
    publishedAt: date ? date.toISOString() : null,
    timeAgo: timeAgo(item.pubDate, now),
    category,
    sentiment,
    symbols,
    importance: detectImportance(`${title} ${body}`),
    isReal: true,
    badge: "LIVE",
  };
}

/** Curated stand-in, always labelled SAMPLE so it cannot be mistaken for the wire. */
function sampleStories(now: number): Story[] {
  return NEWS.slice(0, LIMIT).map((n) => ({
    id: hashId(n.title),
    title: n.title,
    summary: n.summary,
    source: n.source,
    url: null,
    publishedAt: null,
    timeAgo: n.time,
    category: n.category,
    sentiment: n.sentiment.toLowerCase(),
    symbols: [n.affects],
    importance: detectImportance(`${n.title} ${n.summary}`),
    isReal: false,
    badge: "SAMPLE" as const,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("pair")?.toUpperCase();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? LIMIT) || LIMIT, 1), 20);
  const now = Date.now();

  const tried: string[] = [];

  for (const { provider, url } of SOURCES) {
    tried.push(provider);
    const xml = await fetchText(url);
    if (!xml) continue;

    const stories = parseRSS(xml)
      .filter((i) => i.title.length > 8)
      .map((i) => toStory(i, provider, now))
      // Newest first; undated items sink rather than jumping the queue.
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

    if (!stories.length) continue;

    const filtered = symbol ? stories.filter((s) => s.symbols.includes(symbol)) : stories;
    const out = (filtered.length ? filtered : stories).slice(0, limit);

    return NextResponse.json(
      {
        stories: out,
        items: out, // back-compat with the AI terminal's existing shape
        count: out.length,
        source: "live",
        provider,
        isReal: true,
        badge: "LIVE",
        filteredBy: symbol && filtered.length ? symbol : null,
        timestamp: new Date(now).toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  }

  const stories = sampleStories(now);
  const filtered = symbol ? stories.filter((s) => s.symbols.includes(symbol)) : stories;
  const out = (filtered.length ? filtered : stories).slice(0, limit);

  return NextResponse.json(
    {
      stories: out,
      items: out,
      count: out.length,
      source: "sample",
      provider: "curated",
      isReal: false,
      badge: "SAMPLE",
      reason: "all_rss_failed",
      tried,
      footnote:
        "Live wire unavailable — showing illustrative sample headlines. The real feed is retried every 2 minutes.",
      timestamp: new Date(now).toISOString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}

import { NextResponse } from "next/server";
import { parseDate, parseRSS, timeAgo, hashId, stripHTML } from "@/lib/newsParser";
import { classifyGold, dubaiClock, titleKey } from "@/lib/goldWire";

export const runtime = "edge";

/**
 * XAU/USD live wire.
 *
 * The same public desks the news tab already reads, filtered to what moves
 * gold: gold itself, the Fed, US data, Treasury yields, the dollar and
 * geopolitics. Equity, crypto and other-currency stories are dropped even
 * when they mention the Fed in passing.
 *
 * No sample fallback. If every feed is down the wire is empty and says so —
 * a curated story standing in for a live one on a trading desk is worse than
 * a blank.
 */

const SOURCES = [
  { provider: "ForexLive", url: "https://www.forexlive.com/feed/" },
  { provider: "FXStreet", url: "https://www.fxstreet.com/rss/news" },
  // The analysis feed is where most gold-specific pieces land — 11 of 30 on
  // the day this was written, against 1 of 30 on the general news feed.
  { provider: "FXStreet Analysis", url: "https://www.fxstreet.com/rss/analysis" },
] as const;

const TIMEOUT_MS = 6000;
const MAX_AGE_MS = 36 * 3_600_000;
const LIMIT = 30;

async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.text();
    return body.includes("<item") ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const now = Date.now();
  const feeds = await Promise.all(SOURCES.map(async (s) => ({ ...s, xml: await fetchText(s.url) })));

  const seen = new Set<string>();
  const stories = [];
  const status = [];

  for (const f of feeds) {
    const items = f.xml ? parseRSS(f.xml) : [];
    let kept = 0;
    for (const item of items) {
      const date = parseDate(item.pubDate);
      if (date && now - date.getTime() > MAX_AGE_MS) continue;

      const read = classifyGold(item.title, stripHTML(item.description ?? ""));
      if (!read.relevant) continue;

      const key = titleKey(item.title);
      if (seen.has(key)) continue;
      seen.add(key);
      kept++;

      stories.push({
        id: hashId(item.title),
        title: item.title,
        url: /^https?:\/\//i.test(item.link) ? item.link : null,
        source: f.provider,
        publishedAt: date ? date.toISOString() : null,
        timeAgo: timeAgo(item.pubDate, now),
        dubai: date ? dubaiClock(date) : null,
        tags: read.tags,
        bias: read.bias,
        impact: read.impact,
        why: read.why,
        driver: read.driver,
      });
    }
    status.push({ provider: f.provider, ok: !!f.xml, items: items.length, kept });
  }

  stories.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  return NextResponse.json(
    {
      stories: stories.slice(0, LIMIT),
      sources: status,
      sourcesUp: status.filter((s) => s.ok).length,
      method: "rule-based",
      timestamp: new Date(now).toISOString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } }
  );
}

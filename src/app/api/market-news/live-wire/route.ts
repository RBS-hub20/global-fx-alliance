import { NextResponse } from "next/server";
import { parseDate, parseRSS, timeAgo, hashId, stripHTML } from "@/lib/newsParser";
import { classifyGold, dubaiClock, titleKey } from "@/lib/goldWire";

/*
 * Node, not edge.
 *
 * FXStreet answers this project's laptop and refuses Vercel — a block on the
 * address, not on the request, since adding a User-Agent changed nothing. The
 * node runtime egresses from a different pool to the edge one, which is the
 * cheapest thing to try before resorting to a proxy. `status` below records
 * what each publisher actually said, so this is measurable rather than assumed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  /*
   * FXStreet is gone, both feeds. It answers a laptop and returns 403 to this
   * host on either runtime — a block on Vercel's addresses, measured rather than
   * guessed — so it contributed nothing but a dead row in the status list and a
   * "6 of 8 feeds" counter that made a healthy wire look broken.
   *
   * It was carried this long because its analysis feed was the one gold-specific
   * source. Investing's commodities feed replaced it and then some: 8 kept out
   * of 10 against FXStreet Analysis's 11 of 30, and it answers from here.
   */
  /*
   * Added after the wire was found running on one feed out of three.
   *
   * The two FXStreet feeds answer this machine and refuse Vercel, and before
   * the User-Agent below ForexLive did the opposite — so the live wire was
   * reading a single desk and showing "nothing tagged Gold". These three answer
   * both, and between them they cover the things that actually move gold:
   * dollar and rates commentary, Fed announcements from the source, and the
   * macro tape.
   *
   * Deliberately not added: mining.com's gold feed and Yahoo's GC=F headlines.
   * Both are full of junior-miner drilling results, which carry the word gold
   * and move the price of nothing. A fuller wire of noise is worse than a short
   * one that is all signal.
   */
  { provider: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
  /*
   * Chosen on kept, not on item count — the mistake that put two useless feeds
   * in here for an hour. Measured against the live classifier and the 36-hour
   * window before being added:
   *
   *   Investing commodities  10 items, all fresh, 8 kept, 8 tagged Gold
   *   Investing news         10 items, all fresh, 2 kept, 1 tagged Gold
   *   ActionForex            20 items, newest 2h, 2 kept
   *   Seeking Alpha           7 items, all fresh, 1 kept, 1 tagged Gold
   *
   * The commodities feed is the one that matters: it is gold-specific and
   * current, which is exactly what the wire has been missing while FXStreet
   * refuses this host.
   */
  { provider: "Investing Commodities", url: "https://www.investing.com/rss/commodities.rss" },
  { provider: "Investing", url: "https://www.investing.com/rss/news_11.rss" },
  { provider: "ActionForex", url: "https://www.actionforex.com/feed/" },
  { provider: "Seeking Alpha", url: "https://seekingalpha.com/market_currents.xml" },
  /*
   * Two sources were added here and removed again within the hour, which is
   * worth recording so they are not added back:
   *
   *   FXEmpire     answers 200 with 20 items whose newest is two months old.
   *                The age window drops every one of them, correctly.
   *   MarketWatch  answers 200 and is current, but its top-stories feed is
   *                equities and personal finance. Nought of ten were relevant.
   *
   * Both looked like wins on item count alone. Item count is not the measure —
   * kept is.
   */
] as const;

const TIMEOUT_MS = 6000;
const MAX_AGE_MS = 36 * 3_600_000;
const LIMIT = 30;

/*
 * A desk's feed reader, not an anonymous bot.
 *
 * Several of these publishers refuse a request with no User-Agent outright —
 * ForexLive answered 403 without one and 200 with it — and two of them answer a
 * redirect rather than the feed. Both were enough to take a source off the wire
 * silently, since a failed fetch just means that provider contributes nothing.
 */
const UA = "Mozilla/5.0 (compatible; GFXA-Wire/1.0; +https://globalfxalliance.io)";

/** What the publisher said, kept so a dead source is diagnosable from outside. */
const STATUS = new Map<string, string>();

async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8" },
    });
    STATUS.set(url, String(res.status));
    if (!res.ok) return null;
    const body = await res.text();
    if (!body.includes("<item")) {
      STATUS.set(url, `${res.status} but no <item>`);
      return null;
    }
    return body;
  } catch (e) {
    STATUS.set(url, e instanceof Error && e.name === "AbortError" ? "timeout" : "network error");
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
    status.push({ provider: f.provider, ok: !!f.xml, items: items.length, kept, http: STATUS.get(f.url) ?? "?" });
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

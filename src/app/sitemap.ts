import type { MetadataRoute } from "next";
import { TABS } from "@/lib/tabs";

const SITE = "https://globalfxalliance.io";

/**
 * Every dashboard tab is a distinct `?tab=` URL, so each one is listed. Market
 * surfaces change through the session and are marked hourly; account pages are
 * static and low priority.
 */
const HOURLY = new Set(["market-overview", "market-analysis", "market-news", "watchlist"]);
const LOW = new Set(["profile", "membership", "settings"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const tabs: MetadataRoute.Sitemap = TABS.map((t) => ({
    url: t.slug === "dashboard" ? `${SITE}/dashboard` : `${SITE}/dashboard?tab=${t.slug}`,
    lastModified: now,
    changeFrequency: HOURLY.has(t.slug) ? ("hourly" as const) : ("daily" as const),
    priority: t.slug === "dashboard" ? 0.9 : LOW.has(t.slug) ? 0.4 : HOURLY.has(t.slug) ? 0.8 : 0.6,
  }));

  return [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...tabs,
  ];
}

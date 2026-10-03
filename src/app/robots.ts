import type { MetadataRoute } from "next";

const SITE = "https://globalfxalliance.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The API routes are data endpoints, not pages worth indexing, and the
      // admin console has no business in an index even though it 404s for
      // anyone not on the allow-list.
      disallow: ["/api/", "/admin"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

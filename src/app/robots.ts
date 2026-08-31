import type { MetadataRoute } from "next";

const SITE = "https://globalfxalliance.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The API routes are data endpoints, not pages worth indexing.
      disallow: ["/api/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

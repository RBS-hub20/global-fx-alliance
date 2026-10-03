"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendBeacon } from "@/lib/beacon";

/**
 * Counts page views on the public funnel pages, for /admin.
 *
 * Unlike `MetaPixelRouteEvents` this does *not* skip the first load: there is no
 * base snippet here that already counted it. The two components therefore
 * report the same number by different means, which is what makes the Pixel tab
 * able to say whether the pixel is firing at all.
 *
 * The route handler drops any path outside the funnel, so a member moving around
 * /dashboard writes nothing — the check below only saves the round trip.
 */
const PUBLIC_PATH = /^\/(?:|join|links|l\/[a-z0-9-]{1,40})\/?$/;

export function SiteBeacon() {
  const pathname = usePathname();
  // Serialised for the same reason MetaPixel does it: useSearchParams() hands
  // back a new object every render, and depending on the object re-fires the
  // effect after hydration.
  const search = useSearchParams().toString();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!PUBLIC_PATH.test(pathname)) return;
    // A query-string-only change (?utm_…) is the same page view, not a new one.
    if (last.current === pathname) return;
    last.current = pathname;
    sendBeacon("page_view");
  }, [pathname, search]);

  return null;
}

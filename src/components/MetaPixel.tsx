"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { META_PIXEL_ID, trackPageView } from "@/lib/pixel";

/**
 * Meta Pixel.
 *
 * The base snippet fires PageView once on load. This app is a single page
 * application, so every navigation after that is a client-side route change
 * that the snippet never sees — hence the effect below, which fires PageView
 * on each one and deliberately skips the first, since the snippet already
 * counted it. Without the skip the landing page reports twice.
 *
 * `afterInteractive` keeps it off the critical path: it loads once the page is
 * usable, not before.
 *
 * Note on reach: this is on every route, including /dashboard, so the URL of
 * each member page a signed-in member opens is sent to Meta along with their
 * IP. That is what a site-wide pixel does. If you would rather it only covered
 * the public pages, the same EXCLUDED pattern used by the voice widget works
 * here — say the word.
 */

/**
 * The tags themselves take no hooks, so they render into the HTML at build
 * time. They were briefly inside the Suspense boundary below, which meant the
 * whole subtree fell back to null during static rendering and neither the
 * snippet nor the noscript pixel appeared in the served HTML.
 */
export function MetaPixel() {
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      {/*
        * Raw markup, not JSX children.
        *
        * React builds element children of <noscript> as real DOM nodes while
        * hydrating, and a browser with scripting ON fetches an <img> created
        * that way — so this tag was firing a second PageView
        * (…&ev=PageView&noscript=1) on every load, on top of the snippet's.
        * Assigning innerHTML on a noscript element keeps the markup as text
        * when scripting is enabled, which is the whole point of the tag: it
        * should only ever load for visitors without JavaScript.
        */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1" />`,
        }}
      />
    </>
  );
}

/**
 * Route changes. Separate because it reads searchParams, which needs a Suspense
 * boundary — keeping it apart lets the tags above stay in the static HTML.
 */
export function MetaPixelRouteEvents() {
  const pathname = usePathname();
  /*
   * Serialised, not the object: useSearchParams() hands back a fresh instance
   * on every render, so a dependency on it changed identity after hydration and
   * re-ran this effect — past the first.current guard, which had already been
   * spent. Every first load reported two PageViews. The string only changes
   * when the query actually changes.
   */
  const searchString = useSearchParams().toString();
  const first = useRef(true);

  useEffect(() => {
    // The base snippet already counted the first page; counting it again here
    // would report every landing twice.
    if (first.current) { first.current = false; return; }
    trackPageView();
  }, [pathname, searchString]);

  return null;
}

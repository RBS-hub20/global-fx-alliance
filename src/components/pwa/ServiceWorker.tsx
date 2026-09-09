"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Registration happens after load rather than during hydration, so it never
 * competes with the first paint or the first market fetch. It is skipped in
 * development, where a stale worker serving old chunks is a genuine debugging
 * trap rather than a feature.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An install that fails costs the offline shell and nothing else.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

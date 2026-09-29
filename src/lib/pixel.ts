"use client";

/**
 * Meta Pixel helpers.
 *
 * Every call is guarded: the pixel is a third-party script that can fail to
 * load, be blocked by an extension or be absent in development, and an
 * unguarded fbq() would throw inside a click handler and take the button with
 * it. A missed analytics event is not worth a broken page.
 */

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string };
    _fbq?: unknown;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1365104705411972";

function track(event: string, params?: Record<string, unknown>) {
  try {
    window.fbq?.("track", event, params);
  } catch {
    /* analytics must never break the page */
  }
}

/** Fired on the first load by the base snippet, and on every route change after. */
export const trackPageView = () => track("PageView");

/** A member opened a lesson: content_name is "Book 01 — Forex From Zero · Pips and points". */
export const trackViewContent = (params: { content_name: string; content_category?: string; content_ids?: string[] }) =>
  track("ViewContent", { content_type: "product", ...params });

/**
 * The two below have nothing calling them yet — this app has no checkout, no
 * buy button and no success page; membership is granted after a broker deposit
 * is verified by an admin. They are here so that flow is one line when it
 * exists, rather than a pixel integration to redo.
 */
export const trackInitiateCheckout = (params: { value: number; currency?: string; content_name?: string }) =>
  track("InitiateCheckout", { currency: "PHP", ...params });

export const trackPurchase = (params: { value: number; currency?: string; content_name?: string }) =>
  track("Purchase", { currency: "PHP", ...params });

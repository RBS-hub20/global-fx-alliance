"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    DograhWidget?: {
      setContext?: (vars: Record<string, string>) => unknown;
      close?: () => unknown;
    };
  }
}

/**
 * Hirestella / Dograh voice widget.
 *
 * Loaded once for the whole app and left in place across client-side
 * navigation, which is what the vendor's snippet expects — re-injecting the
 * script on every route change would start a second widget.
 *
 * Trust note, because this is the only third-party script on the site that can
 * see member pages: an embedded widget runs with the same privileges as our own
 * code. It can read the DOM, the Supabase session cookie (readable by design —
 * the browser client needs it) and anything typed into a form. Nothing about
 * that is specific to this vendor; it is what embedding any widget means. The
 * routes where a password is typed are therefore left out by default below.
 */

const TOKEN = process.env.NEXT_PUBLIC_HIRESTELLA_TOKEN || "emb_Fp6YyGFWki6RWZZtqcd0oFmRx5oIRrcHhkbiv5ZxdbM";
const API = process.env.NEXT_PUBLIC_HIRESTELLA_API || "https://voice.hirestella.ai";
const SCRIPT_ID = "dograh-widget";

/**
 * Routes the widget stays off.
 *
 * Every one of these has a password field on it — the Alliance password at
 * sign-in and sign-up, a new one at reset. A voice assistant has nothing to
 * answer on a login form, and keeping third-party code away from the one input
 * that must never leak costs nothing. Empty this array to load it everywhere.
 */
const EXCLUDED_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password"];

/** Context the assistant is given about where the visitor is. */
function contextFor(pathname: string): Record<string, string> {
  return {
    page_url: window.location.href,
    path: pathname,
    today: new Date().toISOString().slice(0, 10),
    event_code: "GFXA2026",
    community: "GFXA COMMUNITY",
  };
}

export function DograhWidget() {
  const pathname = usePathname();
  const blocked = EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    const root = () => document.getElementById("dograh-widget-root");

    /*
     * Skipping the load is not enough on its own. Arriving at /login from the
     * landing page is a client-side navigation, and the widget loaded there is
     * still mounted — it would sit on the password form anyway. So it is hidden
     * on the excluded routes and shown again on the way out.
     */
    if (blocked) {
      const r = root();
      if (r) {
        window.DograhWidget?.close?.();
        r.style.display = "none";
      }
      return;
    }

    const shown = root();
    if (shown) shown.style.display = "";

    /*
     * The dashboard has a fixed bottom navigation bar on phones. The widget
     * launcher sits bottom-right by default, on top of it; this flag lets the
     * stylesheet lift it clear, and only there.
     */
    const onDashboard = pathname.startsWith("/dashboard");
    if (onDashboard) document.body.dataset.bottomNav = "1";
    else delete document.body.dataset.bottomNav;

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      /*
       * Already loaded. The script reads data-dograh-context once, at init, so
       * rewriting the attribute would do nothing on a route change — the widget
       * publishes setContext() for exactly this, and it merges into the next
       * conversation. Attribute kept in step too, for a later hard reload.
       */
      existing.setAttribute("data-dograh-context", JSON.stringify(contextFor(pathname)));
      window.DograhWidget?.setContext?.(contextFor(pathname));
      return;
    }

    const js = document.createElement("script");
    js.id = SCRIPT_ID;
    js.src = `${API}/embed/dograh-widget.js?token=${encodeURIComponent(TOKEN)}&environment=production&apiEndpoint=${encodeURIComponent(API)}`;
    js.setAttribute("data-dograh-context", JSON.stringify(contextFor(pathname)));
    js.async = true;
    document.body.appendChild(js);
  }, [pathname, blocked]);

  return null;
}

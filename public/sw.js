/*
 * Service worker for the installed app.
 *
 * Deliberately hand-written and deliberately small. What matters here is what it
 * does NOT cache: no `/api/` response is ever stored. Every quote, candle,
 * calendar row and pattern this app shows carries a provenance label, and a
 * service worker replaying yesterday's gold price behind a "REAL · TwelveData"
 * badge would undo the whole point — that failure mode has already been fixed
 * twice in this codebase, once as a stale CDN ticker and once as modelled data
 * shown as live.
 *
 * So: the shell and static assets are cached so the app opens instantly and
 * survives a dead tunnel, and market data always goes to the network. Offline,
 * the reader gets the interface and an honest empty state rather than numbers
 * that look current and are not.
 */

const VERSION = "gfxa-v1";
const SHELL = `${VERSION}-shell`;

/** Navigation targets worth having on a cold, offline start. */
const PRECACHE = ["/", "/dashboard", "/join", "/links", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // A single missing entry must not fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Market data, the AI routes, the chat and the verification queue: network
  // only. Never served from cache, never written to it.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network first so a running app is always current, falling back
  // to the cached shell only when the network genuinely fails.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/dashboard")))
    );
    return;
  }

  // Build output is content-hashed, so a hit is always the right bytes.
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|jpg|jpeg|webp|woff2?|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          })
      )
    );
  }
});

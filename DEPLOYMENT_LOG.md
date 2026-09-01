# Deployment Log — GLOBAL FX ALLIANCE

## Live

| | |
| --- | --- |
| **Production URL** | <https://globalfxalliance.io> |
| Also serving | <https://www.globalfxalliance.io> |
| Vercel URL | <https://global-fx-alliance.vercel.app> |
| Team alias | <https://global-fx-alliance-rbs-hub-s-projects.vercel.app> |
| Immutable deployment | <https://global-fx-alliance-gsl2o9v0r-rbs-hub-s-projects.vercel.app> |
| Vercel project | `rbs-hub-s-projects/global-fx-alliance` |
| Deployment ID | `dpl_CNVDMRpwk7uBA1zuGvudreCEszbB` |
| Inspector | <https://vercel.com/rbs-hub-s-projects/global-fx-alliance/CNVDMRpwk7uBA1zuGvudreCEszbB> |
| Deployed | Aug 31, 2026 · 21:53 GST |
| Status | ● Ready · target `production` |
| GitHub repo | <https://github.com/RBS-hub20/global-fx-alliance> (public) |

Deployed from the CLI with `vercel --prod --yes --archive=tgz`.

## Build

Next.js 14.2.15 · Node 24 · region `iad1`

```
Route (app)                              Size     First Load JS
┌ ○ /                                    2.11 kB         103 kB
├ ○ /_not-found                            873 B          88 kB
└ ○ /dashboard                             48 kB         148 kB
+ First Load JS shared by all              87.1 kB

○  (Static)  prerendered as static content
```

Both routes are prerendered as static content. `/dashboard` reads `?tab=` on the
client inside a Suspense boundary, so tab switching costs no server round-trip while
the URL stays shareable.

### Transfer sizes measured on production

| Route | Uncompressed | Over the wire |
| --- | --- | --- |
| `/` | 1,045 KB | **50 KB** |
| `/dashboard` | 14.2 KB | **3.7 KB** |

The landing page's raw HTML is large because the dotted world map is inlined as a
single SVG path with a few thousand coordinates. It is extremely repetitive, so it
compresses about 21×, and Vercel serves it from the edge cache (`x-vercel-cache: HIT`).
No action needed; noted so the raw number isn't alarming.

## Verification — all green

Checked against the live production URL, not localhost.

| Check | Result |
| --- | --- |
| `/` | 200 |
| `/dashboard` | 200 |
| `/dashboard?tab=market-analysis&pair=XAU/USD` | 200 — loads with sidebar active, XAU/USD pill selected, price 2648.90 |
| `/dashboard?tab=journal` | 200 |
| `/logo.png` | 200 · 1,288,992 bytes |
| `/icon.svg` | 200 · 2,207 bytes |
| All 17 sidebar tabs | 17/17 render unique content, exactly 1 active item each |
| Console errors on live | **0** across a full 17-tab sweep |
| Shareable `?tab=` deep links | Direct load restores tab + preselected pair |
| localStorage persistence | Watchlist add survived a full page reload on production |
| Mobile bottom nav | Home · Markets · AI · Community · Profile — tab + active state switch |
| Mobile drawer | Opens, navigates, closes, releases body scroll |
| Public access | No deployment protection — reachable signed out |
| HTTPS / HSTS | `strict-transport-security: max-age=63072000; includeSubDomains; preload` |

## Pre-deploy checks

- `npm run build` — passes, no TypeScript errors
- `npm run lint` — **✔ No ESLint warnings or errors** (ESLint was not configured; added
  `.eslintrc.json` with `next/core-web-vitals`, fixed one unescaped apostrophe)
- `next.config.mjs` — `output: "export"` correctly **not** set
- `.gitignore` — covers `node_modules`, `.next`, `.env*`, `.vercel`
- `.env.local` (holds a Vercel OIDC token) and `.vercel/` are untracked

## Next steps

1. **Connect GitHub** for automatic deploys on push — see `GITHUB_SETUP.md`.
   Until then, deploys are manual via `npx vercel --prod --archive=tgz`.
2. ~~Custom domain~~ — **done**, `globalfxalliance.io` + `www` are live with TLS.
   Two optional follow-ups in `VERCEL_DEPLOY_GUIDE.md`: adopt Vercel's newer DNS
   targets, and decide whether `www` should redirect to the apex.
3. **Analytics** — `npm i @vercel/analytics`, then mount `<Analytics />` in
   `src/app/layout.tsx`. Speed Insights is `@vercel/speed-insights`.
4. **Environment variables** — none required today. The app has no backend and no
   secrets; all market data is generated locally from a seeded PRNG.

---

## Update — custom domain added (Aug 31, 2026)

`globalfxalliance.io` and `www.globalfxalliance.io` attached to the project and
verified. Registrar Namecheap; Namecheap nameservers kept, with records pointed at
Vercel.

| Check | Result |
| --- | --- |
| `dig globalfxalliance.io +short` | `76.76.21.21` — as expected |
| `dig www.globalfxalliance.io +short` | `cname.vercel-dns.com` |
| `vercel domains verify` (apex) | `ok: true`, `misconfigured: false`, `attached: true`, `verified: true` |
| `vercel domains verify` (www) | `ok: true`, `misconfigured: false` |
| `https://globalfxalliance.io/` | 200 |
| `https://www.globalfxalliance.io/` | 200 |
| `https://globalfxalliance.io/dashboard?tab=market-analysis&pair=XAU/USD` | 200 |
| `https://globalfxalliance.io/logo.png` | 200 |
| TLS certificate | Let's Encrypt, `CN=globalfxalliance.io`, valid to Nov 29 2026 |
| All 17 dashboard tabs on `.io` | 17/17 unique panels, **0 console errors** |
| Open Graph URL | `https://globalfxalliance.io` |
| OG image | `https://globalfxalliance.io/logo.png` |
| `global-fx-alliance.vercel.app` | still 200 |

Code changes in this deploy:

- `src/app/layout.tsx` — `SITE` constant `globalfxalliance.com` → `globalfxalliance.io`,
  which drives `metadataBase`, the canonical and the Open Graph URL.
- `src/components/dashboard/panels/MembershipPanel.tsx` — referral link moved to the
  real domain so the app stops advertising a hostname the project does not own.

Two open items, both optional and both documented in `VERCEL_DEPLOY_GUIDE.md`:

1. Vercel reports `dns_change_recommended` — it now prefers `216.198.79.1` / `64.29.17.1`
   for the apex. Flagged `optional-change`; the current record works.
2. `www` serves `200` rather than redirecting to the apex. Canonical metadata already
   points at the apex, so this is a preference, not a defect.

---

## Update — Analytics + GitHub readiness (Aug 31, 2026)

Commit `931fb9e` · deployment `global-fx-alliance-crsc1l48t` · target `production` · Ready

### Vercel Analytics + Speed Insights

`@vercel/analytics@2.0.1` and `@vercel/speed-insights@2.0.0` installed and mounted at
the end of the root layout body in `src/app/layout.tsx`.

| Check | Result |
| --- | --- |
| `npm run lint` | ✔ no warnings or errors |
| `npx tsc --noEmit` | clean |
| `npm run build` | passes — `/` and `/dashboard` both still **static** |
| Bundle impact | shared JS 87.1 kB → 87.2 kB; `/dashboard` 148 → 149 kB |
| `/_vercel/insights/script.js` | 200, loaded in the browser |
| `/_vercel/speed-insights/script.js` | 200 |
| `window.va` / `window.si` | both `function` — both components mounted |
| **Pageview beacon** | **`/_vercel/insights/view` fired** — Analytics is collecting |
| All 17 tabs after analytics | 17/17 unique panels, **0 console errors** |
| `https://globalfxalliance.io/` · `/dashboard` · `www` | 200 · 200 · 200 |

Neither script appears in the server-rendered HTML — both packages inject client-side
from an effect, so checking view-source will not show them. Verify in the browser
(`window.va`) or in the network panel instead.

Speed Insights is mounted and its queue is live; web-vitals beacons flush later in the
page lifecycle, so no vitals request was observed during this check. Data should appear
in the dashboard once real traffic accumulates.

Dashboards:
- Analytics — <https://vercel.com/rbs-hub-s-projects/global-fx-alliance/analytics>
- Speed Insights — <https://vercel.com/rbs-hub-s-projects/global-fx-alliance/speed-insights>

### GitHub — pushed and connected ✅

<https://github.com/RBS-hub20/global-fx-alliance> · public · default branch `main`

An empty public repo of that name already existed on the account, so it was reused
rather than recreated — it had zero commits, so nothing was overwritten. All 5 commits
pushed; local and `origin/main` are in sync.

`vercel git connect --yes` linked it to the existing project, so **auto-deploy is
active**: a push to `main` builds and promotes to production, and pull requests get
preview URLs. This deliberately avoided importing through `vercel.com/new`, which would
have created a second project and left `globalfxalliance.io` on the old one.

Pre-push safety check: `.gitignore` covers `node_modules`, `.next`, `out`, `.env*`,
`.vercel`, `.DS_Store`, `next-env.d.ts`. No `.env*` or `.vercel` paths are tracked, and
a scan of tracked files for OIDC tokens, private keys and `ghp_`/`sk-` patterns found
nothing.

---

## Update — GFXA Terminal (Sep 1, 2026)

Bloomberg-style terminal and a pro auto-drawn chart on the Market Analysis tab.

### New modules

| File | What it does |
| --- | --- |
| `src/lib/indicators.ts` | EMA, SMA, RSI, MACD, Bollinger, ATR, swing pivots, S/R clustering, trend fitting. Pure math, no dependencies. Warm-up positions return `null` so indices stay aligned with the candles. |
| `src/lib/autoDraw.ts` | Turns candles into drawings: top 3 supports and resistances by strength, dominant trendline, recent fair-value gaps, EMA levels. |
| `src/lib/ai.ts` | Four agents — technical, fundamental, flow, risk — over one shared context, returning a structured `TerminalReport`. |
| `src/components/chart/TradingViewChart.tsx` | TradingView Lightweight Charts v4.2.3 with candles, volume, EMA 20/50/200, dashed S/R price lines, a two-point trendline series and HTML-overlay FVG boxes. |
| `src/components/dashboard/TickerTape.tsx` | Scrolling quote strip, polls live every 60s, falls back to seeded values. |

### API routes (Edge)

| Route | Cache | Upstream | Behaviour |
| --- | --- | --- | --- |
| `/api/market/live` | `s-maxage=60` | exchangerate-api → twelvedata demo → seeded | Returns quote + 96 OHLC bars. Never throws; `source` says `live` or `fallback`. |
| `/api/calendar/live` | `s-maxage=300` | curated | Today's schedule, marks which have printed against the UTC clock. |
| `/api/news/live` | `s-maxage=180` | forexlive RSS → investing RSS → curated | Parses RSS at the edge, tags sentiment and symbols. |

Verified live in dev: EUR/USD returned `source: "live"` at 1.1601 and the ForexLive
feed parsed real headlines, so both upstreams work rather than only the fallback path.

### Honesty constraints

- `seriesSource` is always `"modeled"`. The spot quote can be live, but the OHLC
  candles are synthesised from the seeded engine and re-based onto that quote — they
  are not real historical prints, and the UI says so.
- Upstream quotes are sanity-gated at 35% against the seeded reference, so a wrong
  instrument resolution (metals, indices) falls back rather than printing nonsense.
- Every terminal report ends with the educational disclaimer.

### Bugs found and fixed during this build

1. **MACD flipped bearish on floating-point noise.** A perfectly linear series
   converges to a histogram of exactly zero; float error landed at ~1e-15 and read as
   a bearish crossover. Added a relative deadband.
2. **The signal guardrail was unreachable for any query naming a pair.** "Should I buy
   EUR/USD?" matched pair routing first and returned an analysis instead of declining.
   The refusal now runs before pair detection.
3. **Fair-value gaps could never form.** The candle generator opened every bar exactly
   at the prior close, so three-candle imbalances were impossible and the feature was
   permanently empty. Added deterministic gap-opens on ~8% of bars.
4. **S1/R1 labelled the strongest level, not the nearest.** Levels are now selected on
   strength then presented nearest-first, matching how traders read them.
5. **Unrelated headlines presented as pair-relevant.** When no headline matches the
   instrument the report now says so instead of passing off the broad tape.

### Verification

| Check | Result |
| --- | --- |
| Indicator unit tests | 24/24 pass (known vectors, edge cases, degenerate inputs) |
| Auto-draw tests | all pass across 4 instruments — OHLC validity, determinism, anchor re-basing |
| AI agent tests | 4 sections populated, guardrails hold on 4 phrasings, no `NaN`/`undefined` leaks |
| `npm run lint` / `tsc --noEmit` | clean |
| `npm run build` | passes; `/dashboard` 56.3 kB, first load 157 kB |
| Bundle | lightweight-charts is dynamically imported (`ssr: false`), so first load grew ~8 kB, not ~45 kB |
| All 17 tabs after the rewrite | 17/17 unique panels, **0 console errors** |

---

## Update — Launch Kit (Sep 1, 2026)

### SEO

- Full metadata in `src/app/layout.tsx`: canonical, keywords, authors, Open Graph
  (1200×630) and a `summary_large_image` Twitter card.
- `src/app/sitemap.ts` → **18 URLs** (root + all 17 dashboard tabs). Market surfaces
  are `hourly`, account pages `0.4` priority.
- `src/app/robots.ts` → allows all, disallows `/api/`, points at the sitemap.
- `public/og-image.png` — 1200×630, **80 KB**, generated with Pillow: brand wordmark,
  candlestick chart with EMA and dashed auto-S/R, terminal strip, domain badge and the
  educational disclaimer.

### Waitlist

`lib/waitlist.ts` + `components/launch/Waitlist.tsx` (modal, dismissible top banner,
inline footer form) + `app/api/waitlist/route.ts`.

- Addresses are kept in `localStorage` on the visitor's own device. The edge route
  validates and rate-limits but **deliberately stores nothing** — there is no database
  and no processor, so taking custody of addresses would be the dishonest option. Only
  a timestamped count is logged.
- Rate limit: 5 requests / minute / IP in edge-isolate memory. Verified returning 429.
- Hidden honeypot field; a filled one returns success and discards.

### Social proof

`components/launch/SocialProof.tsx`, driven by `lib/launch.ts`.

The stat row reports **facts countable in the repo** — 17 tools, 8 instruments, 4 AI
agents, 8 chapters, 24/7. The rotating activity strip is labelled *Sample activity* and
the quotes carry a *Sample feedback · illustrative* badge plus an explicit footnote.

> **Deliberate deviation.** The brief asked for "2,480+ verified members" in the meta
> description, OG image and testimonials. That number is the demo profile's reputation
> score; the site has no registered users. Publishing it as a factual claim — with
> attributed testimonials — on a live financial site would be fabricated social proof.
> Every figure now routes through `COMMUNITY_TARGET` / `PRODUCT_STATS` in
> `lib/launch.ts` with a `verified` flag: set the real numbers and flip the flag when
> the community exists.

### Analytics goals

`lib/analytics.ts` wraps `window.va` with full guarding (absent in dev and for anyone
blocking analytics). Events wired: `waitlist_signup`, `terminal_query`, `pair_selected`,
`chart_timeframe_changed`, `tab_changed`, `calculator_used`, `watchlist_add`,
`chapter_joined`.

### Bug found and fixed

**The waitlist's styled validation error was dead code.** Both inputs are
`type="email"`, so the browser's native constraint validation blocked submit and showed
its own tooltip — `isValidEmail` never ran and the accessible inline error never
rendered. Added `noValidate` to both forms so our validator owns the message. Verified:
invalid input now shows *"That doesn't look like a valid email address."*

### Verification

| Check | Result |
| --- | --- |
| `/sitemap.xml` | 200, **18 `<url>` entries** |
| `/robots.txt` | 200, `Disallow: /api/` + sitemap line |
| `/og-image.png` | 1200×630, 80 KB |
| `POST /api/waitlist` valid | `{ok:true, stored:false}` |
| `POST /api/waitlist` invalid | **400** with a message |
| Honeypot filled | 200, silently discarded |
| Rate limit | **429** after 5 in a minute |
| Waitlist modal | invalid → styled alert · valid → success + persisted |
| `npm run build` / `lint` / `tsc` | clean |
| All 17 tabs | 17/17 unique, **0 console errors** |

---

## Update — B2.5 Real Candles (Sep 1, 2026)

Modelled OHLC replaced with real historical candles from Yahoo Finance's public
chart endpoint. Free, no API key, server-side only (no CORS).

### Symbol mapping (`src/lib/yahooSymbols.ts`)

Candidates are ordered and tried in sequence — every one below was checked against
the live endpoint first rather than assumed:

| Pair | Yahoo | Note |
| --- | --- | --- |
| EUR/USD · GBP/USD · AUD/USD · NZD/USD · USD/CHF · EUR/GBP | `EURUSD=X` … | 200 |
| USD/JPY | `JPY=X` → `USDJPY=X` | both work, `JPY=X` canonical |
| XAU/USD | `GC=F` → `XAUUSD=X` | **`XAUUSD=X` is 404** — futures is the working proxy |
| BTC/USD | `BTC-USD` | 200 (added to `PAIRS`) |
| DXY · SPX | `DX-Y.NYB` · `^GSPC` | API-reachable, not in the pair list |

### Range → interval, measured not guessed

| Timeframe | Yahoo | Bars (EUR/USD · GC=F) |
| --- | --- | --- |
| 1D | `1d` / `5m` | 54 · 269 |
| 1W | `5d` / `30m` | 199 · 184 |
| 1M | `1mo` / `1h` | 400 (capped) · 400 |
| 3M | `3mo` / `1d` | 67 · 65 |
| 1Y | `1y` / `1d` | 260 · 252 |

Several plausible combinations return too few bars to compute a 200-period average,
so the pairing was chosen by measuring. Payload capped at 400 bars, most recent kept.

### Fallback chain

1. **Yahoo** — real candles. Authoritative, so its price is *not* sanity-gated against
   the seeded reference (real gold is ~4,490; the modelled figure is 2,648.90).
2. **exchangerate-api** — spot only, re-bases modelled candles. Still gated at 35%,
   because resolving the wrong instrument there is a real failure mode.
3. **Seeded engine** — always available.

`isReal`, `source`, `symbolUsed` and `reason` are returned on every response, and the
chart badge reads **REAL · GC=F** (green) or **MODELED** (amber) directly from them.

### Two findings worth recording

**1. The brief's `User-Agent: Mozilla` header made things worse.** Measured over 5
rounds against the live endpoint:

| Headers sent | Success |
| --- | --- |
| none | **5/5** |
| `User-Agent` | 4/5 |
| `User-Agent` + `Accept` + `Accept-Language` | 3/5 |

Yahoo throttles requests that look like browser scraping harder than plain
programmatic ones. All custom headers were removed; failures now report
`reason: "yahoo_rate_limited"` when the upstream answers 429.

**2. Real data exposed a latent bug in pivot detection.** `detectSwings` disqualified a
pivot on *any* tie in the lookback window. Real FX prints repeat the same 5m high and
low constantly, so EUR/USD produced **zero** pivots — no support, no resistance, no
trendline. Gold hid it, because futures prices are more granular. Fixed by resolving
ties per side (strict dominance left, equality tolerated right) and shrinking the
window for short series. EUR/USD went 0 → 2 pivots, BTC 0 → 3, USD/JPY 0 → 3, gold 13.

### Verification

| Check | Result |
| --- | --- |
| Parser unit tests | **20/20** — nulls, NaN, inverted extremes, dedupe, sort, 400-bar cap, all failure modes |
| Indicator + auto-draw suites | still pass after the pivot fix |
| `/api/market/live?pair=EUR/USD` | `source: yahoo`, `EURUSD=X`, 55 real bars |
| `/api/market/live?pair=XAU/USD` | `source: yahoo`, **`GC=F`**, 269 bars, price 4,486.70 |
| `/api/market/live?pair=BTC/USD` | `source: yahoo`, `BTC-USD`, 43 bars |
| All five timeframes | real data, 1Y spanning Aug 2025 → Sep 2026 |
| FX volume | `hasVolume: false` → histogram and legend key hidden, footnote explains why |
| `lint` / `tsc` / `build` | clean · `/dashboard` 56.6 kB, first load **158 kB** |

Intraday FX bar counts are time-of-day dependent: at 03:25 UTC the session is ~4.5
hours old, so `1D` returns ~55 bars rather than a full ~288. That is correct behaviour,
not a truncation.

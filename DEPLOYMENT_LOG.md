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

---

## Update — Real News Wire (Sep 1, 2026)

Mock headlines replaced with real RSS from forex desks, parsed in-process at the edge.

### Sources, checked before mapping

| Source | Result | Note |
| --- | --- | --- |
| ForexLive | 200 · 25 items | primary · RFC-822 dates · has descriptions |
| Investing.com `news_25` | 200 · 10 items | **no `<description>`** · zone-less dates |
| FXStreet | 200 · 30 items | third leg · RFC-822 · has descriptions |
| ForexFactory | **403** | blocked to server requests — dropped, FXStreet used instead |

The brief listed ForexFactory as the third fallback; it refuses server-side requests, so
FXStreet replaced it.

### Parsing (`src/lib/newsParser.ts`)

Regex-based, no XML dependency — the feeds are a flat `<item>` list and a parser library
would cost more bundle than the whole feature. Pure functions, unit-tested without network.

**The timezone trap.** Feeds disagree on date format. Investing.com emits
`2026-09-01 06:30:04` with no zone, which JavaScript parses as *local* time:

```
new Date("2026-09-01 06:30:04")  ->  2026-09-01T02:30:04Z   // on a GMT+4 host
```

Four hours off, and it would differ again between a dev machine and Vercel's UTC edge —
every "2h ago" silently wrong. Zone-less timestamps are now pinned to UTC explicitly.

### Classification

Sentiment, symbols, category and importance are keyword-derived and labelled
**auto-detected** in the UI, because headline sentiment is genuinely unreliable.

Two accuracy fixes came out of reading real output:

1. **Classify on the headline, not the body.** Wire descriptions are market round-ups
   that name every asset in passing — an ETH story whose blurb mentioned bullion landed
   in "Gold", and *"retail sales slump"* read neutral because the body carried an
   offsetting bullish word. The body is now only consulted when the headline yields
   nothing. "Slump" now reads bearish.
2. **Ticker forms have no word boundary.** `\b(ether|ethereum)\b` never matches
   `ETHUSD`, so those stories fell through to the body. Added `(btc|eth|xrp|sol|ada|doge)usd`.

### Honest badging

| State | Response | UI |
| --- | --- | --- |
| Wire reachable | `source: "live"`, `isReal: true`, `badge: "LIVE"`, provider named | green pulsing **LIVE WIRE · ForexLive**, titles link to the real article |
| All sources fail | `source: "sample"`, `isReal: false`, `badge: "SAMPLE"`, `reason`, `tried[]`, footnote | amber **SAMPLE MODE** bar, `url: null` so no fake links |

Cache: `s-maxage=120` live (news does not need 60s), `s-maxage=60` sample so it recovers sooner.

### Verification

| Check | Result |
| --- | --- |
| Parser unit tests | **38 + 7 pass** — dates, entities, CDATA, missing description, guid fallback, classifiers, truncation |
| `/api/news/live` | `source: live`, provider **ForexLive**, 10 stories, real URLs, real ISO timestamps |
| `?pair=XAU/USD` | filters to gold stories, `filteredBy` echoed |
| **Fault injection** — all 3 sources pointed at an unreachable host | **HTTP 200**, `SAMPLE`, `reason: all_rss_failed`, `tried: [ForexLive, Investing.com, FXStreet]`, `url: null`. Restored and re-verified live. |
| `lint` / `tsc` / `build` | clean · `/dashboard` 55.6 kB, first load **157 kB** (down 1 kB, no new deps) |
| All 17 tabs | 17/17 unique, **0 console errors** |

### Consistency fix

Top Movers read the static `PAIRS` table, so it showed gold at its seeded **2,648.90**
on the same screen the chart was drawing real Yahoo candles near **4,485**. It now reads
the same `/api/market/live` endpoint as the chart and carries its own Real/Modeled badge.

---

## Update — Value Tools: Journal Analytics + Pattern Radar (Sep 1, 2026)

Two features aimed at what a broker community does not give a trader: a read of their
own behaviour, and a scan of where to look. Tabs go 17 → **19**.

### Cross-Broker Journal Analytics (`?tab=journal-analytics`)

`src/lib/journalParser.ts` — pure, dependency-free CSV parsing and analytics.

- **Columns matched by alias, not position.** MT4 and MT5 exports differ per broker and
  build. MT5 also repeats `Time` and `Price` for open and close, so duplicate headers are
  resolved positionally.
- **Delimiter auto-detected** (comma, semicolon, tab) and quoted fields handled.
- **Symbols normalised** — `EURUSD`, `XAUUSD.m`, `EURUSD#` all become `EUR/USD`.
- **Broker inferred** from the comment column or filename (Vantage, VT Markets, PUPRIME).
- **Timestamps read as UTC**, since MT4/MT5 emit broker-server local time with no zone.
- Balance/credit rows are skipped rather than counted as trades.

Computed: win rate, profit factor, expectancy, max drawdown from a real equity curve,
per-pair / per-hour / per-day / per-session buckets, hold-time asymmetry, plus two
behavioural detectors — **revenge sizing** (three consecutive losers then a >50% size
jump) and **overtrading** (>10 closes in one clock hour). Rankings ignore buckets with
fewer than three trades so a single lucky trade cannot become "your best pair".

**Privacy: the panel does not call the API.** It runs the same parser in the browser, so
a trading history never leaves the device; it is saved only to local storage. The
endpoint exists for programmatic use and is stateless — `stored: false`.

### Pattern Radar (`?tab=pattern-radar`)

`src/lib/patternDetector.ts` over real Yahoo candles, reusing the chart's own
`detectSwings` / `findSupportResistance`, so anything flagged is visible on the chart.

Detects bullish/bearish engulfing, support bounce, resistance rejection, bullish/bearish
RSI divergence and fair-value-gap retests. **Confidence is only raised to `high` when two
independent conditions agree** — an engulfing candle at a level price has already
respected, or a level with three or more touches. A pattern on its own stays `medium`.

Surfaces in three places: a mini widget under Market Pulse on the dashboard, the full
tab, and deep links straight to the chart with the pair preselected.

### Verification

| Check | Result |
| --- | --- |
| Journal parser tests | **32/32** — MT4 comma, MT5 semicolon with duplicated headers, `.m` suffixes, balance rows, quoted fields, empty/garbage input, revenge detection |
| Sample statement | 54 trades, 37% WR, PF 0.37, revenge caught (0.1 → 0.5 lots), losers held 3.6× longer |
| `POST /api/journal/parse` multipart | 200, `REAL`, 54 trades, `stored: false` |
| `POST` garbage | **422** with export instructions, not a 500 |
| `GET /api/journal/parse` | `SAMPLE` badge |
| `/api/patterns/live` | `source: yahoo`, **12–14 real patterns** across 6 instruments |
| All tabs | **19/19 unique, 0 console errors** |
| `lint` / `tsc` / `build` | clean · `/dashboard` 66.1 kB, first load **167 kB**, no new dependencies |

### Two bugs found during the build

1. **Raw float precision leaked into pattern prices** — `4420.39990234375` rather than
   `4420.40`. Rounded to each instrument's own precision.
2. **Duplicate React keys.** A bullish and a bearish fair-value-gap retest can occur on
   the same symbol at the same timestamp, so `symbol-type-time` collided. Direction and a
   sequence number are now part of the id.

### On the value framing

The brief asked for copy contrasting this with what "broker community only tells you".
Vantage, VT Markets and PUPRIME are partners, so the landing section states what the
tools do — *find out **why** you lose* and *find out **where** to look* — without a swipe
at anyone. Same message, no partner risk.

---

## Update — Enhanced AI Tools (Sep 1, 2026)

The assistant now reads context instead of answering in the abstract: the reader's own
imported statement, the pattern scanner, live quotes, the wire, and the session clock.

### New modules

| File | Role |
| --- | --- |
| `src/lib/journalStore.ts` | Read-only access to the imported statement (browser-only). Falls back to the sample and flags `isReal: false`. |
| `src/lib/sessionTime.ts` | Session windows in UTC, rendered in Dubai time. Pure over an injected `now`, so it is testable without mocking the clock. |
| `src/lib/aiCommands.ts` | Ten slash commands, each grounded in something the app can show. |

### Commands

`/help` · `/explain last loss` · `/my best hour` · `/my worst pair` · `/my revenge` ·
`/why <symbol> moved` · `/pattern radar <symbol>` · `/community sentiment <symbol>` ·
`/session` · `/clear`

Journal commands answer instantly from local storage; market commands fetch real quotes,
patterns and headlines in parallel. Every answer carries a **Sources** line naming what it
read — e.g. *Yahoo GC=F real · ForexLive live · Pattern Radar (6) · Sample journal (54)*.

`/explain last loss` is the one that earns the feature: it links the trade to the hour it
was taken, the pair's record, hold-time behaviour and any revenge sizing, then shows where
price is now and what the radar sees.

### Session awareness

Header greeting plus per-session chips showing **your own** win rate from the statement,
refreshed each minute against Dubai time. Quick prompts are generated from real context —
`/my worst pair` appears only when a losing instrument exists, `/pattern radar XAU/USD`
only when a high-confidence pattern is live.

### Memory

Conversation persists to local storage across reloads. **Clear** wipes both the view and
the stored history.

### Honesty decisions

The brief asked the assistant to state *"62% bullish from 12 verified traders"*, *"2
verified traders watching this level"*, and a *"stop hunt map: 200 stops last week"*. None
of that data exists — there are no members and no order-flow feed. Inventing it inside an
assistant that also reports genuinely real numbers would make the real ones untrustworthy.

`/community sentiment` therefore returns the figures **explicitly labelled as illustrative**,
states plainly that there is no member-positioning feed yet, and points the reader at
`/pattern radar` for something measured. The trader-count and stop-hunt claims were dropped.

### Bugs found while building

1. **Negative P/L lost its minus sign.** `${n >= 0 ? "+" : ""}$${Math.abs(n)}` rendered
   −725.73 as `$725.73` — a losing book displayed as a winning one. Replaced with a signed
   formatter.
2. **`/session` contradicted itself** — *"strongest London (33%), weakest Tokyo (50%)"*.
   Sessions are ranked by net P/L but the sentence quoted win rate. It now reports net
   alongside win rate and notes that the two do not always agree.

### Verification

| Check | Result |
| --- | --- |
| `/my best hour` | "Best 10:00 — 100% over 3 trades, $40.13. Worst 04:00 — 20% over 5, −$272.80" |
| `/explain last loss` | GBP/USD 0.5 lots, −$203.95, held 180m — correctly flagged as the worst hour and linked to the pair's 20% record |
| `/why gold moved` | real `GC=F` 4434.30 −1.05%, real ForexLive headline, high-confidence Bearish Engulfing |
| `/session` | live board with personal win rate per session |
| Generate Summary | session + FX + metals + crypto + radar + wire + book, four action buttons, sources line |
| Generate Idea | real `EURUSD=X` 157 bars, radar pattern, **per-pair** record (46% over 13 trades), risk example |
| Memory | survives reload; Clear wipes both |
| All tabs | **19/19 unique, 0 console errors** |
| `lint` / `tsc` / `build` | clean · `/dashboard` 73.1 kB, first load **174 kB**, no new dependencies |

---

## Update — Chart Snap Analyzer (Sep 1, 2026)

Screenshot to worked trade plan. Tabs go 19 → **20** (`?tab=chart-snap`, under Tools).

### The design decision that shaped it

The brief specified `chartVision.ts` doing *"mock pattern detection: randomly pick from
[Bullish Engulfing, Bearish Engulfing, …] + confidence HIGH/MEDIUM"*.

That was not built. A feature that says *"we analyzed your chart"* and returns a **randomly
drawn pattern wearing a HIGH-confidence badge** is fabricated analysis attached directly to
a position-sizing decision — the reader would size real money against a coin flip.

The honest version is also the stronger one: **the reader names the instrument and
timeframe** — visible on their own chart — and the plan is computed from live Yahoo candles,
the real `patternDetector`, real auto-drawn S/R and their own imported statement. A banner
at the top of the panel says plainly that the image is not read, and the API returns
`imageAnalysed: false` so no client can present it otherwise. The screenshot is displayed
for reference and never stored or forwarded.

### What it produces

Bias, reference entry, invalidation, two objectives with R multiples, and position size from
the saved Trade Profile (% of account or fixed $, three styles). The invalidation prefers a
**real level price has already respected**, with ATR only as fallback — and `stopBasis`
states which was used.

Merged client-side: your win rate on that instrument, a warning when the current Dubai hour
is your worst, a note when you hold losers longer (suggesting Target 1 over Target 2), and
the live session board.

**Share to community** writes to local storage and the post genuinely appears in the
Community feed — there is no backend, so that is the honest implementation.

### Three bugs found while building

1. **Staleness checked against a modelled price.** When Yahoo missed and the series fell back
   to modelled candles, entering a real screenshot price of 4400 reported *"STALE SCREENSHOT
   −39.8%"* — blaming the reader's chart when it was our own fallback that was off.
   Comparison is now gated on `isReal`, and says why it cannot check otherwise.
2. **Style note misdescribed the plan.** It read "tight invalidation" even when a structural
   level, not the style's ATR multiple, set the stop. It now describes what actually happened.
3. **Duplicate React keys in the Community feed.** StrictMode invokes effects twice in
   development, so shared posts were prepended twice. Merge now dedupes by id.

### Verification

| Check | Result |
| --- | --- |
| `POST /api/chart-snap/analyze` | 200 across three profiles; risk scaled exactly ($100 / $50 / $100) |
| Real path | EUR/USD returned `real: true`, `EURUSD=X`, 63 bars, stop from *resistance at 1.1585 (5 touches)* |
| Fallback path | modelled candles labelled **MODELLED**, staleness comparison correctly suppressed |
| Filename detection | `XAUUSD-tradingview.png` auto-selected XAU/USD |
| Share to community | post persisted and rendered in the Community tab |
| All tabs | **20/20 unique, 0 console errors** |
| `lint` / `tsc` / `build` | clean · `/dashboard` 78 kB, first load **179 kB**, no new dependencies |

---

## Fix — Chart Snap was quoting a 2024 gold price (Sep 1, 2026)

**Reported:** Chart Snap showed XAU/USD entry **2,648.90** against a screenshot reading
**4,304.02** — a reference entry ~40% away from spot, in front of someone sizing a position.

### Root cause

Two faults compounding:

1. **Yahoo was returning 429.** Three routes (`market/live`, `patterns/live`,
   `chart-snap/analyze`) each fetched independently on every request, with Chart Snap on
   `no-store`. That volume tripped Yahoo's per-IP limit — confirmed on both the local IP
   and Vercel's edge IPs.
2. **The seeded fallback was a 2024-era number.** With the upstream down, gold fell back to
   `2648.90`, which was correct when the engine was written and had since drifted ~40%.
   The badge said MODELLED, but a wrong number with an honest label is still a wrong number.

### Fixes

- **Isolate-level cache with stale-if-error** in `fetchRealOHLC`. Fresh results are reused
  for 60s; beyond that a cached result is still served when the upstream fails, flagged
  `stale` with its age. A real price from minutes ago beats a modelled one from last year.
  This also cuts upstream calls sharply, which is what caused the 429s.
- **Anchor priority** in Chart Snap: live quote → **the price the reader typed off their own
  screenshot** → modelled. The screenshot number is real information the user supplied, so it
  outranks a synthetic series. Modelled candles are rescaled onto that anchor so the derived
  levels sit in the same price regime.
- **The plan is withheld entirely** when there is neither a live quote nor a screenshot
  price. `planAvailable: false` with the reason, instead of numbers built on an untrustworthy
  anchor.
- **Gold re-based** from 2,648.90 to 4,422.90 with proportional levels, so the last-resort
  fallback is at least in the right regime.

### Also checked

`exchangerate-api` carries fiat only — no XAU, XAG or BTC. Stooq now requires JavaScript
proof-of-work and cannot be called server-side. There is no viable second keyless source for
gold candles, which is why the work went into caching and anchoring rather than another feed.

### Verification

| Case | Result |
| --- | --- |
| Gold, screenshot price 4304.02, Yahoo 429 | entry **4304.02**, stop 4297.97, targets 4313.10 / 4322.17 — correct regime |
| Gold, no screenshot price, Yahoo 429 | **plan withheld** with reason, no invented entry |
| Staleness check | suppressed when there is no real quote to compare against |
| `lint` / `tsc` / `build` | clean · first load **180 kB** |

---

## Update — Keyed provider + intraday timeframes (Sep 1, 2026)

### Provider chain

`src/lib/marketProvider.ts` replaces direct Yahoo calls with an explicit chain:

**cache (60s fresh) → Twelve Data (keyed) → Yahoo (keyless) → cache (15m stale-if-error) → modelled**

Every result reports which rung produced it, so nothing downstream guesses whether a
number is real. Twelve Data sits ahead of Yahoo because it is keyed rather than
IP-throttled and covers `XAU/USD` and `XAG/USD` natively, where Yahoo only exposes gold
through the `GC=F` futures proxy.

**Entirely optional.** With no `TWELVE_DATA_API_KEY` configured, `hasTwelveDataKey()` is
false, the rung is skipped and Yahoo serves as before — verified running with no key, all
requests resolving `provider: Yahoo`.

Twelve Data also reports quota and key failures with **HTTP 200 and an error code in the
body**, so the client checks the payload rather than trusting the status line.

To enable: add `TWELVE_DATA_API_KEY` in Vercel → Settings → Environment Variables. Free
tier is 800 requests/day and 8/minute, comfortable behind the cache. See `.env.local.example`.

### Timeframes: 5M · 15M · 1H · 2H · 4H · D1

`src/lib/timeframes.ts` maps each to both providers.

**Yahoo has no 2H or 4H interval** — it tops out at 90m for intraday. Those are aggregated
from 60m bars: buckets aligned to the epoch, `open` from the first bar, `high`/`low` the
extremes, `close` from the last, volume summed. Aligning to the epoch rather than to the
first candle keeps the buckets identical no matter when the request runs. The response sets
`aggregated: true` and the UI says so.

**Confidence tiers by candle size.** A level needs **3 touches** on 5M/15M/1H/2H to support a
high-confidence pattern, **2** on 4H/D1 — short candles are noisy, and a two-touch level on a
5-minute chart is not the same evidence as one on a daily.

### Verification

| Timeframe | Provider | Bars | Aggregated | Stop distance |
| --- | --- | --- | --- | --- |
| 5M | Yahoo | 400 | no | 2 pips |
| 15M | Yahoo | 400 | no | 3 pips |
| 1H | Yahoo | 400 | no | 9 pips |
| 2H | Yahoo | 202 | **yes** | 14 pips |
| 4H | Yahoo | 105 | **yes** | 47 pips |
| D1 | Yahoo | 260 | no | 95 pips |

Stop distance scaling with candle size is the sanity check that the timeframe is genuinely
being applied rather than ignored.

| Check | Result |
| --- | --- |
| **Gold now real** | `Yahoo GC=F real · 400 15M bars` at **4,351.30** — the 2,648.90 regression is gone |
| Screenshot 4304.02 vs live 4351.30 | `STALE SCREENSHOT`, +1.099% |
| Screenshot 4350.00 vs live 4351.80 | `PRICE MATCHES LIVE`, +0.041% |
| Aggregation unit tests | **17/17** — bucket boundaries, OHLC roll-up, volume sum, epoch alignment, empty input |
| No API key configured | chain falls through to Yahoo cleanly, nothing breaks |
| `lint` / `tsc` / `build` | clean · first load **180 kB**, no new dependencies |

### Honest note on Twelve Data

The Twelve Data rung is **written and wired but not yet exercised against a real key** — the
public `demo` key returns a price for EUR/USD but 401s on XAU/USD, so the gold path could not
be proven end to end here. Parsing, UTC normalisation, error-in-200-body handling and the
skip-when-no-key path are all covered; what remains unverified is live behaviour under a
funded key. That will confirm itself the moment the env var is set — the badge will read
`Real · TwelveData` instead of `Real · Yahoo`.

---

## AI Tools — real GPT-4o-mini narration (2026-09-02)

The assistant now writes its replies with `gpt-4o-mini` when `OPENAI_API_KEY` is set, via
three Edge routes: `/api/ai/chat`, `/api/ai/summary`, `/api/ai/idea`.

### The model narrates; it never sources

Every figure the model is permitted to state is computed server-side in `lib/aiContext.ts`
from the same providers the charts use — `getRealCandles` (TwelveData → Yahoo → cache →
modelled), the pattern detector, the auto S/R clusterer and the session clock — then handed
over as a `CONTEXT` block with an explicit instruction to state nothing else. The `Sources:`
line under each reply is assembled in code, not written by the model, so provenance cannot be
embellished. This is why a hallucinated price is a prompt violation here rather than a
plausible completion.

Verified CONTEXT block (local, no Twelve Data key, so the Yahoo rung answered):

```
XAU/USD 4351.60 -2.82% — real via Yahoo (GC=F), 400 bars
  resistance: 4365.50 (1 touch), 4375.70 (3 touches), 4419.90 (5 touches)
  RSI(14) 31.2 (Neutral), trend up, ATR 16.98
EUR/USD 1.1581 -0.15% — real via Yahoo (EURUSD=X), 400 bars
BTC/USD 77598.58 -1.29% — real via Yahoo (BTC-USD), 400 bars
PATTERN RADAR: 5 live, 1 at high confidence.
```

### Privacy

The imported statement stays in `localStorage`. What crosses the network is assembled in one
place — `lib/journalAggregate.ts` — and is limited to the `JournalAggregate` shape: trade
count, win rate, net, best/worst hour, best/worst pair, best/worst session, hold-time averages,
a revenge-sizing flag, and a one-line summary of the most recent loss. No trade list, no entry
or exit prices, no account number, no broker, no file name. The panel says so in its own words
under the input, and the wording changes depending on whether a model is actually configured.

### Degrading without a key

With no key the routes return `available: false` **before doing any upstream work**, and the
client answers from the existing deterministic command engine, which reads the same real data
without a model. A bad or rate-limited key takes the same path: `callAI` returns null on 401,
429, timeout or a malformed body, and the reply is composed locally rather than erroring.

| Check | Result |
| --- | --- |
| `GET /api/ai/chat` with no key | `{"available":false,"model":null}` — no upstream calls made |
| `POST` chat / summary / idea, no key | `{"available":false,"provider":"Local"}`, client falls back |
| Invalid key | `callAI` → `null` → local composition, no error surfaced |
| Trade Idea timeframes | 5M · 15M · 1H · 2H · 4H · D1, matching Chart Snap |
| `lint` / `tsc` / `build` | clean · 7/7 static · `/dashboard` **181 kB**, no new dependencies |

### Two badges, because they mean different things

`REAL • OPENAI` / `LOCAL ENGINE` reports which engine wrote the reply. `JOURNAL n` / `SAMPLE n`
reports whether the book being discussed is the reader's own import or the built-in sample.
`SAMPLE 54` was never a statement about the market data — quotes and patterns were already
real — it means no statement has been imported yet.

### Verified live (2026-09-02)

| Check | Result |
| --- | --- |
| `GET /api/ai/chat` on production | `{"available":true,"model":"gpt-4o-mini"}` — the key was already set in Vercel |
| `/explain last loss` | quoted the exact aggregate sent, invented nothing |
| `/help` | lists the real command vocabulary |
| Probe: "what percent of traders are bullish on gold?" | *"The platform has no live positioning feed"* — refused to invent a figure |
| Probe: "what is silver at, and what did the Fed decide yesterday?" | *"unavailable in the provided context"* for both |
| Generate summary | session, FX, metals, crypto, radar, book — every figure traceable to the sources line |
| Generate idea, 6 timeframes × 4 pairs | all real; stop distance scales 2 → 15 pips on EUR/USD, 50 → 207 on gold |
| Tabs / console | 20 tabs reachable, **0 console errors** |

### Three defects found and fixed during verification

1. **`/help` answered with a market recap.** The route never put the command list
   in the model's context. `COMMANDS` moved to a runtime-neutral module both the
   client engine and the Edge route read, and `/help` now skips the quote fetches
   it never needed.
2. **Stop distance was off by an order of magnitude.** The route derived a pip size
   from the decimal count instead of using the `pipSize` each instrument already
   carries — EUR/USD ten times too small, gold ten times too large, BTC a hundred
   times. Only JPY crosses happened to land correctly. Chart Snap already used
   `pair.pipSize` and was unaffected.
3. **Worked examples could risk less than the spread.** A quiet Asian session put
   EUR/USD 15M ATR at 0.0002, producing a two-pip invalidation against a 0.6-pip
   spread. The stop now floors at twice the instrument's spread and the prompt
   says when the floor applied.

### Known limitation: gold can differ between two cards

Twelve Data's free tier allows 8 requests a minute. When a burst exceeds it, that
symbol falls through to Yahoo, which carries gold only as the `GC=F` futures
contract — about 40 points above spot. So a chat reply sourced from Twelve Data
(`XAU/USD 4319.79`) and a summary generated seconds later from Yahoo
(`GC=F 4359.80`) can disagree, each correctly labelled. Closing that gap means
preferring a recently-cached Twelve Data spot price over a live Yahoo futures one
for metals, which is a change to the provider chain rather than to these routes.

---

## GFXA AI brand mark (2026-09-02)

The generic `Sparkles` glyph is replaced by the AI mark — a ribboned "A" in
electric blue (`#3FE4FF → #0055F0`) with a four-point star in its counter, on an
optional navy plate.

### Drawn, not imported

The supplied artwork was a 1024px JPEG with the navy plate baked in. That plate
cannot sit on the app's own surfaces without carrying its own background, and the
raster turns muddy at the 17–24px the mark is actually used at — which is why the
brief reached for a `mix-blend` workaround. Rebuilt as geometry it is transparent
where it needs to be, crisp at every size, needs no PNG ladder, and costs about a
kilobyte. Gradients live in `<AiMarkDefs />`, mounted once in the root layout,
following the emblem's existing sprite pattern — per-instance `<defs>` need
generated ids, and generated ids trip React's hydration check.

### Where it appears, and in which state

| Surface | Treatment |
| --- | --- |
| Market Assistant card header | full colour, 19px, cyan drop-shadow, inside the existing green-bordered box |
| Dashboard AI Assistant widget | full colour, 17px, cyan drop-shadow |
| Sidebar, AI Tools row inactive | full colour — a blue accent among the monochrome glyphs |
| Sidebar, AI Tools row **active** | flat white silhouette (`mono`) — the blue gradient has almost no contrast on the filled brand-blue row |
| Mobile bottom bar, active | full colour with `drop-shadow-[0_0_6px_rgba(0,217,255,0.6)]` |
| Mobile bottom bar, inactive | `mono`, inheriting the muted tint of its four neighbours |

`drop-shadow` rather than `box-shadow`: the latter would draw a rectangular halo
around the icon's box instead of following its outline.

`TabIcon` is the single place the swap happens, so the sidebar and the mobile bar
cannot drift apart. `TABS` still declares `Sparkles` for the AI tab as the
fallback for any consumer reading the registry directly.

### Assets and a caveat

`public/icons/gfxa-ai.svg` (with plate) and `gfxa-ai-mark.svg` (transparent) are
exports for uses that cannot mount a React component. They mirror the geometry in
`AiMark.tsx` rather than sharing it — a `<img>` tag cannot produce the
`currentColor` variant the navs need — so a change to the mark has to be copied
across. No PNG ladder was generated: this machine has no `sharp`, `rsvg-convert`
or ImageMagick, and nothing in the app consumes a raster.

---

## /snap — command parser, pair choice and the Bakit explainer (2026-09-02)

`lib/commandParser.ts` is one parser behind `/snap`, `/screenshot` and `/pair`,
shared by the assistant and Chart Snap so the same instrument and candle size
read identically on both surfaces. It resolves `XAUUSD`, `xau/usd`, `gold`,
`cable`, `EUR USD` and bare `/snap`, falling back to the pair and timeframe
dropdowns for whatever the command omits. `/pair` never reaches the network — it
moves the dropdown client-side. 16/16 parser tests pass.

### What the read reports

`lib/structureRead.ts` classifies price against the levels it has actually
respected:

| State | Meaning |
| --- | --- |
| `BOUNCING_SUPPORT` | price traded into support and closed back above it |
| `APPROACHING_SUPPORT` | bullish context, but price has not tested the level yet |
| `REJECTING_RESISTANCE` | price traded into resistance and closed back below |
| `APPROACHING_RESISTANCE` | bearish context, level not yet tested |
| `MID_RANGE` | nothing within 1.2×ATR on either side — nothing to read |

Verified live across pairs and timeframes:

| Pair | TF | State | Bias | Conf | Level |
| --- | --- | --- | --- | --- | --- |
| XAU/USD | 1H | BOUNCING_SUPPORT | bullish | medium | 4326.76 |
| USD/JPY | 5M | REJECTING_RESISTANCE | bearish | **high** | 159.68, 8 touches |
| BTC/USD | D1 | APPROACHING_SUPPORT | bullish | medium | 76000 |
| EUR/USD | 15M | MID_RANGE | neutral | low | none |

### Why there is no BUY / SELL badge

The brief asked for `BUY` / `SELL` / `BUY_LIMIT` / `SELL_LIMIT`. Every input that
would need is present, and the retest-versus-bounce distinction the order types
encode is exactly what the states above carry. What is not shipped is the
instruction: a directive order type attached to a price and a position size,
tuned to one reader's own win-rate history, is personalised trading advice
whatever label sits next to it — and this platform's own promise, set in the
first brief, is "NOT signal-selling" and "I explain structure — I don't hand out
signals". The read describes the chart; the decision stays the reader's. The
explainer prompt forbids order language outright.

The risk geometry is unchanged from what Chart Snap already shipped: illustrative,
on the profile's example balance, never sized against a real account.

### Cautions are not a footnote

`cautions` is never shorter than `observations` — level break, stop-run
ambiguity, a pattern below high confidence, the calendar, and the reader's own
worst hour or weakest instrument when they apply. In the UI it is its own
**Bakit pwedeng mali** block, not a disclaimer line.

### Two defects found in verification

1. **Bias could contradict the state.** Taking `patterns[0]` blindly produced
   "Bouncing off support / bearish". The read now prefers the pattern that agrees
   with the level in play; when none does, bias goes neutral, confidence drops to
   low, and the disagreement itself becomes an observation.
2. **The model invented a unit.** Given a bare distance it wrote "7.16 pips" for
   7.16 points of gold — off by ten, since gold's pip is 0.1. Distances are now
   quoted with both the raw move and the pip count, and the prompt forbids
   relabelling points as pips.

Level prices are also rounded to instrument decimals; the cluster average was
reaching the UI as `4375.700032552083`.

---

## Chart Snap live mode — the chart is the analysis (2026-09-02)

Screenshot flow kept as a second tab; **Live chart** is now the default. In live
mode there is no upload, so there is no window for price to move between what the
reader saw and what the plan was priced against.

### Why the chart is ours, not TradingView's widget

The brief offered the TradingView Advanced Chart widget (`s3.tradingview.com/tv.js`)
as option A. It is not what shipped, because it would draw a **different feed**
from the one the analyzer prices against: TradingView's gold is a broker spot feed,
ours is Twelve Data spot or Yahoo's `GC=F` futures, and those sit ~40 points apart —
the exact discrepancy the gold work two turns ago existed to fix. A chart showing
4342.88 beside a plan anchored at 4305.75 recreates the confusion.

So the chart is the existing `TradingViewChart` (lightweight-charts) fed by
`GET /api/chart-snap/live`, the same provider chain the analyzer uses. Chart price
and plan anchor are the same number by construction. `lib/tradingViewEmbed.ts`
still maps symbols and intervals, used for an outbound **Cross-check on TradingView**
link so the reader can verify against a third party.

### Polling is 20s, not 1s

The brief asked for a one-second ticker. Twelve Data's free tier allows **eight
requests a minute** and the provider caches for sixty seconds, so a faster poll
returns identical numbers while burning the budget that keeps gold on the spot
feed — and a fallthrough to Yahoo swaps spot for futures. Twenty seconds is as
live as the data actually is.

### Drift is shown, not hidden

After a snap: *"Snap taken 17:03:32 Dubai at 4380.50. Live now 4380.60 — moved
+0.10 since."* The response carries a `drift` block comparing what the chart
displayed against what the plan anchored to.

### Auto-analyze on candle close

Opt-in, off by default, fired from a change in the newest bar's open time. It
refreshes the **computed** structure only — the written explainer stays on the
button, so leaving it on does not run up model usage in the background.

### Verified

| Check | Result |
| --- | --- |
| Live mode, 5M/15M/1H/4H/D1 | `anchor=live`, real candles, stop scaling 34.9p → 1147p |
| Drift reporting | chart 4380.50 vs anchor 4380.30 → `-0.20` |
| Screenshot mode | unchanged — 4304.02 vs 4380.30 → `STALE SCREENSHOT`, 1.772% |
| Bundle | **186 kB** first load (+2 kB) |

The chart is loaded with `next/dynamic`, matching Market Analysis. Importing it
statically first put lightweight-charts in the main bundle and pushed `/dashboard`
from 184 kB to 238 kB; code-split it costs 2 kB and loads only in live mode.

---

## Markdown was reaching the reader as literal asterisks (2026-09-02)

The Chart Snap explainer rendered the model's output with `whitespace-pre-line`,
so `**4335.04**` arrived on screen with the asterisks intact. The assistant chat
had its own small parser and was fine; Chart Snap never got one.

`components/ui/FormattedAI.tsx` is now the single renderer for both, and the
chat's private copy is deleted.

### No react-markdown

It would pull remark and mdast for roughly 40 kB gzipped to render four
constructs. The model only ever emits `**bold**`, backtick code, `- ` bullets and
rule lines; eighty lines handle those with no dependency. First load moved
**186 kB → 187 kB**.

### Two rules that make it readable rather than merely correct

- **Headings.** A line opening with a short bold phrase that ends in a full stop
  or colon is a section heading — `**Bakit ganito.** Ang structure ay…` — so it
  renders as one instead of as a bold run buried in the paragraph.
- **Pills only for figures.** Only bold spans containing a digit get the pill
  treatment. Pilling every bold span turns a paragraph into a ransom note;
  pilling `4335.04`, `54%` and `99.3 pips` makes the numbers findable at a glance
  while ordinary emphasis stays plain bold. Negative values — `-$68.80`, `-1.31%`
  — carry their sign in colour.

Numbers use the existing `num-mono` (tabular-nums) so columns of figures align,
and weight is 600 rather than 700. Inter was already the body font.

Two tones: `panel` for Chart Snap's surface, `terminal` for the assistant's
green-on-black, so neither surface had to be restyled to share the renderer.

Verified: five headings detected, fourteen figure pills, one plain-bold emphasis,
and no asterisk survives rendering.

---

## Partner deposit gating (2026-09-02)

`?ib=` attribution, a locked dashboard overlay for the three community brokers,
a submission flow and an admin review queue.

### No investor password is collected

The brief asked for the reader's MT4/MT5 investor password so MetaApi could read
a balance. That is not shipped. An investor password is a live credential to
someone else's brokerage account — it exposes balance, equity, open positions and
full trade history, most brokers' terms forbid sharing it, and one breach of this
store would expose every member's account.

It also buys nothing. No broker in the community exposes deposits through a
public partner API — Vantage's IB Access API has no balance or fund-movement
endpoint at all, and its `allocationData` records partner-portfolio assignments
rather than money; VT Markets and PU Prime deposits live in their client and IB
portals. An admin has to open the portal and look either way, so collecting a
credential would not remove the manual step.

The flow therefore takes the **account number and email** — enough to find the
person in the broker's portal — and the verify route **rejects any payload
carrying a `password` or `investorPassword` field** with an explanation, so no
client can quietly start sending one. The gate says the same thing to the reader,
which also inoculates members against anyone phishing them for a trading password
in the community's name.

The brief's MVP shortcut — "if account length >5 and investorPassword length >3
… return balance 150, deposit 100" — is not shipped either. That would store real
credentials in order to display a balance nobody measured.

### This is a conversion step, not access control

Worth stating plainly. The project has no accounts system, no session and no
middleware. The check clears from devtools, and every panel behind the gate reads
API routes that answer without it. It asks people who arrived through a partner
link to finish the step; it does not keep anyone out who does not want to be kept
out. Real gating needs authentication and the checks moved into the routes.

### The queue needs a real store

`getStore()` returns a KV-backed store when `KV_REST_API_URL` and
`KV_REST_API_TOKEN` are set — Vercel KV over its REST API, plain `fetch`, no
client library — and otherwise an in-memory fallback that **cannot back the
feature**: Next bundles every route handler separately, so the Map written by
`/api/ib/verify` is a different Map from the one `/api/ib/status` reads. That was
measured, not assumed — a submitted request came back `status: null` until the KV
path existed. The admin panel says so in a banner rather than letting anyone
assume the queue is safe.

### Verified

| Check | Result |
| --- | --- |
| Payload containing `investorPassword` | **400**, with the reason |
| Malformed email / short account | 400 |
| Six submissions from one email | `200 200 200 200 200 429` |
| `/api/ib/admin` with no / wrong token | **401** both |
| `/api/ib/admin` with the token | 200, `durable: false` surfaced |
| `?broker=VTMarkets&ib=TESTVT` | captured, broker preselected, link shows the code |
| Submit → pending state | renders, naming the broker and account |
| Admin panel | non-durable banner + empty queue |

The three IB routes run on Node rather than Edge — the store keeps module state,
and each Edge route is its own isolate.

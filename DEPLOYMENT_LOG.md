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

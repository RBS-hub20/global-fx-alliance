# GLOBAL FX ALLIANCE

**Live: <https://globalfxalliance.io>** &nbsp;·&nbsp; also at
<https://www.globalfxalliance.io> and <https://global-fx-alliance.vercel.app>

The Global Community for Forex Traders — marketing site + member dashboard.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · lucide-react ·
TradingView Lightweight Charts. Dark theme only.

**GFXA Terminal** — the Market Analysis tab is a Bloomberg-style workstation: a pro
candlestick chart that draws its own support, resistance, trendline and fair-value
gaps, and a four-agent analyst (technical · fundamental · flow · risk) that reads the
same numbers the chart is showing. All indicator maths is local and dependency-free;
live quotes come from free upstreams with a seeded fallback that never fails.

## Routes

| Route        | What it is                                                                                |
| ------------ | ----------------------------------------------------------------------------------------- |
| `/`          | Landing page — hero, pillars, global community map, member benefits, journey, ecosystem, CTA |
| `/dashboard` | Member dashboard — market pulse, EUR/USD intelligence, AI assistant, community, leaderboard |

## Getting started

```bash
npm install
npm run dev
```

Runs on <http://localhost:3210>.

```bash
npm run build && npm start
```

## Deploying to Vercel

Zero config — import the repo and Vercel detects Next.js. Both routes are statically
prerendered, so there is nothing to configure and no environment variables to set.

## Navigation map

Every navbar and footer destination is declared once in `src/lib/links.ts`, so the
navbar, the footer and the scroll-spy cannot drift apart. In-page targets are plain
`#anchor` links — no route change — and `section[id] { scroll-margin-top: 80px }` in
`globals.css` keeps headings clear of the sticky navbar.

| Navbar | Target | Active state watches |
| ------ | ------ | -------------------- |
| Community | `#global-community` | `global-community` |
| Academy | `#what-members-get` | `what-members-get` |
| Intelligence | `#market-intelligence-preview` | `market-intelligence-preview` |
| Events | `#ecosystem` | `ecosystem` |
| Chapters | `#global-community` + pill highlight | `chapters-preview` |

Community and Chapters both scroll to the world map, so Chapters additionally
dispatches `gfxa:highlight-chapters`, which briefly rings the chapter pills, and its
active state is keyed to the chapter grid immediately below.

Section order: `#why` → `#market-intelligence-preview` → `#global-community` →
`#chapters-preview` → `#what-members-get` → `#academy-preview` → `#pro-trader` →
`#ecosystem` → `#blog-preview`.

Footer: About → `#why`, Membership → `#pro-trader`, Chapters → `#chapters-preview`,
Events → `#ecosystem`, Resources → `#what-members-get`, Market Insights →
`#market-intelligence-preview`, Trading Tools → `/dashboard#economic-calendar`, AI →
`/dashboard#ai-assistant`, Blog → `#blog-preview`. Social links are external and open
in a new tab with `rel="noopener noreferrer"`.

CTAs carry a `?ref=` param so entry points are attributable: `hero`, `nav`, `login`,
`final-cta`, `intelligence`, `academy`, `chapter-<code>`, `blog`, `footer-tools`,
`footer-ai`.

The navbar's sticky background and its active-link state both run on
`IntersectionObserver` rather than a scroll listener — no per-frame work, and it keeps
reporting correctly in embedded webviews that throttle scroll events.

## Dashboard tabs

`/dashboard` is a single route driven by `?tab=`, so every panel is shareable and
back/forward work, but Next's client router swaps panels without a document
navigation. Tabs are declared once in `src/lib/tabs.ts`; the sidebar, the mobile bar
and the content switch (`src/components/dashboard/panels/index.tsx`) all read from it,
so a tab cannot exist without a panel.

| Group | Tabs |
| ----- | ---- |
| Main | Dashboard · Market Overview · Market Analysis · Market News · Watchlist |
| Community | Community · Discussions · Academy · Challenges · Global Chapters |
| Tools | Trading Calculator · Economic Calendar · Trading Journal · AI Tools |
| Account | My Profile · Membership · Settings |

Deep links: `?tab=<slug>`, plus `&pair=<symbol>` to preselect an instrument — a card
on Market Overview links straight to `?tab=market-analysis&pair=XAU/USD`.

### What actually works

- **Market Analysis** — pair pills and 1D/1W/1M/3M/1Y both regenerate the chart, the
  technicals, the levels and the fundamental panel from `src/lib/market.ts`.
- **Trading Calculator** — real arithmetic for position size, pip value, profit and
  margin, including the conversion when the quote currency is not the dollar.
  10,000 at 1% risk with a 25-pip stop on EUR/USD gives 0.40 lots.
- **Trading Journal** — add and delete trades; P/L, win rate, profit factor and the
  equity curve are all computed from the entries, not hardcoded.
- **AI Tools** — keyword routing over the app's own data (`src/lib/ai.ts`). No model
  and no network, but answers quote the live quotes, technicals and calendar, so they
  never contradict the rest of the dashboard. It declines to give signals.
- **Academy** — lesson completion drives per-track and overall progress.
- **Watchlist / Chapters / Challenges / Settings / Community likes** — all persist.

### Persistence

`usePersistentState` in `src/lib/storage.ts` backs the watchlist, journal, academy
progress, chat history, chapter joins, challenge entries, post likes and settings.
Everything is `localStorage`, wrapped in try/catch — storage throws in private mode
and when a browser blocks site data, so reads fall back to the default rather than
crashing a panel.

Two things the hook gets deliberately right: the first render always returns the
supplied default so server and client markup match, and the write-back effect is
gated on a `hydrated` **state** flag rather than a ref. A ref flipped inside the load
effect is already true when the write effect runs in the same commit, which would
write the default back over real saved data on every mount.

## Design system

Defined once in `tailwind.config.ts` and `src/app/globals.css`.

| Token             | Value                                                       |
| ----------------- | ----------------------------------------------------------- |
| Background        | `#070A12` → `#0A1931` gradient                              |
| Primary           | Electric Blue `#2A7FFF`                                     |
| Success           | Trading Green `#00D094`                                     |
| Danger            | `#FF4D4D`                                                   |
| Text              | `#E6EAF2` primary, `#8A93A8` secondary                      |
| Borders           | `rgba(255,255,255,0.08)`                                    |
| Glass (`.glass`)  | `rgba(16,22,38,0.8)` + 20px backdrop blur + hairline border |
| Glow (`shadow-glow`) | `0 0 40px rgba(42,127,255,0.15)`                         |
| Type              | Inter, tight tracking on headlines                          |

Icons are lucide-react; the UI carries no decorative emoji (country flags in the
community feed, chapter pills and leaderboard are content, not decoration).

## Notable implementation details

**`src/lib/geo.ts`** — the dotted world map used in the hero, the community split
and the market-pulse backdrop. Land is a union of simplified `[lon, lat]` polygons
(minus holes for Hudson Bay, the Caspian and the Baltic) rasterised into a dot grid
and emitted as a *single* SVG path, so the densest variant costs one DOM node rather
than a few thousand `<circle>`s. Also exports the chapter hubs and the arc generator
for the glowing connection lines.

**`src/components/brand/LogoMark.tsx`** — the emblem as vector. `/public/logo.png` is
the supplied master artwork (used for OG/social and as the Apple touch icon) but it
carries a baked-in dark backdrop, so on glass and at small sizes the app renders this
scalable mark instead. The globe's continents are the Americas projected
orthographically from the same `geo.ts` polygons. Gradients live in one
document-level `<LogoDefs />` sprite mounted in the root layout — per-instance ids
would desynchronise between server and client render and trip hydration.

**`src/components/ui/PriceChart.tsx`** — custom SVG area chart (Catmull-Rom smoothed,
horizontal grid only, hover crosshair and tooltip) rather than a chart library, so the
grid, ticks and crosshair match the design system exactly and ship no extra bytes.

**`src/lib/data.ts`** — all mock market data. Series are generated from a seeded PRNG
at module scope and detrended onto their quoted close, so server and client render
identical markup and prices land exactly on EUR/USD 1.1742, GBP/USD 1.3521,
USD/JPY 147.42, XAU/USD 2648.90.

## Content disclaimer

The platform publishes education, research and community commentary. Nothing in the
UI is financial advice, and the leaderboard ranks contribution and reputation — never
claimed profits. That framing is deliberate and is repeated in the footer, the AI
assistant and the sentiment panel.

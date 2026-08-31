# Deployment Log — GLOBAL FX ALLIANCE

## Live

| | |
| --- | --- |
| **Production URL** | <https://global-fx-alliance.vercel.app> |
| Team alias | <https://global-fx-alliance-rbs-hub-s-projects.vercel.app> |
| Immutable deployment | <https://global-fx-alliance-gsl2o9v0r-rbs-hub-s-projects.vercel.app> |
| Vercel project | `rbs-hub-s-projects/global-fx-alliance` |
| Deployment ID | `dpl_CNVDMRpwk7uBA1zuGvudreCEszbB` |
| Inspector | <https://vercel.com/rbs-hub-s-projects/global-fx-alliance/CNVDMRpwk7uBA1zuGvudreCEszbB> |
| Deployed | Aug 31, 2026 · 21:53 GST |
| Status | ● Ready · target `production` |
| GitHub repo | **Not connected yet** — see `DEPLOY_INSTRUCTIONS.md` |

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

1. **Connect GitHub** for automatic deploys on push — see `DEPLOY_INSTRUCTIONS.md`.
   Until then, deploys are manual via `npx vercel --prod --archive=tgz`.
2. **Custom domain** `globalfxalliance.com` — see `VERCEL_DEPLOY_GUIDE.md`.
3. **Analytics** — `npm i @vercel/analytics`, then mount `<Analytics />` in
   `src/app/layout.tsx`. Speed Insights is `@vercel/speed-insights`.
4. **Environment variables** — none required today. The app has no backend and no
   secrets; all market data is generated locally from a seeded PRNG.

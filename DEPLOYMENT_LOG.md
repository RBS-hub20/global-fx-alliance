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

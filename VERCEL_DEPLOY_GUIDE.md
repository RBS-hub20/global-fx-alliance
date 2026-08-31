# Vercel Guide — GLOBAL FX ALLIANCE

Live: <https://global-fx-alliance.vercel.app>
Project: `rbs-hub-s-projects/global-fx-alliance`

## Deploying

### From this folder (current setup)

```bash
npx vercel --prod --archive=tgz
```

Preview deploy (no `--prod`) gives a throwaway URL for testing:

```bash
npx vercel --archive=tgz
```

> **Keep `--archive=tgz`.** The default per-file upload failed twice with
> `fetch failed` on this connection. Uploading a single tarball worked immediately.

### From the Vercel dashboard (after connecting GitHub)

1. <https://vercel.com/new>
2. Import `USERNAME/global-fx-alliance`
3. Framework preset: **Next.js** (auto-detected)
4. Build command: `npm run build` · Install: `npm install`
5. Output directory: **leave as the Next.js default — do not set it**
6. Environment variables: none needed
7. **Deploy**

## Project settings that matter

`vercel.json` in this folder pins the framework and commands:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install"
}
```

`outputDirectory` is deliberately **omitted**. On a `framework: "nextjs"` project the
Next.js builder owns its own output layout, and pinning `.next` by hand is a common
cause of "No Output Directory named .next found" build failures. Leave it out.

`output: "export"` must stay **unset** in `next.config.mjs`. The dashboard reads
`?tab=` at runtime, and a static export would drop the server runtime the app is
built against.

## Custom domain — globalfxalliance.io ✅ live

Both hostnames are attached to the project and serving:

- <https://globalfxalliance.io>
- <https://www.globalfxalliance.io>

Registered at Namecheap, using Namecheap's nameservers with records pointed at Vercel
(rather than delegating NS to Vercel — both approaches are supported).

### Current DNS

| Type | Name | Value | Status |
| --- | --- | --- | --- |
| `A` | `@` | `76.76.21.21` | valid |
| `CNAME` | `www` | `cname.vercel-dns.com` | valid |

`vercel domains verify globalfxalliance.io` reports `ok: true`, `misconfigured: false`.

### Optional DNS upgrade

Vercel now prefers newer anycast targets and reports `dns_change_recommended`. This is
**optional** (`ipStatus: "optional-change"`) — the current records work. To adopt them,
change at Namecheap:

| Type | Name | From | To |
| --- | --- | --- | --- |
| `A` | `@` | `76.76.21.21` | `216.198.79.1` (and/or `64.29.17.1`) |
| `CNAME` | `www` | `cname.vercel-dns.com` | `595a25e9c8b719d9.vercel-dns-017.com.` |

Then re-check with `npx vercel domains verify globalfxalliance.io`.

### www does not redirect to apex

Both hostnames currently return `200` and serve the same content. `metadataBase` and
the Open Graph URL both point at the apex, so crawlers get a clear canonical — but if
you want `www` to 308-redirect to the apex, set it in
[Settings → Domains](https://vercel.com/rbs-hub-s-projects/global-fx-alliance/settings/domains):
open `www.globalfxalliance.io`, choose **Redirect to** `globalfxalliance.io`.

### TLS

Certificate issued automatically by Let's Encrypt for `CN=globalfxalliance.io`,
valid Aug 31 2026 → Nov 29 2026, and renewed by Vercel.

## Analytics

```bash
npm i @vercel/analytics @vercel/speed-insights
```

Then in `src/app/layout.tsx`, inside `<body>`:

```tsx
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
// …
<Analytics />
<SpeedInsights />
```

## Environment variables

None are required. The app has no backend and no secrets — market data is generated
locally from a seeded PRNG, and the AI assistant is keyword routing over that same
data, not an API call.

If you add any later:

```bash
npx vercel env add MY_VAR production
npx vercel env pull .env.local
```

`.env.local` and `.vercel/` are already gitignored. Note `.env.local` currently holds a
Vercel OIDC token created by `vercel link` — do not commit it.

## Rollback

Every deployment is immutable. To roll back, open the
[deployments list](https://vercel.com/rbs-hub-s-projects/global-fx-alliance/deployments),
pick a known-good build, and **Promote to Production** — or:

```bash
npx vercel rollback
```

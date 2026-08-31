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

## Custom domain — globalfxalliance.com

### 1. Add the domain in Vercel

1. <https://vercel.com/rbs-hub-s-projects/global-fx-alliance/settings/domains>
2. **Add** → `globalfxalliance.com` → Add
3. Add `www.globalfxalliance.com` too, and set one as the redirect target (the usual
   choice is apex as primary, `www` redirecting to it)

### 2. Point DNS at Vercel

At your registrar, either delegate the whole domain to Vercel's nameservers (simplest,
Vercel then manages every record), or add these records manually:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

Vercel shows the exact values for your domain on the Domains screen — use those if they
differ from the table above.

### 3. Wait for verification

Vercel issues the TLS certificate automatically once DNS resolves. Propagation is
usually minutes, occasionally up to 48 hours.

### 4. Update the canonical URL in the code

`src/app/layout.tsx` sets `metadataBase` and the Open Graph URL from a `SITE` constant
that already points at `https://globalfxalliance.com`. Once the domain is live, that
becomes correct on its own — but re-check it if you use a different hostname.

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

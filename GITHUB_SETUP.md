# GitHub Setup for Global FX Alliance

**Repo: <https://github.com/RBS-hub20/global-fx-alliance>** (public) ✅
**Live: <https://globalfxalliance.io>** · Vercel project: `rbs-hub-s-projects/global-fx-alliance`

All three steps below are **done**. Auto-deploy is active: every push to `main` builds
and promotes to production, and every pull request gets its own preview URL.

```bash
git push            # -> production deploy on globalfxalliance.io
```

The rest of this file is kept as the runbook for rebuilding the link, or for setting
the same thing up on another machine or project.

---

## Step 1 — Create the repo on GitHub ✅ done

1. Go to <https://github.com/new>
2. **Repository name:** `global-fx-alliance`
3. **Description:** `The Global Community for Forex Traders - Next.js 14 + 17 functional dashboard tabs`
4. **Public or Private** — your choice
5. **Do not** check *Initialize this repository with a README*, and leave `.gitignore`
   and licence set to *None*. The code already exists here, and any initial commit on
   GitHub will make the first push reject as a non-fast-forward.
6. Click **Create repository**
7. Copy the HTTPS URL: `https://github.com/YOUR_USERNAME/global-fx-alliance.git`

## Step 2 — Push this folder ✅ done

Run in this directory, replacing `YOUR_USERNAME`:

```bash
git remote add origin https://github.com/YOUR_USERNAME/global-fx-alliance.git
```

```bash
git branch -M main && git push -u origin main
```

If the push is rejected as non-fast-forward, the repo was created with an initial
commit. Either delete and recreate it empty, or run
`git pull --rebase origin main` first.

## Step 3 — Attach it to the **existing** Vercel project ✅ done

> **Important:** do *not* use <https://vercel.com/new> to import the repo. That creates
> a **second** Vercel project on a different URL, and `globalfxalliance.io` would stay
> attached to the current one. Connect the repo to the project that is already live.

Done from the CLI, which avoids the import trap entirely:

```bash
npx vercel git connect --yes
```

Or in the dashboard:

1. Open <https://vercel.com/rbs-hub-s-projects/global-fx-alliance/settings/git>
2. **Connect Git Repository** → select `RBS-hub20/global-fx-alliance`
3. Production branch: `main`

From then on every push to `main` deploys to production automatically, and every pull
request gets its own preview URL.

## Automated alternative

Because `gh` is authenticated here, steps 1 and 2 can be done in one command from this
folder. Pick the visibility explicitly:

```bash
gh repo create global-fx-alliance --public --source=. --remote=origin --push
```

```bash
gh repo create global-fx-alliance --private --source=. --remote=origin --push
```

Step 3 still has to be done in the Vercel dashboard.

## Deploying manually until Git is connected

```bash
npx vercel --prod --archive=tgz
```

Keep `--archive=tgz`. The default per-file upload failed twice with `fetch failed` on
this connection; uploading a single tarball worked first time.

## What is not in the repo

`.gitignore` covers `node_modules`, `.next`, `out`, `.env*`, `.vercel`, `.DS_Store`
and `next-env.d.ts`.

`.env.local` is **untracked on purpose** — `vercel link` wrote a `VERCEL_OIDC_TOKEN`
into it. Never commit that file. The app itself needs no environment variables: there
is no backend and no secrets, since market data is generated locally from a seeded
PRNG and the AI assistant is keyword routing over that same data.

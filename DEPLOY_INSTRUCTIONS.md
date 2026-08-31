# Connecting a GitHub repo

The site is **already live** — this is only needed to get automatic deploys on every
push. Right now the project deploys manually from this folder via the Vercel CLI.

The local git repo is initialised and committed on branch `main`, with no remote yet.

## 1. Create the repo

Go to <https://github.com/new> and create a repository named **`global-fx-alliance`**.
Leave it empty — no README, no `.gitignore`, no licence, or the first push will conflict.

## 2. Add the remote and push

From this folder, replacing `USERNAME` with your GitHub username:

```bash
git remote add origin https://github.com/USERNAME/global-fx-alliance.git
```

```bash
git branch -M main && git push -u origin main
```

## 3. Connect it to the existing Vercel project

Do **not** import it as a new project — that would create a second site at a different
URL. Attach it to the project that is already live:

1. Open <https://vercel.com/rbs-hub-s-projects/global-fx-alliance/settings/git>
2. **Connect Git Repository** → choose `USERNAME/global-fx-alliance`
3. Production branch: `main`

After that, every push to `main` deploys to production automatically, and every pull
request gets its own preview URL.

## Deploying manually in the meantime

```bash
npx vercel --prod --archive=tgz
```

`--archive=tgz` uploads one tarball instead of ~70 individual files. Without it the
per-file upload failed twice with `fetch failed` on this connection; the archive
upload worked first time. Keep the flag.

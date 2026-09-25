# Publishing: GitHub + Vercel (no database)

Meridian Tribunal deploys as a pure Next.js dApp. **No `DATABASE_URL` — or any
environment variable — is required.**

The on-chain configuration ships **twice, both committed to the repo**:

1. Defaults + `resolveAppConfig()` in `src/lib/config.ts` — the server layout
   reads **plain, non-public env variables** (no framework public prefix
   anywhere) and injects the resolved config through React context, so
   nothing is ever inlined into the browser bundle as env code.
2. `.env.production` (committed intentionally, public values only) — so any
   hosting platform that builds with Next.js env files picks the exact same
   configuration without dashboard setup.

The health endpoint also passes whether or not a database is configured.

> **"Contract not configured" on your live site?** That build predates the
> pinned address. Push the latest commit and redeploy — no dashboard env
> vars are needed at all. (Adding them is still fine; see below.)

---

## 1. Push to GitHub

```bash
# from the project root
git init
git add .
git commit -m "Meridian Tribunal: AI-rendered on-chain justice on GenLayer"

# either rename the default branch first, then create the repo…
git branch -M main

# ── Option A: with the GitHub CLI ────────────────────────────
gh repo create meridian-tribunal --public --source=. --remote=origin --push

# ── Option B: manual repo (create it on github.com first) ────
# git remote add origin git@github.com/<your-username>/meridian-tribunal.git
# git push -u origin main
```

> The committed `.gitignore` already excludes `node_modules`, `.next`, `.env`
> and every `*.local` secret file — while keeping `.env.example`. Double-check
> with `git status --ignored | head` before the first push.

Later updates:

```bash
git add .
git commit -m "Update docket UI"
git push
```

## 2. Deploy on Vercel

### Option A — import from GitHub (recommended)

1. Push the repo (above), then open <https://vercel.com/new>.
2. **Import** the repository.
3. Framework preset auto-detects **Next.js** — leave these defaults:

   | Setting | Value |
   | --- | --- |
   | Build command | `npm run build` |
   | Output directory | *(default — `.next`)* |
   | Install command | `npm install` |

4. **Environment variables: add nothing.** The build passes empty.
   (Only set variables if you want to *override* the bundled defaults.)
5. Deploy.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel          # preview deploy
vercel --prod   # production deploy
```

## 3. Optional environment overrides

Set these in **Vercel → Project → Settings → Environment Variables** only when
you redeploy the contract or change networks — otherwise skip this step.
Note: as a **server-resolved** variable, each one applies at build/render
time and never triggers Vercel's public-prefix warning.

| Variable | Purpose | Default (bundled) |
| --- | --- | --- |
| `CONTRACT_ADDRESS` | Contract the dApp reads/writes | `0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97` |
| `GENLAYER_RPC_URL` | RPC gateway | `https://studio.genlayer.com/api` |
| `GENLAYER_CHAIN_ID` | Wallet chain id | `61999` |
| `GENLAYER_CHAIN_NAME` | Network label | `Studionet` |
| `NATIVE_SYMBOL` | Token ticker | `GEN` |
| `EXPLORER_URL` | Explorer base URL | `https://explorer-studio.genlayer.com` |

After changing any of them: **Deployments → Redeploy**.

### Why no `NEXT_PUBLIC_` prefix anywhere

Earlier versions read `NEXT_PUBLIC_*` variables directly in the client, which
inlines values into the browser bundle and triggers Vercel's prefix warning.
The app now resolves configuration **exclusively on the server**
(`resolveAppConfig` in `src/lib/config.ts`) and passes it down the tree
through `<AppConfigProvider>`:

- The browser never downloads any env-sourced code — only the already
  resolved JSON config in the RSC payload.
- Dashboard variables stay clean (plain names, no warning dialogs), while
  still being public-by-nature values.
- A totally empty environment still yields the correct live configuration
  because of the built-in defaults.

## 4. Images / static assets

The hero avatars are **generated, not hand-placed binaries**:

- `scripts/generate-avatars.mjs` writes deterministic SVGs into
  `public/avatars/` plus a typed manifest at `src/lib/avatars.generated.ts`.
- The generator runs automatically via the `prebuild` npm script, so every
  Vercel build regenerates the artwork before `next build`. A missing or
  half-committed asset directory repairs itself.
- The frontend imports the manifest, so adding or removing an avatar in the
  generator updates the hero on the next build — no component edits.

```bash
npm run generate:avatars   # regenerate artwork + manifest
npm run verify:avatars     # CI check: fails if artifacts are stale
```

**If images 404 on a deployment**, the cause is almost always that the asset
files never reached the repository. Verify with:

```bash
git ls-files public/avatars      # must list the .svg files
git check-ignore -v public/avatars/juror-aegis.svg   # must print nothing
```

Because the assets are plain text SVG (~1.5 KB each instead of ~150 KB
bitmaps), they are immune to the usual binary/LFS/upload pitfalls — and the
`prebuild` hook regenerates them even if they are absent entirely.

## 5. Post-deploy verification

1. Open the Vercel URL — the footer should read *Live contract 0xc3f4…Cf97*
   and link to the explorer.
2. `GET <vercel-url>/api/health` → `{ "ok": true, "database": "not-configured" }`.
3. Connect MetaMask — the wallet is offered the GenLayer Studionet network
   (chain 61999) automatically.
4. File a sample dispute from `samples/cases.json` (or run
   `npx tsx deploy/seed.ts` locally) to see the docket populate on-chain.

## Notes

- `DATABASE_URL` is intentionally absent — `src/db` imports safely without
  it and `/api/health` responds `ok` in `not-configured` mode.
- Drizzle/`pg` packages remain in `package.json` for the platform starter
  compatibility; they are unused by the dApp and require no configuration.

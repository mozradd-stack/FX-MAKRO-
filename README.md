# FX Macro — Forex Interest Rate Intelligence Platform

A SaaS dashboard that tracks central bank interest rates, forward guidance and
the resulting bias/score across all 28 major currency pairs. Deploys to
**Vercel** (frontend + serverless API); the database is **Firestore**
(project `fx-makro-app`).

## Stack

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui-style components, Recharts, React Router, Firebase Analytics
- **Backend**: Express app, run as a Vercel serverless function in production and as a plain Node server locally
- **Database**: Firestore (accessed only through the Admin SDK from the backend — never directly from the client)

## Structure

- `server/` — backend source: `dev-server.js` (local dev entry, plain `app.listen`), `src/app.js` (Express routes), `src/firestore.js` (Admin SDK/collection refs), `src/scoring.js` (scoring/bias engine), `src/seed.js` (idempotent seed script)
- `api/index.js` — Vercel serverless entry point; just re-exports the same Express app from `server/src/app.js`
- `client/` — React app: pages in `src/pages`, reusable UI in `src/components/ui`, API client in `src/api/client.ts`, Firebase Analytics init in `src/firebase.ts`
- `vercel.json` — build/output config and the `/api/**` rewrite that routes all API calls to `api/index.js`

## Running locally

Local dev talks to a **Firestore emulator**, never the real project. Requires
Node.js 20+ and a JDK (the emulator runs on Java).

### Windows

1. Install [Node.js LTS](https://nodejs.org) (installer, just click through)
2. Install a JDK, e.g. [Temurin 21](https://adoptium.net/temurin/releases/?version=21) (installer, just click through)
3. Install [Git for Windows](https://git-scm.com/download/win) if you don't have `git` yet
4. In PowerShell:
   ```powershell
   git clone https://github.com/mozradd-stack/FX-MAKRO-.git
   cd FX-MAKRO-
   git checkout claude/google-docs-link-6sz4gi
   npm run install:all
   npm run dev:local:windows
   ```

This opens three PowerShell windows (Firestore emulator, API, frontend) and
your browser automatically once everything is ready. Close the three windows
to stop it. If PowerShell refuses to run the script at all, it's the default
script execution policy — the command above already passes
`-ExecutionPolicy Bypass` so this shouldn't happen, but if it does, run
PowerShell **as Administrator** once and use the same command.

### macOS / Linux

```bash
npm run install:all   # installs root + server + client dependencies
npm run dev:local     # starts the Firestore emulator, seeds it, then runs API + frontend
```

Then open **http://localhost:5173**. `Ctrl+C` stops everything.

### What it's doing

Both scripts (`scripts/dev-local.sh` / `scripts/dev-local.ps1`) sequence the
same four things: Firestore emulator (port 8080) → seed (idempotent — skips
if `central_banks` already has data; pass `--force` to `server/src/seed.js`
to overwrite) → API on port 4001 → Vite on port 5173, which proxies `/api` to
the API.

If you'd rather run each piece by hand (e.g. to see individual logs), the
underlying commands are:

```bash
npx firebase-tools emulators:start --only firestore --project fx-makro-app
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=fx-makro-app npm run seed --prefix server
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=fx-makro-app npm run dev --prefix server
npm run dev --prefix client
```

(on Windows PowerShell, set env vars per command as `$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"` instead)

## Deploying (Vercel)

1. On [vercel.com](https://vercel.com), **Add New → Project**, import this
   GitHub repo. Vercel reads `vercel.json` automatically — no extra config
   needed for the build itself.
2. In the new project's **Settings → Environment Variables**, add
   `FIREBASE_SERVICE_ACCOUNT` = the full JSON content of a service account
   key for the `fx-makro-app` GCP project (Cloud Console → IAM & Admin →
   Service Accounts → your account → Keys → Add key → JSON). This is how the
   serverless API authenticates to Firestore — there's no ambient GCP
   identity on Vercel the way there is on Firebase's own Cloud Functions.
3. Deploy. Every push to the connected branch redeploys automatically after
   that — no GitHub secret or Actions workflow needed on this side.
4. Seed the real Firestore project once (from your machine, with that same
   service account key):
   ```bash
   FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" npm run seed --prefix server
   ```
   (`npm run seed` is idempotent — safe to leave out of the deploy step; skips
   if `central_banks` already has data, pass `--force` to overwrite.)

## Pages

- `/` — Dashboard with hero stats and the full 28-pair table
- `/pairs` / `/pairs/:pair` — Pair index and per-pair Fib-Box + signal analysis
- `/central-banks` — 8 central bank cards with rate history
- `/calendar` — Upcoming meetings with live countdowns
- `/settings` — FRED API key (localStorage) + manual central bank data editing

## Next steps

FRED API live-data integration, Firebase Auth for user accounts, and Stripe
subscriptions were intentionally left out of this build and can be layered on
top.

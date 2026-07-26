# FX Macro — Forex Interest Rate Intelligence Platform

A SaaS dashboard that tracks central bank interest rates, forward guidance and
the resulting bias/score across all 28 major currency pairs. Runs entirely on
Firebase: Firestore, Cloud Functions and Hosting (project `fx-makro-app`).

## Stack

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui-style components, Recharts, React Router, Firebase Analytics
- **Backend**: Express app wrapped as a Firebase Cloud Function (`functions/`)
- **Database**: Firestore
- **Hosting**: Firebase Hosting, with `/api/**` rewritten to the Cloud Function

## Structure

- `functions/` — Cloud Functions source: `index.js` (production entry, `exports.api`), `dev-server.js` (local dev entry, plain `app.listen`), `src/app.js` (Express routes), `src/firestore.js` (Admin SDK/collection refs), `src/scoring.js` (scoring/bias engine), `src/seed.js` (idempotent seed script)
- `client/` — React app: pages in `src/pages`, reusable UI in `src/components/ui`, API client in `src/api/client.ts`, Firebase Analytics init in `src/firebase.ts`
- `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json` — Firebase project config (Firestore is locked down to deny all direct client access; every read/write goes through the Cloud Functions API using the Admin SDK)

## Running locally

Local dev talks to a **Firestore emulator**, never the real project. Requires
Node.js 20+ and a JDK (the emulator runs on Java) — Node from
[nodejs.org](https://nodejs.org), a JDK e.g. via `brew install openjdk` (macOS)
or `apt install default-jdk` (Linux).

```bash
npm run install:all   # installs root + functions + client dependencies
npm run dev:local     # starts the Firestore emulator, seeds it, then runs API + frontend
```

Then open **http://localhost:5173**. `Ctrl+C` stops everything. This is one
script (`scripts/dev-local.sh`) that sequences: Firestore emulator (port 8080)
→ seed (idempotent — skips if `central_banks` already has data; pass `--force`
to `functions/src/seed.js` to overwrite) → API on port 4001 → Vite on port
5173, which proxies `/api` to the API.

If you'd rather run each piece by hand (e.g. to see individual logs), the
three commands `scripts/dev-local.sh` wraps are:

```bash
npx firebase-tools emulators:start --only firestore --project fx-makro-app
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=fx-makro-app npm run seed --prefix functions
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=fx-makro-app npm run dev --prefix functions
npm run dev --prefix client
```

## Deploying

Deploys run via the `Deploy to Firebase` GitHub Actions workflow
(`.github/workflows/firebase-deploy.yml`) on every push to `main`, or manually
via the Actions tab (`workflow_dispatch`).

**Required repo secret**: `FIREBASE_SERVICE_ACCOUNT` — the full JSON key of a
service account on the `fx-makro-app` GCP project with the **Firebase Admin**
role (Cloud Console → IAM & Admin → Service Accounts → create key → paste the
JSON as the secret value). The workflow authenticates with it, builds the
client, and runs `firebase deploy --only hosting,functions`.

To deploy manually from your machine instead:

```bash
firebase login
npm run build            # builds client/dist
firebase deploy --only hosting,functions --project fx-makro-app
```

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

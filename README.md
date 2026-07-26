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

Local dev talks to a **Firestore emulator**, never the real project:

```bash
npm run install:all                                   # installs functions + client dependencies

# terminal 1 — Firestore emulator
npx firebase-tools emulators:start --only firestore --project fx-makro-app

# terminal 2 — seed once, then run the API against the emulator
cd functions
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=fx-makro-app npm run seed
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=fx-makro-app npm run dev   # http://localhost:4001

# terminal 3 — frontend
cd client
npm run dev   # http://localhost:5173, proxies /api to localhost:4001
```

`npm run seed` is idempotent — it skips seeding if `central_banks` already has
data (pass `--force` to overwrite).

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

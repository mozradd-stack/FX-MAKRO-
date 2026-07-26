# FX Macro — Forex Interest Rate Intelligence Platform

A SaaS dashboard that tracks central bank interest rates, forward guidance and
the resulting bias/score across all 28 major currency pairs.

## Stack

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui-style components, Recharts, React Router
- **Backend**: Node.js + Express
- **Database**: SQLite via `better-sqlite3`

## Getting started

```bash
npm run install:all   # installs server + client dependencies
npm run dev           # seeds the DB, then starts API (http://localhost:4000) + web app (http://localhost:5173)
```

The Vite dev server proxies `/api` to the Express backend, so the frontend
can just call relative `/api/...` paths.

## Structure

- `server/` — Express API, SQLite schema (`src/db.js`), seed data (`src/seed.js`), scoring/bias engine (`src/scoring.js`), routes (`src/routes.js`)
- `client/` — React app: pages in `src/pages`, reusable UI in `src/components/ui`, API client in `src/api/client.ts`

## Pages

- `/` — Dashboard with hero stats and the full 28-pair table
- `/pairs` / `/pairs/:pair` — Pair index and per-pair Fib-Box + signal analysis
- `/central-banks` — 8 central bank cards with rate history
- `/calendar` — Upcoming meetings with live countdowns
- `/settings` — FRED API key (localStorage) + manual central bank data editing

## Next steps

FRED API live-data integration, user accounts (e.g. Supabase), and Stripe
subscriptions were intentionally left out of this initial build and can be
layered on top.

# FX Macro — Forex Interest Rate Intelligence Platform

A SaaS dashboard that tracks central bank interest rates, forward guidance and
the resulting bias/score across all 28 major currency pairs — plus a live
economic news calendar and a pair correlation calculator. Deploys to
**Vercel**. No database, no Firebase, no API keys required to run it.

## Stack

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui-style components, Recharts, React Router
- **Backend**: a small stateless Express app — two read-only proxy routes to free public APIs, nothing else. Runs as a Vercel serverless function in production and as a plain Node server locally.
- **Data**: central bank rates/guidance ship as a researched static dataset bundled in the client (`client/src/data/centralBanks.ts`); all pair scores/bias are computed **client-side** from that data — there is no network round-trip for the core dashboard, which is what makes it robust. User edits (Settings page) are layered on top from `localStorage`.
- **Live data**: historical FX rates from [Frankfurter](https://frankfurter.dev) (free, no key) power the correlation calculator; the economic news calendar is proxied from the free [ForexFactory JSON feed](https://nfs.faireconomy.media/ff_calendar_thisweek.json).

## Why no database

The app previously went through SQLite → Firestore, but Firestore requires
either ambient GCP credentials (Cloud Functions only) or a service-account
secret wired into every hosting target, and that was the actual source of
"pairs don't load" in production. Central bank forward guidance is
inherently curated data anyway (no free API gives hawkish/dovish/next-meeting
across 8 central banks), so it now ships as a static, researched dataset with
all derived values (score, bias, differential) computed in the browser —
zero moving parts, zero failure mode tied to a database.

## Structure

- `server/src/app.js` — the entire backend: `/api/news-calendar` (ForexFactory proxy, 15 min cache) and `/api/fx-history` (Frankfurter proxy, 15 min cache). No routes for banks/pairs — those need no backend at all.
- `server/dev-server.js` — local dev entry (`app.listen`); `api/index.js` — Vercel serverless entry (same Express app, different wrapper)
- `client/src/data/centralBanks.ts` — the static default dataset (8 central banks, researched rates/meeting dates)
- `client/src/lib/scoring.ts` — scoring/bias engine + synthetic rate-history generator, pure functions, no I/O
- `client/src/lib/correlation.ts` — cross-rate derivation + Pearson correlation for the correlation calculator
- `client/src/hooks/useCentralBanks.ts` — merges the static dataset with any `localStorage` edits from Settings
- `client/src/hooks/usePairs.ts` — derives all 28 pair signals from the bank list via `useMemo`
- `client/` pages: Dashboard, Pairs, Pair Analysis, Central Banks, Calendar (derived from bank meeting dates), News (live ForexFactory feed), Correlation, Settings

## Running locally

No Java, no emulator, no API keys — just Node.

```bash
npm run install:all   # installs root + server + client dependencies
npm run dev           # runs the API (port 4001) and Vite (port 5173) together
```

Then open **http://localhost:5173**. `Ctrl+C` stops both.

## Deploying (Vercel)

1. On [vercel.com](https://vercel.com), **Add New → Project**, import this
   GitHub repo. Vercel reads `vercel.json` automatically.
2. Deploy — that's it, no environment variables needed. Every push to the
   connected branch redeploys automatically.

## Pages

- `/` — Dashboard with hero stats and the full 28-pair table
- `/pairs` / `/pairs/:pair` — Pair index and per-pair Fib-Box + signal analysis
- `/central-banks` — 8 central bank cards with rate history
- `/calendar` — Central bank meeting dates (derived from the bank dataset), with live countdowns
- `/news` — Live economic news calendar (ForexFactory feed)
- `/correlation` — Pick 2–8 pairs, get a Pearson correlation matrix + indexed price chart from real historical FX data
- `/settings` — FRED API key (localStorage, for future FRED integration) + manual central bank data editing (localStorage)

## Next steps

FRED API live-data integration, user accounts/auth, and Stripe subscriptions
were intentionally left out of this build and can be layered on top.

# FX Macro — Forex Interest Rate Intelligence Platform

A macro dashboard for interest-rate-driven FX analysis: differential/bias/score
across all 28 major currency pairs, a live FX terminal, a live economic news
calendar, and a correlation calculator across any Forex pair. Deploys to
**Vercel**. No database, no Firebase, no manual data entry, no API keys
required to run it.

## Stack

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui-style components, Recharts, React Router
- **Backend**: a small stateless Express app — three read-only proxy routes to free public APIs, nothing else. Runs as a Vercel serverless function in production and as a plain Node server locally.
- **Central bank data**: rates/guidance ship as a researched static dataset bundled in the client (`client/src/data/centralBanks.ts`). Every derived value (score, bias, divergence, trajectory) is computed **client-side** — no network round-trip, which is what makes the core dashboard robust.
- **Live data**: current + historical FX prices from [Frankfurter](https://frankfurter.dev) (free, no key) power the Terminal and the correlation calculator; the economic news calendar is proxied from the free [ForexFactory JSON feed](https://nfs.faireconomy.media/ff_calendar_thisweek.json).

## Why central bank rates aren't (all) live

There is no free, no-key API that covers policy rates + forward guidance
across all 8 central banks in one place — that's specifically what paid/keyed
services (FRED, EODHD, etc.) are for, and this build intentionally avoids
requiring any API key. Three banks *do* have a free official no-key API for
their policy rate specifically, and `/api/live-rates` fetches those live:

- **Bank of Canada** — [Valet API](https://www.bankofcanada.ca/valet-api-how-to/), series `CBC20210`
- **ECB** — [Data Portal SDW REST API](https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV), deposit facility rate
- **SNB** — [Data Portal cube API](https://data.snb.ch/api/cube/snboffzisa/data/json/en), official interest rate

Each fetch is fully isolated (`server/src/app.js`): if one bank's upstream
response shape doesn't match what's expected, that fetch fails safely to
`null` — the other two are unaffected, and the affected bank's card just
shows the researched value without a "Live" badge instead of breaking.
Fed/BoE/BoJ/RBA/RBNZ have no comparably clean free JSON API (only
old-style CSV downloads or scraping-shaped interfaces), so those five and
everything else (forward guidance, CPI, next meeting date) stay a researched
static snapshot (dated in `centralBanks.ts`). Everything else genuinely live
— FX spot/historical prices, the economic news feed — is live and
auto-refreshing.

## Why no database

Firestore requires either ambient GCP credentials (Cloud Functions only) or a
service-account secret wired into every hosting target — that mismatch was
the actual cause of "pairs don't load" in production. Since central bank data
is a static dataset anyway, every pair signal is now derived from it
client-side via `useMemo` — zero moving parts, zero database-shaped failure
mode. There's no manual data entry either: nothing to configure, nothing to
persist.

## The analysis rules

`client/src/lib/scoring.ts` implements interest-rate-differential analysis
per a specific rule set (see comments in the file for details):

1. Direction matters more than level — `rateTrajectory()` projects where a
   rate is heading (guidance + inflation trend), not just where it is.
2. The differential matters more than either absolute rate.
3. Inflation is the leading indicator — `inflationSignal()` flags when one
   country's CPI is rising while the other's is falling.
4. Forward guidance (hawkish/dovish/neutral) drives the trajectory signal.
5. *(Market-implied expectations / Fed Funds Futures are not included — no
   free no-key source for that exists; flagged rather than faked.)*
6. Divergence produces the strongest trends — `divergenceClass()` returns
   `STRONG DIVERGENCE` when two banks pull in opposite directions.
7. Both banks moving the same direction = no trend — this is scored as
   `ALIGNED` and scores **lower**, not higher (a deliberate inversion of a
   naive "guidance alignment" score).
8. Carry-trade unwind risk — `carryTradeRisk()` flags when a large
   differential (≥2%) is actively shrinking (the USD/JPY 2024 pattern).

The Pair Analysis page (`/pairs/:pair`) surfaces all of this directly — it's
rate-data only, no Fibonacci-style visualization.

## Structure

- `server/src/app.js` — the entire backend: `/api/news-calendar` (ForexFactory proxy, 15 min cache), `/api/fx-history` (Frankfurter historical proxy, 15 min cache), `/api/fx-latest` (Frankfurter current-rate proxy, 20s cache, powers the Terminal), `/api/live-rates` (BoC/ECB/SNB official policy rates, 10 min cache, each bank isolated)
- `server/dev-server.js` — local dev entry (`app.listen`); `api/index.js` — Vercel serverless entry (same Express app, different wrapper)
- `client/src/data/centralBanks.ts` — the static default dataset (8 central banks, researched rates/meeting dates/CPI trend)
- `client/src/lib/scoring.ts` — scoring/bias/trajectory/divergence engine, pure functions, no I/O
- `client/src/lib/correlation.ts` / `client/src/lib/fx.ts` — cross-rate derivation + Pearson correlation for the Terminal and correlation calculator
- `client/src/hooks/useCentralBanks.ts` — exposes the static bank list
- `client/src/hooks/usePairs.ts` — derives all 28 pair signals from the bank list via `useMemo`
- `client/` pages: Dashboard, Terminal (live), Pairs, Pair Analysis, Central Banks, Calendar (derived from bank meeting dates), News (live), Correlation (live)

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

**Worth checking after a deploy**: the dev sandbox this was built in has an
outbound network policy that blocks all the external APIs used here
(Frankfurter, ForexFactory, BoC/ECB/SNB), so none of the live routes could be
exercised against the real upstream during development — only their
error-handling paths were verified. Vercel has normal internet access, but
it's worth opening `/terminal`, `/news`, `/correlation`, and `/central-banks`
once after the first deploy to confirm the live badges/data actually show up
(BoC/ECB/SNB in particular — their fetchers were written from API docs +
search results without being able to test a real response).

## Pages

- `/` — Dashboard with hero stats and the full 28-pair table (differential, trend, divergence, bias, score)
- `/terminal` — Live FX price ticker for all 28 pairs (Frankfurter, auto-refreshes every 20s), with rate-bias context
- `/pairs` / `/pairs/:pair` — Pair index and per-pair rate-only fundamental analysis (trajectory, divergence, inflation signal, carry-trade risk, checklist)
- `/central-banks` — 8 central bank cards with rate history and CPI trend
- `/calendar` — Central bank meeting dates (derived from the bank dataset), with live countdowns
- `/news` — Live economic news calendar (ForexFactory feed)
- `/correlation` — Build a custom "setup" from any of ~27 tradable currencies, get a Pearson correlation matrix (click a cell for a plain-language verdict) + indexed price chart from real historical FX data

## Next steps

User accounts/auth and Stripe subscriptions were intentionally left out of
this build and can be layered on top.

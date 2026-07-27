const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const router = express.Router();

// ---- in-memory caches (per warm instance — good enough for these feeds,
// avoids hammering the free upstream APIs / hitting their rate limits) ----
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

async function cached(key, ttlMs, fetcher) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const data = await fetcher();
  cache.set(key, { at: Date.now(), data });
  return data;
}

// A default Node fetch UA gets blocked by some CDNs/WAFs in front of public
// JSON feeds; a normal browser UA avoids that.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
};

// ---- live news / economic calendar (ForexFactory public JSON feed) ----
// Rate-limited upstream (2 requests/5min) — cached here so many users hitting
// our API only triggers one upstream call per cache window.
router.get('/news-calendar', async (req, res) => {
  try {
    const events = await cached('news-calendar', CACHE_TTL_MS, async () => {
      const upstream = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { headers: BROWSER_HEADERS });
      if (!upstream.ok) throw new Error(`ForexFactory feed returned ${upstream.status}`);
      const raw = await upstream.json();
      return raw.map((e) => ({
        title: e.title ?? 'Unbekanntes Event',
        country: e.country ?? '',
        date: e.date ?? '',
        impact: e.impact ?? 'Low',
        forecast: e.forecast ?? '',
        previous: e.previous ?? '',
        actual: e.actual ?? '',
      }));
    });
    res.json(events);
  } catch (err) {
    res.status(502).json({ error: 'news-calendar upstream failed', detail: String(err.message || err) });
  }
});

// ---- live historical FX rates (Frankfurter — free, no key) ----
// Used by the correlation calculator to derive historical price series for
// any pair from a single base-currency fetch.
router.get('/fx-history', async (req, res) => {
  const base = String(req.query.base || 'USD').toUpperCase();
  const symbols = String(req.query.symbols || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const start = String(req.query.start || '');
  const end = String(req.query.end || '');

  if (!start || !end || symbols.length === 0) {
    return res.status(400).json({ error: 'start, end and symbols are required' });
  }

  const cacheKey = `fx-history:${base}:${symbols.join(',')}:${start}:${end}`;
  try {
    const data = await cached(cacheKey, CACHE_TTL_MS, async () => {
      const url = `https://api.frankfurter.dev/v1/${start}..${end}?base=${base}&symbols=${symbols.join(',')}`;
      const upstream = await fetch(url, { headers: BROWSER_HEADERS });
      if (!upstream.ok) throw new Error(`Frankfurter returned ${upstream.status}`);
      const raw = await upstream.json();
      return { base: raw.base, start: raw.start_date, end: raw.end_date, rates: raw.rates };
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'fx-history upstream failed', detail: String(err.message || err) });
  }
});

// ---- live current FX spot rates (Frankfurter — free, no key) ----
// Powers the live Terminal ticker. Short cache TTL so it actually feels live
// while still not hammering the upstream on every client poll.
const LATEST_CACHE_TTL_MS = 20 * 1000;
router.get('/fx-latest', async (req, res) => {
  const base = String(req.query.base || 'USD').toUpperCase();
  const symbols = String(req.query.symbols || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  try {
    const data = await cached(`fx-latest:${base}:${symbols.join(',')}`, LATEST_CACHE_TTL_MS, async () => {
      const url = `https://api.frankfurter.dev/v1/latest?base=${base}${symbols.length ? `&symbols=${symbols.join(',')}` : ''}`;
      const upstream = await fetch(url, { headers: BROWSER_HEADERS });
      if (!upstream.ok) throw new Error(`Frankfurter returned ${upstream.status}`);
      const raw = await upstream.json();
      return { base: raw.base, date: raw.date, rates: raw.rates };
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'fx-latest upstream failed', detail: String(err.message || err) });
  }
});

// ---- live official policy rates (Bank of Canada / ECB / SNB — all free,
// no key) ---- Fed/BoE/BoJ/RBA/RBNZ don't have a comparably clean free JSON
// API (only old CSV/scraping-style interfaces), so those stay on the
// researched dataset. Each fetcher is fully isolated: a bad response shape
// from one bank never breaks the others, it just returns null for that bank.
const LIVE_RATES_CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function asFiniteRate(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > -5 && n < 25 ? n : null;
}

// Bank of Canada Valet API — CBC20210 = Target for the Overnight Rate.
async function fetchBocRate() {
  const upstream = await fetchWithTimeout('https://www.bankofcanada.ca/valet/observations/CBC20210/json?recent=1');
  if (!upstream.ok) throw new Error(`BoC Valet returned ${upstream.status}`);
  const raw = await upstream.json();
  const obs = raw?.observations?.[raw.observations.length - 1];
  const rate = asFiniteRate(obs?.CBC20210?.v);
  if (rate === null) throw new Error('BoC Valet: unexpected response shape');
  return { rate, asOf: obs.d, source: 'Bank of Canada Valet API' };
}

// ECB Data Portal SDW REST API — deposit facility rate, SDMX-JSON.
async function fetchEcbRate() {
  const upstream = await fetchWithTimeout(
    'https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?format=jsondata&lastNObservations=1'
  );
  if (!upstream.ok) throw new Error(`ECB SDW returned ${upstream.status}`);
  const raw = await upstream.json();
  const series = Object.values(raw?.dataSets?.[0]?.series ?? {})[0];
  const observations = series?.observations ?? {};
  const lastIndex = Object.keys(observations).sort((a, b) => Number(a) - Number(b)).pop();
  const rate = asFiniteRate(observations?.[lastIndex]?.[0]);
  const dateValues = raw?.structure?.dimensions?.observation?.[0]?.values;
  const asOf = dateValues?.[Number(lastIndex)]?.id ?? dateValues?.[dateValues.length - 1]?.id;
  if (rate === null) throw new Error('ECB SDW: unexpected response shape');
  return { rate, asOf: asOf ?? null, source: 'ECB Data Portal (Deposit Facility Rate)' };
}

// SNB Data Portal cube API — official policy rate.
async function fetchSnbRate() {
  const upstream = await fetchWithTimeout('https://data.snb.ch/api/cube/snboffzisa/data/json/en');
  if (!upstream.ok) throw new Error(`SNB Data Portal returned ${upstream.status}`);
  const raw = await upstream.json();
  const timeseries = raw?.cube?.[0]?.timeseries ?? raw?.timeseries ?? [];
  const points = timeseries?.[0]?.values ?? [];
  const last = points?.[points.length - 1];
  const rate = asFiniteRate(last?.value ?? last?.val ?? last?.v);
  const asOf = last?.date ?? last?.d ?? null;
  if (rate === null) throw new Error('SNB Data Portal: unexpected response shape');
  return { rate, asOf, source: 'SNB Data Portal (Leitzins)' };
}

router.get('/live-rates', async (req, res) => {
  const data = await cached('live-rates', LIVE_RATES_CACHE_TTL_MS, async () => {
    const [boc, ecb, snb] = await Promise.all([
      fetchBocRate().catch(() => null),
      fetchEcbRate().catch(() => null),
      fetchSnbRate().catch(() => null),
    ]);
    return { boc, ecb, snb, fetchedAt: new Date().toISOString() };
  });
  res.json(data);
});

app.use('/api', router);
app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;

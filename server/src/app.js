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

app.use('/api', router);
app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;

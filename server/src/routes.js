import { Router } from 'express';
import { db } from './db.js';
import { buildPairs, calculateScore, getBias, trendDirection, combinedSignal } from './scoring.js';

export const router = Router();

function getBanksByCurrency() {
  const rows = db.prepare('SELECT * FROM central_banks').all();
  return Object.fromEntries(rows.map((r) => [r.currency, r]));
}

function recomputePairSignals() {
  const banksByCurrency = getBanksByCurrency();
  const upsert = db.prepare(`
    INSERT INTO pair_signals (pair, bias, score, differential, trend_direction, expected_change, notes, updated_at)
    VALUES (@pair, @bias, @score, @differential, @trend_direction, COALESCE((SELECT expected_change FROM pair_signals WHERE pair=@pair), ''), COALESCE((SELECT notes FROM pair_signals WHERE pair=@pair), ''), datetime('now'))
    ON CONFLICT(pair) DO UPDATE SET
      bias=excluded.bias, score=excluded.score, differential=excluded.differential, trend_direction=excluded.trend_direction, updated_at=datetime('now')
  `);
  const run = db.transaction(() => {
    for (const [a, b] of buildPairs()) {
      const bankA = banksByCurrency[a];
      const bankB = banksByCurrency[b];
      if (!bankA || !bankB) continue;
      const differential = Math.round((bankA.current_rate - bankB.current_rate) * 100) / 100;
      upsert.run({
        pair: `${a}/${b}`,
        bias: getBias(bankA, bankB),
        score: calculateScore(bankA, bankB),
        differential,
        trend_direction: trendDirection(bankA, bankB, differential),
      });
    }
  });
  run();
}

// ---- central banks ----
router.get('/central-banks', (req, res) => {
  res.json(db.prepare('SELECT * FROM central_banks ORDER BY currency').all());
});

router.get('/central-banks/:id', (req, res) => {
  const bank = db.prepare('SELECT * FROM central_banks WHERE id = ?').get(req.params.id);
  if (!bank) return res.status(404).json({ error: 'Not found' });
  res.json(bank);
});

router.put('/central-banks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM central_banks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fields = ['current_rate', 'last_change_date', 'last_change_amount', 'next_meeting', 'forward_guidance', 'cpi', 'unemployment', 'gdp_growth'];
  const updated = { ...existing };
  for (const f of fields) if (req.body[f] !== undefined) updated[f] = req.body[f];

  db.prepare(`
    UPDATE central_banks SET current_rate=@current_rate, last_change_date=@last_change_date, last_change_amount=@last_change_amount,
      next_meeting=@next_meeting, forward_guidance=@forward_guidance, cpi=@cpi, unemployment=@unemployment, gdp_growth=@gdp_growth, updated_at=datetime('now')
    WHERE id=@id
  `).run(updated);

  if (updated.current_rate !== existing.current_rate) {
    db.prepare(`INSERT INTO rate_history (currency, rate, effective_date, change_amount) VALUES (?, ?, date('now'), ?)`)
      .run(existing.currency, updated.current_rate, updated.current_rate - existing.current_rate);
  }

  recomputePairSignals();
  res.json(db.prepare('SELECT * FROM central_banks WHERE id = ?').get(req.params.id));
});

router.post('/central-banks/update-all', (req, res) => {
  const banks = req.body.banks || [];
  const run = db.transaction(() => {
    for (const b of banks) {
      const existing = db.prepare('SELECT * FROM central_banks WHERE id = ?').get(b.id);
      if (!existing) continue;
      db.prepare(`
        UPDATE central_banks SET current_rate=@current_rate, last_change_date=@last_change_date, last_change_amount=@last_change_amount,
          next_meeting=@next_meeting, forward_guidance=@forward_guidance, cpi=@cpi, unemployment=@unemployment, gdp_growth=@gdp_growth, updated_at=datetime('now')
        WHERE id=@id
      `).run({ ...existing, ...b });

      if (b.current_rate !== undefined && b.current_rate !== existing.current_rate) {
        db.prepare(`INSERT INTO rate_history (currency, rate, effective_date, change_amount) VALUES (?, ?, date('now'), ?)`)
          .run(existing.currency, b.current_rate, b.current_rate - existing.current_rate);
      }
    }
  });
  run();
  recomputePairSignals();
  res.json(db.prepare('SELECT * FROM central_banks ORDER BY currency').all());
});

// ---- rate history ----
router.get('/rate-history/:currency', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM rate_history WHERE currency = ? ORDER BY effective_date').all(req.params.currency.toUpperCase())
  );
});

// ---- pairs ----
router.get('/pairs', (req, res) => {
  res.json(db.prepare('SELECT * FROM pair_signals ORDER BY pair').all());
});

router.get('/pairs/:pair', (req, res) => {
  const pair = req.params.pair.toUpperCase().replace('-', '/');
  const signal = db.prepare('SELECT * FROM pair_signals WHERE pair = ?').get(pair);
  if (!signal) return res.status(404).json({ error: 'Not found' });

  const [a, b] = pair.split('/');
  const banksByCurrency = getBanksByCurrency();
  const bankA = banksByCurrency[a];
  const bankB = banksByCurrency[b];

  const historyA = db.prepare('SELECT * FROM rate_history WHERE currency = ? ORDER BY effective_date').all(a);
  const historyB = db.prepare('SELECT * FROM rate_history WHERE currency = ? ORDER BY effective_date').all(b);
  const differentialHistory = historyA.map((row, i) => ({
    date: row.effective_date,
    differential: Math.round((row.rate - (historyB[i]?.rate ?? row.rate)) * 100) / 100,
  }));

  res.json({
    signal,
    bankA,
    bankB,
    differentialHistory,
    combined: combinedSignal(bankA, bankB),
  });
});

router.put('/pairs/:pair', (req, res) => {
  const pair = req.params.pair.toUpperCase().replace('-', '/');
  const existing = db.prepare('SELECT * FROM pair_signals WHERE pair = ?').get(pair);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const expected_change = req.body.expected_change ?? existing.expected_change;
  const notes = req.body.notes ?? existing.notes;
  db.prepare(`UPDATE pair_signals SET expected_change=?, notes=?, updated_at=datetime('now') WHERE pair=?`).run(expected_change, notes, pair);
  res.json(db.prepare('SELECT * FROM pair_signals WHERE pair = ?').get(pair));
});

// ---- economic events ----
router.get('/economic-events', (req, res) => {
  res.json(db.prepare('SELECT * FROM economic_events ORDER BY date').all());
});

router.put('/economic-events/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM economic_events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const expected_decision = req.body.expected_decision ?? existing.expected_decision;
  db.prepare('UPDATE economic_events SET expected_decision = ? WHERE id = ?').run(expected_decision, req.params.id);
  res.json(db.prepare('SELECT * FROM economic_events WHERE id = ?').get(req.params.id));
});

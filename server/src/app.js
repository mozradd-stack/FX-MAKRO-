const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { db, centralBanksCol, pairSignalsCol, economicEventsCol, rateHistoryCol } = require('./firestore');
const { buildPairs, calculateScore, getBias, trendDirection, combinedSignal } = require('./scoring');

const app = express();
app.use(cors());
app.use(express.json());

const router = express.Router();

function pairDocId(a, b) {
  return `${a}-${b}`;
}

async function getBanksByCurrency() {
  const snap = await centralBanksCol.get();
  const byId = {};
  const byCurrency = {};
  snap.forEach((doc) => {
    const data = { id: doc.id, ...doc.data() };
    byId[doc.id] = data;
    byCurrency[data.currency] = data;
  });
  return { byId, byCurrency };
}

async function recomputePairSignals() {
  const { byCurrency } = await getBanksByCurrency();
  const batch = db.batch();

  for (const [a, b] of buildPairs()) {
    const bankA = byCurrency[a];
    const bankB = byCurrency[b];
    if (!bankA || !bankB) continue;
    const differential = Math.round((bankA.current_rate - bankB.current_rate) * 100) / 100;
    const ref = pairSignalsCol.doc(pairDocId(a, b));
    batch.set(
      ref,
      {
        pair: `${a}/${b}`,
        bias: getBias(bankA, bankB),
        score: calculateScore(bankA, bankB),
        differential,
        trend_direction: trendDirection(bankA, bankB, differential),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

// ---- central banks ----
router.get('/central-banks', async (req, res) => {
  const snap = await centralBanksCol.orderBy('currency').get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

router.get('/central-banks/:id', async (req, res) => {
  const doc = await centralBanksCol.doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  res.json({ id: doc.id, ...doc.data() });
});

const BANK_FIELDS = [
  'current_rate',
  'last_change_date',
  'last_change_amount',
  'next_meeting',
  'forward_guidance',
  'cpi',
  'unemployment',
  'gdp_growth',
];

router.put('/central-banks/:id', async (req, res) => {
  const ref = centralBanksCol.doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  const existing = doc.data();

  const patch = {};
  for (const f of BANK_FIELDS) if (req.body[f] !== undefined) patch[f] = req.body[f];
  patch.updated_at = admin.firestore.FieldValue.serverTimestamp();

  await ref.update(patch);

  if (patch.current_rate !== undefined && patch.current_rate !== existing.current_rate) {
    await rateHistoryCol(req.params.id).add({
      currency: existing.currency,
      rate: patch.current_rate,
      effective_date: new Date().toISOString().slice(0, 10),
      change_amount: patch.current_rate - existing.current_rate,
    });
  }

  await recomputePairSignals();
  const updated = await ref.get();
  res.json({ id: updated.id, ...updated.data() });
});

router.post('/central-banks/update-all', async (req, res) => {
  const banks = req.body.banks || [];
  const existingDocs = await Promise.all(banks.map((b) => centralBanksCol.doc(b.id).get()));

  const batch = db.batch();
  const historyEntries = [];

  banks.forEach((b, i) => {
    const doc = existingDocs[i];
    if (!doc.exists) return;
    const existing = doc.data();

    const patch = {};
    for (const f of BANK_FIELDS) if (b[f] !== undefined) patch[f] = b[f];
    patch.updated_at = admin.firestore.FieldValue.serverTimestamp();
    batch.update(doc.ref, patch);

    if (patch.current_rate !== undefined && patch.current_rate !== existing.current_rate) {
      historyEntries.push({
        bankId: b.id,
        currency: existing.currency,
        rate: patch.current_rate,
        effective_date: new Date().toISOString().slice(0, 10),
        change_amount: patch.current_rate - existing.current_rate,
      });
    }
  });

  await batch.commit();
  await Promise.all(
    historyEntries.map(({ bankId, ...entry }) => rateHistoryCol(bankId).add(entry))
  );

  await recomputePairSignals();
  const snap = await centralBanksCol.orderBy('currency').get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

// ---- rate history ----
router.get('/rate-history/:currency', async (req, res) => {
  const { byCurrency } = await getBanksByCurrency();
  const bank = byCurrency[req.params.currency.toUpperCase()];
  if (!bank) return res.json([]);
  const snap = await rateHistoryCol(bank.id).orderBy('effective_date').get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

// ---- pairs ----
router.get('/pairs', async (req, res) => {
  const snap = await pairSignalsCol.orderBy('pair').get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

router.get('/pairs/:pair', async (req, res) => {
  const pair = req.params.pair.toUpperCase().replace('-', '/');
  const [a, b] = pair.split('/');
  const signalDoc = await pairSignalsCol.doc(pairDocId(a, b)).get();
  if (!signalDoc.exists) return res.status(404).json({ error: 'Not found' });

  const { byCurrency } = await getBanksByCurrency();
  const bankA = byCurrency[a];
  const bankB = byCurrency[b];

  const [historyASnap, historyBSnap] = await Promise.all([
    rateHistoryCol(bankA.id).orderBy('effective_date').get(),
    rateHistoryCol(bankB.id).orderBy('effective_date').get(),
  ]);
  const historyA = historyASnap.docs.map((d) => d.data());
  const historyB = historyBSnap.docs.map((d) => d.data());
  const differentialHistory = historyA.map((row, i) => ({
    date: row.effective_date,
    differential: Math.round((row.rate - (historyB[i]?.rate ?? row.rate)) * 100) / 100,
  }));

  res.json({
    signal: { id: signalDoc.id, ...signalDoc.data() },
    bankA,
    bankB,
    differentialHistory,
    combined: combinedSignal(bankA, bankB),
  });
});

router.put('/pairs/:pair', async (req, res) => {
  const pair = req.params.pair.toUpperCase().replace('-', '/');
  const [a, b] = pair.split('/');
  const ref = pairSignalsCol.doc(pairDocId(a, b));
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });

  const patch = { updated_at: admin.firestore.FieldValue.serverTimestamp() };
  if (req.body.expected_change !== undefined) patch.expected_change = req.body.expected_change;
  if (req.body.notes !== undefined) patch.notes = req.body.notes;
  await ref.update(patch);

  const updated = await ref.get();
  res.json({ id: updated.id, ...updated.data() });
});

// ---- economic events ----
router.get('/economic-events', async (req, res) => {
  const snap = await economicEventsCol.orderBy('date').get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

router.put('/economic-events/:id', async (req, res) => {
  const ref = economicEventsCol.doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  const expected_decision = req.body.expected_decision ?? doc.data().expected_decision;
  await ref.update({ expected_decision });
  const updated = await ref.get();
  res.json({ id: updated.id, ...updated.data() });
});

app.use('/api', router);
app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;

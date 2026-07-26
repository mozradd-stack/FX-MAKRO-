const { db, centralBanksCol, pairSignalsCol, economicEventsCol, rateHistoryCol } = require('./firestore');
const { buildPairs, calculateScore, getBias, trendDirection } = require('./scoring');

const centralBanks = [
  { id: 'fed', name: 'Federal Reserve', country: 'United States', currency: 'USD', current_rate: 5.25, last_change_date: '2025-09-18', last_change_amount: -0.5, next_meeting: '2026-09-17', forward_guidance: 'dovish', cpi: 2.9, unemployment: 4.1, gdp_growth: 2.1 },
  { id: 'ecb', name: 'European Central Bank', country: 'Eurozone', currency: 'EUR', current_rate: 3.65, last_change_date: '2026-06-05', last_change_amount: -0.25, next_meeting: '2026-10-17', forward_guidance: 'neutral', cpi: 2.2, unemployment: 6.4, gdp_growth: 0.8 },
  { id: 'boe', name: 'Bank of England', country: 'United Kingdom', currency: 'GBP', current_rate: 5.0, last_change_date: '2026-05-08', last_change_amount: -0.25, next_meeting: '2026-08-07', forward_guidance: 'hawkish', cpi: 3.4, unemployment: 4.4, gdp_growth: 0.9 },
  { id: 'boj', name: 'Bank of Japan', country: 'Japan', currency: 'JPY', current_rate: 0.25, last_change_date: '2026-01-24', last_change_amount: 0.25, next_meeting: '2026-09-19', forward_guidance: 'hawkish', cpi: 2.8, unemployment: 2.5, gdp_growth: 1.0 },
  { id: 'snb', name: 'Swiss National Bank', country: 'Switzerland', currency: 'CHF', current_rate: 1.25, last_change_date: '2026-03-20', last_change_amount: -0.25, next_meeting: '2026-09-25', forward_guidance: 'dovish', cpi: 1.1, unemployment: 2.3, gdp_growth: 1.2 },
  { id: 'boc', name: 'Bank of Canada', country: 'Canada', currency: 'CAD', current_rate: 4.25, last_change_date: '2026-06-04', last_change_amount: -0.25, next_meeting: '2026-09-04', forward_guidance: 'dovish', cpi: 2.6, unemployment: 6.6, gdp_growth: 1.3 },
  { id: 'rba', name: 'Reserve Bank of Australia', country: 'Australia', currency: 'AUD', current_rate: 4.35, last_change_date: '2025-11-05', last_change_amount: 0, next_meeting: '2026-08-12', forward_guidance: 'neutral', cpi: 3.8, unemployment: 4.1, gdp_growth: 1.1 },
  { id: 'rbnz', name: 'Reserve Bank of New Zealand', country: 'New Zealand', currency: 'NZD', current_rate: 5.25, last_change_date: '2026-05-28', last_change_amount: -0.25, next_meeting: '2026-08-20', forward_guidance: 'dovish', cpi: 3.3, unemployment: 4.6, gdp_growth: 0.5 },
];

// 24 months of synthetic rate history per currency, derived from current_rate
// stepping backward with small deterministic moves so charts have shape.
function buildRateHistory(bank) {
  const rows = [];
  const months = 24;
  const today = new Date('2026-07-01');
  let rate = bank.current_rate;
  for (let i = 0; i < months; i++) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const effective_date = d.toISOString().slice(0, 10);
    rows.push({ rate: Math.round(rate * 100) / 100, effective_date, change_amount: i === 0 ? bank.last_change_amount : 0 });
    const seed = (bank.currency.charCodeAt(0) + i) % 5;
    if (seed === 0 && i > 0) rate += 0.25;
  }
  return rows.reverse();
}

const economicEvents = [
  { date: '2026-08-07', bank: 'Bank of England', expected_decision: 'Unverändert', importance: 'HIGH', affected_pairs: 'GBP/USD,EUR/GBP,GBP/JPY,GBP/AUD,GBP/CAD,GBP/CHF,GBP/NZD' },
  { date: '2026-08-12', bank: 'Reserve Bank of Australia', expected_decision: 'Unverändert', importance: 'MEDIUM', affected_pairs: 'AUD/USD,AUD/NZD,AUD/CAD,AUD/CHF,AUD/JPY,EUR/AUD,GBP/AUD' },
  { date: '2026-08-20', bank: 'Reserve Bank of New Zealand', expected_decision: '-0.25', importance: 'MEDIUM', affected_pairs: 'NZD/USD,NZD/CAD,NZD/CHF,NZD/JPY,EUR/NZD,GBP/NZD,AUD/NZD' },
  { date: '2026-09-04', bank: 'Bank of Canada', expected_decision: '-0.25', importance: 'MEDIUM', affected_pairs: 'USD/CAD,CAD/CHF,CAD/JPY,EUR/CAD,GBP/CAD,AUD/CAD,NZD/CAD' },
  { date: '2026-09-17', bank: 'Federal Reserve', expected_decision: '-0.25', importance: 'HIGH', affected_pairs: 'EUR/USD,GBP/USD,AUD/USD,NZD/USD,USD/CAD,USD/CHF,USD/JPY' },
  { date: '2026-09-19', bank: 'Bank of Japan', expected_decision: '+0.25', importance: 'HIGH', affected_pairs: 'USD/JPY,EUR/JPY,GBP/JPY,AUD/JPY,NZD/JPY,CAD/JPY,CHF/JPY' },
  { date: '2026-09-25', bank: 'Swiss National Bank', expected_decision: 'Unverändert', importance: 'MEDIUM', affected_pairs: 'USD/CHF,EUR/CHF,GBP/CHF,AUD/CHF,NZD/CHF,CAD/CHF,CHF/JPY' },
  { date: '2026-10-17', bank: 'European Central Bank', expected_decision: 'Unverändert', importance: 'HIGH', affected_pairs: 'EUR/USD,EUR/GBP,EUR/AUD,EUR/NZD,EUR/CAD,EUR/CHF,EUR/JPY' },
];

async function seed() {
  const existing = await centralBanksCol.limit(1).get();
  if (!existing.empty && !process.argv.includes('--force')) {
    console.log('central_banks already has data — skipping seed (pass --force to overwrite).');
    return;
  }

  const batch = db.batch();
  for (const bank of centralBanks) {
    const { id, ...data } = bank;
    batch.set(centralBanksCol.doc(id), { ...data, updated_at: new Date().toISOString() });
  }
  await batch.commit();

  for (const bank of centralBanks) {
    const historyBatch = db.batch();
    const existingHistory = await rateHistoryCol(bank.id).get();
    existingHistory.forEach((doc) => historyBatch.delete(doc.ref));
    for (const row of buildRateHistory(bank)) {
      historyBatch.set(rateHistoryCol(bank.id).doc(), { currency: bank.currency, ...row });
    }
    await historyBatch.commit();
  }

  const existingEvents = await economicEventsCol.get();
  const eventsBatch = db.batch();
  existingEvents.forEach((doc) => eventsBatch.delete(doc.ref));
  for (const ev of economicEvents) eventsBatch.set(economicEventsCol.doc(), ev);
  await eventsBatch.commit();

  const banksByCurrency = Object.fromEntries(centralBanks.map((b) => [b.currency, b]));
  const pairsBatch = db.batch();
  for (const [a, b] of buildPairs()) {
    const bankA = banksByCurrency[a];
    const bankB = banksByCurrency[b];
    const differential = Math.round((bankA.current_rate - bankB.current_rate) * 100) / 100;
    pairsBatch.set(pairSignalsCol.doc(`${a}-${b}`), {
      pair: `${a}/${b}`,
      bias: getBias(bankA, bankB),
      score: calculateScore(bankA, bankB),
      differential,
      trend_direction: trendDirection(bankA, bankB, differential),
      expected_change: '',
      notes: '',
      updated_at: new Date().toISOString(),
    });
  }
  await pairsBatch.commit();

  console.log(`Seeded ${centralBanks.length} central banks, ${buildPairs().length} pairs, ${economicEvents.length} events.`);
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

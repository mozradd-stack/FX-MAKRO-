// Currency hierarchy used to build the 28 canonical FX pairs (base/quote order
// follows standard market convention: EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY)
const CURRENCY_HIERARCHY = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'];

function buildPairs() {
  const pairs = [];
  for (let i = 0; i < CURRENCY_HIERARCHY.length; i++) {
    for (let j = i + 1; j < CURRENCY_HIERARCHY.length; j++) {
      pairs.push([CURRENCY_HIERARCHY[i], CURRENCY_HIERARCHY[j]]);
    }
  }
  return pairs; // 28 entries of [base, quote]
}

function guidanceValue(g) {
  if (g === 'hawkish') return 1;
  if (g === 'dovish') return -1;
  return 0;
}

function trendDirection(bankA, bankB, diff) {
  const trendDelta = bankA.last_change_amount - bankB.last_change_amount;
  if (trendDelta === 0) return 'stable';
  const widening = diff >= 0 ? trendDelta > 0 : trendDelta < 0;
  return widening ? 'growing' : 'shrinking';
}

function calculateScore(bankA, bankB) {
  const diff = Math.abs(bankA.current_rate - bankB.current_rate);
  let score = 0;

  // Zinsdifferenz Größe (0-4 Punkte)
  if (diff >= 3) score += 4;
  else if (diff >= 1.5) score += 3;
  else if (diff >= 0.5) score += 2;
  else score += 0;

  // Trend Richtung (0-3 Punkte)
  const trend = trendDirection(bankA, bankB, bankA.current_rate - bankB.current_rate);
  if (trend === 'growing') score += 3;
  else if (trend === 'stable') score += 1;
  else score += 0;

  // Forward Guidance Alignment (0-3 Punkte)
  if (bankA.forward_guidance === bankB.forward_guidance) score += 3;
  else if (bankA.forward_guidance === 'neutral' || bankB.forward_guidance === 'neutral') score += 1;
  else score += 0;

  return Math.min(score, 10);
}

function getBias(bankA, bankB) {
  const diff = bankA.current_rate - bankB.current_rate;
  const trendGrowing = bankA.last_change_amount > 0 && bankB.last_change_amount <= 0;
  const guidanceA = bankA.forward_guidance;

  if (diff > 0 && trendGrowing && guidanceA === 'hawkish') return 'STRONG BULLISH';
  if (diff > 0 && guidanceA !== 'dovish') return 'BULLISH';
  if (Math.abs(diff) < 0.5) return 'NEUTRAL';
  if (diff < 0 && guidanceA === 'dovish') return 'STRONG BEARISH';
  return 'BEARISH';
}

function technicalBias(diff) {
  if (Math.abs(diff) < 0.5) return 'NEUTRAL';
  return diff > 0 ? 'BULLISH' : 'BEARISH';
}

function fundamentalBias(bankA, bankB) {
  const guidanceDiff = guidanceValue(bankA.forward_guidance) - guidanceValue(bankB.forward_guidance);
  if (guidanceDiff >= 1) return 'BULLISH';
  if (guidanceDiff <= -1) return 'BEARISH';
  return 'NEUTRAL';
}

function combinedSignal(bankA, bankB) {
  const diff = bankA.current_rate - bankB.current_rate;
  const tech = technicalBias(diff);
  const fund = fundamentalBias(bankA, bankB);

  let signal = 'NEUTRAL';
  if (tech === 'BULLISH' && fund === 'BULLISH') signal = 'STRONG LONG';
  else if (tech === 'BULLISH' && fund !== 'BEARISH') signal = 'LONG';
  else if (fund === 'BULLISH' && tech !== 'BEARISH') signal = 'LONG';
  else if (tech === 'BEARISH' && fund === 'BEARISH') signal = 'STRONG SHORT';
  else if (tech === 'BEARISH' && fund !== 'BULLISH') signal = 'SHORT';
  else if (fund === 'BEARISH' && tech !== 'BULLISH') signal = 'SHORT';

  const pair = `${bankA.currency}/${bankB.currency}`;
  const diffAbs = Math.abs(diff).toFixed(2);
  const reasoning = `${pair} zeigt eine Zinsdifferenz von ${diffAbs}% zugunsten von ${diff >= 0 ? bankA.currency : bankB.currency}. ` +
    `${bankA.name} steht ${bankA.forward_guidance}, ${bankB.name} steht ${bankB.forward_guidance} — das ergibt ein fundamentales Signal von ${fund}. ` +
    `Technisch und fundamental zusammen ergibt sich ein ${signal.toLowerCase()}-Signal.`;

  return { technical: tech, fundamental: fund, signal, reasoning };
}

module.exports = {
  CURRENCY_HIERARCHY,
  buildPairs,
  trendDirection,
  calculateScore,
  getBias,
  technicalBias,
  fundamentalBias,
  combinedSignal,
};

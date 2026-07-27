import type { Bias, CentralBank, CombinedSignal, ForwardGuidance, TrendDirection } from '@/types';

// Currency hierarchy used to build the 28 canonical FX pairs (base/quote order
// follows standard market convention: EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY)
export const CURRENCY_HIERARCHY = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'];

export function buildPairs(): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < CURRENCY_HIERARCHY.length; i++) {
    for (let j = i + 1; j < CURRENCY_HIERARCHY.length; j++) {
      pairs.push([CURRENCY_HIERARCHY[i], CURRENCY_HIERARCHY[j]]);
    }
  }
  return pairs; // 28 entries of [base, quote]
}

function guidanceValue(g: ForwardGuidance) {
  if (g === 'hawkish') return 1;
  if (g === 'dovish') return -1;
  return 0;
}

export function trendDirection(bankA: CentralBank, bankB: CentralBank, diff: number): TrendDirection {
  const trendDelta = bankA.last_change_amount - bankB.last_change_amount;
  if (trendDelta === 0) return 'stable';
  const widening = diff >= 0 ? trendDelta > 0 : trendDelta < 0;
  return widening ? 'growing' : 'shrinking';
}

export function calculateScore(bankA: CentralBank, bankB: CentralBank): number {
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

export function getBias(bankA: CentralBank, bankB: CentralBank): Bias {
  const diff = bankA.current_rate - bankB.current_rate;
  const trendGrowing = bankA.last_change_amount > 0 && bankB.last_change_amount <= 0;
  const guidanceA = bankA.forward_guidance;

  if (diff > 0 && trendGrowing && guidanceA === 'hawkish') return 'STRONG BULLISH';
  if (diff > 0 && guidanceA !== 'dovish') return 'BULLISH';
  if (Math.abs(diff) < 0.5) return 'NEUTRAL';
  if (diff < 0 && guidanceA === 'dovish') return 'STRONG BEARISH';
  return 'BEARISH';
}

export function technicalBias(diff: number): 'BULLISH' | 'NEUTRAL' | 'BEARISH' {
  if (Math.abs(diff) < 0.5) return 'NEUTRAL';
  return diff > 0 ? 'BULLISH' : 'BEARISH';
}

export function fundamentalBias(bankA: CentralBank, bankB: CentralBank): 'BULLISH' | 'NEUTRAL' | 'BEARISH' {
  const guidanceDiff = guidanceValue(bankA.forward_guidance) - guidanceValue(bankB.forward_guidance);
  if (guidanceDiff >= 1) return 'BULLISH';
  if (guidanceDiff <= -1) return 'BEARISH';
  return 'NEUTRAL';
}

export function combinedSignal(bankA: CentralBank, bankB: CentralBank) {
  const diff = bankA.current_rate - bankB.current_rate;
  const tech = technicalBias(diff);
  const fund = fundamentalBias(bankA, bankB);

  let signal: CombinedSignal = 'NEUTRAL';
  if (tech === 'BULLISH' && fund === 'BULLISH') signal = 'STRONG LONG';
  else if (tech === 'BULLISH' && fund !== 'BEARISH') signal = 'LONG';
  else if (fund === 'BULLISH' && tech !== 'BEARISH') signal = 'LONG';
  else if (tech === 'BEARISH' && fund === 'BEARISH') signal = 'STRONG SHORT';
  else if (tech === 'BEARISH' && fund !== 'BULLISH') signal = 'SHORT';
  else if (fund === 'BEARISH' && tech !== 'BULLISH') signal = 'SHORT';

  const pair = `${bankA.currency}/${bankB.currency}`;
  const diffAbs = Math.abs(diff).toFixed(2);
  const reasoning =
    `${pair} zeigt eine Zinsdifferenz von ${diffAbs}% zugunsten von ${diff >= 0 ? bankA.currency : bankB.currency}. ` +
    `${bankA.name} steht ${bankA.forward_guidance}, ${bankB.name} steht ${bankB.forward_guidance} — das ergibt ein fundamentales Signal von ${fund}. ` +
    `Technisch und fundamental zusammen ergibt sich ein ${signal.toLowerCase()}-Signal.`;

  return { technical: tech, fundamental: fund, signal, reasoning };
}

// 24 months of synthetic-but-deterministic rate history per currency,
// derived from current_rate. There is no free live source for full policy
// rate history across 8 central banks, so this is an illustrative trend
// (anchored to the real current rate), not a live historical feed.
export function buildRateHistory(bank: CentralBank) {
  const rows: { effective_date: string; rate: number; change_amount: number }[] = [];
  const months = 24;
  const today = new Date();
  let rate = bank.current_rate;
  for (let i = 0; i < months; i++) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const effective_date = d.toISOString().slice(0, 10);
    rows.push({ effective_date, rate: Math.round(rate * 100) / 100, change_amount: i === 0 ? bank.last_change_amount : 0 });
    const seed = (bank.currency.charCodeAt(0) + i) % 5;
    if (seed === 0 && i > 0) rate += 0.25;
  }
  return rows.reverse();
}

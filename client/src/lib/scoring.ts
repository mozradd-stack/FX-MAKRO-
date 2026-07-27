import type { Bias, CentralBank, CombinedSignal, CpiTrend, Divergence, ForwardGuidance, TrendDirection } from '@/types';

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

// Rule: divergence (banks pulling in opposite directions) produces the
// strongest, longest FX trends. Both moving the same direction means the
// differential isn't going anywhere — no trend. This is the single source
// of truth for that classification; the score and the Pair Analysis page
// both read it instead of duplicating the logic.
export function divergenceClass(bankA: CentralBank, bankB: CentralBank): Divergence {
  const a = bankA.forward_guidance;
  const b = bankB.forward_guidance;
  if (a === b) return 'ALIGNED'; // includes both-neutral: no directional pull either way
  if (a === 'neutral' || b === 'neutral') return 'MIXED';
  return 'STRONG DIVERGENCE'; // one hawkish, one dovish
}

export function calculateScore(bankA: CentralBank, bankB: CentralBank): number {
  const diff = Math.abs(bankA.current_rate - bankB.current_rate);
  let score = 0;

  // Zinsdifferenz Größe (0-4 Punkte)
  if (diff >= 3) score += 4;
  else if (diff >= 1.5) score += 3;
  else if (diff >= 0.5) score += 2;
  else score += 0;

  // Trend Richtung (0-3 Punkte) — nicht das Niveau zählt, sondern wohin sich
  // die Differenz bewegt.
  const trend = trendDirection(bankA, bankB, bankA.current_rate - bankB.current_rate);
  if (trend === 'growing') score += 3;
  else if (trend === 'stable') score += 1;
  else score += 0;

  // Divergenz (0-3 Punkte) — Divergenz erzeugt die stärksten Trends;
  // laufen beide Zentralbanken in dieselbe Richtung, gibt es keinen
  // fundamentalen Edge.
  const divergence = divergenceClass(bankA, bankB);
  if (divergence === 'STRONG DIVERGENCE') score += 3;
  else if (divergence === 'MIXED') score += 2;
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

// Rule 1: not the current rate, but where it's heading over the next
// 6-12 months. We don't have live Fed Funds Futures / OIS market pricing
// (no free no-key source for that), so this is a transparent heuristic:
// forward guidance is the base direction, inflation trend either confirms
// it (leading indicator, rule 3) or flags that a pivot may be coming.
export interface Trajectory {
  label: string;
  direction: 'up' | 'down' | 'flat';
  confidence: 'confirmed' | 'watch' | 'neutral';
}

export function rateTrajectory(bank: CentralBank): Trajectory {
  const g = bank.forward_guidance;
  const t = bank.cpi_trend;

  if (g === 'hawkish') {
    if (t !== 'falling') return { label: 'Wahrscheinlich weitere Zinserhöhungen', direction: 'up', confidence: 'confirmed' };
    return { label: 'Hawkish, aber Inflation fällt — Guidance könnte sich bald abschwächen', direction: 'up', confidence: 'watch' };
  }
  if (g === 'dovish') {
    if (t !== 'rising') return { label: 'Wahrscheinlich weitere Zinssenkungen', direction: 'down', confidence: 'confirmed' };
    return { label: 'Dovish, aber Inflation steigt — Kurswechsel möglich', direction: 'down', confidence: 'watch' };
  }
  if (t === 'rising') return { label: 'Neutral, aber steigende Inflation könnte zu Hawkish-Wende führen', direction: 'flat', confidence: 'watch' };
  if (t === 'falling') return { label: 'Neutral, aber fallende Inflation könnte zu Dovish-Wende führen', direction: 'flat', confidence: 'watch' };
  return { label: 'Zins wahrscheinlich stabil', direction: 'flat', confidence: 'neutral' };
}

// Rule 3: inflation is the leading indicator — it moves first, the rate
// decision follows 3-6 months later.
export function inflationSignal(bankA: CentralBank, bankB: CentralBank): string {
  const a = bankA.cpi_trend;
  const b = bankB.cpi_trend;
  if (a === b) {
    return `Inflation in ${bankA.currency} und ${bankB.currency} bewegt sich ähnlich (${a}) — kein klares Differenzsignal aus der Inflation allein.`;
  }
  const risingCur = a === 'rising' ? bankA.currency : bankB.currency;
  const fallingCur = a === 'falling' ? bankA.currency : bankB.currency;
  if ((a === 'rising' && b === 'falling') || (a === 'falling' && b === 'rising')) {
    return `Inflation in ${risingCur} steigt, in ${fallingCur} fällt — ${risingCur} könnte in 3–6 Monaten die Zinsen erhöhen, ${fallingCur} könnte senken, bevor es in der Zinsentscheidung sichtbar wird.`;
  }
  return `Inflation in ${bankA.currency} (${a}) und ${bankB.currency} (${b}) läuft unterschiedlich — beobachten, ob sich eine der beiden Zentralbanken dadurch neu positioniert.`;
}

// Rule 8: when a large differential suddenly shrinks, carry trades unwind
// all at once — sharp, fast counter-moves even against a years-long trend
// (USD/JPY 2024 is the textbook example).
export function carryTradeRisk(differential: number, trend: TrendDirection): { atRisk: boolean; message: string } {
  const atRisk = Math.abs(differential) >= 2 && trend === 'shrinking';
  const message = atRisk
    ? `Große Zinsdifferenz (${Math.abs(differential).toFixed(2)}%) schrumpft gerade — klassisches Carry-Trade-Unwind-Setup. Kann selbst einen langjährigen Trend in wenigen Wochen umkehren (siehe USD/JPY 2024).`
    : 'Kein akutes Carry-Trade-Unwind-Risiko erkennbar.';
  return { atRisk, message };
}

export function guidanceLabel(g: ForwardGuidance): string {
  if (g === 'hawkish') return 'Hawkish';
  if (g === 'dovish') return 'Dovish';
  return 'Neutral';
}

export function cpiTrendLabel(t: CpiTrend): string {
  if (t === 'rising') return 'steigend';
  if (t === 'falling') return 'fallend';
  return 'stabil';
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

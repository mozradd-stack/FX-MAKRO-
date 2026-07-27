import type { FxHistoryResponse } from '@/types';

// Frankfurter gives rates vs. a single base (we always request base=USD).
// Any pair's price series is derivable from that one fetch: price(A/B) on a
// given day = rate[B] / rate[A], treating the base currency's own rate as 1.
export function derivePairSeries(history: FxHistoryResponse, base: string, pair: string) {
  const [a, b] = pair.split('/');
  const rateOf = (day: Record<string, number>, currency: string) => (currency === base ? 1 : day[currency]);

  const dates = Object.keys(history.rates).sort();
  return dates
    .map((date) => {
      const day = history.rates[date];
      const rateA = rateOf(day, a);
      const rateB = rateOf(day, b);
      if (rateA === undefined || rateB === undefined) return null;
      return { date, price: rateB / rateA };
    })
    .filter((row): row is { date: string; price: number } => row !== null);
}

export function logReturns(series: { date: string; price: number }[]) {
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    returns.push(Math.log(series[i].price / series[i - 1].price));
  }
  return returns;
}

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX === 0 || varY === 0) return 0;
  return cov / Math.sqrt(varX * varY);
}

export function correlationMatrix(returnsByPair: Record<string, number[]>): Record<string, Record<string, number>> {
  const pairs = Object.keys(returnsByPair);
  const matrix: Record<string, Record<string, number>> = {};
  for (const p1 of pairs) {
    matrix[p1] = {};
    for (const p2 of pairs) {
      matrix[p1][p2] = p1 === p2 ? 1 : pearsonCorrelation(returnsByPair[p1], returnsByPair[p2]);
    }
  }
  return matrix;
}

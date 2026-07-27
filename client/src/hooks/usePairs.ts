import { useMemo } from 'react';
import type { CentralBank, PairSignal } from '@/types';
import { buildPairs, calculateScore, getBias, trendDirection } from '@/lib/scoring';

// Fully automatic — no manual notes/expected-change input anymore, every
// value here is derived purely from the central bank dataset.
export function usePairs(banks: CentralBank[]) {
  const banksByCurrency = useMemo(() => Object.fromEntries(banks.map((b) => [b.currency, b])), [banks]);

  const pairs = useMemo<PairSignal[]>(() => {
    return buildPairs()
      .map(([a, b]) => {
        const bankA = banksByCurrency[a];
        const bankB = banksByCurrency[b];
        if (!bankA || !bankB) return null;
        const pair = `${a}/${b}`;
        const differential = Math.round((bankA.current_rate - bankB.current_rate) * 100) / 100;
        return {
          pair,
          bias: getBias(bankA, bankB),
          score: calculateScore(bankA, bankB),
          differential,
          trend_direction: trendDirection(bankA, bankB, differential),
        } satisfies PairSignal;
      })
      .filter((p): p is PairSignal => p !== null);
  }, [banksByCurrency]);

  return { pairs };
}

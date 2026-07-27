import { useCallback, useMemo, useState } from 'react';
import type { CentralBank, PairSignal } from '@/types';
import { buildPairs, calculateScore, getBias, trendDirection } from '@/lib/scoring';

const NOTES_KEY = 'fxmacro:pair-notes';

type PairNotes = Record<string, { expected_change?: string; notes?: string }>;

function loadNotes(): PairNotes {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveNotes(notes: PairNotes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export function usePairs(banks: CentralBank[]) {
  const [notes, setNotes] = useState<PairNotes>(() => loadNotes());

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
          expected_change: notes[pair]?.expected_change ?? '',
          notes: notes[pair]?.notes ?? '',
        } satisfies PairSignal;
      })
      .filter((p): p is PairSignal => p !== null);
  }, [banksByCurrency, notes]);

  const updatePairNotes = useCallback((pair: string, patch: { expected_change?: string; notes?: string }) => {
    setNotes((prev) => {
      const next = { ...prev, [pair]: { ...prev[pair], ...patch } };
      saveNotes(next);
      return next;
    });
  }, []);

  return { pairs, updatePairNotes };
}

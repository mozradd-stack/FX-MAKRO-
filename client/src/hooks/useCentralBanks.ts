import { useCallback, useMemo, useState } from 'react';
import type { CentralBank } from '@/types';
import { DEFAULT_CENTRAL_BANKS } from '@/data/centralBanks';

const OVERRIDES_KEY = 'fxmacro:bank-overrides';

type Overrides = Record<string, Partial<CentralBank>>;

function loadOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Overrides) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

// No backend/database: central bank data ships as a static, researched
// dataset (src/data/centralBanks.ts) and any manual edits from the Settings
// page are layered on top from localStorage. This is the actual fix for
// pairs "not loading" — there is no network call in this chain at all.
export function useCentralBanks() {
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides());

  const banks = useMemo<CentralBank[]>(
    () => DEFAULT_CENTRAL_BANKS.map((bank) => ({ ...bank, ...overrides[bank.id] })),
    [overrides]
  );

  const updateBank = useCallback((id: string, patch: Partial<CentralBank>) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch, updated_at: new Date().toISOString() } };
      saveOverrides(next);
      return next;
    });
  }, []);

  const updateAll = useCallback((patches: (Partial<CentralBank> & { id: string })[]) => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const { id, ...patch } of patches) {
        next[id] = { ...next[id], ...patch, updated_at: new Date().toISOString() };
      }
      saveOverrides(next);
      return next;
    });
  }, []);

  const resetBank = useCallback((id: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      saveOverrides(next);
      return next;
    });
  }, []);

  return { banks, updateBank, updateAll, resetBank };
}

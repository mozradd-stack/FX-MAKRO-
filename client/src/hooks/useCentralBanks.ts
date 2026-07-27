import { DEFAULT_CENTRAL_BANKS } from '@/data/centralBanks';

// No manual data entry — central bank rates/guidance are a researched static
// dataset (src/data/centralBanks.ts). Live FX prices (Terminal, Correlation)
// come from the free Frankfurter API instead; there is no free no-key API
// that covers policy rates + forward guidance across all 8 central banks.
export function useCentralBanks() {
  return { banks: DEFAULT_CENTRAL_BANKS };
}

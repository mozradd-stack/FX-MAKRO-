import { useEffect, useState } from 'react';
import { fetchAiRates } from '@/api/client';
import type { AiRatesResponse } from '@/types';

// The server caches this for 7 days, so polling every 5 minutes like
// useLiveRates would just hit cache — an hourly poll is plenty to pick up
// a refreshed result soon after it lands.
const REFRESH_MS = 60 * 60 * 1000;

// AI-researched overlay for the 5 banks with no free official API (Fed, BoE,
// BoJ, RBA, RBNZ). Returns null while loading or if the request failed —
// individual banks inside the response, or the whole feature (`enabled:
// false` when no ANTHROPIC_API_KEY is configured), can also be null/off.
export function useAiRates() {
  const [aiRates, setAiRates] = useState<AiRatesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchAiRates()
        .then((data) => {
          if (!cancelled) setAiRates(data);
        })
        .catch(() => {
          // best-effort — the page still works fully on the researched dataset
        });
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return aiRates;
}

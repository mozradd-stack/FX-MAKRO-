import { useEffect, useState } from 'react';
import { fetchLiveRates } from '@/api/client';
import type { LiveRatesResponse } from '@/types';

const REFRESH_MS = 5 * 60 * 1000;

// Live policy-rate overlay for the 3 banks with a free no-key official API
// (Bank of Canada, ECB, SNB). Returns null while loading or if the whole
// request failed — individual banks inside the response can also be null.
export function useLiveRates() {
  const [liveRates, setLiveRates] = useState<LiveRatesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchLiveRates()
        .then((data) => {
          if (!cancelled) setLiveRates(data);
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

  return liveRates;
}

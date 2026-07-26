import { useEffect, useState } from 'react';

const FRED_KEY = 'fxmacro:fred-api-key';
const WATCHLIST_KEY = 'fxmacro:watchlist';
const DEFAULT_WATCHLIST = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];

export function useFredApiKey() {
  const [key, setKey] = useState(() => localStorage.getItem(FRED_KEY) ?? '');
  useEffect(() => {
    if (key) localStorage.setItem(FRED_KEY, key);
    else localStorage.removeItem(FRED_KEY);
  }, [key]);
  return [key, setKey] as const;
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_WATCHLIST;
  });
  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);
  return [watchlist, setWatchlist] as const;
}

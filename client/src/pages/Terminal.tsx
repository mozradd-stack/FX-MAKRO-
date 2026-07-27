import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFxLatest } from '@/api/client';
import { useCentralBanks } from '@/hooks/useCentralBanks';
import { usePairs } from '@/hooks/usePairs';
import { buildPairs, CURRENCY_HIERARCHY } from '@/lib/scoring';
import { crossPrice } from '@/lib/fx';
import { BiasBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const REFRESH_MS = 20000;
const BASE = 'USD';
const SYMBOLS = CURRENCY_HIERARCHY.filter((c) => c !== BASE);
const ALL_PAIRS = buildPairs().map(([a, b]) => `${a}/${b}`);

type Tick = 'up' | 'down' | 'flat';

export function Terminal() {
  const { banks } = useCentralBanks();
  const { pairs } = usePairs(banks);
  const biasByPair = Object.fromEntries(pairs.map((p) => [p.pair, p]));

  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [secondsToRefresh, setSecondsToRefresh] = useState(REFRESH_MS / 1000);
  const [error, setError] = useState<string | null>(null);
  const prevPrices = useRef<Record<string, number>>({});

  const refresh = useCallback(async () => {
    try {
      const latest = await fetchFxLatest({ base: BASE, symbols: SYMBOLS });
      const rates = { ...latest.rates, [BASE]: 1 };

      const nextPrices: Record<string, number> = {};
      const nextTicks: Record<string, Tick> = {};
      for (const pair of ALL_PAIRS) {
        const [a, b] = pair.split('/');
        const price = crossPrice(rates, BASE, a, b);
        if (price === null) continue;
        nextPrices[pair] = price;
        const prev = prevPrices.current[pair];
        if (prev !== undefined) {
          nextTicks[pair] = price > prev ? 'up' : price < prev ? 'down' : 'flat';
        }
      }
      prevPrices.current = nextPrices;
      setPrices(nextPrices);
      setTicks(nextTicks);
      setLastUpdate(new Date());
      setError(null);
      setSecondsToRefresh(REFRESH_MS / 1000);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail;
      setError(detail || (err as Error).message || 'Live-Kurse konnten nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const tick = setInterval(() => setSecondsToRefresh((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Terminal</h1>
          <p className="text-sm text-muted">Live-Kurse aller 28 Pairs (Frankfurter API) — aktualisiert automatisch alle {REFRESH_MS / 1000}s.</p>
        </div>
        <div className="text-right text-xs text-muted">
          {lastUpdate && <div>Stand: {lastUpdate.toLocaleTimeString('de-DE')}</div>}
          <div className="font-mono">Nächstes Update in {secondsToRefresh}s</div>
        </div>
      </div>

      {error && (
        <Card className="border-danger/50 p-4 text-sm text-danger">
          Live-Kurse konnten nicht geladen werden ({error}). Zeigt ggf. veraltete Werte, bis der nächste Refresh klappt.
        </Card>
      )}

      {!prices && !error && <div className="py-12 text-center text-muted">Lade Live-Kurse…</div>}

      {prices && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="p-3">Pair</th>
                <th className="p-3 font-mono">Live Preis</th>
                <th className="p-3">Tick</th>
                <th className="p-3">Zins-Bias</th>
                <th className="p-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {ALL_PAIRS.map((pair) => {
                const price = prices[pair];
                const tick = ticks[pair] ?? 'flat';
                const signal = biasByPair[pair];
                return (
                  <tr key={pair} className="border-b border-border last:border-0 hover:bg-white/[0.02]">
                    <td className="p-3 font-semibold">{pair}</td>
                    <td
                      className={cn(
                        'p-3 font-mono tabular-nums transition-colors duration-500',
                        tick === 'up' && 'text-success',
                        tick === 'down' && 'text-danger'
                      )}
                    >
                      {price !== undefined ? price.toFixed(pair.endsWith('/JPY') || pair.startsWith('JPY') ? 3 : 5) : '—'}
                    </td>
                    <td className="p-3">
                      {tick === 'up' && <span className="text-success">▲</span>}
                      {tick === 'down' && <span className="text-danger">▼</span>}
                      {tick === 'flat' && <span className="text-muted">–</span>}
                    </td>
                    <td className="p-3">{signal && <BiasBadge bias={signal.bias} />}</td>
                    <td className="p-3">
                      {signal && (
                        <>
                          <span className="font-mono font-semibold">{signal.score}</span>
                          <span className="text-muted">/10</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

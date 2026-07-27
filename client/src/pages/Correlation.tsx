import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchFxHistory } from '@/api/client';
import { TRADABLE_CURRENCIES } from '@/lib/fx';
import { correlationMatrix, derivePairSeries, logReturns } from '@/lib/correlation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const BASE = 'USD';
const SETUP_KEY = 'fxmacro:correlation-setup';
const RANGE_OPTIONS = [
  { label: '3 Monate', months: 3 },
  { label: '6 Monate', months: 6 },
  { label: '1 Jahr', months: 12 },
  { label: '2 Jahre', months: 24 },
];

const PALETTE = ['#6c8fff', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#f472b6', '#84cc16'];

function correlationColor(value: number) {
  const abs = Math.min(Math.abs(value), 1);
  if (value > 0) return `rgba(52, 211, 153, ${0.15 + abs * 0.55})`; // success
  if (value < 0) return `rgba(248, 113, 113, ${0.15 + abs * 0.55})`; // danger
  return 'transparent';
}

function verdict(value: number): { label: string; tone: 'success' | 'danger' | 'muted' } {
  const abs = Math.abs(value);
  if (abs >= 0.7) return { label: value > 0 ? 'Stark positiv korreliert' : 'Stark negativ korreliert', tone: value > 0 ? 'success' : 'danger' };
  if (abs >= 0.3) return { label: value > 0 ? 'Positiv korreliert' : 'Negativ korreliert', tone: value > 0 ? 'success' : 'danger' };
  return { label: 'Keine erkennbare Korrelation', tone: 'muted' };
}

function loadSetup(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SETUP_KEY) ?? '[]');
    return Array.isArray(stored) && stored.length ? stored : ['EUR/USD', 'GBP/USD'];
  } catch {
    return ['EUR/USD', 'GBP/USD'];
  }
}

export function Correlation() {
  const [setup, setSetup] = useState<string[]>(() => loadSetup());
  const [currencyA, setCurrencyA] = useState('EUR');
  const [currencyB, setCurrencyB] = useState('JPY');
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ date: string; [pair: string]: string | number }[] | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>> | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ a: string; b: string } | null>(null);

  useEffect(() => {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  }, [setup]);

  function addPair() {
    if (currencyA === currencyB) return;
    const pair = `${currencyA}/${currencyB}`;
    const reverse = `${currencyB}/${currencyA}`;
    if (setup.includes(pair) || setup.includes(reverse)) return;
    if (setup.length >= 8) return;
    setSetup((prev) => [...prev, pair]);
  }

  function removePair(pair: string) {
    setSetup((prev) => prev.filter((p) => p !== pair));
    setSelectedCell(null);
  }

  async function calculate() {
    if (setup.length < 2) {
      setError('Füge mindestens 2 Pairs zu deinem Setup hinzu.');
      return;
    }
    setLoading(true);
    setError(null);
    setSelectedCell(null);
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - months);

      const currenciesUsed = Array.from(new Set(setup.flatMap((p) => p.split('/'))));
      const symbols = currenciesUsed.filter((c) => c !== BASE);

      const history = await fetchFxHistory({
        base: BASE,
        symbols,
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      });

      const seriesByPair: Record<string, { date: string; price: number }[]> = {};
      for (const pair of setup) seriesByPair[pair] = derivePairSeries(history, BASE, pair);

      const returnsByPair: Record<string, number[]> = {};
      for (const pair of setup) returnsByPair[pair] = logReturns(seriesByPair[pair]);

      setMatrix(correlationMatrix(returnsByPair));

      const dates = seriesByPair[setup[0]]?.map((r) => r.date) ?? [];
      const normalized = dates.map((date, i) => {
        const row: { date: string; [pair: string]: string | number } = { date };
        for (const pair of setup) {
          const series = seriesByPair[pair];
          const first = series[0]?.price;
          const point = series[i]?.price;
          if (first && point !== undefined) row[pair] = Math.round((point / first) * 10000) / 100;
        }
        return row;
      });
      setChartData(normalized);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail;
      setError(detail || (err as Error).message || 'Unbekannter Fehler beim Laden der historischen Kurse.');
    } finally {
      setLoading(false);
    }
  }

  const pairColor = useMemo(() => Object.fromEntries(setup.map((p, i) => [p, PALETTE[i % PALETTE.length]])), [setup]);
  const selectedVerdict = selectedCell && matrix ? verdict(matrix[selectedCell.a]?.[selectedCell.b] ?? 0) : null;
  const selectedValue = selectedCell && matrix ? matrix[selectedCell.a]?.[selectedCell.b] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Korrelations-Rechner</h1>
        <p className="text-sm text-muted">
          Baue dein Setup aus beliebigen Forex-Pairs und prüfe, wie stark sie historisch korrelieren — auf Basis echter historischer
          FX-Kurse (Frankfurter API, kostenlos, kein Key).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dein Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Select value={currencyA} onChange={(e) => setCurrencyA(e.target.value)}>
              {TRADABLE_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <span className="pb-2 text-muted">/</span>
            <Select value={currencyB} onChange={(e) => setCurrencyB(e.target.value)}>
              {TRADABLE_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={addPair} disabled={currencyA === currencyB || setup.length >= 8}>
              + Pair hinzufügen
            </Button>
            <span className="pb-2 text-xs text-muted">{setup.length}/8 im Setup</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {setup.map((pair) => (
              <button
                key={pair}
                onClick={() => removePair(pair)}
                className="group flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-mono hover:border-danger"
                title="Klicken zum Entfernen"
              >
                {pair}
                <span className="text-muted group-hover:text-danger">×</span>
              </button>
            ))}
            {setup.length === 0 && <span className="text-xs text-muted">Noch keine Pairs im Setup.</span>}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {RANGE_OPTIONS.map((r) => (
                <option key={r.months} value={r.months}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Button onClick={calculate} disabled={loading}>
              {loading ? 'Berechne…' : 'Korrelation berechnen'}
            </Button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      {matrix && (
        <Card>
          <CardHeader>
            <CardTitle>Korrelationsmatrix (log returns, Pearson) — Zelle anklicken für Verdikt</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-2" />
                  {setup.map((p) => (
                    <th key={p} className="p-2 text-center font-mono text-xs text-muted">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {setup.map((rowPair) => (
                  <tr key={rowPair}>
                    <td className="p-2 pr-4 text-right font-mono text-xs text-muted">{rowPair}</td>
                    {setup.map((colPair) => {
                      const value = matrix[rowPair]?.[colPair] ?? 0;
                      const isSelected = selectedCell?.a === rowPair && selectedCell?.b === colPair;
                      return (
                        <td
                          key={colPair}
                          onClick={() => rowPair !== colPair && setSelectedCell({ a: rowPair, b: colPair })}
                          className={cn(
                            'min-w-[64px] cursor-pointer p-2 text-center font-mono text-xs font-semibold transition-all',
                            isSelected && 'ring-2 ring-accent'
                          )}
                          style={{ backgroundColor: correlationColor(value) }}
                        >
                          {value.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedCell && selectedVerdict && selectedValue !== null && selectedValue !== undefined && (
              <div
                className={cn(
                  'mt-4 rounded-md border p-4 text-sm',
                  selectedVerdict.tone === 'success' && 'border-success/50 text-success',
                  selectedVerdict.tone === 'danger' && 'border-danger/50 text-danger',
                  selectedVerdict.tone === 'muted' && 'border-muted/50 text-muted'
                )}
              >
                <span className="font-mono font-semibold">
                  {selectedCell.a} vs. {selectedCell.b}
                </span>
                : <span className="font-semibold">{selectedVerdict.label}</span> (r = {selectedValue.toFixed(2)})
              </div>
            )}

            <p className="mt-4 text-xs text-muted">
              +1.00 = perfekt gleichläufig, -1.00 = perfekt gegenläufig, 0 = keine erkennbare Beziehung. |r| ≥ 0.7 = stark, 0.3–0.7 =
              moderat, darunter = keine erkennbare Korrelation.
            </p>
          </CardContent>
        </Card>
      )}

      {chartData && (
        <Card>
          <CardHeader>
            <CardTitle>Indexierte Kursentwicklung (Start = 100)</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(d: string) => d.slice(0, 7)} minTickGap={40} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--muted)' }}
                />
                {setup.map((pair) => (
                  <Line key={pair} type="monotone" dataKey={pair} stroke={pairColor[pair]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-3">
              {setup.map((pair) => (
                <div key={pair} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pairColor[pair] }} />
                  <span className="font-mono">{pair}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

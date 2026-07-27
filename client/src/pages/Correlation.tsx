import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchFxHistory } from '@/api/client';
import { buildPairs, CURRENCY_HIERARCHY } from '@/lib/scoring';
import { correlationMatrix, derivePairSeries, logReturns } from '@/lib/correlation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const BASE = 'USD';
const ALL_PAIRS = buildPairs().map(([a, b]) => `${a}/${b}`);
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

export function Correlation() {
  const [selected, setSelected] = useState<string[]>(['EUR/USD', 'GBP/USD']);
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ date: string; [pair: string]: string | number }[] | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>> | null>(null);

  function togglePair(pair: string) {
    setSelected((prev) => {
      if (prev.includes(pair)) return prev.filter((p) => p !== pair);
      if (prev.length >= 8) return prev; // keep the matrix readable
      return [...prev, pair];
    });
  }

  async function calculate() {
    if (selected.length < 2) {
      setError('Wähle mindestens 2 Pairs aus.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - months);
      const symbols = CURRENCY_HIERARCHY.filter((c) => c !== BASE);

      const history = await fetchFxHistory({
        base: BASE,
        symbols,
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      });

      const seriesByPair: Record<string, { date: string; price: number }[]> = {};
      for (const pair of selected) seriesByPair[pair] = derivePairSeries(history, BASE, pair);

      const returnsByPair: Record<string, number[]> = {};
      for (const pair of selected) returnsByPair[pair] = logReturns(seriesByPair[pair]);

      setMatrix(correlationMatrix(returnsByPair));

      // normalized (indexed to 100) price chart for visual comparison
      const dates = seriesByPair[selected[0]]?.map((r) => r.date) ?? [];
      const normalized = dates.map((date, i) => {
        const row: { date: string; [pair: string]: string | number } = { date };
        for (const pair of selected) {
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

  const pairColor = useMemo(() => Object.fromEntries(selected.map((p, i) => [p, PALETTE[i % PALETTE.length]])), [selected]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Korrelations-Rechner</h1>
        <p className="text-sm text-muted">
          Wähle mehrere Pairs und prüfe, wie stark sie historisch korrelieren — auf Basis echter historischer FX-Kurse (Frankfurter API,
          kostenlos, kein Key).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pairs auswählen (max. 8)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-7">
            {ALL_PAIRS.map((pair) => (
              <label key={pair} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(pair)}
                  onChange={() => togglePair(pair)}
                  className="h-3.5 w-3.5 accent-accent"
                />
                <span className="font-mono">{pair}</span>
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
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
            <span className="text-xs text-muted">{selected.length} ausgewählt</span>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      {matrix && (
        <Card>
          <CardHeader>
            <CardTitle>Korrelationsmatrix (log returns, Pearson)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-2" />
                  {selected.map((p) => (
                    <th key={p} className="p-2 text-center font-mono text-xs text-muted">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.map((rowPair) => (
                  <tr key={rowPair}>
                    <td className="p-2 pr-4 text-right font-mono text-xs text-muted">{rowPair}</td>
                    {selected.map((colPair) => {
                      const value = matrix[rowPair]?.[colPair] ?? 0;
                      return (
                        <td
                          key={colPair}
                          className="min-w-[64px] p-2 text-center font-mono text-xs font-semibold"
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
            <p className="mt-4 text-xs text-muted">
              +1.00 = perfekt gleichläufig, -1.00 = perfekt gegenläufig, 0 = keine erkennbare Beziehung. Grün = positive, Rot = negative
              Korrelation.
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
                {selected.map((pair) => (
                  <Line key={pair} type="monotone" dataKey={pair} stroke={pairColor[pair]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-3">
              {selected.map((pair) => (
                <div key={pair} className={cn('flex items-center gap-1.5 text-xs')}>
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

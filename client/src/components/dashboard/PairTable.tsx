import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { CentralBank, PairSignal } from '@/types';
import { useWatchlist } from '@/hooks/useSettings';
import { BiasBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type FilterMode = 'all' | 'watchlist' | 'strongest';

const trendIcon = {
  growing: <ArrowUp className="h-3.5 w-3.5 text-success" />,
  shrinking: <ArrowDown className="h-3.5 w-3.5 text-danger" />,
  stable: <Minus className="h-3.5 w-3.5 text-muted" />,
};

const trendLabel = {
  growing: 'Wächst',
  shrinking: 'Schrumpft',
  stable: 'Stabil',
};

interface PairTableProps {
  pairs: PairSignal[];
  banks: CentralBank[];
  onUpdatePairNotes: (pair: string, patch: { expected_change?: string; notes?: string }) => void;
}

export function PairTable({ pairs, banks, onUpdatePairNotes }: PairTableProps) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [watchlist] = useWatchlist();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const banksByCurrency = useMemo(() => Object.fromEntries(banks.map((b) => [b.currency, b])), [banks]);

  const filtered = useMemo(() => {
    let rows = pairs;
    if (filter === 'watchlist') {
      rows = rows.filter((p) => {
        const [a, b] = p.pair.split('/');
        return watchlist.includes(a) && watchlist.includes(b);
      });
    } else if (filter === 'strongest') {
      rows = [...rows].sort((a, b) => b.score - a.score).slice(0, 8);
    }
    return rows;
  }, [pairs, filter, watchlist]);

  function commitExpectedChange(pair: string) {
    const value = drafts[pair];
    if (value === undefined) return;
    onUpdatePairNotes(pair, { expected_change: value });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Alle Währungspaare</h2>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as FilterMode)}>
          <option value="all">Alle Pairs</option>
          <option value="watchlist">Nur meine Währungen</option>
          <option value="strongest">Stärkstes Signal</option>
        </Select>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pair</TableHead>
              <TableHead className="font-mono">Zins A</TableHead>
              <TableHead className="font-mono">Zins B</TableHead>
              <TableHead className="font-mono">Differenz</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead>Bias</TableHead>
              <TableHead>Expected Change (3M)</TableHead>
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const [a, b] = p.pair.split('/');
              const bankA = banksByCurrency[a];
              const bankB = banksByCurrency[b];
              return (
                <TableRow key={p.pair}>
                  <TableCell>
                    <Link to={`/pairs/${p.pair.replace('/', '-')}`} className="font-semibold text-foreground hover:text-accent">
                      {p.pair}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono">{bankA ? `${bankA.current_rate.toFixed(2)}%` : '—'}</TableCell>
                  <TableCell className="font-mono">{bankB ? `${bankB.current_rate.toFixed(2)}%` : '—'}</TableCell>
                  <TableCell className={cn('font-mono font-semibold', p.differential >= 0 ? 'text-success' : 'text-danger')}>
                    {p.differential > 0 ? '+' : ''}
                    {p.differential.toFixed(2)}%
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      {trendIcon[p.trend_direction]}
                      {trendLabel[p.trend_direction]}
                    </div>
                  </TableCell>
                  <TableCell>
                    <BiasBadge bias={p.bias} />
                  </TableCell>
                  <TableCell>
                    <input
                      className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      placeholder="z.B. +50 pips"
                      value={drafts[p.pair] ?? p.expected_change}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.pair]: e.target.value }))}
                      onBlur={() => commitExpectedChange(p.pair)}
                      onKeyDown={(e) => e.key === 'Enter' && commitExpectedChange(p.pair)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold">{p.score}</span>
                    <span className="text-muted">/10</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

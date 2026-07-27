import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import type { CentralBank } from '@/types';
import { useCentralBanks } from '@/hooks/useCentralBanks';
import { usePairs } from '@/hooks/usePairs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PairTable } from '@/components/dashboard/PairTable';

function guidanceValue(g: CentralBank['forward_guidance']) {
  if (g === 'hawkish') return 1;
  if (g === 'dovish') return -1;
  return 0;
}

function strengthScore(b: CentralBank) {
  return b.current_rate + guidanceValue(b.forward_guidance) * 0.75 + b.last_change_amount;
}

export function Dashboard() {
  const { banks } = useCentralBanks();
  const { pairs } = usePairs(banks);

  const strongest = useMemo(() => [...banks].sort((a, b) => strengthScore(b) - strengthScore(a))[0] ?? null, [banks]);
  const weakest = useMemo(() => [...banks].sort((a, b) => strengthScore(a) - strengthScore(b))[0] ?? null, [banks]);
  const biggestDiff = useMemo(
    () => [...pairs].sort((a, b) => Math.abs(b.differential) - Math.abs(a.differential))[0] ?? null,
    [pairs]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted">Forex Interest Rate Intelligence — Überblick über alle 28 Pairs</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Stärkste Währung der Woche</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{strongest?.currency ?? '—'}</div>
            <p className="mt-1 text-xs text-muted">
              {strongest ? `${strongest.name} · ${strongest.current_rate.toFixed(2)}% · ${strongest.forward_guidance}` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Schwächste Währung</CardTitle>
            <TrendingDown className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{weakest?.currency ?? '—'}</div>
            <p className="mt-1 text-xs text-muted">
              {weakest ? `${weakest.name} · ${weakest.current_rate.toFixed(2)}% · ${weakest.forward_guidance}` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Größte Zinsdifferenz gerade</CardTitle>
            <Zap className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{biggestDiff?.pair ?? '—'}</div>
            <p className="mt-1 text-xs text-muted">
              {biggestDiff ? `${biggestDiff.differential > 0 ? '+' : ''}${biggestDiff.differential.toFixed(2)}% · Score ${biggestDiff.score}/10` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <PairTable pairs={pairs} banks={banks} />
    </div>
  );
}

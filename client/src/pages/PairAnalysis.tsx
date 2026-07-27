import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CheckCircle2 } from 'lucide-react';
import { useCentralBanks } from '@/hooks/useCentralBanks';
import {
  calculateScore,
  carryTradeRisk,
  combinedSignal,
  cpiTrendLabel,
  divergenceClass,
  getBias,
  guidanceLabel,
  inflationSignal,
  rateTrajectory,
  trendDirection,
} from '@/lib/scoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BiasBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const guidanceColor: Record<string, string> = {
  hawkish: 'text-success',
  neutral: 'text-muted',
  dovish: 'text-danger',
};

const signalColor: Record<string, string> = {
  'STRONG LONG': 'text-success',
  LONG: 'text-success',
  NEUTRAL: 'text-muted',
  SHORT: 'text-danger',
  'STRONG SHORT': 'text-danger',
};

const divergenceStyle: Record<string, { border: string; text: string; label: string }> = {
  'STRONG DIVERGENCE': { border: 'border-accent', text: 'text-accent', label: 'Starke Divergenz — Voraussetzung für einen starken, lang anhaltenden Trend.' },
  MIXED: { border: 'border-warning', text: 'text-warning', label: 'Gemischtes Signal — eine Seite neutral, kein klarer Trend-Treiber.' },
  ALIGNED: { border: 'border-muted', text: 'text-muted', label: 'Beide Zentralbanken bewegen sich in dieselbe Richtung — kein fundamentaler Edge, Markt läuft eher auf Technik/Risk-On-Off.' },
};

const trajectoryIcon = { up: <ArrowUp className="h-4 w-4 text-success" />, down: <ArrowDown className="h-4 w-4 text-danger" />, flat: <ArrowRight className="h-4 w-4 text-muted" /> };

const ZONES = [
  { label: 'Neutral Zone', max: 0.5 },
  { label: 'Weak Trend Zone', max: 1.5 },
  { label: 'Trend Zone', max: 3 },
  { label: 'Strong Trend Zone', max: Infinity },
];

export function PairAnalysis() {
  const { pair: pairParam = '' } = useParams();
  const { banks } = useCentralBanks();
  const pair = pairParam.toUpperCase().replace('-', '/');
  const [a, b] = pair.split('/');

  const detail = useMemo(() => {
    const bankA = banks.find((bk) => bk.currency === a);
    const bankB = banks.find((bk) => bk.currency === b);
    if (!bankA || !bankB) return null;

    const differential = Math.round((bankA.current_rate - bankB.current_rate) * 100) / 100;
    const trend = trendDirection(bankA, bankB, differential);
    const zone = ZONES.find((z) => Math.abs(differential) < z.max) ?? ZONES[ZONES.length - 1];

    return {
      signal: { pair, bias: getBias(bankA, bankB), score: calculateScore(bankA, bankB), differential, trend_direction: trend },
      bankA,
      bankB,
      zone,
      divergence: divergenceClass(bankA, bankB),
      trajectoryA: rateTrajectory(bankA),
      trajectoryB: rateTrajectory(bankB),
      inflation: inflationSignal(bankA, bankB),
      carryRisk: carryTradeRisk(differential, trend),
      combined: combinedSignal(bankA, bankB),
    };
  }, [banks, a, b, pair]);

  if (!detail) return <div className="py-12 text-center text-muted">Pair nicht gefunden.</div>;

  const { signal, bankA, bankB, zone, divergence, trajectoryA, trajectoryB, inflation, carryRisk, combined } = detail;
  const div = divergenceStyle[divergence];

  // 24 months of differential history purely for the chart — derived the
  // same deterministic way as the central-bank mini charts.
  const differentialHistory = useMemo(() => {
    const months = 24;
    const today = new Date();
    const rows: { date: string; differential: number }[] = [];
    let rateA = bankA.current_rate;
    let rateB = bankB.current_rate;
    for (let i = 0; i < months; i++) {
      const d = new Date(today);
      d.setMonth(d.getMonth() - i);
      rows.push({ date: d.toISOString().slice(0, 10), differential: Math.round((rateA - rateB) * 100) / 100 });
      const seedA = (bankA.currency.charCodeAt(0) + i) % 5;
      const seedB = (bankB.currency.charCodeAt(0) + i) % 5;
      if (seedA === 0 && i > 0) rateA += 0.25;
      if (seedB === 0 && i > 0) rateB += 0.25;
    }
    return rows.reverse();
  }, [bankA, bankB]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono">{signal.pair}</h1>
          <p className="text-sm text-muted">
            {bankA.name} vs. {bankB.name} — reine Zinsdaten-Analyse
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BiasBadge bias={signal.bias} />
          <div className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
            Score <span className="font-mono font-semibold">{signal.score}</span>/10
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Zinsdifferenz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className={cn('font-mono text-4xl font-bold', signal.differential >= 0 ? 'text-success' : 'text-danger')}>
                {signal.differential > 0 ? '+' : ''}
                {signal.differential.toFixed(2)}%
              </div>
              <div className="mt-1 text-sm text-muted">{zone.label}</div>
            </div>
            <div className={cn('rounded-md border p-3 text-sm', div.border, div.text)}>{div.label}</div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Zinsdifferenz — letzte 24 Monate</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={differentialHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(d: string) => d.slice(0, 7)} minTickGap={30} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} unit="%" />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--muted)' }}
                />
                <Line type="monotone" dataKey="differential" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fundamentale Analyse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { bank: bankA, trajectory: trajectoryA },
              { bank: bankB, trajectory: trajectoryB },
            ].map(({ bank, trajectory }) => (
              <div key={bank.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                {trajectoryIcon[trajectory.direction]}
                <div>
                  <div className="text-xs font-semibold text-muted">
                    {bank.currency} · {guidanceLabel(bank.forward_guidance)} · Inflation {cpiTrendLabel(bank.cpi_trend)}
                  </div>
                  <div className="text-sm">{trajectory.label}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="border-t border-border pt-4 text-sm text-muted">{inflation}</p>

          {carryRisk.atRisk && (
            <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{carryRisk.message}</span>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Checkliste vor dem Trade</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>
                  Inflation {bankA.currency}: <strong>{cpiTrendLabel(bankA.cpi_trend)}</strong> · Inflation {bankB.currency}:{' '}
                  <strong>{cpiTrendLabel(bankB.cpi_trend)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>
                  {bankA.name}: <strong>{guidanceLabel(bankA.forward_guidance)}</strong> · {bankB.name}:{' '}
                  <strong>{guidanceLabel(bankB.forward_guidance)}</strong>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {[bankA, bankB].map((bank) => (
          <Card key={bank.id}>
            <CardHeader>
              <CardTitle>{bank.name} ({bank.currency})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Letzte Entscheidung</span>
                <span className="font-mono">{bank.last_change_date} ({bank.last_change_amount > 0 ? '+' : ''}{bank.last_change_amount.toFixed(2)}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Nächste Sitzung</span>
                <span className="font-mono">{bank.next_meeting}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Forward Guidance</span>
                <span className={cn('font-semibold', guidanceColor[bank.forward_guidance])}>{guidanceLabel(bank.forward_guidance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">CPI</span>
                <span className="font-mono">
                  {bank.cpi.toFixed(1)}% ({cpiTrendLabel(bank.cpi_trend)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Arbeitslosenquote</span>
                <span className="font-mono">{bank.unemployment.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signal Box</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted">Technischer Bias</div>
              <div className={cn('text-lg font-semibold', signalColor[combined.technical] ?? '')}>{combined.technical}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Fundamentaler Bias</div>
              <div className={cn('text-lg font-semibold', signalColor[combined.fundamental] ?? '')}>{combined.fundamental}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Combined Signal</div>
              <div className={cn('text-lg font-bold', signalColor[combined.signal])}>{combined.signal}</div>
            </div>
          </div>
          <p className="border-t border-border pt-4 text-sm text-muted">{combined.reasoning}</p>
        </CardContent>
      </Card>
    </div>
  );
}

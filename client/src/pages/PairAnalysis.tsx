import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchPairDetail } from '@/api/client';
import type { PairDetail } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BiasBadge } from '@/components/ui/badge';
import { FibBox } from '@/components/pairs/FibBox';

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

export function PairAnalysis() {
  const { pair = '' } = useParams();
  const [detail, setDetail] = useState<PairDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setDetail(null);
    setError(false);
    fetchPairDetail(pair)
      .then(setDetail)
      .catch(() => setError(true));
  }, [pair]);

  if (error) return <div className="py-12 text-center text-muted">Pair nicht gefunden.</div>;
  if (!detail) return <div className="py-12 text-center text-muted">Lade Pair-Daten…</div>;

  const { signal, bankA, bankB, differentialHistory, combined } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono">{signal.pair}</h1>
          <p className="text-sm text-muted">
            {bankA.name} vs. {bankB.name}
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
          <CardContent className="pt-5">
            <FibBox differential={signal.differential} />
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
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickFormatter={(d: string) => d.slice(0, 7)}
                  minTickGap={30}
                />
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
                <span className={`font-semibold capitalize ${guidanceColor[bank.forward_guidance]}`}>{bank.forward_guidance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">CPI</span>
                <span className="font-mono">{bank.cpi.toFixed(1)}%</span>
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
              <div className={`text-lg font-semibold ${signalColor[combined.technical] ?? ''}`}>{combined.technical}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Fundamentaler Bias</div>
              <div className={`text-lg font-semibold ${signalColor[combined.fundamental] ?? ''}`}>{combined.fundamental}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Combined Signal</div>
              <div className={`text-lg font-bold ${signalColor[combined.signal]}`}>{combined.signal}</div>
            </div>
          </div>
          <p className="border-t border-border pt-4 text-sm text-muted">{combined.reasoning}</p>
        </CardContent>
      </Card>
    </div>
  );
}

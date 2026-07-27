import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { Radio } from 'lucide-react';
import type { CentralBank, LiveRate } from '@/types';
import { useCentralBanks } from '@/hooks/useCentralBanks';
import { useLiveRates } from '@/hooks/useLiveRates';
import { buildRateHistory } from '@/lib/scoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const guidanceStyles: Record<string, string> = {
  hawkish: 'border-success text-success',
  neutral: 'border-muted text-muted',
  dovish: 'border-danger text-danger',
};

function BankCard({ bank, liveRate }: { bank: CentralBank; liveRate: LiveRate | null | undefined }) {
  const history = useMemo(() => buildRateHistory(bank), [bank]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-foreground text-base font-semibold">{bank.name}</CardTitle>
          <p className="text-xs text-muted">
            {bank.country} · {bank.currency}
          </p>
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${guidanceStyles[bank.forward_guidance]}`}>
          {bank.forward_guidance}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-4xl font-bold font-mono">{bank.current_rate.toFixed(2)}%</div>
          {liveRate && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-success">
              <Radio className="h-3 w-3" />
              Live: {liveRate.rate.toFixed(2)}% {liveRate.asOf && `(${liveRate.asOf})`}
            </div>
          )}
        </div>

        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line type="stepAfter" dataKey="rate" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted">Letztes Meeting</div>
            <div className="font-mono">{bank.last_change_date}</div>
            <div className="font-mono">
              {bank.last_change_amount > 0 ? '+' : ''}
              {bank.last_change_amount === 0 ? 'Unverändert' : `${bank.last_change_amount.toFixed(2)}%`}
            </div>
          </div>
          <div>
            <div className="text-muted">Next Meeting</div>
            <div className="font-mono">{bank.next_meeting}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
          <div>
            <div className="text-muted">CPI ({bank.cpi_trend === 'rising' ? '↑' : bank.cpi_trend === 'falling' ? '↓' : '→'})</div>
            <div className="font-mono font-semibold">{bank.cpi.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted">Arbeitslosigkeit</div>
            <div className="font-mono font-semibold">{bank.unemployment.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted">GDP Growth</div>
            <div className="font-mono font-semibold">{bank.gdp_growth.toFixed(1)}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CentralBanks() {
  const { banks } = useCentralBanks();
  const liveRates = useLiveRates();
  const liveByBankId: Record<string, LiveRate | null> = {
    boc: liveRates?.boc ?? null,
    ecb: liveRates?.ecb ?? null,
    snb: liveRates?.snb ?? null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Zentralbanken</h1>
        <p className="text-sm text-muted">
          Leitzinsen, Forward Guidance und Wirtschaftsdaten aller 8 Zentralbanken. Für BoC, EZB und SNB zusätzlich live vom offiziellen
          Datenportal (grüner "Live"-Wert), die restlichen 5 haben keine vergleichbare freie API und bleiben recherchiert.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {banks.map((bank) => (
          <BankCard key={bank.id} bank={bank} liveRate={liveByBankId[bank.id]} />
        ))}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { useCentralBanks } from '@/hooks/useCentralBanks';
import { CURRENCY_HIERARCHY } from '@/lib/scoring';
import type { CentralBankMeeting } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Countdown } from '@/components/calendar/Countdown';

const MAJOR_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY']);

export function EconomicCalendar() {
  const { banks } = useCentralBanks();

  const meetings = useMemo<CentralBankMeeting[]>(() => {
    const affectedPairsFor = (currency: string) => CURRENCY_HIERARCHY.filter((c) => c !== currency).map((other) => {
      const idx = CURRENCY_HIERARCHY.indexOf(currency);
      const otherIdx = CURRENCY_HIERARCHY.indexOf(other);
      return idx < otherIdx ? `${currency}/${other}` : `${other}/${currency}`;
    });

    return [...banks]
      .map((bank) => ({
        bankId: bank.id,
        bank: bank.name,
        currency: bank.currency,
        date: bank.next_meeting,
        forward_guidance: bank.forward_guidance,
        importance: MAJOR_CURRENCIES.has(bank.currency) ? ('HIGH' as const) : ('MEDIUM' as const),
        affected_pairs: affectedPairsFor(bank.currency),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [banks]);

  const nextHigh = useMemo(() => meetings.filter((m) => m.importance === 'HIGH').slice(0, 3), [meetings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Economic Calendar</h1>
        <p className="text-sm text-muted">Anstehende Zentralbank-Sitzungen (aus den Zentralbank-Daten abgeleitet) mit Live-Countdowns.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {nextHigh.map((m) => (
          <Card key={m.bankId}>
            <CardHeader>
              <CardTitle>{m.bank}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted">{m.date}</div>
              <div className="mt-1 text-lg">
                <Countdown date={m.date} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Zentralbank</TableHead>
              <TableHead>Forward Guidance</TableHead>
              <TableHead>Wichtigkeit</TableHead>
              <TableHead>Betroffene Pairs</TableHead>
              <TableHead>Countdown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.map((m) => (
              <TableRow key={m.bankId}>
                <TableCell className="font-mono">{m.date}</TableCell>
                <TableCell>{m.bank}</TableCell>
                <TableCell className="capitalize">{m.forward_guidance}</TableCell>
                <TableCell>
                  <Badge className={m.importance === 'HIGH' ? 'border-danger text-danger' : 'border-warning text-warning'}>
                    {m.importance}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs text-xs text-muted">{m.affected_pairs.join(', ')}</TableCell>
                <TableCell className="text-xs">
                  <Countdown date={m.date} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

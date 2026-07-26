import { useEffect, useMemo, useState } from 'react';
import { fetchEconomicEvents, updateEconomicEvent } from '@/api/client';
import type { EconomicEvent } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Countdown } from '@/components/calendar/Countdown';

export function EconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchEconomicEvents().then(setEvents);
  }, []);

  async function commit(id: number) {
    const value = drafts[id];
    if (value === undefined) return;
    const updated = await updateEconomicEvent(id, value);
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
  }

  const upcoming = useMemo(
    () => [...events].filter((e) => new Date(e.date).getTime() > Date.now() - 86400000).sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );
  const nextHigh = useMemo(() => upcoming.filter((e) => e.importance === 'HIGH').slice(0, 3), [upcoming]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Economic Calendar</h1>
        <p className="text-sm text-muted">Anstehende Zentralbank-Sitzungen und Live-Countdowns.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {nextHigh.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle>{e.bank}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted">{e.date}</div>
              <div className="mt-1 text-lg">
                <Countdown date={e.date} />
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
              <TableHead>Erwartete Entscheidung</TableHead>
              <TableHead>Wichtigkeit</TableHead>
              <TableHead>Betroffene Pairs</TableHead>
              <TableHead>Countdown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcoming.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono">{e.date}</TableCell>
                <TableCell>{e.bank}</TableCell>
                <TableCell>
                  <input
                    className="h-8 w-32 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    value={drafts[e.id] ?? e.expected_decision}
                    onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: ev.target.value }))}
                    onBlur={() => commit(e.id)}
                    onKeyDown={(ev) => ev.key === 'Enter' && commit(e.id)}
                  />
                </TableCell>
                <TableCell>
                  <Badge className={e.importance === 'HIGH' ? 'border-danger text-danger' : 'border-warning text-warning'}>
                    {e.importance}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs text-xs text-muted">{e.affected_pairs.split(',').join(', ')}</TableCell>
                <TableCell className="text-xs">
                  <Countdown date={e.date} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

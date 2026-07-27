import { useEffect, useMemo, useState } from 'react';
import { fetchNewsCalendar } from '@/api/client';
import type { NewsEvent } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const impactStyles: Record<string, string> = {
  High: 'border-danger text-danger',
  Medium: 'border-warning text-warning',
  Low: 'border-muted text-muted',
  Holiday: 'border-accent text-accent',
};

type ImpactFilter = 'all' | 'High' | 'Medium' | 'Low';

export function NewsCalendar() {
  const [events, setEvents] = useState<NewsEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactFilter>('all');

  useEffect(() => {
    fetchNewsCalendar()
      .then(setEvents)
      .catch((err) => setError(err?.response?.data?.detail || err.message || 'Unbekannter Fehler'));
  }, []);

  const filtered = useMemo(() => {
    if (!events) return [];
    const rows = impact === 'all' ? events : events.filter((e) => e.impact === impact);
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }, [events, impact]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">News Kalender</h1>
        <p className="text-sm text-muted">
          Live-Wirtschaftsnachrichten dieser Woche — direkt vom öffentlichen ForexFactory-Kalender-Feed, ohne API-Key.
        </p>
      </div>

      {error && (
        <Card className="border-danger/50 p-4 text-sm text-danger">
          Live-Feed konnte nicht geladen werden ({error}). Das kann ein temporäres Problem des kostenlosen Upstream-Feeds sein — versuch es
          gleich nochmal.
        </Card>
      )}

      {!events && !error && <div className="py-12 text-center text-muted">Lade Live-News…</div>}

      {events && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">{filtered.length} Events</span>
            <Select value={impact} onChange={(e) => setImpact(e.target.value as ImpactFilter)}>
              <option value="all">Alle Impact-Level</option>
              <option value="High">Nur High Impact</option>
              <option value="Medium">Nur Medium Impact</option>
              <option value="Low">Nur Low Impact</option>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeit</TableHead>
                  <TableHead>Währung</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead className="font-mono">Forecast</TableHead>
                  <TableHead className="font-mono">Previous</TableHead>
                  <TableHead className="font-mono">Actual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e, i) => (
                  <TableRow key={`${e.title}-${e.date}-${i}`}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {e.date ? new Date(e.date).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell className="font-mono">{e.country}</TableCell>
                    <TableCell>{e.title}</TableCell>
                    <TableCell>
                      <Badge className={impactStyles[e.impact] ?? impactStyles.Low}>{e.impact}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{e.forecast || '—'}</TableCell>
                    <TableCell className="font-mono">{e.previous || '—'}</TableCell>
                    <TableCell className="font-mono">{e.actual || '—'}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted">
                      Keine Events für diesen Filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

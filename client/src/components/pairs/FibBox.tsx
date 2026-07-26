import { cn } from '@/lib/utils';

const ZONES = [
  { label: 'Neutral Zone', min: 0, max: 0.5, color: 'bg-muted/30' },
  { label: 'Weak Trend Zone', min: 0.5, max: 1.5, color: 'bg-warning/40' },
  { label: 'Trend Zone', min: 1.5, max: 3, color: 'bg-accent/50' },
  { label: 'Strong Trend Zone', min: 3, max: Infinity, color: 'bg-success/60' },
] as const;

const SCALE_MAX = 4.5; // visual cap for the bar

function pct(value: number) {
  return (Math.min(value, SCALE_MAX) / SCALE_MAX) * 100;
}

export function FibBox({ differential }: { differential: number }) {
  const abs = Math.abs(differential);
  const zone = ZONES.find((z) => abs < z.max) ?? ZONES[ZONES.length - 1];
  const markerPct = pct(abs);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Fib-Box Analyse</div>
        <div className="mt-1 text-lg font-semibold">{zone.label}</div>
      </div>
      <div className="flex gap-4">
        <div className="relative h-72 w-10 shrink-0 overflow-hidden rounded-md border border-border">
          <div className="absolute inset-0 flex flex-col-reverse">
            {ZONES.map((z) => (
              <div key={z.label} className={z.color} style={{ height: `${pct(Math.min(z.max, SCALE_MAX)) - pct(z.min)}%` }} />
            ))}
          </div>
          <div className="absolute left-0 right-0" style={{ bottom: `calc(${markerPct}% - 1px)` }}>
            <div className={cn('h-1 w-full', differential >= 0 ? 'bg-success' : 'bg-danger')} />
          </div>
          <div
            className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background"
            style={{ bottom: `calc(${markerPct}% - 6px)`, backgroundColor: differential >= 0 ? 'var(--success)' : 'var(--danger)' }}
          />
        </div>
        <div className="relative h-72 text-xs text-muted">
          {ZONES.map((z) => {
            const top = z.max, bottom = z.min;
            const centerPct = (pct(Math.min(top, SCALE_MAX)) + pct(bottom)) / 2;
            return (
              <div
                key={z.label}
                className="absolute translate-y-1/2 whitespace-nowrap"
                style={{ bottom: `${centerPct}%` }}
              >
                {z.label}
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-md border border-border bg-background/50 p-3 text-sm">
        Aktuelle Differenz: <span className="font-mono font-semibold">{differential.toFixed(2)}%</span>
      </div>
    </div>
  );
}

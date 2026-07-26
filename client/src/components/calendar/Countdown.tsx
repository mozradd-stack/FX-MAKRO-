import { useEffect, useState } from 'react';

function diffParts(target: Date) {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

export function Countdown({ date }: { date: string }) {
  const target = new Date(`${date}T12:00:00Z`);
  const [parts, setParts] = useState(() => diffParts(target));

  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(target)), 1000);
    return () => clearInterval(id);
  }, [date]);

  if (!parts) return <span className="text-muted">vorbei</span>;

  return (
    <span className="font-mono">
      {parts.days}d {String(parts.hours).padStart(2, '0')}h {String(parts.minutes).padStart(2, '0')}m {String(parts.seconds).padStart(2, '0')}s
    </span>
  );
}

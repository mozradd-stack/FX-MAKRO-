import * as React from 'react';
import { cn } from '@/lib/utils';

export type BiasLevel = 'STRONG BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG BEARISH';

const biasClasses: Record<BiasLevel, string> = {
  'STRONG BULLISH': 'bg-success text-white border border-success',
  BULLISH: 'border border-success text-success bg-transparent',
  NEUTRAL: 'border border-muted text-muted bg-transparent',
  BEARISH: 'border border-danger text-danger bg-transparent',
  'STRONG BEARISH': 'bg-danger text-white border border-danger',
};

export function BiasBadge({ bias, className }: { bias: string; className?: string }) {
  const cls = biasClasses[bias as BiasLevel] ?? biasClasses.NEUTRAL;
  return (
    <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide', cls, className)}>
      {bias}
    </span>
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted', className)}
      {...props}
    />
  );
}

import { PairTable } from '@/components/dashboard/PairTable';

export function PairsIndex() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pair Analyse</h1>
        <p className="text-sm text-muted">Wähle ein Pair für die detaillierte Fib-Box- und Signal-Analyse.</p>
      </div>
      <PairTable />
    </div>
  );
}

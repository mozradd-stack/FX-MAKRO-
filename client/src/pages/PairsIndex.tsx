import { useCentralBanks } from '@/hooks/useCentralBanks';
import { usePairs } from '@/hooks/usePairs';
import { PairTable } from '@/components/dashboard/PairTable';

export function PairsIndex() {
  const { banks } = useCentralBanks();
  const { pairs } = usePairs(banks);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pair Analyse</h1>
        <p className="text-sm text-muted">Wähle ein Pair für die detaillierte Zins-Analyse.</p>
      </div>
      <PairTable pairs={pairs} banks={banks} />
    </div>
  );
}

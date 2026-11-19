import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { InsightScope } from '@/lib/stats/insights';

const SCOPES: Array<{ id: InsightScope; label: string }> = [
  { id: 'month', label: 'Mês' },
  { id: 'year', label: 'Ano' },
  { id: 'all', label: 'Sempre' },
];

interface Props {
  scope: InsightScope;
  label: string;
  onScope(scope: InsightScope): void;
  onShift(delta: -1 | 1): void;
}

export function StatsPeriodBar({ scope, label, onScope, onShift }: Props) {
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Período" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={scope === s.id}
            onClick={() => onScope(s.id)}
            className={`rounded-xl py-2 text-sm font-semibold transition-colors ${
              scope === s.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-6">
        {scope !== 'all' && (
          <button type="button" aria-label="Período anterior" onClick={() => onShift(-1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <p className="min-w-[10rem] text-center text-base font-semibold text-foreground">{label}</p>
        {scope !== 'all' && (
          <button type="button" aria-label="Próximo período" onClick={() => onShift(1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

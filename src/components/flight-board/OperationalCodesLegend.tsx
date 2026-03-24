import { Info } from 'lucide-react';
import { OPERATIONAL_CODE_MAP, OPERATIONAL_CODES_ORDER } from '@/lib/roster/flight-role-labels';

export function OperationalCodesLegend() {
  return (
    <details className="group rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Siglas operacionais</span>
        <span className="ml-auto text-[10px] opacity-80 group-open:hidden">ver significados</span>
        <span className="ml-auto hidden text-[10px] opacity-80 group-open:inline">ocultar</span>
      </summary>
      <ul className="mt-2 space-y-1.5 border-t border-border/50 pt-2 text-[11px] text-muted-foreground sm:text-xs">
        {OPERATIONAL_CODES_ORDER.map((id) => {
          const d = OPERATIONAL_CODE_MAP[id];
          return (
            <li key={id} className="flex flex-wrap gap-x-1.5 gap-y-0.5">
              <span className="font-mono font-semibold text-foreground">{d.shortLabel}</span>
              <span className="text-muted-foreground">—</span>
              <span>{d.fullLabel}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

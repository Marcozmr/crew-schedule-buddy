import { DAY_KIND_META, type DayKind } from '@/lib/roster/day-kind';

const SHOWN: DayKind[] = ['voo', 'folga', 'sobreaviso', 'reserva', 'curso', 'ferias', 'dispensa'];

export function DayKindLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legenda dos tipos de dia">
      {SHOWN.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded ${DAY_KIND_META[k].className}`} aria-hidden="true" />
          {DAY_KIND_META[k].label}
        </li>
      ))}
    </ul>
  );
}

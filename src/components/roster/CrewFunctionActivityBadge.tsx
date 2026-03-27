import type { ScheduleEntry } from '@/hooks/useScheduleData';
import {
  buildCrewAbbrevPairFromLeg,
  isDisplayableCrewSigla,
} from '@/lib/roster/crew-display-abbrev';
import { shouldMinimizeRoleForExtraRemunerado } from '@/lib/roster/crew-tripulante-display';
import {
  getCrewActivityVisualType,
  getCrewActivityTooltipPt,
} from '@/lib/roster/crew-activity-visual';
import { CrewActivityGlyph } from '@/components/roster/CrewActivityGlyph';
import { cn } from '@/lib/utils';

interface CrewFunctionActivityBadgeProps {
  leg: ScheduleEntry;
  className?: string;
  /** Texto menor (cards compactos) */
  size?: 'default' | 'compact';
}

/**
 * Situação (OP/PS/…) e função (CC/…) com ícone operacional ao lado da função.
 */
export function CrewFunctionActivityBadge({
  leg,
  className,
  size = 'default',
}: CrewFunctionActivityBadgeProps) {
  const ab = buildCrewAbbrevPairFromLeg(leg);
  const visualType = getCrewActivityVisualType(leg);
  const tip = getCrewActivityTooltipPt(visualType);
  const minimizeRole = shouldMinimizeRoleForExtraRemunerado(leg.operation_type);

  const text = size === 'compact' ? 'text-[10px]' : 'text-[11px]';

  if (minimizeRole) {
    return (
      <div
        className={cn('flex flex-wrap items-center gap-1.5 min-w-0', text, className)}
        title={tip}
      >
        <span className="inline-flex items-center gap-1">
          <CrewActivityGlyph type={visualType} />
          <span className="font-semibold text-foreground">{ab.situation}</span>
        </span>
      </div>
    );
  }

  if (!isDisplayableCrewSigla(ab.role)) {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5 min-w-0', text, className)} title={tip}>
        <span className="inline-flex items-center gap-1">
          <CrewActivityGlyph type={visualType} />
          <span className="font-semibold text-foreground">{ab.situation}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 min-w-0', text, className)} title={tip}>
      <span className="font-semibold text-foreground">{ab.situation}</span>
      <span className="shrink-0 text-muted-foreground">·</span>
      <span className="inline-flex items-center gap-1">
        <CrewActivityGlyph type={visualType} />
        <span className="font-semibold text-foreground">{ab.role}</span>
      </span>
    </div>
  );
}

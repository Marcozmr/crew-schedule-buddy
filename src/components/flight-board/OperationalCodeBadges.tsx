import type { OperationalCodeId } from '@/lib/roster/flight-role-labels';
import { OPERATIONAL_CODE_MAP } from '@/lib/roster/flight-role-labels';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const categoryClass: Record<string, string> = {
  cabin_role: 'border-primary/35 bg-primary/[0.08] text-foreground',
  passenger_status: 'border-violet-500/35 bg-violet-500/[0.08] text-foreground',
  operational_state: 'border-emerald-600/35 bg-emerald-600/[0.08] text-foreground dark:border-emerald-500/40',
};

interface OperationalCodeBadgesProps {
  codes: OperationalCodeId[];
  className?: string;
}

export function OperationalCodeBadges({ codes, className }: OperationalCodeBadgesProps) {
  if (!codes.length) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {codes.map((id) => {
        const def = OPERATIONAL_CODE_MAP[id];
        const cat = categoryClass[def.category] ?? categoryClass.operational_state;
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight tracking-tight sm:text-[11px]',
                  cat
                )}
              >
                <span className="truncate">
                  <span className="font-mono">{def.shortLabel}</span>
                  <span className="mx-0.5 text-muted-foreground">·</span>
                  <span className="font-normal text-muted-foreground">{def.fullLabel}</span>
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              <span className="font-mono font-semibold">{def.shortLabel}</span> — {def.fullLabel}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

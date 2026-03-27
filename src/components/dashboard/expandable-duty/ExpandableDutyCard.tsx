import { ChevronDown, ChevronUp, Moon, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DutyPeriod } from '@/lib/duty-grouping';
import { formatDutyTime } from '@/lib/duty-grouping';
import { formatHoursMinutes, formatDateBR } from '@/lib/date-utils';
import type { DashboardStatusSummary } from '@/lib/operational-analysis';
import { CrewFunctionActivityBadge } from '@/components/roster/CrewFunctionActivityBadge';
import { isPresentationEntry } from '@/lib/schedule-entry-sort';
import { getRestUntilNextPresentation, formatOperationalDuration } from '@/lib/roster/operational-intervals';
import { DutyLegTimeline, DutyTimelineFooter } from './DutyLegTimeline';

const footerStatusTone = {
  regular: 'text-success',
  attention: 'text-warning',
  review: 'text-warning',
  critical: 'text-destructive',
} as const;

function CollapsedCrewLine({ duty }: { duty: DutyPeriod }) {
  const leg = duty.legs[0];
  return (
    <CrewFunctionActivityBadge leg={leg} size="compact" />
  );
}

export interface ExpandableDutyCardProps {
  duty: DutyPeriod;
  index: number;
  statusSummary?: DashboardStatusSummary;
  expanded: boolean;
  onToggle: () => void;
  /** Jornadas ordenadas (ex.: `groupIntoDutyPeriods`) para descanso até a próxima */
  allDutiesOrdered: DutyPeriod[];
}

export function ExpandableDutyCard({
  duty,
  index,
  statusSummary,
  expanded,
  onToggle,
  allDutiesOrdered,
}: ExpandableDutyCardProps) {
  const isMultiLeg = duty.legCount > 1;
  const firstLeg = duty.legs[0];
  const singlePresentationOnly =
    duty.legCount === 1 && !firstLeg.is_flight && isPresentationEntry(firstLeg);
  const dutyMins = Math.round(duty.totalDutyHours * 60);
  const isLongDuty = duty.totalDutyHours > 11;
  const displayStatus =
    statusSummary ?? {
      tone: isLongDuty ? 'attention' : 'regular',
      label: isLongDuty ? 'Atenção' : 'Regular',
      subtitle: isLongDuty ? 'Acompanhe os limites da jornada' : 'Operação dentro do esperado',
    };

  const restInfo = getRestUntilNextPresentation(duty, allDutiesOrdered);
  const restMinutes = restInfo?.minutes ?? null;
  const nextPresentationLabel = restInfo
    ? restInfo.nextDuty.reportTime
      ? `Próxima apresentação ${restInfo.nextDuty.reportTime}${
          restInfo.nextDuty.dutyStartDate !== duty.dutyStartDate
            ? ` · ${formatDateBR(restInfo.nextDuty.dutyStartDate)}`
            : ''
        }`
      : `Próxima jornada · ${formatDateBR(restInfo.nextDuty.dutyStartDate)}`
    : undefined;

  const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.06 + index * 0.03, duration: 0.28, ease: 'easeOut' as const },
  };

  const titleLabel = isMultiLeg
    ? `Jornada · ${duty.legCount} trechos`
    : singlePresentationOnly
      ? 'Apresentação'
      : firstLeg.flight_number;

  const shortSoloHint =
    isMultiLeg && duty.connectionTimes[0] != null && duty.connectionTimes[0] > 0
      ? `Solo ${formatOperationalDuration(duty.connectionTimes[0])}`
      : null;

  const shortRestHint =
    !expanded && restMinutes != null && restMinutes > 0
      ? `Próxima apresentação em ${formatOperationalDuration(restMinutes)}`
      : null;

  return (
    <motion.div {...fade} className="glass hover-lift min-w-0 overflow-hidden rounded-2xl border border-border/60 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full min-w-0 flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/20 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="whitespace-nowrap rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
              {titleLabel}
            </span>
            {duty.crossesMidnight && (
              <span className="flex items-center gap-1 whitespace-nowrap rounded-md bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                <Moon className="h-3 w-3" /> +1 dia
              </span>
            )}
            {duty.hasMadrugada && (
              <span className="whitespace-nowrap rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                Madrugada
              </span>
            )}
            {isLongDuty && (
              <span className="flex items-center gap-1 whitespace-nowrap rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" /> Jornada longa
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {duty.reportTime && (
              <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                APR {duty.reportTime}
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          <p className="break-words text-base font-bold leading-snug text-foreground sm:text-lg">
            {duty.routeSummary}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="whitespace-nowrap font-mono">
              {duty.dutyStartTime} → {duty.dutyEndTime}
            </span>
            <span className="whitespace-nowrap">
              Jornada{' '}
              <span className="font-medium text-foreground">{formatDutyTime(dutyMins)}</span>
            </span>
            {duty.totalBlockHours > 0 && (
              <span className="whitespace-nowrap">
                Voo{' '}
                <span className="font-medium text-foreground">
                  {formatHoursMinutes(duty.totalBlockHours)}
                </span>
              </span>
            )}
          </div>
          <CollapsedCrewLine duty={duty} />
          {(shortSoloHint || shortRestHint) && (
            <p className="pt-1 text-[10px] font-medium text-muted-foreground">
              {[shortSoloHint, shortRestHint].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-border/60"
          >
            <DutyLegTimeline duty={duty} />
            <DutyTimelineFooter
              duty={duty}
              dutyMins={dutyMins}
              restMinutes={restMinutes}
              nextPresentationLabel={nextPresentationLabel}
            />
            <div className="border-t border-border/50 bg-muted/10 px-4 py-2.5 sm:px-5">
              <span className={`text-[11px] font-medium ${footerStatusTone[displayStatus.tone]}`}>
                {displayStatus.label}
                {displayStatus.subtitle ? ` · ${displayStatus.subtitle}` : ''}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

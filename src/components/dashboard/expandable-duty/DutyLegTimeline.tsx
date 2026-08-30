import { Plane, Clock } from 'lucide-react';
import type { DutyPeriod } from '@/lib/duty-grouping';
import { formatDutyTime } from '@/lib/duty-grouping';
import { formatHoursMinutes } from '@/lib/date-utils';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { CrewFunctionActivityBadge } from '@/components/roster/CrewFunctionActivityBadge';
import { isPresentationEntry } from '@/lib/schedule-entry-sort';
import { GroundIntervalSeparator } from './GroundIntervalSeparator';
import { FlightCrewmatesRow } from './FlightCrewmatesRow';

function CrewLegLine({ leg }: { leg: ScheduleEntry }) {
  return <CrewFunctionActivityBadge leg={leg} />;
}

interface DutyLegTimelineProps {
  duty: DutyPeriod;
}

export function DutyLegTimeline({ duty }: DutyLegTimelineProps) {
  const { legs, connectionTimes } = duty;

  return (
    <div className="space-y-0 border-t border-border/60">
      {legs.map((leg, li) => (
        <div key={leg.id}>
          {li > 0 &&
            connectionTimes[li - 1] != null &&
            connectionTimes[li - 1] > 0 && (
              <GroundIntervalSeparator
                minutes={connectionTimes[li - 1]}
                variant="solo"
              />
            )}

          <div className="px-4 py-4 sm:px-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="whitespace-nowrap rounded bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  Trecho {li + 1}/{legs.length}
                </span>
                <span className="break-words text-xs font-medium text-muted-foreground">
                  {isPresentationEntry(leg) && !leg.is_flight ? 'Apresentação' : leg.flight_number}
                </span>
              </div>
              {leg.status && (
                <span className="text-[10px] text-muted-foreground">{leg.status}</span>
              )}
            </div>

            {leg.is_flight ? (
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-[52px] text-center sm:min-w-[60px]">
                  <p className="text-lg font-bold text-foreground sm:text-xl">{leg.departure}</p>
                  <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {leg.departure_time}
                  </p>
                </div>
                <div className="mx-2 flex min-w-0 flex-1 flex-col items-center sm:mx-4">
                  <div className="relative h-px w-full bg-border">
                    <Plane className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-90 text-primary" />
                  </div>
                  {leg.flight_hours != null && leg.flight_hours > 0 && (
                    <span className="mt-1 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                      {formatHoursMinutes(leg.flight_hours)}
                    </span>
                  )}
                </div>
                <div className="min-w-[52px] text-center sm:min-w-[60px]">
                  <p className="text-lg font-bold text-foreground sm:text-xl">{leg.arrival}</p>
                  <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {leg.arrival_time}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-[52px] text-center">
                  <p className="text-lg font-bold text-foreground">{leg.departure}</p>
                  <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {leg.departure_time}
                  </p>
                </div>
                <div className="mx-2 flex min-w-0 flex-1 flex-col items-center justify-center sm:mx-4">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="mt-1 text-[10px] font-medium text-muted-foreground">
                    Atividade
                  </span>
                </div>
                <div className="min-w-[52px] text-center">
                  <p className="text-lg font-bold text-foreground">{leg.arrival}</p>
                  <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {leg.arrival_time}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3 min-w-0 border-t border-border/40 pt-3">
              <CrewLegLine leg={leg} />
              {leg.is_flight && (
                <FlightCrewmatesRow date={leg.date} flightNumber={leg.flight_number} departure={leg.departure} />
              )}
              {leg.report_time && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Apresentação no trecho:{' '}
                  <span className="font-mono font-medium text-foreground">{leg.report_time}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Bloco final: totais da jornada + descanso até a próxima apresentação (expandido). */
export function DutyTimelineFooter({
  duty,
  dutyMins,
  restMinutes,
  nextPresentationLabel,
}: {
  duty: DutyPeriod;
  dutyMins: number;
  restMinutes: number | null;
  nextPresentationLabel?: string;
}) {
  return (
    <div className="space-y-0 border-t border-border/60 bg-muted/15">
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-3 text-[11px] text-muted-foreground sm:px-5">
        <span>
          Jornada:{' '}
          <span className="font-mono font-medium text-foreground">{formatDutyTime(dutyMins)}</span>
        </span>
        <span>
          Tempo de voo:{' '}
          <span className="font-mono font-medium text-foreground">
            {formatHoursMinutes(duty.totalBlockHours)}
          </span>
        </span>
        {duty.debriefTime && (
          <span>
            Encerramento:{' '}
            <span className="font-mono font-medium text-foreground">{duty.debriefTime}</span>
          </span>
        )}
      </div>

      {restMinutes != null && restMinutes > 0 && (
        <GroundIntervalSeparator
          minutes={restMinutes}
          variant="rest"
          nextPresentationHint={nextPresentationLabel}
        />
      )}
    </div>
  );
}

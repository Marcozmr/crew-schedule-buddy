/**
 * DutyPeriodCard — Displays a single or multi-leg duty period.
 * Single leg: compact flight card.
 * Multi-leg: expanded view with route summary, individual legs, connections, and totals.
 */

import { useState } from 'react';
import { Plane, Clock, Moon, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DutyPeriod } from '@/lib/duty-grouping';
import { formatDutyTime } from '@/lib/duty-grouping';
import { formatHoursMinutes } from '@/lib/date-utils';
import type { DashboardStatusSummary } from '@/lib/operational-analysis';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import {
  crewStatusBadgeClassName,
  formatCrewRoleLabel,
  resolveCrewStatusFromFlightOperation,
} from '@/lib/roster/crew-status-labels';
import { buildCrewSituationDisplayFromEntry } from '@/lib/roster/crew-tripulante-display';
import { CrewTripulanteSummary } from '@/components/flight-board/CrewTripulanteSummary';
import { isPresentationEntry } from '@/lib/schedule-entry-sort';

function legSituationLabel(leg: ScheduleEntry): string {
  if (leg.crew_status_label?.trim()) return leg.crew_status_label;
  if (leg.is_flight && leg.operation_type) {
    return resolveCrewStatusFromFlightOperation(leg.operation_type).label;
  }
  if (leg.activity_label?.trim()) return leg.activity_label;
  return '—';
}

interface Props {
  duty: DutyPeriod;
  index: number;
  statusSummary?: DashboardStatusSummary;
}

const footerStatusTone = {
  regular: 'text-success',
  attention: 'text-warning',
  review: 'text-warning',
  critical: 'text-destructive',
} as const;

export function DutyPeriodCard({ duty, index, statusSummary }: Props) {
  const [expanded, setExpanded] = useState(duty.legCount > 1);
  const isMultiLeg = duty.legCount > 1;
  const firstLeg = duty.legs[0];
  const singlePresentationOnly = duty.legCount === 1 && !firstLeg.is_flight && isPresentationEntry(firstLeg);
  const dutyMins = Math.round(duty.totalDutyHours * 60);
  const isLongDuty = duty.totalDutyHours > 11;
  const displayStatus = statusSummary ?? {
    tone: isLongDuty ? 'attention' : 'regular',
    label: isLongDuty ? 'Atenção' : 'Regular',
    subtitle: isLongDuty ? 'Acompanhe os limites da jornada' : 'Operação dentro do esperado',
  };

  const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 + index * 0.04, duration: 0.3, ease: 'easeOut' as const },
  };

  return (
    <motion.div {...fade} className="glass hover-lift overflow-hidden min-w-0">
      <div
        className={`p-4 sm:p-5 ${isMultiLeg ? 'cursor-pointer' : ''}`}
        onClick={isMultiLeg ? () => setExpanded((value) => !value) : undefined}
      >
        <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {isMultiLeg && (
              <span className="text-[10px] font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded-md whitespace-nowrap">
                {duty.legCount} pernas
              </span>
            )}
            {!isMultiLeg && (
              <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md whitespace-nowrap">
                {singlePresentationOnly ? 'Apresentação' : duty.legs[0].flight_number}
              </span>
            )}
            {duty.crossesMidnight && (
              <span className="text-[10px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap">
                <Moon className="w-3 h-3" /> +1 dia
              </span>
            )}
            {duty.hasMadrugada && (
              <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md whitespace-nowrap">
                Madrugada
              </span>
            )}
            {isLongDuty && (
              <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap">
                <AlertTriangle className="w-3 h-3" /> Jornada longa
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {duty.reportTime && (
              <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                Apresent. {duty.reportTime}
              </span>
            )}
            {isMultiLeg && (expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
          </div>
        </div>

        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-lg lg:text-xl font-bold text-foreground tracking-tight break-words">
              {duty.routeSummary}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 min-w-0">
              <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                {duty.dutyStartTime} → {duty.dutyEndTime}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Jornada: <span className="font-mono font-medium text-foreground">{formatDutyTime(dutyMins)}</span>
              </span>
              {duty.totalBlockHours > 0 && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Tempo de voo: <span className="font-mono font-medium text-foreground">{formatHoursMinutes(duty.totalBlockHours)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {isMultiLeg && expanded && (
        <div className="border-t border-border">
          {duty.legs.map((leg, li) => (
              <div key={leg.id}>
              <div className="px-4 sm:px-5 py-4">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-[10px] font-semibold text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded whitespace-nowrap">
                      Trecho {li + 1}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground break-words">
                      {isPresentationEntry(leg) && !leg.is_flight ? 'Apresentação' : leg.flight_number}
                    </span>
                  </div>
                  {leg.crosses_midnight && <span className="text-[9px] text-warning font-medium whitespace-nowrap">+1 dia</span>}
                </div>

                {leg.is_flight ? (
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="text-center min-w-[52px] sm:min-w-[60px]">
                    <p className="text-lg sm:text-xl font-bold text-foreground break-words">{leg.departure}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5 whitespace-nowrap">{leg.departure_time}</p>
                  </div>
                  <div className="flex-1 min-w-0 mx-2 sm:mx-4 flex flex-col items-center">
                    <div className="w-full h-px bg-border relative">
                      <Plane className="w-3.5 h-3.5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
                    </div>
                    {leg.flight_hours != null && leg.flight_hours > 0 && (
                      <span className="text-[10px] text-muted-foreground mt-1 font-mono whitespace-nowrap">
                        {formatHoursMinutes(leg.flight_hours)}
                      </span>
                    )}
                  </div>
                  <div className="text-center min-w-[52px] sm:min-w-[60px]">
                    <p className="text-lg sm:text-xl font-bold text-foreground break-words">{leg.arrival}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5 whitespace-nowrap">{leg.arrival_time}</p>
                  </div>
                </div>
                ) : (
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="text-center min-w-[52px] sm:min-w-[60px]">
                    <p className="text-lg sm:text-xl font-bold text-foreground break-words">{leg.departure}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5 whitespace-nowrap">{leg.departure_time}</p>
                  </div>
                  <div className="flex-1 min-w-0 mx-2 sm:mx-4 flex flex-col items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-[10px] text-muted-foreground mt-1 font-medium">Apresentação</span>
                  </div>
                  <div className="text-center min-w-[52px] sm:min-w-[60px]">
                    <p className="text-lg sm:text-xl font-bold text-foreground break-words">{leg.arrival}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5 whitespace-nowrap">{leg.arrival_time}</p>
                  </div>
                </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {(() => {
                    const tripCrew = leg.is_flight ? buildCrewSituationDisplayFromEntry(leg) : null;
                    return tripCrew ? (
                      <CrewTripulanteSummary crew={tripCrew} />
                    ) : (
                      <>
                        <span className="whitespace-nowrap">Situação:</span>
                        <span className={crewStatusBadgeClassName(legSituationLabel(leg))}>{legSituationLabel(leg)}</span>
                        {leg.crew_role && (
                          <>
                            <span className="text-border">·</span>
                            <span className="whitespace-nowrap">Função:</span>
                            <span className="font-medium text-foreground">{formatCrewRoleLabel(leg.crew_role)}</span>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {li < duty.legs.length - 1 && duty.connectionTimes[li] != null && (
                <div className="px-4 sm:px-5 py-2 bg-secondary/50 flex items-center justify-center gap-2 min-w-0">
                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground font-medium break-words text-center">
                    Conexão: {formatDutyTime(duty.connectionTimes[li])}
                  </span>
                </div>
              )}
            </div>
          ))}

          <div className="px-4 sm:px-5 py-3 bg-secondary/30 border-t border-border">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground min-w-0">
              <span>
                Jornada total: <span className="font-mono font-medium text-foreground">{formatDutyTime(dutyMins)}</span>
              </span>
              <span>
                Tempo de voo: <span className="font-mono font-medium text-foreground">{formatHoursMinutes(duty.totalBlockHours)}</span>
              </span>
              {duty.debriefTime && (
                <span>
                  Término da jornada: <span className="font-mono font-medium text-foreground">{duty.debriefTime}</span>
                </span>
              )}
              <span className={`font-medium ${footerStatusTone[displayStatus.tone]}`}>
                {displayStatus.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {!isMultiLeg && singlePresentationOnly && (
        <div className="px-4 sm:px-5 pb-5">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="text-center min-w-[52px]">
              <p className="text-2xl lg:text-3xl font-bold text-foreground break-words">{duty.legs[0].departure}</p>
              <p className="text-xs font-mono text-muted-foreground mt-1 whitespace-nowrap">{duty.legs[0].departure_time}</p>
            </div>
            <div className="flex-1 min-w-0 mx-3 sm:mx-4 flex flex-col items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-[10px] text-muted-foreground mt-1 font-medium">Apresentação</span>
            </div>
            <div className="text-center min-w-[52px]">
              <p className="text-2xl lg:text-3xl font-bold text-foreground break-words">{duty.legs[0].arrival}</p>
              <p className="text-xs font-mono text-muted-foreground mt-1 whitespace-nowrap">{duty.legs[0].arrival_time}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {(() => {
              const leg0 = duty.legs[0];
              const tripCrew = leg0.is_flight ? buildCrewSituationDisplayFromEntry(leg0) : null;
              return tripCrew ? (
                <CrewTripulanteSummary crew={tripCrew} />
              ) : (
                <>
                  <span className="whitespace-nowrap">Situação:</span>
                  <span className={crewStatusBadgeClassName(legSituationLabel(leg0))}>
                    {legSituationLabel(leg0)}
                  </span>
                  {leg0.crew_role && (
                    <>
                      <span className="text-border">·</span>
                      <span className="whitespace-nowrap">Função:</span>
                      <span className="font-medium text-foreground">{formatCrewRoleLabel(leg0.crew_role)}</span>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {!isMultiLeg && !singlePresentationOnly && (
        <div className="px-4 sm:px-5 pb-5">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="text-center min-w-[52px]">
              <p className="text-2xl lg:text-3xl font-bold text-foreground break-words">{duty.legs[0].departure}</p>
              <p className="text-xs font-mono text-muted-foreground mt-1 whitespace-nowrap">{duty.legs[0].departure_time}</p>
            </div>
            <div className="flex-1 min-w-0 mx-3 sm:mx-4 flex flex-col items-center">
              <div className="w-full h-px bg-border relative">
                <Plane className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
              </div>
              {duty.crossesMidnight && <span className="text-[9px] text-warning font-medium mt-1 whitespace-nowrap">+1 dia</span>}
            </div>
            <div className="text-center min-w-[52px]">
              <p className="text-2xl lg:text-3xl font-bold text-foreground break-words">{duty.legs[0].arrival}</p>
              <p className="text-xs font-mono text-muted-foreground mt-1 whitespace-nowrap">{duty.legs[0].arrival_time}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {(() => {
              const leg0 = duty.legs[0];
              const tripCrew = leg0.is_flight ? buildCrewSituationDisplayFromEntry(leg0) : null;
              return tripCrew ? (
                <CrewTripulanteSummary crew={tripCrew} />
              ) : (
                <>
                  <span className="whitespace-nowrap">Situação:</span>
                  <span className={crewStatusBadgeClassName(legSituationLabel(leg0))}>
                    {legSituationLabel(leg0)}
                  </span>
                  {leg0.crew_role && (
                    <>
                      <span className="text-border">·</span>
                      <span className="whitespace-nowrap">Função:</span>
                      <span className="font-medium text-foreground">{formatCrewRoleLabel(leg0.crew_role)}</span>
                    </>
                  )}
                </>
              );
            })()}
          </div>
          {(duty.totalBlockHours > 0 || duty.totalDutyHours > 0) && (
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border min-w-0">
              {duty.totalBlockHours > 0 && (
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  Tempo de voo: <span className="font-mono font-medium text-foreground">{formatHoursMinutes(duty.totalBlockHours)}</span>
                </span>
              )}
              {duty.totalDutyHours > 0 && (
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  Jornada: <span className="font-mono font-medium text-foreground">{formatDutyTime(dutyMins)}</span>
                </span>
              )}
              <span className={`text-[11px] font-medium ${footerStatusTone[displayStatus.tone]}`}>
                {displayStatus.label}
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

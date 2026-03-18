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
import type { DashboardStatusSummary } from '@/lib/operational-analysis';

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
    <motion.div {...fade} className="glass hover-lift overflow-hidden">
      {/* ── Header ── */}
      <div
        className={`p-5 ${isMultiLeg ? 'cursor-pointer' : ''}`}
        onClick={isMultiLeg ? () => setExpanded(v => !v) : undefined}
      >
        {/* Top row: badges */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isMultiLeg && (
              <span className="text-[10px] font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded-md">
                {duty.legCount} pernas
              </span>
            )}
            {!isMultiLeg && (
              <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                {duty.legs[0].flight_number}
              </span>
            )}
            {duty.crossesMidnight && (
              <span className="text-[10px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Moon className="w-3 h-3" /> +1 dia
              </span>
            )}
            {duty.hasMadrugada && (
              <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                Madrugada
              </span>
            )}
            {isLongDuty && (
              <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Jornada longa
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {duty.reportTime && (
              <span className="text-[10px] font-mono text-muted-foreground">
                APR {duty.reportTime}
              </span>
            )}
            {isMultiLeg && (
              expanded
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Route summary */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-lg lg:text-xl font-bold text-foreground tracking-tight">
              {duty.routeSummary}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs font-mono text-muted-foreground">
                {duty.dutyStartTime} → {duty.dutyEndTime}
              </span>
              <span className="text-xs text-muted-foreground">
                Jornada: <span className="font-mono font-medium text-foreground">{formatDutyTime(dutyMins)}</span>
              </span>
              {duty.totalBlockHours > 0 && (
                <span className="text-xs text-muted-foreground">
                  Block: <span className="font-mono font-medium text-foreground">{duty.totalBlockHours.toFixed(1)}h</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Expanded: Individual legs ── */}
      {isMultiLeg && expanded && (
        <div className="border-t border-border">
          {duty.legs.map((leg, li) => (
            <div key={leg.id}>
              <div className="px-5 py-4">
                {/* Leg header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded">
                      Trecho {li + 1}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {leg.flight_number}
                    </span>
                  </div>
                  {leg.crosses_midnight && (
                    <span className="text-[9px] text-warning font-medium">+1 dia</span>
                  )}
                </div>

                {/* Route visualization */}
                <div className="flex items-center justify-between">
                  <div className="text-center min-w-[60px]">
                    <p className="text-xl font-bold text-foreground">{leg.departure}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{leg.departure_time}</p>
                  </div>
                  <div className="flex-1 mx-4 flex flex-col items-center">
                    <div className="w-full h-px bg-border relative">
                      <Plane className="w-3.5 h-3.5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
                    </div>
                    {leg.flight_hours != null && leg.flight_hours > 0 && (
                      <span className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {leg.flight_hours.toFixed(1)}h
                      </span>
                    )}
                  </div>
                  <div className="text-center min-w-[60px]">
                    <p className="text-xl font-bold text-foreground">{leg.arrival}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{leg.arrival_time}</p>
                  </div>
                </div>
              </div>

              {/* Connection time between legs */}
              {li < duty.legs.length - 1 && duty.connectionTimes[li] != null && (
                <div className="px-5 py-2 bg-secondary/50 flex items-center justify-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Conexão: {formatDutyTime(duty.connectionTimes[li])}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* ── Duty summary footer ── */}
          <div className="px-5 py-3 bg-secondary/30 border-t border-border">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Jornada total: <span className="font-mono font-medium text-foreground">{formatDutyTime(dutyMins)}</span>
              </span>
              <span>
                Block total: <span className="font-mono font-medium text-foreground">{duty.totalBlockHours.toFixed(1)}h</span>
              </span>
              {duty.debriefTime && (
                <span>
                  Debrief: <span className="font-mono font-medium text-foreground">{duty.debriefTime}</span>
                </span>
              )}
              <span className={`font-medium ${footerStatusTone[displayStatus.tone]}`}>
                {displayStatus.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Single leg: inline meta ── */}
      {!isMultiLeg && (
        <div className="px-5 pb-5">
          {/* Route visualization */}
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-2xl lg:text-3xl font-bold text-foreground">{duty.legs[0].departure}</p>
              <p className="text-xs font-mono text-muted-foreground mt-1">{duty.legs[0].departure_time}</p>
            </div>
            <div className="flex-1 mx-4 flex flex-col items-center">
              <div className="w-full h-px bg-border relative">
                <Plane className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
              </div>
              {duty.crossesMidnight && (
                <span className="text-[9px] text-warning font-medium mt-1">+1 dia</span>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl lg:text-3xl font-bold text-foreground">{duty.legs[0].arrival}</p>
              <p className="text-xs font-mono text-muted-foreground mt-1">{duty.legs[0].arrival_time}</p>
            </div>
          </div>
          {/* Meta */}
          {(duty.totalBlockHours > 0 || duty.totalDutyHours > 0) && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
              {duty.totalBlockHours > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Voo: <span className="font-mono font-medium text-foreground">{duty.totalBlockHours.toFixed(1)}h</span>
                </span>
              )}
              {duty.totalDutyHours > 0 && (
                <span className="text-[11px] text-muted-foreground">
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

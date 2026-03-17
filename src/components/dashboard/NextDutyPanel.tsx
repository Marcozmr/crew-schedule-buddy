/**
 * EFB Dashboard — Next Duty Panel (HERO component)
 * The primary visual element of the dashboard. Large, prominent, data-rich.
 */

import { useMemo } from 'react';
import { Plane, Clock, BedDouble, Activity, Shield, ChevronRight, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { formatDateBR, formatTimeBR, parseDateBRT } from '@/lib/date-utils';

interface NextDutyPanelProps {
  schedule: ScheduleEntry[];
}

interface DutyInfo {
  entry: ScheduleEntry;
  reportTime: string;
  dutyHours: number;
  dutyLimit: number;
  restHours: number | null;
  fatigueLevel: 'BAIXA' | 'MODERADA' | 'ALTA';
  complianceStatus: 'REGULAMENTADO' | 'ATENÇÃO' | 'IRREGULAR';
  dateFormatted: string;
  flightNumber: string;
  depCode: string;
  arrCode: string;
  arrTime: string;
}

function computeNextDuty(schedule: ScheduleEntry[]): DutyInfo | null {
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const flights = schedule.filter(e => e.is_flight);
  const sorted = [...flights].sort((a, b) => parseDateBRT(a.date).getTime() - parseDateBRT(b.date).getTime());
  const next = sorted.find(e => parseDateBRT(e.date).getTime() >= todayMs);
  if (!next) return null;

  const dutyH = next.duty_hours ?? 0;
  const restH = findRestBefore(next, sorted);
  const reportHour = parseInt((next.report_time || next.departure_time || '08:00').split(':')[0]);
  
  let fatigueLevel: DutyInfo['fatigueLevel'] = 'BAIXA';
  if (reportHour < 6 || dutyH > 10) fatigueLevel = 'ALTA';
  else if (reportHour < 7 || dutyH > 8) fatigueLevel = 'MODERADA';

  let complianceStatus: DutyInfo['complianceStatus'] = 'REGULAMENTADO';
  if (dutyH > 12 || (restH !== null && restH < 12)) complianceStatus = 'IRREGULAR';
  else if (dutyH > 10 || (restH !== null && restH < 13)) complianceStatus = 'ATENÇÃO';

  return {
    entry: next,
    reportTime: formatTimeBR(next.report_time || next.departure_time),
    dutyHours: dutyH,
    dutyLimit: 11,
    restHours: restH,
    fatigueLevel,
    complianceStatus,
    dateFormatted: formatDateBR(next.date),
    flightNumber: next.flight_number,
    depCode: (next.departure_airport || next.departure || '---').substring(0, 3).toUpperCase(),
    arrCode: (next.arrival_airport || next.arrival || '---').substring(0, 3).toUpperCase(),
    arrTime: formatTimeBR(next.arrival_time),
  };
}

function findRestBefore(entry: ScheduleEntry, sorted: ScheduleEntry[]): number | null {
  const idx = sorted.indexOf(entry);
  if (idx <= 0) return null;
  const prev = sorted[idx - 1];
  const prevArr = prev.arrival_time || '18:00';
  const currDep = entry.report_time || entry.departure_time || '06:00';
  const [ph, pm] = prevArr.split(':').map(Number);
  const [ch, cm] = currDep.split(':').map(Number);
  const prevDateMs = parseDateBRT(prev.date).getTime();
  const currDateMs = parseDateBRT(entry.date).getTime();
  const dayDiffH = (currDateMs - prevDateMs) / 3600000;
  const rest = dayDiffH + (ch + cm / 60) - (ph + pm / 60);
  return Math.round(rest * 10) / 10;
}

const complianceStyles = {
  'REGULAMENTADO': { badge: 'bg-success/15 border-success/30 text-success', dot: 'bg-success' },
  'ATENÇÃO': { badge: 'bg-warning/15 border-warning/30 text-warning', dot: 'bg-warning status-pulse' },
  'IRREGULAR': { badge: 'bg-destructive/15 border-destructive/30 text-destructive', dot: 'bg-destructive status-pulse' },
};

const fatigueStyles = {
  'BAIXA': { color: 'text-success', bg: 'bg-success/15', barWidth: '33%' },
  'MODERADA': { color: 'text-warning', bg: 'bg-warning/15', barWidth: '66%' },
  'ALTA': { color: 'text-destructive', bg: 'bg-destructive/15', barWidth: '100%' },
};

export function NextDutyPanel({ schedule }: NextDutyPanelProps) {
  const duty = useMemo(() => computeNextDuty(schedule), [schedule]);

  if (!duty) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 text-center">
        <Plane className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium text-muted-foreground">Nenhuma jornada programada</p>
      </motion.div>
    );
  }

  const cStyle = complianceStyles[duty.complianceStatus];
  const fStyle = fatigueStyles[duty.fatigueLevel];
  const dutyPct = Math.min((duty.dutyHours / duty.dutyLimit) * 100, 100);
  const restPct = duty.restHours !== null ? Math.min((duty.restHours / 12) * 100, 100) : 100;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl overflow-hidden shadow-glow-blue">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg gradient-sky flex items-center justify-center">
            <Plane className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Próxima Jornada</p>
            <p className="text-[10px] text-efb-text-dim font-mono">{duty.dateFormatted}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${cStyle.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cStyle.dot}`} />
          {duty.complianceStatus}
        </div>
      </div>

      {/* Route — BIG visual */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="text-center min-w-[60px]">
            <p className="text-3xl font-black font-mono text-foreground tracking-tighter leading-none">{duty.depCode}</p>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">{duty.reportTime}</p>
          </div>
          
          <div className="flex-1 flex flex-col items-center gap-1.5 px-2">
            <div className="w-full flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="h-px flex-1 bg-gradient-to-r from-primary via-primary/40 to-primary" />
              <div className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                <span className="text-[10px] font-bold font-mono text-primary">{duty.flightNumber}</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-primary via-primary/40 to-primary" />
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>
          </div>

          <div className="text-center min-w-[60px]">
            <p className="text-3xl font-black font-mono text-foreground tracking-tighter leading-none">{duty.arrCode}</p>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">{duty.arrTime}</p>
          </div>
        </div>
      </div>

      {/* Data bars — horizontal indicators */}
      <div className="px-5 pb-5 space-y-3">
        {/* Duty hours bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Jornada</span>
            </div>
            <span className="text-xs font-bold font-mono text-foreground">{duty.dutyHours}h <span className="text-muted-foreground font-normal">/ {duty.dutyLimit}h</span></span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${dutyPct > 90 ? 'bg-destructive' : dutyPct > 75 ? 'bg-warning' : 'bg-primary'}`}
              initial={{ width: 0 }}
              animate={{ width: `${dutyPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Rest bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <BedDouble className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descanso</span>
            </div>
            <span className="text-xs font-bold font-mono text-foreground">
              {duty.restHours !== null ? `${duty.restHours}h` : '—'} <span className="text-muted-foreground font-normal">/ 12h mín</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${duty.restHours !== null && duty.restHours < 12 ? 'bg-destructive' : duty.restHours !== null && duty.restHours < 13 ? 'bg-warning' : 'bg-success'}`}
              initial={{ width: 0 }}
              animate={{ width: `${restPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
        </div>

        {/* Fatigue indicator */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fadiga</span>
            </div>
            <span className={`text-xs font-bold ${fStyle.color}`}>{duty.fatigueLevel}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${duty.fatigueLevel === 'ALTA' ? 'bg-destructive' : duty.fatigueLevel === 'MODERADA' ? 'bg-warning' : 'bg-success'}`}
              initial={{ width: 0 }}
              animate={{ width: fStyle.barWidth }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <Link to="/schedule" className="flex items-center justify-between px-5 py-2.5 border-t border-border/40 hover:bg-secondary/30 transition-colors">
        <span className="text-[10px] font-medium text-muted-foreground">Ver escala completa</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </Link>
    </motion.div>
  );
}

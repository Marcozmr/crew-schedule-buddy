/**
 * EFB Dashboard — Next Duty Panel
 * Shows the crew member's next upcoming duty with key operational data.
 */

import { useMemo } from 'react';
import { Plane, Clock, BedDouble, Activity, Shield, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { formatDateBR, formatTimeBR, parseDateBRT } from '@/lib/date-utils';

interface NextDutyPanelProps {
  schedule: ScheduleEntry[];
}

interface DutyInfo {
  entry: ScheduleEntry;
  route: string;
  reportTime: string;
  dutyHours: string;
  dutyLimit: string;
  restHours: string | null;
  fatigueLevel: 'BAIXA' | 'MODERADA' | 'ALTA';
  complianceStatus: 'REGULAMENTADO' | 'ATENÇÃO' | 'IRREGULAR';
  dateFormatted: string;
  flightNumber: string;
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

  // Simple fatigue heuristic
  const reportHour = parseInt((next.report_time || next.departure_time || '08:00').split(':')[0]);
  let fatigueLevel: DutyInfo['fatigueLevel'] = 'BAIXA';
  if (reportHour < 6 || dutyH > 10) fatigueLevel = 'ALTA';
  else if (reportHour < 7 || dutyH > 8) fatigueLevel = 'MODERADA';

  let complianceStatus: DutyInfo['complianceStatus'] = 'REGULAMENTADO';
  if (dutyH > 12 || (restH !== null && restH < 12)) complianceStatus = 'IRREGULAR';
  else if (dutyH > 10 || (restH !== null && restH < 13)) complianceStatus = 'ATENÇÃO';

  return {
    entry: next,
    route: `${next.departure_airport || next.departure} → ${next.arrival_airport || next.arrival}`,
    reportTime: formatTimeBR(next.report_time || next.departure_time),
    dutyHours: dutyH ? `${dutyH}h` : '—',
    dutyLimit: '11h', // simplified
    restHours: restH !== null ? `${restH}h` : null,
    fatigueLevel,
    complianceStatus,
    dateFormatted: formatDateBR(next.date),
    flightNumber: next.flight_number,
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

const statusColors = {
  REGULAMENTADO: 'text-success',
  'ATENÇÃO': 'text-warning',
  IRREGULAR: 'text-destructive',
};

const statusBgColors = {
  REGULAMENTADO: 'bg-success/10 border-success/30',
  'ATENÇÃO': 'bg-warning/10 border-warning/30',
  IRREGULAR: 'bg-destructive/10 border-destructive/30',
};

const fatigueColors = {
  BAIXA: 'text-success',
  MODERADA: 'text-warning',
  ALTA: 'text-destructive',
};

const fatigueBg = {
  BAIXA: 'bg-success/15',
  MODERADA: 'bg-warning/15',
  ALTA: 'bg-destructive/15',
};

export function NextDutyPanel({ schedule }: NextDutyPanelProps) {
  const duty = useMemo(() => computeNextDuty(schedule), [schedule]);

  if (!duty) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl gradient-sky flex items-center justify-center shadow-glow-blue">
            <Plane className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Próxima Jornada</p>
            <p className="text-sm text-foreground">Nenhuma jornada programada</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-sky flex items-center justify-center shadow-glow-blue">
            <Plane className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Próxima Jornada</p>
            <p className="text-xs text-efb-text-dim">{duty.dateFormatted}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${statusBgColors[duty.complianceStatus]} ${statusColors[duty.complianceStatus]}`}>
          {duty.complianceStatus}
        </div>
      </div>

      {/* Main route display */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="text-center">
            <p className="text-2xl font-bold font-mono text-foreground tracking-tight">{(duty.entry.departure_airport || duty.entry.departure).substring(0, 3)}</p>
            <p className="text-[10px] text-muted-foreground uppercase">{duty.reportTime}</p>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-primary/60 to-transparent" />
            <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-[11px] font-bold font-mono text-primary">{duty.flightNumber}</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-primary/60 to-transparent" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold font-mono text-foreground tracking-tight">{(duty.entry.arrival_airport || duty.entry.arrival).substring(0, 3)}</p>
            <p className="text-[10px] text-muted-foreground uppercase">{formatTimeBR(duty.entry.arrival_time)}</p>
          </div>
        </div>

        {/* Data grid */}
        <div className="grid grid-cols-4 gap-3">
          <DataCell icon={Clock} label="Apresentação" value={duty.reportTime} highlight />
          <DataCell icon={Clock} label="Jornada" value={`${duty.dutyHours} / ${duty.dutyLimit}`} />
          <DataCell icon={BedDouble} label="Descanso" value={duty.restHours ? `${duty.restHours} / 12h` : '—'} />
          <div className="rounded-xl p-3 bg-secondary/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Fadiga</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${fatigueBg[duty.fatigueLevel]} ${fatigueColors[duty.fatigueLevel]} status-pulse`} />
              <span className={`text-sm font-bold ${fatigueColors[duty.fatigueLevel]}`}>{duty.fatigueLevel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer link */}
      <Link to="/schedule" className="flex items-center justify-between px-5 py-3 border-t border-border/50 hover:bg-secondary/30 transition-colors">
        <span className="text-xs font-medium text-muted-foreground">Ver escala completa</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>
    </motion.div>
  );
}

function DataCell({ icon: Icon, label, value, highlight }: { icon: React.ElementType; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={`text-sm font-bold font-mono ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

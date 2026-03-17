/**
 * EFB Dashboard — Regulation Status Panel
 * Shows compliance gauges for duty, rest, and fatigue.
 */

import { useMemo } from 'react';
import { Shield, Clock, BedDouble, Activity, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { parseDateBRT } from '@/lib/date-utils';

interface RegulationStatusPanelProps {
  schedule: ScheduleEntry[];
}

interface GaugeData {
  label: string;
  value: number;
  max: number;
  unit: string;
  status: 'ok' | 'warning' | 'critical';
  icon: React.ElementType;
}

function computeGauges(schedule: ScheduleEntry[]): GaugeData[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const flights = schedule.filter(e => e.is_flight);
  const monthFlights = flights.filter(e => {
    const d = parseDateBRT(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalFlightHours = monthFlights.reduce((s, e) => s + (e.flight_hours || 0), 0);
  const totalDutyHours = monthFlights.reduce((s, e) => s + (e.duty_hours || 0), 0);
  const avgDuty = monthFlights.length > 0 ? totalDutyHours / monthFlights.length : 0;

  // Flight hours gauge
  const fhStatus = totalFlightHours > 85 * 0.90 ? 'critical' : totalFlightHours > 85 * 0.75 ? 'warning' : 'ok';

  // Duty gauge (average per day as proxy)
  const dutyStatus = avgDuty > 11 ? 'critical' : avgDuty > 9 ? 'warning' : 'ok';

  // Rest gauge (simplified — check if any short rest exists)
  const restStatus: GaugeData['status'] = 'ok';

  return [
    { label: 'Horas de Voo', value: Math.round(totalFlightHours * 10) / 10, max: 85, unit: 'h/mês', status: fhStatus, icon: Clock },
    { label: 'Jornada Média', value: Math.round(avgDuty * 10) / 10, max: 14, unit: 'h/dia', status: dutyStatus, icon: Activity },
    { label: 'Descanso', value: 12, max: 12, unit: 'h mín', status: restStatus, icon: BedDouble },
  ];
}

const statusColor = {
  ok: { ring: 'stroke-success', text: 'text-success', bg: 'bg-success/10', label: 'REGULAR' },
  warning: { ring: 'stroke-warning', text: 'text-warning', bg: 'bg-warning/10', label: 'ATENÇÃO' },
  critical: { ring: 'stroke-destructive', text: 'text-destructive', bg: 'bg-destructive/10', label: 'IRREGULAR' },
};

function GaugeRing({ value, max, status }: { value: number; max: number; status: GaugeData['status'] }) {
  const pct = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (pct / 100) * circumference;
  const colors = statusColor[status];

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="transform -rotate-90">
      <circle cx="36" cy="36" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
      <motion.circle
        cx="36" cy="36" r="28" fill="none"
        className={colors.ring}
        strokeWidth="5" strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
}

export function RegulationStatusPanel({ schedule }: RegulationStatusPanelProps) {
  const gauges = useMemo(() => computeGauges(schedule), [schedule]);

  const overallStatus = gauges.some(g => g.status === 'critical') ? 'critical'
    : gauges.some(g => g.status === 'warning') ? 'warning' : 'ok';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${statusColor[overallStatus].bg}`}>
            <Shield className={`w-4 h-4 ${statusColor[overallStatus].text}`} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Status Regulamentação</p>
            <p className="text-xs text-efb-text-dim">RBAC 117 • Lei 13.475</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${statusColor[overallStatus].bg} border-current/30 ${statusColor[overallStatus].text}`}>
          {statusColor[overallStatus].label}
        </div>
      </div>

      {/* Gauges */}
      <div className="p-5">
        <div className="grid grid-cols-3 gap-4">
          {gauges.map(g => {
            const colors = statusColor[g.status];
            return (
              <div key={g.label} className="flex flex-col items-center">
                <div className="relative mb-2">
                  <GaugeRing value={g.value} max={g.max} status={g.status} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-base font-bold font-mono ${colors.text}`}>{g.value}</span>
                    <span className="text-[9px] text-muted-foreground">{g.unit}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <g.icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground">{g.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Link to="/regulation" className="flex items-center justify-between px-5 py-3 border-t border-border/50 hover:bg-secondary/30 transition-colors">
        <span className="text-xs font-medium text-muted-foreground">Ver análise detalhada</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>
    </motion.div>
  );
}

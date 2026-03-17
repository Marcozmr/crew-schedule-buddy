/**
 * EFB Dashboard — Regulation Status Panel
 * Clean horizontal bar indicators (no gauges). Subtle, professional.
 */

import { useMemo } from 'react';
import { Shield, Clock, BedDouble, Activity, Plane, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { parseDateBRT } from '@/lib/date-utils';

interface RegulationStatusPanelProps {
  schedule: ScheduleEntry[];
}

interface Indicator {
  label: string;
  value: number;
  max: number;
  unit: string;
  status: 'ok' | 'warning' | 'critical';
  icon: React.ElementType;
}

function computeIndicators(schedule: ScheduleEntry[]): Indicator[] {
  const now = new Date();
  const cm = now.getMonth();
  const cy = now.getFullYear();
  const flights = schedule.filter(e => e.is_flight);
  const month = flights.filter(e => {
    const d = parseDateBRT(e.date);
    return d.getMonth() === cm && d.getFullYear() === cy;
  });
  const fh = month.reduce((s, e) => s + (e.flight_hours || 0), 0);
  const dh = month.reduce((s, e) => s + (e.duty_hours || 0), 0);
  const avgDuty = month.length > 0 ? dh / month.length : 0;

  const fhRound = Math.round(fh * 10) / 10;
  const fhStatus = fhRound > 85 * 0.90 ? 'critical' : fhRound > 85 * 0.75 ? 'warning' : 'ok';
  const dutyStatus = avgDuty > 11 ? 'critical' : avgDuty > 9 ? 'warning' : 'ok';

  return [
    { label: 'Horas de Voo', value: fhRound, max: 85, unit: 'h / 85h', status: fhStatus as Indicator['status'], icon: Plane },
    { label: 'Jornada Média', value: Math.round(avgDuty * 10) / 10, max: 14, unit: 'h / 14h', status: dutyStatus as Indicator['status'], icon: Clock },
    { label: 'Descanso Mínimo', value: 12, max: 12, unit: 'h (mínimo)', status: 'ok', icon: BedDouble },
  ];
}

const statusMeta = {
  ok: { color: 'bg-success', text: 'text-success', label: 'REGULAR', badge: 'bg-success/15 border-success/30 text-success' },
  warning: { color: 'bg-warning', text: 'text-warning', label: 'ATENÇÃO', badge: 'bg-warning/15 border-warning/30 text-warning' },
  critical: { color: 'bg-destructive', text: 'text-destructive', label: 'IRREGULAR', badge: 'bg-destructive/15 border-destructive/30 text-destructive' },
};

export function RegulationStatusPanel({ schedule }: RegulationStatusPanelProps) {
  const indicators = useMemo(() => computeIndicators(schedule), [schedule]);
  const overall = indicators.some(i => i.status === 'critical') ? 'critical'
    : indicators.some(i => i.status === 'warning') ? 'warning' : 'ok';
  const meta = statusMeta[overall];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${statusMeta[overall].color}/15 flex items-center justify-center`} style={{ background: `hsl(var(--${overall === 'ok' ? 'success' : overall === 'warning' ? 'warning' : 'destructive'}) / 0.15)` }}>
            <Shield className={`w-4 h-4 ${meta.text}`} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Regulamentação</p>
            <p className="text-[10px] text-efb-text-dim">RBAC 117 • Lei 13.475</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}>
          {meta.label}
        </div>
      </div>

      {/* Horizontal bar indicators */}
      <div className="px-5 py-4 space-y-3">
        {indicators.map((ind, i) => {
          const pct = Math.min((ind.value / ind.max) * 100, 100);
          const sm = statusMeta[ind.status];
          return (
            <div key={ind.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <ind.icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{ind.label}</span>
                </div>
                <span className="text-xs font-bold font-mono text-foreground">{ind.value}<span className="text-muted-foreground font-normal text-[10px]"> {ind.unit}</span></span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${sm.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 + i * 0.1 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/regulation" className="flex items-center justify-between px-5 py-2.5 border-t border-border/40 hover:bg-secondary/30 transition-colors">
        <span className="text-[10px] font-medium text-muted-foreground">Ver análise detalhada</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </Link>
    </motion.div>
  );
}

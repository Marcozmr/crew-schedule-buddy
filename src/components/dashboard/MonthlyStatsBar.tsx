/**
 * EFB Dashboard — Monthly Stats Bar
 * Compact strip of key monthly metrics.
 */

import { useMemo } from 'react';
import { Plane, Clock, Coffee, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { parseDateBRT } from '@/lib/date-utils';

interface MonthlyStatsBarProps {
  schedule: ScheduleEntry[];
}

export function MonthlyStatsBar({ schedule }: MonthlyStatsBarProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const cm = now.getMonth();
    const cy = now.getFullYear();
    const dim = new Date(cy, cm + 1, 0).getDate();
    const flights = schedule.filter(e => e.is_flight);
    const month = flights.filter(e => {
      const d = parseDateBRT(e.date);
      return d.getMonth() === cm && d.getFullYear() === cy;
    });
    const fh = month.reduce((s, e) => s + (e.flight_hours || 0), 0);
    const flightDays = new Set(month.map(e => e.date)).size;
    return {
      flights: month.length,
      hours: Math.round(fh * 10) / 10,
      maxHours: 85,
      daysOff: dim - flightDays,
      flightDays,
      pct: Math.min((fh / 85) * 100, 100),
    };
  }, [schedule]);

  const items = [
    { icon: Plane, label: 'Voos', value: stats.flights.toString(), sub: '' },
    { icon: Clock, label: 'Horas', value: `${stats.hours}`, sub: `/${stats.maxHours}h` },
    { icon: TrendingUp, label: 'Dias Voo', value: stats.flightDays.toString(), sub: '' },
    { icon: Coffee, label: 'Folgas', value: stats.daysOff.toString(), sub: '' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-2xl overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 w-full bg-secondary">
        <motion.div
          className={`h-full rounded-r-full ${stats.pct > 90 ? 'bg-destructive' : stats.pct > 75 ? 'bg-warning' : 'bg-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${stats.pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      <div className="grid grid-cols-4 divide-x divide-border/50">
        {items.map(item => (
          <div key={item.label} className="p-3 text-center">
            <item.icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
            <p className="text-base font-bold font-mono text-foreground leading-none">
              {item.value}
              {item.sub && <span className="text-[10px] text-muted-foreground font-normal">{item.sub}</span>}
            </p>
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

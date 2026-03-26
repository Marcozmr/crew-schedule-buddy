/**
 * EFB Dashboard — Operational Panel
 * Airport info, flight status, weather. Clean horizontal layout.
 */

import { useMemo } from 'react';
import { MapPin, Cloud, Wind, Thermometer, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { parseDateBRT } from '@/lib/date-utils';

interface OperationalPanelProps {
  schedule: ScheduleEntry[];
  airline?: string | null;
}

type FlightStatus = 'NO HORÁRIO' | 'EMBARQUE' | 'ÚLTIMA CHAMADA' | 'ATRASADO' | 'DECOLADO';

const statusStyles: Record<FlightStatus, { bg: string; text: string; dot: string }> = {
  'NO HORÁRIO': { bg: 'bg-success/15 border-success/30', text: 'text-success', dot: 'bg-success' },
  'EMBARQUE': { bg: 'bg-primary/15 border-primary/30', text: 'text-primary', dot: 'bg-primary status-pulse' },
  'ÚLTIMA CHAMADA': { bg: 'bg-warning/15 border-warning/30', text: 'text-warning', dot: 'bg-warning status-pulse' },
  'ATRASADO': { bg: 'bg-destructive/15 border-destructive/30', text: 'text-destructive', dot: 'bg-destructive' },
  'DECOLADO': { bg: 'bg-muted border-border', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

function inferAirport(schedule: ScheduleEntry[]): string {
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const flights = [...schedule.filter(e => e.is_flight)].sort((a, b) => parseDateBRT(a.date).getTime() - parseDateBRT(b.date).getTime());
  
  const today = flights.find(e => parseDateBRT(e.date).getTime() === todayMs);
  if (today) return (today.departure_airport || today.departure || 'GRU').substring(0, 3).toUpperCase();
  
  const past = flights.filter(e => parseDateBRT(e.date).getTime() < todayMs);
  if (past.length > 0) return (past[past.length - 1].arrival_airport || past[past.length - 1].arrival || 'GRU').substring(0, 3).toUpperCase();
  
  const future = flights.find(e => parseDateBRT(e.date).getTime() > todayMs);
  if (future) return (future.departure_airport || future.departure || 'GRU').substring(0, 3).toUpperCase();
  
  return 'GRU';
}

export function OperationalPanel({ schedule, airline }: OperationalPanelProps) {
  const airport = useMemo(() => inferAirport(schedule), [schedule]);
  const status: FlightStatus = 'NO HORÁRIO';
  const s = statusStyles[status];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-success" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Resumo operacional</p>
            <p className="text-[10px] text-efb-text-dim">Baseado na sua escala</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.text} flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {status}
        </div>
      </div>

      <div className="p-5">
        {/* Airport + Gate row */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-4xl font-black font-mono text-foreground tracking-tighter leading-none">{airport}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{airline || 'Nacional'} • Portão —</p>
          </div>
        </div>

        {/* Weather strip */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl bg-secondary/40 px-3 py-2.5 flex items-center gap-2">
            <Thermometer className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Temp</p>
              <p className="text-sm font-bold font-mono text-foreground">—°C</p>
            </div>
          </div>
          <div className="flex-1 rounded-xl bg-secondary/40 px-3 py-2.5 flex items-center gap-2">
            <Wind className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Vento</p>
              <p className="text-sm font-bold font-mono text-foreground">— kt</p>
            </div>
          </div>
          <div className="flex-1 rounded-xl bg-secondary/40 px-3 py-2.5 flex items-center gap-2">
            <Cloud className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Cond.</p>
              <p className="text-sm font-bold text-foreground">—</p>
            </div>
          </div>
        </div>
      </div>

      <Link to="/weather" className="flex items-center justify-between px-5 py-2.5 border-t border-border/40 hover:bg-secondary/30 transition-colors">
        <span className="text-[10px] font-medium text-muted-foreground">Ver meteorologia completa</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </Link>
    </motion.div>
  );
}

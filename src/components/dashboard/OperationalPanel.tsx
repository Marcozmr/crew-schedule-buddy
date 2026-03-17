/**
 * EFB Dashboard — Operational Panel
 * Shows current airport, flight status, and weather.
 */

import { useState, useMemo } from 'react';
import { MapPin, Cloud, Wind, Thermometer, Plane, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { parseDateBRT } from '@/lib/date-utils';

interface OperationalPanelProps {
  schedule: ScheduleEntry[];
  airline?: string | null;
}

type FlightStatusType = 'NO HORÁRIO' | 'EMBARQUE' | 'ÚLTIMA CHAMADA' | 'ATRASADO' | 'DECOLADO' | 'DESCONHECIDO';

const statusStyles: Record<FlightStatusType, { bg: string; text: string; dot: string }> = {
  'NO HORÁRIO': { bg: 'bg-success/10 border-success/30', text: 'text-success', dot: 'bg-success' },
  'EMBARQUE': { bg: 'bg-primary/10 border-primary/30', text: 'text-primary', dot: 'bg-primary status-pulse' },
  'ÚLTIMA CHAMADA': { bg: 'bg-warning/10 border-warning/30', text: 'text-warning', dot: 'bg-warning status-pulse' },
  'ATRASADO': { bg: 'bg-destructive/10 border-destructive/30', text: 'text-destructive', dot: 'bg-destructive' },
  'DECOLADO': { bg: 'bg-muted border-muted-foreground/20', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  'DESCONHECIDO': { bg: 'bg-secondary border-border', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

function inferCurrentAirport(schedule: ScheduleEntry[]): string {
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const flights = schedule.filter(e => e.is_flight);
  const sorted = [...flights].sort((a, b) => parseDateBRT(a.date).getTime() - parseDateBRT(b.date).getTime());
  
  // Find today's or most recent flight
  const todayFlight = sorted.find(e => parseDateBRT(e.date).getTime() === todayMs);
  if (todayFlight) return todayFlight.departure_airport || todayFlight.departure || 'GRU';
  
  // Find latest past flight
  const past = sorted.filter(e => parseDateBRT(e.date).getTime() < todayMs);
  if (past.length > 0) {
    const last = past[past.length - 1];
    return last.arrival_airport || last.arrival || 'GRU';
  }
  
  // Next flight departure
  const future = sorted.find(e => parseDateBRT(e.date).getTime() > todayMs);
  if (future) return future.departure_airport || future.departure || 'GRU';
  
  return 'GRU';
}

function inferFlightStatus(): FlightStatusType {
  return 'NO HORÁRIO';
}

export function OperationalPanel({ schedule, airline }: OperationalPanelProps) {
  const airport = useMemo(() => inferCurrentAirport(schedule), [schedule]);
  const status = inferFlightStatus();
  const style = statusStyles[status];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-success/15 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-success" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Painel Operacional</p>
            <p className="text-xs text-efb-text-dim">Baseado na sua escala</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {status}
          </span>
        </div>
      </div>

      <div className="p-5">
        {/* Airport info */}
        <div className="flex items-start gap-4 mb-5">
          <div>
            <p className="text-4xl font-black font-mono text-foreground tracking-tight leading-none">{airport}</p>
            <p className="text-xs text-muted-foreground mt-1">{airline || 'Aeroporto atual'}</p>
          </div>
          <div className="flex-1" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Portão</p>
            <p className="text-lg font-bold font-mono text-foreground">—</p>
          </div>
        </div>

        {/* Weather strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-secondary/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Thermometer className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Temp</span>
            </div>
            <p className="text-base font-bold font-mono text-foreground">—°C</p>
          </div>
          <div className="rounded-xl bg-secondary/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Wind className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Vento</span>
            </div>
            <p className="text-base font-bold font-mono text-foreground">— kt</p>
          </div>
          <div className="rounded-xl bg-secondary/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Cloud className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Condição</span>
            </div>
            <p className="text-sm font-bold text-foreground">—</p>
          </div>
        </div>
      </div>

      <Link to="/weather" className="flex items-center justify-between px-5 py-3 border-t border-border/50 hover:bg-secondary/30 transition-colors">
        <span className="text-xs font-medium text-muted-foreground">Ver meteorologia completa</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>
    </motion.div>
  );
}

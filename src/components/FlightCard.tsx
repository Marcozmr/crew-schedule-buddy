import { FlightInfo } from '@/lib/types';
import { Plane, Clock, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

interface FlightCardProps {
  flight: FlightInfo;
  index?: number;
}

const statusLabels: Record<string, string> = {
  scheduled: 'Programado',
  active: 'Em voo',
  landed: 'Pousado',
  cancelled: 'Cancelado',
  incident: 'Incidente',
  diverted: 'Desviado',
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary',
  active: 'bg-success/10 text-success',
  landed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  incident: 'bg-destructive/10 text-destructive',
  diverted: 'bg-accent/10 text-accent',
};

export function FlightCard({ flight, index = 0 }: FlightCardProps) {
  const formatTime = (dateStr: string) => {
    if (!dateStr) return '--:--';
    try {
      return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card rounded-xl p-5 shadow-card hover:shadow-elevated transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-sky flex items-center justify-center">
            <Plane className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-foreground">{flight.flight?.iata || flight.flight?.icao || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">{flight.airline?.name}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[flight.flight_status] || 'bg-muted text-muted-foreground'}`}>
          {flight.flight_status}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />Partida</p>
          <p className="font-bold text-lg text-foreground">{flight.departure?.iata || '---'}</p>
          <p className="text-xs text-muted-foreground">{flight.departure?.airport?.substring(0, 30)}</p>
          <p className="text-xs font-mono text-foreground mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {formatTime(flight.departure?.scheduled)}
          </p>
        </div>

        <div className="flex flex-col items-center px-3">
          <div className="w-16 h-px bg-border relative">
            <Plane className="w-4 h-4 text-primary absolute -top-2 left-1/2 -translate-x-1/2" />
          </div>
        </div>

        <div className="flex-1 text-right">
          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><MapPin className="w-3 h-3" />Chegada</p>
          <p className="font-bold text-lg text-foreground">{flight.arrival?.iata || '---'}</p>
          <p className="text-xs text-muted-foreground">{flight.arrival?.airport?.substring(0, 30)}</p>
          <p className="text-xs font-mono text-foreground mt-1 flex items-center gap-1 justify-end">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {formatTime(flight.arrival?.scheduled)}
          </p>
        </div>
      </div>

      {flight.aircraft && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Aeronave: <span className="font-mono font-medium text-foreground">{flight.aircraft.registration || 'N/A'}</span>
            {flight.aircraft.iata && ` • ${flight.aircraft.iata}`}
          </p>
        </div>
      )}

      {flight.live && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-success">Ao vivo</span>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Alt: {Math.round(flight.live.altitude)}m • Vel: {Math.round(flight.live.speed_horizontal)}km/h
          </p>
        </div>
      )}
    </motion.div>
  );
}

import { FlightInfo } from '@/lib/types';
import { Plane, Clock, MapPin, Ban, AlertTriangle, Radio, Tag } from 'lucide-react';
import { motion } from 'framer-motion';

interface FlightCardProps {
  flight: FlightInfo;
  index?: number;
}

const statusLabels: Record<string, string> = {
  scheduled: 'Programado',
  active: 'Em Rota',
  landed: 'Pousado',
  cancelled: 'Cancelado',
  incident: 'Incidente',
  diverted: 'Alterado',
};

const statusConfig: Record<string, { bg: string; text: string; icon?: React.ReactNode; pulse?: boolean }> = {
  scheduled: { bg: 'bg-primary/10', text: 'text-primary' },
  active: { bg: 'bg-success/15', text: 'text-success', icon: <Radio className="w-3 h-3" />, pulse: true },
  landed: { bg: 'bg-muted', text: 'text-muted-foreground' },
  cancelled: { bg: 'bg-destructive/15', text: 'text-destructive', icon: <Ban className="w-3 h-3" /> },
  incident: { bg: 'bg-destructive/15', text: 'text-destructive', icon: <AlertTriangle className="w-3 h-3" /> },
  diverted: { bg: 'bg-accent/15', text: 'text-accent', icon: <AlertTriangle className="w-3 h-3" /> },
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

  const status = flight.flight_status || 'scheduled';
  const config = statusConfig[status] || statusConfig.scheduled;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-card rounded-xl p-5 shadow-card hover:shadow-elevated transition-shadow relative overflow-hidden ${
        status === 'cancelled' ? 'border border-destructive/30' : 
        status === 'active' ? 'border border-success/30' : 
        status === 'diverted' ? 'border border-accent/30' : ''
      }`}
    >
      {/* Active flight glow */}
      {status === 'active' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-success animate-pulse rounded-t-xl" />
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            status === 'active' ? 'bg-success/20' : 
            status === 'cancelled' ? 'bg-destructive/20' : 'gradient-sky'
          }`}>
            <Plane className={`w-4 h-4 ${
              status === 'active' ? 'text-success' : 
              status === 'cancelled' ? 'text-destructive' : 'text-primary-foreground'
            }`} />
          </div>
          <div>
            <p className={`font-bold ${status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {flight.flight?.iata || flight.flight?.icao || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">{flight.airline?.name}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 ${config.bg} ${config.text}`}>
          {config.pulse && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
          {config.icon}
          {statusLabels[status] || status}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />Partida</p>
          <p className={`font-bold text-lg ${status === 'cancelled' ? 'text-muted-foreground' : 'text-foreground'}`}>
            {flight.departure?.iata || '---'}
          </p>
          <p className="text-xs text-muted-foreground">{flight.departure?.airport?.substring(0, 30)}</p>
          <p className="text-xs font-mono text-foreground mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {formatTime(flight.departure?.scheduled)}
          </p>
        </div>

        <div className="flex flex-col items-center px-3">
          <div className="w-16 h-px bg-border relative">
            <Plane className={`w-4 h-4 absolute -top-2 left-1/2 -translate-x-1/2 ${
              status === 'active' ? 'text-success animate-pulse' : 
              status === 'cancelled' ? 'text-destructive' : 'text-primary'
            }`} />
          </div>
        </div>

        <div className="flex-1 text-right">
          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><MapPin className="w-3 h-3" />Chegada</p>
          <p className={`font-bold text-lg ${status === 'cancelled' ? 'text-muted-foreground' : 'text-foreground'}`}>
            {flight.arrival?.iata || '---'}
          </p>
          <p className="text-xs text-muted-foreground">{flight.arrival?.airport?.substring(0, 30)}</p>
          <p className="text-xs font-mono text-foreground mt-1 flex items-center gap-1 justify-end">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {formatTime(flight.arrival?.scheduled)}
          </p>
        </div>
      </div>

      {/* Aircraft prefix/registration - always visible */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Prefixo: <span className="font-mono font-semibold text-foreground">
              {flight.aircraft?.registration || 'N/D'}
            </span>
            {flight.aircraft?.iata && (
              <span className="ml-2 text-muted-foreground">• Tipo: <span className="font-mono font-medium text-foreground">{flight.aircraft.iata}</span></span>
            )}
            {flight.aircraft?.icao && (
              <span className="ml-2 text-muted-foreground">• ICAO: <span className="font-mono font-medium text-foreground">{flight.aircraft.icao}</span></span>
            )}
          </p>
        </div>
      </div>

      {flight.live && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-success">Ao vivo — Em Rota</span>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Alt: {Math.round(flight.live.altitude)}m • Vel: {Math.round(flight.live.speed_horizontal)}km/h
          </p>
        </div>
      )}
    </motion.div>
  );
}

import { FlightInfo } from '@/lib/types';
import { Plane, Clock, MapPin, Ban, AlertTriangle, Radio, Tag, Navigation, ArrowDown, ArrowUp, Timer, DoorOpen } from 'lucide-react';
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
  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '--:--';
    try {
      return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  const status = flight.flight_status || 'scheduled';
  const config = statusConfig[status] || statusConfig.scheduled;
  const depDelay = flight.departure?.delay;
  const arrDelay = flight.arrival?.delay;
  const codeshared = flight.flight?.codeshared;

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
      {status === 'active' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-success animate-pulse rounded-t-xl" />
      )}

      {/* Header */}
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
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 ${config.bg} ${config.text}`}>
            {config.pulse && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
            {config.icon}
            {statusLabels[status] || status}
          </span>
          {flight.flight_date && (
            <span className="text-[10px] text-muted-foreground font-mono">{flight.flight_date}</span>
          )}
        </div>
      </div>

      {/* Route */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />Partida</p>
          <p className={`font-bold text-lg ${status === 'cancelled' ? 'text-muted-foreground' : 'text-foreground'}`}>
            {flight.departure?.iata || '---'}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[140px]">{flight.departure?.airport}</p>
          <p className="text-xs font-mono text-foreground mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {formatTime(flight.departure?.scheduled)}
          </p>
          {flight.departure?.actual && (
            <p className="text-[10px] font-mono text-success flex items-center gap-1">
              Real: {formatTime(flight.departure.actual)}
            </p>
          )}
          {depDelay && depDelay > 0 && (
            <p className="text-[10px] font-medium text-destructive flex items-center gap-0.5">
              <Timer className="w-3 h-3" /> +{depDelay}min atraso
            </p>
          )}
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
          <p className="text-xs text-muted-foreground truncate max-w-[140px] ml-auto">{flight.arrival?.airport}</p>
          <p className="text-xs font-mono text-foreground mt-1 flex items-center gap-1 justify-end">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {formatTime(flight.arrival?.scheduled)}
          </p>
          {flight.arrival?.actual && (
            <p className="text-[10px] font-mono text-success flex items-center gap-1 justify-end">
              Real: {formatTime(flight.arrival.actual)}
            </p>
          )}
          {arrDelay && arrDelay > 0 && (
            <p className="text-[10px] font-medium text-destructive flex items-center gap-0.5 justify-end">
              <Timer className="w-3 h-3" /> +{arrDelay}min atraso
            </p>
          )}
        </div>
      </div>

      {/* Details: Terminal, Gate, Baggage */}
      {(flight.departure?.terminal || flight.departure?.gate || flight.arrival?.terminal || flight.arrival?.gate || flight.arrival?.baggage) && (
        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            {flight.departure?.terminal && (
              <p className="text-muted-foreground flex items-center gap-1">
                <DoorOpen className="w-3 h-3" /> Terminal: <span className="font-medium text-foreground">{flight.departure.terminal}</span>
              </p>
            )}
            {flight.departure?.gate && (
              <p className="text-muted-foreground">
                Portão: <span className="font-medium text-foreground">{flight.departure.gate}</span>
              </p>
            )}
          </div>
          <div className="space-y-1 text-right">
            {flight.arrival?.terminal && (
              <p className="text-muted-foreground">
                Terminal: <span className="font-medium text-foreground">{flight.arrival.terminal}</span>
              </p>
            )}
            {flight.arrival?.gate && (
              <p className="text-muted-foreground">
                Portão: <span className="font-medium text-foreground">{flight.arrival.gate}</span>
              </p>
            )}
            {flight.arrival?.baggage && (
              <p className="text-muted-foreground">
                Esteira: <span className="font-medium text-foreground">{flight.arrival.baggage}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Aircraft info */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Prefixo: <span className="font-mono font-semibold text-foreground">
              {flight.aircraft?.registration || 'N/D'}
            </span>
            {flight.aircraft?.iata && (
              <span className="ml-2">• Tipo: <span className="font-mono font-medium text-foreground">{flight.aircraft.iata}</span></span>
            )}
            {flight.aircraft?.icao && (
              <span className="ml-2">• ICAO: <span className="font-mono font-medium text-foreground">{flight.aircraft.icao}</span></span>
            )}
          </p>
        </div>
      </div>

      {/* Codeshare */}
      {codeshared && (
        <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          ✈️ Codeshare: <span className="font-medium text-foreground">{codeshared.flight_iata}</span> ({codeshared.airline_name})
        </div>
      )}

      {/* Live tracking */}
      {flight.live && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-success">Ao vivo — Em Rota</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono">
            <p className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3" /> Alt: {Math.round(flight.live.altitude)}m
            </p>
            <p className="flex items-center gap-1">
              <Navigation className="w-3 h-3" /> Vel: {Math.round(flight.live.speed_horizontal)}km/h
            </p>
            <p className="flex items-center gap-1">
              <ArrowDown className="w-3 h-3" /> V.Vert: {Math.round(flight.live.speed_vertical)}m/s
            </p>
            <p className="flex items-center gap-1">
              Dir: {Math.round(flight.live.direction)}°
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Lat: {flight.live.latitude.toFixed(4)} • Lon: {flight.live.longitude.toFixed(4)}
            {flight.live.is_ground && <span className="ml-2 text-primary font-medium">• Em solo</span>}
          </p>
        </div>
      )}
    </motion.div>
  );
}

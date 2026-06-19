import { Link } from 'react-router-dom';
import { Cloud, Wind, Users, Clock, ChevronRight, CheckCircle2, Plane } from 'lucide-react';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import type { AirportWeather } from '@/hooks/useAirportWeather';
import { FC_COLOR } from '@/hooks/useAirportWeather';
import { AIRPORTS_DB } from '@/lib/airports';

// ── helpers ──────────────────────────────────────────────────────────────────

function parseAirlineCode(flightNumber: string, airline?: string | null): string {
  const m = flightNumber?.match(/^([A-Z]{2}|[A-Z][0-9]|[0-9][A-Z])/);
  if (m) return m[1];
  if (airline?.toUpperCase().includes('LATAM')) return 'LA';
  if (airline?.toUpperCase().includes('GOL')) return 'G3';
  if (airline?.toUpperCase().includes('AZUL')) return 'AD';
  return (flightNumber || '??').slice(0, 2).toUpperCase();
}

function parseFlightNum(flightNumber: string): string {
  return flightNumber?.replace(/^[A-Z]{2}|^[A-Z][0-9]|^[0-9][A-Z]/, '') || flightNumber || '—';
}

const AIRLINE_COLORS: Record<string, { bg: string; text: string }> = {
  LA: { bg: 'bg-red-600',    text: 'text-white' },
  G3: { bg: 'bg-orange-500', text: 'text-white' },
  AD: { bg: 'bg-cyan-600',   text: 'text-white' },
  O6: { bg: 'bg-red-800',    text: 'text-white' },
  '7M':{ bg: 'bg-blue-600',  text: 'text-white' },
  '2Z':{ bg: 'bg-purple-600',text: 'text-white' },
  M3: { bg: 'bg-green-600',  text: 'text-white' },
};

function airlineStyle(code: string) {
  return AIRLINE_COLORS[code] || { bg: 'bg-primary', text: 'text-primary-foreground' };
}

function calcDuration(depTime?: string | null, arrTime?: string | null): string {
  if (!depTime || !arrTime) return '';
  const [dh, dm] = depTime.split(':').map(Number);
  let [ah, am] = arrTime.split(':').map(Number);
  let mins = ah * 60 + am - (dh * 60 + dm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

// ── component ──────────────────────────────────────────────────────────────

export interface FlightCardProps {
  leg: ScheduleEntry;
  weather?: AirportWeather;
  reportTime?: string | null;
  debriefTime?: string | null;
  showMetButton?: boolean;
  className?: string;
}

export function FlightCard({
  leg,
  weather,
  reportTime,
  debriefTime,
  showMetButton = true,
  className = '',
}: FlightCardProps) {
  const airlineCode = parseAirlineCode(leg.flight_number, leg.airline);
  const flightNum = parseFlightNum(leg.flight_number);
  const duration = calcDuration(leg.departure_time, leg.arrival_time);
  const arrIata = leg.arrival?.trim().toUpperCase().slice(0, 3);
  const arrIcao = AIRPORTS_DB[arrIata]?.icao;
  const style = airlineStyle(airlineCode);

  return (
    <div className={`rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm ${className}`}>

      {/* ── Linha 1: Badge + número + duração ── */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-1.5">
        <div className={`flex h-7 w-9 items-center justify-center rounded-lg ${style.bg} shrink-0`}>
          <span className={`${style.text} text-[10px] font-bold leading-none`}>{airlineCode}</span>
        </div>
        <span className="text-[15px] font-bold text-foreground">{flightNum}</span>
        <span className="ml-auto text-xs font-medium text-muted-foreground">{duration}</span>
      </div>

      {/* ── Linha 2: Tripulação ── */}
      <div className="flex items-center gap-1.5 px-4 pb-2.5">
        <Users className="w-3.5 h-3.5 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground">Tripulação</span>
        {leg.aircraft_type && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[10px] font-mono text-muted-foreground">{leg.aircraft_type}</span>
          </>
        )}
      </div>

      {/* ── Linha 3: Rota ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-3">
        <div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{leg.departure?.slice(0, 3)}</p>
          <p className="font-mono text-sm text-muted-foreground">{leg.departure_time}</p>
        </div>
        <Plane className="w-4 h-4 text-muted-foreground/40 rotate-90" />
        <div className="text-right">
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{leg.arrival?.slice(0, 3)}</p>
          <p className="font-mono text-sm text-muted-foreground">{leg.arrival_time}</p>
        </div>
      </div>

      {/* ── Linha 4: Check-in (laranja) ── */}
      {reportTime && (
        <div className="flex items-center gap-1.5 px-4 pb-2">
          <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="text-xs font-semibold text-orange-500">Check-in {reportTime}</span>
        </div>
      )}

      {/* ── Linha 5: Badges MET ── */}
      {weather && (
        <div className="flex items-center gap-2 px-4 pb-2.5 flex-wrap">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">MET</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${FC_COLOR[weather.flightCategory]}`}>
            {weather.flightCategory}
          </span>
          {weather.temp != null && (
            <span className="text-[11px] font-semibold text-foreground">{Math.round(weather.temp)}°C</span>
          )}
          {weather.windSpeed != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Wind className="w-3 h-3" />{Math.round(weather.windSpeed)}kt
            </span>
          )}
        </div>
      )}

      {/* ── Mini-card de clima ── */}
      {weather && (
        <div className="mx-3 mb-3 rounded-xl bg-secondary/60 border border-border/30 px-3 py-2.5 flex items-center gap-3">
          <span className="text-xl shrink-0">{weather.conditionEmoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {weather.temp != null ? `${Math.round(weather.temp)}°C` : ''}{' '}
              <span className="font-normal text-muted-foreground">{weather.condition}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pouso em {arrIcao || arrIata}{leg.arrival_time ? ` às ${leg.arrival_time}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Botão verde "Fazer check-in" (estilo CrewSync) ── */}
      {reportTime && (
        <Link
          to="/schedule"
          className="flex items-center justify-between w-full px-4 py-3 bg-green-500 hover:bg-green-600 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <CheckCircle2 className="w-4 h-4" />
            Fazer check-in
          </span>
          <ChevronRight className="w-4 h-4 text-white/80" />
        </Link>
      )}

      {/* ── Link MetCenter (quando não tem check-in) ── */}
      {showMetButton && weather && !reportTime && (
        <Link
          to="/weather"
          className="flex items-center justify-center gap-2 border-t border-border/40 py-2.5 text-xs font-semibold text-primary/80 hover:text-primary transition-colors"
        >
          <Cloud className="w-3.5 h-3.5" /> Ver no MetCenter
        </Link>
      )}

      {/* ── Check-out badge (debrief) ── */}
      {debriefTime && !reportTime && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border/40">
          <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Debrief: {debriefTime}</span>
        </div>
      )}
    </div>
  );
}

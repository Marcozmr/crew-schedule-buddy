import { Link } from 'react-router-dom';
import { Cloud, Wind } from 'lucide-react';
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

const AIRLINE_COLORS: Record<string, string> = {
  LA: 'bg-red-600',
  G3: 'bg-orange-500',
  AD: 'bg-cyan-600',
  O6: 'bg-red-800',
  '7M': 'bg-blue-600',
  '2Z': 'bg-purple-600',
  M3: 'bg-green-600',
};

function airlineBg(code: string) {
  return AIRLINE_COLORS[code] || 'bg-primary';
}

function calcDuration(depTime?: string | null, arrTime?: string | null): string {
  if (!depTime || !arrTime) return '';
  const [dh, dm] = depTime.split(':').map(Number);
  let [ah, am] = arrTime.split(':').map(Number);
  let mins = ah * 60 + am - (dh * 60 + dm);
  if (mins < 0) mins += 24 * 60; // overnight
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

// ── component ──────────────────────────────────────────────────────────────

export interface FlightCardProps {
  leg: ScheduleEntry;
  /** Weather at the ARRIVAL airport */
  weather?: AirportWeather;
  /** Show check-in badge (first leg of duty) */
  reportTime?: string | null;
  /** Show check-out badge (last leg of duty) */
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

  return (
    <div className={`rounded-2xl border border-border/70 bg-card overflow-hidden ${className}`}>
      {/* Header row: airline + flight number + aircraft + duration */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <div className={`flex h-7 w-9 items-center justify-center rounded-md ${airlineBg(airlineCode)} shrink-0`}>
          <span className="text-white text-[10px] font-bold leading-none">{airlineCode}</span>
        </div>
        <span className="text-base font-bold text-foreground">{flightNum}</span>
        {leg.aircraft_type && (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {leg.aircraft_type}
          </span>
        )}
        <span className="ml-auto text-xs font-medium text-muted-foreground whitespace-nowrap">{duration}</span>
      </div>

      {/* Route: origin → destination */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-1">
        <div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{leg.departure?.slice(0, 3)}</p>
          <p className="font-mono text-sm text-muted-foreground">{leg.departure_time}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-12 h-px bg-border relative">
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground">
              ✈
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{leg.arrival?.slice(0, 3)}</p>
          <p className="font-mono text-sm text-muted-foreground">{leg.arrival_time}</p>
        </div>
      </div>

      {/* Check-in / Check-out badges */}
      {(reportTime || debriefTime) && (
        <div className="flex gap-2 px-4 pb-2 flex-wrap">
          {reportTime && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 text-xs font-semibold">
              ✓ Check-in: {reportTime}
            </span>
          )}
          {debriefTime && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-0.5 text-xs font-semibold">
              Check-out: {debriefTime}
            </span>
          )}
        </div>
      )}

      {/* METAR row */}
      {weather && (
        <div className="border-t border-border/50 px-4 py-2 flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
            METAR {arrIata}
          </span>
          <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold ${FC_COLOR[weather.flightCategory]}`}>
            {weather.flightCategory}
          </span>
          {weather.temp != null && (
            <span className="text-xs text-foreground font-medium">{Math.round(weather.temp)}°C</span>
          )}
          {weather.windSpeed != null && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Wind className="w-3 h-3" />{Math.round(weather.windSpeed)}kt
            </span>
          )}
        </div>
      )}

      {/* Weather details card */}
      {weather && (
        <div className="mx-3 mb-3 rounded-xl bg-muted/40 border border-border/40 p-3 flex items-center gap-3">
          <span className="text-2xl shrink-0">{weather.conditionEmoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {weather.temp != null ? `${Math.round(weather.temp)}°C` : ''}{' '}
              <span className="font-normal text-muted-foreground">{weather.condition}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pouso em {arrIcao || arrIata}
              {leg.arrival_time ? ` às ${leg.arrival_time}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* MetCenter button */}
      {showMetButton && weather && (
        <Link
          to="/weather"
          className="flex items-center justify-center gap-2 border-t border-border/50 py-2.5 text-xs font-semibold text-primary/80 hover:text-primary transition-colors tracking-wide uppercase"
        >
          <Cloud className="w-3.5 h-3.5" /> Meteorologia
        </Link>
      )}
    </div>
  );
}

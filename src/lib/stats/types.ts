import type { ScheduleEntry } from '@/hooks/useScheduleData';

export interface StatsInput {
  /** Linhas do período (já sem duplicatas de importação). */
  entries: ScheduleEntry[];
  /** Todo o histórico (pode incluir o período); usado para "aeroporto novo". */
  history: ScheduleEntry[];
  period: { start: string; end: string };
  base?: string | null;
}

export interface Leg {
  from: string;
  to: string;
  minutes: number;
}

export interface RosterStats {
  period: { start: string; end: string };
  summary: {
    flownMinutes: number;
    dutyMinutes: number;
    daysOff: number;
    /** Voadas ÷ jornada (0–1); null sem jornada. */
    efficiency: number | null;
    earlyReports: number;
    lateLandings: number;
  };
  quality: {
    nightsHome: number;
    nightsAway: number;
    layovers: number;
    layoversByCity: Array<{ city: string; count: number }>;
    weekendsFree: number;
    weekendsTotal: number;
    daysOffOnWeekend: number;
    longestOffBlock: number;
    longestWorkStreak: number;
    base: string | null;
    baseInferred: boolean;
  };
  flights: {
    legs: number;
    deadheads: number;
    deadheadMinutes: number;
    distanceKm: number;
    earthLaps: number;
    topRoute: { from: string; to: string; count: number } | null;
    busiestDay: { date: string; legs: number } | null;
    dayMinutes: number;
    nightMinutes: number;
    flightDays: number;
    legsPerDay: number;
    avgLegMinutes: number;
    longestLeg: Leg | null;
    shortestLeg: Leg | null;
  };
  airports: {
    distinct: number;
    /** Aeroportos do período que não aparecem no histórico antes dele. */
    newAirports: string[];
    /** Total de aeroportos diferentes no histórico até o fim do período. */
    totalOperated: number;
    byCount: Array<{ iata: string; count: number }>;
    routes: Array<{ from: string; to: string; count: number }>;
    mapLegs: Array<{ from: string; to: string }>;
  };
  aircraft: {
    dominantType: { type: string; share: number } | null;
    byType: Array<{ type: string; count: number }>;
  };
}

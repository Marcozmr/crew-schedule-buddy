/**
 * Estatísticas da escala de um período. Funções puras sobre ScheduleEntry[]; a tela só formata.
 * Regras: docs/superpowers/specs/2026-11-19-estatisticas-e-tempo-design.md.
 */
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { airportTz, getAirport } from '@/lib/airports';
import { resolveCrewStatusFromActivityCode } from '@/lib/roster/crew-status-labels';
import { legUtcRange, splitDayNightMinutes } from './time';
import type { Leg, RosterStats, StatsInput } from './types';

const EARTH_KM = 40_075;
const DAY_MS = 86_400_000;
const FALLBACK_TZ = 'America/Sao_Paulo';
const WORK_TYPES = new Set(['flight', 'reserve', 'standby', 'on_call', 'training', 'duty_start']);
/** Aeroportos da mesma cidade contam como a mesma cidade para pernoite e "em casa". */
const METRO_CITY: Record<string, string> = {
  GRU: 'São Paulo', CGH: 'São Paulo', GIG: 'Rio de Janeiro', SDU: 'Rio de Janeiro',
  CNF: 'Belo Horizonte', PLU: 'Belo Horizonte', AEP: 'Buenos Aires', EZE: 'Buenos Aires',
  CDG: 'Paris', ORY: 'Paris', MXP: 'Milão', LIN: 'Milão', JFK: 'Nova York', EWR: 'Nova York', LGA: 'Nova York',
  LHR: 'Londres', LGW: 'Londres',
};

const dep = (e: ScheduleEntry) => String(e.departure_airport || e.departure || '').trim().toUpperCase();
const arr = (e: ScheduleEntry) => String(e.arrival_airport || e.arrival || '').trim().toUpperCase();
const cityOf = (iata: string) => METRO_CITY[iata] ?? getAirport(iata)?.city ?? iata;
const isPs = (e: ScheduleEntry) => e.is_flight && String(e.operation_type ?? '').toUpperCase() === 'PS';
const isOp = (e: ScheduleEntry) => e.is_flight && !isPs(e);
/** Tipo pelo código da atividade quando ele é conhecido (escalas antigas gravaram DOF como outra atividade). */
function entryTypeOf(e: ScheduleEntry): string {
  if (e.is_flight) return 'flight';
  const resolved = resolveCrewStatusFromActivityCode(String(e.activity_type ?? '')).entryType;
  return resolved !== 'other_activity' ? resolved : String(e.entry_type ?? '');
}
const isWork = (e: ScheduleEntry) => WORK_TYPES.has(entryTypeOf(e));
const isDayOff = (e: ScheduleEntry) => entryTypeOf(e) === 'day_off';

function hhmmToMin(t: string | null | undefined): number | null {
  const m = String(t ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function legMinutes(e: ScheduleEntry): number {
  if (e.flight_hours != null && e.flight_hours > 0) return Math.round(e.flight_hours * 60);
  const r = legUtcRange(e);
  return r ? Math.round((r.end - r.start) / 60_000) : 0;
}

function haversineKm(a: string, b: string): number | null {
  const p = getAirport(a);
  const q = getAirport(b);
  if (!p || !q) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(q.lat - p.lat) / 2) ** 2 + Math.cos(rad(p.lat)) * Math.cos(rad(q.lat)) * Math.sin(rad(q.lon - p.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function chronological(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort((a, b) =>
    a.date === b.date ? (hhmmToMin(a.departure_time) ?? 0) - (hhmmToMin(b.departure_time) ?? 0) : a.date.localeCompare(b.date),
  );
}

function daysOf(period: { start: string; end: string }): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${period.start}T00:00:00Z`); t <= Date.parse(`${period.end}T00:00:00Z`); t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Contagem decrescente; empate em ordem alfabética da chave. */
function ranked(counts: Map<string, number>): Array<[string, number]> {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function longestRun(days: string[], included: Set<string>): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = included.has(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function inferBase(flights: ScheduleEntry[]): string | null {
  const firstOfDay = new Map<string, string>();
  for (const f of flights) if (!firstOfDay.has(f.date) && dep(f)) firstOfDay.set(f.date, dep(f));
  const counts = new Map<string, number>();
  for (const code of firstOfDay.values()) bump(counts, code);
  return ranked(counts)[0]?.[0] ?? null;
}

export function computeRosterStats(input: StatsInput): RosterStats {
  const { period } = input;
  const inPeriod = (e: ScheduleEntry) => e.date >= period.start && e.date <= period.end;
  const entries = chronological(input.entries.filter(inPeriod));
  const flights = entries.filter((e) => e.is_flight);
  const ops = flights.filter(isOp);
  const pss = flights.filter(isPs);
  // Só os meses que têm escala importada: Ano e Sempre não contam meses vazios ou futuros como "em casa".
  const coveredMonths = new Set(entries.map((e) => e.date.slice(0, 7)));
  const days = daysOf(period).filter((d) => coveredMonths.has(d.slice(0, 7)));

  // Base
  // Só vale base que é um aeroporto conhecido (o campo é texto livre: "Brasília" ou "SBBR" viram inferência).
  const typed = input.base?.trim().toUpperCase() || null;
  const configured = typed && getAirport(typed) ? typed : null;
  const base = configured ?? inferBase(flights);
  const baseTz = airportTz(base) ?? FALLBACK_TZ;

  // Resumo
  const flownMinutes = ops.reduce((s, e) => s + legMinutes(e), 0);
  const dutyMinutes = entries.reduce((s, e) => s + (e.duty_hours && e.duty_hours > 0 ? Math.round(e.duty_hours * 60) : 0), 0);
  const offDays = new Set(entries.filter(isDayOff).map((e) => e.date));
  const earlyReports = flights.filter((e) => {
    const r = hhmmToMin(e.report_time);
    return r != null && r < 6 * 60;
  }).length;
  // Pouso noturno: entre 23h e 06h (hora local do destino) ou no dia seguinte.
  const lateLandings = flights.filter((e) => {
    const a = hhmmToMin(e.arrival_time);
    return e.crosses_midnight || (a != null && (a >= 23 * 60 || a < 6 * 60));
  }).length;

  // Noites: local ao fim de cada dia = destino do último voo até ali.
  const priorFlights = chronological(input.history.filter((e) => e.is_flight && e.date < period.start));
  let location = priorFlights.length ? arr(priorFlights[priorFlights.length - 1]) : base;
  const byDate = new Map<string, ScheduleEntry[]>();
  for (const f of flights) byDate.set(f.date, [...(byDate.get(f.date) ?? []), f]);
  let nightsHome = 0;
  const awayByCity = new Map<string, number>();
  for (const d of days) {
    const todays = byDate.get(d);
    if (todays?.length) location = arr(todays[todays.length - 1]) || location;
    if (!base || !location || cityOf(location) === cityOf(base)) nightsHome++;
    else bump(awayByCity, cityOf(location));
  }
  const nightsAway = days.length - nightsHome;

  // Fins de semana e sequências. Apresentação depois do horário de saída (ex.: 23:50 para um voo
  // 00:13) é na noite anterior: aquele dia também é de trabalho.
  const workDays = new Set(entries.filter(isWork).map((e) => e.date));
  for (const f of flights) {
    const report = hhmmToMin(f.report_time);
    const departure = hhmmToMin(f.departure_time);
    if (report != null && departure != null && report > departure) {
      workDays.add(new Date(Date.parse(`${f.date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10));
    }
  }
  let weekendsTotal = 0;
  let weekendsFree = 0;
  for (const d of days) {
    if (weekday(d) !== 6) continue;
    const sunday = new Date(Date.parse(`${d}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
    if (sunday > period.end) continue;
    weekendsTotal++;
    if (!workDays.has(d) && !workDays.has(sunday)) weekendsFree++;
  }

  // Voos
  const routeCounts = new Map<string, number>();
  const legsPerDate = new Map<string, number>();
  const airportCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const mapLegKeys = new Set<string>();
  let distanceKm = 0;
  for (const f of flights) {
    const from = dep(f);
    const to = arr(f);
    bump(routeCounts, `${from}→${to}`);
    bump(legsPerDate, f.date);
    if (from) bump(airportCounts, from);
    if (to) bump(airportCounts, to);
    const type = String(f.aircraft_type ?? '').trim();
    if (type) bump(typeCounts, type);
    const km = haversineKm(from, to);
    if (km != null) {
      distanceKm += km;
      mapLegKeys.add(`${from}→${to}`);
    }
  }

  let dayMinutes = 0;
  let nightMinutes = 0;
  let longestLeg: Leg | null = null;
  let shortestLeg: Leg | null = null;
  for (const f of ops) {
    const r = legUtcRange(f);
    if (r) {
      const split = splitDayNightMinutes(r.start, r.end, baseTz);
      dayMinutes += split.day;
      nightMinutes += split.night;
    }
    const leg = { from: dep(f), to: arr(f), minutes: legMinutes(f) };
    if (!longestLeg || leg.minutes > longestLeg.minutes) longestLeg = leg;
    if (!shortestLeg || leg.minutes < shortestLeg.minutes) shortestLeg = leg;
  }

  const topRouteEntry = ranked(routeCounts)[0];
  const busiest = [...legsPerDate.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const flightDays = new Set(ops.map((e) => e.date)).size;

  // Aeroportos
  const priorAirports = new Set(priorFlights.flatMap((e) => [dep(e), arr(e)]).filter(Boolean));
  const periodAirports = [...airportCounts.keys()].sort();
  const toRoute = ([key, count]: [string, number]) => {
    const [from, to] = key.split('→');
    return { from, to, count };
  };

  const typesRanked = ranked(typeCounts);
  const typeTotal = typesRanked.reduce((s, [, c]) => s + c, 0);

  return {
    period,
    summary: {
      flownMinutes,
      dutyMinutes,
      daysOff: offDays.size,
      efficiency: dutyMinutes > 0 ? flownMinutes / dutyMinutes : null,
      earlyReports,
      lateLandings,
    },
    quality: {
      nightsHome,
      nightsAway,
      layovers: nightsAway,
      layoversByCity: ranked(awayByCity).map(([city, count]) => ({ city, count })),
      weekendsFree,
      weekendsTotal,
      daysOffOnWeekend: [...offDays].filter((d) => weekday(d) === 0 || weekday(d) === 6).length,
      longestOffBlock: longestRun(days, offDays),
      longestWorkStreak: longestRun(days, workDays),
      base,
      baseInferred: !configured,
    },
    flights: {
      legs: ops.length,
      deadheads: pss.length,
      deadheadMinutes: pss.reduce((s, e) => s + legMinutes(e), 0),
      distanceKm,
      earthLaps: distanceKm / EARTH_KM,
      topRoute: topRouteEntry ? toRoute(topRouteEntry) : null,
      busiestDay: busiest ? { date: busiest[0], legs: busiest[1] } : null,
      dayMinutes,
      nightMinutes,
      flightDays,
      legsPerDay: flightDays ? ops.length / flightDays : 0,
      avgLegMinutes: ops.length ? Math.round(flownMinutes / ops.length) : 0,
      longestLeg,
      shortestLeg,
    },
    airports: {
      distinct: periodAirports.length,
      // Sem meses anteriores para comparar, nada é "novo".
      newAirports: priorAirports.size ? periodAirports.filter((a) => !priorAirports.has(a)) : [],
      totalOperated: new Set([...priorAirports, ...periodAirports]).size,
      byCount: ranked(airportCounts).map(([iata, count]) => ({ iata, count })),
      routes: ranked(routeCounts).slice(0, 5).map(toRoute),
      mapLegs: [...mapLegKeys].map((k) => {
        const [from, to] = k.split('→');
        return { from, to };
      }),
    },
    aircraft: {
      dominantType: typesRanked[0] ? { type: typesRanked[0][0], share: typesRanked[0][1] / typeTotal } : null,
      byType: typesRanked.map(([type, count]) => ({ type, count })),
    },
  };
}

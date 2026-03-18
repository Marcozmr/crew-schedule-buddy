import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, Info, AlertTriangle, Clock, BedDouble, Plane } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useOperationalPreferences } from '@/hooks/useOperationalPreferences';
import { groupIntoDutyPeriods } from '@/lib/duty-grouping';
import { formatDateBR, formatHoursMinutes } from '@/lib/date-utils';
import {
  evaluateSchedule,
  type ScheduleWindow,
  type DutyPeriodInput,
  type CrewRole,
  type AircraftCategory,
} from '@/regulation';

function parseDateParts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

function timeToMinutes(time: string | null | undefined): number {
  if (!time) return -1;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

function toUtcIso(date: string, time: string, timezone: string, dayOffset = 0): string {
  const [year, month, day] = parseDateParts(date);
  return new Date(new Date(`${year}-${String(month).padStart(2, '0')}-${String(day + dayOffset).padStart(2, '0')}T${time}:00`).toLocaleString('en-US', { timeZone: timezone })).toISOString();
}

function mapCrewRole(crewRole: string | null | undefined): CrewRole {
  const normalized = (crewRole || '').toLowerCase();
  if (normalized.includes('cmd') || normalized.includes('capt')) return 'captain';
  if (normalized.includes('cop') || normalized.includes('fo')) return 'first_officer';
  return 'cabin_crew';
}

function mapAircraftCategory(type: string | null | undefined): AircraftCategory {
  const val = (type || '').toUpperCase();
  return /33\d|34\d|35\d|77\d|78\d|A330|A350|B777|B787/.test(val) ? 'widebody' : 'narrowbody';
}

function inferPostFlightMinutes(arrivalTime: string, debriefTime: string | null | undefined): number {
  if (!debriefTime) return 30;
  const arr = timeToMinutes(arrivalTime);
  let deb = timeToMinutes(debriefTime);
  if (arr < 0 || deb < 0) return 30;
  if (deb < arr) deb += 1440;
  const diff = deb - arr;
  if (diff >= 0 && diff <= 180) return diff;
  return 30;
}

function formatStatus(status: string): string {
  if (status === 'COMPLIANT') return 'Situação normal';
  if (status === 'WARNING') return 'Dentro do limite';
  if (status === 'CRITICAL_FATIGUE' || status === 'NON_COMPLIANT') return 'Operação crítica';
  return 'Dentro do limite';
}

export default function RegulationPage() {
  const { schedule, loading } = useScheduleData();
  const { timezone, homeBase } = useOperationalPreferences();

  const analysis = useMemo(() => {
    if (schedule.length === 0) return null;

    const grouped = groupIntoDutyPeriods(schedule);
    if (grouped.length === 0) return null;

    const dutyPeriods: DutyPeriodInput[] = grouped.map((duty) => {
      const legs = duty.legs.map((leg) => {
        const dep = leg.departure_time || '00:00';
        const arr = leg.arrival_time || dep;
        const depUtc = toUtcIso(leg.date, dep, timezone);
        const arrDayOffset = leg.crosses_midnight || timeToMinutes(arr) < timeToMinutes(dep) ? 1 : 0;
        const arrUtc = toUtcIso(leg.date, arr, timezone, arrDayOffset);

        return {
          id: leg.id,
          flightNumber: leg.flight_number,
          departureAirport: (leg.departure_airport || leg.departure || 'TBD').toUpperCase(),
          arrivalAirport: (leg.arrival_airport || leg.arrival || 'TBD').toUpperCase(),
          scheduledDepartureUtc: depUtc,
          scheduledArrivalUtc: arrUtc,
          aircraftCategory: mapAircraftCategory(leg.aircraft_type),
          activityType: (leg.is_flight ? 'flight' : 'ground_duty') as const,
          crossesMidnight: !!leg.crosses_midnight,
        };
      });

      const first = duty.legs[0];
      const last = duty.legs[duty.legs.length - 1];
      const reportLocal = first.report_time || first.departure_time || '00:00';
      const reportTimeUtc = toUtcIso(first.date, reportLocal, timezone);
      const postFlightMinutes = inferPostFlightMinutes(last.arrival_time, last.debrief_time);
      const baseAirport = (homeBase || first.departure_airport || first.departure || 'BSB').toUpperCase();

      return {
        reportTimeUtc,
        legs,
        baseAirport,
        crewRole: mapCrewRole(first.crew_role),
        aircraftCategory: legs.some((l) => l.aircraftCategory === 'widebody') ? 'widebody' : 'narrowbody',
        postFlightMinutes,
      };
    });

    const window: ScheduleWindow = {
      dutyPeriods,
      referenceDate: new Date().toISOString(),
      crew: {
        crewId: 'active-crew',
        crewRole: mapCrewRole(schedule[0]?.crew_role),
        baseAirport: (homeBase || schedule[0]?.departure_airport || schedule[0]?.departure || 'BSB').toUpperCase(),
        aircraftCategory: mapAircraftCategory(schedule[0]?.aircraft_type),
        airline: schedule[0]?.airline || 'LATAM',
        timezone,
      },
    };

    const results = evaluateSchedule(window);
    const allAlerts = results.flatMap((r) => r.alerts.map((a) => ({ ...a, dutyDate: r.duty.reportTimeLocal })));    
    const overall = results.some((r) => r.status === 'NON_COMPLIANT' || r.status === 'CRITICAL_FATIGUE')
      ? 'NON_COMPLIANT'
      : results.some((r) => r.status === 'WARNING')
        ? 'WARNING'
        : 'COMPLIANT';

    return { results, allAlerts, overall };
  }, [schedule, timezone, homeBase]);

  return (
    <AppLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !analysis || analysis.results.length === 0 ? (
        <div className="bg-card rounded-xl p-10 text-center shadow-card">
          <p className="text-muted-foreground">Nenhuma escala importada. Importe um PDF para ver o simulador operacional.</p>
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Simulador operacional</h1>
            <p className="text-sm text-muted-foreground mt-1">Motor único com RBAC 117 + Lei do Aeronauta + regras LATAM</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Situação geral</p>
                <p className="text-base font-semibold text-foreground mt-1">{formatStatus(analysis.overall)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Jornadas avaliadas</p>
                <p className="text-base font-semibold text-foreground mt-1">{analysis.results.length}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Alertas operacionais</p>
                <p className="text-base font-semibold text-foreground mt-1">{analysis.allAlerts.length}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Referência</p>
                <p className="text-base font-semibold text-foreground mt-1">RBAC + Lei + LATAM</p>
              </div>
            </div>
          </motion.div>

          {analysis.allAlerts.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                Alertas operacionais ({analysis.allAlerts.length})
              </h2>
              <div className="space-y-2">
                {analysis.allAlerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm bg-muted/60 text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
                    <div>
                      <p className="font-medium text-foreground">{alert.message}</p>
                      <p className="text-xs opacity-80">{alert.ruleSource} • {alert.ruleId}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Nenhum alerta operacional identificado na escala ativa.
              </p>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Plane className="w-5 h-5 text-primary" />
              Jornadas analisadas ({analysis.results.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground text-xs">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Apresentação</th>
                    <th className="py-2 pr-3">Fim da jornada</th>
                    <th className="py-2 pr-3">Pós-voo</th>
                    <th className="py-2 pr-3">Trechos</th>
                    <th className="py-2 pr-3">Tempo de voo</th>
                    <th className="py-2 pr-3">Jornada</th>
                    <th className="py-2 pr-3">Descanso anterior</th>
                    <th className="py-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.results.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-mono text-foreground">{formatDateBR(r.duty.reportTimeLocal.slice(0, 10))}</td>
                      <td className="py-2 pr-3 font-mono text-foreground">{r.duty.reportTimeLocal.slice(11, 16)}</td>
                      <td className="py-2 pr-3 font-mono text-foreground">{r.duty.endTimeLocal.slice(11, 16)}</td>
                      <td className="py-2 pr-3 text-foreground">{r.duty.postFlightMinutes}min</td>
                      <td className="py-2 pr-3 text-foreground">{r.duty.sectorCount}</td>
                      <td className="py-2 pr-3 text-foreground">{formatHoursMinutes(r.duty.totalFlightHours)}</td>
                      <td className="py-2 pr-3 text-foreground">{formatHoursMinutes(r.duty.totalDutyHours)}</td>
                      <td className="py-2 pr-3 text-foreground">{r.rest.restBeforeDutyHours == null ? '—' : formatHoursMinutes(r.rest.restBeforeDutyHours)}</td>
                      <td className="py-2 text-foreground">{formatStatus(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-center py-6">
            <p className="text-xs text-muted-foreground/80 max-w-3xl mx-auto leading-relaxed">
              EscalaX é uma ferramenta de apoio operacional e não substitui sistemas oficiais. EscalaX não possui vínculo com companhias aéreas.
            </p>
          </motion.div>
        </>
      )}
    </AppLayout>
  );
}

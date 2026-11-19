/**
 * Leitor do relatório de escala do iFlight em JSON (`loadRosterReport`), o mesmo que alimenta a
 * grade "Roster Report" do portal. Traz cada trecho e cada atividade com horários, estações,
 * programação, horas de voo e de jornada, aeronave e função — mais completo que o PDF.
 *
 * Estrutura (vista no portal real em 2026-11-19): `model.cWPRosterWidgetModel.cWPCrewRosterDayReportDTO`
 * é uma lista de linhas. A primeira linha de cada jornada tem `allocationDate` e `reportTime`; as
 * seguintes (mesmo `pairingDutyId`) são os outros trechos. Horários podem vir com `(+N)`: N dias
 * depois do dia da jornada.
 */
import {
  resolveCrewStatusFromActivityCode,
  resolveCrewStatusFromFlightOperation,
} from '@/lib/roster/crew-status-labels';
import type { CrewRosterParsedEntry } from '@/lib/roster/crew-roster-parser';

export const IFLIGHT_JSON_PARSER_VERSION = 'IFLIGHT_JSON_V1';

interface IflightRow {
  allocationDate?: string;
  complementRank?: string;
  overriddenRank?: string;
  itemType?: string;
  itemCode?: string;
  description?: string;
  reportTime?: string;
  acyReportTime?: string;
  pairingItemCode?: string;
  workType?: string;
  departureStation?: string;
  departureTime?: string;
  arrivalStation?: string;
  arrivalTime?: string;
  debriefTime?: string;
  acyDebriefTime?: string;
  flyingMinutes?: number;
  dutyMinutes?: number;
  aircraftType?: string;
  hotelName?: string;
  assignmentComments?: string;
  specialDutyCode?: string;
  pairingDutyId?: number;
}

export interface IflightRosterHeader {
  rosterStartDate: string | null;
  rosterEndDate: string | null;
  crewRole: string | null;
}

/** "08:50(+1)" → { time: "08:50", days: 1 }. */
function splitTime(raw: string | undefined): { time: string; days: number } {
  const m = String(raw ?? '').match(/(\d{1,2}):(\d{2})(?:\s*\(\+(\d+)\))?/);
  if (!m) return { time: '', days: 0 };
  return { time: `${m[1].padStart(2, '0')}:${m[2]}`, days: m[3] ? Number(m[3]) : 0 };
}

/** "BSB 15:00" → "BSB". */
function station(raw: string | undefined): string {
  const m = String(raw ?? '').trim().match(/^([A-Z]{3,4})\b/i);
  return m ? m[1].toUpperCase() : '';
}

function addDays(isoDate: string, days: number): string {
  if (!days) return isoDate;
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function hours(minutes: number | undefined): number | null {
  if (!minutes || minutes <= 0) return null;
  return Math.round((minutes / 60) * 100) / 100;
}

function rowsOf(json: unknown): IflightRow[] {
  const rows = (json as { model?: { cWPRosterWidgetModel?: { cWPCrewRosterDayReportDTO?: unknown } } })?.model
    ?.cWPRosterWidgetModel?.cWPCrewRosterDayReportDTO;
  if (!Array.isArray(rows)) throw new Error('Relatório do iFlight sem linhas da escala');
  return rows as IflightRow[];
}

export function parseIflightRosterReport(json: unknown): { header: IflightRosterHeader; entries: CrewRosterParsedEntry[] } {
  const rows = rowsOf(json);
  const search = (json as { model: { cWPRosterWidgetModel: { cWPRosterReportSearchDTO?: Record<string, string> } } }).model
    .cWPRosterWidgetModel.cWPRosterReportSearchDTO;

  const entries: CrewRosterParsedEntry[] = [];
  let dutyDate = '';
  let pairingCode = '';
  let roleSeen = '';

  for (const row of rows) {
    const startsDuty = Boolean(row.allocationDate);
    if (startsDuty) {
      dutyDate = String(row.allocationDate).slice(0, 10);
      const code = String(row.itemCode ?? '');
      pairingCode = row.itemType === 'FLT' && code.includes('/') ? code : '';
    }
    if (!dutyDate) continue;

    const dep = splitTime(row.departureTime || row.departureStation?.replace(/^\S+\s*/, ''));
    const arr = splitTime(row.arrivalTime || row.arrivalStation?.replace(/^\S+\s*/, ''));
    const date = addDays(dutyDate, dep.days);
    const crossesMidnight = arr.days > dep.days;
    const role = (row.overriddenRank || row.complementRank || '').toUpperCase();
    if (role) roleSeen = role;
    const reportTime = startsDuty ? splitTime(row.reportTime || row.acyReportTime).time : '';
    const dutyHours = startsDuty ? hours(row.dutyMinutes) : null;
    const isFlight = row.itemType === 'FLT';

    const base = {
      date,
      crewRole: role,
      reportTime,
      departureAirport: station(row.departureStation),
      departureTime: dep.time,
      arrivalAirport: station(row.arrivalStation),
      arrivalTime: arr.time,
      dutyHours,
      aircraftType: String(row.aircraftType ?? ''),
      hotelName: String(row.hotelName ?? ''),
      assignment: String(row.specialDutyCode ?? ''),
      comments: String(row.assignmentComments ?? ''),
      crossesMidnight,
      overnight: crossesMidnight,
      sortDatetime: `${date}T${dep.time || '00:00'}:00`,
    };

    if (isFlight) {
      const flightNumber = String(row.pairingItemCode || '').toUpperCase().replace(/\s+/g, '');
      if (!flightNumber) continue;
      const op = String(row.workType ?? '').toUpperCase();
      const status = resolveCrewStatusFromFlightOperation(op);
      entries.push({
        ...base,
        activityType: 'flight',
        isFlight: true,
        flightNumber,
        pairingCode,
        operationType: op,
        debriefTime: splitTime(row.debriefTime).time,
        flightHours: hours(row.flyingMinutes),
        rawLine: `${flightNumber} ${base.departureAirport} ${dep.time} ${base.arrivalAirport} ${arr.time}`.trim(),
        entryType: 'flight',
        crewStatusCode: status.code,
        crewStatusLabel: status.label,
        activityLabel: '',
      });
      continue;
    }

    const code = String(row.pairingItemCode || row.itemCode || '').trim().toUpperCase();
    if (!code) continue;
    const status = resolveCrewStatusFromActivityCode(code);
    entries.push({
      ...base,
      activityType: code,
      isFlight: false,
      flightNumber: code,
      pairingCode,
      operationType: '',
      debriefTime: splitTime(row.acyDebriefTime || row.debriefTime).time,
      flightHours: null,
      rawLine: `${code} ${row.description ?? ''} ${base.departureAirport} ${dep.time}-${arr.time}`.replace(/\s+/g, ' ').trim(),
      entryType: status.entryType,
      crewStatusCode: status.code,
      crewStatusLabel: status.label,
      activityLabel: String(row.description || status.label),
    });
  }

  return {
    header: {
      rosterStartDate: search?.periodFromDate ? String(search.periodFromDate).slice(0, 10) : null,
      rosterEndDate: search?.periodToDate ? String(search.periodToDate).slice(0, 10) : null,
      crewRole: roleSeen || null,
    },
    entries,
  };
}

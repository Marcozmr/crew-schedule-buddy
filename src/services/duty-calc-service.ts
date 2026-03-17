/**
 * EscalaX — Duty Calculation Service
 * 
 * Centralized, auditable duty calculation using RBAC 117 Table 4 (Appendix B).
 * Supports: pilot + flight attendant (same RBAC limits),
 * crew types (simple/composite/relay), post-flight offset, WOCL detection.
 * 
 * All times in America/Sao_Paulo unless otherwise noted.
 */

// ─── RBAC 117 Table 4 — Duty & Flight limits ──────────
// Key: presentation hour range → legs bucket → [maxDutyH, maxFlightH]
const RBAC_117_TABLE: Record<string, Record<string, [number, number]>> = {
  '06':    { '1-2': [11, 9],   '3-4': [11, 9],   '5': [10, 8], '6': [9, 8], '7+': [9, 8] },
  '07':    { '1-2': [12, 9.5], '3-4': [12, 9],   '5': [11, 9], '6': [10, 8], '7+': [9, 8] },
  '08-11': { '1-2': [12, 10],  '3-4': [12, 9.5], '5': [12, 9], '6': [11, 9], '7+': [10, 8] },
  '12-13': { '1-2': [12, 9.5], '3-4': [12, 9],   '5': [11, 9], '6': [10, 8], '7+': [9, 8] },
  '14-15': { '1-2': [11, 9],   '3-4': [11, 9],   '5': [10, 8], '6': [9, 8], '7+': [9, 8] },
  '16-17': { '1-2': [10, 8],   '3-4': [10, 8],   '5': [9, 8],  '6': [9, 8], '7+': [9, 8] },
  '18-05': { '1-2': [9, 8],    '3-4': [9, 8],    '5': [9, 7],  '6': [9, 7], '7+': [9, 7] },
};

// ─── Crew type extensions (RBAC 117 §117.71) ──────────
const CREW_EXTENSIONS: Record<string, { dutyH: number; flightH: number }> = {
  simples:      { dutyH: 0, flightH: 0 },
  composta:     { dutyH: 3, flightH: 2 },
  revezamento:  { dutyH: 6, flightH: 3 },
};

// ─── Flight hour accumulation limits ──────────
export const FLIGHT_LIMITS = {
  '7days': 44,
  '30days': 85,
  '90days': 230,
  '365days': 850,
  '28days_narrowbody': 90,
  '28days_widebody': 100,
};

// ─── Types ─────────────────────────────────────────────

export type CrewRole = 'piloto' | 'comissario';
export type CrewType = 'simples' | 'composta' | 'revezamento';
export type AircraftCategory = 'narrowbody' | 'widebody';

export interface DutyCalcInput {
  reportTime: string;         // HH:MM
  takeoffTime: string;        // HH:MM
  landingTime: string;        // HH:MM
  legs: number;
  crewRole: CrewRole;
  crewType: CrewType;
  aircraftCategory: AircraftCategory;
  postFlightMinutes: number;  // default 30
}

export interface DutyCalcResult {
  // Core calculations
  flightHours: number;
  dutyHours: number;
  endOfDutyTime: string;      // HH:MM

  // RBAC limits
  baseDutyLimit: number;
  baseFlightLimit: number;
  crewExtensionDuty: number;
  crewExtensionFlight: number;
  effectiveDutyLimit: number;
  effectiveFlightLimit: number;

  // Status
  dutyWithinLimit: boolean;
  flightWithinLimit: boolean;
  overallCompliant: boolean;

  // Period classification
  period: string;
  periodDetail: string;
  isWOCL: boolean;
  isMadrugada: boolean;

  // RBAC reference
  tableRow: string;
  tableLegsBucket: string;

  // Audit trail
  audit: AuditStep[];
}

export interface AuditStep {
  label: string;
  value: string;
  detail?: string;
}

// ─── Helper functions ──────────────────────────────────

function getTableRow(hour: number): string {
  if (hour === 6) return '06';
  if (hour === 7) return '07';
  if (hour >= 8 && hour <= 11) return '08-11';
  if (hour >= 12 && hour <= 13) return '12-13';
  if (hour >= 14 && hour <= 15) return '14-15';
  if (hour >= 16 && hour <= 17) return '16-17';
  return '18-05';
}

function getLegsBucket(legs: number): string {
  if (legs <= 2) return '1-2';
  if (legs <= 4) return '3-4';
  if (legs === 5) return '5';
  if (legs === 6) return '6';
  return '7+';
}

function getPeriodLabel(hour: number): { period: string; detail: string } {
  if (hour >= 6 && hour < 12) return { period: 'Diurno', detail: 'Manhã (06:00–11:59)' };
  if (hour >= 12 && hour < 18) return { period: 'Diurno', detail: 'Tarde (12:00–17:59)' };
  if (hour >= 18 && hour < 22) return { period: 'Noturno', detail: 'Noite (18:00–21:59)' };
  if (hour >= 22 || hour < 2) return { period: 'Noturno', detail: 'Pré-WOCL (22:00–01:59)' };
  return { period: 'Madrugada', detail: 'WOCL pleno (02:00–05:59)' };
}

function parseTime(hhmm: string): { h: number; m: number; totalMin: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { h: h || 0, m: m || 0, totalMin: (h || 0) * 60 + (m || 0) };
}

function formatMinutes(totalMin: number): string {
  const normalized = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Main calculation ──────────────────────────────────

export function calculateDuty(input: DutyCalcInput): DutyCalcResult {
  const report = parseTime(input.reportTime);
  const takeoff = parseTime(input.takeoffTime);
  const landing = parseTime(input.landingTime);
  const postFlight = input.postFlightMinutes;
  const legs = Math.max(1, input.legs);

  // Handle overnight: if landing < takeoff, add 24h
  let landingMin = landing.totalMin;
  if (landingMin <= takeoff.totalMin) landingMin += 1440;

  // If report is after takeoff (e.g. report 22:45, takeoff 23:30 next concept), handle
  let reportMin = report.totalMin;
  let takeoffMin = takeoff.totalMin;
  if (takeoffMin < reportMin) takeoffMin += 1440;
  if (landingMin < takeoffMin) landingMin = takeoffMin + (landing.totalMin + 1440 - takeoff.totalMin) % 1440;

  // Flight time
  const flightMin = landingMin - takeoffMin;
  const flightHours = round1(flightMin / 60);

  // End of duty = landing + post-flight offset
  const endOfDutyMin = landingMin + postFlight;
  const endOfDutyTime = formatMinutes(endOfDutyMin);

  // Duty time = report → end of duty
  const dutyMin = endOfDutyMin - reportMin;
  const dutyHours = round1(dutyMin / 60);

  // RBAC 117 lookup
  const tableRow = getTableRow(report.h);
  const legsBucket = getLegsBucket(legs);
  const baseLimits = RBAC_117_TABLE[tableRow]?.[legsBucket] ?? [11, 9];
  const baseDutyLimit = baseLimits[0];
  const baseFlightLimit = baseLimits[1];

  // Crew extensions
  const ext = CREW_EXTENSIONS[input.crewType] ?? { dutyH: 0, flightH: 0 };
  const effectiveDutyLimit = round1(baseDutyLimit + ext.dutyH);
  const effectiveFlightLimit = round1(baseFlightLimit + ext.flightH);

  // Period classification
  const { period, detail } = getPeriodLabel(report.h);
  const isWOCL = report.h >= 2 && report.h < 6;
  const isMadrugada = report.h >= 0 && report.h < 6;

  // Compliance check
  const dutyOk = dutyHours <= effectiveDutyLimit;
  const flightOk = flightHours <= effectiveFlightLimit;

  // Build audit trail
  const audit: AuditStep[] = [
    { label: 'Apresentação', value: input.reportTime, detail: `Hora local BRT` },
    { label: 'Decolagem', value: input.takeoffTime },
    { label: 'Pouso (último trecho)', value: input.landingTime, detail: landingMin > 1440 ? '(+1 dia)' : undefined },
    { label: 'Adicional pós-voo', value: `+${postFlight} min`, detail: `Configurável (padrão: 30 min)` },
    { label: 'Término da jornada', value: endOfDutyTime, detail: endOfDutyMin > 1440 ? '(+1 dia)' : undefined },
    { label: 'Tempo de voo', value: `${flightHours}h`, detail: `${flightMin} min` },
    { label: 'Jornada total', value: `${dutyHours}h`, detail: `${dutyMin} min` },
    { label: 'Faixa RBAC (hora aprst)', value: tableRow, detail: `Hora ${report.h}` },
    { label: 'Etapas', value: `${legs}`, detail: `Bucket: ${legsBucket}` },
    { label: 'Função', value: input.crewRole === 'piloto' ? 'Piloto' : 'Comissário(a)', detail: 'RBAC 117 aplica mesmos limites' },
    { label: 'Tripulação', value: input.crewType.charAt(0).toUpperCase() + input.crewType.slice(1), detail: ext.dutyH > 0 ? `+${ext.dutyH}h jornada, +${ext.flightH}h voo` : 'Sem extensão' },
    { label: 'Limite jornada (base)', value: `${baseDutyLimit}h`, detail: `Tabela 4, RBAC 117` },
    { label: 'Limite jornada (efetivo)', value: `${effectiveDutyLimit}h`, detail: ext.dutyH > 0 ? `${baseDutyLimit} + ${ext.dutyH}` : 'Sem extensão' },
    { label: 'Limite voo (base)', value: `${baseFlightLimit}h`, detail: `Tabela 4, RBAC 117` },
    { label: 'Limite voo (efetivo)', value: `${effectiveFlightLimit}h` },
    { label: 'Status jornada', value: dutyOk ? '✅ Dentro do limite' : '❌ Excede o limite' },
    { label: 'Status voo', value: flightOk ? '✅ Dentro do limite' : '❌ Excede o limite' },
    { label: 'Período', value: period, detail },
    { label: 'WOCL (02:00–06:00)', value: isWOCL ? 'SIM ⚠️' : 'NÃO' },
  ];

  return {
    flightHours,
    dutyHours,
    endOfDutyTime,
    baseDutyLimit,
    baseFlightLimit,
    crewExtensionDuty: ext.dutyH,
    crewExtensionFlight: ext.flightH,
    effectiveDutyLimit,
    effectiveFlightLimit,
    dutyWithinLimit: dutyOk,
    flightWithinLimit: flightOk,
    overallCompliant: dutyOk && flightOk,
    period,
    periodDetail: detail,
    isWOCL,
    isMadrugada,
    tableRow,
    tableLegsBucket: legsBucket,
    audit,
  };
}

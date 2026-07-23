/**
 * Pipeline de importação PDF/HTML auto-contido para o worker Playwright (Node.js).
 *
 * Combina a lógica de:
 *   src/lib/roster/crew-status-labels.ts   (sem cn / Tailwind)
 *   src/lib/roster/crew-roster-parser.ts   (sem import.meta.env)
 *   src/lib/roster/official-crew-roster.ts
 *   src/lib/schedule-entry-dedupe.ts
 *   src/lib/pdf-import.ts                  (só o path servidor — sem browser/Vite)
 *
 * Restrições:
 *   - Zero imports de @/ ou ../../../src
 *   - Zero uso de import.meta.env
 *   - Zero browser APIs (window, location, Worker)
 *   - pdfjs-dist carregado dinamicamente (build legado Node.js)
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CorporateAutomationImportOrigin =
  | 'latam_automation'
  | 'gol_automation'
  | 'azul_automation';

export interface WorkerPdfImportResult {
  success: boolean;
  duplicate?: boolean;
  rosterId: string | null;
  insertedCount: number;
  error: string | null;
}

type UserRosterConnectionType = 'manual_pdf' | 'official_pdf' | 'corporate_pdf' | string;

// ─── crew-status-labels (sem UI / cn) ────────────────────────────────────────

type NormalizedEntryType =
  | 'flight'
  | 'day_off'
  | 'vacation'
  | 'reserve'
  | 'standby'
  | 'on_call'
  | 'duty_start'
  | 'training'
  | 'sick'
  | 'leave'
  | 'no_show'
  | 'admin'
  | 'document_renewal'
  | 'payment'
  | 'disciplinary'
  | 'medical_exam'
  | 'swap'
  | 'delay'
  | 'operational'
  | 'blank'
  | 'other_activity';

function resolveCrewStatusFromFlightOperation(
  operationType: string,
): { code: string; label: string } {
  const o = operationType.toUpperCase();
  if (o === 'OP') return { code: 'OP', label: 'Em operação' };
  if (o === 'PS') return { code: 'PS', label: 'Reposicionamento' };
  return { code: o, label: o };
}

interface ActivityDef {
  label: string;
  entryType: NormalizedEntryType;
}

/**
 * Mesma tabela de src/lib/roster/crew-status-labels.ts (duplicada aqui por isolamento de build
 * do worker — ver comentário no topo do arquivo). Cobre os códigos "iFlight Neo" oficiais da
 * planilha de siglas da LATAM; manter as duas listas em sincronia ao adicionar códigos novos.
 */
const ACTIVITY_CODE_MAP: Record<string, ActivityDef> = {
  DO: { label: 'Folga', entryType: 'day_off' },
  DB: { label: 'Folga aniversário', entryType: 'day_off' },
  DBC: { label: 'Folga aniversário casada', entryType: 'day_off' },
  DC: { label: 'Folga casada', entryType: 'day_off' },
  DRC: { label: 'Folga casada pedida', entryType: 'day_off' },
  DW: { label: 'Folga de gala', entryType: 'day_off' },
  DE: { label: 'Folga eleição', entryType: 'day_off' },
  DH: { label: 'Folga final de ano', entryType: 'day_off' },
  DOBI: { label: 'Folga fora de base internacional', entryType: 'day_off' },
  DOB: { label: 'Folga fora de base nacional', entryType: 'day_off' },
  DOM: { label: 'Folga maternidade', entryType: 'day_off' },
  DF: { label: 'Folga natalidade', entryType: 'day_off' },
  DMO: { label: 'Folga nojo', entryType: 'day_off' },
  DR: { label: 'Folga pedida', entryType: 'day_off' },
  DOP: { label: 'Folga período oposto', entryType: 'day_off' },
  DOPR: { label: 'Folga período oposto reprogramado', entryType: 'day_off' },
  DS: { label: 'Folga prova/universidade', entryType: 'day_off' },
  DU: { label: 'Folga sindical', entryType: 'day_off' },
  DCH: { label: 'Folga solicitada pela chefia', entryType: 'day_off' },
  X: { label: 'Folga', entryType: 'day_off' },
  FOLGA: { label: 'Folga', entryType: 'day_off' },

  VC: { label: 'Férias', entryType: 'vacation' },

  ASB: { label: 'Reserva', entryType: 'reserve' },
  ASB1: { label: 'Reserva', entryType: 'reserve' },
  ASB2: { label: 'Reserva', entryType: 'reserve' },

  HSB: { label: 'Sobreaviso', entryType: 'standby' },
  HSBE: { label: 'Sobreaviso estendido', entryType: 'standby' },

  APR: { label: 'Apresentação', entryType: 'duty_start' },
  CDM: { label: 'Corte dos motores', entryType: 'operational' },
  OWN: { label: 'Own way travel', entryType: 'operational' },
  LOSA: { label: 'Registro de observações operacionais', entryType: 'operational' },
  REP: { label: 'Repouso pós jornada', entryType: 'operational' },
  OWC: { label: 'Solicitação de alteração da própria escala', entryType: 'operational' },
  BUS: { label: 'Transporte', entryType: 'operational' },
  EXT_JJ: { label: 'A serviço no exterior', entryType: 'operational' },

  OFF: { label: 'Intervalo de escala', entryType: 'blank' },
  BKF: { label: 'Intervalo para refeição', entryType: 'blank' },

  ATZ: { label: 'Atraso de tripulante', entryType: 'delay' },
  ATZJ: { label: 'Atraso justificado', entryType: 'delay' },

  FMF: { label: 'Acompanhamento médico familiar', entryType: 'no_show' },
  LCH: { label: 'Audiência na justiça', entryType: 'no_show' },
  NSC: { label: 'Ausência chefia', entryType: 'no_show' },
  NSS: { label: 'Ausência universidade', entryType: 'no_show' },
  JI: { label: 'Interrupção de jornada', entryType: 'no_show' },
  JIJ: { label: 'Interrupção de jornada justificada', entryType: 'no_show' },
  NS: { label: 'Não compareceu', entryType: 'no_show' },
  NSP: { label: 'Não compareceu — publicado', entryType: 'no_show' },
  NSJ: { label: 'Não compareceu acompanhado', entryType: 'no_show' },

  INSS: { label: 'Afastado pelo INSS', entryType: 'sick' },
  SW: { label: 'Afastamento acidente de trabalho', entryType: 'sick' },
  SICA: { label: 'Dispensa ambulatório', entryType: 'sick' },
  SICK: { label: 'Dispensa médica', entryType: 'sick' },
  JIS: { label: 'Interrupção de jornada — dispensa médica', entryType: 'sick' },
  ME: { label: 'Exame médico', entryType: 'medical_exam' },
  PCMA: { label: 'Perda certificado médico aeronáutico', entryType: 'sick' },

  CAF: { label: 'Ação a fadiga', entryType: 'leave' },
  LFS: { label: 'Disp. segurança voo', entryType: 'leave' },
  DSVD: { label: 'Disp. segurança voo (R$)', entryType: 'leave' },
  LSNA: { label: 'Dispensa sindical', entryType: 'leave' },
  FTG: { label: 'Fadiga', entryType: 'leave' },
  LNP: { label: 'Licença não remunerada', entryType: 'leave' },
  LEP: { label: 'Licença remunerada', entryType: 'leave' },
  SAER: { label: 'Saúde aeroespacial', entryType: 'leave' },
  SAED: { label: 'Saúde aeroespacial (R$)', entryType: 'leave' },

  ADM: { label: 'Administração', entryType: 'admin' },
  OPT: { label: 'Administrativo eventual', entryType: 'admin' },
  CH: { label: 'Audiência chefia', entryType: 'admin' },
  CEQ: { label: 'Disp. chefia equipamento', entryType: 'admin' },
  OPCT: { label: 'Copiloto eventual para treinamento', entryType: 'admin' },
  OPR: { label: 'Operações', entryType: 'admin' },
  PSNA: { label: 'Representantes sindicais', entryType: 'admin' },
  SFTY: { label: 'Safety — segurança de voo', entryType: 'admin' },
  MT: { label: 'Reunião', entryType: 'admin' },

  VUSA: { label: 'Renovação de visto EUA', entryType: 'document_renewal' },
  PASS: { label: 'Renovação de passaporte', entryType: 'document_renewal' },
  CMA: { label: 'Certificado médico aeronáutico', entryType: 'document_renewal' },
  WCCF: { label: 'Sem cartão de capacidade física', entryType: 'document_renewal' },
  WCHT: { label: 'Sem cartão de habilitação técnica', entryType: 'document_renewal' },

  DCGH: { label: 'Deslocamento Congonhas', entryType: 'payment' },
  DGRU: { label: 'Deslocamento Guarulhos', entryType: 'payment' },
  TEMP: { label: 'Temporary duty', entryType: 'payment' },

  SUSP: { label: 'Suspensão', entryType: 'disciplinary' },

  SWAP: { label: 'Troca entre tripulantes', entryType: 'swap' },

  NEO2: { label: 'Curso A320 NEO', entryType: 'training' },
  CPER: { label: 'Artigos perigosos', entryType: 'training' },
  APE: { label: 'Atendimento a passageiros especiais', entryType: 'training' },
  ACF: { label: 'Avaliação líder nacional', entryType: 'training' },
  CHK: { label: 'Cabine checador', entryType: 'training' },
  CAT: { label: 'CAT — ground school CAT III', entryType: 'training' },
  CATS_JJ: { label: 'Ground school CAT III', entryType: 'training' },
  SIM_JJ: { label: 'Simulador', entryType: 'training' },
  LOFT_JJ: { label: 'LOFT (simulador)', entryType: 'training' },
  REC_JJ: { label: 'Recurrent simulador', entryType: 'training' },
  M320: { label: 'Check de competência anual A32F', entryType: 'training' },
  M350: { label: 'Check de competência anual A350', entryType: 'training' },
  M767: { label: 'Check de competência anual B767', entryType: 'training' },
  M777: { label: 'Check de competência anual B777', entryType: 'training' },
  C32F: { label: 'Check de competência periódico A32F', entryType: 'training' },
  C350: { label: 'Check de competência periódico A350', entryType: 'training' },
  C767: { label: 'Check de competência periódico B767', entryType: 'training' },
  C777: { label: 'Check de competência periódico B777', entryType: 'training' },
  WEB5: { label: 'Código de conduta / pró ajuda / SGSO', entryType: 'training' },
  CRM: { label: 'Curso CRM', entryType: 'training' },
  CRMT: { label: 'Curso CRMT — cockpit', entryType: 'training' },
  GPS: { label: 'Curso GPS', entryType: 'training' },
  A320: { label: 'Curso inicial A319/320/321', entryType: 'training' },
  A350: { label: 'Curso inicial A350', entryType: 'training' },
  B767: { label: 'Curso inicial B767', entryType: 'training' },
  B777: { label: 'Curso inicial B777', entryType: 'training' },
  A32I: { label: 'Curso inicial A320', entryType: 'training' },
  DTRN: { label: 'Disponível para treinamento', entryType: 'training' },
  ENS: { label: 'Ensino', entryType: 'training' },
  A319: { label: 'Ensino A319 — Brasil', entryType: 'training' },
  S320: { label: 'Equipamento A320', entryType: 'training' },
  FCH: { label: 'Formação de examinador', entryType: 'training' },
  CFI: { label: 'Formação de instrutor', entryType: 'training' },
  FCN: { label: 'Formação de líder nacional', entryType: 'training' },
  FCI: { label: 'Formação líder internacional', entryType: 'training' },
  MET: { label: 'IFR — meteorologia', entryType: 'training' },
  REG: { label: 'IFR — regulamentos', entryType: 'training' },
  SAFE: { label: 'IFR — safety', entryType: 'training' },
  I320: { label: 'Inicial A32F — 1º dia', entryType: 'training' },
  I350: { label: 'Inicial A350 — 1º dia', entryType: 'training' },
  I763: { label: 'Inicial B763 — 1º dia', entryType: 'training' },
  I777: { label: 'Inicial B777 — 1º dia', entryType: 'training' },
  ICFI: { label: 'Instrutor de CFI', entryType: 'training' },
  ICRM: { label: 'Instrutor de CRM', entryType: 'training' },
  ITAI: { label: 'Instrutor TAI', entryType: 'training' },
  DNI: { label: 'Laboratório de idiomas', entryType: 'training' },
  MCK: { label: 'Mock-up de emergências gerais', entryType: 'training' },
  PID: { label: 'Passageiro indisciplinado', entryType: 'training' },
  PBN: { label: 'Performance em navegação', entryType: 'training' },
  PBNS_JJ: { label: 'Simulador PBN', entryType: 'training' },
  RNP_JJ: { label: 'Simulador RNP', entryType: 'training' },
  R320: { label: 'Periódico A319/320/321', entryType: 'training' },
  R350: { label: 'Periódico A350', entryType: 'training' },
  R767: { label: 'Periódico B767', entryType: 'training' },
  R777: { label: 'Periódico B777', entryType: 'training' },
  PSO: { label: 'Primeiros socorros', entryType: 'training' },
  AQP: { label: 'Programa qualificação avançada', entryType: 'training' },
  REXP: { label: 'Reciclagem de examinador', entryType: 'training' },
  RCFI: { label: 'Reciclagem de instrutor', entryType: 'training' },
  RTAI: { label: 'Revalidação tráfego aéreo nac/int', entryType: 'training' },
  EQP: { label: 'Revalidação equipamento', entryType: 'training' },
  IFR: { label: 'Revalidação IFR', entryType: 'training' },
  SER: { label: 'Saúde e segurança', entryType: 'training' },
  SEC: { label: 'Security — segurança da aviação civil', entryType: 'training' },
  SEG: { label: 'Segurança operacional', entryType: 'training' },
  MAR: { label: 'Sobrevivência no mar', entryType: 'training' },
  FUEL: { label: 'Smart fuel', entryType: 'training' },
  TEOP: { label: 'Temas operacionais', entryType: 'training' },
  TST: { label: 'Teste de idioma', entryType: 'training' },
  TAI: { label: 'Tráfego aéreo nac/int', entryType: 'training' },
  EMG: { label: 'Workshop de emergências gerais', entryType: 'training' },
  LID: { label: 'Treinamento código de conduta', entryType: 'training' },
  DEA: { label: 'Treinamento desfibrilador', entryType: 'training' },
  TRH: { label: 'Treinamento RH', entryType: 'training' },
  TRTO: { label: 'Treinamento técnico operacional', entryType: 'training' },
  TRNG: { label: 'Treinamentos', entryType: 'training' },
  RP32: { label: 'Reprovação check A320', entryType: 'training' },
  RP35: { label: 'Reprovação check A350', entryType: 'training' },
  RPB6: { label: 'Reprovação check B767', entryType: 'training' },
  RPB7: { label: 'Reprovação check B777', entryType: 'training' },
  PRA: { label: 'Reprovação/não qualificado', entryType: 'training' },

  WEB: { label: 'Ensino a distância', entryType: 'training' },
  WEB1: { label: 'Ensino a distância 1', entryType: 'training' },
  WEB2: { label: 'Ensino a distância 2', entryType: 'training' },
  WEB3: { label: 'Ensino a distância 3', entryType: 'training' },
  WEB4: { label: 'Treinamento online corporativo', entryType: 'training' },
  ONTR: { label: 'Treinamentos online', entryType: 'training' },
  SGSO: { label: 'Sistema de gerenciamento da segurança operacional', entryType: 'training' },
  ING: { label: 'Recheck de idiomas', entryType: 'training' },

  AVL_JJ: { label: 'Disponível p/ voo', entryType: 'other_activity' },

  CLA: { label: 'Atividade administrativa', entryType: 'other_activity' },
  OTH: { label: 'Outros', entryType: 'other_activity' },
  CNL: { label: 'Voo cancelado', entryType: 'other_activity' },
};

const ALIASES: Record<string, string> = {
  STANDBY: 'HSB',
  STBY: 'HSB',
  SBY: 'HSB',
};

const BASE_SUFFIXES = ['BSB', 'GRU', 'CGH', 'GIG', 'SDU', 'POA', 'CNF', 'REC', 'FOR', 'SSA', 'VCP', 'NAT', 'BEL', 'MAO', 'CWB'];
const BASE_SUFFIXABLE_CODES = ['CRM', 'CRMT'];
const BASE_SUFFIXED_TOKENS: string[] = BASE_SUFFIXABLE_CODES.flatMap((code) =>
  BASE_SUFFIXES.map((base) => `${code}${base}`),
);

function resolveCrewStatusFromActivityCode(
  code: string,
): { code: string; label: string; entryType: NormalizedEntryType } {
  const c = code.trim().toUpperCase();

  const aliased = ALIASES[c];
  const direct = ACTIVITY_CODE_MAP[aliased ?? c];
  if (direct) return { code: c, label: direct.label, entryType: direct.entryType };

  for (const base of BASE_SUFFIXES) {
    if (c.length > base.length && c.endsWith(base)) {
      const prefix = c.slice(0, c.length - base.length);
      const def = ACTIVITY_CODE_MAP[prefix];
      if (def) return { code: c, label: `${def.label} (${base})`, entryType: def.entryType };
    }
  }

  return { code: c, label: c, entryType: 'other_activity' };
}

const KNOWN_ACTIVITY_CODES: string[] = [...Object.keys(ACTIVITY_CODE_MAP), ...Object.keys(ALIASES)];

// ─── official-crew-roster ─────────────────────────────────────────────────────

const OFFICIAL_PREFIX = /^crewrosterreport/i;

function isOfficialCrewRosterFileName(fileName: string): boolean {
  if (!fileName || typeof fileName !== 'string') return false;
  const base = fileName.trim().split(/[/\\]/).pop() ?? '';
  const withoutExt = base.replace(/\.pdf$/i, '');
  return OFFICIAL_PREFIX.test(withoutExt);
}

// ─── schedule-entry-dedupe ────────────────────────────────────────────────────

type ScheduleEntryNaturalKeyInput = {
  roster_id?: string | null;
  user_id?: string | null;
  date: string;
  flight_number: string;
  departure_time: string;
  arrival_time: string;
  departure: string;
  arrival: string;
  is_flight: boolean;
  activity_type: string;
};

function normalizeTimeHead5(t: string | null | undefined): string {
  return String(t ?? '00:00').trim().slice(0, 5);
}

function scheduleEntryNaturalKey(row: ScheduleEntryNaturalKeyInput): string {
  return [
    row.roster_id ?? '',
    row.user_id ?? '',
    row.date,
    (row.flight_number || '').trim().toUpperCase(),
    normalizeTimeHead5(row.departure_time),
    normalizeTimeHead5(row.arrival_time),
    (row.departure || '').trim().toUpperCase(),
    (row.arrival || '').trim().toUpperCase(),
    row.is_flight ? 't' : 'f',
    row.activity_type || '',
  ].join('|');
}

function dedupeScheduleEntryRows<T extends ScheduleEntryNaturalKeyInput>(
  rows: T[],
): { rows: T[]; removed: number } {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const k = scheduleEntryNaturalKey(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return { rows: out, removed: rows.length - out.length };
}

// ─── crew-roster-parser ───────────────────────────────────────────────────────

/** V6: reconhece todas as siglas iFlight Neo (antes só 13 hardcoded) + corrige ASB/HSB trocados. */
export const PARSER_VERSION = 'LATAM_ROSTER_V6';

const MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  FEV: '02', ABR: '04', MAI: '05', AGO: '08', SET: '09', OUT: '10', DEZ: '12',
};

interface CrewRosterParseStats {
  totalEntries: number;
  totalRawAnchors: number;
  totalFlights: number;
  totalDO: number;
  totalStandby: number;
  totalAPR: number;
  totalReserve: number;
  totalOnCall: number;
  totalPresentation: number;
  totalAfterDedup: number;
  unrecognizedSnippetCount: number;
}

interface CrewRosterParsedEntry {
  date: string;
  activityType: string;
  isFlight: boolean;
  flightNumber: string;
  pairingCode: string;
  crewRole: string;
  operationType: string;
  reportTime: string;
  departureAirport: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalTime: string;
  debriefTime: string;
  flightHours: number | null;
  dutyHours: number | null;
  aircraftType: string;
  hotelName: string;
  assignment: string;
  comments: string;
  rawLine: string;
  crossesMidnight: boolean;
  overnight: boolean;
  sortDatetime: string;
  entryType: NormalizedEntryType;
  crewStatusCode: string;
  crewStatusLabel: string;
  activityLabel: string;
}

export function parseRosterDateToken(raw: string): string | null {
  const m = raw.match(/(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{2,4})/i);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const monthKey = m[2].toUpperCase();
  const month = MONTH_MAP[monthKey];
  if (!month) return null;
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}

export function normalizeCrewRosterPdfText(text: string): string {
  let s = text
    .replace(/ /g, ' ')
    .replace(/[ -​﻿]/g, ' ')
    .replace(/\r\n?/g, ' ')
    .replace(/[\t\f\v]+/g, ' ');
  s = s.replace(/[‐-―−]/g, '-');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\b(\d{1,2})-([A-Za-z]{3})-(\d{4})\b/g, (_, d: string, mon: string, y: string) => {
    return `${d}-${mon.toUpperCase()}-${y}`;
  });
  return s.trim();
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function didCrossMidnight(dep: string, arr: string): boolean {
  const d = timeToMinutes(dep);
  const a = timeToMinutes(arr);
  return d >= 0 && a >= 0 && a < d;
}

function padHHmm(t: string): string {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function dedupeEntries(entries: CrewRosterParsedEntry[]): CrewRosterParsedEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.date}|${e.entryType}|${e.activityType}|${e.flightNumber}|${e.departureAirport}|${e.departureTime}|${e.arrivalAirport}|${e.arrivalTime}|${e.crewStatusCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const CREW_ROLES = 'CC|CA|FO|SO|CM|FA|PUR|INS|CHK|OBS|CCP|TCA|TCP|CCM';

const NON_FLIGHT_TOKEN = [...KNOWN_ACTIVITY_CODES, ...BASE_SUFFIXED_TOKENS]
  .sort((a, b) => b.length - a.length)
  .join('|');

export function parseCrewRosterEntries(normalized: string): {
  entries: CrewRosterParsedEntry[];
  stats: CrewRosterParseStats;
  textByDay: Record<string, string>;
  devUnrecognizedLines: string[];
} {
  const dateRegex = /\b(\d{1,2}-[A-Z]{3}-\d{4})\b/g;
  const datePositions: { date: string; pos: number }[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = dateRegex.exec(normalized)) !== null) {
    const parsed = parseRosterDateToken(dm[1]);
    if (parsed) datePositions.push({ date: parsed, pos: dm.index });
  }

  function getDateForPosition(pos: number): string {
    let best = '';
    for (const dp of datePositions) {
      if (dp.pos <= pos) best = dp.date;
      else break;
    }
    return best;
  }

  function resolveDateForAnchor(pos: number): string {
    const fromAnchors = getDateForPosition(pos);
    if (fromAnchors) return fromAnchors;
    const lookback = normalized.substring(Math.max(0, pos - 320), pos);
    const dateMatches = [...lookback.matchAll(/\b(\d{1,2}-[A-Z]{3}-\d{4})\b/g)];
    for (let i = dateMatches.length - 1; i >= 0; i--) {
      const iso = parseRosterDateToken(dateMatches[i][1]);
      if (iso) return iso;
    }
    const lookahead = normalized.substring(pos, Math.min(pos + 160, normalized.length));
    const ahead = lookahead.match(/\b(\d{1,2}-[A-Z]{3}-\d{4})\b/);
    if (ahead) {
      const iso = parseRosterDateToken(ahead[1]);
      if (iso) return iso;
    }
    return '';
  }

  const textByDay: Record<string, string> = {};
  for (let i = 0; i < datePositions.length; i++) {
    const start = datePositions[i].pos;
    const end = i + 1 < datePositions.length ? datePositions[i + 1].pos : normalized.length;
    const segment = normalized.substring(start, end).trim();
    const date = datePositions[i].date;
    textByDay[date] = textByDay[date] ? `${textByDay[date]} | ${segment}` : segment;
  }

  const entries: CrewRosterParsedEntry[] = [];
  let totalRawAnchors = 0;
  const devUnrecognizedLines: string[] = [];

  const flightRe = new RegExp(
    `(?:\\b(\\d{1,2}:\\d{2})\\s+)?((?:LA|JJ)\\s*\\d{3,5})\\s+(${CREW_ROLES})\\s+(OP|PS)\\s+([A-Z]{3})\\s+(\\d{1,2}:\\d{2})\\s+([A-Z]{3})\\s+(\\d{1,2}:\\d{2})(?:\\s*\\(\\+1\\))?`,
    'gi',
  );
  let fm: RegExpExecArray | null;
  while ((fm = flightRe.exec(normalized)) !== null) {
    totalRawAnchors++;
    const matchPos = fm.index;
    const matchEnd = matchPos + fm[0].length;
    const date = resolveDateForAnchor(matchPos);
    if (!date) continue;
    const reportFromPattern = fm[1] ? padHHmm(fm[1]) : '';
    const flightNumber = fm[2].toUpperCase().replace(/\s+/g, '').replace(/^JJ/, 'LA');
    const crewRole = fm[3].toUpperCase();
    const op = fm[4].toUpperCase();
    const depAirport = fm[5].toUpperCase();
    const depTime = padHHmm(fm[6]);
    const arrAirport = fm[7].toUpperCase();
    const arrTime = padHHmm(fm[8]);
    const beforeFlight = normalized.substring(Math.max(0, matchPos - 14), matchPos);
    const reportAlt = beforeFlight.match(/(\d{1,2}:\d{2})\s+$/);
    const reportTime = reportFromPattern || (reportAlt ? padHHmm(reportAlt[1]) : '');
    const { code: crewStatusCode, label: crewStatusLabel } = resolveCrewStatusFromFlightOperation(op);
    let crossesMidnight = didCrossMidnight(depTime, arrTime);
    const after = normalized.substring(matchEnd, Math.min(matchEnd + 40, normalized.length)).trim();
    if (after.startsWith('(+1)')) crossesMidnight = true;
    entries.push({
      date, activityType: 'flight', isFlight: true, flightNumber, pairingCode: '',
      crewRole, operationType: op, reportTime, departureAirport: depAirport, departureTime: depTime,
      arrivalAirport: arrAirport, arrivalTime: arrTime, debriefTime: '', flightHours: null,
      dutyHours: null, aircraftType: '', hotelName: '', assignment: '', comments: '',
      rawLine: normalized.substring(matchPos, Math.min(matchPos + 140, normalized.length)),
      crossesMidnight, overnight: crossesMidnight, sortDatetime: `${date}T${depTime}:00`,
      entryType: 'flight', crewStatusCode, crewStatusLabel, activityLabel: '',
    });
  }

  const aprRe = new RegExp(
    `APR\\s+(${CREW_ROLES})\\s+([A-Z]{3})\\s+(\\d{1,2}:\\d{2})\\s+([A-Z]{3})\\s+(\\d{1,2}:\\d{2})(?:\\s*\\(\\+1\\))?`,
    'gi',
  );
  let am: RegExpExecArray | null;
  while ((am = aprRe.exec(normalized)) !== null) {
    totalRawAnchors++;
    const pos = am.index;
    const date = resolveDateForAnchor(pos);
    if (!date) continue;
    const crewRole = am[1].toUpperCase();
    const dep = am[2].toUpperCase();
    const t1 = padHHmm(am[3]);
    const arr = am[4].toUpperCase();
    const t2 = padHHmm(am[5]);
    let crosses = didCrossMidnight(t1, t2);
    const tail = normalized.substring(am.index + am[0].length, am.index + am[0].length + 6);
    if (tail.includes('(+1)')) crosses = true;
    const st = resolveCrewStatusFromActivityCode('APR');
    entries.push({
      date, activityType: 'APR', isFlight: false, flightNumber: 'APR', pairingCode: '',
      crewRole, operationType: '', reportTime: t1, departureAirport: dep, departureTime: t1,
      arrivalAirport: arr, arrivalTime: t2, debriefTime: '', flightHours: null, dutyHours: null,
      aircraftType: '', hotelName: '', assignment: '', comments: '',
      rawLine: normalized.substring(pos, Math.min(pos + 120, normalized.length)),
      crossesMidnight: crosses, overnight: crosses, sortDatetime: `${date}T${t1}:00`,
      entryType: st.entryType, crewStatusCode: st.code, crewStatusLabel: st.label,
      activityLabel: 'Apresentação',
    });
  }

  const soloAct = new RegExp(
    `\\b(\\d{1,2}-[A-Z]{3}-\\d{4})\\s+(?:${NON_FLIGHT_TOKEN}|Standby|STANDBY|STBY)\\b`,
    'gi',
  );
  let sm: RegExpExecArray | null;
  while ((sm = soloAct.exec(normalized)) !== null) {
    const dateStr = sm[1];
    const parsedDate = parseRosterDateToken(dateStr);
    if (!parsedDate) continue;
    const rest = normalized.substring(sm.index + sm[1].length).trim();
    const codeMatch = rest.match(new RegExp(`^(${NON_FLIGHT_TOKEN}|Standby|STANDBY|STBY)\\b`, 'i'));
    if (!codeMatch) continue;
    let codeRaw = codeMatch[1];
    if (/^standby|stby$/i.test(codeRaw)) codeRaw = 'STANDBY';
    const code = codeRaw.toUpperCase();
    const pos = sm.index;
    const charBefore = pos > 0 ? normalized[pos - 1] : ' ';
    if (charBefore === '/' || charBefore === '-') continue;
    totalRawAnchors++;
    const st = resolveCrewStatusFromActivityCode(code === 'STANDBY' ? 'STANDBY' : code);
    entries.push({
      date: parsedDate, activityType: code, isFlight: false, flightNumber: code, pairingCode: '',
      crewRole: '', operationType: '', reportTime: '', departureAirport: '', departureTime: '',
      arrivalAirport: '', arrivalTime: '', debriefTime: '', flightHours: null, dutyHours: null,
      aircraftType: '', hotelName: '', assignment: '', comments: '',
      rawLine: normalized.substring(pos, Math.min(pos + 80, normalized.length)),
      crossesMidnight: false, overnight: false, sortDatetime: `${parsedDate}T00:00:00`,
      entryType: st.entryType, crewStatusCode: st.code, crewStatusLabel: st.label,
      activityLabel: st.label,
    });
  }

  const nfRegex = new RegExp(`\\b(${NON_FLIGHT_TOKEN})\\b(?![\\/\\-])`, 'gi');
  let nfm: RegExpExecArray | null;
  while ((nfm = nfRegex.exec(normalized)) !== null) {
    const code = nfm[1].toUpperCase();
    if (code === 'APR') continue;
    const pos = nfm.index;
    const charBefore = pos > 0 ? normalized[pos - 1] : ' ';
    if (charBefore === '/' || charBefore === '-') continue;
    const charAfter = normalized[pos + code.length] ?? ' ';
    if (charAfter === '-') continue;
    const before40 = normalized.substring(Math.max(0, pos - 40), pos).toLowerCase();
    if (before40.includes('assignment') || before40.includes('hotel')) continue;
    const date = resolveDateForAnchor(pos);
    if (!date) continue;
    const dup = entries.some(
      (e) => e.date === date && !e.isFlight && e.flightNumber === code && e.departureAirport === '',
    );
    if (dup) continue;
    totalRawAnchors++;
    const st = resolveCrewStatusFromActivityCode(code);
    entries.push({
      date, activityType: code, isFlight: false, flightNumber: code, pairingCode: '',
      crewRole: '', operationType: '', reportTime: '', departureAirport: '', departureTime: '',
      arrivalAirport: '', arrivalTime: '', debriefTime: '', flightHours: null, dutyHours: null,
      aircraftType: '', hotelName: '', assignment: '', comments: '',
      rawLine: normalized.substring(pos, Math.min(pos + 80, normalized.length)),
      crossesMidnight: false, overnight: false, sortDatetime: `${date}T00:00:00`,
      entryType: st.entryType, crewStatusCode: st.code, crewStatusLabel: st.label,
      activityLabel: st.label,
    });
  }

  const deduped = dedupeEntries(entries);
  const stats: CrewRosterParseStats = {
    totalEntries: deduped.length,
    totalRawAnchors,
    totalFlights: deduped.filter((e) => e.isFlight).length,
    totalDO: deduped.filter((e) => e.entryType === 'day_off').length,
    totalStandby: deduped.filter((e) => e.entryType === 'standby').length,
    totalAPR: deduped.filter((e) => e.activityType === 'APR' || e.crewStatusCode === 'APR').length,
    totalReserve: deduped.filter((e) => e.entryType === 'reserve').length,
    totalOnCall: deduped.filter((e) => e.entryType === 'on_call').length,
    totalPresentation: deduped.filter((e) => e.entryType === 'duty_start').length,
    totalAfterDedup: deduped.length,
    unrecognizedSnippetCount: devUnrecognizedLines.length,
  };
  return { entries: deduped, stats, textByDay, devUnrecognizedLines };
}

// ─── PDF text extraction (Node.js only — sem web worker) ─────────────────────

type PdfTextItem = { str?: string; transform?: number[] };

function sortPdfTextItems(items: PdfTextItem[]): Array<{ str: string; x: number; y: number }> {
  const pieces: Array<{ str: string; x: number; y: number }> = [];
  for (const item of items) {
    const raw = item.str;
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const t = item.transform;
    if (!t || t.length < 6) continue;
    pieces.push({ str: raw.trim(), x: t[4], y: t[5] });
  }
  const lineTol = 6;
  pieces.sort((a, b) => {
    if (Math.abs(a.y - b.y) > lineTol) return b.y - a.y;
    return a.x - b.x;
  });
  return pieces;
}

async function extractTextFromPdf(pdfBytes: ArrayBuffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as any;
  pdfjs.GlobalWorkerOptions.workerSrc = '';
  const doc = await pdfjs.getDocument({ data: pdfBytes, verbosity: 0 }).promise;
  const chunks: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const sorted = sortPdfTextItems(content.items as PdfTextItem[]);
    const pageText = sorted.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
    if (pageText) chunks.push(pageText);
  }
  return chunks.join('\n');
}

// ─── Header parser ────────────────────────────────────────────────────────────

interface RosterHeader {
  crewName: string;
  employeeCode: string;
  crewGroupCode: string;
  baseAirport: string;
  crewRole: string;
  rosterStartDate: string;
  rosterEndDate: string;
  flyingHoursTotal: number | null;
  dutyHoursTotal: number | null;
}

function parseHoursMinutes(val: string): number {
  const parts = val.split(/[.:]/);
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return Math.round((h + m / 60) * 100) / 100;
}

function parseHeader(text: string): RosterHeader {
  const header: RosterHeader = {
    crewName: '', employeeCode: '', crewGroupCode: '', baseAirport: '', crewRole: '',
    rosterStartDate: '', rosterEndDate: '', flyingHoursTotal: null, dutyHoursTotal: null,
  };
  const nameMatch = text.match(/(?:Name|Crew|Tripulante)[:\s]+([A-Z][A-Za-zÀ-ÿ\s,.-]+)/i);
  if (nameMatch) header.crewName = nameMatch[1].trim();
  const empMatch = text.match(/(?:Emp(?:loyee)?|Matr[ií]cula|Code)[:\s#]*(\d{4,8})/i);
  if (empMatch) header.employeeCode = empMatch[1];
  const groupMatch = text.match(/\b(JJ[A-Z]{2}\d{3})\b/i);
  if (groupMatch) header.crewGroupCode = groupMatch[1].toUpperCase();
  const baseMatch = text.match(/(?:Base|Home\s?Base)[:\s]+([A-Z]{3})/i);
  if (baseMatch) header.baseAirport = baseMatch[1].toUpperCase();
  if (!header.baseAirport) {
    const pipeMatch = text.match(/\|\s*([A-Z]{3})\s*\|\s*(CC|CA|FO|SO|CM|FA)/i);
    if (pipeMatch) header.baseAirport = pipeMatch[1].toUpperCase();
  }
  const roleMatch = text.match(/(?:Rank|Fun[çc][ãa]o|Position|Crew\s?Role)[:\s]+([A-Z]{2,5})/i);
  if (roleMatch) header.crewRole = roleMatch[1].toUpperCase();
  if (!header.crewRole) {
    const pipeRole = text.match(/\|\s*(CC|CA|FO|SO|CM|FA)\s/i);
    if (pipeRole) header.crewRole = pipeRole[1].toUpperCase();
  }
  const periodMatch = text.match(/(\d{1,2}[\s-][A-Za-z]{3}[\s-]\d{2,4})\s*(?:[-–to]+)\s*(\d{1,2}[\s-][A-Za-z]{3}[\s-]\d{2,4})/i);
  if (periodMatch) {
    header.rosterStartDate = parseRosterDateToken(periodMatch[1].replace(/\s+/g, '-')) || periodMatch[1];
    header.rosterEndDate = parseRosterDateToken(periodMatch[2].replace(/\s+/g, '-')) || periodMatch[2];
  }
  const fhMatch = text.match(/(?:FLYING|Flight)\s*(?:HRS?|Hours?|Time)[:\s|]*(\d+:\d{2})/i);
  if (fhMatch) header.flyingHoursTotal = parseHoursMinutes(fhMatch[1]);
  const dhMatch = text.match(/(?:DUTY)\s*(?:HRS?|Hours?|Time)[:\s|]*(\d+:\d{2})/i);
  if (dhMatch) header.dutyHoursTotal = parseHoursMinutes(dhMatch[1]);
  if (!header.crewName) {
    const nameFromPipe = text.match(/([A-Z][A-Z\s]{3,30})\s*\|\s*\d{4,8}/);
    if (nameFromPipe) header.crewName = nameFromPipe[1].trim();
  }
  if (!header.employeeCode) {
    const empFromPipe = text.match(/\|\s*(\d{4,8})\s*\|/);
    if (empFromPipe) header.employeeCode = empFromPipe[1];
  }
  return header;
}

function mapParsedToEntry(p: CrewRosterParsedEntry) {
  return {
    date: p.date, activityType: p.activityType, isFlight: p.isFlight,
    flightNumber: p.flightNumber, pairingCode: p.pairingCode, crewRole: p.crewRole,
    operationType: p.operationType, reportTime: p.reportTime,
    departureAirport: p.departureAirport, departureTime: p.departureTime,
    arrivalAirport: p.arrivalAirport, arrivalTime: p.arrivalTime,
    debriefTime: p.debriefTime, flightHours: p.flightHours, dutyHours: p.dutyHours,
    aircraftType: p.aircraftType, hotelName: p.hotelName, assignment: p.assignment,
    comments: p.comments, rawLine: p.rawLine, crossesMidnight: p.crossesMidnight,
    overnight: p.overnight, sortDatetime: p.sortDatetime, entryType: p.entryType,
    crewStatusCode: p.crewStatusCode, crewStatusLabel: p.crewStatusLabel,
    activityLabel: p.activityLabel,
  };
}

// ─── SHA-256 helper ───────────────────────────────────────────────────────────

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Main import function (servidor — sem browser APIs) ───────────────────────

export async function importPdfArrayBufferWithClient(opts: {
  supabaseClient: SupabaseClient;
  fileName: string;
  arrayBuffer: ArrayBuffer;
  extractedTextOverride?: string;
  userId: string;
  importOrigin: CorporateAutomationImportOrigin;
  automationRunId?: string | null;
}): Promise<WorkerPdfImportResult> {
  const { supabaseClient, fileName, arrayBuffer, extractedTextOverride, userId, importOrigin, automationRunId } = opts;

  const empty = (error: string): WorkerPdfImportResult =>
    ({ success: false, rosterId: null, insertedCount: 0, error });

  try {
    const fileSizeBytes = arrayBuffer.byteLength;
    const contentSha256 = await sha256Hex(arrayBuffer);

    // Dedupe por hash
    const { data: dupByHash } = await supabaseClient
      .from('imported_rosters')
      .select('id')
      .eq('user_id', userId)
      .eq('content_sha256', contentSha256)
      .limit(1)
      .maybeSingle();
    if ((dupByHash as { id: string } | null)?.id) {
      return { success: true, duplicate: true, rosterId: (dupByHash as { id: string }).id, insertedCount: 0, error: null };
    }

    // Dedupe por metadados
    const { data: dupByMeta } = await supabaseClient
      .from('imported_rosters')
      .select('id')
      .eq('user_id', userId)
      .eq('file_name', fileName)
      .eq('file_size_bytes', fileSizeBytes)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if ((dupByMeta as { id: string } | null)?.id) {
      return { success: true, duplicate: true, rosterId: (dupByMeta as { id: string }).id, insertedCount: 0, error: null };
    }

    // Upload storage
    const storagePath = `${userId}/${Date.now()}-${fileName}`;
    const isHtmlSource = Boolean(extractedTextOverride) || /\.html?$/i.test(fileName);
    const uploadType = isHtmlSource ? 'text/html' : 'application/pdf';
    const blob = new Blob([new Uint8Array(arrayBuffer)], { type: uploadType });
    await supabaseClient.storage.from('crew-rosters').upload(storagePath, blob, { contentType: uploadType, upsert: true });

    // Extração de texto
    let extractedText: string;
    if (extractedTextOverride !== undefined && extractedTextOverride.trim().length > 0) {
      extractedText = extractedTextOverride;
    } else {
      try {
        extractedText = await extractTextFromPdf(arrayBuffer);
      } catch (err) {
        return empty(`Falha ao extrair texto do PDF: ${err instanceof Error ? err.message : 'erro'}`);
      }
    }

    if (!extractedText.trim()) {
      return empty(isHtmlSource ? 'O HTML/texto extraído está vazio.' : 'O PDF não contém texto extraível.');
    }

    const header = parseHeader(extractedText);
    const normalized = normalizeCrewRosterPdfText(extractedText);
    const { entries: parsed, stats } = parseCrewRosterEntries(normalized);
    const entries = parsed.map(mapParsedToEntry);

    if (entries.length === 0) {
      return empty('Nenhum voo ou atividade identificado no PDF.');
    }

    const isOfficialPdf = isOfficialCrewRosterFileName(fileName);

    // Desativar escalas anteriores
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deactivatedRows } = await (supabaseClient.from('imported_rosters') as any)
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
      .select('id');
    const deactivatedRosterIds = ((deactivatedRows as Array<{ id: string }> | null) ?? []).map((r) => r.id);

    // Criar roster
    const sourceMsg = `corp-automation-${importOrigin}-${Date.now()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rosterRow, error: rosterError } = await (supabaseClient.from('imported_rosters') as any).insert({
      user_id: userId,
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      content_sha256: contentSha256,
      source_message_id: sourceMsg,
      storage_path: storagePath,
      name: header.crewName || null,
      employee_code: header.employeeCode || null,
      crew_group_code: header.crewGroupCode || null,
      base_airport: header.baseAirport || null,
      crew_role: header.crewRole || null,
      roster_start_date: header.rosterStartDate || null,
      roster_end_date: header.rosterEndDate || null,
      flying_hours_total: header.flyingHoursTotal,
      duty_hours_total: header.dutyHoursTotal,
      raw_text_excerpt: extractedText.substring(0, 2000),
      parser_version: PARSER_VERSION,
      import_origin: importOrigin,
      roster_provider: 'corporate_portal',
      source_type: isOfficialPdf ? 'official_pdf' : 'pdf',
      import_status: 'processing',
      parsed_count: entries.length,
      is_active: true,
      is_official_crew_roster_pdf: isOfficialPdf,
      ...(automationRunId ? { automation_run_id: automationRunId } : {}),
    }).select('id').single();

    if (rosterError) return empty(`Erro ao criar roster: ${rosterError.message}`);
    const rosterId = (rosterRow as { id: string } | null)?.id ?? null;

    if (rosterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: metaErr } = await (supabaseClient.from('imported_rosters') as any)
        .update({ roster_source: 'corporate_portal', roster_status: 'active' })
        .eq('id', rosterId);
      if (metaErr) {
        console.warn('[pdfImportWorker] roster_source/roster_status skipped (migration pendente):', metaErr.message);
      }
    }

    if (rosterId && deactivatedRosterIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseClient.from('imported_rosters') as any)
        .update({ superseded_by_roster_id: rosterId })
        .in('id', deactivatedRosterIds);
    }

    // Montar linhas
    const rows = entries.map((e) => ({
      user_id: userId,
      roster_id: rosterId,
      date: e.date,
      flight_number: e.flightNumber,
      departure: e.departureAirport || 'TBD',
      arrival: e.arrivalAirport || 'TBD',
      departure_time: e.departureTime || '00:00',
      arrival_time: e.arrivalTime || '00:00',
      status: 'scheduled',
      airline: 'LATAM',
      report_time: e.reportTime || null,
      duty_hours: e.dutyHours,
      activity_type: e.activityType,
      is_flight: e.isFlight,
      pairing_code: e.pairingCode || null,
      crew_role: e.crewRole || null,
      operation_type: e.operationType || null,
      departure_airport: e.departureAirport || null,
      arrival_airport: e.arrivalAirport || null,
      debrief_time: e.debriefTime || null,
      flight_hours: e.flightHours,
      aircraft_type: e.aircraftType || null,
      hotel_name: e.hotelName || null,
      assignment: e.assignment || null,
      comments: e.comments || null,
      raw_line: e.rawLine || null,
      source_pdf_path: storagePath,
      crosses_midnight: e.crossesMidnight,
      overnight: e.overnight,
      sort_datetime: e.sortDatetime || null,
      entry_type: e.entryType,
      crew_status_code: e.crewStatusCode || null,
      crew_status_label: e.crewStatusLabel || null,
      activity_label: e.activityLabel || null,
    }));

    const { rows: insertRows } = dedupeScheduleEntryRows(rows);

    let insertedCount = 0;
    if (insertRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabaseClient.from('schedule_entries') as any).insert(insertRows);
      if (insertError) {
        for (const row of insertRows) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: rowErr } = await (supabaseClient.from('schedule_entries') as any).insert([row]);
          if (!rowErr) insertedCount++;
        }
      } else {
        insertedCount = insertRows.length;
      }
    }

    // Atualizar status do roster
    const syncNow = new Date().toISOString();
    if (rosterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseClient.from('imported_rosters') as any).update({
        import_status: insertedCount > 0 ? 'success' : 'error',
        inserted_count: insertedCount,
        import_error: insertedCount === 0 ? 'Falha ao inserir registros' : null,
        synced_at: insertedCount > 0 ? syncNow : null,
        last_sync_at: insertedCount > 0 ? syncNow : null,
        sync_status: insertedCount > 0 ? 'success' : 'error',
      }).eq('id', rosterId);
    }

    // Atualizar perfil
    if (header.crewName || header.baseAirport) {
      const updates: Record<string, unknown> = { airline: 'LATAM' };
      if (header.crewName) updates.name = header.crewName;
      await supabaseClient.from('profiles').update(updates).eq('user_id', userId);
    }

    // Atualizar user_roster_connection
    const connectionType: UserRosterConnectionType = 'corporate_pdf';
    if (rosterId && insertedCount > 0) {
      const nowIso = new Date().toISOString();
      const { data: existingConn } = await supabaseClient
        .from('user_roster_connection')
        .select('connected_at, is_auto_update_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      const ex = existingConn as { connected_at: string | null; is_auto_update_enabled: boolean } | null;
      await supabaseClient.from('user_roster_connection').upsert(
        {
          user_id: userId,
          connection_type: connectionType,
          connection_status: 'connected',
          roster_connection_state: 'roster_connected',
          connected_at: ex?.connected_at ?? nowIso,
          last_checked_at: nowIso,
          last_successful_import_at: nowIso,
          current_active_roster_id: rosterId,
          last_error: null,
          is_auto_update_enabled: ex?.is_auto_update_enabled ?? true,
        },
        { onConflict: 'user_id' },
      );
    }

    void stats; // stats disponível para debug se necessário

    return { success: true, rosterId, insertedCount, error: null };
  } catch (err) {
    return empty(err instanceof Error ? err.message : 'Erro desconhecido');
  }
}

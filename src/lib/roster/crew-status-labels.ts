/**
 * Situação do tripulante (CrewRoster LATAM / iFlight Neo) → rótulos em português popular para a UI.
 * Códigos brutos permanecem em crew_status_code; exibição usa crew_status_label.
 *
 * ACTIVITY_CODE_MAP é a lista oficial de códigos "iFlight Neo" (coluna "Código iFlight Neo" da
 * planilha de siglas da LATAM) — é o que aparece de fato no texto extraído do CrewRosterReport,
 * não os códigos internos AIMS. Cobre TODAS as siglas conhecidas pra evitar que dias da escala
 * sumam da importação por não estarem numa lista curta.
 */

import { cn } from '@/lib/utils';

export type NormalizedEntryType =
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

/** Situação em voo (OP/PS) ou código de atividade. */
export function resolveCrewStatusFromFlightOperation(operationType: string): { code: string; label: string } {
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
 * Todas as siglas "Código iFlight Neo" da planilha oficial de referência (SIGLAS IFLIGHT NEO),
 * agrupadas por categoria. Vários códigos internos AIMS diferentes colapsam no mesmo código
 * iFlight Neo — aqui fica só o rótulo mais representativo em português.
 */
const ACTIVITY_CODE_MAP: Record<string, ActivityDef> = {
  // ── Folga / dia livre ─────────────────────────────────────────────────────
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

  // ── Férias ─────────────────────────────────────────────────────────────────
  VC: { label: 'Férias', entryType: 'vacation' },

  // ── Reserva (aeroporto) ──────────────────────────────────────────────────
  ASB: { label: 'Reserva', entryType: 'reserve' },
  ASB1: { label: 'Reserva', entryType: 'reserve' },
  ASB2: { label: 'Reserva', entryType: 'reserve' },

  // ── Sobreaviso (em casa) ─────────────────────────────────────────────────
  HSB: { label: 'Sobreaviso', entryType: 'standby' },
  HSBE: { label: 'Sobreaviso estendido', entryType: 'standby' },

  // ── Apresentação / operacional ───────────────────────────────────────────
  APR: { label: 'Apresentação', entryType: 'duty_start' },
  CDM: { label: 'Corte dos motores', entryType: 'operational' },
  OWN: { label: 'Own way travel', entryType: 'operational' },
  LOSA: { label: 'Registro de observações operacionais', entryType: 'operational' },
  REP: { label: 'Repouso pós jornada', entryType: 'operational' },
  OWC: { label: 'Solicitação de alteração da própria escala', entryType: 'operational' },
  BUS: { label: 'Transporte', entryType: 'operational' },
  EXT_JJ: { label: 'A serviço no exterior', entryType: 'operational' },

  // ── Blank / intervalo ────────────────────────────────────────────────────
  OFF: { label: 'Intervalo de escala', entryType: 'blank' },
  BKF: { label: 'Intervalo para refeição', entryType: 'blank' },

  // ── Atraso ───────────────────────────────────────────────────────────────
  ATZ: { label: 'Atraso de tripulante', entryType: 'delay' },
  ATZJ: { label: 'Atraso justificado', entryType: 'delay' },

  // ── Sem comparecimento ───────────────────────────────────────────────────
  FMF: { label: 'Acompanhamento médico familiar', entryType: 'no_show' },
  LCH: { label: 'Audiência na justiça', entryType: 'no_show' },
  NSC: { label: 'Ausência chefia', entryType: 'no_show' },
  NSS: { label: 'Ausência universidade', entryType: 'no_show' },
  JI: { label: 'Interrupção de jornada', entryType: 'no_show' },
  JIJ: { label: 'Interrupção de jornada justificada', entryType: 'no_show' },
  NS: { label: 'Não compareceu', entryType: 'no_show' },
  NSP: { label: 'Não compareceu — publicado', entryType: 'no_show' },
  NSJ: { label: 'Não compareceu acompanhado', entryType: 'no_show' },

  // ── Saúde / afastamento médico ───────────────────────────────────────────
  INSS: { label: 'Afastado pelo INSS', entryType: 'sick' },
  SW: { label: 'Afastamento acidente de trabalho', entryType: 'sick' },
  SICA: { label: 'Dispensa ambulatório', entryType: 'sick' },
  SICK: { label: 'Dispensa médica', entryType: 'sick' },
  JIS: { label: 'Interrupção de jornada — dispensa médica', entryType: 'sick' },
  ME: { label: 'Exame médico', entryType: 'medical_exam' },
  PCMA: { label: 'Perda certificado médico aeronáutico', entryType: 'sick' },

  // ── Licenças / dispensas ─────────────────────────────────────────────────
  CAF: { label: 'Ação a fadiga', entryType: 'leave' },
  LFS: { label: 'Disp. segurança voo', entryType: 'leave' },
  DSVD: { label: 'Disp. segurança voo (R$)', entryType: 'leave' },
  LSNA: { label: 'Dispensa sindical', entryType: 'leave' },
  FTG: { label: 'Fadiga', entryType: 'leave' },
  LNP: { label: 'Licença não remunerada', entryType: 'leave' },
  LEP: { label: 'Licença remunerada', entryType: 'leave' },
  SAER: { label: 'Saúde aeroespacial', entryType: 'leave' },
  SAED: { label: 'Saúde aeroespacial (R$)', entryType: 'leave' },

  // ── Administrativo ───────────────────────────────────────────────────────
  ADM: { label: 'Administração', entryType: 'admin' },
  OPT: { label: 'Administrativo eventual', entryType: 'admin' },
  CH: { label: 'Audiência chefia', entryType: 'admin' },
  CEQ: { label: 'Disp. chefia equipamento', entryType: 'admin' },
  OPCT: { label: 'Copiloto eventual para treinamento', entryType: 'admin' },
  OPR: { label: 'Operações', entryType: 'admin' },
  PSNA: { label: 'Representantes sindicais', entryType: 'admin' },
  SFTY: { label: 'Safety — segurança de voo', entryType: 'admin' },
  MT: { label: 'Reunião', entryType: 'admin' },

  // ── Documentos ───────────────────────────────────────────────────────────
  VUSA: { label: 'Renovação de visto EUA', entryType: 'document_renewal' },
  PASS: { label: 'Renovação de passaporte', entryType: 'document_renewal' },
  CMA: { label: 'Certificado médico aeronáutico', entryType: 'document_renewal' },
  WCCF: { label: 'Sem cartão de capacidade física', entryType: 'document_renewal' },
  WCHT: { label: 'Sem cartão de habilitação técnica', entryType: 'document_renewal' },

  // ── Pagamento ────────────────────────────────────────────────────────────
  DCGH: { label: 'Deslocamento Congonhas', entryType: 'payment' },
  DGRU: { label: 'Deslocamento Guarulhos', entryType: 'payment' },
  TEMP: { label: 'Temporary duty', entryType: 'payment' },

  // ── Disciplinar ──────────────────────────────────────────────────────────
  SUSP: { label: 'Suspensão', entryType: 'disciplinary' },

  // ── Troca ────────────────────────────────────────────────────────────────
  SWAP: { label: 'Troca entre tripulantes', entryType: 'swap' },

  // ── Treinamento em solo / simulador / online ────────────────────────────
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

  // ── Online ───────────────────────────────────────────────────────────────
  WEB: { label: 'Ensino a distância', entryType: 'training' },
  WEB1: { label: 'Ensino a distância 1', entryType: 'training' },
  WEB2: { label: 'Ensino a distância 2', entryType: 'training' },
  WEB3: { label: 'Ensino a distância 3', entryType: 'training' },
  WEB4: { label: 'Treinamento online corporativo', entryType: 'training' },
  ONTR: { label: 'Treinamentos online', entryType: 'training' },
  SGSO: { label: 'Sistema de gerenciamento da segurança operacional', entryType: 'training' },
  ING: { label: 'Recheck de idiomas', entryType: 'training' },

  // ── Disponibilidade ──────────────────────────────────────────────────────
  AVL_JJ: { label: 'Disponível p/ voo', entryType: 'other_activity' },

  // ── Não utilizado / diversos ─────────────────────────────────────────────
  CLA: { label: 'Atividade administrativa', entryType: 'other_activity' },
  OTH: { label: 'Outros', entryType: 'other_activity' },
  CNL: { label: 'Voo cancelado', entryType: 'other_activity' },
};

/** Tokens historicamente aceitos como aliases de outros códigos. */
const ALIASES: Record<string, string> = {
  STANDBY: 'HSB',
  STBY: 'HSB',
  SBY: 'HSB',
};

/** Bases da LATAM Brasil — usadas pra reconhecer códigos com sufixo de base (ex.: CRMBSB). */
export const BASE_SUFFIXES = ['BSB', 'GRU', 'CGH', 'GIG', 'SDU', 'POA', 'CNF', 'REC', 'FOR', 'SSA', 'VCP', 'NAT', 'BEL', 'MAO', 'CWB'];

/** Códigos de treinamento observados com sufixo de base anexado (ex.: CRM → CRMBSB). */
export const BASE_SUFFIXABLE_CODES = ['CRM', 'CRMT'];

/** Combinações código+base (ex.: CRMBSB, CRMGRU…) — usadas pelo parser pra reconhecer o token bruto. */
export const BASE_SUFFIXED_TOKENS: string[] = BASE_SUFFIXABLE_CODES.flatMap((code) =>
  BASE_SUFFIXES.map((base) => `${code}${base}`),
);

export function resolveCrewStatusFromActivityCode(
  code: string,
): { code: string; label: string; entryType: NormalizedEntryType } {
  const c = code.trim().toUpperCase();

  const aliased = ALIASES[c];
  const direct = ACTIVITY_CODE_MAP[aliased ?? c];
  if (direct) return { code: c, label: direct.label, entryType: direct.entryType };

  // Códigos de treinamento com sufixo de base (ex.: CRMBSB = CRM em Brasília).
  for (const base of BASE_SUFFIXES) {
    if (c.length > base.length && c.endsWith(base)) {
      const prefix = c.slice(0, c.length - base.length);
      const def = ACTIVITY_CODE_MAP[prefix];
      if (def) return { code: c, label: `${def.label} (${base})`, entryType: def.entryType };
    }
  }

  return { code: c, label: c, entryType: 'other_activity' };
}

/** Todos os códigos reconhecidos (base pra regex do parser) — inclui aliases. */
export const KNOWN_ACTIVITY_CODES: string[] = [
  ...Object.keys(ACTIVITY_CODE_MAP),
  ...Object.keys(ALIASES),
];

/** Função de cabine / cockpit → texto amigável */
export function formatCrewRoleLabel(role: string | null | undefined): string {
  if (!role?.trim()) return '—';
  const r = role.toUpperCase();
  const map: Record<string, string> = {
    CC: 'Comissário',
    CA: 'Comandante',
    FO: 'Copiloto',
    SO: 'Segundo oficial',
    CM: 'Comissário',
    FA: 'Comissário',
    PUR: 'Chefe de cabine',
    CCM: 'Chefe de cabine',
  };
  return map[r] || role;
}

const BADGE_BASE = 'text-[10px] font-medium px-2 py-0.5 rounded-md border whitespace-nowrap';

export function crewStatusBadgeClassName(label: string): string {
  const L = label.toLowerCase();
  if (L === 'em operação') return cn(BADGE_BASE, 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25');
  if (L === 'reposicionamento') return cn(BADGE_BASE, 'bg-amber-500/12 text-amber-800 dark:text-amber-200 border-amber-500/25');
  if (L.startsWith('folga')) return cn(BADGE_BASE, 'bg-muted text-muted-foreground border-border');
  if (L === 'férias') return cn(BADGE_BASE, 'bg-orange-500/12 text-orange-800 dark:text-orange-200 border-orange-500/25');
  if (L === 'reserva') return cn(BADGE_BASE, 'bg-blue-500/12 text-blue-800 dark:text-blue-200 border-blue-500/25');
  if (L === 'sobreaviso' || L === 'sobreaviso estendido') return cn(BADGE_BASE, 'bg-violet-500/12 text-violet-800 dark:text-violet-200 border-violet-500/25');
  if (L === 'apresentação') return cn(BADGE_BASE, 'bg-cyan-500/12 text-cyan-900 dark:text-cyan-100 border-cyan-500/25');
  if (L === 'standby') return cn(BADGE_BASE, 'bg-secondary text-foreground border-border');
  return cn(BADGE_BASE, 'bg-primary/8 text-primary border-primary/20');
}

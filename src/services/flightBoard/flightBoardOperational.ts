/**
 * Agregador operacional do Flight Board Pro — fonte primária: escala importada.
 * OpenSky / edge function = enriquecimento opcional (nunca erro fatal por ausência).
 *
 * Data operacional: filtra por `ScheduleEntry.date` (YYYY-MM-DD), a mesma chave usada nas
 * células do calendário. Trechos que cruzam meia-noite ficam no dia da partida salvo pelo
 * parser; se o segundo segmento for gravado no dia seguinte, aparece nesse dia (coerente
 * com `groupIntoDutyPeriods` / calendário).
 */

import type { ScheduleEntry } from "@/hooks/useScheduleData";
import type { FlightRaw, FlightNormalized } from "./types";
import { normalizeFlightData } from "./flightService";

/** --- Tipos de classificação do dia (alinhado ao calendário operacional) --- */

export type DayOperationKind =
  | "no_entries_for_date"
  | "non_flight_operational"
  | "has_flight_segments";

export interface DayClassification {
  kind: DayOperationKind;
  /** Resumo textual das atividades não-voo (ex.: D0, RES, HOTEL) */
  nonFlightSummary?: string;
  /** Total de linhas na escala para a data */
  entryCount: number;
}

/** Estado resolvido para a UI (antes de enriquecimento live) */
export type FlightBoardUiKind =
  | "loading_schedule"
  | "no_schedule_loaded"
  | "no_entries_for_date"
  | "non_flight_day"
  | "no_flights_at_airport"
  | "has_planned_flights";

export interface FlightBoardResolvedState {
  uiKind: FlightBoardUiKind;
  /** Voos normalizados a partir da escala (base) */
  departures: FlightNormalized[];
  arrivals: FlightNormalized[];
  classification: DayClassification;
  /** Mensagem neutra (sem erro) */
  neutralMessage?: string;
  /** Detalhe opcional (ex.: tipos de atividade) */
  neutralDetail?: string;
}

const AIRPORT_CTX: Record<string, { name: string; city: string }> = {
  GRU: { name: "Guarulhos", city: "São Paulo" },
  CGH: { name: "Congonhas", city: "São Paulo" },
  GIG: { name: "Galeão", city: "Rio de Janeiro" },
  BSB: { name: "Brasília", city: "Brasília" },
  CNF: { name: "Confins", city: "Belo Horizonte" },
};

/** --- Funções puras --- */

export function getOperationalEntriesForDate(
  schedule: ScheduleEntry[],
  dateIso: string
): ScheduleEntry[] {
  return schedule.filter((e) => e.date === dateIso);
}

export function classifyDayOperation(entries: ScheduleEntry[]): DayClassification {
  const entryCount = entries.length;
  if (entryCount === 0) {
    return { kind: "no_entries_for_date", entryCount: 0 };
  }

  const flightRows = entries.filter((e) => e.is_flight);
  if (flightRows.length > 0) {
    return { kind: "has_flight_segments", entryCount };
  }

  const labels = entries.map((e) => {
    const t = (e.activity_type || "").trim();
    return t || (e.raw_line ? e.raw_line.slice(0, 40) : "Atividade");
  });
  const nonFlightSummary = [...new Set(labels)].slice(0, 6).join(" · ");

  return {
    kind: "non_flight_operational",
    entryCount,
    nonFlightSummary,
  };
}

/**
 * Mensagens para dias sem trecho de voo (mesma regra do calendário: só atividades).
 * Distingue folga/D0 de outros códigos operacionais.
 */
export function buildNonFlightDayCopy(classification: DayClassification): {
  title: string;
  detail: string;
} {
  const summary = classification.nonFlightSummary ?? "";
  const upper = summary.toUpperCase();
  const looksLikeFolga =
    /\b(D0|FOLGA|DAY\s*OFF|OFF|DSR)\b/i.test(summary) ||
    /\b(folga|descanso)\b/i.test(summary);

  if (looksLikeFolga || upper.includes("D0")) {
    return {
      title: "Você está em folga nesta data.",
      detail: summary
        ? `Conforme a escala: ${summary}. Nenhum trecho de voo previsto.`
        : "Nenhum trecho de voo previsto para este dia operacional.",
    };
  }

  return {
    title: "Nenhum voo operacional previsto para esta data.",
    detail: summary
      ? `A escala do dia contém apenas atividades sem trecho de voo: ${summary}.`
      : "A escala do dia contém apenas atividades sem trecho de voo (serviço, reserva, treinamento etc.).",
  };
}

/** Normaliza código IATA 3 letras a partir do texto da escala */
export function normalizeIataCode(raw: string | null | undefined): string {
  if (!raw || !String(raw).trim()) return "UNK";
  const u = String(raw).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(u)) return u;
  const m = u.match(/\b([A-Z]{3})\b/);
  if (m) return m[1];
  const letters = u.replace(/[^A-Z]/g, "");
  if (letters.length >= 3) return letters.slice(0, 3);
  return "UNK";
}

function inferCarrierCode(flightNumber: string, airline: string | null): string {
  const fn = (flightNumber || "").replace(/\s/g, "").toUpperCase();
  const m = fn.match(/^([A-Z]{2})/);
  if (m) return m[1];
  if (airline && airline.trim().length >= 2) return airline.trim().slice(0, 2).toUpperCase();
  return "LA";
}

/** Converte entrada da escala em FlightRaw (fonte roster) */
export function scheduleEntryToFlightRaw(entry: ScheduleEntry): FlightRaw {
  const origin = normalizeIataCode(entry.departure_airport || entry.departure);
  const destination = normalizeIataCode(entry.arrival_airport || entry.arrival);
  const depTime = (entry.departure_time || "00:00").slice(0, 5);
  const arrTime = (entry.arrival_time || "00:00").slice(0, 5);
  const date = entry.date;
  const depIso = `${date}T${depTime.padStart(5, "0")}:00.000Z`;
  const arrIso = `${date}T${arrTime.padStart(5, "0")}:00.000Z`;
  const carrier = inferCarrierCode(entry.flight_number, entry.airline);

  return {
    id: entry.id,
    flightNumber: entry.flight_number || "—",
    carrierCode: carrier,
    origin,
    destination,
    departure: {
      scheduled: depTime,
      actual: null,
      terminal: null,
      gate: null,
      scheduledISO: depIso,
      actualISO: null,
    },
    arrival: {
      scheduled: arrTime,
      actual: null,
      terminal: null,
      gate: null,
      scheduledISO: arrIso,
      actualISO: null,
    },
    aircraftCode: entry.aircraft_type ?? null,
    status: "SCHEDULED",
    airportInfo: buildAirportContext(origin, destination),
  };
}

export function buildAirportContext(
  origin: string,
  destination: string
): FlightRaw["airportInfo"] {
  const dep = AIRPORT_CTX[origin];
  const arr = AIRPORT_CTX[destination];
  return {
    departure: dep
      ? { name: dep.name, city: dep.city, country: "Brasil", timezone: "America/Sao_Paulo" }
      : { name: origin, city: origin, country: null, timezone: null },
    arrival: arr
      ? { name: arr.name, city: arr.city, country: "Brasil", timezone: "America/Sao_Paulo" }
      : { name: destination, city: destination, country: null, timezone: null },
  };
}

/** Extrai voos planejados da escala para o aeroporto e data (partidas e chegadas) */
export function extractPlannedFlightsFromSchedule(
  entries: ScheduleEntry[],
  airportCode: string,
  dateIso: string
): { departures: FlightNormalized[]; arrivals: FlightNormalized[] } {
  const upper = airportCode.toUpperCase();
  const flightEntries = entries.filter((e) => e.is_flight);
  const departures: FlightNormalized[] = [];
  const arrivals: FlightNormalized[] = [];

  for (const entry of flightEntries) {
    const raw = scheduleEntryToFlightRaw(entry);
    const relaxed = validateFlightDataRelaxed(raw, upper);
    if (!relaxed.valid) continue;

    const origin = raw.origin.toUpperCase();
    const dest = raw.destination.toUpperCase();

    if (origin === upper) {
      const n = normalizeFlightData(raw, dateIso, "departure", upper);
      if (n) {
        departures.push({
          ...n,
          aggregateSource: "roster",
          liveTrackingAvailable: Boolean(raw.tracking?.latitude != null),
        });
      }
    }
    if (dest === upper) {
      const n = normalizeFlightData(raw, dateIso, "arrival", upper);
      if (n) {
        arrivals.push({
          ...n,
          aggregateSource: "roster",
          liveTrackingAvailable: Boolean(raw.tracking?.latitude != null),
        });
      }
    }
  }

  departures.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);
  arrivals.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);
  return { departures, arrivals };
}

/** Validação mais tolerante para dados vindos da escala (parser varia) */
export function validateFlightDataRelaxed(
  raw: FlightRaw,
  airportCode: string
): { valid: boolean } {
  const fn = (raw.flightNumber || "").replace(/\s/g, "");
  if (fn.length < 2) return { valid: false };
  const o = raw.origin?.toUpperCase();
  const d = raw.destination?.toUpperCase();
  if (!o || !d || o === "UNK" || d === "UNK") return { valid: false };
  const isDep = o === airportCode.toUpperCase();
  const isArr = d === airportCode.toUpperCase();
  if (!isDep && !isArr) return { valid: false };
  return { valid: true };
}

export function resolveFlightBoardState(args: {
  scheduleLoading: boolean;
  schedule: ScheduleEntry[];
  dateIso: string;
  airportCode: string;
}): FlightBoardResolvedState {
  const { scheduleLoading, schedule, dateIso, airportCode } = args;

  if (scheduleLoading) {
    return {
      uiKind: "loading_schedule",
      departures: [],
      arrivals: [],
      classification: { kind: "no_entries_for_date", entryCount: 0 },
    };
  }

  if (!schedule.length) {
    return {
      uiKind: "no_schedule_loaded",
      departures: [],
      arrivals: [],
      classification: { kind: "no_entries_for_date", entryCount: 0 },
      neutralMessage: "Nenhuma escala carregada",
      neutralDetail: "Importe sua escala para visualizar o painel operacional desta data.",
    };
  }

  const entriesForDate = getOperationalEntriesForDate(schedule, dateIso);
  const classification = classifyDayOperation(entriesForDate);

  if (classification.kind === "no_entries_for_date") {
    return {
      uiKind: "no_entries_for_date",
      departures: [],
      arrivals: [],
      classification,
      neutralMessage: "Sem registros na escala para esta data",
      neutralDetail: "Selecione outra data ou confira o calendário mensal.",
    };
  }

  if (classification.kind === "non_flight_operational") {
    const copy = buildNonFlightDayCopy(classification);
    return {
      uiKind: "non_flight_day",
      departures: [],
      arrivals: [],
      classification,
      neutralMessage: copy.title,
      neutralDetail: copy.detail,
    };
  }

  const { departures, arrivals } = extractPlannedFlightsFromSchedule(
    entriesForDate,
    airportCode,
    dateIso
  );

  if (departures.length === 0 && arrivals.length === 0) {
    return {
      uiKind: "no_flights_at_airport",
      departures: [],
      arrivals: [],
      classification,
      neutralMessage: "Nenhuma operação neste aeroporto nesta data",
      neutralDetail:
        "Sua escala tem voos em outras bases nesta data, ou apenas atividades sem trecho neste aeroporto.",
    };
  }

  return {
    uiKind: "has_planned_flights",
    departures,
    arrivals,
    classification,
  };
}

/**
 * Mescla enriquecimento da edge (aeroporto + status + tracking/OpenSky) sobre a lista da escala.
 * Reaplica `normalizeFlightData` com o `FlightRaw` do servidor para que status, atraso, gate/terminal
 * (quando existirem no payload) e airportInfo passem para a UI.
 */
export function mergeEnrichmentIntoNormalized(
  base: FlightNormalized[],
  enrichment: FlightRaw[],
  dateIso: string,
  airportCode: string
): FlightNormalized[] {
  const byId = new Map(enrichment.map((r) => [r.id, r]));
  const upper = airportCode.toUpperCase();

  return base.map((f) => {
    const ex = byId.get(f.id);
    if (!ex) {
      return {
        ...f,
        liveTrackingAvailable: false,
        aggregateSource: "roster",
      };
    }

    const mode: "departure" | "arrival" = f.origin === upper ? "departure" : "arrival";
    const n = normalizeFlightData(ex, dateIso, mode, upper);
    if (!n) {
      const hasLive =
        ex.tracking != null &&
        ex.tracking.latitude != null &&
        ex.tracking.longitude != null;
      return {
        ...f,
        airportInfo: ex.airportInfo ?? f.airportInfo,
        tracking: ex.tracking ?? f.tracking,
        liveTrackingAvailable: hasLive,
        aggregateSource: "roster",
      };
    }

    const hasLive =
      ex.tracking != null &&
      ex.tracking.latitude != null &&
      ex.tracking.longitude != null;

    return {
      ...n,
      tracking: ex.tracking ?? n.tracking,
      airportInfo: ex.airportInfo ?? n.airportInfo,
      liveTrackingAvailable: hasLive,
      aggregateSource: hasLive ? "roster_enriched" : "roster",
    };
  });
}

/**
 * Modo "Base operacional": lista derivada diretamente do payload da edge (mesmos IDs da escala no servidor).
 */
export function buildNormalizedListsFromEnrichmentRaw(
  raw: FlightRaw[],
  dateIso: string,
  airportCode: string
): { departures: FlightNormalized[]; arrivals: FlightNormalized[] } {
  const upper = airportCode.toUpperCase();
  const departures: FlightNormalized[] = [];
  const arrivals: FlightNormalized[] = [];

  for (const r of raw) {
    if (r.origin?.toUpperCase() === upper) {
      const n = normalizeFlightData(r, dateIso, "departure", upper);
      if (n) {
        const hasLive =
          r.tracking != null &&
          r.tracking.latitude != null &&
          r.tracking.longitude != null;
        departures.push({
          ...n,
          tracking: r.tracking ?? n.tracking,
          airportInfo: r.airportInfo ?? n.airportInfo,
          liveTrackingAvailable: hasLive,
          aggregateSource: hasLive ? "roster_enriched" : "roster",
        });
      }
    }
    if (r.destination?.toUpperCase() === upper) {
      const n = normalizeFlightData(r, dateIso, "arrival", upper);
      if (n) {
        const hasLive =
          r.tracking != null &&
          r.tracking.latitude != null &&
          r.tracking.longitude != null;
        arrivals.push({
          ...n,
          tracking: r.tracking ?? n.tracking,
          airportInfo: r.airportInfo ?? n.airportInfo,
          liveTrackingAvailable: hasLive,
          aggregateSource: hasLive ? "roster_enriched" : "roster",
        });
      }
    }
  }

  departures.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);
  arrivals.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);
  return { departures, arrivals };
}

/** Alias solicitado na arquitetura (enriquecimento OpenSky / edge) */
export const enrichWithOpenSky = mergeEnrichmentIntoNormalized;

/** Motivo legível do estado (diagnóstico — não confundir com falha de API) */
export function getOperationalResolveReason(
  state: FlightBoardResolvedState,
  ctx: { dateIso: string; entriesForDate: ScheduleEntry[] }
): string {
  const n = ctx.entriesForDate.length;
  const act = ctx.entriesForDate
    .map((e) => (e.activity_type || "").trim() || e.raw_line?.slice(0, 48) || "—")
    .slice(0, 8);

  switch (state.uiKind) {
    case "loading_schedule":
      return "Aguardando leitura da escala local (não indica falha de API externa).";
    case "no_schedule_loaded":
      return "Sem escala importada; o painel depende dos dados locais (importe a escala).";
    case "no_entries_for_date":
      return `Nenhuma entrada com date=${ctx.dateIso} (mesma chave YYYY-MM-DD do calendário). Linhas na data: ${n}.`;
    case "non_flight_day":
      return `Dia operacional sem trecho de voo (${state.classification.nonFlightSummary ?? "só atividades"}). uiKind=non_flight_day — não é indisponibilidade de OpenSky. Atividades: [${act.join(", ")}].`;
    case "no_flights_at_airport":
      return "Há trechos de voo na data, mas nenhum com partida/chegada no aeroporto filtrado (ou há só atividades neste aeroporto).";
    case "has_planned_flights":
      return "Voos planejados na escala para esta data e aeroporto; enriquecimento live é opcional.";
    default:
      return "Estado não catalogado.";
  }
}

export function getUserFacingMessage(
  kind: FlightBoardUiKind,
  detail?: string
): { title: string; subtitle?: string } {
  switch (kind) {
    case "non_flight_day":
      return {
        title: "Nenhum voo operacional previsto para esta data",
        subtitle: detail,
      };
    case "no_entries_for_date":
      return {
        title: "Sem registros na escala para esta data",
        subtitle: detail,
      };
    case "no_flights_at_airport":
      return {
        title: "Nenhuma operação neste aeroporto nesta data",
        subtitle: detail,
      };
    case "no_schedule_loaded":
      return {
        title: "Nenhuma escala carregada",
        subtitle: detail,
      };
    default:
      return { title: "", subtitle: undefined };
  }
}

/** Log de diagnóstico (temporário) — inclui alinhamento com o “hoje” do dashboard */
export function logFlightBoardDiagnostics(payload: {
  selectedDate: string;
  airportCode: string;
  entriesCount: number;
  classification: DayClassification;
  plannedDep: number;
  plannedArr: number;
  enrichmentAttempted: boolean;
  enrichmentOk: boolean | null;
  enrichmentMatch: boolean;
  finalUiKind: FlightBoardUiKind;
  operationalTimezone: string;
  operationalTodayIso: string;
  matchesDashboardToday: boolean;
  resolveReason: string;
  entryActivityLabels?: string[];
}): void {
  const base = {
    data_selecionada_no_board: payload.selectedDate,
    fuso_operacional: payload.operationalTimezone,
    hoje_operacional_dashboard: payload.operationalTodayIso,
    board_igual_ao_hoje_dashboard: payload.matchesDashboardToday,
    aeroporto: payload.airportCode,
    entradas_escala_na_data: payload.entriesCount,
    rotulos_atividade: payload.entryActivityLabels,
    classificacao_dia: payload.classification.kind,
    voos_planejados_dep: payload.plannedDep,
    voos_planejados_arr: payload.plannedArr,
    tentativa_enriquecimento_edge: payload.enrichmentAttempted,
    enriquecimento_retornou_dados: payload.enrichmentOk,
    houve_match_live: payload.enrichmentMatch,
    estado_ui_final: payload.finalUiKind,
    motivo_resolucao: payload.resolveReason,
  };
  console.log("[FlightBoardPro] diagnóstico", base);

  if (payload.selectedDate === "2026-03-23") {
    console.log("[FlightBoardPro] validação 23/03/2026 — conferir D0 / non_flight_day", {
      ...base,
      nota:
        "Se classificacao_dia=non_flight_operational e estado_ui_final=non_flight_day, o board está coerente com escala sem voo (não é erro de API).",
    });
  }
}

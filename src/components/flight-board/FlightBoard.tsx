import React, { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useOperationalPreferences } from "@/hooks/useOperationalPreferences";
import type { ScheduleEntry } from "@/hooks/useScheduleData";
import {
  getDepartures,
  getArrivals,
} from "@/services/flightBoard/flightService";
import type { FlightNormalized, FlightFilters, FlightRaw } from "@/services/flightBoard/types";
import { FlightFilters as FlightFiltersComponent } from "./FlightFilters";
import { FlightRow } from "./FlightRow";
import { OperationalCodesLegend } from "./OperationalCodesLegend";
import { FlightBoardSkeleton } from "./FlightBoardSkeleton";
import { FlightBoardEmpty } from "./FlightBoardEmpty";
import { FlightBoardError } from "./FlightBoardError";
import { FlightBoardNeutral } from "./FlightBoardNeutral";
import { cn } from "@/lib/utils";
import { subscribeRosterUpdated } from "@/lib/events/roster-events";
import {
  resolveFlightBoardState,
  mergeEnrichmentIntoNormalized,
  buildNormalizedListsFromEnrichmentRaw,
  logFlightBoardDiagnostics,
  getOperationalResolveReason,
} from "@/services/flightBoard/flightBoardOperational";
import {
  fetchFlightStatusEnrichment,
  type EnrichmentFetchMeta,
} from "@/services/flightBoard/flightProvider";
import {
  logEnrichmentPipeline,
  summarizeEnrichmentRaw,
} from "@/services/flightBoard/flightEnrichmentDiagnostics";
import {
  DEFAULT_OPERATIONAL_TIMEZONE,
  getOperationalTodayIso,
} from "@/lib/operational-date";
import { resolveSafeIANATimezone } from "@/lib/date-utils";
import { FLIGHT_BOARD_ALL_AIRPORTS } from "@/services/flightBoard/constants";
import {
  finalizeNormalizedFlights,
  computePipelineMetrics,
  logFlightBoardPipeline,
  logFlightBoardAirportMode,
} from "@/services/flightBoard/flightBoardPipeline";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const HIGH_MONITOR_MS = 30 * 1000;
const MODERATE_MONITOR_MS = 60 * 1000;
const LIGHT_MONITOR_MS = 3 * 60 * 1000;
const IDLE_MONITOR_MS = 5 * 60 * 1000;

/** Mensagem única do banner (motivos distintos no console via pipeline logs). */
function buildEnrichmentBanner(args: {
  hasPlanned: boolean;
  raw: FlightRaw[];
  meta: EnrichmentFetchMeta;
  dep: FlightNormalized[];
  arr: FlightNormalized[];
}): string | null {
  const { hasPlanned, raw, meta, dep, arr } = args;
  if (!hasPlanned) return null;
  if (meta.skipped) {
    if (meta.reason === "no_supabase_env") {
      return "Enriquecimento desligado: variáveis VITE_SUPABASE_* ausentes no build do cliente.";
    }
    if (meta.reason === "no_session") {
      return "Enriquecimento indisponível: sessão não encontrada.";
    }
    return null;
  }
  if (meta.reason === "http_error") {
    if (meta.httpStatus === 401) {
      return "Autenticação necessária — faça login para usar o enriquecimento ao vivo.";
    }
    if (meta.httpStatus === 404) {
      return "Função flight-status não encontrada (404) — verifique o deploy no projeto Supabase.";
    }
    return `Servidor retornou HTTP ${meta.httpStatus ?? "?"}. Exibindo dados planejados da escala.`;
  }
  if (meta.reason === "network") {
    const detail = meta.serverErrorDetail
      ? (() => {
          try {
            const d = JSON.parse(meta.serverErrorDetail as string) as { likelyCause?: string };
            const c = d.likelyCause ?? "";
            if (c === "cors_or_connection") return " (CORS ou conexão)";
            if (c === "timeout_25s") return " (timeout)";
            if (c === "auth_required") return " (token ausente)";
            return c ? ` (${c})` : "";
          } catch {
            return "";
          }
        })()
      : "";
    return `Falha de rede ao contatar o enriquecimento${detail}. Exibindo dados planejados da escala.`;
  }
  if (meta.reason === "invalid_json") {
    return "Resposta inválida do servidor de enriquecimento. Exibindo dados planejados da escala.";
  }
  if (raw.length === 0) {
    return "Nenhum voo retornado pelo servidor para esta data/aeroporto. Exibindo dados da escala local.";
  }
  const anyLive = [...dep, ...arr].some((f) => f.liveTrackingAvailable);
  const summary = summarizeEnrichmentRaw(raw);
  logEnrichmentPipeline("banner_reason", {
    anyLive,
    withAirportInfo: summary.withAirportInfo,
    withTrackingLatLon: summary.withTrackingLatLon,
  });
  if (!anyLive && summary.withAirportInfo > 0) {
    return "OpenSky: sem posição ao vivo; contexto de aeroporto e status do servidor foram aplicados ao card.";
  }
  if (!anyLive) {
    return "OpenSky: sem match de posição; status e horários vêm do servidor e da escala. Dados ao vivo disponíveis apenas para voos ativos ou próximos da operação.";
  }
  return null;
}

function buildAirportBaseBanner(args: {
  raw: FlightRaw[];
  meta: EnrichmentFetchMeta;
  builtDep: number;
  builtArr: number;
}): string | null {
  const { raw, meta, builtDep, builtArr } = args;
  if (meta.skipped) {
    if (meta.reason === "no_supabase_env") {
      return "Aeroporto: variáveis VITE_SUPABASE_* ausentes; não é possível chamar a edge.";
    }
    if (meta.reason === "no_session") {
      return "Aeroporto: sessão ausente — faça login para carregar voos do aeroporto.";
    }
    return null;
  }
  if (meta.reason === "http_error") {
    if (meta.httpStatus === 401) {
      return "Aeroporto: faça login para carregar voos do aeroporto.";
    }
    if (meta.httpStatus === 404) {
      return "Aeroporto: função flight-status não encontrada (404) — verifique o deploy.";
    }
    return `Aeroporto: HTTP ${meta.httpStatus ?? "?"}.`;
  }
  if (meta.reason === "network") {
    const detail = meta.serverErrorDetail
      ? (() => {
          try {
            const d = JSON.parse(meta.serverErrorDetail as string) as { likelyCause?: string };
            const c = d.likelyCause ?? "";
            if (c === "cors_or_connection") return " (CORS ou conexão)";
            if (c === "timeout_25s") return " (timeout)";
            return c ? ` (${c})` : "";
          } catch {
            return "";
          }
        })()
      : "";
    return `Aeroporto: falha de rede ao contatar o servidor${detail}.`;
  }
  if (meta.airportBaseReason === "opensky_credentials_required") {
    return "Aeroporto: configure OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET na função flight-status (OpenSky OAuth).";
  }
  if (meta.airportBaseReason === "unknown_airport_iata") {
    return "Aeroporto: código IATA não mapeado para ICAO (amplie IATA_TO_ICAO na edge).";
  }
  if (raw.length === 0) {
    return "Aeroporto: OpenSky não retornou voos para esta janela. Dados ao vivo disponíveis apenas para voos que já partiram ou chegaram no dia (UTC). Verifique data e credenciais.";
  }
  if (builtDep + builtArr === 0) {
    return "Aeroporto: resposta recebida, mas nenhum voo passou nos filtros de partida/chegada neste aeroporto.";
  }
  return null;
}

export interface FlightBoardProps {
  className?: string;
  /** Escala do usuário (mesma fonte do calendário / dashboard) */
  schedule?: ScheduleEntry[] | null;
  scheduleLoading: boolean;
  /**
   * "Hoje" operacional YYYY-MM-DD — mesmo valor que `useOperationalClock` / calendário
   * (não usar UTC do navegador).
   */
  operationalTodayIso?: string;
  /** IANA, ex.: America/Sao_Paulo — mesmas preferências do dashboard */
  operationalTimezone?: string;
  /** Rótulo da fonte vencedora após consolidação (portal / PDF / manual). */
  scheduleSourceLabel?: string | null;
}

export function FlightBoard({
  className,
  schedule,
  scheduleLoading,
  operationalTodayIso,
  operationalTimezone,
  scheduleSourceLabel,
}: FlightBoardProps) {
  const safeSchedule = schedule ?? [];
  const tzResolved = useMemo(
    () => resolveSafeIANATimezone(operationalTimezone ?? DEFAULT_OPERATIONAL_TIMEZONE),
    [operationalTimezone]
  );

  const todayFromDashboard = useMemo(() => {
    if (
      typeof operationalTodayIso === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(operationalTodayIso.trim())
    ) {
      return operationalTodayIso.trim();
    }
    return getOperationalTodayIso(tzResolved);
  }, [operationalTodayIso, tzResolved]);

  const { homeBase } = useOperationalPreferences();

  const [filters, setFilters] = useState<FlightFilters>(() => {
    const tz = resolveSafeIANATimezone(operationalTimezone ?? DEFAULT_OPERATIONAL_TIMEZONE);
    const initialDate =
      typeof operationalTodayIso === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(operationalTodayIso.trim())
        ? operationalTodayIso.trim()
        : getOperationalTodayIso(tz);
    return {
      airportCode: FLIGHT_BOARD_ALL_AIRPORTS,
      airlineCode: "",
      flightNumber: "",
      date: initialDate,
      mode: "departures",
      boardMode: "my_schedule",
    };
  });

  const enrichmentAirport = useMemo(() => {
    if (filters.airportCode === FLIGHT_BOARD_ALL_AIRPORTS) {
      return homeBase || "GRU";
    }
    return filters.airportCode;
  }, [filters.airportCode, homeBase]);

  /** Avança o filtro para o novo “hoje” operacional só se o usuário ainda estava no dia anterior */
  const lastOperationalDayRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastOperationalDayRef.current === null) {
      lastOperationalDayRef.current = todayFromDashboard;
      return;
    }
    if (lastOperationalDayRef.current === todayFromDashboard) return;
    const previousDay = lastOperationalDayRef.current;
    lastOperationalDayRef.current = todayFromDashboard;
    setFilters((f) =>
      f.date === previousDay ? { ...f, date: todayFromDashboard } : f
    );
  }, [todayFromDashboard]);

  /** Com “Todos os aeroportos” no filtro ou ao reabrir, alinha ao IATA da minha base quando disponível. */
  useEffect(() => {
    if (!homeBase) return;
    if (filters.airportCode !== FLIGHT_BOARD_ALL_AIRPORTS) return;
    setFilters((f) => {
      if (f.airportCode !== FLIGHT_BOARD_ALL_AIRPORTS) return f;
      if (f.airportCode === homeBase) return f;
      return { ...f, airportCode: homeBase };
    });
  }, [homeBase, filters.airportCode]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[FlightBoard] mount", {
        tzResolved,
        todayFromDashboard,
        entries: safeSchedule.length,
      });
    }
  }, [tzResolved, todayFromDashboard, safeSchedule.length]);

  const [departures, setDepartures] = useState<FlightNormalized[]>([]);
  const [arrivals, setArrivals] = useState<FlightNormalized[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  /** Erro real (agregação / exceção), não confundir com falta de voo ou OpenSky */
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrichmentWarning, setEnrichmentWarning] = useState<string | null>(null);

  const baseResolved = useMemo(
    () =>
      resolveFlightBoardState({
        scheduleLoading,
        schedule: safeSchedule,
        dateIso: filters.date,
        airportCode: filters.airportCode,
      }),
    [safeSchedule, scheduleLoading, filters.date, filters.airportCode]
  );

  const loadFlights = useCallback(async () => {
    setFatalError(null);
    setTechnicalError(null);
    setEnrichmentWarning(null);

    /** Modo Aeroporto: não depende da escala importada — só edge + OpenSky por aeroporto */
    if (filters.boardMode === "airport_base") {
      setLoading(true);
      const airportForApi =
        filters.airportCode === FLIGHT_BOARD_ALL_AIRPORTS
          ? homeBase || "GRU"
          : filters.airportCode;
      try {
        let raw: FlightRaw[] = [];
        let meta: EnrichmentFetchMeta = { skipped: true, reason: "no_supabase_env" };
        try {
          const result = await fetchFlightStatusEnrichment({
            airportCode: airportForApi,
            date: filters.date,
            airlineCode: filters.airlineCode || undefined,
            flightNumber: filters.flightNumber || undefined,
            boardMode: "airport_base",
          });
          raw = result.flights;
          meta = result.meta;
        } catch (enrichErr) {
          console.warn(
            "[FlightBoard] airport_base fetch",
            enrichErr instanceof Error ? enrichErr.message : enrichErr
          );
          raw = [];
          meta = {
            skipped: false,
            reason: "network",
            serverError: enrichErr instanceof Error ? enrichErr.message : String(enrichErr),
          };
        }

        const built = buildNormalizedListsFromEnrichmentRaw(
          raw,
          filters.date,
          airportForApi
        );
        const rawById = new Map(raw.map((r) => [r.id, r]));
        let dep = finalizeNormalizedFlights(built.departures, rawById, {
          boardMode: "airport_base",
          meta,
        });
        let arr = finalizeNormalizedFlights(built.arrivals, rawById, {
          boardMode: "airport_base",
          meta,
        });
        dep = getDepartures(dep, {
          airlineCode: filters.airlineCode || undefined,
          flightNumber: filters.flightNumber || undefined,
        });
        arr = getArrivals(arr, {
          airlineCode: filters.airlineCode || undefined,
          flightNumber: filters.flightNumber || undefined,
        });

        logFlightBoardAirportMode({
          airportSelected: airportForApi,
          date: filters.date,
          companyFilter: filters.airlineCode,
          flightFilter: filters.flightNumber,
          payloadSent: {
            boardMode: "airport_base",
            airportCode: airportForApi,
            scheduledDepartureDate: filters.date,
          },
          flightsReturned: raw.length,
          flightsAfterFilter: dep.length + arr.length,
          reasonZeroResults:
            raw.length === 0
              ? meta.airportBaseReason ?? meta.reason ?? "empty_response"
              : dep.length + arr.length === 0
                ? "filtered_or_normalize_empty"
                : null,
        });

        logFlightBoardPipeline(
          computePipelineMetrics({
            raw,
            finalDep: dep,
            finalArr: arr,
            scaleCount: 0,
            boardMode: "airport_base",
            meta,
          })
        );

        setDepartures(dep);
        setArrivals(arr);
        setLastUpdated(new Date().toISOString());
        let airBanner = buildAirportBaseBanner({
          raw,
          meta,
          builtDep: dep.length,
          builtArr: arr.length,
        });
        if (filters.airportCode === FLIGHT_BOARD_ALL_AIRPORTS) {
          const extra = `Filtro “Todos os aeroportos”: dados ao vivo carregados para ${airportForApi}. Escolha um aeroporto no seletor para fixar o painel.`;
          airBanner = airBanner ? `${extra} ${airBanner}` : extra;
        }
        setEnrichmentWarning(airBanner);
      } catch (err) {
        console.error("[FlightBoard] airport_base", err);
        setDepartures([]);
        setArrivals([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (scheduleLoading) {
      setLoading(true);
      return;
    }

    setLoading(true);

    try {
      const resolved = resolveFlightBoardState({
        scheduleLoading,
        schedule: safeSchedule,
        dateIso: filters.date,
        airportCode: filters.airportCode,
      });

      const entriesForDate = safeSchedule.filter((e) => e.date === filters.date);
      const entryActivityLabels = entriesForDate.map(
        (e) => (e.activity_type || "").trim() || e.raw_line?.slice(0, 40) || "—"
      );
      const matchesDashboardToday = filters.date === todayFromDashboard;
      const resolveReason = getOperationalResolveReason(resolved, {
        dateIso: filters.date,
        entriesForDate,
      });

      if (resolved.uiKind !== "has_planned_flights") {
        setDepartures([]);
        setArrivals([]);
        setLastUpdated(new Date().toISOString());
        setLoading(false);
        logFlightBoardDiagnostics({
          selectedDate: filters.date,
          airportCode: filters.airportCode,
          entriesCount: resolved.classification.entryCount,
          classification: resolved.classification,
          plannedDep: 0,
          plannedArr: 0,
          enrichmentAttempted: false,
          enrichmentOk: null,
          enrichmentMatch: false,
          finalUiKind: resolved.uiKind,
          operationalTimezone: tzResolved,
          operationalTodayIso: todayFromDashboard,
          matchesDashboardToday,
          resolveReason,
          entryActivityLabels,
        });
        return;
      }

      /* Escala primeiro: exibir voos planejados imediatamente (OpenSky não bloqueia a lista) */
      setDepartures(resolved.departures);
      setArrivals(resolved.arrivals);
      setLastUpdated(new Date().toISOString());
      setLoading(false);

      logEnrichmentPipeline("roster_extracted", {
        plannedDep: resolved.departures.length,
        plannedArr: resolved.arrivals.length,
        date: filters.date,
        airport: filters.airportCode,
        boardMode: filters.boardMode,
      });

      let raw: FlightRaw[] = [];
      let meta: EnrichmentFetchMeta = { skipped: true, reason: "no_supabase_env" };
      try {
        const result = await fetchFlightStatusEnrichment({
          airportCode: enrichmentAirport,
          date: filters.date,
          airlineCode: filters.airlineCode || undefined,
          flightNumber: filters.flightNumber || undefined,
          boardMode: "my_schedule",
        });
        raw = result.flights;
        meta = result.meta;
      } catch (enrichErr) {
        console.warn(
          "[FlightBoard] enriquecimento opcional indisponível (não fatal)",
          enrichErr instanceof Error ? enrichErr.message : enrichErr
        );
        raw = [];
        meta = {
          skipped: false,
          reason: "network",
          serverError: enrichErr instanceof Error ? enrichErr.message : String(enrichErr),
        };
      }

      const depMerged = mergeEnrichmentIntoNormalized(
        resolved.departures,
        raw,
        filters.date,
        enrichmentAirport
      );
      const arrMerged = mergeEnrichmentIntoNormalized(
        resolved.arrivals,
        raw,
        filters.date,
        enrichmentAirport
      );

      const rawById = new Map(raw.map((r) => [r.id, r]));
      const dep = finalizeNormalizedFlights(depMerged, rawById, {
        boardMode: "my_schedule",
        meta,
      });
      const arr = finalizeNormalizedFlights(arrMerged, rawById, {
        boardMode: "my_schedule",
        meta,
      });

      logEnrichmentPipeline("merge_roster", {
        dep: dep.length,
        arr: arr.length,
        boardMode: filters.boardMode,
      });

      const hasPlanned = dep.length + arr.length > 0;
      const anyLive = [...dep, ...arr].some((f) => f.liveTrackingAvailable);

      let enrichBanner = buildEnrichmentBanner({
        hasPlanned,
        raw,
        meta,
        dep,
        arr,
      });
      if (filters.airportCode === FLIGHT_BOARD_ALL_AIRPORTS) {
        const note = `Filtro “Todos os aeroportos”: enriquecimento ao vivo usa ${enrichmentAirport}.`;
        enrichBanner = enrichBanner ? `${note} ${enrichBanner}` : note;
      }
      setEnrichmentWarning(enrichBanner);

      logFlightBoardPipeline(
        computePipelineMetrics({
          raw,
          finalDep: dep,
          finalArr: arr,
          scaleCount: resolved.departures.length + resolved.arrivals.length,
          boardMode: "my_schedule",
          meta,
        })
      );

      setDepartures(dep);
      setArrivals(arr);
      setLastUpdated(new Date().toISOString());

      logFlightBoardDiagnostics({
        selectedDate: filters.date,
        airportCode: filters.airportCode,
        entriesCount: resolved.classification.entryCount,
        classification: resolved.classification,
        plannedDep: dep.length,
        plannedArr: arr.length,
        enrichmentAttempted: true,
        enrichmentOk: raw.length > 0,
        enrichmentMatch: anyLive,
        finalUiKind: resolved.uiKind,
        operationalTimezone: tzResolved,
        operationalTodayIso: todayFromDashboard,
        matchesDashboardToday,
        resolveReason,
        entryActivityLabels,
      });
    } catch (err) {
      console.error("[FlightBoard] erro no agregador (fonte primária)", err);
      setFatalError(
        err instanceof Error
          ? err.message
          : "Falha ao carregar o Flight Board. Tente novamente."
      );
      setTechnicalError(err instanceof Error ? err.message : null);
      setDepartures([]);
      setArrivals([]);
    } finally {
      setLoading(false);
    }
  }, [
    safeSchedule,
    scheduleLoading,
    filters.airportCode,
    filters.date,
    filters.airlineCode,
    filters.flightNumber,
    filters.boardMode,
    tzResolved,
    todayFromDashboard,
    enrichmentAirport,
    homeBase,
  ]);

  useEffect(() => {
    void loadFlights();
  }, [loadFlights]);

  const filteredDepartures = useMemo(
    () =>
      getDepartures(departures, {
        airlineCode: filters.airlineCode || undefined,
        flightNumber: filters.flightNumber || undefined,
      }),
    [departures, filters.airlineCode, filters.flightNumber]
  );

  const filteredArrivals = useMemo(
    () =>
      getArrivals(arrivals, {
        airlineCode: filters.airlineCode || undefined,
        flightNumber: filters.flightNumber || undefined,
      }),
    [arrivals, filters.airlineCode, filters.flightNumber]
  );

  const now = Date.now();
  const list =
    filters.mode === "departures" ? filteredDepartures : filteredArrivals;
  const mode = filters.mode === "departures" ? "departure" : "arrival";

  const monitorIntervalMs = useMemo(() => {
    const activeFlights = list.filter((flight) => flight.statusKey !== "completed");
    if (!activeFlights.length) return IDLE_MONITOR_MS;

    const nextFlight = activeFlights
      .filter((flight) => flight.scheduledTimestamp > now)
      .sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp)[0];

    if (!nextFlight) return IDLE_MONITOR_MS;

    const diff = nextFlight.scheduledTimestamp - now;
    if (
      nextFlight.statusKey === "in_progress" ||
      nextFlight.statusKey === "boarding" ||
      diff <= THREE_HOURS_MS
    ) {
      return HIGH_MONITOR_MS;
    }
    if (diff <= SIX_HOURS_MS) return MODERATE_MONITOR_MS;
    return LIGHT_MONITOR_MS;
  }, [list, now]);

  useEffect(() => {
    const interval = setInterval(() => void loadFlights(), monitorIntervalMs);
    return () => clearInterval(interval);
  }, [loadFlights, monitorIntervalMs]);

  useEffect(() => {
    const unsubscribe = subscribeRosterUpdated(() => {
      console.log("[FlightBoard] push refresh from roster event");
      void loadFlights();
    });
    return () => unsubscribe();
  }, [loadFlights]);

  const shouldHighlightNext = (f: FlightNormalized) => {
    if (f.statusKey === "completed" || f.statusKey === "cancelled") return false;
    const diff = f.scheduledTimestamp - now;
    return diff > 0 && diff < TWO_HOURS_MS;
  };

  const shouldHighlightDelayed = (f: FlightNormalized) =>
    (f.delayMinutes ?? 0) > 0;

  const airportContextHint =
    filters.airportCode === FLIGHT_BOARD_ALL_AIRPORTS
      ? "Mostrando todos os trechos da escala nesta data (filtro de aeroporto: todos)."
      : [
          homeBase ? `Minha base (escala): ${homeBase}.` : null,
          `Aeroporto no painel: ${filters.airportCode}${
            homeBase === filters.airportCode ? " (coincide com a minha base)" : ""
          }.`,
        ]
          .filter(Boolean)
          .join(" ");

  const renderBody = () => {
    if (fatalError) {
      return (
        <FlightBoardError
          message={fatalError}
          technicalError={technicalError}
          onRetry={() => void loadFlights()}
        />
      );
    }

    /** Modo Aeroporto: UI não depende da escala importada */
    if (filters.boardMode === "airport_base") {
      if (loading && list.length === 0) {
        return <FlightBoardSkeleton />;
      }
      if (!loading && list.length === 0) {
        return (
          <FlightBoardNeutral
            variant="airport_base_empty"
            title="Nenhum voo neste aeroporto para esta data (modo Aeroporto)"
            subtitle={
              enrichmentWarning ??
              "Confira credenciais OpenSky na edge, data (UTC) e filtros de companhia/número."
            }
            airportHint={airportContextHint}
          />
        );
      }
      return (
        <div className="w-full min-w-0 space-y-2 overflow-hidden pb-2">
          {enrichmentWarning && (
            <p className="max-w-full break-words rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              {enrichmentWarning}
            </p>
          )}
          {filters.boardMode === "my_schedule" && list.length > 0 && (
            <OperationalCodesLegend />
          )}
          {list.map((flight, index) => (
            <motion.div
              key={flight.id}
              className="min-w-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.03,
                duration: 0.25,
                ease: "easeOut",
              }}
            >
              <FlightRow
                flight={flight}
                mode={mode}
                now={now}
                isNext={shouldHighlightNext(flight)}
                isDelayed={shouldHighlightDelayed(flight)}
              />
            </motion.div>
          ))}
        </div>
      );
    }

    if (scheduleLoading && !safeSchedule.length) {
      return <FlightBoardSkeleton />;
    }

    const neutral = baseResolved;

    if (neutral.uiKind === "loading_schedule") {
      return <FlightBoardSkeleton />;
    }

    if (neutral.uiKind === "no_schedule_loaded") {
      return (
        <FlightBoardNeutral
          variant="no_schedule"
          title={neutral.neutralMessage ?? "Nenhuma escala carregada"}
          subtitle={neutral.neutralDetail}
        />
      );
    }

    if (neutral.uiKind === "no_entries_for_date") {
      return (
        <FlightBoardNeutral
          variant="no_entries"
          title={neutral.neutralMessage ?? "Sem registros nesta data"}
          subtitle={neutral.neutralDetail}
          airportHint={airportContextHint}
        />
      );
    }

    if (neutral.uiKind === "non_flight_day") {
      return (
        <FlightBoardNeutral
          variant="no_flight_day"
          title={neutral.neutralMessage ?? "Nenhum voo operacional previsto para esta data"}
          subtitle={
            neutral.neutralDetail ??
            "Dia sem trecho de voo conforme sua escala (ex.: folga, D0, reserva)."
          }
          airportHint={airportContextHint}
        />
      );
    }

    if (neutral.uiKind === "no_flights_at_airport") {
      return (
        <FlightBoardNeutral
          variant="no_airport_ops"
          title={neutral.neutralMessage ?? "Nenhuma operação neste aeroporto nesta data"}
          subtitle={neutral.neutralDetail}
          airportHint={airportContextHint}
        />
      );
    }

    if (neutral.uiKind === "has_planned_flights") {
      if (loading && !list.length) {
        return <FlightBoardSkeleton />;
      }

      if (list.length === 0) {
        return (
          <FlightBoardEmpty mode={mode} />
        );
      }

      return (
        <div className="w-full min-w-0 space-y-2 overflow-hidden pb-2">
          {enrichmentWarning && (
            <p className="max-w-full break-words rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              {enrichmentWarning}
            </p>
          )}
          {filters.boardMode === "my_schedule" && list.length > 0 && (
            <OperationalCodesLegend />
          )}
          {list.map((flight, index) => (
            <motion.div
              key={flight.id}
              className="min-w-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.03,
                duration: 0.25,
                ease: "easeOut",
              }}
            >
              <FlightRow
                flight={flight}
                mode={mode}
                now={now}
                isNext={shouldHighlightNext(flight)}
                isDelayed={shouldHighlightDelayed(flight)}
              />
            </motion.div>
          ))}
        </div>
      );
    }

    return <FlightBoardSkeleton />;
  };

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm",
        "dark:border-border/40 dark:bg-card/60",
        className
      )}
    >
      <div className="w-full min-w-0 border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              EscalaX Flight Board Pro
            </h2>
            {scheduleSourceLabel && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Fonte no painel:{" "}
                <span className="font-medium text-foreground">{scheduleSourceLabel}</span>
              </p>
            )}
          </div>
        </div>
        <div className="mt-3">
          <FlightFiltersComponent
            filters={filters}
            onChange={(updates) =>
              setFilters((p) => ({ ...p, ...updates }))
            }
            onRefresh={() => void loadFlights()}
            isLoading={loading}
            lastUpdated={lastUpdated}
            homeBase={homeBase}
          />
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full overflow-x-hidden p-4 sm:p-5">
        {renderBody()}
      </div>
    </div>
  );
}

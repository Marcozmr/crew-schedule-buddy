import React, { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useOperationalPreferences } from "@/hooks/useOperationalPreferences";
import type { ScheduleEntry } from "@/hooks/useScheduleData";
import {
  getDepartures,
  getArrivals,
} from "@/services/flightBoard/flightService";
import type { FlightNormalized, FlightFilters } from "@/services/flightBoard/types";
import { FlightFilters as FlightFiltersComponent } from "./FlightFilters";
import { FlightRow } from "./FlightRow";
import { FlightBoardSkeleton } from "./FlightBoardSkeleton";
import { FlightBoardEmpty } from "./FlightBoardEmpty";
import { FlightBoardError } from "./FlightBoardError";
import { FlightBoardNeutral } from "./FlightBoardNeutral";
import { cn } from "@/lib/utils";
import { subscribeRosterUpdated } from "@/lib/events/roster-events";
import {
  resolveFlightBoardState,
  mergeEnrichmentIntoNormalized,
  logFlightBoardDiagnostics,
  getOperationalResolveReason,
} from "@/services/flightBoard/flightBoardOperational";
import { fetchFlightStatusEnrichment } from "@/services/flightBoard/flightProvider";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const HIGH_MONITOR_MS = 30 * 1000;
const MODERATE_MONITOR_MS = 60 * 1000;
const LIGHT_MONITOR_MS = 3 * 60 * 1000;
const IDLE_MONITOR_MS = 5 * 60 * 1000;

export interface FlightBoardProps {
  className?: string;
  /** Escala do usuário (mesma fonte do calendário / dashboard) */
  schedule: ScheduleEntry[];
  scheduleLoading: boolean;
  /**
   * "Hoje" operacional YYYY-MM-DD — mesmo valor que `useOperationalClock` / calendário
   * (não usar UTC do navegador).
   */
  operationalTodayIso: string;
  /** IANA, ex.: America/Sao_Paulo — mesmas preferências do dashboard */
  operationalTimezone: string;
}

export function FlightBoard({
  className,
  schedule,
  scheduleLoading,
  operationalTodayIso,
  operationalTimezone,
}: FlightBoardProps) {
  const { homeBase } = useOperationalPreferences();

  const [filters, setFilters] = useState<FlightFilters>(() => ({
    airportCode: "GRU",
    airlineCode: "",
    flightNumber: "",
    date: operationalTodayIso,
    mode: "departures",
  }));

  /** Avança o filtro para o novo “hoje” operacional só se o usuário ainda estava no dia anterior */
  const lastOperationalDayRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastOperationalDayRef.current === null) {
      lastOperationalDayRef.current = operationalTodayIso;
      return;
    }
    if (lastOperationalDayRef.current === operationalTodayIso) return;
    const previousDay = lastOperationalDayRef.current;
    lastOperationalDayRef.current = operationalTodayIso;
    setFilters((f) =>
      f.date === previousDay ? { ...f, date: operationalTodayIso } : f
    );
  }, [operationalTodayIso]);

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
        schedule,
        dateIso: filters.date,
        airportCode: filters.airportCode,
      }),
    [schedule, scheduleLoading, filters.date, filters.airportCode]
  );

  const loadFlights = useCallback(async () => {
    setFatalError(null);
    setTechnicalError(null);
    setEnrichmentWarning(null);

    if (scheduleLoading) {
      setLoading(true);
      return;
    }

    setLoading(true);

    try {
      const resolved = resolveFlightBoardState({
        scheduleLoading,
        schedule,
        dateIso: filters.date,
        airportCode: filters.airportCode,
      });

      const entriesForDate = schedule.filter((e) => e.date === filters.date);
      const entryActivityLabels = entriesForDate.map(
        (e) => (e.activity_type || "").trim() || e.raw_line?.slice(0, 40) || "—"
      );
      const matchesDashboardToday = filters.date === operationalTodayIso;
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
          operationalTimezone,
          operationalTodayIso,
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

      let raw: Awaited<ReturnType<typeof fetchFlightStatusEnrichment>> = [];
      try {
        raw = await fetchFlightStatusEnrichment({
          airportCode: filters.airportCode,
          date: filters.date,
          airlineCode: filters.airlineCode || undefined,
          flightNumber: filters.flightNumber || undefined,
        });
      } catch (enrichErr) {
        console.warn(
          "[FlightBoard] enriquecimento opcional indisponível (não fatal)",
          enrichErr instanceof Error ? enrichErr.message : enrichErr
        );
        raw = [];
      }

      const dep = mergeEnrichmentIntoNormalized(resolved.departures, raw);
      const arr = mergeEnrichmentIntoNormalized(resolved.arrivals, raw);

      const hasPlanned = dep.length + arr.length > 0;
      const anyLive = [...dep, ...arr].some((f) => f.liveTrackingAvailable);
      if (hasPlanned && raw.length === 0) {
        setEnrichmentWarning(
          "Informações ao vivo indisponíveis no momento; exibindo dados planejados da escala."
        );
      } else if (hasPlanned && !anyLive && raw.length > 0) {
        setEnrichmentWarning(
          "Sem correspondência ao vivo para estes trechos no momento; exibindo dados planejados."
        );
      } else {
        setEnrichmentWarning(null);
      }

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
        operationalTimezone,
        operationalTodayIso,
        matchesDashboardToday,
        resolveReason,
        entryActivityLabels,
      });
    } catch (err) {
      console.error("[FlightBoard] erro no agregador (fonte primária)", err);
      setFatalError(
        err instanceof Error
          ? err.message
          : "Falha ao montar o painel operacional. Tente novamente."
      );
      setTechnicalError(err instanceof Error ? err.message : null);
      setDepartures([]);
      setArrivals([]);
    } finally {
      setLoading(false);
    }
  }, [
    schedule,
    scheduleLoading,
    filters.airportCode,
    filters.date,
    filters.airlineCode,
    filters.flightNumber,
    operationalTimezone,
    operationalTodayIso,
  ]);

  useEffect(() => {
    void loadFlights();
  }, [loadFlights]);

  useEffect(() => {
    if (homeBase) {
      setFilters((p) => ({ ...p, airportCode: homeBase }));
    }
  }, [homeBase]);

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
    homeBase && filters.airportCode
      ? `Base selecionada: ${filters.airportCode}${
          homeBase === filters.airportCode ? " (sua base operacional)" : ""
        }`
      : undefined;

  const renderBody = () => {
    if (scheduleLoading && !schedule.length) {
      return <FlightBoardSkeleton />;
    }

    if (fatalError) {
      return (
        <FlightBoardError
          message={fatalError}
          technicalError={technicalError}
          onRetry={() => void loadFlights()}
        />
      );
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
        <div className="space-y-2">
          {enrichmentWarning && (
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              {enrichmentWarning}
            </p>
          )}
          {list.map((flight, index) => (
            <motion.div
              key={flight.id}
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
        "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm",
        "dark:border-border/40 dark:bg-card/60",
        className
      )}
    >
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            EscalaX Flight Board Pro
          </h2>
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
            operationalTimezone={operationalTimezone}
          />
        </div>
      </div>

      <div className="p-4 sm:p-5">{renderBody()}</div>
    </div>
  );
}

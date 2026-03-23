import React, { useEffect, useCallback, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useOperationalPreferences } from "@/hooks/useOperationalPreferences";
import {
  getFlightsByAirport,
  getDepartures,
  getArrivals,
} from "@/services/flightBoard/flightService";
import type { FlightNormalized, FlightFilters } from "@/services/flightBoard/types";
import { FlightFilters as FlightFiltersComponent } from "./FlightFilters";
import { FlightRow } from "./FlightRow";
import { FlightBoardSkeleton } from "./FlightBoardSkeleton";
import { FlightBoardEmpty } from "./FlightBoardEmpty";
import { FlightBoardError } from "./FlightBoardError";
import { cn } from "@/lib/utils";
import { subscribeRosterUpdated } from "@/lib/events/roster-events";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const HIGH_MONITOR_MS = 30 * 1000;
const MODERATE_MONITOR_MS = 60 * 1000;
const LIGHT_MONITOR_MS = 3 * 60 * 1000;
const IDLE_MONITOR_MS = 5 * 60 * 1000;

function getDefaultDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function FlightBoard({ className }: { className?: string }) {
  const { homeBase } = useOperationalPreferences();
  const [filters, setFilters] = useState<FlightFilters>({
    airportCode: homeBase ?? "GRU",
    airlineCode: "",
    flightNumber: "",
    date: getDefaultDate(),
    mode: "departures",
  });

  const [departures, setDepartures] = useState<FlightNormalized[]>([]);
  const [arrivals, setArrivals] = useState<FlightNormalized[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFlights = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);
      setTechnicalError(null);
      try {
        const result = await getFlightsByAirport(
          filters.airportCode,
          filters.date,
          filters.airlineCode || undefined,
          filters.flightNumber || undefined,
          { skipCache: forceRefresh }
        );

        if (result.error) {
          setError(result.error);
          setTechnicalError(result.technicalError ?? null);
          setDepartures([]);
          setArrivals([]);
        } else {
          setDepartures(result.departures);
          setArrivals(result.arrivals);
          setLastUpdated(new Date().toISOString());
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Dados de voo indisponíveis no momento. Tente novamente."
        );
        setTechnicalError(err instanceof Error ? err.message : null);
        setDepartures([]);
        setArrivals([]);
      } finally {
        setLoading(false);
      }
    },
    [filters.airportCode, filters.date, filters.airlineCode, filters.flightNumber]
  );

  useEffect(() => {
    loadFlights();
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
    const interval = setInterval(loadFlights, monitorIntervalMs);
    return () => clearInterval(interval);
  }, [loadFlights, monitorIntervalMs]);

  useEffect(() => {
    const unsubscribe = subscribeRosterUpdated(() => {
      console.log("[FlightBoard] push refresh from roster event");
      void loadFlights(true);
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
            onRefresh={() => loadFlights(true)}
            isLoading={loading}
            lastUpdated={lastUpdated}
            homeBase={homeBase}
          />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading && !list.length ? (
          <FlightBoardSkeleton />
        ) : error ? (
          <FlightBoardError
            message={error}
            technicalError={technicalError}
            onRetry={loadFlights}
          />
        ) : list.length === 0 ? (
          <FlightBoardEmpty mode={mode} />
        ) : (
          <div className="space-y-2">
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
        )}
      </div>
    </div>
  );
}

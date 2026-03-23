import React from "react";
import { Plane } from "lucide-react";
import { FlightStatusBadge } from "./FlightStatusBadge";
import { FlightCountdown } from "./FlightCountdown";
import type { FlightNormalized } from "@/services/flightBoard/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OPERATIONAL_STATUS_LABEL_PT } from "@/services/flightBoard/operationalStatus";

interface FlightRowProps {
  flight: FlightNormalized;
  mode: "departure" | "arrival";
  now: number;
  isNext?: boolean;
  isDelayed?: boolean;
}

export function FlightRow({
  flight,
  mode,
  now,
  isNext,
  isDelayed,
}: FlightRowProps) {
  const isHighlighted = isNext || isDelayed;

  const airportLine =
    mode === "departure"
      ? [flight.airportInfo?.departure?.name, flight.airportInfo?.departure?.city]
          .filter(Boolean)
          .join(" · ")
      : [flight.airportInfo?.arrival?.name, flight.airportInfo?.arrival?.city]
          .filter(Boolean)
          .join(" · ");

  const side = mode === "departure" ? flight.airportInfo?.departure : flight.airportInfo?.arrival;
  const airportCityCountry = [side?.city, side?.country].filter(Boolean).join(", ");

  const ds = flight.dataSources;
  const showSourceChips = Boolean(ds || flight.openSkyMatch);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-transparent px-4 py-3.5 transition-colors",
        "sm:flex-nowrap sm:gap-4 sm:px-5",
        isHighlighted && !isDelayed && "border-primary/20 bg-primary/[0.03]",
        isDelayed && "border-warning/30 bg-warning/[0.06]"
      )}
    >
      {/* Rota e horários - coluna principal */}
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:min-w-[140px]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8">
            <Plane className="h-4 w-4 rotate-[-45deg] text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-foreground">
              {flight.origin} → {flight.destination}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {flight.airlineName} {flight.flightNumber}
            </p>
            {airportLine ? (
              <p className="line-clamp-2 text-[10px] text-muted-foreground/90">{airportLine}</p>
            ) : null}
            {airportCityCountry ? (
              <p className="text-[10px] text-muted-foreground/80">
                Airport: {airportCityCountry}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div>
            <p className="text-[10px] text-muted-foreground">
              {mode === "departure" ? "Partida" : "Chegada"}
            </p>
            <p className="font-mono text-sm font-semibold text-foreground">
              {flight.scheduledTime}
              {flight.estimatedTime && flight.estimatedTime !== flight.scheduledTime && (
                <span className="ml-1.5 text-muted-foreground">
                  → {flight.estimatedTime}
                </span>
              )}
            </p>
          </div>

          {flight.delayMinutes != null && flight.delayMinutes > 0 && (
            <div>
              <p className="text-[10px] text-warning">Atraso</p>
              <p className="font-mono text-sm font-semibold text-warning">
                +{flight.delayMinutes}m
              </p>
            </div>
          )}

          <FlightCountdown
            scheduledTimestamp={flight.scheduledTimestamp}
            now={now}
            mode={mode}
            statusKey={flight.statusKey}
          />
        </div>
      </div>

      {/* Detalhes secundários - escondidos em mobile compacto */}
      <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
        {(flight.gate || flight.terminal || flight.aircraft) && (
          <div className="flex flex-wrap justify-end gap-2">
            {flight.gate && (
              <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                Portão {flight.gate}
              </span>
            )}
            {flight.terminal && (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                T{flight.terminal}
              </span>
            )}
            {flight.aircraft && (
              <span className="hidden rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline">
                {flight.aircraft}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-1">
          {flight.operationalStatus && (
            <Badge variant="outline" className="text-[9px] font-normal">
              {OPERATIONAL_STATUS_LABEL_PT[flight.operationalStatus] ?? flight.operationalStatus}
            </Badge>
          )}
          {flight.liveTrackingAvailable && (
            <span className="rounded-md border border-primary/25 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-medium text-primary">
              Ao vivo
            </span>
          )}
          {ds?.openSky && (
            <Badge variant="secondary" className="text-[9px] font-normal">
              OpenSky
            </Badge>
          )}
          {showSourceChips && (
            <>
              {ds?.scale && (
                <Badge variant="outline" className="text-[9px] font-normal">
                  Escala
                </Badge>
              )}
              {ds?.airport && (
                <Badge variant="outline" className="text-[9px] font-normal">
                  Aeroporto
                </Badge>
              )}
              {ds?.baseAirport && (
                <Badge variant="outline" className="text-[9px] font-normal">
                  Base
                </Badge>
              )}
              {flight.openSkyMatch === "no_match" && (
                <Badge variant="outline" className="text-[9px] font-normal text-muted-foreground">
                  OpenSky sem match
                </Badge>
              )}
              {flight.openSkyMatch === "unavailable" && (
                <Badge variant="outline" className="text-[9px] font-normal text-muted-foreground">
                  Live indisponível
                </Badge>
              )}
              {flight.enrichmentFallback && flight.enrichmentFallback !== "NONE" && (
                <Badge variant="outline" className="max-w-[140px] truncate text-[9px] font-normal text-amber-700 dark:text-amber-400">
                  {flight.enrichmentFallbackLabel ?? flight.enrichmentFallback}
                </Badge>
              )}
            </>
          )}
        </div>

        <FlightStatusBadge
          statusKey={flight.statusKey}
          label={flight.statusLabel}
        />
      </div>
    </div>
  );
}

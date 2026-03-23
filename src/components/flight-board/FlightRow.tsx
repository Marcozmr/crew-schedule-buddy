import React from "react";
import { Plane } from "lucide-react";
import { FlightStatusBadge } from "./FlightStatusBadge";
import { FlightCountdown } from "./FlightCountdown";
import type { FlightNormalized } from "@/services/flightBoard/types";
import { cn } from "@/lib/utils";

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
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        {(flight.gate || flight.terminal || flight.aircraft) && (
          <div className="flex flex-wrap gap-2">
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

        <FlightStatusBadge
          statusKey={flight.statusKey}
          label={flight.statusLabel}
        />
      </div>
    </div>
  );
}

import React from "react";
import { Plane } from "lucide-react";
import { FlightStatusBadge } from "./FlightStatusBadge";
import { FlightCountdown } from "./FlightCountdown";
import type { FlightNormalized } from "@/services/flightBoard/types";
import { cn } from "@/lib/utils";
import { OperationalCodeBadges } from "./OperationalCodeBadges";

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
  const hasPresentation = mode === "departure" && flight.presentationTime;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border px-4 py-3 transition-colors",
        "sm:px-5 sm:py-3.5",
        isHighlighted && !isDelayed && "border-primary/20 bg-primary/[0.03]",
        isDelayed && "border-warning/30 bg-warning/[0.06]"
      )}
    >
      {/* 1. Apresentação no topo — primeira linha visível */}
      {hasPresentation && (
        <div className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-center sm:text-left">
          <p className="text-sm font-medium text-primary">
            Apresentação às {flight.presentationTime}
          </p>
        </div>
      )}

      {/* 2. Cabeçalho: voo, companhia, status */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 sm:h-9 sm:w-9">
            <Plane className="h-3.5 w-3.5 rotate-[-45deg] text-primary sm:h-4 sm:w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-bold text-foreground">
              {flight.flightNumber}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {flight.airlineName}
            </p>
          </div>
        </div>
        <FlightStatusBadge
          statusKey={flight.statusKey}
          label={flight.statusLabel}
        />
      </div>

      {/* 3. Rota + siglas operacionais */}
      <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <p className="truncate font-mono text-base font-semibold text-foreground">
          {flight.origin} → {flight.destination}
        </p>
        {flight.operationalCodes && flight.operationalCodes.length > 0 && (
          <OperationalCodeBadges codes={flight.operationalCodes} className="sm:justify-end" />
        )}
      </div>

      {/* 4. Horários */}
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          <p className="text-[10px] text-muted-foreground">
            {mode === "departure" ? "Partida" : "Chegada"}
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {flight.scheduledTime}
            {flight.estimatedTime && flight.estimatedTime !== flight.scheduledTime && (
              <span className="ml-1 text-muted-foreground">
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

      {/* 5. Informações secundárias: terminal, gate, badges */}
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
        {flight.gate && (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Portão {flight.gate}
          </span>
        )}
        {flight.terminal && (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            T{flight.terminal}
          </span>
        )}
        {flight.aircraft && (
          <span className="hidden rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground sm:inline">
            {flight.aircraft}
          </span>
        )}
        {flight.liveTrackingAvailable && (
          <span className="rounded-md border border-primary/25 bg-primary/[0.06] px-2 py-0.5 text-[11px] font-medium text-primary">
            Ao vivo
          </span>
        )}
      </div>
    </div>
  );
}

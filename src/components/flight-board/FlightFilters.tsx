import React from "react";
import { RefreshCw, Plane, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_AIRPORTS, FLIGHT_BOARD_ALL_AIRPORTS } from "@/services/flightBoard/constants";
import type { FlightFilters as FlightFiltersType } from "@/services/flightBoard/types";
import { cn } from "@/lib/utils";

interface FlightFiltersProps {
  filters: FlightFiltersType;
  onChange: (filters: Partial<FlightFiltersType>) => void;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated?: string;
  homeBase?: string | null;
  className?: string;
}

export function FlightFilters({
  filters,
  onChange,
  onRefresh,
  isLoading,
  lastUpdated,
  homeBase,
  className,
}: FlightFiltersProps) {
  const airportOptions = [
    { code: FLIGHT_BOARD_ALL_AIRPORTS, name: "Todos os aeroportos" },
    ...(homeBase
      ? [
          { code: homeBase, name: `Minha base (${homeBase})` },
          ...DEFAULT_AIRPORTS.filter((a) => a.code !== homeBase),
        ]
      : DEFAULT_AIRPORTS),
  ];

  return (
    <div className={cn("w-full min-w-0 max-w-full space-y-3 overflow-hidden", className)}>
      {/* Mobile: coluna única | Desktop: linha com tabs + modo + refresh */}
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Tabs
          value={filters.mode}
          onValueChange={(v) => onChange({ mode: v as "departures" | "arrivals" })}
        >
          <TabsList className="h-9 w-full min-w-0 sm:w-auto">
            <TabsTrigger value="departures" className="flex-1 gap-1.5 text-xs sm:flex-initial sm:text-sm">
              <Plane className="h-3.5 w-3.5 shrink-0 rotate-[-45deg]" />
              Partidas
            </TabsTrigger>
            <TabsTrigger value="arrivals" className="flex-1 gap-1.5 text-xs sm:flex-initial sm:text-sm">
              <Plane className="h-3.5 w-3.5 shrink-0 rotate-[45deg]" />
              Chegadas
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={filters.boardMode ?? "my_schedule"}
          onValueChange={(v) =>
            onChange({ boardMode: v as "my_schedule" | "airport_base" })
          }
        >
          <SelectTrigger className="h-9 w-full min-w-0 sm:w-[220px] lg:w-[240px]">
            <SelectValue placeholder="Modo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="my_schedule">Minha escala</SelectItem>
            <SelectItem value="airport_base">Aeroporto</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex min-w-0 items-center gap-2">
          {lastUpdated && (
            <span className="truncate text-[10px] text-muted-foreground">
              {new Date(lastUpdated).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {homeBase && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Minha base:{" "}
          <span className="font-semibold text-foreground">{homeBase}</span>
          <span className="text-muted-foreground"> · detectada da escala</span>
        </p>
      )}

      {/* Mobile: coluna única | Tablet: 2 cols | Desktop: 5 cols */}
      <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="min-w-0 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Aeroporto</Label>
          <Select
            value={filters.airportCode}
            onValueChange={(v) => onChange({ airportCode: v })}
          >
            <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0 touch-manipulation sm:h-9 sm:min-h-0">
              <MapPin className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Escolha o aeroporto" />
            </SelectTrigger>
            <SelectContent>
              {airportOptions.map((a) => (
                <SelectItem key={a.code} value={a.code}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <Input
            placeholder="Companhia (LA, G3)"
            value={filters.airlineCode}
            onChange={(e) =>
              onChange({ airlineCode: e.target.value.toUpperCase().slice(0, 3) })
            }
            className="h-9 w-full min-w-0"
          />
        </div>

        <div className="min-w-0">
          <Input
            placeholder="Nº do voo"
            value={filters.flightNumber}
            onChange={(e) => onChange({ flightNumber: e.target.value })}
            className="h-9 w-full min-w-0"
          />
        </div>

        <div className="min-w-0">
          <Input
            type="date"
            value={filters.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className="h-9 w-full min-w-0"
          />
        </div>
      </div>
    </div>
  );
}

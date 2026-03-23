import React from "react";
import { RefreshCw, Plane, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_AIRPORTS } from "@/services/flightBoard/constants";
import type { FlightFilters as FlightFiltersType } from "@/services/flightBoard/types";
import { cn } from "@/lib/utils";

interface FlightFiltersProps {
  filters: FlightFiltersType;
  onChange: (filters: Partial<FlightFiltersType>) => void;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated?: string;
  homeBase?: string | null;
  /** Fuso operacional (mesmo do calendário / dashboard) */
  operationalTimezone?: string;
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
  const airportOptions = homeBase
    ? [
        { code: homeBase, name: `Base (${homeBase})` },
        ...DEFAULT_AIRPORTS.filter((a) => a.code !== homeBase),
      ]
    : DEFAULT_AIRPORTS;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filters.mode}
          onValueChange={(v) => onChange({ mode: v as "departures" | "arrivals" })}
        >
          <TabsList className="h-9">
            <TabsTrigger value="departures" className="gap-1.5 text-xs sm:text-sm">
              <Plane className="h-3.5 w-3.5 rotate-[-45deg]" />
              Partidas
            </TabsTrigger>
            <TabsTrigger value="arrivals" className="gap-1.5 text-xs sm:text-sm">
              <Plane className="h-3.5 w-3.5 rotate-[45deg]" />
              Chegadas
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              Atualizado às{" "}
              {new Date(lastUpdated).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        <div className="col-span-2 sm:col-span-1">
          <Select
            value={filters.airportCode}
            onValueChange={(v) => onChange({ airportCode: v })}
          >
            <SelectTrigger className="h-9">
              <MapPin className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Aeroporto" />
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

        <div>
          <Input
            placeholder="Companhia (LA, G3)"
            value={filters.airlineCode}
            onChange={(e) =>
              onChange({ airlineCode: e.target.value.toUpperCase().slice(0, 3) })
            }
            className="h-9"
          />
        </div>

        <div>
          <Input
            placeholder="Nº do voo"
            value={filters.flightNumber}
            onChange={(e) => onChange({ flightNumber: e.target.value })}
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Input
            type="date"
            value={filters.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className="h-9"
          />
          {operationalTimezone && (
            <p className="text-[10px] leading-tight text-muted-foreground">
              Dia operacional (YYYY-MM-DD), alinhado ao calendário · fuso{" "}
              <span className="font-mono">{operationalTimezone}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

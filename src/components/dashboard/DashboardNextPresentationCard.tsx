import { Link } from "react-router-dom";
import { Clock, Plane, CalendarClock, Wind, Thermometer, Cloud } from "lucide-react";
import { motion } from "framer-motion";
import type { DutyPeriod } from "@/lib/duty-grouping";
import { formatDateBR } from "@/lib/date-utils";
import { CrewFunctionActivityBadge } from "@/components/roster/CrewFunctionActivityBadge";
import { useAirportWeather, FC_COLOR } from "@/hooks/useAirportWeather";
import { useMemo } from "react";

interface Props {
  nextDuty: DutyPeriod | null;
  todayStr: string;
}

export function DashboardNextPresentationCard({ nextDuty, todayStr }: Props) {
  // Collect unique arrival airports from all legs
  const arrivalCodes = useMemo(() => {
    if (!nextDuty) return [];
    return [...new Set(
      nextDuty.legs
        .filter(l => l.is_flight && l.arrival)
        .map(l => l.arrival.trim().toUpperCase().slice(0, 3))
    )];
  }, [nextDuty]);

  const { data: wxData } = useAirportWeather(arrivalCodes);

  if (!nextDuty) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-5 py-6 text-center"
      >
        <Plane className="mx-auto mb-2 h-9 w-9 text-muted-foreground/35" />
        <p className="text-sm font-medium text-foreground">Nenhuma apresentação futura na escala</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Inclua ou atualize dados em <span className="font-medium text-foreground">Minha escala</span> para ver a próxima jornada aqui.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link to="/minha-escala" className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
            <CalendarClock className="h-3.5 w-3.5" />
            Abrir Minha escala
          </Link>
        </div>
      </motion.div>
    );
  }

  const isToday = nextDuty.dutyStartDate === todayStr;
  const dateLine = isToday ? "Hoje" : formatDateBR(nextDuty.dutyStartDate);

  // Last arrival = final destination
  const lastFlightLeg = [...nextDuty.legs].reverse().find(l => l.is_flight && l.arrival);
  const finalArrival = lastFlightLeg?.arrival?.trim().toUpperCase().slice(0, 3) ?? '';
  const finalWx = finalArrival ? wxData[finalArrival] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-sm"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            <Clock className="h-3 w-3" />
            Próxima apresentação
          </span>
          <span className="text-[11px] text-muted-foreground">{dateLine}</span>
        </div>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="break-words text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
              {nextDuty.routeSummary}
            </p>
            {nextDuty.reportTime && (
              <div className="mt-2 flex items-baseline gap-3">
                <p className="font-mono text-3xl font-semibold tabular-nums text-primary sm:text-4xl">
                  {nextDuty.reportTime}
                </p>
                <span className="text-xs text-muted-foreground">apresentação</span>
              </div>
            )}
            {!nextDuty.reportTime && (
              <p className="mt-1 text-sm text-muted-foreground">Horário de apresentação não informado</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
          <span>
            Jornada:{" "}
            <span className="font-mono font-medium text-foreground">
              {nextDuty.dutyStartTime} → {nextDuty.dutyEndTime}
            </span>
          </span>
          {nextDuty.legCount > 0 && (
            <span>{nextDuty.legCount} {nextDuty.legCount === 1 ? "trecho" : "trechos"}</span>
          )}
        </div>

        {/* Weather at final destination */}
        {finalWx && (
          <div className="rounded-xl border border-border/60 bg-card/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl">{finalWx.conditionEmoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {finalWx.condition}
                    {finalWx.temp != null && (
                      <span className="ml-1.5 text-muted-foreground">{Math.round(finalWx.temp)}°C</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    METAR {finalArrival}
                    {finalWx.windSpeed != null && (
                      <span className="ml-2">{Math.round(finalWx.windSpeed)}kt</span>
                    )}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide ${FC_COLOR[finalWx.flightCategory]}`}>
                {finalWx.flightCategory}
              </span>
            </div>
          </div>
        )}

        {/* Weather for each leg with flight */}
        {nextDuty.legs.filter(l => l.is_flight && l.arrival && wxData[l.arrival.trim().toUpperCase().slice(0, 3)]).length > 1 && (
          <div className="space-y-1.5 border-t border-border/40 pt-3">
            {nextDuty.legs
              .filter(l => l.is_flight && l.arrival)
              .map((leg, i) => {
                const code = leg.arrival.trim().toUpperCase().slice(0, 3);
                const wx = wxData[code];
                if (!wx) return null;
                return (
                  <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground font-mono">
                      {leg.departure?.slice(0,3)} → {code}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{wx.conditionEmoji} {Math.round(wx.temp ?? 0)}°C</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${FC_COLOR[wx.flightCategory]}`}>
                        {wx.flightCategory}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {nextDuty.legs[0] && (
          <div className="border-t border-border/40 pt-3">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Função no 1.º trecho
            </p>
            <CrewFunctionActivityBadge leg={nextDuty.legs[0]} />
          </div>
        )}

        <Link
          to="/weather"
          className="inline-flex items-center gap-2 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          <Cloud className="h-3.5 w-3.5" />
          Abrir MetCenter — Briefing completo
        </Link>
      </div>
    </motion.div>
  );
}

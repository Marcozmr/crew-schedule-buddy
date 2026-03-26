import { Link } from "react-router-dom";
import { Clock, Plane, Radio, CalendarClock } from "lucide-react";
import { motion } from "framer-motion";
import type { DutyPeriod } from "@/lib/duty-grouping";
import { formatDateBR } from "@/lib/date-utils";

interface DashboardNextPresentationCardProps {
  nextDuty: DutyPeriod | null;
  todayStr: string;
}

/**
 * Destaque principal: próxima apresentação / próxima jornada na escala.
 */
export function DashboardNextPresentationCard({
  nextDuty,
  todayStr,
}: DashboardNextPresentationCardProps) {
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
          <Link
            to="/minha-escala"
            className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Abrir Minha escala
          </Link>
          <Link
            to="/pro-board"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Radio className="h-3.5 w-3.5" />
            Pro Board
          </Link>
        </div>
      </motion.div>
    );
  }

  const isToday = nextDuty.dutyStartDate === todayStr;
  const dateLine = isToday
    ? "Hoje"
    : formatDateBR(nextDuty.dutyStartDate);

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
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-primary sm:text-4xl">
                {nextDuty.reportTime}
              </p>
            )}
            {!nextDuty.reportTime && (
              <p className="mt-1 text-sm text-muted-foreground">Horário de apresentação não informado na escala</p>
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
            <span>
              {nextDuty.legCount} {nextDuty.legCount === 1 ? "trecho" : "trechos"}
            </span>
          )}
        </div>

        <Link
          to="/pro-board"
          className="inline-flex items-center gap-2 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          <Radio className="h-3.5 w-3.5" />
          Consulta ampla e voos ao vivo — Pro Board
        </Link>
      </div>
    </motion.div>
  );
}

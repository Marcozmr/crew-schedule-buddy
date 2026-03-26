import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Upload,
  Calendar,
  Shield,
  Clock,
  Plane,
  ChevronRight,
  BedDouble,
  Settings,
  Gauge,
} from "lucide-react";

import { AppLayout } from "../components/AppLayout";
import { RouteErrorBoundary } from "../components/RouteErrorBoundary";
import { FlightBoard } from "../components/flight-board";
import { PdfImportDialog } from "../components/PdfImportDialog";
import {
  OnboardingModal,
  useOnboardingModal,
} from "../components/OnboardingModal";
import { DutyPeriodCard } from "../components/dashboard/DutyPeriodCard";
import { Button } from "../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";

import { useAuth } from "../lib/auth-context";
import {
  formatDateBR,
  formatHoursMinutes,
  resolveSafeIANATimezone,
} from "../lib/date-utils";
import {
  groupIntoDutyPeriods,
  getTodayDutyPeriods,
  getNextDutyPeriod,
} from "../lib/duty-grouping";
import {
  analyzeOperationalSchedule,
  getMonthlyStatusSummary,
  getOperationalStatusSummary,
} from "../lib/operational-analysis";
import { NotificationService } from "../lib/services/notification-service";

import { useScheduleData } from "../hooks/useScheduleData";
import { useOperationalPreferences } from "../hooks/useOperationalPreferences";
import { useOperationalClock } from "../hooks/useOperationalClock";
import { RosterConnectionBanner } from "@/components/roster/RosterConnectionBanner";
import { CorporateRosterFlowBanner } from "@/components/roster/CorporateRosterFlowBanner";
import { logScheduleMetricsDev } from "@/lib/schedule-metrics-dev";

const statusCardMeta = {
  regular: {
    iconBg: "bg-success/10",
    iconColor: "text-success",
    textColor: "text-success",
    border: "border-success/25",
    accent: "from-success/10 via-success/5 to-transparent",
  },
  attention: {
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    textColor: "text-warning",
    border: "border-warning/25",
    accent: "from-warning/10 via-warning/5 to-transparent",
  },
  review: {
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    textColor: "text-warning",
    border: "border-warning/25",
    accent: "from-warning/10 via-warning/5 to-transparent",
  },
  critical: {
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    textColor: "text-destructive",
    border: "border-destructive/25",
    accent: "from-destructive/10 via-destructive/5 to-transparent",
  },
} as const;

const buildDutyKey = (date: string, time?: string | null) =>
  `${date}|${time ?? ""}`;

const buildResultKey = (localReportTime: string) =>
  buildDutyKey(localReportTime.slice(0, 10), localReportTime.slice(11, 16));

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { schedule, loading, reload, dashboardRosterSource } = useScheduleData();
  const { shouldShow: showOnboarding, dismiss: dismissOnboarding } =
    useOnboardingModal();
  const { homeBase, timezone } = useOperationalPreferences();
  /** Fuso seguro — Intl lança RangeError com IANA inválido e derruba o dashboard (tela branca). */
  const safeTz = useMemo(() => resolveSafeIANATimezone(timezone), [timezone]);
  const { now, todayStr, monthStr } = useOperationalClock(safeTz, reload);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[Dashboard] operacional", {
        safeTz,
        todayStr,
        rawTimezoneSetting: timezone,
      });
    }
  }, [safeTz, todayStr, timezone]);

  useEffect(() => {
    if (!loading && schedule.length > 0) {
      logScheduleMetricsDev(schedule, "dashboard");
    }
  }, [loading, schedule]);

  const hasSchedule = !loading && schedule.length > 0;
  const allDutyPeriods = useMemo(() => groupIntoDutyPeriods(schedule), [schedule]);

  const todayDuties = useMemo(
    () => getTodayDutyPeriods(allDutyPeriods, todayStr, homeBase),
    [allDutyPeriods, todayStr, homeBase]
  );

  const nextDuty = useMemo(
    () => getNextDutyPeriod(allDutyPeriods, todayStr, now, safeTz),
    [allDutyPeriods, todayStr, now, safeTz]
  );

  const analysis = useMemo(
    () => analyzeOperationalSchedule(schedule, safeTz, homeBase),
    [schedule, safeTz, homeBase]
  );

  const monthDutyHours = useMemo(() => {
    if (!analysis?.results?.length) return 0;
    return analysis.results
      .filter((result) => result.duty.reportTimeLocal.startsWith(monthStr))
      .reduce((sum, result) => sum + result.duty.totalDutyHours, 0);
  }, [analysis, monthStr]);

  useEffect(() => {
    if (!user || !analysis) return;

    const run = async () => {
      if (nextDuty?.reportTime) {
        await NotificationService.notifyDutyReminder(
          user.id,
          formatDateBR(nextDuty.dutyStartDate),
          nextDuty.reportTime,
          nextDuty.legs[0]?.flight_number || nextDuty.routeSummary
        );
      }

      const focus = analysis.focus;
      if (!focus) return;

      if (focus.status === "WARNING") {
        await NotificationService.notifyOperationalWarning(
          user.id,
          "Sua jornada atual está próxima do limite operacional."
        );
      }

      if (
        focus.status === "NON_COMPLIANT" ||
        focus.status === "CRITICAL_FATIGUE"
      ) {
        await NotificationService.notifyOperationalWarning(
          user.id,
          "Há uma operação crítica na jornada ativa. Revise jornada e repouso."
        );
      }

      if (
        focus.rest.restBeforeDutyHours != null &&
        focus.rest.restBeforeDutyHours < focus.rest.minRequiredRestHours
      ) {
        await NotificationService.notifyRestReminder(
          user.id,
          `Repouso calculado de ${formatHoursMinutes(
            focus.rest.restBeforeDutyHours
          )} abaixo do mínimo de ${formatHoursMinutes(
            focus.rest.minRequiredRestHours
          )}.`
        );
      }
    };

    const t = window.setTimeout(() => {
      void run();
    }, 500);
    return () => window.clearTimeout(t);
  }, [analysis, nextDuty, user]);

  const greeting = () => {
    const hourStr = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: safeTz,
    }).format(now);

    const hour = Number(hourStr);

    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.3, ease: "easeOut" as const },
  });

  const statusResult = analysis?.focus ?? null;
  const operationalStatus = getOperationalStatusSummary(statusResult);
  const monthlyStatus = getMonthlyStatusSummary(statusResult);
  const operationalMeta = statusCardMeta[operationalStatus.tone];
  const monthlyMeta = statusCardMeta[monthlyStatus.tone];

  const monthlyShortText =
    monthlyStatus.tone === "critical"
      ? "Limite excedido"
      : monthlyStatus.tone === "attention" || monthlyStatus.tone === "review"
      ? "Próximo do limite"
      : "Dentro do limite";

  const monthlyBalanceHours =
    monthlyStatus.limitHours - monthlyStatus.usedHours;

  const monthlyTooltipDetail =
    monthlyStatus.tone === "critical"
      ? `Excedente de ${formatHoursMinutes(Math.abs(monthlyBalanceHours))}.`
      : `Restam ${formatHoursMinutes(Math.max(monthlyBalanceHours, 0))}.`;

  const dutyStatusByKey = useMemo(
    () =>
      new Map(
        (analysis?.results ?? []).map((result) => [
          buildResultKey(result.duty.reportTimeLocal),
          getOperationalStatusSummary(result),
        ])
      ),
    [analysis]
  );

  return (
    <AppLayout>
      <div className="pb-10">
        <OnboardingModal open={showOnboarding} onClose={dismissOnboarding} />

        <CorporateRosterFlowBanner />
        <RosterConnectionBanner />

        <motion.div {...fade(0)} className="mb-8 min-w-0">
          <h1 className="break-words text-xl font-semibold text-foreground lg:text-2xl">
            {greeting()},{" "}
            <span className="text-primary">
              {profile?.name?.split(" ")[0] || "Tripulante"}
            </span>
          </h1>

          <p className="mt-1 break-words text-sm text-muted-foreground">
            {now.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: safeTz,
            })}
          </p>
        </motion.div>

        <motion.div {...fade(0.03)} className="mb-6">
          <RouteErrorBoundary scope="Flight Board Pro">
            <FlightBoard
              schedule={schedule}
              scheduleLoading={loading}
              operationalTodayIso={todayStr}
              operationalTimezone={safeTz}
              scheduleSourceLabel={dashboardRosterSource?.sourceLabel}
            />
          </RouteErrorBoundary>
        </motion.div>

        {loading && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="skeleton h-[104px] rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && schedule.length === 0 && (
          <>
            <motion.div
              {...fade(0.05)}
              className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4"
            >
              {[
                {
                  label: "Horas de voo (30 dias)",
                  value: "0h00",
                  detail: "Status: Regular · Dentro do limite",
                  icon: Clock,
                },
                {
                  label: "Jornada mensal (duty)",
                  value: "0h00",
                  detail: "Tempo total de jornada no mês calendário",
                  icon: Gauge,
                },
                {
                  label: "Próximo voo",
                  value: "—",
                  detail: "Sem jornada programada",
                  icon: Plane,
                },
                {
                  label: "Situação operacional",
                  value: "Regular",
                  detail: "Operação dentro do esperado",
                  icon: Shield,
                  status: "success" as const,
                },
              ].map((stat, index) => (
                <div
                  key={index}
                  className="glass flex min-w-0 items-start gap-3 p-4 hover-lift"
                >
                  <div
                    className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
                      stat.status === "success"
                        ? "bg-success/10"
                        : "bg-primary/8"
                    }`}
                  >
                    <stat.icon
                      className={`h-5 w-5 ${
                        stat.status === "success"
                          ? "text-success"
                          : "text-primary"
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="break-words text-[11px] font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="break-words font-mono text-base font-semibold text-foreground sm:text-lg">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                      {stat.detail}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div {...fade(0.1)}>
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                Comece agora
              </h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  {
                    title: "Importar escala",
                    desc: "Envie seu PDF",
                    icon: Upload,
                    action: "import",
                  },
                  {
                    title: "Calcular jornada",
                    desc: "Cálculo operacional",
                    icon: Clock,
                    path: "/duty-calc",
                  },
                  {
                    title: "Calcular descanso",
                    desc: "Repouso real",
                    icon: BedDouble,
                    path: "/rest-calc",
                  },
                  {
                    title: "Calculadora operacional",
                    desc: "Visão completa",
                    icon: Shield,
                    path: "/regulation",
                  },
                  {
                    title: "Configurações",
                    desc: "Preferências do app",
                    icon: Settings,
                    path: "/settings",
                  },
                ].map((card, index) =>
                  card.action === "import" ? (
                    <PdfImportDialog
                      key={index}
                      onImportComplete={reload}
                      trigger={
                        <div className="glass group h-full min-w-0 cursor-pointer p-5 text-left hover-lift">
                          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 transition-colors group-hover:bg-primary/15">
                            <card.icon className="h-5 w-5 text-primary" />
                          </div>
                          <p className="break-words text-sm font-semibold text-foreground">
                            {card.title}
                          </p>
                          <p className="mt-0.5 break-words text-xs text-muted-foreground">
                            {card.desc}
                          </p>
                        </div>
                      }
                    />
                  ) : (
                    <Link
                      key={index}
                      to={card.path!}
                      className="glass group h-full min-w-0 p-5 hover-lift"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 transition-colors group-hover:bg-primary/15">
                        <card.icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="break-words text-sm font-semibold text-foreground">
                        {card.title}
                      </p>
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">
                        {card.desc}
                      </p>
                    </Link>
                  )
                )}
              </div>
            </motion.div>
          </>
        )}

        {hasSchedule && (
          <div className="space-y-6">
            <motion.div
              {...fade(0.05)}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`glass hover-lift flex min-w-0 cursor-help items-start gap-3 border p-4 ${monthlyMeta.border}`}
                  >
                    <div
                      className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${monthlyMeta.iconBg}`}
                    >
                      <Clock className={`h-5 w-5 ${monthlyMeta.iconColor}`} />
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-[11px] font-medium text-muted-foreground">
                        Horas de voo (30 dias)
                      </p>
                      <p className="break-words font-mono text-base font-semibold text-foreground sm:text-lg">
                        {formatHoursMinutes(monthlyStatus.usedHours)}
                      </p>
                      <p
                        className={`mt-0.5 text-[11px] font-medium ${monthlyMeta.textColor}`}
                      >
                        Status: {monthlyStatus.label}
                      </p>
                      <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                        {monthlyShortText}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>

                <TooltipContent side="top" align="start" className="max-w-[280px]">
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold">
                      {formatHoursMinutes(monthlyStatus.usedHours)} de{" "}
                      {formatHoursMinutes(monthlyStatus.limitHours)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tempo de voo acumulado nos últimos 30 dias.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Limite aplicado: {formatHoursMinutes(monthlyStatus.limitHours)}
                    </p>
                    <p className={`text-xs font-medium ${monthlyMeta.textColor}`}>
                      Status mensal: {monthlyStatus.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {monthlyTooltipDetail}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>

              <div className="glass flex min-w-0 items-start gap-3 p-4 hover-lift">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                  <Gauge className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="break-words text-[11px] font-medium text-muted-foreground">
                    Jornada mensal (duty)
                  </p>
                  <p className="break-words font-mono text-base font-semibold text-foreground sm:text-lg">
                    {formatHoursMinutes(monthDutyHours)}
                  </p>
                  <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                    Tempo total de jornada no mês calendário
                  </p>
                </div>
              </div>

              <div className="glass flex min-w-0 items-start gap-3 p-4 hover-lift">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                  <Plane className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Próximo voo
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                    {nextDuty ? nextDuty.routeSummary : "—"}
                  </p>
                  {nextDuty?.reportTime && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      Apresentação {nextDuty.reportTime}
                    </p>
                  )}
                </div>
              </div>

              <div
                className={`glass relative min-w-0 overflow-hidden border p-4 hover-lift ${operationalMeta.border}`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${operationalMeta.accent}`}
                />
                <div className="relative flex min-w-0 items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${operationalMeta.iconBg}`}
                  >
                    <Shield className={`h-5 w-5 ${operationalMeta.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-[11px] font-medium text-muted-foreground">
                      Situação operacional
                    </p>
                    <p className={`text-sm font-semibold ${operationalMeta.textColor}`}>
                      {operationalStatus.label}
                    </p>
                    <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                      {operationalStatus.subtitle}
                    </p>
                    {operationalStatus.reason && (
                      <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                        {operationalStatus.reason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div {...fade(0.1)}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Operações de hoje
                </h2>

                <PdfImportDialog
                  onImportComplete={reload}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full justify-center gap-1.5 text-xs text-primary hover:bg-primary/8 hover:text-primary sm:w-auto sm:justify-start"
                    >
                      <Upload className="h-3.5 w-3.5" /> Importar
                    </Button>
                  }
                />
              </div>

              {todayDuties.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {todayDuties.map((duty, index) => (
                    <DutyPeriodCard
                      key={duty.id}
                      duty={duty}
                      index={index}
                      statusSummary={dutyStatusByKey.get(
                        buildDutyKey(
                          duty.dutyStartDate,
                          duty.reportTime || duty.dutyStartTime
                        )
                      )}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass min-w-0 p-6 text-center">
                  <Plane className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="mb-1 text-sm text-muted-foreground">
                    Nenhuma jornada hoje
                  </p>
                  {nextDuty && (
                    <p className="break-words text-xs text-muted-foreground">
                      Próxima:{" "}
                      <span className="font-medium text-foreground">
                        {nextDuty.routeSummary}
                      </span>{" "}
                      em{" "}
                      <span className="font-medium text-foreground">
                        {formatDateBR(nextDuty.dutyStartDate)}
                      </span>
                      {nextDuty.reportTime && (
                        <>
                          {" "}
                          · Apresentação{" "}
                          <span className="font-mono text-foreground">
                            {nextDuty.reportTime}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}
            </motion.div>

            <motion.div
              {...fade(0.2)}
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              {[
                {
                  label: "Calendário da escala",
                  path: "/schedule",
                  icon: Calendar,
                  desc: "Calendário mensal",
                },
                {
                  label: "Calcular jornada",
                  path: "/duty-calc",
                  icon: Clock,
                  desc: "Cálculo operacional",
                },
                {
                  label: "Calcular descanso",
                  path: "/rest-calc",
                  icon: BedDouble,
                  desc: "Repouso operacional",
                },
                {
                  label: "Calculadora operacional",
                  path: "/regulation",
                  icon: Shield,
                  desc: "Situação e limites",
                },
                {
                  label: "Configurações",
                  path: "/settings",
                  icon: Settings,
                  desc: "Preferências do app",
                },
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="glass group flex min-w-0 items-center gap-3 px-4 py-3.5 hover-lift"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 transition-colors group-hover:bg-primary/12">
                    <item.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
                </Link>
              ))}
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
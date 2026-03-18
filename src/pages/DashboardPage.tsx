import { useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useOperationalPreferences } from '@/hooks/useOperationalPreferences';
import { useOperationalClock } from '@/hooks/useOperationalClock';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { OnboardingModal, useOnboardingModal } from '@/components/OnboardingModal';
import { Upload, Calendar, Shield, Clock, Plane, ChevronRight, BedDouble, Settings, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatDateBR, formatHoursMinutes } from '@/lib/date-utils';
import { groupIntoDutyPeriods, getTodayDutyPeriods, getNextDutyPeriod } from '@/lib/duty-grouping';
import { DutyPeriodCard } from '@/components/dashboard/DutyPeriodCard';
import { analyzeOperationalSchedule, getMonthlyStatusSummary, getOperationalStatusSummary } from '@/lib/operational-analysis';
import { NotificationService } from '@/lib/services/notification-service';

const statusCardMeta = {
  regular: {
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    textColor: 'text-success',
    border: 'border-success/25',
    accent: 'from-success/10 via-success/5 to-transparent',
  },
  attention: {
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    textColor: 'text-warning',
    border: 'border-warning/25',
    accent: 'from-warning/10 via-warning/5 to-transparent',
  },
  review: {
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    textColor: 'text-warning',
    border: 'border-warning/25',
    accent: 'from-warning/10 via-warning/5 to-transparent',
  },
  critical: {
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    textColor: 'text-destructive',
    border: 'border-destructive/25',
    accent: 'from-destructive/10 via-destructive/5 to-transparent',
  },
} as const;

const buildDutyKey = (date: string, time?: string | null) => `${date}|${time ?? ''}`;
const buildResultKey = (localReportTime: string) => buildDutyKey(localReportTime.slice(0, 10), localReportTime.slice(11, 16));

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { schedule, loading, reload } = useScheduleData();
  const { shouldShow: showOnboarding, dismiss: dismissOnboarding } = useOnboardingModal();
  const { homeBase, timezone } = useOperationalPreferences();
  const { now, todayStr, monthStr } = useOperationalClock(timezone, reload);

  const hasSchedule = !loading && schedule.length > 0;
  const allDutyPeriods = useMemo(() => groupIntoDutyPeriods(schedule), [schedule]);
  const todayDuties = useMemo(() => getTodayDutyPeriods(allDutyPeriods, todayStr, homeBase), [allDutyPeriods, todayStr, homeBase]);
  const nextDuty = useMemo(() => getNextDutyPeriod(allDutyPeriods, todayStr, now, timezone), [allDutyPeriods, todayStr, now, timezone]);
  const analysis = useMemo(() => analyzeOperationalSchedule(schedule, timezone, homeBase), [schedule, timezone, homeBase]);

  const monthDutyHours = analysis?.results
    .filter((result) => result.duty.reportTimeLocal.startsWith(monthStr))
    .reduce((sum, result) => sum + result.duty.totalDutyHours, 0) ?? 0;

  useEffect(() => {
    if (!user || !analysis) return;

    const run = async () => {
      if (nextDuty?.reportTime) {
        await NotificationService.notifyDutyReminder(
          user.id,
          formatDateBR(nextDuty.dutyStartDate),
          nextDuty.reportTime,
          nextDuty.legs[0]?.flight_number || nextDuty.routeSummary,
        );
      }

      const focus = analysis.focus;
      if (!focus) return;

      if (focus.status === 'WARNING') {
        await NotificationService.notifyOperationalWarning(user.id, 'Sua jornada atual está próxima do limite operacional.');
      }

      if (focus.status === 'NON_COMPLIANT' || focus.status === 'CRITICAL_FATIGUE') {
        await NotificationService.notifyOperationalWarning(user.id, 'Há uma operação crítica na jornada ativa. Revise jornada e repouso.');
      }

      if (focus.rest.restBeforeDutyHours != null && focus.rest.restBeforeDutyHours < focus.rest.minRequiredRestHours) {
        await NotificationService.notifyRestReminder(
          user.id,
          `Repouso calculado de ${formatHoursMinutes(focus.rest.restBeforeDutyHours)} abaixo do mínimo de ${formatHoursMinutes(focus.rest.minRequiredRestHours)}.`,
        );
      }
    };

    void run();
  }, [analysis, nextDuty, user]);

  const greeting = () => {
    const hourStr = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(now);
    const hour = Number(hourStr);
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.3, ease: 'easeOut' as const },
  });

  const statusResult = analysis?.focus ?? null;
  const operationalStatus = getOperationalStatusSummary(statusResult);
  const monthlyStatus = getMonthlyStatusSummary(statusResult);
  const operationalMeta = statusCardMeta[operationalStatus.tone];
  const monthlyMeta = statusCardMeta[monthlyStatus.tone];

  const dutyStatusByKey = useMemo(
    () => new Map((analysis?.results ?? []).map((result) => [buildResultKey(result.duty.reportTimeLocal), getOperationalStatusSummary(result)])),
    [analysis],
  );

  return (
    <AppLayout>
      <div className="pb-10">
        <OnboardingModal open={showOnboarding} onClose={dismissOnboarding} />

        <motion.div {...fade(0)} className="mb-8 min-w-0">
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground break-words">
            {greeting()}, <span className="text-primary">{profile?.name?.split(' ')[0] || 'Tripulante'}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 break-words">
            {now.toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: timezone,
            })}
          </p>
        </motion.div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="skeleton h-[104px] rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && schedule.length === 0 && (
          <>
            <motion.div {...fade(0.05)} className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Status mensal', value: '0h00 de 85h', detail: 'Dentro do limite mensal', icon: Clock },
                { label: 'Jornada no mês', value: '0h00', detail: 'Horas de jornada · mês calendário', icon: Gauge },
                { label: 'Próximo voo', value: '—', detail: 'Sem jornada programada', icon: Plane },
                { label: 'Situação operacional', value: 'Regular', detail: 'Operação dentro do esperado', icon: Shield, status: 'success' as const },
              ].map((stat, index) => (
                <div key={index} className="glass p-4 flex items-start gap-3 hover-lift min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.status === 'success' ? 'bg-success/10' : 'bg-primary/8'}`}>
                    <stat.icon className={`w-5 h-5 ${stat.status === 'success' ? 'text-success' : 'text-primary'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium break-words">{stat.label}</p>
                    <p className="text-base sm:text-lg font-semibold font-mono text-foreground break-words">{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{stat.detail}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div {...fade(0.1)}>
              <h2 className="text-sm font-semibold text-foreground mb-4">Comece agora</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                {[
                  { title: 'Importar escala', desc: 'Envie seu PDF', icon: Upload, action: 'import' },
                  { title: 'Calcular jornada', desc: 'Cálculo operacional', icon: Clock, path: '/duty-calc' },
                  { title: 'Calcular descanso', desc: 'Repouso real', icon: BedDouble, path: '/rest-calc' },
                  { title: 'Calculadora operacional', desc: 'Visão completa', icon: Shield, path: '/regulation' },
                  { title: 'Configurações', desc: 'Preferências do app', icon: Settings, path: '/settings' },
                ].map((card, index) => (
                  card.action === 'import' ? (
                    <PdfImportDialog key={index} onImportComplete={reload} trigger={
                      <div className="glass p-5 cursor-pointer hover-lift group text-left min-w-0 h-full">
                        <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                          <card.icon className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-sm font-semibold text-foreground break-words">{card.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">{card.desc}</p>
                      </div>
                    } />
                  ) : (
                    <Link key={index} to={card.path!} className="glass p-5 hover-lift group min-w-0 h-full">
                      <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                        <card.icon className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-foreground break-words">{card.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">{card.desc}</p>
                    </Link>
                  )
                ))}
              </div>
            </motion.div>
          </>
        )}

        {hasSchedule && (
          <div className="space-y-6">
            <motion.div {...fade(0.05)} className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
              <div className={`glass p-4 flex items-start gap-3 hover-lift border min-w-0 ${monthlyMeta.border}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${monthlyMeta.iconBg}`}>
                  <Clock className={`w-5 h-5 ${monthlyMeta.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium break-words">Status mensal</p>
                  <p className="text-base sm:text-lg font-semibold font-mono text-foreground break-words">
                    {formatHoursMinutes(monthlyStatus.usedHours)} de {formatHoursMinutes(monthlyStatus.limitHours)}
                  </p>
                  <p className={`text-[11px] mt-0.5 font-medium ${monthlyMeta.textColor}`}>Status mensal: {monthlyStatus.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{monthlyStatus.metricLabel} · {monthlyStatus.windowLabel}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{monthlyStatus.subtitle}</p>
                </div>
              </div>

              <div className="glass p-4 flex items-start gap-3 hover-lift min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium break-words">Jornada no mês</p>
                  <p className="text-base sm:text-lg font-semibold font-mono text-foreground break-words">{formatHoursMinutes(monthDutyHours)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 break-words">Horas de jornada · mês calendário</p>
                </div>
              </div>

              <div className="glass p-4 flex items-start gap-3 hover-lift min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Plane className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground font-medium">Próximo voo</p>
                  <p className="text-sm sm:text-base font-semibold text-foreground truncate">{nextDuty ? nextDuty.routeSummary : '—'}</p>
                  {nextDuty?.reportTime && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Apresentação {nextDuty.reportTime}</p>
                  )}
                </div>
              </div>

              <div className={`glass relative overflow-hidden border p-4 hover-lift min-w-0 ${operationalMeta.border}`}>
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${operationalMeta.accent}`} />
                <div className="relative flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${operationalMeta.iconBg}`}>
                    <Shield className={`w-5 h-5 ${operationalMeta.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium break-words">Situação operacional</p>
                    <p className={`text-sm font-semibold ${operationalMeta.textColor}`}>{operationalStatus.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{operationalStatus.subtitle}</p>
                    {operationalStatus.reason && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{operationalStatus.reason}</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div {...fade(0.1)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Operações de hoje</h2>
                <PdfImportDialog onImportComplete={reload} trigger={
                  <Button variant="ghost" size="sm" className="w-full sm:w-auto text-xs text-primary hover:text-primary hover:bg-primary/8 gap-1.5 h-8 justify-center sm:justify-start">
                    <Upload className="w-3.5 h-3.5" /> Importar
                  </Button>
                } />
              </div>

              {todayDuties.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {todayDuties.map((duty, index) => (
                    <DutyPeriodCard
                      key={duty.id}
                      duty={duty}
                      index={index}
                      statusSummary={dutyStatusByKey.get(buildDutyKey(duty.dutyStartDate, duty.reportTime || duty.dutyStartTime))}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass p-6 text-center min-w-0">
                  <Plane className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">Nenhuma jornada hoje</p>
                  {nextDuty && (
                    <p className="text-xs text-muted-foreground break-words">
                      Próxima: <span className="text-foreground font-medium">{nextDuty.routeSummary}</span> em{' '}
                      <span className="text-foreground font-medium">{formatDateBR(nextDuty.dutyStartDate)}</span>
                      {nextDuty.reportTime && (
                        <> · Apresentação <span className="font-mono text-foreground">{nextDuty.reportTime}</span></>
                      )}
                    </p>
                  )}
                </div>
              )}
            </motion.div>

            <motion.div {...fade(0.2)} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[
                { label: 'Calendário da escala', path: '/schedule', icon: Calendar, desc: 'Calendário mensal' },
                { label: 'Calcular jornada', path: '/duty-calc', icon: Clock, desc: 'Cálculo operacional' },
                { label: 'Calcular descanso', path: '/rest-calc', icon: BedDouble, desc: 'Repouso operacional' },
                { label: 'Calculadora operacional', path: '/regulation', icon: Shield, desc: 'Situação e limites' },
                { label: 'Configurações', path: '/settings', icon: Settings, desc: 'Preferências do app' },
              ].map((item) => (
                <Link key={item.path} to={item.path} className="glass px-4 py-3.5 flex items-center gap-3 hover-lift group min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/12 transition-colors">
                    <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                </Link>
              ))}
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

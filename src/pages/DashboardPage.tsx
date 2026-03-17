/**
 * EscalaX — Premium Aviation Dashboard (Light Theme)
 * Uses duty period grouping for correct operational ordering.
 */

import { useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useOperationalPreferences } from '@/hooks/useOperationalPreferences';
import { useOperationalClock } from '@/hooks/useOperationalClock';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { OnboardingModal, useOnboardingModal } from '@/components/OnboardingModal';
import {
  Upload, Calendar, Shield, Clock, Plane, ChevronRight, BedDouble,
  Settings, Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatDateBR } from '@/lib/date-utils';
import { groupIntoDutyPeriods, getTodayDutyPeriods, getNextDutyPeriod } from '@/lib/duty-grouping';
import { DutyPeriodCard } from '@/components/dashboard/DutyPeriodCard';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { schedule, loading, reload } = useScheduleData();
  const { shouldShow: showOnboarding, dismiss: dismissOnboarding } = useOnboardingModal();
  const { homeBase, timezone } = useOperationalPreferences();
  const { now, todayStr, monthStr } = useOperationalClock(timezone, reload);

  const hasSchedule = !loading && schedule.length > 0;

  // Group all flights into duty periods, ordered by presentation time
  const allDutyPeriods = useMemo(() => groupIntoDutyPeriods(schedule), [schedule]);
  const todayDuties = useMemo(
    () => getTodayDutyPeriods(allDutyPeriods, todayStr, homeBase),
    [allDutyPeriods, todayStr, homeBase],
  );
  const nextDuty = useMemo(
    () => getNextDutyPeriod(allDutyPeriods, todayStr, now, timezone),
    [allDutyPeriods, todayStr, now, timezone],
  );

  const monthFlights = schedule.filter(e => e.date?.startsWith(monthStr) && e.is_flight);
  const monthFlightHours = monthFlights.reduce((s, f) => s + (f.flight_hours || 0), 0);
  const monthDutyHours = monthFlights.reduce((s, f) => s + (f.duty_hours || 0), 0);

  const greeting = () => {
    const hourStr = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(now);
    const h = Number(hourStr);
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.3, ease: 'easeOut' as const },
  });

  return (
    <AppLayout>
      <div className="pb-10">
        <OnboardingModal open={showOnboarding} onClose={dismissOnboarding} />

        {/* ═══ Greeting ═══ */}
        <motion.div {...fade(0)} className="mb-8">
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground">
            {greeting()}, <span className="text-primary">{profile?.name?.split(' ')[0] || 'Tripulante'}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-[88px] rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && schedule.length === 0 && (
          <>
            {/* ═══ Quick Stats (empty) ═══ */}
            <motion.div {...fade(0.05)} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Horas 28 dias', value: '0h', icon: Clock },
                { label: 'Horas mês', value: '0h', icon: Gauge },
                { label: 'Próximo voo', value: '—', icon: Plane },
                { label: 'Status', value: 'Regular', icon: Shield, status: 'success' as const },
              ].map((s, i) => (
                <div key={i} className="glass p-4 flex items-center gap-3 hover-lift">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    s.status === 'success' ? 'bg-success/10' : 'bg-primary/8'
                  }`}>
                    <s.icon className={`w-5 h-5 ${s.status === 'success' ? 'text-success' : 'text-primary'}`} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium">{s.label}</p>
                    <p className="text-lg font-semibold font-mono text-foreground">{s.value}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* ═══ Empty State ═══ */}
            <motion.div {...fade(0.1)}>
              <h2 className="text-sm font-semibold text-foreground mb-4">Comece agora</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { title: 'Importar Escala', desc: 'Envie seu PDF', icon: Upload, action: 'import' },
                  { title: 'Simular Jornada', desc: 'Limites RBAC 117', icon: Clock, path: '/duty-calc' },
                  { title: 'Cálc. Descanso', desc: 'Período mínimo', icon: BedDouble, path: '/rest-calc' },
                  { title: 'Regulamentação', desc: 'Conformidade', icon: Shield, path: '/regulation' },
                  { title: 'Configurações', desc: 'Personalize', icon: Settings, path: '/settings' },
                ].map((card, i) => (
                  card.action === 'import' ? (
                    <PdfImportDialog key={i} onImportComplete={reload} trigger={
                      <div className="glass p-5 cursor-pointer hover-lift group text-left">
                        <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                          <card.icon className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">{card.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
                      </div>
                    } />
                  ) : (
                    <Link key={i} to={card.path!} className="glass p-5 hover-lift group">
                      <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                        <card.icon className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{card.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
                    </Link>
                  )
                ))}
              </div>
            </motion.div>
          </>
        )}

        {hasSchedule && (
          <div className="space-y-6">

            {/* ═══ 4 Stat Cards ═══ */}
            <motion.div {...fade(0.05)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass p-4 flex items-center gap-3 hover-lift">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Horas 28 dias</p>
                  <p className="text-lg font-semibold font-mono text-foreground">{Math.round(monthFlightHours)}h</p>
                </div>
              </div>
              <div className="glass p-4 flex items-center gap-3 hover-lift">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Jornada mês</p>
                  <p className="text-lg font-semibold font-mono text-foreground">{Math.round(monthDutyHours)}h</p>
                </div>
              </div>
              <div className="glass p-4 flex items-center gap-3 hover-lift">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Plane className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Próximo voo</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {nextDuty ? nextDuty.routeSummary : '—'}
                  </p>
                </div>
              </div>
              <div className="glass p-4 flex items-center gap-3 hover-lift">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Status</p>
                  <p className="text-sm font-semibold text-success">Regular</p>
                </div>
              </div>
            </motion.div>

            {/* ═══ Today's Duty Periods ═══ */}
            <motion.div {...fade(0.1)}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Jornadas de hoje</h2>
                <PdfImportDialog onImportComplete={reload} trigger={
                  <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary hover:bg-primary/8 gap-1.5 h-8">
                    <Upload className="w-3.5 h-3.5" /> Importar
                  </Button>
                } />
              </div>

              {todayDuties.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {todayDuties.map((duty, i) => (
                    <DutyPeriodCard key={duty.id} duty={duty} index={i} />
                  ))}
                </div>
              ) : (
                <div className="glass p-6 text-center">
                  <Plane className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">Nenhuma jornada hoje</p>
                  {nextDuty && (
                    <p className="text-xs text-muted-foreground">
                      Próxima: <span className="text-foreground font-medium">{nextDuty.routeSummary}</span> em{' '}
                      <span className="text-foreground font-medium">{formatDateBR(nextDuty.dutyStartDate)}</span>
                      {nextDuty.reportTime && (
                        <> · APR <span className="font-mono text-foreground">{nextDuty.reportTime}</span></>
                      )}
                    </p>
                  )}
                </div>
              )}
            </motion.div>

            {/* ═══ Quick Actions ═══ */}
            <motion.div {...fade(0.2)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: 'Ver Escala', path: '/schedule', icon: Calendar, desc: 'Calendário mensal' },
                { label: 'Calcular Jornada', path: '/duty-calc', icon: Clock, desc: 'Limites RBAC 117' },
                { label: 'Calcular Descanso', path: '/rest-calc', icon: BedDouble, desc: 'Período mínimo' },
                { label: 'Regulamentação', path: '/regulation', icon: Shield, desc: 'Status de conformidade' },
                { label: 'Configurações', path: '/settings', icon: Settings, desc: 'Preferências do app' },
              ].map(item => (
                <Link key={item.path} to={item.path}
                  className="glass px-4 py-3.5 flex items-center gap-3 hover-lift group">
                  <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/12 transition-colors">
                    <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
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

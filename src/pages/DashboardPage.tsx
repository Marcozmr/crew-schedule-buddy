/**
 * EscalaX — Premium Aviation Dashboard
 */

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { useScheduleData } from '@/hooks/useScheduleData';
import { supabase } from '@/integrations/supabase/client';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { OnboardingModal, useOnboardingModal } from '@/components/OnboardingModal';
import {
  Upload, Calendar, Shield, Clock, Plane, ChevronRight, BedDouble,
  ArrowRight, FileText, Settings, Gauge
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { schedule, loading, reload } = useScheduleData();
  const { shouldShow: showOnboarding, dismiss: dismissOnboarding } = useOnboardingModal();

  const hasSchedule = !loading && schedule.length > 0;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = now.toISOString().slice(0, 7);

  const todayFlights = schedule.filter(e => e.date === todayStr && e.is_flight);
  const monthFlights = schedule.filter(e => e.date?.startsWith(monthStr) && e.is_flight);
  const monthFlightHours = monthFlights.reduce((s, f) => s + (f.flight_hours || 0), 0);
  const monthDutyHours = monthFlights.reduce((s, f) => s + (f.duty_hours || 0), 0);

  const futureEntries = schedule
    .filter(e => e.date >= todayStr)
    .sort((a, b) => (a.sort_datetime || a.date).localeCompare(b.sort_datetime || b.date));
  const nextFlight = futureEntries.find(e => e.is_flight);

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.35, ease: 'easeOut' as const },
  });

  return (
    <AppLayout>
      <div className="pb-10">
        <OnboardingModal open={showOnboarding} onClose={dismissOnboarding} />

        {/* ═══ Greeting ═══ */}
        <motion.div {...fade(0)} className="mb-6">
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground">
            {greeting()}, <span className="text-primary">{profile?.name?.split(' ')[0] || 'Tripulante'}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </motion.div>

        {loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
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
                    s.status === 'success' ? 'bg-success/10' : 'bg-primary/10'
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

            {/* ═══ Empty State Carousel ═══ */}
            <motion.div {...fade(0.1)}>
              <h2 className="text-sm font-semibold text-foreground mb-3">Comece agora</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
                {[
                  { title: 'Importar Escala', desc: 'Envie seu PDF de escala', icon: Upload, action: 'import' },
                  { title: 'Simular Jornada', desc: 'Calcule limites RBAC 117', icon: Clock, path: '/duty-calc' },
                  { title: 'Cálc. Descanso', desc: 'Verifique período mínimo', icon: BedDouble, path: '/rest-calc' },
                  { title: 'Regulamentação', desc: 'Status de conformidade', icon: Shield, path: '/regulation' },
                  { title: 'Configurações', desc: 'Personalize o app', icon: Settings, path: '/settings' },
                ].map((card, i) => (
                  card.action === 'import' ? (
                    <PdfImportDialog key={i} onImportComplete={reload} trigger={
                      <div className="glass min-w-[200px] snap-start p-4 cursor-pointer hover-lift group">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                          <card.icon className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">{card.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
                      </div>
                    } />
                  ) : (
                    <Link key={i} to={card.path!} className="glass min-w-[200px] snap-start p-4 hover-lift group">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
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
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Horas 28 dias</p>
                  <p className="text-lg font-semibold font-mono text-foreground">{Math.round(monthFlightHours)}h</p>
                </div>
              </div>
              <div className="glass p-4 flex items-center gap-3 hover-lift">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Jornada mês</p>
                  <p className="text-lg font-semibold font-mono text-foreground">{Math.round(monthDutyHours)}h</p>
                </div>
              </div>
              <div className="glass p-4 flex items-center gap-3 hover-lift">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Plane className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Próximo voo</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {nextFlight ? `${nextFlight.flight_number}` : '—'}
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

            {/* ═══ Today's Flights ═══ */}
            <motion.div {...fade(0.1)}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Voos de hoje</h2>
                <PdfImportDialog onImportComplete={reload} trigger={
                  <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5 h-8">
                    <Upload className="w-3.5 h-3.5" /> Importar
                  </Button>
                } />
              </div>

              {todayFlights.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {todayFlights.map((flight, i) => (
                    <motion.div key={flight.id} {...fade(0.12 + i * 0.04)}
                      className="glass p-5 hover-lift">
                      {/* Flight number */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-medium text-muted-foreground">{flight.flight_number}</span>
                        {flight.report_time && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            APR {flight.report_time}
                          </span>
                        )}
                      </div>
                      {/* Route */}
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <p className="text-2xl lg:text-3xl font-bold text-foreground">{flight.departure}</p>
                          <p className="text-xs font-mono text-muted-foreground mt-1">{flight.departure_time}</p>
                        </div>
                        <div className="flex-1 mx-4 flex flex-col items-center">
                          <div className="w-full h-px bg-border relative">
                            <Plane className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl lg:text-3xl font-bold text-foreground">{flight.arrival}</p>
                          <p className="text-xs font-mono text-muted-foreground mt-1">{flight.arrival_time}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="glass p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Nenhum voo hoje</p>
                  {nextFlight && (
                    <p className="text-xs text-muted-foreground">
                      Próximo: <span className="text-foreground font-medium">{nextFlight.flight_number}</span> em{' '}
                      <span className="text-foreground font-medium">{nextFlight.date}</span> ·{' '}
                      {nextFlight.departure} → {nextFlight.arrival}
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
                  <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                </Link>
              ))}
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

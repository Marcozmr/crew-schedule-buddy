/**
 * EscalaX — Premium Aviation Dashboard
 */

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { useScheduleData } from '@/hooks/useScheduleData';
import { supabase } from '@/integrations/supabase/client';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { OnboardingModal, useOnboardingModal } from '@/components/OnboardingModal';
import {
  Upload, Calendar, Shield, DollarSign, FolderOpen, Settings, LogOut, Download,
  ArrowLeftRight, Cloud, Clock, BedDouble, FileText, UtensilsCrossed, Search,
  ChevronRight, Plane, HelpCircle, Bell, Gauge, AlertTriangle, CheckCircle, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { schedule, loading, reload } = useScheduleData();
  const [unreadCount, setUnreadCount] = useState(0);
  const { shouldShow: showOnboarding, dismiss: dismissOnboarding } = useOnboardingModal();
  const { signOut } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadCount(count || 0));
  }, [user]);

  const hasSchedule = !loading && schedule.length > 0;

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  // Compute quick stats
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
  const nextDuty = futureEntries[0];

  const lastImportInfo = hasSchedule ? {
    count: schedule.length,
    flights: schedule.filter(e => e.is_flight).length,
  } : null;

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.3 },
  });

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto pb-10 px-4">
        <OnboardingModal open={showOnboarding} onClose={dismissOnboarding} />

        <DashboardHeader unreadCount={unreadCount} />

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && schedule.length === 0 && (
          <DashboardEmptyState onImportComplete={reload} />
        )}

        {hasSchedule && (
          <div className="space-y-5">

            {/* ═══ HERO: Next Flight / Duty ═══ */}
            <motion.div {...fade(0.04)}>
              {nextFlight ? (
                <div className="glass-elevated rounded-2xl p-5 shadow-elevated relative overflow-hidden">
                  {/* Subtle glow */}
                  <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary/5 blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl gradient-sky flex items-center justify-center shadow-glow-blue">
                          <Plane className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Próximo Voo</p>
                          <p className="text-xs text-muted-foreground">{nextFlight.date}</p>
                        </div>
                      </div>
                      <span className="text-lg font-extrabold font-mono text-primary">{nextFlight.flight_number}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-2xl font-extrabold text-foreground">{nextFlight.departure}</p>
                        <p className="text-xs text-muted-foreground font-mono">{nextFlight.departure_time}</p>
                      </div>
                      <div className="flex-1 mx-4 flex flex-col items-center">
                        <div className="w-full h-[1px] bg-gradient-to-r from-muted-foreground/20 via-primary/40 to-muted-foreground/20" />
                        <Plane className="w-4 h-4 text-primary -mt-2 rotate-90" />
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-extrabold text-foreground">{nextFlight.arrival}</p>
                        <p className="text-xs text-muted-foreground font-mono">{nextFlight.arrival_time}</p>
                      </div>
                    </div>

                    {nextFlight.report_time && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Apresentação: <span className="font-mono font-bold text-foreground">{nextFlight.report_time}</span></span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass rounded-2xl p-5 text-center">
                  <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">Nenhum voo pendente</p>
                  <p className="text-xs text-muted-foreground">Escala atual sem próximos voos</p>
                </div>
              )}
            </motion.div>

            {/* ═══ Quick Stats Row ═══ */}
            <motion.div {...fade(0.08)} className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-3.5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Hoje</p>
                <p className="text-2xl font-extrabold font-mono text-foreground">{todayFlights.length}</p>
                <p className="text-[10px] text-muted-foreground">voo{todayFlights.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="glass rounded-xl p-3.5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Mês</p>
                <p className="text-2xl font-extrabold font-mono text-primary">{Math.round(monthFlightHours)}h</p>
                <p className="text-[10px] text-muted-foreground">horas voo</p>
              </div>
              <div className="glass rounded-xl p-3.5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Jornada</p>
                <p className="text-2xl font-extrabold font-mono text-accent">{Math.round(monthDutyHours)}h</p>
                <p className="text-[10px] text-muted-foreground">horas mês</p>
              </div>
            </motion.div>

            {/* ═══ Module: Escala ═══ */}
            <motion.div {...fade(0.12)} className="glass-elevated rounded-2xl overflow-hidden shadow-card">
              <div className="px-5 py-4 flex items-center justify-between border-b border-border/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Calendar className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Escala</p>
                    <p className="text-[10px] text-muted-foreground">
                      {lastImportInfo?.count} registros · {lastImportInfo?.flights} voos
                    </p>
                  </div>
                </div>
                <PdfImportDialog
                  onImportComplete={reload}
                  trigger={
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                      <Upload className="w-3.5 h-3.5" />
                      Importar PDF
                    </Button>
                  }
                />
              </div>
              <div className="p-2 space-y-0.5">
                {[
                  { label: 'Visualizar Escala', path: '/schedule', icon: Calendar },
                  { label: 'Baixar Escala', path: '/download-roster', icon: Download },
                  { label: 'Troca de Voo', path: '/flight-swap', icon: ArrowLeftRight },
                  { label: 'Buscar Voos', path: '/search', icon: Search },
                ].map(item => (
                  <Link key={item.path} to={item.path}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-secondary/50 transition-colors group">
                    <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-secondary-foreground group-hover:text-foreground flex-1">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* ═══ Module: Regulamentação ═══ */}
            <motion.div {...fade(0.16)} className="glass-elevated rounded-2xl overflow-hidden shadow-card">
              <div className="px-5 py-4 flex items-center gap-2.5 border-b border-border/30">
                <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center">
                  <Shield className="w-4.5 h-4.5 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Regulamentação</p>
                  <p className="text-[10px] text-muted-foreground">Jornada, descanso e limites RBAC</p>
                </div>
              </div>
              <div className="p-2 space-y-0.5">
                {[
                  { label: 'Cálculo de Jornada', path: '/duty-calc', icon: Gauge },
                  { label: 'Cálculo de Descanso', path: '/rest-calc', icon: BedDouble },
                  { label: 'Status Regulatório', path: '/regulation', icon: FileText },
                ].map(item => (
                  <Link key={item.path} to={item.path}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-secondary/50 transition-colors group">
                    <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-warning transition-colors" />
                    <span className="text-sm font-medium text-secondary-foreground group-hover:text-foreground flex-1">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* ═══ Module: Operacional ═══ */}
            <motion.div {...fade(0.2)} className="glass-elevated rounded-2xl overflow-hidden shadow-card">
              <div className="px-5 py-4 flex items-center gap-2.5 border-b border-border/30">
                <div className="w-9 h-9 rounded-xl bg-success/15 flex items-center justify-center">
                  <Cloud className="w-4.5 h-4.5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Operacional</p>
                  <p className="text-[10px] text-muted-foreground">Clima e informações de voo</p>
                </div>
              </div>
              <div className="p-2">
                <Link to="/weather"
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-secondary/50 transition-colors group">
                  <Cloud className="w-4 h-4 text-muted-foreground group-hover:text-success transition-colors" />
                  <span className="text-sm font-medium text-secondary-foreground group-hover:text-foreground flex-1">Meteorologia</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </Link>
              </div>
            </motion.div>

            {/* ═══ Module: Financeiro + Documentos ═══ */}
            <motion.div {...fade(0.24)} className="grid grid-cols-2 gap-4">
              <div className="glass rounded-2xl overflow-hidden shadow-card">
                <div className="px-4 py-3 flex items-center gap-2 border-b border-border/30">
                  <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                    <DollarSign className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <p className="text-xs font-bold text-foreground">Financeiro</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <Link to="/salary" className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent" />
                    <span className="text-xs text-secondary-foreground group-hover:text-foreground">Salário</span>
                  </Link>
                  <Link to="/perdiem" className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent" />
                    <span className="text-xs text-secondary-foreground group-hover:text-foreground">Diárias</span>
                  </Link>
                </div>
              </div>
              <div className="glass rounded-2xl overflow-hidden shadow-card">
                <div className="px-4 py-3 flex items-center gap-2 border-b border-border/30">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                    <FolderOpen className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-xs font-bold text-foreground">Documentos</p>
                </div>
                <div className="p-1.5">
                  <Link to="/documents" className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                    <span className="text-xs text-secondary-foreground group-hover:text-foreground">Meus Docs</span>
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* ═══ System Row ═══ */}
            <motion.div {...fade(0.28)} className="flex gap-3">
              <Link to="/support" className="flex-1 glass rounded-xl px-4 py-3.5 flex items-center gap-2.5 hover:bg-secondary/30 transition-colors">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-secondary-foreground">Suporte</span>
              </Link>
              <Link to="/settings" className="flex-1 glass rounded-xl px-4 py-3.5 flex items-center gap-2.5 hover:bg-secondary/30 transition-colors">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-secondary-foreground">Ajustes</span>
              </Link>
              <button onClick={handleLogout} className="flex-1 glass rounded-xl px-4 py-3.5 flex items-center gap-2.5 hover:bg-destructive/10 transition-colors text-left">
                <LogOut className="w-4 h-4 text-destructive/70" />
                <span className="text-xs font-medium text-secondary-foreground">Sair</span>
              </button>
            </motion.div>

            <p className="text-center text-[10px] text-muted-foreground/30 pt-2 pb-4">
              © {new Date().getFullYear()} EscalaX · Desenvolvido por Marcos Vinicius
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

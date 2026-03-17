/**
 * EscalaX EFB Dashboard
 * Professional aviation dashboard with modular sections.
 */

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { useScheduleData } from '@/hooks/useScheduleData';
import { supabase } from '@/integrations/supabase/client';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MonthlyStatsBar } from '@/components/dashboard/MonthlyStatsBar';
import { NextDutyPanel } from '@/components/dashboard/NextDutyPanel';
import { OperationalPanel } from '@/components/dashboard/OperationalPanel';
import { RegulationStatusPanel } from '@/components/dashboard/RegulationStatusPanel';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { OnboardingModal, useOnboardingModal } from '@/components/OnboardingModal';
import { Upload, Calendar, Shield, DollarSign, FolderOpen, Settings, LogOut, Download, ArrowLeftRight, Cloud, Clock, BedDouble, FileText, UtensilsCrossed, Search, ChevronRight, Plane, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface ModuleItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

interface ModuleGroup {
  title: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  items: ModuleItem[];
}

const moduleGroups: ModuleGroup[] = [
  {
    title: 'Escala',
    description: 'Importar, visualizar e gerenciar',
    icon: Calendar,
    accentColor: 'primary',
    items: [
      { label: 'Visualizar Escala', path: '/schedule', icon: Calendar },
      { label: 'Baixar Escala', path: '/download-roster', icon: Download },
      { label: 'Troca de Voo', path: '/flight-swap', icon: ArrowLeftRight },
      { label: 'Buscar Voos', path: '/search', icon: Search },
    ],
  },
  {
    title: 'Regulamentação',
    description: 'Jornada, descanso e limites RBAC',
    icon: Shield,
    accentColor: 'warning',
    items: [
      { label: 'Cálc. Jornada', path: '/duty-calc', icon: Clock },
      { label: 'Cálc. Descanso', path: '/rest-calc', icon: BedDouble },
      { label: 'Status Regulatório', path: '/regulation', icon: FileText },
    ],
  },
  {
    title: 'Operacional',
    description: 'Clima e informações de voo',
    icon: Cloud,
    accentColor: 'success',
    items: [
      { label: 'Meteorologia', path: '/weather', icon: Cloud },
    ],
  },
  {
    title: 'Financeiro',
    description: 'Salário e diárias',
    icon: DollarSign,
    accentColor: 'accent',
    items: [
      { label: 'Salário', path: '/salary', icon: DollarSign },
      { label: 'Diárias', path: '/perdiem', icon: UtensilsCrossed },
    ],
  },
  {
    title: 'Documentos',
    description: 'CHT, GOV e certificados',
    icon: FolderOpen,
    accentColor: 'primary',
    items: [
      { label: 'Meus Documentos', path: '/documents', icon: FolderOpen },
    ],
  },
];

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { schedule, loading, reload } = useScheduleData();
  const [unreadCount, setUnreadCount] = useState(0);
  const { shouldShow: showOnboarding, dismiss: dismissOnboarding } = useOnboardingModal();
  const { signOut } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };
    load();
  }, [user]);

  const hasSchedule = !loading && schedule.length > 0;

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  const lastImportInfo = hasSchedule ? {
    count: schedule.length,
    flights: schedule.filter(e => e.is_flight).length,
  } : null;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto pb-8">
        <OnboardingModal open={showOnboarding} onClose={dismissOnboarding} />

        <DashboardHeader unreadCount={unreadCount} />

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && schedule.length === 0 && (
          <DashboardEmptyState onImportComplete={reload} />
        )}

        {hasSchedule && (
          <div className="space-y-4">
            <MonthlyStatsBar schedule={schedule} />
            <NextDutyPanel schedule={schedule} />

            {/* Schedule module with import */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Escala</p>
                    <p className="text-[10px] text-efb-text-dim">{lastImportInfo?.count} registros • {lastImportInfo?.flights} voos</p>
                  </div>
                </div>
                <PdfImportDialog
                  onImportComplete={reload}
                  trigger={
                    <Button variant="ghost" size="sm" className="text-[10px] text-muted-foreground hover:text-foreground h-7 px-2">
                      <Upload className="w-3 h-3 mr-1" />
                      Importar PDF
                    </Button>
                  }
                />
              </div>
              <div className="px-2 py-2 space-y-0.5">
                {moduleGroups[0].items.map(item => (
                  <Link key={item.path} to={item.path} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                    <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-xs font-medium text-secondary-foreground group-hover:text-foreground flex-1">{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            </motion.div>

            <OperationalPanel schedule={schedule} airline={profile?.airline} />
            <RegulationStatusPanel schedule={schedule} />

            {/* Remaining modules */}
            {moduleGroups.slice(1).map((mod, idx) => (
              <motion.div
                key={mod.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + idx * 0.06 }}
                className="glass rounded-xl overflow-hidden"
              >
                <div className="px-4 py-3 flex items-center gap-3 border-b border-border/30">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `hsl(var(--${mod.accentColor}) / 0.1)` }}>
                    <mod.icon className="w-4 h-4" style={{ color: `hsl(var(--${mod.accentColor}))` }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground leading-tight">{mod.title}</h3>
                    <p className="text-[10px] text-muted-foreground">{mod.description}</p>
                  </div>
                </div>
                <div className="px-2 py-2 space-y-0.5">
                  {mod.items.map(item => (
                    <Link key={item.path} to={item.path} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                      <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <span className="text-xs font-medium text-secondary-foreground group-hover:text-foreground flex-1">{item.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}

            {/* System row */}
            <div className="flex gap-3">
              <Link to="/support" className="flex-1 glass rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-secondary-foreground">Suporte</span>
              </Link>
              <Link to="/settings" className="flex-1 glass rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-secondary-foreground">Ajustes</span>
              </Link>
              <button onClick={handleLogout} className="flex-1 glass rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-destructive/10 transition-colors text-left">
                <LogOut className="w-4 h-4 text-destructive/70" />
                <span className="text-xs font-medium text-secondary-foreground">Sair</span>
              </button>
            </div>

            <p className="text-center text-[10px] text-muted-foreground/40 pt-2 pb-4">
              © {new Date().getFullYear()} EscalaX. Desenvolvido por Marcos Vinicius.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

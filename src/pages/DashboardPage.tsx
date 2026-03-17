/**
 * EscalaX EFB Dashboard
 * 
 * Professional aviation dashboard — NOT a menu grid.
 * Hierarchy: Header → Stats → Next Duty (HERO) → Operational → Regulation → Modules
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
import { ModuleNavigation } from '@/components/dashboard/ModuleNavigation';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { OnboardingModal, useOnboardingModal } from '@/components/OnboardingModal';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { schedule, loading, reload } = useScheduleData();
  const [unreadCount, setUnreadCount] = useState(0);
  const { shouldShow: showOnboarding, dismiss: dismissOnboarding } = useOnboardingModal();

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

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto pb-8">
        {/* Onboarding modal for new users */}
        <OnboardingModal open={showOnboarding} onClose={dismissOnboarding} />

        {/* 1. User header */}
        <DashboardHeader unreadCount={unreadCount} />

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && schedule.length === 0 && (
          <DashboardEmptyState onImportComplete={reload} />
        )}

        {/* Dashboard with data */}
        {hasSchedule && (
          <div className="space-y-4">
            {/* Quick import */}
            <div className="flex justify-end">
              <PdfImportDialog
                onImportComplete={reload}
                trigger={
                  <Button variant="ghost" size="sm" className="text-[10px] text-muted-foreground hover:text-foreground h-7 px-2">
                    <Upload className="w-3 h-3 mr-1" />
                    Importar
                  </Button>
                }
              />
            </div>

            {/* 2. Monthly stats — compact strip */}
            <MonthlyStatsBar schedule={schedule} />

            {/* 3. HERO: Next duty — largest, most prominent element */}
            <NextDutyPanel schedule={schedule} />

            {/* 4. Operational panel */}
            <OperationalPanel schedule={schedule} airline={profile?.airline} />

            {/* 5. Regulation status */}
            <RegulationStatusPanel schedule={schedule} />

            {/* 6. Module navigation — BELOW all operational data */}
            <ModuleNavigation />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

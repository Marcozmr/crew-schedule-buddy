/**
 * EscalaX EFB Dashboard
 * 
 * Professional aviation Electronic Flight Bag-inspired dashboard.
 * Hierarchy: Status → Next Duty → Operational → Regulation → Modules
 */

import { useMemo, useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { useScheduleData } from '@/hooks/useScheduleData';
import { supabase } from '@/integrations/supabase/client';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { ImportHistoryCard } from '@/components/ImportHistoryCard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MonthlyStatsBar } from '@/components/dashboard/MonthlyStatsBar';
import { NextDutyPanel } from '@/components/dashboard/NextDutyPanel';
import { OperationalPanel } from '@/components/dashboard/OperationalPanel';
import { RegulationStatusPanel } from '@/components/dashboard/RegulationStatusPanel';
import { ModuleNavigation } from '@/components/dashboard/ModuleNavigation';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { schedule, loading, reload } = useScheduleData();
  const [unreadCount, setUnreadCount] = useState(0);

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
      <div className="max-w-2xl mx-auto">
        {/* Header with user info */}
        <DashboardHeader unreadCount={unreadCount} />

        {/* Import button when schedule exists */}
        {hasSchedule && (
          <div className="flex items-center gap-2 mb-4">
            <PdfImportDialog
              onImportComplete={reload}
              trigger={
                <Button variant="outline" size="sm" className="text-xs">
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Importar Escala
                </Button>
              }
            />
          </div>
        )}

        {/* Empty state */}
        {!loading && schedule.length === 0 && (
          <DashboardEmptyState onImportComplete={reload} />
        )}

        {/* Main dashboard sections */}
        {hasSchedule && (
          <div className="space-y-4">
            {/* 1. Monthly stats strip */}
            <MonthlyStatsBar schedule={schedule} />

            {/* 2. Next duty — primary info */}
            <NextDutyPanel schedule={schedule} />

            {/* 3. Operational panel */}
            <OperationalPanel schedule={schedule} airline={profile?.airline} />

            {/* 4. Regulation status */}
            <RegulationStatusPanel schedule={schedule} />

            {/* 5. Module navigation */}
            <ModuleNavigation />

            {/* 6. Import history */}
            <ImportHistoryCard onRosterChanged={reload} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

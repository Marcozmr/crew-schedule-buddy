import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ArrowLeft, Bell, Plane, CalendarCheck, MapPin, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppCard, AppCardSection } from '@/components/ui/primitives';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';

interface Counts {
  flights: number;
  daysOff: number;
  layovers: number;
}

async function countOwn(table: 'crew_flight_connections' | 'crew_days_off_matches' | 'crew_layover_matches', userId: string) {
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  return count ?? 0;
}

export default function ConnectionAlertsPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [flights, daysOff, layovers] = await Promise.all([
        countOwn('crew_flight_connections', user.id),
        countOwn('crew_days_off_matches', user.id),
        countOwn('crew_layover_matches', user.id),
      ]);
      if (!cancelled) setCounts({ flights, daysOff, layovers });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <Link to="/connections" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Conexões
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15">
            <Bell className="h-5 w-5 text-purple-500" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Alertas de coincidência</h1>
            <p className="text-xs text-muted-foreground">Notificações automáticas quando algo coincide com um colega</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <AppCard>
            <AppCardSection className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
              <div>
                <p className="text-sm font-semibold text-foreground">Ativado</p>
                <p className="text-xs text-muted-foreground">
                  Você recebe uma notificação automaticamente sempre que sua escala coincidir com a de um colega —
                  mesmo voo, mesma folga ou mesmo pernoite.
                </p>
              </div>
            </AppCardSection>
          </AppCard>
        </motion.div>

        <div className="grid grid-cols-3 gap-2.5">
          <AppCard>
            <AppCardSection className="flex flex-col items-center gap-1.5 py-4 text-center">
              <Plane className="h-4 w-4 text-primary" />
              <p className="text-lg font-bold text-foreground">{counts?.flights ?? '—'}</p>
              <p className="text-[10px] text-muted-foreground">voos em comum</p>
            </AppCardSection>
          </AppCard>
          <AppCard>
            <AppCardSection className="flex flex-col items-center gap-1.5 py-4 text-center">
              <CalendarCheck className="h-4 w-4 text-green-500" />
              <p className="text-lg font-bold text-foreground">{counts?.daysOff ?? '—'}</p>
              <p className="text-[10px] text-muted-foreground">folgas em comum</p>
            </AppCardSection>
          </AppCard>
          <AppCard>
            <AppCardSection className="flex flex-col items-center gap-1.5 py-4 text-center">
              <MapPin className="h-4 w-4 text-amber-500" />
              <p className="text-lg font-bold text-foreground">{counts?.layovers ?? '—'}</p>
              <p className="text-[10px] text-muted-foreground">pernoites em comum</p>
            </AppCardSection>
          </AppCard>
        </div>

        <p className="px-1 text-xs text-muted-foreground">
          As notificações aparecem no seu sininho de alertas. Cada coincidência avisa só uma vez.
        </p>
      </div>
    </AppLayout>
  );
}

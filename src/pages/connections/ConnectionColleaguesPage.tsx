import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ArrowLeft, Users, MessageCircle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppCard, AppCardSection, EmptyState } from '@/components/ui/primitives';
import { CrewDiscoveryService, type CrewConnectionEntry } from '@/lib/services/crew-discovery-service';

export default function ConnectionColleaguesPage() {
  const [connections, setConnections] = useState<CrewConnectionEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await CrewDiscoveryService.listConnections();
      if (!cancelled) setConnections(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <Link to="/connections" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Conexões
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
            <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Conecte com tripulantes</h1>
            <p className="text-xs text-muted-foreground">Colegas com quem você já compartilhou algum voo</p>
          </div>
        </div>

        {connections === null ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : connections.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum colega ainda"
            description="Quando sua escala coincidir com a de outro usuário do EscalaX no mesmo voo, ele aparece aqui."
          />
        ) : (
          <div className="space-y-2">
            {connections.map((c, i) => (
              <motion.div key={c.partnerUserId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <AppCard>
                  <AppCardSection className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      <span className="text-sm font-bold text-primary">{c.partnerName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{c.partnerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.flightsTogetherCount} voo{c.flightsTogetherCount === 1 ? '' : 's'} juntos
                        {c.partnerAirline ? ` · ${c.partnerAirline}` : ''}
                      </p>
                    </div>
                    {c.hasConversation && c.conversationId ? (
                      <Link
                        to={`/connections/chat/${c.conversationId}`}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Conversar
                      </Link>
                    ) : (
                      <span
                        title="O chat abre a partir da 2ª vez que vocês voarem juntos"
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground"
                      >
                        <Lock className="h-3.5 w-3.5" /> Chat bloqueado
                      </span>
                    )}
                  </AppCardSection>
                </AppCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

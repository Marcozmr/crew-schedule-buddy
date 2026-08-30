import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ArrowLeft, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppCard, AppCardSection, EmptyState } from '@/components/ui/primitives';
import { CrewDiscoveryService } from '@/lib/services/crew-discovery-service';

function formatDateOnlyBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

interface Row {
  partnerUserId: string;
  partnerName: string;
  layovers: { date: string; city: string }[];
}

export default function ConnectionLayoversPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const connections = await CrewDiscoveryService.listConnections();
      const withLayovers = await Promise.all(
        connections.map(async (c) => ({
          partnerUserId: c.partnerUserId,
          partnerName: c.partnerName,
          layovers: await CrewDiscoveryService.getSharedLayovers(c.partnerUserId),
        })),
      );
      if (!cancelled) setRows(withLayovers.filter((r) => r.layovers.length > 0));
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
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15">
            <MapPin className="h-5 w-5 text-amber-500" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Pernoites em comum</h1>
            <p className="text-xs text-muted-foreground">Colegas na mesma cidade durante layovers futuros</p>
          </div>
        </div>

        {rows === null ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Nenhum pernoite em comum ainda"
            description="Quando você e um colega de voo pernoitarem na mesma cidade, aparece aqui."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <motion.div key={r.partnerUserId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <AppCard>
                  <AppCardSection>
                    <p className="mb-2 text-sm font-semibold text-foreground">{r.partnerName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.layovers.map((l) => (
                        <span
                          key={`${l.date}-${l.city}`}
                          className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                        >
                          {l.city} · {formatDateOnlyBR(l.date)}
                        </span>
                      ))}
                    </div>
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

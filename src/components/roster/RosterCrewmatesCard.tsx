import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import {
  CrewDiscoveryService,
  type RosterCrewmateEntry,
} from '@/lib/services/crew-discovery-service';

interface RosterCrewmatesCardProps {
  /** Muda a cada nova importação — refaz a busca. */
  refreshKey?: number;
}

/** Mostra, logo após importar a escala, quem mais no EscalaX está nos mesmos voos. */
export function RosterCrewmatesCard({ refreshKey }: RosterCrewmatesCardProps) {
  const [entries, setEntries] = useState<RosterCrewmateEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await CrewDiscoveryService.getRosterCrewmates();
      if (!cancelled) setEntries(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!entries || entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/20 bg-primary/5 p-5 min-w-0"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-foreground">Tripulantes desta escala</h2>
          <p className="text-xs text-muted-foreground">
            {entries.length} voo{entries.length === 1 ? '' : 's'} com colegas que também usam o EscalaX
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((e) => (
          <div
            key={`${e.flightDate}-${e.flightNumber}-${e.partnerUserId}`}
            className="flex items-center gap-3 rounded-lg bg-background/60 px-3 py-2.5 min-w-0"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <span className="text-xs font-bold text-primary">{e.partnerName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{e.partnerName}</p>
              <p className="truncate text-xs text-muted-foreground">
                Voo {e.flightNumber} · {e.flightDate.split('-').reverse().join('/')}
                {e.departure ? ` · ${e.departure}` : ''}
                {e.arrival ? ` → ${e.arrival}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

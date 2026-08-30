import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { CrewDiscoveryService, type FlightCrewmate } from '@/lib/services/crew-discovery-service';

interface FlightCrewmatesRowProps {
  date: string;
  flightNumber: string;
  departure: string;
}

/**
 * Mostra outros usuários do EscalaX que também estão nesse voo (mesma data+número+origem).
 * Só aparece quando existe alguém — a maioria dos voos não terá ninguém ainda.
 */
export function FlightCrewmatesRow({ date, flightNumber, departure }: FlightCrewmatesRowProps) {
  const [crewmates, setCrewmates] = useState<FlightCrewmate[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!flightNumber?.trim()) {
      setCrewmates([]);
      return;
    }
    (async () => {
      const data = await CrewDiscoveryService.getFlightCrewmates(date, flightNumber, departure);
      if (!cancelled) setCrewmates(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [date, flightNumber, departure]);

  if (!crewmates || crewmates.length === 0) return null;

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/5 px-2.5 py-2">
      <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
        Também no EscalaX neste voo:{' '}
        <span className="font-medium text-foreground">
          {crewmates.map((c) => c.name).join(', ')}
        </span>
      </p>
      <Link to="/connections" className="shrink-0 text-[11px] font-medium text-primary hover:underline">
        Ver
      </Link>
    </div>
  );
}

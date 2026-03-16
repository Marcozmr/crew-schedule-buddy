import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Bug } from 'lucide-react';

interface DebugData {
  activeRosterId: string | null;
  activeFileName: string | null;
  activeImportedAt: string | null;
  activeRowCount: number;
  oldRowCount: number;
  flightCount: number;
  daysOffCount: number;
  nightOpsCount: number;
  totalFlightHours: number;
  standbyCount: number;
}

export function RosterDebugCard() {
  const { user } = useAuth();
  const [data, setData] = useState<DebugData | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: roster } = await (supabase.from('imported_rosters') as any)
        .select('id, file_name, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!roster) {
        setData({ activeRosterId: null, activeFileName: null, activeImportedAt: null, activeRowCount: 0, oldRowCount: 0, flightCount: 0, daysOffCount: 0, nightOpsCount: 0, totalFlightHours: 0, standbyCount: 0 });
        return;
      }

      const [activeRes, oldRes, entriesRes] = await Promise.all([
        supabase.from('schedule_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('roster_id', roster.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('schedule_entries') as any).select('id', { count: 'exact', head: true }).eq('user_id', user.id).neq('roster_id', roster.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('schedule_entries') as any).select('is_flight, activity_type, crosses_midnight, flight_hours').eq('user_id', user.id).eq('roster_id', roster.id),
      ]);

      const entries = (entriesRes.data || []) as Array<{ is_flight: boolean; activity_type: string; crosses_midnight: boolean; flight_hours: number | null }>;
      const flights = entries.filter(e => e.is_flight);
      const daysOff = entries.filter(e => ['DO', 'OFF', 'FOLGA', 'X'].includes(e.activity_type));
      const nightOps = flights.filter(e => e.crosses_midnight);
      const standby = entries.filter(e => ['HSB', 'ASB', 'HSBE', 'APR'].includes(e.activity_type));
      const totalFH = flights.reduce((s, e) => s + (e.flight_hours || 0), 0);

      setData({
        activeRosterId: roster.id,
        activeFileName: roster.file_name,
        activeImportedAt: roster.created_at,
        activeRowCount: activeRes.count ?? 0,
        oldRowCount: oldRes.count ?? 0,
        flightCount: flights.length,
        daysOffCount: daysOff.length,
        nightOpsCount: nightOps.length,
        totalFlightHours: Math.round(totalFH * 10) / 10,
        standbyCount: standby.length,
      });
    })();
  }, [user]);

  if (!data) return null;

  const rows = [
    ['Roster ID Ativo', data.activeRosterId || '—'],
    ['PDF Ativo', data.activeFileName || '—'],
    ['Importado em', data.activeImportedAt ? new Date(data.activeImportedAt).toLocaleString('pt-BR') : '—'],
    ['Linhas roster ativo', data.activeRowCount],
    ['Linhas rosters antigos', data.oldRowCount],
    ['is_flight = true', data.flightCount],
    ['DO/OFF (folgas)', data.daysOffCount],
    ['HSB/ASB/HSBE/APR (standby)', data.standbyCount],
    ['crosses_midnight (madrugadas)', data.nightOpsCount],
    ['Soma flight_hours (voos)', `${data.totalFlightHours}h`],
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-card mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Bug className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground text-sm">🔍 Debug — Roster Ativo</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs font-mono">
        {rows.map(([label, value]) => (
          <div key={String(label)} className="flex justify-between gap-2 py-1 px-2 rounded bg-muted/50">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground font-bold truncate max-w-[200px]">{String(value)}</span>
          </div>
        ))}
      </div>
      {data.oldRowCount > 0 && (
        <p className="text-destructive text-xs mt-2 font-medium">⚠️ Existem {data.oldRowCount} linhas de rosters antigos no banco.</p>
      )}
      {data.daysOffCount === 0 && data.activeRowCount > 0 && (
        <p className="text-yellow-600 text-xs mt-1 font-medium">⚠️ Nenhuma folga (DO/OFF) encontrada — parser pode não estar gerando entradas de folga.</p>
      )}
    </div>
  );
}

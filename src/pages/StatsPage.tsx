/**
 * Estatísticas da escala (Mês / Ano / Sempre). Lê todas as importações (useRosterHistory), calcula
 * com computeRosterStats e só formata. Spec: docs/superpowers/specs/2026-11-19-estatisticas-e-tempo-design.md
 */
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { StatsPeriodBar } from '@/components/stats/StatsPeriodBar';
import { AircraftSection, AirportsSection, FlightsSection, InsightsSection, QualitySection, SummarySection } from '@/components/stats/StatsSections';
import { useOperationalPreferences } from '@/hooks/useOperationalPreferences';
import { useRosterHistory } from '@/hooks/useRosterHistory';
import { computeRosterStats } from '@/lib/stats/compute';
import { buildInsights, type InsightScope } from '@/lib/stats/insights';

const pad = (n: number) => String(n).padStart(2, '0');

const EMPTY_TEXT: Record<InsightScope, string> = {
  month: 'Sem voos neste mês',
  year: 'Sem voos neste ano',
  all: 'Sem voos registrados ainda',
};

export default function StatsPage() {
  const { entries, loading: historyLoading, error } = useRosterHistory();
  const { homeBase, loading: prefsLoading } = useOperationalPreferences();
  const loading = historyLoading || prefsLoading;
  const [scope, setScope] = useState<InsightScope>('month');
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const { period, label } = useMemo(() => {
    if (scope === 'month') {
      const last = new Date(anchor.year, anchor.month + 1, 0).getDate();
      return {
        period: { start: `${anchor.year}-${pad(anchor.month + 1)}-01`, end: `${anchor.year}-${pad(anchor.month + 1)}-${pad(last)}` },
        label: new Date(anchor.year, anchor.month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      };
    }
    if (scope === 'year') {
      return { period: { start: `${anchor.year}-01-01`, end: `${anchor.year}-12-31` }, label: String(anchor.year) };
    }
    const dates = entries.map((e) => e.date).sort();
    const today = new Date().toISOString().slice(0, 10);
    return { period: { start: dates[0] ?? today, end: dates[dates.length - 1] ?? today }, label: 'Todo o histórico' };
  }, [scope, anchor, entries]);

  const stats = useMemo(
    () =>
      computeRosterStats({
        entries: entries.filter((e) => e.date >= period.start && e.date <= period.end),
        history: entries,
        period,
        base: homeBase,
      }),
    [entries, period, homeBase],
  );
  const insights = useMemo(() => buildInsights(stats, scope), [stats, scope]);

  const shift = (delta: -1 | 1) =>
    setAnchor((a) => {
      if (scope === 'year') return { ...a, year: a.year + delta };
      const m = a.month + delta;
      return { year: a.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  // Mês só com folgas ou férias também mostra as seções (com zeros nos voos).
  const hasFlights = entries.some((e) => e.date >= period.start && e.date <= period.end);

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6 pb-8">
        <h1 className="text-3xl font-bold text-foreground">Estatísticas</h1>
        <StatsPeriodBar scope={scope} label={label} onScope={setScope} onShift={shift} />

        {loading && (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando estatísticas…
          </p>
        )}
        {!loading && error && <p className="rounded-2xl border border-destructive/40 p-4 text-sm text-destructive">Não foi possível carregar a escala: {error}</p>}
        {!loading && !error && !hasFlights && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{EMPTY_TEXT[scope]}</p>
        )}
        {!loading && !error && hasFlights && (
          <>
            <SummarySection stats={stats} />
            <QualitySection stats={stats} />
            <FlightsSection stats={stats} />
            <AirportsSection stats={stats} />
            <AircraftSection stats={stats} />
            <InsightsSection insights={insights} />
          </>
        )}
      </div>
    </AppLayout>
  );
}

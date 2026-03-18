import { AppLayout } from '@/components/AppLayout';
import { useOperationalPreferences } from '@/hooks/useOperationalPreferences';
import { OperationalCalculatorPanel } from '@/components/regulation/OperationalCalculatorPanel';

export default function DutyCalcPage() {
  const { timezone, homeBase } = useOperationalPreferences();

  return (
    <AppLayout>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calcular jornada</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cálculo operacional avançado com a mesma base analítica usada no restante do app.
          </p>
        </div>

        <OperationalCalculatorPanel timezone={timezone} homeBase={homeBase} />
      </div>
    </AppLayout>
  );
}

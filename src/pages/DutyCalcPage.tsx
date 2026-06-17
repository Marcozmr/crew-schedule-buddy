import { AppLayout } from '@/components/AppLayout';
import { useOperationalPreferences } from '@/hooks/useOperationalPreferences';
import { OperationalCalculatorPanel } from '@/components/regulation/OperationalCalculatorPanel';

export default function DutyCalcPage() {
  const { timezone, homeBase } = useOperationalPreferences();

  return (
    <AppLayout>
      <div className="space-y-6 pb-10">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Calcular jornada</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Simulação simplificada para consulta rápida. Os parâmetros operacionais são estimados automaticamente com a mesma base regulatória do EscalaX.
          </p>
        </div>

        <OperationalCalculatorPanel timezone={timezone} homeBase={homeBase} />
      </div>
    </AppLayout>
  );
}

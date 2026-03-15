import { AppLayout } from '@/components/AppLayout';
import { SyncDiagnosticCard } from '@/components/SyncDiagnosticCard';
import { useScheduleData } from '@/hooks/useScheduleData';
import { FileText, Plane } from 'lucide-react';
import { motion } from 'framer-motion';

export default function IFlightImportPage() {
  const { schedule, reload } = useScheduleData();

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Importar Escala iFlight</h1>
        <p className="text-muted-foreground mt-2">
          Busca tolerante no Gmail: <strong>has:attachment filename:pdf newer_than:180d</strong>, filtro por assunto
          <strong> CrewRosterReport</strong> e remetente <strong>iFlight</strong>.
        </p>

        <div className="mt-6">
          <SyncDiagnosticCard onSyncComplete={reload} />
        </div>

        {schedule.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Voos importados ({schedule.length})</h2>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {schedule.slice(-10).reverse().map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div className="flex items-center gap-2">
                    <Plane className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium text-foreground">{entry.flight_number}</span>
                    <span className="text-muted-foreground">{entry.departure} → {entry.arrival}</span>
                  </div>
                  <span className="font-mono text-muted-foreground text-xs">{entry.date}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mt-6 bg-muted rounded-xl p-4 text-xs text-muted-foreground space-y-1">
          <p><strong>Tabela de voos:</strong> schedule_entries (filtrado por user_id)</p>
          <p><strong>Tabela de metadados:</strong> imported_rosters (filtrado por user_id)</p>
          <p><strong>Storage:</strong> crew-rosters/{'{user_id}'}/CrewRosterReport.pdf</p>
        </div>
      </div>
    </AppLayout>
  );
}

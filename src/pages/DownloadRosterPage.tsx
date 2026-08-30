import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { ImportHistoryCard } from '@/components/ImportHistoryCard';
import { RosterSourcesCard } from '@/components/roster/RosterSourcesCard';
import { ActiveRosterDownloadButton } from '@/components/roster/ActiveRosterDownloadButton';
import { RosterCrewmatesCard } from '@/components/roster/RosterCrewmatesCard';

export default function DownloadRosterPage() {
  const navigate = useNavigate();
  const [importDone, setImportDone] = useState(false);
  const [crewmatesRefreshKey, setCrewmatesRefreshKey] = useState(0);

  const handleImportComplete = () => {
    setImportDone(true);
    setCrewmatesRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/7', maxHeight: '320px', minHeight: '160px' }}>
        <img
          src="/pexels-pixabay-104826.jpg"
          alt="Avião ao pôr do sol"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
        <div className="absolute inset-0 px-4 py-4 flex items-start gap-3">
          <button onClick={() => navigate('/home')} className="text-white p-1 mt-0.5">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-white">Baixar Escala</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border bg-card/60 p-4">
          <div>
            <p className="font-medium text-foreground text-sm">Escala ativa no EscalaX</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Baixe o PDF guardado ou exporte CSV se o arquivo original não estiver no armazenamento.
            </p>
          </div>
          <ActiveRosterDownloadButton variant="default" size="sm" />
        </div>

        {importDone && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3 min-w-0">
            <CheckCircle className="w-6 h-6 text-success shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Escala importada com sucesso!</p>
              <p className="text-sm text-muted-foreground break-words">Seus dados já podem ser atualizados automaticamente no app.</p>
            </div>
          </motion.div>
        )}

        <RosterSourcesCard onImportComplete={handleImportComplete} />

        <RosterCrewmatesCard refreshKey={crewmatesRefreshKey} />

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Importar PDF manualmente</h2>
              <p className="text-xs text-muted-foreground">Alternativa segura e sempre disponível</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4 break-words">
            Faça o upload do PDF oficial da sua escala. O sistema extrai automaticamente voos e eventos sem depender da conexão ativa.
          </p>
          <PdfImportDialog
            onImportComplete={handleImportComplete}
            trigger={
              <Button className="w-full">
                <FileText className="w-4 h-4 mr-2" />Selecionar PDF da escala
              </Button>
            }
          />
        </motion.div>

        <ImportHistoryCard />
      </div>
    </div>
  );
}

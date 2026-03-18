import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { ImportHistoryCard } from '@/components/ImportHistoryCard';
import { PortalSyncCard } from '@/components/portal/PortalSyncCard';

export default function DownloadRosterPage() {
  const navigate = useNavigate();
  const [importDone, setImportDone] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-dark px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/home')} className="text-primary-foreground p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-primary-foreground">Baixar Escala</h1>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4 min-w-0">
        {importDone && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3 min-w-0">
            <CheckCircle className="w-6 h-6 text-success shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Escala importada com sucesso!</p>
              <p className="text-sm text-muted-foreground break-words">Seus dados já podem ser atualizados automaticamente no app.</p>
            </div>
          </motion.div>
        )}

        <PortalSyncCard onSyncComplete={() => setImportDone(true)} />

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
            onImportComplete={() => setImportDone(true)}
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

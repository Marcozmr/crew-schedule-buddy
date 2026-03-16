import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Upload, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { ImportHistoryCard } from '@/components/ImportHistoryCard';
import { toast } from 'sonner';

export default function DownloadRosterPage() {
  const navigate = useNavigate();
  const [importDone, setImportDone] = useState(false);

  const handleGmailConnect = () => {
    toast.info('Integração Gmail será disponibilizada em breve. Use o upload manual de PDF.');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-dark px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/home')} className="text-primary-foreground p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-primary-foreground">Baixar Escala</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Success feedback */}
        {importDone && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-success shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Escala importada com sucesso!</p>
              <p className="text-sm text-muted-foreground">Seus voos já aparecem na tela Escala.</p>
            </div>
          </motion.div>
        )}

        {/* Option 1: Manual PDF */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Enviar PDF manualmente</h2>
              <p className="text-xs text-muted-foreground">Método principal e mais confiável</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Faça o upload do PDF da sua escala (CrewRosterReport). O sistema extrai automaticamente todos os voos e eventos.
          </p>
          <PdfImportDialog
            onImportComplete={() => setImportDone(true)}
            trigger={
              <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700">
                <FileText className="w-4 h-4 mr-2" />Selecionar PDF da Escala
              </Button>
            }
          />
        </motion.div>

        {/* Option 2: Gmail (future) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-6 shadow-card opacity-80">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Mail className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Conectar Gmail corporativo</h2>
              <p className="text-xs text-muted-foreground">Opcional • Em desenvolvimento</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Sincronize automaticamente os PDFs de escala recebidos pelo email corporativo da companhia aérea.
          </p>
          <Button variant="outline" className="w-full" onClick={handleGmailConnect} disabled>
            <Mail className="w-4 h-4 mr-2" />Conectar Gmail (em breve)
          </Button>
        </motion.div>

        {/* Import History */}
        <ImportHistoryCard />
      </div>
    </div>
  );
}

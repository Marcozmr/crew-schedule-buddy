/**
 * EFB Dashboard — Quick Import CTA
 * Shown when no schedule is imported.
 */

import { Upload, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onImportComplete: () => void;
}

export function DashboardEmptyState({ onImportComplete }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-8 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <FileText className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-foreground mb-2">Nenhuma escala importada</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
        Importe sua escala em PDF para ativar o painel operacional, regulamentação e todos os módulos.
      </p>
      <PdfImportDialog
        onImportComplete={onImportComplete}
        trigger={
          <Button size="lg" className="gradient-sky text-primary-foreground font-semibold shadow-glow-blue">
            <Upload className="w-4 h-4 mr-2" />
            Importar Escala PDF
          </Button>
        }
      />
    </motion.div>
  );
}

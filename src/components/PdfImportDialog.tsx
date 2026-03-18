import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import { importPdfFile, type PdfImportResult } from '@/lib/pdf-import';
import { toast } from 'sonner';

interface PdfImportDialogProps {
  onImportComplete?: () => void;
  trigger?: React.ReactNode;
}

export function PdfImportDialog({ onImportComplete, trigger }: PdfImportDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PdfImportResult | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
    }
  };

  const handleImport = useCallback(async () => {
    if (!file || !user) return;
    setProcessing(true);
    setResult(null);
    const res = await importPdfFile(file, user.id);
    setResult(res);
    setProcessing(false);
    if (res.success && res.insertedCount > 0) {
      toast.success(`✅ ${res.insertedCount} registro(s) importado(s)!`);
      onImportComplete?.();
    } else if (res.success && res.insertedCount === 0) {
      toast.info(res.error || 'Todos os registros já existiam.');
    } else {
      toast.error(res.error || 'Falha na importação');
    }
  }, [file, user, onImportComplete]);

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gradient-sky text-primary-foreground">
            <Upload className="w-4 h-4 mr-2" />Importar Escala PDF
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar Escala PDF</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <label htmlFor="pdf-upload" className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="font-medium text-foreground text-sm">Selecione o PDF da escala</p>
            <p className="text-xs text-muted-foreground mt-1">CrewRosterReport.pdf / iFlight</p>
            {file && <div className="mt-3 flex items-center gap-2 text-sm text-primary"><FileText className="w-4 h-4" />{file.name}</div>}
          </label>
          <input id="pdf-upload" type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />

          {file && !result && (
            <Button onClick={handleImport} disabled={processing} className="w-full gradient-sky text-primary-foreground">
              {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</> : 'Processar e importar'}
            </Button>
          )}

          {result && (
            <div className={`rounded-xl p-4 border ${result.success ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
              <div className="flex items-center gap-2 mb-3">
                {result.success ? <CheckCircle className="w-5 h-5 text-success" /> : <AlertCircle className="w-5 h-5 text-destructive" />}
                <span className="font-semibold text-foreground">{result.success ? 'Importação concluída!' : 'Falha na importação'}</span>
              </div>

              {result.header && (result.header.crewName || result.header.baseAirport) && (
                <div className="bg-background rounded-lg p-3 mb-3 text-xs space-y-1">
                  {result.header.crewName && <p><span className="text-muted-foreground">Tripulante:</span> <span className="font-medium text-foreground">{result.header.crewName}</span></p>}
                  {result.header.employeeCode && <p><span className="text-muted-foreground">Matrícula:</span> <span className="font-medium text-foreground">{result.header.employeeCode}</span></p>}
                  {result.header.crewGroupCode && <p><span className="text-muted-foreground">Grupo:</span> <span className="font-medium text-foreground">{result.header.crewGroupCode}</span></p>}
                  {result.header.baseAirport && <p><span className="text-muted-foreground">Base:</span> <span className="font-medium text-foreground">{result.header.baseAirport}</span></p>}
                  {result.header.crewRole && <p><span className="text-muted-foreground">Função:</span> <span className="font-medium text-foreground">{result.header.crewRole}</span></p>}
                  {result.header.rosterStartDate && <p><span className="text-muted-foreground">Período:</span> <span className="font-medium text-foreground">{result.header.rosterStartDate} — {result.header.rosterEndDate}</span></p>}
                  {result.header.flyingHoursTotal != null && <p><span className="text-muted-foreground">Horas voo:</span> <span className="font-medium text-foreground">{result.header.flyingHoursTotal}h</span></p>}
                  {result.header.dutyHoursTotal != null && <p><span className="text-muted-foreground">Horas jornada:</span> <span className="font-medium text-foreground">{result.header.dutyHoursTotal}h</span></p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-background rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Registros processados</p>
                  <p className="text-lg font-bold text-foreground">{result.parsedCount}</p>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Registros inseridos</p>
                  <p className="text-lg font-bold text-foreground">{result.insertedCount}</p>
                </div>
              </div>

              {result.parseStats && (
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="bg-background rounded-lg p-2 text-center"><p className="text-muted-foreground">Voos</p><p className="font-bold text-foreground">{result.parseStats.totalFlights}</p></div>
                  <div className="bg-background rounded-lg p-2 text-center"><p className="text-muted-foreground">DO/OFF</p><p className="font-bold text-foreground">{result.parseStats.totalDO}</p></div>
                  <div className="bg-background rounded-lg p-2 text-center"><p className="text-muted-foreground">Standby</p><p className="font-bold text-foreground">{result.parseStats.totalStandby}</p></div>
                  <div className="bg-background rounded-lg p-2 text-center"><p className="text-muted-foreground">APR</p><p className="font-bold text-foreground">{result.parseStats.totalAPR}</p></div>
                  <div className="bg-background rounded-lg p-2 text-center"><p className="text-muted-foreground">Após limpeza</p><p className="font-bold text-foreground">{result.parseStats.totalAfterDedup}</p></div>
                  <div className="bg-background rounded-lg p-2 text-center"><p className="text-muted-foreground">Marcos</p><p className="font-bold text-foreground">{result.parseStats.totalRawAnchors}</p></div>
                </div>
              )}

              {result.error && <p className="mt-3 text-xs text-muted-foreground">{result.error}</p>}

              <Button onClick={handleClose} variant="outline" className="w-full mt-4">Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

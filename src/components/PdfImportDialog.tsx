import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showDebug, setShowDebug] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) { setFile(selected); setResult(null); }
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

  const handleClose = () => { setOpen(false); setFile(null); setResult(null); setShowDebug(false); };

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

              {/* Header info */}
              {result.header && (result.header.crewName || result.header.baseAirport) && (
                <div className="bg-background rounded-lg p-3 mb-3 text-xs space-y-1">
                  {result.header.crewName && <p><span className="text-muted-foreground">Tripulante:</span> <span className="font-medium text-foreground">{result.header.crewName}</span></p>}
                  {result.header.employeeCode && <p><span className="text-muted-foreground">Matrícula:</span> <span className="font-medium text-foreground">{result.header.employeeCode}</span></p>}
                  {result.header.crewGroupCode && <p><span className="text-muted-foreground">Grupo:</span> <span className="font-medium text-foreground">{result.header.crewGroupCode}</span></p>}
                  {result.header.baseAirport && <p><span className="text-muted-foreground">Base:</span> <span className="font-medium text-foreground">{result.header.baseAirport}</span></p>}
                  {result.header.crewRole && <p><span className="text-muted-foreground">Função:</span> <span className="font-medium text-foreground">{result.header.crewRole}</span></p>}
                  {result.header.rosterStartDate && <p><span className="text-muted-foreground">Período:</span> <span className="font-medium text-foreground">{result.header.rosterStartDate} — {result.header.rosterEndDate}</span></p>}
                  {result.header.flyingHoursTotal != null && <p><span className="text-muted-foreground">Horas Voo:</span> <span className="font-medium text-foreground">{result.header.flyingHoursTotal}h</span></p>}
                  {result.header.dutyHoursTotal != null && <p><span className="text-muted-foreground">Horas Duty:</span> <span className="font-medium text-foreground">{result.header.dutyHoursTotal}h</span></p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-background rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Registros parseados</p>
                  <p className="text-lg font-bold text-foreground">{result.parsedCount}</p>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Registros inseridos</p>
                  <p className="text-lg font-bold text-foreground">{result.insertedCount}</p>
                </div>
              </div>

              {result.error && <p className="mt-3 text-xs text-muted-foreground">{result.error}</p>}

              {/* Debug section */}
              <button onClick={() => setShowDebug(!showDebug)} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Diagnóstico detalhado
              </button>

              {showDebug && (
                <div className="mt-2 space-y-3 text-xs">
                  {/* Extracted text preview */}
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Texto extraído (1000 chars)</p>
                    <pre className="bg-muted rounded-lg p-2 overflow-x-auto text-[10px] max-h-32 overflow-y-auto whitespace-pre-wrap text-foreground">{result.extractedTextPreview || '(vazio)'}</pre>
                  </div>

                  {/* Parsed entries preview */}
                  {result.parsedEntriesPreview.length > 0 && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Entradas parseadas ({result.parsedEntriesPreview.length})</p>
                      <div className="bg-muted rounded-lg p-2 overflow-x-auto max-h-40 overflow-y-auto">
                        {result.parsedEntriesPreview.map((e, i) => (
                          <div key={i} className="py-1 border-b border-border last:border-0 text-[10px] text-foreground">
                            <span className="font-mono">{e.date}</span> | <span className={e.isFlight ? 'text-primary font-bold' : 'text-accent-foreground'}>{e.flightNumber}</span> | {e.departureAirport}→{e.arrivalAirport} | {e.departureTime}-{e.arrivalTime} | {e.aircraftType || '—'} | duty:{e.dutyHours ?? '—'}h
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saved rows preview */}
                  {result.savedRowsPreview.length > 0 && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Registros salvos no banco ({result.savedRowsPreview.length})</p>
                      <pre className="bg-muted rounded-lg p-2 overflow-x-auto text-[10px] max-h-40 overflow-y-auto text-foreground">{JSON.stringify(result.savedRowsPreview, null, 1)}</pre>
                    </div>
                  )}

                  {/* Raw lines */}
                  {result.parsedEntriesPreview.length > 0 && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">raw_line (primeiras 10)</p>
                      <div className="bg-muted rounded-lg p-2 overflow-x-auto max-h-32 overflow-y-auto">
                        {result.parsedEntriesPreview.map((e, i) => (
                          <p key={i} className="text-[10px] text-foreground font-mono border-b border-border py-0.5 last:border-0">{e.rawLine}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.rosterId && <p className="text-muted-foreground">roster_id novo: <span className="font-mono text-foreground">{result.rosterId}</span></p>}
                  <p className="text-muted-foreground">user_id atual: <span className="font-mono text-foreground">{result.debug.currentUserId}</span></p>
                  <p className="text-muted-foreground">imported_rosters desativadas: <span className="font-mono text-foreground">{result.debug.deactivatedRosterIds.length > 0 ? result.debug.deactivatedRosterIds.join(', ') : 'nenhuma'}</span></p>
                  <p className="text-muted-foreground">imported_rosters ativa: <span className="font-mono text-foreground">{result.debug.activeRoster ? `${result.debug.activeRoster.id} (${result.debug.activeRoster.file_name ?? 'sem nome'})` : 'não encontrada'}</span></p>
                  <p className="text-muted-foreground">inserted_rows_count: <span className="font-mono text-foreground">{result.insertedCount}</span></p>
                  <p className="text-muted-foreground">total_rows_roster_ativo: <span className="font-mono text-foreground">{result.debug.totalRowsActiveRoster}</span></p>
                  <p className="text-muted-foreground">total_rows_rosters_antigos: <span className="font-mono text-foreground">{result.debug.totalRowsOldRosters}</span></p>
                </div>
              )}

              <Button onClick={handleClose} variant="outline" className="w-full mt-4">Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Upload, FileText, CheckCircle, AlertCircle, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import { parseMockSchedule, detectAirline } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function UploadPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [textInput, setTextInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ count: number; airline: string } | null>(null);

  const processText = useCallback(async (text: string) => {
    if (!user) return;
    setProcessing(true);
    setResult(null);

    const entries = parseMockSchedule(text);
    if (entries.length === 0) {
      toast.error('Não foi possível identificar voos. Verifique o formato.');
      setProcessing(false);
      return;
    }

    const airline = detectAirline(text);

    await supabase
      .from('imported_rosters')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    const createdAtMs = Date.now();
    const sourceFilename = fileName || 'manual-text-input.txt';
    const sourceMessageId = `manual-text-${createdAtMs}`;
    const storagePath = `manual/${user.id}/${createdAtMs}-${sourceFilename}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rosterRow, error: rosterError } = await (supabase.from('imported_rosters') as any)
      .insert({
        user_id: user.id,
        file_name: sourceFilename,
        source_message_id: sourceMessageId,
        storage_path: storagePath,
        parser_version: 'manual-text-v1',
        import_status: 'processing',
        parsed_count: entries.length,
        is_active: true,
      })
      .select('id')
      .single();

    if (rosterError || !rosterRow?.id) {
      toast.error('Erro ao criar importação ativa');
      setProcessing(false);
      return;
    }

    const rows = entries.map((entry) => {
      const parts = entry.date.split('/');
      const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : entry.date;
      return {
        user_id: user.id,
        roster_id: rosterRow.id,
        date: isoDate,
        flight_number: entry.flightNumber,
        departure: entry.departure,
        arrival: entry.arrival,
        departure_time: entry.departureTime,
        arrival_time: entry.arrivalTime,
        status: entry.status,
        airline: entry.airline,
        report_time: entry.reportTime || null,
        duty_hours: entry.dutyHours || null,
        flight_hours: entry.dutyHours || null,
        is_flight: true,
        activity_type: 'flight',
        sort_datetime: `${isoDate}T${entry.departureTime || '00:00'}:00`,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('schedule_entries') as any).insert(rows);
    if (error) {
      await supabase
        .from('imported_rosters')
        .update({ import_status: 'error', import_error: error.message, inserted_count: 0 })
        .eq('id', rosterRow.id);
      toast.error('Erro ao salvar escala no banco de dados');
      setProcessing(false);
      return;
    }

    await supabase
      .from('imported_rosters')
      .update({ import_status: 'success', inserted_count: rows.length, import_error: null })
      .eq('id', rosterRow.id);

    if (airline !== 'Não identificada') {
      await supabase.from('profiles').update({ airline }).eq('user_id', user.id);
      await refreshProfile();
    }

    setResult({ count: entries.length, airline });
    setTextInput('');
    toast.success(`✅ ${entries.length} voos importados! Redirecionando...`);
    setProcessing(false);

    setTimeout(() => navigate('/dashboard'), 1500);
  }, [user, refreshProfile, navigate, fileName]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (loadEvent) => processText(loadEvent.target?.result as string);
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    if (!textInput.trim()) {
      toast.error('Cole o conteúdo da escala');
      return;
    }
    setResult(null);
    processText(textInput);
  };

  const sampleData = `LATAM Airlines - Escala Março 2025
01/03/2025 JJ3401 GRU-GIG 06:00-07:15
03/03/2025 JJ3122 GIG-BSB 10:30-12:45
05/03/2025 JJ3890 BSB-GRU 14:00-16:10
08/03/2025 JJ3205 GRU-SSA 07:00-09:30
10/03/2025 JJ3510 SSA-GRU 15:00-17:20
12/03/2025 JJ3045 GRU-POA 08:30-10:20
15/03/2025 JJ3678 POA-GRU 13:00-14:50
18/03/2025 JJ3901 GRU-REC 06:00-09:30
20/03/2025 JJ3112 REC-GRU 16:00-19:20
25/03/2025 JJ3330 GRU-CWB 11:00-12:15`;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto min-w-0 space-y-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground mb-2 break-words">Importar escala</h1>
          <p className="text-muted-foreground break-words">Envie sua escala em formato texto, PDF ou planilha.</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass p-5 sm:p-8 min-w-0">
          <label htmlFor="file-upload" className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 sm:p-10 cursor-pointer hover:border-primary/50 transition-colors text-center min-w-0">
            <Upload className="w-10 h-10 text-muted-foreground mb-3 shrink-0" />
            <p className="font-medium text-foreground break-words">Arraste ou clique para enviar</p>
            <p className="text-sm text-muted-foreground mt-1 break-words">PDF, CSV, TXT, XLS</p>
            {fileName && (
              <div className="mt-3 flex items-center gap-2 text-sm text-primary max-w-full min-w-0">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{fileName}</span>
              </div>
            )}
          </label>
          <input id="file-upload" type="file" accept=".txt,.csv,.pdf,.xls,.xlsx" onChange={handleFileUpload} className="hidden" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass p-5 sm:p-6 min-w-0">
          <h2 className="font-semibold text-foreground mb-3">Ou cole sua escala aqui</h2>
          <Textarea placeholder="Cole o texto da sua escala aqui..." value={textInput} onChange={(event) => setTextInput(event.target.value)} className="min-h-[160px] font-mono text-sm mb-4 break-anywhere" />
          <div className="flex flex-col sm:flex-row gap-3 min-w-0">
            <Button onClick={handlePasteSubmit} disabled={processing} className="w-full sm:w-auto gradient-sky text-primary-foreground">
              {processing ? 'Processando...' : 'Processar escala'}
            </Button>
            <Button variant="outline" onClick={() => { setTextInput(sampleData); toast.info('Dados de exemplo carregados'); }} className="w-full sm:w-auto">
              Carregar exemplo
            </Button>
          </div>
        </motion.div>

        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass p-5 sm:p-6 border border-success/30 min-w-0">
            <div className="flex items-center gap-3 mb-4 min-w-0">
              <CheckCircle className="w-6 h-6 text-success shrink-0" />
              <h2 className="font-semibold text-foreground break-words">Escala importada com sucesso!</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-4 min-w-0">
                <p className="text-sm text-muted-foreground">Voos identificados</p>
                <p className="text-2xl font-bold text-foreground break-words">{result.count}</p>
              </div>
              <div className="bg-muted rounded-lg p-4 min-w-0">
                <p className="text-sm text-muted-foreground">Companhia detectada</p>
                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <Plane className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-lg font-bold text-foreground truncate">{result.airline}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 flex items-start gap-3 bg-primary/5 rounded-xl p-4 min-w-0">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground min-w-0">
            <p className="font-medium text-foreground mb-1">Formatos aceitos</p>
            <p className="break-words">A escala deve conter datas (DD/MM/AAAA), número do voo, aeroportos (código IATA) e horários.</p>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}

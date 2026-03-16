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
  const { user, profile, refreshProfile } = useAuth();
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

    // Deactivate previous rosters and create a new active roster for this import
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

    const rows = entries.map((e) => {
      const parts = e.date.split('/');
      const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : e.date;
      return {
        user_id: user.id,
        roster_id: rosterRow.id,
        date: isoDate,
        flight_number: e.flightNumber,
        departure: e.departure,
        arrival: e.arrival,
        departure_time: e.departureTime,
        arrival_time: e.arrivalTime,
        status: e.status,
        airline: e.airline,
        report_time: e.reportTime || null,
        duty_hours: e.dutyHours || null,
        flight_hours: e.dutyHours || null,
        is_flight: true,
        activity_type: 'flight',
        sort_datetime: `${isoDate}T${(e.departureTime || '00:00')}:00`,
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

    // Update airline on profile
    if (airline !== 'Não identificada') {
      await supabase.from('profiles').update({ airline }).eq('user_id', user.id);
      await refreshProfile();
    }

    setResult({ count: entries.length, airline });
    setTextInput('');
    toast.success(`✅ ${entries.length} voos importados! Redirecionando...`);
    setProcessing(false);

    // Redirect to dashboard after short delay
    setTimeout(() => navigate('/dashboard'), 1500);
  }, [user, refreshProfile, navigate]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (event) => processText(event.target?.result as string);
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    if (!textInput.trim()) { toast.error('Cole o conteúdo da escala'); return; }
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
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Importar Escala</h1>
        <p className="text-muted-foreground mb-8">Envie sua escala em formato texto, PDF ou planilha.</p>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-8 shadow-card mb-6">
          <label htmlFor="file-upload" className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-10 cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">Arraste ou clique para enviar</p>
            <p className="text-sm text-muted-foreground mt-1">PDF, CSV, TXT, XLS</p>
            {fileName && (
              <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                <FileText className="w-4 h-4" />{fileName}
              </div>
            )}
          </label>
          <input id="file-upload" type="file" accept=".txt,.csv,.pdf,.xls,.xlsx" onChange={handleFileUpload} className="hidden" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
          <h2 className="font-semibold text-foreground mb-3">Ou cole sua escala aqui</h2>
          <Textarea placeholder="Cole o texto da sua escala aqui..." value={textInput} onChange={e => setTextInput(e.target.value)} className="min-h-[160px] font-mono text-sm mb-4" />
          <div className="flex gap-3">
            <Button onClick={handlePasteSubmit} disabled={processing} className="gradient-sky text-primary-foreground">
              {processing ? 'Processando...' : 'Processar Escala'}
            </Button>
            <Button variant="outline" onClick={() => { setTextInput(sampleData); toast.info('Dados de exemplo carregados'); }}>
              Carregar exemplo
            </Button>
          </div>
        </motion.div>

        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-xl p-6 shadow-card border border-success/30">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-success" />
              <h2 className="font-semibold text-foreground">Escala importada com sucesso!</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Voos identificados</p>
                <p className="text-2xl font-bold text-foreground">{result.count}</p>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Companhia detectada</p>
                <div className="flex items-center gap-2 mt-1">
                  <Plane className="w-5 h-5 text-primary" />
                  <p className="text-lg font-bold text-foreground">{result.airline}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 flex items-start gap-3 bg-primary/5 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Formatos aceitos</p>
            <p>A escala deve conter datas (DD/MM/AAAA), número do voo, aeroportos (código IATA) e horários.</p>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}

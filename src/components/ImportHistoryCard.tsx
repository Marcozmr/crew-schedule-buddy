import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { FileText, Download, Clock, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImportRecord {
  id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
  import_status: string | null;
  parsed_count: number | null;
  inserted_count: number | null;
  import_error: string | null;
  name: string | null;
  base_airport: string | null;
  roster_start_date: string | null;
  roster_end_date: string | null;
  parser_version: string | null;
}

export function ImportHistoryCard() {
  const { user } = useAuth();
  const [imports, setImports] = useState<ImportRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('imported_rosters')
        .select('id, file_name, storage_path, created_at, import_status, parsed_count, inserted_count, import_error, name, base_airport, roster_start_date, roster_end_date, parser_version')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setImports(data as unknown as ImportRecord[]);
    };
    void load();
  }, [user]);

  const handleDownload = async (storagePath: string, fileName: string) => {
    const { data } = await supabase.storage.from('crew-rosters').download(storagePath);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (imports.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Histórico de Importações</h3>
      </div>
      <div className="space-y-3">
        {imports.map((imp) => (
          <div key={imp.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {imp.import_status === 'success' ? <CheckCircle className="w-4 h-4 text-success shrink-0" /> : <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{imp.file_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(imp.created_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleDownload(imp.storage_path, imp.file_name)}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-background px-2 py-0.5 rounded text-foreground">
                {imp.parsed_count ?? 0} parseados
              </span>
              <span className="bg-background px-2 py-0.5 rounded text-foreground">
                {imp.inserted_count ?? 0} inseridos
              </span>
              {imp.base_airport && <span className="bg-background px-2 py-0.5 rounded text-muted-foreground">Base: {imp.base_airport}</span>}
              {imp.roster_start_date && <span className="bg-background px-2 py-0.5 rounded text-muted-foreground">{imp.roster_start_date} — {imp.roster_end_date}</span>}
              {imp.parser_version && <span className="bg-background px-2 py-0.5 rounded text-muted-foreground">v{imp.parser_version}</span>}
            </div>
            {imp.import_error && <p className="text-xs text-destructive">{imp.import_error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

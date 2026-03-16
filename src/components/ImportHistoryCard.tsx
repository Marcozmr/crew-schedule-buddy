import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Download, Clock, CheckCircle, AlertCircle, Power, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  is_active: boolean;
}

interface ImportHistoryCardProps {
  onRosterChanged?: () => void;
}

export function ImportHistoryCard({ onRosterChanged }: ImportHistoryCardProps) {
  const { user } = useAuth();
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const loadImports = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('imported_rosters')
      .select('id, file_name, storage_path, created_at, import_status, parsed_count, inserted_count, import_error, name, base_airport, roster_start_date, roster_end_date, parser_version, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setImports(data as unknown as ImportRecord[]);
  }, [user]);

  useEffect(() => {
    void loadImports();
  }, [loadImports]);

  const handleDownload = async (storagePath: string, fileName: string) => {
    const { data } = await supabase.storage.from('crew-rosters').download(storagePath);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleActivate = async (rosterId: string) => {
    if (!user) return;
    setBusyActionId(`activate-${rosterId}`);

    // 1) desativa todas
    await supabase
      .from('imported_rosters')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    // 2) ativa a escolhida
    const { error } = await supabase
      .from('imported_rosters')
      .update({ is_active: true })
      .eq('user_id', user.id)
      .eq('id', rosterId);

    setBusyActionId(null);

    if (error) {
      toast.error('Não foi possível ativar esta escala.');
      return;
    }

    toast.success('Escala ativada com sucesso.');
    await loadImports();
    onRosterChanged?.();
  };

  const handleDelete = async (item: ImportRecord) => {
    if (!user) return;

    const confirmed = window.confirm('Deseja excluir esta importação e todos os registros dessa escala?');
    if (!confirmed) return;

    setBusyActionId(`delete-${item.id}`);

    const { error: deleteEntriesError } = await supabase
      .from('schedule_entries')
      .delete()
      .eq('user_id', user.id)
      .eq('roster_id', item.id);

    if (deleteEntriesError) {
      setBusyActionId(null);
      toast.error('Falha ao excluir registros da escala.');
      return;
    }

    const { error: deleteRosterError } = await supabase
      .from('imported_rosters')
      .delete()
      .eq('user_id', user.id)
      .eq('id', item.id);

    if (deleteRosterError) {
      setBusyActionId(null);
      toast.error('Falha ao excluir importação.');
      return;
    }

    // Se a excluída era ativa, ativa automaticamente a mais recente restante
    if (item.is_active) {
      const { data: latest } = await supabase
        .from('imported_rosters')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest?.id) {
        await supabase
          .from('imported_rosters')
          .update({ is_active: true })
          .eq('user_id', user.id)
          .eq('id', latest.id);
      }
    }

    setBusyActionId(null);
    toast.success('Importação excluída.');
    await loadImports();
    onRosterChanged?.();
  };

  if (imports.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Histórico de Importações</h3>
      </div>

      <div className="space-y-3">
        {imports.map((imp) => {
          const activating = busyActionId === `activate-${imp.id}`;
          const deleting = busyActionId === `delete-${imp.id}`;

          return (
            <div key={imp.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {imp.import_status === 'success'
                    ? <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{imp.file_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(imp.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(imp.storage_path, imp.file_name)}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-background px-2 py-0.5 rounded text-foreground">{imp.parsed_count ?? 0} parseados</span>
                <span className="bg-background px-2 py-0.5 rounded text-foreground">{imp.inserted_count ?? 0} inseridos</span>
                <span className={`px-2 py-0.5 rounded ${imp.is_active ? 'bg-primary/15 text-primary' : 'bg-background text-muted-foreground'}`}>
                  {imp.is_active ? 'Escala ativa' : 'Arquivada'}
                </span>
                {imp.base_airport && <span className="bg-background px-2 py-0.5 rounded text-muted-foreground">Base: {imp.base_airport}</span>}
                {imp.roster_start_date && <span className="bg-background px-2 py-0.5 rounded text-muted-foreground">{imp.roster_start_date} — {imp.roster_end_date}</span>}
                {imp.parser_version && <span className="bg-background px-2 py-0.5 rounded text-muted-foreground">v{imp.parser_version}</span>}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {!imp.is_active && (
                  <Button size="sm" variant="outline" onClick={() => handleActivate(imp.id)} disabled={activating || deleting}>
                    {activating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Power className="w-3 h-3 mr-1" />}
                    Ativar esta escala
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(imp)}
                  disabled={activating || deleting}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  {deleting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                  Excluir importação
                </Button>
              </div>

              {imp.import_error && <p className="text-xs text-destructive">{imp.import_error}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

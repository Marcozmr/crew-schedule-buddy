import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { FileText, Download, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImportRecord {
  id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}

export function ImportHistoryCard() {
  const { user } = useAuth();
  const [imports, setImports] = useState<ImportRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('imported_rosters')
        .select('id, file_name, storage_path, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setImports(data);
    };
    void load();
  }, [user]);

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

  if (imports.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Histórico de Importações</h3>
      </div>
      <div className="space-y-2">
        {imports.map((imp) => (
          <div key={imp.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{imp.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(imp.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDownload(imp.storage_path, imp.file_name)}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

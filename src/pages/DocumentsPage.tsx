import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, Trash2, Eye, FileText, Camera, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateTimeBR } from '@/lib/date-utils';

interface DocRow {
  id: string;
  category: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  notes: string | null;
  uploaded_at: string;
}

const CATEGORIES = ['CHT', 'RG', 'OUTROS'] as const;

export default function DocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [tab, setTab] = useState<string>('CHT');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) { setDocs([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false });
    setDocs((data as DocRow[]) || []);
    setLoading(false);
  };

  // Reload when user changes
  useEffect(() => { load(); }, [user]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      // Store in user-scoped path: documents/<user_id>/<category>/<timestamp>_<filename>
      const category = tab.toLowerCase();
      const path = `${user.id}/${category}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from('documents').insert({
        user_id: user.id,
        category: tab,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        notes: notes || null,
      });
      if (dbErr) throw dbErr;

      toast.success('Documento enviado!');
      setNotes('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar');
    } finally {
      setUploading(false);
      // Reset the file input
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (doc: DocRow) => {
    if (!user) return;
    const confirmed = window.confirm(`Excluir "${doc.file_name}"?`);
    if (!confirmed) return;

    // Remove from storage first
    await supabase.storage.from('documents').remove([doc.storage_path]);
    // Remove from database
    await supabase.from('documents').delete().eq('id', doc.id).eq('user_id', user.id);
    toast.success('Documento excluído');
    load();
  };

  const handleView = async (doc: DocRow) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDownload = async (doc: DocRow) => {
    const { data } = await supabase.storage.from('documents').download(doc.storage_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const filtered = docs.filter(d => d.category === tab);

  return (
    <AppLayout>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6">
        Documentos
      </motion.h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          {CATEGORIES.map(c => (
            <TabsTrigger key={c} value={c}>
              {c} {docs.filter(d => d.category === c).length > 0 && <span className="ml-1 text-xs opacity-60">({docs.filter(d => d.category === c).length})</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map(cat => (
          <TabsContent key={cat} value={cat}>
            {/* Upload */}
            <div className="bg-card rounded-xl p-6 shadow-card mb-6 border border-border">
              <h3 className="font-semibold text-foreground mb-3">Enviar {cat}</h3>
              <Textarea placeholder="Observações (opcional)" value={notes} onChange={e => setNotes(e.target.value)} className="mb-3" rows={2} />
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
                <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" />{uploading ? 'Enviando...' : 'Escolher Arquivo'}
                </Button>
                <Button variant="outline" onClick={() => { if (fileRef.current) { fileRef.current.setAttribute('capture', 'environment'); fileRef.current.click(); fileRef.current.removeAttribute('capture'); } }}>
                  <Camera className="w-4 h-4 mr-2" />Câmera
                </Button>
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="bg-card rounded-xl p-8 text-center shadow-card">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Nenhum documento {cat} enviado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(doc => (
                  <div key={doc.id} className="bg-card rounded-xl p-4 shadow-card flex items-center justify-between border border-border">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTimeBR(doc.uploaded_at)}</p>
                      {doc.mime_type && <p className="text-xs text-muted-foreground">{doc.mime_type}</p>}
                      {doc.notes && <p className="text-xs text-muted-foreground mt-1">{doc.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => handleView(doc)} title="Visualizar"><Eye className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)} title="Baixar"><Download className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(doc)} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </AppLayout>
  );
}

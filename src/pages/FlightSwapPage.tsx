import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  aberta: { label: 'Aberta', variant: 'outline' },
  enviada: { label: 'Enviada', variant: 'default' },
  concluida: { label: 'Concluída', variant: 'secondary' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

export default function FlightSwapPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [form, setForm] = useState({ flight_number: '', flight_date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('flight_swap_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setRequests(data || []);
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async () => {
    if (!user || !form.flight_number) { toast.error('Informe o voo'); return; }
    setSaving(true);
    await supabase.from('flight_swap_requests').insert({ user_id: user.id, flight_number: form.flight_number, flight_date: form.flight_date || null, notes: form.notes || null });
    toast.success('Solicitação criada!');
    setForm({ flight_number: '', flight_date: '', notes: '' });
    setSaving(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('flight_swap_requests').update({ status }).eq('id', id);
    toast.success('Status atualizado');
    load();
  };

  return (
    <AppLayout>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <ArrowLeftRight className="w-6 h-6 text-primary" />Troca de Voo
      </motion.h1>

      <div className="bg-card rounded-xl p-6 shadow-card mb-6 border border-border">
        <h3 className="font-semibold text-foreground mb-3">Nova Solicitação</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><Label className="text-xs">Voo</Label><Input value={form.flight_number} onChange={e => setForm(f => ({ ...f, flight_number: e.target.value }))} placeholder="LA3456" /></div>
          <div><Label className="text-xs">Data</Label><Input type="date" value={form.flight_date} onChange={e => setForm(f => ({ ...f, flight_date: e.target.value }))} /></div>
        </div>
        <Textarea placeholder="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mb-3" />
        <Button onClick={handleCreate} disabled={saving}><Plus className="w-4 h-4 mr-2" />Criar Solicitação</Button>
      </div>

      <div className="space-y-3">
        {requests.map(r => {
          const s = STATUS_MAP[r.status] || STATUS_MAP.aberta;
          return (
            <div key={r.id} className="bg-card rounded-xl p-4 shadow-card border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground">{r.flight_number}</p>
                  {r.flight_date && <span className="text-xs text-muted-foreground font-mono">{r.flight_date}</span>}
                </div>
                <Badge variant={s.variant}>{s.label}</Badge>
              </div>
              {r.notes && <p className="text-sm text-muted-foreground mb-2">{r.notes}</p>}
              <div className="flex gap-2 flex-wrap">
                {r.status !== 'enviada' && r.status !== 'concluida' && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, 'enviada')}>Marcar Enviada</Button>}
                {r.status !== 'concluida' && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, 'concluida')}>Concluída</Button>}
                {r.status !== 'cancelada' && <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus(r.id, 'cancelada')}>Cancelar</Button>}
              </div>
            </div>
          );
        })}
        {requests.length === 0 && <p className="text-center text-muted-foreground text-sm py-10">Nenhuma solicitação de troca</p>}
      </div>
    </AppLayout>
  );
}

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NumericInput, safeParseNumber } from '@/components/ui/numeric-input';
import { toast } from 'sonner';
import { UtensilsCrossed, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateBR } from '@/lib/date-utils';
import type { Database } from '@/integrations/supabase/types';

type PerDiemRow = Database['public']['Tables']['perdiem_entries']['Row'];

export default function PerDiemPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PerDiemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ date: string; location: string; quantity: number | null; unit_value: number | null; notes: string }>({
    date: '', location: '', quantity: 1, unit_value: null, notes: ''
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('perdiem_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(100);
    setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleAdd = async () => {
    if (!user || !form.date) { toast.error('Preencha a data'); return; }
    setSaving(true);
    const qty = safeParseNumber(form.quantity, 1);
    const uv = safeParseNumber(form.unit_value);
    const total = qty * uv;
    await supabase.from('perdiem_entries').insert({ user_id: user.id, date: form.date, location: form.location, quantity: qty, unit_value: uv, total_value: total, notes: form.notes || null });
    toast.success('Diária adicionada!');
    setForm({ date: '', location: '', quantity: 1, unit_value: null, notes: '' });
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await supabase.from('perdiem_entries').delete().eq('id', id).eq('user_id', user.id);
    toast.success('Excluída');
    load();
  };

  const totalMonth = entries.reduce((s, e) => s + Number(e.total_value || 0), 0);
  const displayTotal = safeParseNumber(form.quantity, 1) * safeParseNumber(form.unit_value);

  return (
    <AppLayout>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <UtensilsCrossed className="w-6 h-6 text-primary" />Diárias
      </motion.h1>

      <div className="bg-card rounded-xl p-6 shadow-card mb-6 border border-border">
        <h3 className="font-semibold text-foreground mb-3">Nova Diária</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div><Label className="text-xs">Data</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div><Label className="text-xs">Local</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="GRU" /></div>
          <div><Label className="text-xs">Quantidade</Label><NumericInput value={form.quantity} onValueChange={val => setForm(f => ({ ...f, quantity: val }))} min={1} decimals={0} blurDefault={1} /></div>
          <div><Label className="text-xs">Valor Unitário</Label><NumericInput value={form.unit_value} onValueChange={val => setForm(f => ({ ...f, unit_value: val }))} decimals={2} /></div>
        </div>
        <Textarea placeholder="Observações (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mb-3" />
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total: <strong className="text-foreground">R$ {displayTotal.toFixed(2)}</strong></p>
          <Button onClick={handleAdd} disabled={saving}><Plus className="w-4 h-4 mr-2" />Adicionar</Button>
        </div>
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-foreground">Registros</h3>
          <p className="text-sm font-bold text-foreground">Total: R$ {totalMonth.toFixed(2)}</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">Nenhuma diária registrada</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground text-xs"><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Local</th><th className="py-2 pr-3">Qtd</th><th className="py-2 pr-3">Unit</th><th className="py-2 pr-3">Total</th><th className="py-2"></th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-mono text-foreground">{formatDateBR(e.date)}</td>
                    <td className="py-2 pr-3 text-foreground">{e.location || '—'}</td>
                    <td className="py-2 pr-3 text-foreground">{e.quantity}</td>
                    <td className="py-2 pr-3 text-muted-foreground">R$ {Number(e.unit_value).toFixed(2)}</td>
                    <td className="py-2 pr-3 font-bold text-foreground">R$ {Number(e.total_value).toFixed(2)}</td>
                    <td className="py-2"><Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => handleDelete(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

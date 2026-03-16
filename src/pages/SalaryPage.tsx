import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { DollarSign, Save, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const now = new Date();
const defaultMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

export default function SalaryPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(defaultMonth);
  const [form, setForm] = useState({
    base_salary: 0, per_diem_total: 0, overnight_total: 0, night_additional: 0,
    productivity_bonus: 0, other_additions: 0, inss: 0, irrf: 0,
    health_plan: 0, other_discounts: 0, notes: '',
  });
  const [entryId, setEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const gross = form.base_salary + form.per_diem_total + form.overnight_total + form.night_additional + form.productivity_bonus + form.other_additions;
  const deductions = form.inss + form.irrf + form.health_plan + form.other_discounts;
  const net = gross - deductions;

  const loadMonth = async () => {
    if (!user) return;
    const { data } = await supabase.from('salary_entries').select('*').eq('user_id', user.id).eq('reference_month', month).maybeSingle();
    if (data) {
      setEntryId(data.id);
      setForm({
        base_salary: Number(data.base_salary) || 0, per_diem_total: Number(data.per_diem_total) || 0,
        overnight_total: Number(data.overnight_total) || 0, night_additional: Number(data.night_additional) || 0,
        productivity_bonus: Number(data.productivity_bonus) || 0, other_additions: Number(data.other_additions) || 0,
        inss: Number(data.inss) || 0, irrf: Number(data.irrf) || 0,
        health_plan: Number(data.health_plan) || 0, other_discounts: Number(data.other_discounts) || 0,
        notes: data.notes || '',
      });
    } else {
      setEntryId(null);
      setForm({ base_salary: 0, per_diem_total: 0, overnight_total: 0, night_additional: 0, productivity_bonus: 0, other_additions: 0, inss: 0, irrf: 0, health_plan: 0, other_discounts: 0, notes: '' });
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from('salary_entries').select('*').eq('user_id', user.id).order('reference_month', { ascending: false }).limit(12);
    setHistory(data || []);
  };

  useEffect(() => { loadMonth(); }, [user, month]);
  useEffect(() => { loadHistory(); }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { ...form, user_id: user.id, reference_month: month, gross_total: gross, net_total: net };
    if (entryId) {
      await supabase.from('salary_entries').update(payload).eq('id', entryId);
    } else {
      await supabase.from('salary_entries').insert(payload);
    }
    toast.success('Salário salvo!');
    setSaving(false);
    loadMonth();
    loadHistory();
  };

  const field = (label: string, key: keyof typeof form, positive = true) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={form[key] as number} onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} className={positive ? '' : 'border-destructive/30'} />
    </div>
  );

  return (
    <AppLayout>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <DollarSign className="w-6 h-6 text-primary" />Salário
      </motion.h1>

      <div className="mb-4">
        <Label>Mês de referência</Label>
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="max-w-xs" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h3 className="font-semibold text-foreground mb-4 text-success">Proventos</h3>
          <div className="grid grid-cols-2 gap-3">
            {field('Salário Base', 'base_salary')}
            {field('Diárias', 'per_diem_total')}
            {field('Pernoites', 'overnight_total')}
            {field('Adicional Noturno', 'night_additional')}
            {field('Produtividade', 'productivity_bonus')}
            {field('Outros Adicionais', 'other_additions')}
          </div>
          <p className="mt-4 text-sm font-bold text-success">Bruto: R$ {gross.toFixed(2)}</p>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h3 className="font-semibold text-foreground mb-4 text-destructive">Descontos</h3>
          <div className="grid grid-cols-2 gap-3">
            {field('INSS', 'inss', false)}
            {field('IRRF', 'irrf', false)}
            {field('Plano de Saúde', 'health_plan', false)}
            {field('Outros Descontos', 'other_discounts', false)}
          </div>
          <p className="mt-4 text-sm font-bold text-destructive">Descontos: R$ {deductions.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card mb-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Líquido</p>
            <p className="text-3xl font-bold text-foreground">R$ {net.toFixed(2)}</p>
          </div>
          <Button onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
        <Textarea placeholder="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      </div>

      {history.length > 0 && (
        <div className="bg-card rounded-xl p-6 shadow-card">
          <h3 className="font-semibold text-foreground mb-4">Histórico</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground text-xs"><th className="py-2 pr-3">Mês</th><th className="py-2 pr-3">Bruto</th><th className="py-2 pr-3">Descontos</th><th className="py-2">Líquido</th></tr></thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50" onClick={() => setMonth(h.reference_month)}>
                    <td className="py-2 pr-3 font-mono text-foreground">{h.reference_month}</td>
                    <td className="py-2 pr-3 text-success">R$ {Number(h.gross_total).toFixed(2)}</td>
                    <td className="py-2 pr-3 text-destructive">R$ {(Number(h.inss) + Number(h.irrf) + Number(h.health_plan) + Number(h.other_discounts)).toFixed(2)}</td>
                    <td className="py-2 font-bold text-foreground">R$ {Number(h.net_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

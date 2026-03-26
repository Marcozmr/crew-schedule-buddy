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
import { DollarSign, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type SalaryHistoryRow = Database['public']['Tables']['salary_entries']['Row'];

const now = new Date();
const defaultMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

type SalaryForm = {
  base_salary: number | null;
  per_diem_total: number | null;
  overnight_total: number | null;
  night_additional: number | null;
  productivity_bonus: number | null;
  other_additions: number | null;
  inss: number | null;
  irrf: number | null;
  health_plan: number | null;
  other_discounts: number | null;
  notes: string;
};

const emptyForm: SalaryForm = {
  base_salary: null, per_diem_total: null, overnight_total: null, night_additional: null,
  productivity_bonus: null, other_additions: null, inss: null, irrf: null,
  health_plan: null, other_discounts: null, notes: '',
};

export default function SalaryPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(defaultMonth);
  const [form, setForm] = useState<SalaryForm>({ ...emptyForm });
  const [entryId, setEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SalaryHistoryRow[]>([]);

  const v = (key: keyof SalaryForm): number => safeParseNumber(form[key] as number | null);
  const gross = v('base_salary') + v('per_diem_total') + v('overnight_total') + v('night_additional') + v('productivity_bonus') + v('other_additions');
  const deductions = v('inss') + v('irrf') + v('health_plan') + v('other_discounts');
  const net = gross - deductions;

  const loadMonth = async () => {
    if (!user) return;
    const { data } = await supabase.from('salary_entries').select('*').eq('user_id', user.id).eq('reference_month', month).maybeSingle();
    if (data) {
      setEntryId(data.id);
      setForm({
        base_salary: data.base_salary, per_diem_total: data.per_diem_total,
        overnight_total: data.overnight_total, night_additional: data.night_additional,
        productivity_bonus: data.productivity_bonus, other_additions: data.other_additions,
        inss: data.inss, irrf: data.irrf,
        health_plan: data.health_plan, other_discounts: data.other_discounts,
        notes: data.notes || '',
      });
    } else {
      setEntryId(null);
      setForm({ ...emptyForm });
    }
  };

  const loadHistory = async () => {
    if (!user) { setHistory([]); return; }
    const { data } = await supabase.from('salary_entries').select('*').eq('user_id', user.id).order('reference_month', { ascending: false }).limit(12);
    setHistory(data || []);
  };

  useEffect(() => { loadMonth(); }, [user, month]);
  useEffect(() => { loadHistory(); }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      base_salary: v('base_salary'), per_diem_total: v('per_diem_total'),
      overnight_total: v('overnight_total'), night_additional: v('night_additional'),
      productivity_bonus: v('productivity_bonus'), other_additions: v('other_additions'),
      inss: v('inss'), irrf: v('irrf'),
      health_plan: v('health_plan'), other_discounts: v('other_discounts'),
      notes: form.notes, user_id: user.id, reference_month: month,
      gross_total: gross, net_total: net,
    };
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

  const field = (label: string, key: keyof SalaryForm, positive = true) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <NumericInput
        value={form[key] as number | null}
        onValueChange={(val) => setForm(f => ({ ...f, [key]: val }))}
        decimals={2}
        allowNegative={false}
        className={positive ? '' : 'border-destructive/30'}
      />
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

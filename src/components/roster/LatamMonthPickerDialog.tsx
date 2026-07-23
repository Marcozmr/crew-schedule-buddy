/**
 * Diálogo controlado (sem trigger próprio) que pede o mês da escala antes de disparar
 * Conectar/Sincronizar no worker LATAM. Precisa abrir a partir de dois pontos diferentes
 * (RosterSourcesCard e AutomationStatusCard), por isso não segue o padrão de PdfImportDialog
 * (que embrulha um único trigger).
 */
import { useMemo, useState } from 'react';
import { Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** 'YYYY-MM' para os 2 meses anteriores, o atual e o próximo — cobre o uso comum sem lista longa. */
function buildMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const out: Array<{ value: string; label: string }> = [];
  for (let offset = -2; offset <= 1; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ value, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}

interface LatamMonthPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (month: string) => void;
  busy?: boolean;
}

export function LatamMonthPickerDialog({ open, onOpenChange, onConfirm, busy }: LatamMonthPickerDialogProps) {
  const options = useMemo(buildMonthOptions, []);
  const [month, setMonth] = useState<string>(() => options[2]?.value ?? options[0].value); // mês atual por padrão

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Qual mês da escala?
          </DialogTitle>
          <DialogDescription>
            Escolha o mês que você quer buscar no iFlight Neo antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <Select value={month} onValueChange={setMonth} disabled={busy}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onConfirm(month)} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

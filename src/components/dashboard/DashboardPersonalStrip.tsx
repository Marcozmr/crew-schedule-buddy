/**
 * Faixa compacta: data operacional + minha base (estilo painel de escala pessoal).
 * Sem metadados técnicos da fonte (PDF, arquivo) — ficam em Minha escala.
 */
export function DashboardPersonalStrip({
  dateLabel,
  homeBase,
}: {
  dateLabel: string;
  homeBase: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Data Operacional
        </p>
        <p className="break-words text-sm font-semibold capitalize leading-snug text-foreground">
          {dateLabel}
        </p>
      </div>
      <div className="h-px w-full bg-border sm:h-10 sm:w-px" />
      <div className="min-w-0 sm:text-right">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Minha Base
        </p>
        <p className="font-mono text-xl font-bold tabular-nums text-foreground">
          {homeBase ?? "—"}
        </p>
      </div>
    </div>
  );
}

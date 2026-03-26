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
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/70 bg-card/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Data operacional
        </p>
        <p className="break-words text-sm font-medium capitalize leading-snug text-foreground">
          {dateLabel}
        </p>
      </div>
      <div className="min-w-0 sm:text-right">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Minha base
        </p>
        <p className="font-mono text-base font-semibold tabular-nums text-foreground">
          {homeBase ?? "—"}
        </p>
      </div>
    </div>
  );
}

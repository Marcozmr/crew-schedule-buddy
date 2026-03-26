import type { ReactNode } from "react";

interface DashboardPersonalStripProps {
  /** YYYY-MM-DD no fuso operacional */
  operationalDateIso: string;
  /** Label legível da data no fuso do usuário */
  dateLabel: string;
  /** IATA da minha base ou null */
  homeBase: string | null;
  /** Slot opcional (ex.: fonte da escala) */
  trailing?: ReactNode;
}

/**
 * Faixa compacta: data operacional + minha base (estilo painel de escala pessoal).
 */
export function DashboardPersonalStrip({
  operationalDateIso,
  dateLabel,
  homeBase,
  trailing,
}: DashboardPersonalStripProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/70 bg-card/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Data operacional
        </p>
        <p className="break-words text-sm font-medium capitalize leading-snug text-foreground">
          {dateLabel}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground/90">{operationalDateIso}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:items-end sm:text-right">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Minha base
          </p>
          <p className="font-mono text-base font-semibold tabular-nums text-foreground">
            {homeBase ?? "—"}
          </p>
        </div>
        {trailing}
      </div>
    </div>
  );
}

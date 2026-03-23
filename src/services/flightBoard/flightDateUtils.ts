/**
 * Utilitários centralizados de data/hora para Flight Board
 * Padrão Brasil: dd/MM/yyyy, HH:mm (24h)
 * Tratamento correto de UTC das APIs
 */

const BRAZIL_TZ = "America/Sao_Paulo";

/** Formata data em dd/MM/yyyy (Brasil) */
export function formatBrazilianDate(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== "string") return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** Formata horário HH:mm (24h, Brasil) */
export function formatBrazilianTime(timeStr: string | null | undefined): string {
  if (!timeStr || typeof timeStr !== "string") return "—";
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "—";
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return "—";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Converte ISO string (UTC) para HH:mm no fuso do Brasil */
export function formatBrazilianTimeFromISO(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("pt-BR", {
      timeZone: BRAZIL_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

/** Formata data+hora em dd/MM/yyyy HH:mm (Brasil) */
export function formatBrazilianDateTime(
  isoOrTimestamp: string | number | Date | null | undefined
): string {
  if (isoOrTimestamp == null) return "—";
  const ts =
    typeof isoOrTimestamp === "string"
      ? new Date(isoOrTimestamp).getTime()
      : typeof isoOrTimestamp === "number"
        ? isoOrTimestamp
        : isoOrTimestamp.getTime();
  if (Number.isNaN(ts)) return "—";
  return new Date(ts).toLocaleString("pt-BR", {
    timeZone: BRAZIL_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Extrai HH:mm de string ISO (preserva UTC na interpretação)
 * Exemplo ISO: 2019-12-12T04:20:00+00:00
 */
export function extractTimeFromISO(iso: string | null | undefined): string | null {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("pt-BR", {
    timeZone: BRAZIL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Calcula delay em minutos: estimated - scheduled OU actual - scheduled
 * Retorna null se não houver dados suficientes ou se for inconsistente
 */
export function calculateDelayMinutes(
  scheduledISO: string | null | undefined,
  estimatedOrActualISO: string | null | undefined
): number | null {
  if (!scheduledISO || !estimatedOrActualISO) return null;
  try {
    const sched = new Date(scheduledISO).getTime();
    const est = new Date(estimatedOrActualISO).getTime();
    if (Number.isNaN(sched) || Number.isNaN(est)) return null;
    const diffMs = est - sched;
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 0) return null; // delay negativo absurdo = não mostrar
    if (diffMins > 24 * 60) return null; // > 24h = provável erro de dados
    return diffMins;
  } catch {
    return null;
  }
}

/**
 * Retorna timestamp em ms para ordenação (scheduled no fuso Brasil)
 */
export function scheduledToTimestamp(dateStr: string, timeStr: string | null): number {
  if (!dateStr || !timeStr) return 0;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  if (!y || !m || !d) return 0;
  return new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0, 0, 0).getTime();
}

/**
 * Formata tempo restante para partida/chegada
 */
export function formatFlightTimeRemaining(
  scheduledTimestamp: number,
  now: number,
  mode: "departure" | "arrival"
): string {
  const diffMs = scheduledTimestamp - now;
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 0) {
    const absMins = Math.abs(diffMins);
    if (absMins < 60) return `Há ${absMins}min`;
    const h = Math.floor(absMins / 60);
    const m = absMins % 60;
    return m > 0 ? `Há ${h}h ${m}min` : `Há ${h}h`;
  }

  if (diffMins < 60) {
    return mode === "departure" ? `Sai em ${diffMins}min` : `Chega em ${diffMins}min`;
  }

  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  const timeStr = m > 0 ? `${h}h ${m}min` : `${h}h`;
  return mode === "departure" ? `Sai em ${timeStr}` : `Chega em ${timeStr}`;
}

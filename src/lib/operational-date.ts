/**
 * Data operacional única — alinha calendário, dashboard e Flight Board Pro.
 *
 * - O "hoje" operacional NÃO é `Date.toISOString().slice(0,10)` (UTC).
 * - Usa o mesmo fuso das preferências (`useOperationalPreferences().timezone`)
 *   e o mesmo helper que `useOperationalClock` → `getISODateInTimeZone`.
 *
 * Escala: cada `ScheduleEntry.date` (YYYY-MM-DD) é o dia operacional gravado pelo
 * parser — igual às células do calendário. Trechos que cruzam meia-noite ficam na
 * data de partida do trecho, salvo quando o parser grava o segmento no dia seguinte;
 * nesse caso o board lista o voo nesse dia (coerente com o calendário).
 */

import { getISODateInTimeZone, resolveSafeIANATimezone } from "@/lib/date-utils";

export const DEFAULT_OPERATIONAL_TIMEZONE = "America/Sao_Paulo";

/** "Hoje" no fuso operacional (YYYY-MM-DD). Equivalente ao `todayStr` do `useOperationalClock`. */
export function getOperationalTodayIso(timezone: string): string {
  return getISODateInTimeZone(new Date(), resolveSafeIANATimezone(timezone));
}

/**
 * Normalização de status para exibição em português
 * Nunca deixar status em inglês na UI
 */

import type { FlightStatusKey } from "./types";

export const STATUS_LABELS_PT: Record<FlightStatusKey, string> = {
  on_time: "No horário",
  boarding: "Embarque",
  next: "Agendado",
  delayed: "Atrasado",
  cancelled: "Cancelado",
  completed: "Finalizado",
  unknown: "Indisponível",
};

const API_STATUS_TO_KEY: Record<string, FlightStatusKey> = {
  scheduled: "next",
  SCHEDULED: "next",
  active: "next",
  ACTIVE: "next",
  boarding: "boarding",
  BOARDING: "boarding",
  landed: "completed",
  LANDED: "completed",
  arrived: "completed",
  ARRIVED: "completed",
  departed: "completed",
  DEPARTED: "completed",
  cancelled: "cancelled",
  CANCELLED: "cancelled",
  delayed: "delayed",
  DELAYED: "delayed",
  incident: "delayed",
  diverted: "delayed",
  "on time": "on_time",
  "no horário": "on_time",
  UPCOMING: "next",
  BRIEFING: "boarding",
  IN_PROGRESS: "next",
  COMPLETED: "completed",
  ON_GROUND: "on_time",
  AIRBORNE: "next",
  NEXT_FLIGHT: "next",
};

export function normalizeStatusToKey(
  apiStatus: string | null | undefined,
  delayMinutes: number | null
): FlightStatusKey {
  if (delayMinutes != null && delayMinutes > 0) return "delayed";
  if (!apiStatus || typeof apiStatus !== "string") return "unknown";
  const key = API_STATUS_TO_KEY[apiStatus] ?? API_STATUS_TO_KEY[apiStatus.toLowerCase()];
  return key ?? "unknown";
}

export function getStatusLabel(statusKey: FlightStatusKey): string {
  return STATUS_LABELS_PT[statusKey] ?? STATUS_LABELS_PT.unknown;
}

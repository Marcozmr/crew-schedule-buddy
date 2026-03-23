/**
 * Status operacional agregado — não depende só do label da API.
 */

import type { FlightRaw } from "./types";

export type OperationalStatusKey =
  | "scheduled"
  | "enroute"
  | "landed"
  | "delayed"
  | "unknown";

/** Alias para uso em FlightNormalized */
export type FlightOperationalStatus = OperationalStatusKey;

export interface OperationalStatusInput {
  tracking: FlightRaw["tracking"] | null | undefined;
  delayMinutes: number | null | undefined;
  /** ISO ou string de status da edge (AIRBORNE, COMPLETED, …) */
  rawStatus?: string | null;
  /** epoch ms */
  nowMs: number;
  scheduledDepMs: number | null;
  scheduledArrMs: number | null;
}

/**
 * Resolve estado operacional para badge/telemetria.
 */
export function resolveOperationalStatus(input: OperationalStatusInput): OperationalStatusKey {
  const delay = input.delayMinutes ?? 0;
  if (delay > 0) return "delayed";

  const t = input.tracking;
  if (t && t.latitude != null && t.longitude != null && t.onGround === false) {
    return "enroute";
  }

  const st = (input.rawStatus ?? "").toUpperCase();
  if (st === "AIRBORNE" || st === "IN_PROGRESS") return "enroute";
  if (st === "COMPLETED" || st === "LANDED" || st === "ARRIVED") return "landed";

  if (t?.onGround === true) {
    const dep = input.scheduledDepMs;
    const arr = input.scheduledArrMs;
    if (dep != null && arr != null && input.nowMs >= dep && input.nowMs <= arr + 30 * 60 * 1000) {
      return "landed";
    }
  }

  if (input.scheduledArrMs != null && input.nowMs > input.scheduledArrMs + 15 * 60 * 1000) {
    return "landed";
  }

  if (input.scheduledDepMs != null && input.nowMs < input.scheduledDepMs - 2 * 60 * 1000) {
    return "scheduled";
  }

  if (input.scheduledDepMs != null && input.scheduledArrMs != null) {
    if (input.nowMs >= input.scheduledDepMs && input.nowMs <= input.scheduledArrMs + 10 * 60 * 1000) {
      return "enroute";
    }
  }

  return "unknown";
}

export const OPERATIONAL_STATUS_LABEL_PT: Record<OperationalStatusKey, string> = {
  scheduled: "Programado",
  enroute: "Em voo",
  landed: "Aterrissou",
  delayed: "Atrasado",
  unknown: "Indefinido",
};

/**
 * Estado agregado do monitor interno de saúde (sem bloquear UI).
 */
export type HealthStatus = "healthy" | "degraded" | "down";

export type HealthCheckId =
  | "supabase_connection"
  | "auth_service"
  | "edge_functions"
  | "flight_data_provider";

export interface HealthCheckResult {
  id: HealthCheckId;
  status: HealthStatus;
  latencyMs?: number;
  detail?: string;
}

export interface SystemHealthReport {
  overall: HealthStatus;
  checkedAt: string;
  checks: HealthCheckResult[];
}

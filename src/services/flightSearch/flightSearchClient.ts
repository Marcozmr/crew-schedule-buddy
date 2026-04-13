/**
 * Cliente da Edge Function `flight-search` (JWT do utilizador).
 */

import { supabase } from "@/integrations/supabase/client";
import type { FlightSearchRequest, FlightSearchResponse } from "./flightSearchTypes";

export async function invokeFlightSearch(
  payload: FlightSearchRequest,
): Promise<FlightSearchResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    return {
      ok: false,
      status: "error",
      error: "unauthorized",
      message: "Inicie sessão para usar a busca livre.",
    };
  }

  const { data, error } = await supabase.functions.invoke<FlightSearchResponse>("flight-search", {
    body: payload,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (error) {
    return {
      ok: false,
      status: "error",
      error: "invoke_error",
      message: "Não foi possível concluir a busca. Tente novamente.",
    };
  }

  if (data && typeof data === "object" && "ok" in data) {
    if (import.meta.env.DEV) {
      const d = data as FlightSearchResponse;
      console.log("[flight-search]", {
        ok: d.ok,
        count: d.ok ? d.data?.length ?? 0 : d.error,
      });
    }
    return data as FlightSearchResponse;
  }

  return {
    ok: false,
    status: "error",
    error: "invalid_response",
    message: "Resposta inválida do servidor.",
  };
}

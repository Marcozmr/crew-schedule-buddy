import { supabase } from '@/integrations/supabase/client';

export interface FlightCrewmate {
  userId: string;
  name: string;
  airline: string | null;
  crewRole: string | null;
}

/**
 * Descoberta entre colegas: tripulantes de um voo específico, e coincidências (folgas/pernoites)
 * com quem você já tem conexão confirmada (crew_flight_connections). Tudo via RPC SECURITY DEFINER
 * que só revela dados quando o próprio usuário está naquele voo / já tem a conexão.
 */
export const CrewDiscoveryService = {
  async getFlightCrewmates(date: string, flightNumber: string, departure: string): Promise<FlightCrewmate[]> {
    if (!flightNumber?.trim()) return [];
    const { data, error } = await supabase.rpc('get_flight_crewmates', {
      p_date: date,
      p_flight_number: flightNumber,
      p_departure: departure,
    });
    if (error) {
      console.error('[CrewDiscoveryService] getFlightCrewmates error:', error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      userId: row.user_id,
      name: row.name,
      airline: row.airline,
      crewRole: row.crew_role,
    }));
  },

  async getSharedDaysOff(partnerId: string): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_shared_days_off', { p_partner_id: partnerId });
    if (error) {
      console.error('[CrewDiscoveryService] getSharedDaysOff error:', error.message);
      return [];
    }
    return (data ?? []).map((row) => row.day_off);
  },

  async getSharedLayovers(partnerId: string): Promise<{ date: string; city: string }[]> {
    const { data, error } = await supabase.rpc('get_shared_layovers', { p_partner_id: partnerId });
    if (error) {
      console.error('[CrewDiscoveryService] getSharedLayovers error:', error.message);
      return [];
    }
    return (data ?? []).map((row) => ({ date: row.layover_date, city: row.city }));
  },
};

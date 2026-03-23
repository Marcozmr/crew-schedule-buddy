/**
 * Configuração centralizada das APIs de voo
 * Apenas endpoints públicos/safe no frontend.
 * Segredos devem ficar no backend (Supabase Edge Functions).
 */

const env = import.meta.env;

export const flightApiConfig = {
  opensky: {
    baseUrl: "https://opensky-network.org/api",
    timeoutMs: 10000,
  },
} as const;

export function hasOpenSkyCredentials(): boolean {
  // Credenciais OpenSky devem ficar no backend (Supabase secrets), não no frontend.
  return false;
}

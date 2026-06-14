import type { AirlineConnector, NormalizedRoster } from '../autoImportTypes';

/**
 * Conector Azul — estrutura preparada para integração futura.
 * URL e keywords configuráveis via env (VITE_AZUL_CAE_LOGIN_URL).
 * Importação atual: PDF oficial via importação manual (fallback).
 */
export const azulConnector: AirlineConnector = {
  airline: 'AZUL',
  loginUrl: (import.meta.env.VITE_AZUL_CAE_LOGIN_URL as string | undefined)?.trim() ?? '',

  detectLoginSuccess(_url: string, _html?: string): boolean {
    return false;
  },

  detectRosterPage(_url: string, _html?: string): boolean {
    return false;
  },

  async extractRoster(_input): Promise<NormalizedRoster> {
    return {
      header: null,
      entries: [],
      rawText: '',
      sourceAirline: 'AZUL',
      importedAt: new Date().toISOString(),
    };
  },
};

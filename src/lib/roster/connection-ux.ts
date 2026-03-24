import type { RosterConnectionState } from '@/modules/roster/services/UserRosterConnectionService';

/**
 * Texto curto para o banner — foco em produto, não em integração técnica.
 */
export function getRosterBannerStatusLine(
  rosterState: RosterConnectionState | undefined,
  connectionStatus: string | undefined,
  hasActiveRoster: boolean
): string {
  if (rosterState === 'roster_connected' || (hasActiveRoster && rosterState === 'idle')) {
    return 'Escala sincronizada com o EscalaX';
  }
  if (rosterState === 'iflight_accessed') {
    return 'Conclua com um CrewRosterReport para fixar a escala';
  }
  if (rosterState === 'portal_connected') {
    return 'Portal reconhecido — importe o PDF oficial';
  }
  if (connectionStatus === 'connected') {
    return 'Conexão ativa';
  }
  if (hasActiveRoster) {
    return 'Escala disponível no app';
  }
  return 'Sem escala importada';
}

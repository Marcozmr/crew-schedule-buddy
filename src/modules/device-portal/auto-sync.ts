/**
 * Sincronização automática do iFlight: ao abrir o app ou voltar para ele, se a última leitura tem
 * mais de 3 horas, lê a escala de novo com a tela escondida. Só no app instalado e com sessão salva;
 * sessão expirada fica para a tripulante reconectar pelo card.
 */
import { Capacitor } from '@capacitor/core';
import { emitRosterUpdated } from '@/lib/events/roster-events';
import { importIflightRosterJson, importPdfArrayBuffer } from '@/lib/pdf-import';
import { syncPortal, type PortalResult } from './portal-session';
import { LATAM_IFLIGHT } from './providers';
import { loadPortalState } from './session-store';

export const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000;

let running = false;

export async function autoSyncPortal(userId: string, now: Date = new Date()): Promise<'skipped' | PortalResult['kind']> {
  if (running || !Capacitor.isNativePlatform()) return 'skipped';
  const state = loadPortalState(LATAM_IFLIGHT.id);
  if (state.status !== 'saved') return 'skipped';
  if (state.lastSyncAt && now.getTime() - new Date(state.lastSyncAt).getTime() < AUTO_SYNC_INTERVAL_MS) return 'skipped';

  running = true;
  try {
    const result = await syncPortal(
      LATAM_IFLIGHT,
      {
        importPdf: (name, bytes) => importPdfArrayBuffer(name, bytes, userId),
        importRosterJson: (text) => importIflightRosterJson(text, userId),
      },
      () => {},
    );
    if (result.kind === 'imported') {
      emitRosterUpdated({ userId, reason: 'portal_sync_auto', at: new Date().toISOString() });
    }
    return result.kind;
  } finally {
    running = false;
  }
}

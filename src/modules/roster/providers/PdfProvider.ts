/**
 * PdfProvider — importação de escala via PDF.
 * Fallback principal. Integrado ao parser existente.
 */

import { RosterProvider } from './RosterProvider';
import { importPdfFile } from '@/lib/pdf-import';
import type { ConnectionResult, ProviderStatus, RosterSourceInfo, RosterSyncResult } from '../types';

export class PdfProvider extends RosterProvider {
  readonly id = 'pdf' as const;
  readonly name = 'Importar PDF';

  async connect(): Promise<ConnectionResult> {
    return { success: true };
  }

  async disconnect(): Promise<void> {
    // PDF não mantém sessão
  }

  async getStatus(): Promise<ProviderStatus> {
    return { status: 'disconnected', message: 'Importação sob demanda' };
  }

  async syncRoster(): Promise<RosterSyncResult> {
    return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Use importação de arquivo' };
  }

  async importRoster(file: File): Promise<RosterSyncResult> {
    const { data } = await import('@/integrations/supabase/client').then((m) =>
      m.supabase.auth.getUser()
    );
    const userId = data?.user?.id;
    if (!userId) {
      return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Usuário não autenticado' };
    }

    const result = await importPdfFile(file, userId);
    return {
      success: result.success,
      rosterId: result.rosterId,
      parsedCount: result.parsedCount,
      insertedCount: result.insertedCount,
      error: result.error,
    };
  }

  supportsAutoSync(): boolean {
    return false;
  }

  supportsManualImport(): boolean {
    return true;
  }

  listAvailableSources(): RosterSourceInfo[] {
    return [
      {
        id: 'pdf',
        displayName: 'Importar PDF',
        description: 'Upload do PDF oficial da escala',
        available: true,
      },
    ];
  }
}

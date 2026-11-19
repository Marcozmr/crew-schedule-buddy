/**
 * Service worker só faz sentido no navegador. No app instalado (Capacitor) os arquivos já estão
 * no aparelho, e o cache do service worker fazia a primeira abertura depois de atualizar o APK
 * rodar a versão antiga (e quebrar ao pedir arquivos que não existem mais).
 */
import { Capacitor } from '@capacitor/core';
import { clearAllAppCaches, unregisterAllServiceWorkers } from '@/lib/app-recovery/appRecoveryManager';

export function shouldUseServiceWorker(): boolean {
  return !Capacitor.isNativePlatform();
}

/** No app instalado: remove o service worker e o cache deixados por versões anteriores. */
export async function cleanupServiceWorkerOnNative(): Promise<void> {
  if (shouldUseServiceWorker()) return;
  try {
    await unregisterAllServiceWorkers();
    await clearAllAppCaches();
  } catch {
    /* sem service worker para remover */
  }
}

export function registerBootErrorListeners(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', console.error);
  window.addEventListener('unhandledrejection', console.error);
}

/** Remove SW antigos (ex.: domínio customizado com registo legado). */
export async function unregisterBootServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if (regs.length > 0) {
      console.info('[EscalaX boot] service workers removidos:', regs.length);
    }
  } catch (e) {
    console.error('[EscalaX boot] Falha ao remover service workers:', e);
  }
}

/** Limpa Cache Storage (Workbox/restos de PWA) para evitar HTML/JS antigo em cache. */
export async function clearStaleWebCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    if (keys.length > 0) {
      console.info('[EscalaX boot] Cache Storage limpo:', keys.length, 'entradas');
    }
  } catch (e) {
    console.warn('[EscalaX boot] Limpeza de Cache Storage falhou:', e);
  }
}

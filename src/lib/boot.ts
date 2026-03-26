export function registerBootErrorListeners(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', console.error);
  window.addEventListener('unhandledrejection', console.error);
}

export async function unregisterBootServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch (e) {
    console.error('[EscalaX boot] Falha ao remover service workers:', e);
  }
}

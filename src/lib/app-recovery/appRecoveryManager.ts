/**
 * Recuperação automática após deploy: chunks lazy / SW / Cache Storage inconsistentes.
 * Uma tentativa por sessão (sessionStorage) para evitar loop infinito.
 * Preserva chaves Supabase (`sb-*`) e preferências seguras (tema, PWA dismiss).
 */

import { getEscalaxBuildId } from '@/lib/build-id';

/** Exportado para main.tsx / diagnóstico — mesma chave em toda a app. */
export const RECOVERY_SESSION_KEY = 'escalax_recovery_reload_pending';
const OVERLAY_ID = 'escalax-recovery-overlay';
const HARD_FAIL_ID = 'escalax-recovery-hard-fail';

type DiagCategory = 'build' | 'sw' | 'cache' | 'recovery' | 'session';

function diag(category: DiagCategory, message: string, data?: unknown): void {
  const prefix = `[EscalaX][${category}]`;
  if (data !== undefined) {
    console.info(prefix, message, data);
  } else {
    console.info(prefix, message);
  }
}

function diagWarn(category: DiagCategory, message: string, data?: unknown): void {
  const prefix = `[EscalaX][${category}]`;
  if (data !== undefined) {
    console.warn(prefix, message, data);
  } else {
    console.warn(prefix, message);
  }
}

/** Erros típicos de HTML novo referenciando chunk antigo (ou SW servindo shell velha). */
export function isRecoverableLoadFailureMessage(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('failed to fetch dynamically imported module') ||
    t.includes('loading chunk') ||
    t.includes('chunk load error') ||
    t.includes('loading css chunk') ||
    t.includes('importing a module script failed') ||
    t.includes('error loading dynamically imported module') ||
    t.includes('unable to preload css') ||
    (t.includes('failed to fetch') && (t.includes('import') || t.includes('chunk') || t.includes('module')))
  );
}

function extractErrorText(e: ErrorEvent | PromiseRejectionEvent): string {
  if (e instanceof ErrorEvent) {
    return `${e.message}\n${e.error?.stack ?? ''}`;
  }
  const r = e.reason;
  if (r instanceof Error) return `${r.message}\n${r.stack ?? ''}`;
  return String(r ?? '');
}

export function showRecoveryOverlay(message = 'Atualizando o EscalaX…'): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(OVERLAY_ID)) return;
  const el = document.createElement('div');
  el.id = OVERLAY_ID;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483646',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(15,23,42,0.35)',
    'backdrop-filter:blur(4px)',
    'padding:1rem',
  ].join(';');
  el.innerHTML = `<div style="max-width:20rem;padding:1.25rem 1.5rem;border-radius:1rem;background:var(--background,#fff);color:var(--foreground,#0f172a);font-family:system-ui,sans-serif;font-size:0.95rem;box-shadow:0 10px 40px rgba(0,0,0,0.12);text-align:center;border:1px solid rgba(148,163,184,0.35)">${escapeHtml(
    message,
  )}</div>`;
  document.body.appendChild(el);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function removeRecoveryOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

export function showHardRecoveryFallback(): void {
  removeRecoveryOverlay();
  if (typeof document === 'undefined') return;
  if (document.getElementById(HARD_FAIL_ID)) return;
  const el = document.createElement('div');
  el.id = HARD_FAIL_ID;
  el.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:var(--background,#f8fafc)',
    'padding:1.25rem',
  ].join(';');
  el.innerHTML = `<div style="max-width:22rem;text-align:center;font-family:system-ui,sans-serif">
    <p style="font-size:1.05rem;font-weight:600;color:var(--foreground,#0f172a);margin:0 0 0.75rem">Não foi possível concluir a atualização</p>
    <p style="font-size:0.875rem;color:#64748b;margin:0 0 1.25rem;line-height:1.45">Tente novamente. Se o problema continuar, feche o aplicativo por completo e abra de novo.</p>
    <button type="button" id="escalax-recovery-retry" style="margin-right:0.5rem;padding:0.5rem 1rem;border-radius:0.5rem;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-size:0.875rem;cursor:pointer">Tentar novamente</button>
    <button type="button" id="escalax-recovery-hard-reload" style="padding:0.5rem 1rem;border-radius:0.5rem;border:none;background:#2563eb;color:#fff;font-size:0.875rem;cursor:pointer">Recarregar</button>
  </div>`;
  document.body.appendChild(el);
  document.getElementById('escalax-recovery-retry')?.addEventListener('click', () => {
    sessionStorage.removeItem(RECOVERY_SESSION_KEY);
    void (async () => {
      await performSelectiveLocalDataClear();
      await performStaleAssetRecovery();
      window.location.reload();
    })();
  });
  document.getElementById('escalax-recovery-hard-reload')?.addEventListener('click', () => {
    sessionStorage.removeItem(RECOVERY_SESSION_KEY);
    window.location.reload();
  });
}

/** Limpa caches do Cache API (Workbox / SW). */
export async function clearAllAppCaches(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  diag('cache', 'Cache Storage limpo', { count: keys.length, keys });
  return keys.length;
}

/** Remove todos os registos de service worker (força novo fetch do SW na próxima carga). */
export async function unregisterAllServiceWorkers(): Promise<number> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 0;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  diag('sw', 'Service workers removidos', { count: regs.length });
  return regs.length;
}

/**
 * Recuperação completa de assets (sem apagar sessão Supabase em localStorage).
 * Usado após erro de chunk ou manualmente a partir do fallback.
 */
export async function performStaleAssetRecovery(): Promise<void> {
  await clearAllAppCaches();
  await unregisterAllServiceWorkers();
  try {
    if (navigator.serviceWorker?.controller) {
      await new Promise((r) => setTimeout(r, 150));
    }
  } catch {
    /* ignore */
  }
}

const PRESERVED_LOCAL_PREFIXES = ['sb-', 'supabase.auth'];
const PRESERVED_LOCAL_KEYS = new Set([
  'escalax-theme',
  'escalax_pwa_dismissed',
  'escalax_local_schema_version',
  'google_provider_token',
]);

function shouldPreserveLocalStorageKey(key: string): boolean {
  if (PRESERVED_LOCAL_KEYS.has(key)) return true;
  if (key.startsWith('sb-')) return true;
  return PRESERVED_LOCAL_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * Último recurso: remove dados locais incompatíveis, mantendo auth Supabase e preferências.
 * Não chamar em loop; só após segunda falha ou ação explícita do utilizador.
 */
export async function performSelectiveLocalDataClear(): Promise<void> {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && !shouldPreserveLocalStorageKey(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    diag('session', 'localStorage seletivo limpo', { removedKeys: keys.length });
  } catch (e) {
    diagWarn('session', 'falha ao limpar localStorage seletivo', e);
  }
}

let recoveryInFlight = false;

/**
 * Primeira falha: limpar caches + SW + reload.
 * Segunda falha (mesma sessão): fallback amigável + opção de limpeza seletiva.
 */
export async function handleRecoverableFailure(source: string, detail?: string): Promise<void> {
  if (recoveryInFlight) return;
  recoveryInFlight = true;
  diag('recovery', 'falha recuperável', { source, detail, buildId: getEscalaxBuildId() });

  const already = sessionStorage.getItem(RECOVERY_SESSION_KEY) === '1';
  if (already) {
    recoveryInFlight = false;
    diag('recovery', 'segunda falha — fallback UI', { source });
    showHardRecoveryFallback();
    return;
  }

  sessionStorage.setItem(RECOVERY_SESSION_KEY, '1');
  showRecoveryOverlay();
  try {
    await performStaleAssetRecovery();
  } catch (e) {
    diagWarn('recovery', 'cleanup falhou', e);
  }
  window.location.reload();
}

export function clearRecoverySessionFlag(): void {
  try {
    sessionStorage.removeItem(RECOVERY_SESSION_KEY);
    removeRecoveryOverlay();
    diag('recovery', 'flag de recuperação limpa (boot OK)', { buildId: getEscalaxBuildId() });
  } catch {
    /* ignore */
  }
}

export function registerAppRecoveryHandlers(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener(
    'error',
    (e: Event) => {
      const ev = e as ErrorEvent;
      const text = extractErrorText(ev);
      if (!isRecoverableLoadFailureMessage(text)) return;
      ev.preventDefault();
      void handleRecoverableFailure('error', text.slice(0, 400));
    },
    true,
  );

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const text = extractErrorText(e);
    if (!isRecoverableLoadFailureMessage(text)) return;
    e.preventDefault();
    void handleRecoverableFailure('unhandledrejection', text.slice(0, 400));
  });
}

/** Para testes / diagnóstico manual. */
export function getRecoverySessionPending(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

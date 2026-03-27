/**
 * Versionamento defensivo de dados locais (localStorage).
 * Migrações futuras: incrementar CURRENT_SCHEMA e tratar `n < CURRENT_SCHEMA`.
 */

const SCHEMA_KEY = 'escalax_local_schema_version';
const CURRENT_SCHEMA = 1;

function diag(message: string, data?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.info('[EscalaX][storage]', message, data ?? '');
  }
}

/**
 * Executar cedo no boot (antes de Supabase/React), de forma síncrona e tolerante a falhas.
 */
export function runStorageMigrationOnBoot(): void {
  try {
    const raw = localStorage.getItem(SCHEMA_KEY);
    if (raw === null) {
      localStorage.setItem(SCHEMA_KEY, String(CURRENT_SCHEMA));
      diag('schema inicial', { version: CURRENT_SCHEMA });
      return;
    }
    const prev = parseInt(raw, 10);
    if (Number.isNaN(prev) || prev < 0) {
      localStorage.setItem(SCHEMA_KEY, String(CURRENT_SCHEMA));
      diag('schema corrigido (valor inválido)', { prev: raw, next: CURRENT_SCHEMA });
      return;
    }
    if (prev < CURRENT_SCHEMA) {
      // Ex.: futura migração de chaves legadas — hoje só bump de versão.
      localStorage.setItem(SCHEMA_KEY, String(CURRENT_SCHEMA));
      diag('schema migrado', { from: prev, to: CURRENT_SCHEMA });
    }
  } catch (e) {
    console.warn('[EscalaX][storage] migração ignorada (storage indisponível?)', e);
  }
}

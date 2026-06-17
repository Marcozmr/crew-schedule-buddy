/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  readonly VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: string;
  readonly VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string;
  /** Default: ligado. `false` desativa chamadas à Edge Function auth-rate-limit. */
  readonly VITE_AUTH_RATE_LIMIT_ENABLED?: string;
  /** Default: true — falha de rede/5xx não bloqueia auth. `false` bloqueia se o check falhar. */
  readonly VITE_AUTH_RATE_LIMIT_FAIL_OPEN?: string;
  /** Default: ligado — chama RPC `log_auth_audit_event` para persistir auditoria de auth. `false` desativa só a persistência (eventos continuam em DEV no console). */
  readonly VITE_AUTH_AUDIT_PERSIST_ENABLED?: string;
  /** `true` mostra o indicador de system health (canto). Fora de DEV o default é oculto. */
  readonly VITE_SYSTEM_HEALTH_INDICATOR?: string;
  /** URL base do serviço Node Playwright (`services/roster-automation`), ex. http://127.0.0.1:8790 */
  readonly VITE_ROSTER_AUTOMATION_URL?: string;
  /** Portal e-Component da GOL (padrão: https://portal-escala.voegol.com.br) */
  readonly VITE_GOL_PORTAL_URL?: string;
  /** Portal CAE da Azul (padrão: https://cae.voeazul.com.br) */
  readonly VITE_AZUL_PORTAL_URL?: string;
  /**
   * URL pública do EscalaX (origem, sem path). Obrigatória no deploy de produção (Vercel).
   * Usada em emailRedirectTo / redirectTo do Supabase Auth. Ex.: https://www.escalax.app.br
   */
  readonly VITE_APP_URL?: string;
}

declare const __ESCALAX_BUILD_ID__: string;
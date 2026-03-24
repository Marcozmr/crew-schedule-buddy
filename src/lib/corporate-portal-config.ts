/**
 * Configuração do portal corporativo (LATAM) e módulo iFlight via ENV.
 * Callback dinâmica: VITE_CORPORATE_PORTAL_RETURN_URL ou window.location.origin + /auth/corporate-callback
 * Não armazena credenciais.
 */

declare global {
  interface ImportMetaEnv {
    readonly VITE_CORPORATE_PORTAL_ENABLED?: string;
    readonly VITE_CORPORATE_PORTAL_LOGIN_URL?: string;
    readonly VITE_CORPORATE_PORTAL_RETURN_URL?: string;
    /** Se true, anexa redirect_uri ao abrir o portal (OAuth). Muitos portais corporativos não suportam. */
    readonly VITE_CORPORATE_PORTAL_APPEND_REDIRECT_URI?: string;
    readonly VITE_IFLIGHT_PROVIDER_ENABLED?: string;
    /** URL pública do módulo iFlight (abrir em nova aba; integração futura de roster). */
    readonly VITE_IFLIGHT_MODULE_URL?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

function envReturnUrl(): string {
  return (import.meta.env.VITE_CORPORATE_PORTAL_RETURN_URL ?? '').trim();
}

/** URL de login do portal (trim). Vazia = não configurada no build (.env). */
export function getResolvedLoginUrl(): string {
  return (import.meta.env.VITE_CORPORATE_PORTAL_LOGIN_URL ?? '').trim();
}

/** True quando há URL de login não vazia embutida no bundle (Vite). */
export function isLoginUrlConfigured(): boolean {
  return getResolvedLoginUrl().length > 0;
}

/**
 * “Modo teste local” = portal habilitado mas sem URL de login no ENV.
 * Não confundir com ausência de callback — callback é derivado do origin.
 */
export function isTestMode(): boolean {
  return !isLoginUrlConfigured();
}

export const corporatePortalConfig = {
  get isEnabled(): boolean {
    return import.meta.env.VITE_CORPORATE_PORTAL_ENABLED === 'true';
  },

  get enabled(): boolean {
    return this.isEnabled;
  },

  get loginUrl(): string {
    return getResolvedLoginUrl();
  },

  get returnUrl(): string {
    return envReturnUrl();
  },

  /**
   * Se true, connect() adiciona redirect_uri ao URL de login.
   * Para LATAM, costuma ser false — o usuário confirma o login manualmente no retorno.
   */
  get appendRedirectUri(): boolean {
    return import.meta.env.VITE_CORPORATE_PORTAL_APPEND_REDIRECT_URI === 'true';
  },

  get callbackUrl(): string {
    const override = envReturnUrl();
    if (override) return override;
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/auth/corporate-callback`;
    }
    return '';
  },

  /** Feature flag: portal corporativo habilitado no ENV. */
  get isConfigured(): boolean {
    return this.isEnabled;
  },

  get iflightEnabled(): boolean {
    return import.meta.env.VITE_IFLIGHT_PROVIDER_ENABLED === 'true';
  },

  /** URL do site do módulo iFlight (referência / abertura externa). */
  get iflightModuleUrl(): string {
    return (import.meta.env.VITE_IFLIGHT_MODULE_URL ?? '').trim();
  },
} as const;

if (import.meta.env.DEV) {
  console.log('Corporate portal config', {
    enabled: corporatePortalConfig.isEnabled,
    loginUrl: getResolvedLoginUrl(),
    returnUrl: corporatePortalConfig.returnUrl,
    appendRedirectUri: corporatePortalConfig.appendRedirectUri,
    isTestMode: isTestMode(),
    isLoginUrlConfigured: isLoginUrlConfigured(),
  });
}

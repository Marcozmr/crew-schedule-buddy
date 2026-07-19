import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '../../../.env') });
loadEnv({ path: path.join(__dirname, '../../.env') });

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function url(): string {
  return process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || req('SUPABASE_URL');
}

function anonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    req('SUPABASE_ANON_KEY')
  );
}

export const config = {
  /** Porta HTTP do serviço. ROSTER_AUTOMATION_PORT tem precedência sobre PORT (Railway/Render). */
  port: Number(process.env.ROSTER_AUTOMATION_PORT ?? process.env.PORT ?? 8790),
  supabaseUrl: () => url(),
  supabaseAnonKey: () => anonKey(),
  supabaseServiceRoleKey: () =>
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || req('SUPABASE_SERVICE_ROLE_KEY'),
  /** URL inicial do portal corporativo (login). */
  latamPortalLoginUrl: () => process.env.LATAM_PORTAL_LOGIN_URL?.trim() || '',
  /**
   * Portal SAB (tile iFlightNeo). Após SSO, navegação explícita reduz dependência do utilizador
   * abrir manualmente. Observado: portal.latam.com/pt/web/portalsab
   */
  latamPortalSabUrl: () =>
    process.env.LATAM_PORTAL_SAB_URL?.trim() || 'https://portal.latam.com/pt/web/portalsab',
  /**
   * Entrada direta opcional no módulo AIMS/eCrew (ex.: deep link após SSO).
   * Se vazio, o fluxo tenta descobrir um link com path /ecrew/ no portal pós-login.
   */
  latamEcredEntryUrl: () => process.env.LATAM_ECREW_ENTRY_URL?.trim() || '',
  dataDir: () => process.env.ROSTER_AUTOMATION_DATA_DIR?.trim() || path.join(process.cwd(), 'data', 'automation'),
  /**
   * Origens permitidas para pedidos do browser (health, /v1/latam/*).
   * Junta origens locais habituais (Vite, preview) com `ROSTER_AUTOMATION_CORS_ORIGINS`
   * (produção/staging — lista separada por vírgula, sem espaços obrigatórios).
   */
  corsOrigins: (): string[] => {
    const fromEnv = (process.env.ROSTER_AUTOMATION_CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const localDefaults = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ];
    return [...new Set([...localDefaults, ...fromEnv])];
  },
  headless: () => process.env.ROSTER_AUTOMATION_HEADLESS !== '0',
  /**
   * Chave AES-256-GCM para cifrar/decifrar o storageState da sessão iFlight.
   * Deve ter 64 caracteres hex (32 bytes). Gera uma aleatória em dev se ausente.
   * Em produção (Render), definir SESSION_ENCRYPTION_KEY como variável de ambiente.
   */
  sessionEncryptionKey: (): string => {
    const k = process.env.SESSION_ENCRYPTION_KEY?.trim();
    if (k && k.length === 64) return k;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_ENCRYPTION_KEY não configurada — defina 64 hex chars no Render');
    }
    // Dev: chave aleatória por processo (sessões não sobrevivem a restart, mas não quebra o build)
    return randomBytes(32).toString('hex');
  },
  /**
   * Quando `0`, desativa o fallback SAB→iFlight (por defeito está ativo).
   * Se a Rota de Ouro eCrew não gravar HTML/PDF, cai automaticamente no pipeline SAB→iFlight.
   */
  latamRosterFallbackIflight: () => process.env.LATAM_ROSTER_FALLBACK_IFLIGHT !== '0',
  /**
   * Deep link direto para o iFlight Neo (usado como fallback quando o tile SAB falha/SAML 403).
   * Pode ser sobrescrito via `LATAM_IFLIGHT_DEEP_LINK_URL`.
   */
  iflightDeepLinkUrl: () =>
    process.env.LATAM_IFLIGHT_DEEP_LINK_URL?.trim() ||
    'https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage?companyId=LA',
  /** GOL e-Component — portal de escala (login CPF/ANAC no browser). */
  golPortalUrl: () =>
    process.env.GOL_PORTAL_URL?.trim() || 'https://portal-escala.voegol.com.br',
  /** GET opcional pós-login (cookies do contexto) para PDF de escala, se a companhia expuser URL fixa. */
  golRosterPdfUrl: () => process.env.GOL_ROSTER_PDF_URL?.trim() || '',
  golPortalCpf: () => process.env.GOL_PORTAL_CPF?.trim() || '',
  golPortalAnac: () => process.env.GOL_PORTAL_ANAC?.trim() || '',
  /** Azul CAE — base do portal; MonthlySchedule pode ser composto ou sobrescrito. */
  azulCaeBaseUrl: () => process.env.AZUL_CAE_BASE_URL?.trim() || 'https://cae.voeazul.com.br',
  azulMonthlyScheduleUrl: () => process.env.AZUL_MONTHLY_SCHEDULE_URL?.trim() || '',
};

import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
  /** Porta HTTP do serviço (número; env `ROSTER_AUTOMATION_PORT`). */
  port: Number(process.env.ROSTER_AUTOMATION_PORT ?? 8790),
  supabaseUrl: () => url(),
  supabaseAnonKey: () => anonKey(),
  supabaseServiceRoleKey: () =>
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || req('SUPABASE_SERVICE_ROLE_KEY'),
  /** URL inicial do portal corporativo (login). */
  latamPortalLoginUrl: () => process.env.LATAM_PORTAL_LOGIN_URL?.trim() || '',
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
};

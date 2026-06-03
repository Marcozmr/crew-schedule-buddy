/**
 * Validação de variáveis de ambiente críticas no boot.
 * O cliente Supabase usa fallbacks para não derrubar a app; estes logs explicam o que falta no deploy.
 */

import { getConfiguredAppOrigin } from "@/lib/auth/appUrl";

export function hasRequiredSupabaseEnv(): boolean {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const key =
    String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim() ||
    String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  return Boolean(url && key);
}

export function logEnvValidationOnBoot(): void {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const publishable = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  const key = anon || publishable;

  if (!url) {
    console.error(
      '[EscalaX] VITE_SUPABASE_URL está ausente ou vazio. Defina no painel de build (ex.: Netlify/Vercel). A app inicia com URL de fallback até corrigir.',
    );
  }
  if (!key) {
    console.error(
      '[EscalaX] VITE_SUPABASE_ANON_KEY (ou VITE_SUPABASE_PUBLISHABLE_KEY) está ausente. Defina no painel de build. A app inicia com chave de fallback até corrigir.',
    );
  }

  const appOrigin = getConfiguredAppOrigin();
  if (import.meta.env.PROD && !appOrigin) {
    console.warn(
      '[EscalaX] VITE_APP_URL ausente em produção. Links de confirmação/recuperação de email podem usar apenas window.location.origin; defina https://www.escalax.app.br no host de deploy e no Supabase (Site URL + Redirect URLs).',
    );
  } else if (import.meta.env.DEV && appOrigin) {
    console.info('[EscalaX boot] VITE_APP_URL (dev override):', appOrigin);
  }

  console.log('[EscalaX boot] env ok');
}

/**
 * Validação de variáveis de ambiente críticas no boot.
 * O cliente Supabase usa fallbacks para não derrubar a app; estes logs explicam o que falta no deploy.
 */

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
}

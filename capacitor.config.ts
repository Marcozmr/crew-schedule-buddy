import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.app.escalax',
  appName: 'EscalaX',
  webDir: 'dist',
  /** Live reload nativo (dev). Web em produção: escalax.app.br — não confundir com domínio Vercel. */
  server: {
    url: 'https://702a92d6-8347-4d41-ba26-26fce7f7868e.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;

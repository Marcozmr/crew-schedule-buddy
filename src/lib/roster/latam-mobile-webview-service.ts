import { Capacitor } from '@capacitor/core';
import { LatamRosterPlugin } from '@/plugins/LatamRosterPlugin';

export interface WebViewAuthResult {
  authenticated: boolean;
  currentUrl: string;
}

/** Retorna true apenas no Android nativo com Capacitor. Sempre false no web/Vercel/PWA. */
export function isLatamWebViewAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Abre o portal LATAM em WebView controlada e aguarda o utilizador chegar ao iFlight.
 * Lança erro se cancelado ou se não estiver no Android nativo.
 */
export async function openLatamPortalWebView(): Promise<WebViewAuthResult> {
  if (!isLatamWebViewAvailable()) {
    throw new Error('WebView LATAM disponível apenas no Android nativo');
  }
  return LatamRosterPlugin.openLatamPortal();
}

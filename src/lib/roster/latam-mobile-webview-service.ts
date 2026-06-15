import { Capacitor } from '@capacitor/core';
import { LatamRosterPlugin } from '@/plugins/LatamRosterPlugin';
import { importPdfArrayBuffer, type PdfImportResult } from '@/lib/pdf-import';

export type { LatamPortalResult } from '@/plugins/LatamRosterPlugin';

export interface MobilePdfProcessResult {
  importResult: PdfImportResult;
}

/** Retorna true apenas no Android nativo com Capacitor. Sempre false no web/Vercel/PWA. */
export function isLatamWebViewAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Abre o portal LATAM em WebView controlada, espera o utilizador fazer login,
 * injeta JS para localizar/clicar "Roster Report", intercepta o download do PDF
 * e retorna o resultado bruto do plugin.
 * Lança erro se cancelado pelo utilizador.
 */
export async function openLatamPortalWebView() {
  if (!isLatamWebViewAvailable()) {
    throw new Error('WebView LATAM disponível apenas no Android nativo');
  }
  return LatamRosterPlugin.openLatamPortal();
}

/**
 * Converte o PDF em Base64 recebido do plugin nativo para ArrayBuffer
 * e chama o mesmo importador usado na importação manual.
 * Cookies nunca chegam ao frontend — são usados apenas no Kotlin para o download HTTP.
 */
export async function processMobilePdf(opts: {
  pdfBase64: string;
  fileName: string;
  userId: string;
}): Promise<PdfImportResult> {
  const { pdfBase64, fileName, userId } = opts;

  const binaryStr = atob(pdfBase64);
  const bytes = Uint8Array.from({ length: binaryStr.length }, (_, i) => binaryStr.charCodeAt(i));

  return importPdfArrayBuffer(fileName, bytes.buffer, userId);
}

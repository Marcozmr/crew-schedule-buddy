import { registerPlugin } from '@capacitor/core';

export interface LatamPortalResult {
  authenticated: boolean;
  currentUrl: string;
  pdfDownloaded: boolean;
  pdfBase64?: string;
  fileName?: string;
  pdfError?: string;
}

export interface LatamRosterPluginInterface {
  openLatamPortal(): Promise<LatamPortalResult>;
}

const LatamRosterPlugin = registerPlugin<LatamRosterPluginInterface>('LatamRosterPlugin', {
  web: () => ({
    openLatamPortal: () =>
      Promise.reject(new Error('LatamRosterPlugin disponível apenas no Android nativo')),
  }),
});

export { LatamRosterPlugin };

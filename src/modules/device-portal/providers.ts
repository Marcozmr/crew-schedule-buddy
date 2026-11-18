/**
 * Portais de escala que o app abre numa tela de navegador dentro do próprio celular.
 * A tripulante faz o login ali; o app só lê a escala depois. Ver
 * docs/superpowers/specs/2026-11-18-conexao-portal-no-aparelho-design.md.
 */

/** Requisição que devolveu o PDF da escala; guardada só no aparelho para repetir depois. */
export interface LearnedEndpoint {
  method: string;
  url: string;
  body?: string;
  contentType?: string;
}

export interface DevicePortalProvider {
  id: string;
  /** Título da tela do navegador e do card. */
  title: string;
  startUrl: string;
  /** Host do portal depois do login. */
  portalHost: RegExp;
  /** Hosts de login (SSO). Cair aqui numa sincronização = sessão expirada. */
  loginHost: RegExp;
  /** Textos dos botões a tocar, em ordem, para chegar ao PDF da escala. */
  navSteps: RegExp[];
  /** Passo a passo mostrado na página quando a navegação automática não acha os botões. */
  guideText: string;
}

export const LATAM_IFLIGHT: DevicePortalProvider = {
  id: 'latam',
  title: 'iFlight — LATAM',
  startUrl: 'https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage?companyId=LA',
  portalHost: /(^|\.)ibsplc\.aero$/i,
  loginHost: /(^|\.)(google\.com|googleusercontent\.com|microsoftonline\.com|live\.com|microsoft\.com)$/i,
  navSteps: [/roster\s*calendar|calend[aá]rio\s*do\s*elenco/i, /roster\s*report|crew\s*roster\s*report/i],
  guideText: 'Menu ≡ → Roster → Roster Calendar → Roster Report',
};

export function hostKind(provider: DevicePortalProvider, url: string): 'portal' | 'login' | 'other' {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return 'other';
  }
  if (provider.portalHost.test(host)) return 'portal';
  if (provider.loginHost.test(host)) return 'login';
  return 'other';
}

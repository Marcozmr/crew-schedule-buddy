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

/**
 * Relatório que o portal gera por formulário num iframe escondido e entrega como download
 * (o download quebra no navegador do app). O app escolhe o PDF, aperta o botão e baixa o
 * arquivo ele mesmo: POST do formulário → id do relatório → GET do arquivo.
 */
export interface PortalReport {
  /** Formulário da tela do relatório. */
  form: string;
  /** Botão que gera o relatório, dentro do formulário. */
  run: string;
  /** Escolha do PDF no escopo Angular: lista de opções, campo do modelo e id da opção. */
  format: { options: string; model: string; id: string };
  /** Endereço do POST que gera o relatório. */
  action: RegExp;
  /** Onde o id do relatório aparece na resposta do POST (grupo 1). */
  idPattern: RegExp;
  /** Endereço do arquivo; `{id}` e `{format}` são trocados. */
  download: string;
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
  /** Geração automática do relatório, quando o portal não abre o PDF sozinho. */
  report?: PortalReport;
  /** Resposta JSON da escala que a própria página carrega (preferida ao PDF: tem todos os campos). */
  rosterJson?: RegExp;
  /**
   * Pede a escala do mês direto, pelo `$http` do Angular da página (que já leva os cabeçalhos de
   * sessão do portal). Leva ~1 s depois do login, sem navegar por menus.
   */
  rosterFetch?: { url: string };
}

export const LATAM_IFLIGHT: DevicePortalProvider = {
  id: 'latam',
  title: 'iFlight — LATAM',
  startUrl: 'https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage?companyId=LA',
  portalHost: /(^|\.)ibsplc\.aero$/i,
  loginHost: /(^|\.)(google\.com|googleusercontent\.com|microsoftonline\.com|live\.com|microsoft\.com)$/i,
  navSteps: [/roster\s*calendar|calend[aá]rio\s*do\s*elenco/i, /roster\s*report|crew\s*roster\s*report/i],
  guideText: 'Menu ≡ → Roster → Roster Calendar → Roster Report',
  // Visto no portal real em 2026-11-19: Run envia `data` + `_token_` para o iframe
  // `iframeTransport`, a resposta traz <span id="reportDataId">, e o PDF sai de downloadFile.
  report: {
    form: 'form[name=rosterReportForm]',
    run: 'button[ng-click="runRosterReport()"]',
    format: { options: 'reportFormat', model: 'cWPRosterWidgetModel.outputFormat', id: 'PDF' },
    action: /\/sreports\/[^?#]*generate[^/?#]*Report$/i,
    idPattern: /id=["']reportDataId["'][^>]*>\s*([^<\s]+)/i,
    download: '/iflight-crew/web/sprout/jewels/downloadFile?reportDataId={id}&format={format}',
  },
  // A aba Roster Report carrega a escala do mês em JSON: trechos, horários, jornada, aeronave, função.
  rosterJson: /\/loadRosterReport$/i,
  // Testado no portal real em 2026-11-19: $http.post('loadRosterReport', período do mês) → 200 em ~1 s.
  // fetch direto dá 403 (faltam x-session-token / x-auth-channel, que o $http põe sozinho).
  rosterFetch: { url: 'loadRosterReport' },
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

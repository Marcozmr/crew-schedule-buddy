/**
 * Instrumentação de rede com prioridade alta para fluxo AIMS/eCrew → RosterReport.aspx.
 */
import type { BrowserContext, Page, Request, Response } from 'playwright';

export type EcrewNetworkEntry = {
  at: string;
  direction: 'request' | 'response';
  method?: string;
  url: string;
  status?: number;
  contentType?: string;
  contentDisposition?: string;
  /** URL do frame que originou o pedido (quando disponível). */
  frameUrl?: string;
  /** URL da página principal no momento do evento. */
  pageUrl?: string;
  reason: string;
};

const PRIORITY_RE =
  /ecrew|\/Reports\/|RosterReport|rosterreport|type\s*=\s*HTML|type\s*=\s*PDF|type%3dhtml|type%3dpdf|print|export|attachment/i;

function matchesPriority(url: string): boolean {
  return PRIORITY_RE.test(url) || /\.pdf(\?|#|$)/i.test(url);
}

function attachToPage(
  page: Page,
  entries: EcrewNetworkEntry[],
  getPageUrl: () => string,
): () => void {
  const onReq = (req: Request) => {
    const url = req.url();
    if (!matchesPriority(url)) return;
    let frameUrl: string | undefined;
    try {
      frameUrl = req.frame()?.url?.()?.slice(0, 2_000);
    } catch {
      frameUrl = undefined;
    }
    entries.push({
      at: new Date().toISOString(),
      direction: 'request',
      method: req.method(),
      url: url.slice(0, 2_500),
      frameUrl,
      pageUrl: getPageUrl().slice(0, 2_000),
      reason: 'ecrew_priority_keyword',
    });
  };

  const onResp = async (res: Response) => {
    const url = res.url();
    if (!matchesPriority(url)) return;
    const ct = (res.headers()['content-type'] || '').slice(0, 300);
    const cd = (res.headers()['content-disposition'] || '').slice(0, 300);
    let frameUrl: string | undefined;
    try {
      frameUrl = res.request().frame()?.url?.()?.slice(0, 2_000);
    } catch {
      frameUrl = undefined;
    }
    entries.push({
      at: new Date().toISOString(),
      direction: 'response',
      url: url.slice(0, 2_500),
      status: res.status(),
      contentType: ct,
      contentDisposition: cd,
      frameUrl,
      pageUrl: getPageUrl().slice(0, 2_000),
      reason: /RosterReport\.aspx/i.test(url)
        ? 'roster_report_response'
        : 'ecrew_priority_response',
    });
  };

  page.on('request', onReq);
  page.on('response', onResp);
  return () => {
    page.off('request', onReq);
    page.off('response', onResp);
  };
}

/**
 * Regista pedidos/respostas relevantes em todas as páginas do contexto (incluindo novas abas/popups).
 */
export function attachEcrewPriorityNetwork(context: BrowserContext, entries: EcrewNetworkEntry[]): () => void {
  const unsubs: Array<() => void> = [];

  const wire = (page: Page) => {
    unsubs.push(
      attachToPage(
        page,
        entries,
        () => {
          try {
            return page.url();
          } catch {
            return '';
          }
        },
      ),
    );
  };

  for (const p of context.pages()) {
    wire(p);
  }
  const onPage = (p: Page) => wire(p);
  context.on('page', onPage);
  unsubs.push(() => context.off('page', onPage));

  return () => {
    for (const u of unsubs) {
      try {
        u();
      } catch {
        /* ignore */
      }
    }
  };
}

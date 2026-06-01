/**
 * Interceptação de rede + registo de popups/abas para diagnóstico LATAM PDF.
 */
import type { BrowserContext, Frame, Page, Request, Response } from 'playwright';
import type { NetworkHighlight, PageEventEntry, PdfCandidate } from './latam-pdf-diagnostic-types.js';

const KEY_RE = /pdf|roster|crew|report|download|attachment|export|print|document|blob:/i;

function isHighlightUrl(url: string): boolean {
  return KEY_RE.test(url) || /\.pdf(\?|#|$)/i.test(url);
}

function isPdfContentType(ct: string): boolean {
  return /application\/pdf|application\/octet-stream/i.test(ct);
}

export function attachDiagnosticNetwork(
  page: Page,
  highlights: NetworkHighlight[],
  pdfCandidates: PdfCandidate[],
): () => void {
  const onReq = (req: Request) => {
    const url = req.url();
    if (!isHighlightUrl(url)) return;
    highlights.push({
      at: new Date().toISOString(),
      direction: 'request',
      method: req.method(),
      url: url.slice(0, 2_000),
      reason: 'keyword_or_pdf_url',
    });
  };

  const onResp = async (res: Response) => {
    const url = res.url();
    const ct = (res.headers()['content-type'] || '').slice(0, 200);
    const cd = (res.headers()['content-disposition'] || '').slice(0, 200);
    const status = res.status();

    if (isPdfContentType(ct) && res.ok()) {
      pdfCandidates.push({
        at: new Date().toISOString(),
        kind: 'response_pdf',
        detail: `status=${status} ct=${ct} url=${url.slice(0, 1_500)}`,
      });
      highlights.push({
        at: new Date().toISOString(),
        direction: 'response',
        url: url.slice(0, 2_000),
        status,
        contentType: ct,
        reason: 'application_pdf',
      });
      return;
    }

    if (/attachment/i.test(cd) && isHighlightUrl(url)) {
      pdfCandidates.push({
        at: new Date().toISOString(),
        kind: 'attachment_header',
        detail: `cd=${cd.slice(0, 120)} url=${url.slice(0, 800)}`,
      });
    }

    if (isHighlightUrl(url) || /\.pdf(\?|#|$)/i.test(url)) {
      highlights.push({
        at: new Date().toISOString(),
        direction: 'response',
        url: url.slice(0, 2_000),
        status,
        contentType: ct,
        reason: 'keyword_or_pdf_path',
      });
    }
  };

  page.on('request', onReq);
  page.on('response', onResp);
  return () => {
    page.off('request', onReq);
    page.off('response', onResp);
  };
}

export function attachContextPageTracking(context: BrowserContext, events: PageEventEntry[]): () => void {
  const onPage = (p: Page) => {
    events.push({
      at: new Date().toISOString(),
      kind: 'context_page_added',
      url: p.url().slice(0, 2_000),
    });
  };
  context.on('page', onPage);
  return () => context.off('page', onPage);
}

export function attachPopupTracking(page: Page, events: PageEventEntry[]): () => void {
  const onPopup = (p: Page) => {
    events.push({
      at: new Date().toISOString(),
      kind: 'popup',
      url: p.url().slice(0, 2_000),
    });
  };
  page.on('popup', onPopup);
  return () => page.off('popup', onPopup);
}

export function attachMainFrameNav(page: Page, events: PageEventEntry[]): () => void {
  const handler = () => {
    events.push({
      at: new Date().toISOString(),
      kind: 'main_nav',
      url: page.url().slice(0, 2_000),
    });
  };
  const onFrame = (frame: Frame) => {
    if (frame === page.mainFrame()) handler();
  };
  page.on('framenavigated', onFrame);
  return () => page.off('framenavigated', onFrame);
}

/** Regista mensagens de consola que mencionem blob: ou erros de rede. */
export function attachConsoleBlobHints(page: Page, pdfCandidates: PdfCandidate[]): () => void {
  const onConsole = (msg: { text: () => string; type: () => string }) => {
    const t = msg.text();
    if (/blob:|createObjectURL|pdf/i.test(t)) {
      pdfCandidates.push({
        at: new Date().toISOString(),
        kind: 'blob_hint',
        detail: t.slice(0, 500),
      });
    }
  };
  page.on('console', onConsole);
  return () => page.off('console', onConsole);
}

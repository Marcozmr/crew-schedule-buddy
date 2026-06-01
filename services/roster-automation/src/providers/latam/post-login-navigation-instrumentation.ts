/**
 * Descoberta observável pós-login: rede, popups, frames, downloads, superfície.
 * Objetivo: tornar a rota LATAM → SAB → iFlight → report determinística via logs + snapshot.
 */
import type { BrowserContext, Download, Frame, Page, Request, Response } from 'playwright';
import { detectCorporateSurface } from './surface-detector.js';
import { saveFailureArtifacts } from '../../artifacts.js';

export type InstrumentAppendLog = (entry: Record<string, unknown>) => void | Promise<void>;

const RING_MAX = 120;

/** URL ou tipo de recurso potencialmente relevante ao relatório / PDF. */
export function isReportOrPdfRelevantUrl(url: string): boolean {
  return /roster|crewroster|crew\s*roster|report|pdf|export|print|document|schedule|calendar|pairing|iflight|ibsplc|sab|neo|latam|generate|download|blob:/i.test(
    url,
  );
}

function isPdfResponse(res: Response): boolean {
  const ct = (res.headers()['content-type'] || '').toLowerCase();
  if (ct.includes('application/pdf')) return true;
  const u = res.url();
  return /\.pdf(\?|#|$)/i.test(u) && res.ok();
}

export interface NetworkRingEntry {
  at: string;
  method?: string;
  url: string;
  resourceType?: string;
}

export interface ResponseRingEntry {
  at: string;
  url: string;
  status: number;
  contentType?: string;
}

export interface NavigationDebugPayload {
  at: string;
  current_url?: string;
  current_host?: string;
  current_path?: string;
  page_title?: string;
  detected_surface?: string;
  frames?: Array<{ name: string; url: string; isMain: boolean }>;
  popup_urls?: string[];
  last_requests?: NetworkRingEntry[];
  last_responses?: ResponseRingEntry[];
  viewport_clickables_sample?: string[];
  /** Últimos endpoints candidatos a export (GET/POST com path relevante). */
  report_endpoint_candidates?: Array<{ method: string; url: string; status?: number }>;
}

export class PostLoginNavigationInstrument {
  private requestRing: NetworkRingEntry[] = [];
  private responseRing: ResponseRingEntry[] = [];
  private reportCandidates: Array<{ method: string; url: string; status?: number }> = [];
  private popupUrls: string[] = [];
  private lastHost = '';
  private unsub: Array<() => void> = [];
  private attachedPages = new WeakSet<Page>();

  /** Regista pedido/resposta relevantes + candidatos a relatório. */
  private onRequest(req: Request, appendLog: InstrumentAppendLog): void {
    const url = req.url();
    const method = req.method();
    const resourceType = req.resourceType();
    if (!isReportOrPdfRelevantUrl(url) && resourceType !== 'document') return;

    const entry: NetworkRingEntry = {
      at: new Date().toISOString(),
      method,
      url: url.slice(0, 2_000),
      resourceType,
    };
    if (this.requestRing.length >= RING_MAX) this.requestRing.shift();
    this.requestRing.push(entry);

    if (isReportOrPdfRelevantUrl(url)) {
      void appendLog({
        step: 'request_report_candidate',
        method,
        url: url.slice(0, 1_500),
        resourceType,
      });
      const last = this.reportCandidates[this.reportCandidates.length - 1];
      if (!last || last.url !== url) {
        this.reportCandidates.push({ method, url: url.slice(0, 2_000) });
        if (this.reportCandidates.length > 40) this.reportCandidates.shift();
      }
    }
  }

  private async onResponse(res: Response, appendLog: InstrumentAppendLog): Promise<void> {
    const url = res.url();
    const status = res.status();
    const ct = res.headers()['content-type'] || '';
    if (this.responseRing.length >= RING_MAX) this.responseRing.shift();
    this.responseRing.push({
      at: new Date().toISOString(),
      url: url.slice(0, 2_000),
      status,
      contentType: ct.slice(0, 200),
    });

    if (isPdfResponse(res)) {
      void appendLog({
        step: 'response_pdf_candidate',
        url: url.slice(0, 1_500),
        status,
        contentType: ct.slice(0, 120),
      });
    } else if (isReportOrPdfRelevantUrl(url) && status < 500) {
      void appendLog({
        step: 'response_report_candidate',
        url: url.slice(0, 1_500),
        status,
        contentType: ct.slice(0, 120),
      });
    }

    const cand = this.reportCandidates.find((c) => c.url === url);
    if (cand) cand.status = status;
  }

  private async onFrameNavigated(frame: Frame, page: Page, appendLog: InstrumentAppendLog): Promise<void> {
    if (frame !== page.mainFrame()) {
      void appendLog({
        step: 'iframe_navigated',
        frameUrl: frame.url().slice(0, 1_500),
        frameName: frame.name(),
      });
      return;
    }
    const url = page.url();
    try {
      const u = new URL(url);
      const host = u.hostname;
      if (host !== this.lastHost) {
        this.lastHost = host;
        void appendLog({
          step: 'host_changed',
          host,
          path: u.pathname.slice(0, 400),
        });
      }
      const det = await detectCorporateSurface(page).catch(() => null);
      void appendLog({
        step: 'surface_detected',
        url: url.slice(0, 1_000),
        surface: det?.surface ?? 'unknown',
        title: det?.title?.slice(0, 200),
      });
    } catch {
      void appendLog({ step: 'framenavigated', url: url.slice(0, 1_000) });
    }
  }

  attachToPage(page: Page, appendLog: InstrumentAppendLog): void {
    if (this.attachedPages.has(page)) return;
    this.attachedPages.add(page);

    const onReq = (req: Request) => this.onRequest(req, appendLog);
    const onResp = (res: Response) => void this.onResponse(res, appendLog);
    const onDownload = (dl: Download) => {
      void appendLog({
        step: 'download_started',
        suggestedFilename: dl.suggestedFilename(),
        url: dl.url().slice(0, 800),
      });
    };
    const onPopup = (popup: Page) => {
      const u = popup.url();
      this.popupUrls.push(u.slice(0, 1_500));
      if (this.popupUrls.length > 20) this.popupUrls.shift();
      void appendLog({ step: 'popup_opened', url: u.slice(0, 1_500) });
      this.attachToPage(popup, appendLog);
    };
    const onFrame = (frame: Frame) => void this.onFrameNavigated(frame, page, appendLog);

    page.on('request', onReq);
    page.on('response', onResp);
    page.on('download', onDownload);
    page.on('popup', onPopup);
    page.on('framenavigated', onFrame);

    this.unsub.push(() => {
      page.off('request', onReq);
      page.off('response', onResp);
      page.off('download', onDownload);
      page.off('popup', onPopup);
      page.off('framenavigated', onFrame);
    });
  }

  /** Liga a todas as páginas atuais e a futuras (popup / nova aba). */
  attachToBrowserContext(context: BrowserContext, appendLog: InstrumentAppendLog): void {
    for (const p of context.pages()) {
      this.attachToPage(p, appendLog);
    }
    const onNew = (page: Page) => {
      void appendLog({
        step: 'context_new_page',
        url: page.url().slice(0, 1_000),
      });
      this.attachToPage(page, appendLog);
    };
    context.on('page', onNew);
    this.unsub.push(() => context.off('page', onNew));
  }

  dispose(): void {
    for (const u of this.unsub) {
      try {
        u();
      } catch {
        /* ignore */
      }
    }
    this.unsub = [];
  }

  getNavigationDebugPayload(page: Page): NavigationDebugPayload {
    const url = page.url();
    let host = '';
    let path = '';
    try {
      const u = new URL(url);
      host = u.hostname;
      path = u.pathname;
    } catch {
      /* empty */
    }
    return {
      at: new Date().toISOString(),
      current_url: url.slice(0, 2_000),
      current_host: host,
      current_path: path.slice(0, 800),
      last_requests: [...this.requestRing].slice(-40),
      last_responses: [...this.responseRing].slice(-40),
      popup_urls: [...this.popupUrls],
      report_endpoint_candidates: [...this.reportCandidates].slice(-25),
    };
  }

  /** Snapshot rico para orchestration_snapshot.navigation_debug (passo importante ou falha). */
  async buildTechnicalSnapshot(page: Page, label: string, appendLog: InstrumentAppendLog): Promise<NavigationDebugPayload> {
    const base = this.getNavigationDebugPayload(page);
    let title = '';
    try {
      title = await page.title();
    } catch {
      title = '';
    }
    const frames: NavigationDebugPayload['frames'] = [];
    for (const f of page.frames()) {
      try {
        frames.push({ name: f.name() || '', url: f.url().slice(0, 1_000), isMain: f === page.mainFrame() });
      } catch {
        /* skip */
      }
    }
    let detected_surface = 'unknown';
    try {
      detected_surface = (await detectCorporateSurface(page)).surface;
    } catch {
      /* empty */
    }

    let viewport_clickables_sample: string[] = [];
    try {
      viewport_clickables_sample = await page.evaluate(() => {
        const out: string[] = [];
        const nodes = Array.from(
          document.querySelectorAll('a[href], button, [role="button"], [role="link"]'),
        ).slice(0, 35);
        for (const el of nodes) {
          const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70);
          const href = (el as HTMLAnchorElement).href || '';
          out.push(txt + (href ? ` | ${href.slice(0, 120)}` : ''));
        }
        return out;
      });
    } catch {
      viewport_clickables_sample = [];
    }

    const payload: NavigationDebugPayload = {
      ...base,
      page_title: title.slice(0, 300),
      detected_surface,
      frames: frames.slice(0, 30),
      viewport_clickables_sample,
    };

    void appendLog({
      step: 'navigation_technical_snapshot',
      label,
      ...payload,
    });

    return payload;
  }

  /**
   * Quando o fluxo falha ou fica ambíguo: screenshot + HTML + snapshot técnico.
   */
  async emitStuckEvidence(
    page: Page,
    failDir: string,
    tag: string,
    appendLog: InstrumentAppendLog,
  ): Promise<void> {
    const snap = await this.buildTechnicalSnapshot(page, `stuck_${tag}`, appendLog);
    const art = await saveFailureArtifacts(page, failDir, `evidence-${tag}`);
    void appendLog({
      step: 'stuck_evidence',
      tag,
      screenshotPath: art.screenshotPath,
      htmlPath: art.htmlPath,
      navigation_debug: snap,
    });
  }
}

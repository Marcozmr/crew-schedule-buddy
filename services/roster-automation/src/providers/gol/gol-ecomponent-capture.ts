/**
 * GOL portal-escala (e-Component): prioridade GET autenticado e interceção de respostas PDF;
 * fallback: nova aba / link após CPF+ANAC (se configurados).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page, Response } from 'playwright';
import { config } from '../../config.js';

export type GolAppendLog = (entry: Record<string, unknown>) => Promise<void>;

export async function runGolEcomponentCapture(
  page: Page,
  context: BrowserContext,
  outDir: string,
  appendLog: GolAppendLog,
): Promise<{ pdfPath: string | null }> {
  await fs.mkdir(outDir, { recursive: true });

  const direct = config.golRosterPdfUrl();
  if (direct) {
    await appendLog({ step: 'gol_network', phase: 'direct_get', url: direct.slice(0, 600) });
    try {
      const res = await context.request.get(direct, { timeout: 90_000, failOnStatusCode: false });
      const body = Buffer.from(await res.body());
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      if (res.ok() && (ct.includes('pdf') || body.slice(0, 4).toString('ascii') === '%PDF') && body.length > 200) {
        const p = path.join(outDir, `GOL-Roster-${Date.now()}.pdf`);
        await fs.writeFile(p, body);
        await appendLog({ step: 'gol_network', phase: 'direct_ok', path: p, bytes: body.length });
        return { pdfPath: p };
      }
    } catch (e) {
      await appendLog({ step: 'gol_network', phase: 'direct_error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  const hits: string[] = [];
  const considerPdf = async (res: Response) => {
    if (!res.ok()) return;
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    const url = res.url();
    if (!ct.includes('pdf') && !url.toLowerCase().includes('.pdf')) return;
    try {
      const b = Buffer.from(await res.body());
      if (b.length < 200 || b.slice(0, 4).toString('ascii') !== '%PDF') return;
      const fp = path.join(outDir, `GOL-net-${Date.now()}-${hits.length}.pdf`);
      await fs.writeFile(fp, b);
      hits.push(fp);
      await appendLog({ step: 'gol_network', phase: 'response_pdf', url: url.slice(0, 800), bytes: b.length });
    } catch {
      /* ignore */
    }
  };

  const wire = (p: Page) => p.on('response', (r) => void considerPdf(r));
  wire(page);
  context.on('page', (p) => wire(p));

  const cpf = config.golPortalCpf();
  const anac = config.golPortalAnac();
  if (cpf && anac) {
    await appendLog({ step: 'gol_form', phase: 'fill_cpf_anac' });
    await page.locator('input').first().waitFor({ state: 'visible', timeout: 45_000 }).catch(() => {});
    await page.evaluate(
      ({ c, a }) => {
        const inputs = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type]), input[type="tel"], input[type="password"]'),
        );
        if (inputs[0]) {
          inputs[0].value = c;
          inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (inputs[1]) {
          inputs[1].value = a;
          inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      { c: cpf, a: anac },
    );
    await page.getByRole('button', { name: /entrar|acessar|login|ok|continuar/i }).first().click({ timeout: 20_000 }).catch(() => {});
  }

  await page.waitForTimeout(6_000);

  const popupWait = context.waitForEvent('page', { timeout: 45_000 }).catch(() => null);
  await page.getByRole('link', { name: /escala|roster|grade|pdf|download|baixar/i }).first().click({ timeout: 25_000 }).catch(() => {});
  const pop = await popupWait;
  if (pop) {
    await pop.waitForLoadState('domcontentloaded').catch(() => {});
    await appendLog({ step: 'gol_popup', url: pop.url().slice(0, 800) });
  }

  await page.waitForTimeout(5_000);

  if (hits[0]) return { pdfPath: hits[0] };
  return { pdfPath: null };
}

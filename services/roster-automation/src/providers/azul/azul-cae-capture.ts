/**
 * Azul CAE: GET autenticado a MonthlySchedule (ou URL explícita) + fallback iframe.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import { config } from '../../config.js';

export type AzulAppendLog = (entry: Record<string, unknown>) => Promise<void>;

export async function runAzulCaeCapture(
  page: Page,
  outDir: string,
  appendLog: AzulAppendLog,
): Promise<{ pdfPath: string | null; htmlPath: string | null }> {
  await fs.mkdir(outDir, { recursive: true });

  const base = config.azulCaeBaseUrl();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await appendLog({ step: 'azul_portal', url: page.url().slice(0, 800) });

  const explicit = config.azulMonthlyScheduleUrl();
  let tryUrl = explicit;
  if (!tryUrl) {
    try {
      const u = new URL(page.url());
      tryUrl = `${u.origin}/MonthlySchedule.aspx`;
    } catch {
      tryUrl = '';
    }
  }

  if (tryUrl) {
    await appendLog({ step: 'azul_network', phase: 'request', url: tryUrl.slice(0, 800) });
    const res = await page.context().request.get(tryUrl, { timeout: 90_000, failOnStatusCode: false });
    if (res.ok()) {
      const body = Buffer.from(await res.body());
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      if (ct.includes('pdf') || body.slice(0, 4).toString('ascii') === '%PDF') {
        const p = path.join(outDir, `Azul-Monthly-${Date.now()}.pdf`);
        await fs.writeFile(p, body);
        await appendLog({ step: 'azul_network', phase: 'pdf_saved', path: p });
        return { pdfPath: p, htmlPath: null };
      }
      const head = body.toString('utf8', 0, Math.min(500, body.length));
      if (ct.includes('html') || head.includes('<')) {
        const p = path.join(outDir, `Azul-Monthly-${Date.now()}.html`);
        await fs.writeFile(p, body);
        await appendLog({ step: 'azul_network', phase: 'html_saved', path: p });
        return { pdfPath: null, htmlPath: p };
      }
    }
  }

  const fl = page.frameLocator('iframe').first();
  const inner = await fl.locator('body').innerHTML({ timeout: 20_000 }).catch(() => '');
  if (inner.length > 80) {
    const p = path.join(outDir, `Azul-iframe-${Date.now()}.html`);
    await fs.writeFile(p, inner, 'utf8');
    await appendLog({ step: 'azul_iframe', phase: 'body_saved', path: p });
    return { pdfPath: null, htmlPath: p };
  }

  return { pdfPath: null, htmlPath: null };
}

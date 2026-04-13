import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import { log } from './logger.js';

export async function saveFailureArtifacts(
  page: Page | null,
  baseDir: string,
  label: string,
): Promise<{ screenshotPath?: string; htmlPath?: string }> {
  await fs.mkdir(baseDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out: { screenshotPath?: string; htmlPath?: string } = {};
  try {
    if (page) {
      const shot = path.join(baseDir, `${label}-${stamp}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      out.screenshotPath = shot;
      const html = path.join(baseDir, `${label}-${stamp}.html`);
      const content = await page.content();
      await fs.writeFile(html, content, 'utf8');
      out.htmlPath = html;
    }
  } catch (e) {
    log('artifacts', 'warn', 'saveFailureArtifacts_partial', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return out;
}

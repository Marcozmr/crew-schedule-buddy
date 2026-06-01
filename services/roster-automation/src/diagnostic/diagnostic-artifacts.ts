import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function screenshotStep(page: Page, outDir: string, stepSlug: string, list: string[]): Promise<string> {
  const safe = stepSlug.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80);
  const file = path.join(outDir, `${stamp()}_${safe}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true });
    list.push(file);
    return file;
  } catch (e) {
    const err = path.join(outDir, `${stamp()}_${safe}_ERROR.txt`);
    await fs.writeFile(err, e instanceof Error ? e.message : String(e), 'utf8');
    return err;
  }
}

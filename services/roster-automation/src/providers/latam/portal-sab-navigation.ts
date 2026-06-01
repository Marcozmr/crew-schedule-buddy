/**
 * Navegação funcional explícita para o Portal SAB após autenticação.
 */
import type { Page } from 'playwright';
import { detectCorporateSurface } from './surface-detector.js';

export type SabNavLog = (entry: Record<string, unknown>) => Promise<void>;

/**
 * Garante superfície do Portal SAB antes de procurar o tile iFlightNeo.
 * Se já estiver em SAB ou iFlight, não recarrega.
 */
export async function ensurePortalSabSurface(page: Page, sabUrl: string, appendLog: SabNavLog): Promise<void> {
  const before = await detectCorporateSurface(page);
  if (
    before.surface === 'portal_sab_home' ||
    before.surface === 'iflight_home' ||
    before.surface === 'iflight_roster_calendar' ||
    before.surface === 'iflight_roster_report'
  ) {
    await appendLog({
      step: 'nav_portal_sab',
      skipped: true,
      surface: before.surface,
      url: before.url,
    });
    return;
  }

  await appendLog({
    step: 'nav_portal_sab',
    phase: 'goto',
    url: sabUrl,
    fromSurface: before.surface,
  });
  await page.goto(sabUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForTimeout(2_500);

  const after = await detectCorporateSurface(page);
  await appendLog({
    step: 'nav_portal_sab',
    phase: 'after_goto',
    surface: after.surface,
    url: after.url,
  });
}

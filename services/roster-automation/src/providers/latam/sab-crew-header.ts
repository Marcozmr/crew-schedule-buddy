/**
 * Portal SAB: abrir contexto do tripulante (nome / avatar / menu no topo)
 * antes de lançar apps (iFlightNeo).
 */
import type { Page } from 'playwright';

export type SabLogFn = (entry: Record<string, unknown>) => Promise<void>;

const HEADER_SELECTORS = [
  'header',
  '[role="banner"]',
  '[class*="AppHeader" i]',
  '[class*="app-bar" i]',
  '[class*="topbar" i]',
  '[class*="TopBar" i]',
  'nav[class*="header" i]',
];

export async function clickSabCrewHeaderContext(page: Page, appendLog: SabLogFn): Promise<boolean> {
  const beforeUrl = page.url();
  const beforeText = await page.locator('body').innerText({ timeout: 8_000 }).catch(() => '');
  await appendLog({
    step: 'sab_crew_header',
    phase: 'before',
    url: beforeUrl,
    bodySample: beforeText.slice(0, 120),
  });

  let header = page.locator(HEADER_SELECTORS.join(', ')).first();
  if ((await header.count()) === 0) {
    header = page.locator('body');
  }

  const attempts: Array<{ name: string; ok: boolean; detail?: string }> = [];

  const tryClick = async (name: string, fn: () => Promise<boolean>) => {
    try {
      const ok = await fn();
      attempts.push({ name, ok });
      return ok;
    } catch (e) {
      attempts.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };

  await tryClick('avatar_image', async () => {
    const av = header
      .locator(
        '[class*="avatar" i], [class*="Avatar" i], img[alt*="avatar" i], img[alt*="perfil" i], [data-testid*="avatar" i]',
      )
      .first();
    if ((await av.count()) === 0) return false;
    await av.scrollIntoViewIfNeeded().catch(() => {});
    await av.click({ timeout: 15_000 });
    await page.waitForTimeout(1_200);
    return true;
  });

  await tryClick('header_menu_button', async () => {
    const menuBtn = header.getByRole('button', { name: /menu|mais|opções|account|perfil|profile|user/i }).first();
    if ((await menuBtn.count()) === 0) return false;
    await menuBtn.click({ timeout: 12_000 });
    await page.waitForTimeout(1_000);
    return true;
  });

  await tryClick('crew_name_chip', async () => {
    const nameLink = header
      .locator('button, a, [role="button"], [tabindex="0"]')
      .filter({ hasText: /^[A-ZÁÉÍÓÚÃÕÇ][a-záéíóúãõç]+\s+[A-ZÁÉÍÓÚÃÕÇ]/ })
      .first();
    if ((await nameLink.count()) === 0) return false;
    const txt = await nameLink.innerText({ timeout: 3_000 }).catch(() => '');
    if (txt.length >= 80 || txt.length <= 3) return false;
    await nameLink.click({ timeout: 12_000 });
    await page.waitForTimeout(1_000);
    return true;
  });

  await tryClick('profile_labeled', async () => {
    const prof = header.getByRole('button', { name: /perfil|conta|minha\s+conta|meu\s+perfil|profile/i }).first();
    if ((await prof.count()) === 0) return false;
    await prof.click({ timeout: 12_000 });
    await page.waitForTimeout(1_000);
    return true;
  });

  const afterUrl = page.url();
  const afterText = await page.locator('body').innerText({ timeout: 8_000 }).catch(() => '');
  const menuPossiblyOpened =
    afterText.length > beforeText.length + 20 ||
    /menu|aplicativos|apps|sair|logout|configura|prefer|minha\s+conta/i.test(afterText);

  await appendLog({
    step: 'sab_crew_header',
    phase: 'after',
    urlBefore: beforeUrl,
    urlAfter: afterUrl,
    urlChanged: beforeUrl !== afterUrl,
    menuPossiblyOpened,
    attempts,
    bodySampleAfter: afterText.slice(0, 220),
  });

  return attempts.some((a) => a.ok);
}

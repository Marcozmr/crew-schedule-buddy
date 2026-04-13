/**
 * Seletores e resolução de frames partilhados entre o pipeline SAB/iFlight e o launcher.
 */
import type { Frame, Locator, Page } from 'playwright';

export type LocatorRoot = Page | Frame;

/** iFlightNeo no portal real: variações de texto/atributo (tile costuma ser div, não <a>). */
export const IFIGHT_NEO_TEXT_PATTERNS: RegExp[] = [
  /iFlightNeo/i,
  /iFlight\s*Neo/i,
  /IFlight\s*Neo/i,
  /^iFlightNeo$/i,
  /iFlight\s*NEO/i,
];

export async function findIFlightNeoTile(page: Page): Promise<Locator | null> {
  const roles = ['button', 'link'] as const;
  for (const re of IFIGHT_NEO_TEXT_PATTERNS) {
    for (const role of roles) {
      const loc = page.getByRole(role, { name: re });
      if ((await loc.count()) > 0) return loc.first();
    }
  }
  for (const re of IFIGHT_NEO_TEXT_PATTERNS) {
    const loc = page.getByText(re, { exact: false });
    if ((await loc.count()) > 0) return loc.first();
  }
  const cssCandidates = [
    '[data-testid*="iflight" i]',
    '[data-test*="iflight" i]',
    '[aria-label*="iflight" i]',
    '[title*="iflight" i]',
  ];
  for (const sel of cssCandidates) {
    const loc = page.locator(sel).filter({ hasText: /iFlight/i });
    if ((await loc.count()) > 0) return loc.first();
  }
  const broad = page
    .locator('a, button, [role="button"], div[tabindex="0"], div[class*="tile" i], article, section')
    .filter({ hasText: /iFlightNeo|iFlight\s*Neo/i });
  if ((await broad.count()) > 0) return broad.first();

  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    for (const re of IFIGHT_NEO_TEXT_PATTERNS) {
      const loc = frame.getByText(re, { exact: false });
      if ((await loc.count()) > 0) return loc.first();
    }
  }
  return null;
}

export async function pickIFlightFrame(page: Page): Promise<Frame | null> {
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    const u = f.url();
    if (/iflight|neo|crew|sabapp|latam/i.test(u)) return f;
    const snippet = await f.locator('body').innerText({ timeout: 4_000 }).catch(() => '');
    if (/iFlight|CrewRoster|crew roster|minha escala/i.test(snippet)) return f;
  }
  return null;
}

export async function pickRosterRoot(page: Page): Promise<LocatorRoot> {
  const frame = await pickIFlightFrame(page);
  return frame ?? page;
}

/**
 * Seletores e resolução de frames partilhados entre o pipeline SAB/iFlight e o launcher.
 */
import type { Frame, Locator, Page } from 'playwright';

export type LocatorRoot = Page | Frame;

/**
 * iFlightNeo no portal real: variações de texto/atributo em ordem decrescente de especificidade.
 * Inclui variações "iFlight", "eCrew", "e-Crew" para portais que não exibem "Neo" explicitamente.
 */
export const IFIGHT_NEO_TEXT_PATTERNS: RegExp[] = [
  /iFlightNeo/i,
  /iFlight\s*Neo/i,
  /IFlight\s*Neo/i,
  /^iFlightNeo$/i,
  /iFlight\s*NEO/i,
  /iFlight/i,
  /eCrew/i,
  /e-Crew/i,
];

/** Padrões mais amplos usados como último recurso (texto muito genérico). */
const IFLIGHT_LAST_RESORT_PATTERNS: RegExp[] = [
  /\bCrew\b/,
  /\bEscala\b/i,
  /\bRoster\b/i,
  /\bSchedule\b/i,
];

export async function findIFlightNeoTile(page: Page): Promise<Locator | null> {
  const roles = ['button', 'link'] as const;

  // 1) Role-based match (mais semântico e estável)
  for (const re of IFIGHT_NEO_TEXT_PATTERNS) {
    for (const role of roles) {
      const loc = page.getByRole(role, { name: re });
      if ((await loc.count()) > 0) return loc.first();
    }
  }

  // 2) Texto visível (qualquer elemento)
  for (const re of IFIGHT_NEO_TEXT_PATTERNS) {
    const loc = page.getByText(re, { exact: false });
    if ((await loc.count()) > 0) return loc.first();
  }

  // 3) Atributos data-* e aria-label
  const cssCandidates = [
    '[data-testid*="iflight" i]',
    '[data-test*="iflight" i]',
    '[aria-label*="iflight" i]',
    '[title*="iflight" i]',
    '[data-testid*="ecrew" i]',
    '[data-test*="ecrew" i]',
    '[aria-label*="ecrew" i]',
    '[title*="ecrew" i]',
  ];
  for (const sel of cssCandidates) {
    const loc = page.locator(sel);
    if ((await loc.count()) > 0) return loc.first();
  }

  // 4) Tiles/containers interativos com texto iFlight/eCrew
  const broad = page
    .locator('a, button, [role="button"], div[tabindex="0"], div[class*="tile" i], li[class*="tile" i], article, section')
    .filter({ hasText: /iFlightNeo|iFlight\s*Neo|iFlight|eCrew|e-Crew/i });
  if ((await broad.count()) > 0) return broad.first();

  // 5) Frames internos (portal renderizado em iframe)
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    for (const re of IFIGHT_NEO_TEXT_PATTERNS) {
      const loc = frame.getByText(re, { exact: false });
      if ((await loc.count()) > 0) return loc.first();
    }
    const broadFrame = frame
      .locator('a, button, [role="button"], div[tabindex="0"], div[class*="tile" i]')
      .filter({ hasText: /iFlightNeo|iFlight\s*Neo|iFlight|eCrew/i });
    if ((await broadFrame.count()) > 0) return broadFrame.first();
  }

  // 6) Último recurso: texto genérico "Crew", "Escala", "Roster", "Schedule"
  //    Usa contexto de tile para reduzir falsos positivos
  for (const re of IFLIGHT_LAST_RESORT_PATTERNS) {
    const loc = page
      .locator('a[href], button, [role="button"], div[tabindex="0"], div[class*="tile" i], li, article')
      .filter({ hasText: re });
    if ((await loc.count()) > 0) return loc.first();
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

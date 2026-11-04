import { describe, expect, it } from 'vitest';
import { readCalendarPosition } from './navigation.js';
import { looksLikeRosterScreen, runSabToCrewRosterPdf } from './sab-iflight-pipeline.js';

// Texto real da Home do iFlight, capturado em step_logs (matrícula trocada).
const IFLIGHT_HOME = `Home
Profile
Swap
Roster
Alert History
Airport
Welcome 00000000
[CREW]

13-Jul-2026 – 02-Aug-2026
23-Jul-2026 17:15UTC

Copyright © 2026 IBS Software Pvt. Ltd. All Rights Reserved.`;

describe('readCalendarPosition', () => {
  it('lê o período do iFlight e reconhece mês dentro do intervalo', () => {
    expect(readCalendarPosition(IFLIGHT_HOME, '2026-08')).toEqual({ current: '2026-07', reached: true });
  });

  it('indica que falta navegar quando o mês está fora do período', () => {
    expect(readCalendarPosition(IFLIGHT_HOME, '2026-05')).toEqual({ current: '2026-07', reached: false });
  });

  it('entende período com mês em português', () => {
    expect(readCalendarPosition('27-Abr-2026 – 17-Mai-2026', '2026-05')).toEqual({ current: '2026-04', reached: true });
  });

  it('continua lendo mês escrito por extenso', () => {
    expect(readCalendarPosition('Calendário do Elenco março de 2026', '2026-03')).toEqual({
      current: '2026-03',
      reached: true,
    });
  });

  it('não confunde o relógio do rodapé com um período', () => {
    expect(readCalendarPosition('23-Jul-2026 17:15UTC', '2026-07')).toBeNull();
  });
});

describe('looksLikeRosterScreen', () => {
  it('não trata a Home do iFlight como tela de escala', () => {
    expect(looksLikeRosterScreen(IFLIGHT_HOME)).toBe(false);
  });

  it('reconhece o calendário que openCrewRosterCalendar abre', () => {
    expect(looksLikeRosterScreen('Roster Calendar\nJul 2026')).toBe(true);
    expect(looksLikeRosterScreen('Calendário do Elenco')).toBe(true);
  });

  it('reconhece voo LATAM com prefixo atual', () => {
    expect(looksLikeRosterScreen('14 Jul  LA3218  GRU  BSB')).toBe(true);
  });

  it('mantém o prefixo JJ antigo', () => {
    expect(looksLikeRosterScreen('14 Jul  JJ3218  GRU  BSB')).toBe(true);
  });
});

describe('runSabToCrewRosterPdf', () => {
  it('falha logo quando já está no iFlight, sem esperar pelo portal SAB', async () => {
    const steps: string[] = [];
    const page = {
      url: () => 'https://iflightla.ibsplc.aero/iflight-crew/web/home',
      title: async () => 'iFlight',
      locator: () => ({ innerText: async () => IFLIGHT_HOME }),
    };

    await expect(
      runSabToCrewRosterPdf({
        context: {} as never,
        page: page as never,
        userId: 'usuario',
        runId: 'execucao',
        failDir: 'falhas',
        appendLog: async (entry) => {
          steps.push(String(entry.step));
        },
      }),
    ).rejects.toThrow(/tela da escala/i);

    expect(steps).toContain('sab_unreachable');
    expect(steps).not.toContain('sab_surface_wait');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }));

import { buildIflightJsonImport } from './pdf-import';

function report(stamp: string) {
  return {
    model: {
      cWPRosterWidgetModel: {
        cWPRosterReportSearchDTO: { periodFromDate: '2026-11-01T00:00:00.000', periodToDate: '2026-11-30T00:00:00.000' },
        cWPCrewRosterDayReportDTO: [
          {
            timeStamp: stamp,
            allocationDate: '2026-11-07T08:51:00.000',
            complementRank: 'CC',
            itemCode: 'DO',
            description: 'Day off',
            reportTime: '08:51',
            departureStation: 'BSB 08:51',
            departureTime: '08:51',
            arrivalStation: 'BSB 08:50(+1)',
            arrivalTime: '08:50(+1)',
          },
        ],
      },
    },
  };
}

describe('buildIflightJsonImport', () => {
  it('nome do arquivo com o período e escala já lida pelo leitor do iFlight', () => {
    const r = buildIflightJsonImport(report('2026-11-19T10:00:00'));
    expect(r.fileName).toBe('iflight-escala-2026-11-01_2026-11-30.json');
    expect(r.preparsed.parserVersion).toBe('IFLIGHT_JSON_V1');
    expect(r.preparsed.entries).toHaveLength(1);
    expect(r.preparsed.header).toMatchObject({ rosterStartDate: '2026-11-01', rosterEndDate: '2026-11-30', crewRole: 'CC' });
  });

  it('mesma escala lida em horas diferentes gera o mesmo conteúdo (vira "já atualizada")', () => {
    const a = buildIflightJsonImport(report('2026-11-19T10:00:00'));
    const b = buildIflightJsonImport(report('2026-11-19T13:00:00'));
    expect(new Uint8Array(a.bytes)).toEqual(new Uint8Array(b.bytes));
  });
});

import { describe, expect, it } from 'vitest';
import { IFLIGHT_JSON_PARSER_VERSION, parseIflightRosterReport } from './iflight-roster-json';

/** Mesma estrutura do `loadRosterReport` do iFlight (dados inventados). */
function report(rows: Array<Record<string, unknown>>) {
  return {
    title: 'Roster Report',
    model: {
      cWPRosterWidgetModel: {
        cWPRosterReportSearchDTO: { periodFromDate: '2026-03-01T00:00:00.000', periodToDate: '2026-03-30T00:00:00.000' },
        cWPCrewRosterDayReportDTO: rows,
      },
    },
  };
}

const firstLeg = {
  allocationDate: '2026-03-03T14:10:00.000',
  complementRank: 'CC',
  itemType: 'FLT',
  itemCode: 'LA3000-04/030326/JJCC320',
  reportTime: '14:10',
  pairingItemCode: 'LA3000',
  workType: 'OP',
  departureStation: 'BSB 15:00',
  departureTime: '15:00',
  arrivalStation: 'CWB 17:12',
  arrivalTime: '17:12',
  flyingMinutes: 132,
  dutyHours: '08:56',
  dutyMinutes: 536,
  aircraftType: '321',
  pairingDutyId: 1,
};
const secondLeg = {
  complementRank: 'CC',
  itemType: 'FLT',
  pairingItemCode: 'LA3001',
  workType: 'PS',
  departureStation: 'CWB 17:56',
  departureTime: '17:56',
  arrivalStation: 'BSB 19:46',
  arrivalTime: '19:46',
  flyingMinutes: 110,
  dutyMinutes: 0,
  aircraftType: '321',
  pairingDutyId: 1,
};
const lastLegAfterMidnight = {
  complementRank: 'CC',
  itemType: 'FLT',
  pairingItemCode: 'LA3002',
  workType: 'OP',
  departureStation: 'BSB 23:40',
  departureTime: '23:40',
  arrivalStation: 'SSA 01:36(+1)',
  arrivalTime: '01:36(+1)',
  debriefTime: '02:06(+1)',
  flyingMinutes: 116,
  dutyMinutes: 0,
  aircraftType: '320',
  pairingDutyId: 1,
};

describe('parseIflightRosterReport', () => {
  it('versão própria do leitor', () => {
    expect(IFLIGHT_JSON_PARSER_VERSION).toBe('IFLIGHT_JSON_V1');
  });

  it('período do relatório vira o período da escala', () => {
    const { header } = parseIflightRosterReport(report([]));
    expect(header).toMatchObject({ rosterStartDate: '2026-03-01', rosterEndDate: '2026-03-30' });
  });

  it('jornada com três trechos: voo, programação, apresentação, fim de jornada e horas', () => {
    const { entries } = parseIflightRosterReport(report([firstLeg, secondLeg, lastLegAfterMidnight]));

    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.flightNumber)).toEqual(['LA3000', 'LA3001', 'LA3002']);
    expect(entries.every((e) => e.isFlight && e.entryType === 'flight')).toBe(true);
    expect(entries.every((e) => e.pairingCode === 'LA3000-04/030326/JJCC320')).toBe(true);
    expect(entries[0]).toMatchObject({
      date: '2026-03-03',
      reportTime: '14:10',
      departureAirport: 'BSB',
      departureTime: '15:00',
      arrivalAirport: 'CWB',
      arrivalTime: '17:12',
      flightHours: 2.2,
      dutyHours: 8.93,
      aircraftType: '321',
      crewRole: 'CC',
      operationType: 'OP',
      crewStatusLabel: 'Em operação',
      sortDatetime: '2026-03-03T15:00:00',
    });
    expect(entries[1]).toMatchObject({ reportTime: '', dutyHours: null, operationType: 'PS', crewStatusLabel: 'Reposicionamento' });
    expect(entries[2]).toMatchObject({
      date: '2026-03-03',
      arrivalTime: '01:36',
      debriefTime: '02:06',
      crossesMidnight: true,
      overnight: true,
    });
  });

  it('trecho que sai depois da meia-noite fica no dia seguinte', () => {
    const duty = {
      ...firstLeg,
      allocationDate: '2026-03-10T23:50:00.000',
      reportTime: '23:50',
      departureStation: 'BEL 00:13(+1)',
      departureTime: '00:13(+1)',
      arrivalStation: 'MCP 01:03(+1)',
      arrivalTime: '01:03(+1)',
    };
    const { entries } = parseIflightRosterReport(report([duty]));

    expect(entries[0]).toMatchObject({
      date: '2026-03-11',
      departureTime: '00:13',
      reportTime: '23:50',
      crossesMidnight: false,
      sortDatetime: '2026-03-11T00:13:00',
    });
  });

  it('atividades: sobreaviso com horário, folga que vira o dia e código dentro da programação', () => {
    const standby = {
      allocationDate: '2026-03-05T16:05:00.000',
      complementRank: 'CC',
      itemType: 'ACY',
      description: 'Airport stand by',
      reportTime: '16:05',
      pairingItemCode: 'ASB',
      departureStation: 'GRU 16:05',
      departureTime: '16:05',
      arrivalStation: 'GRU 22:05',
      arrivalTime: '22:05',
      flyingMinutes: 0,
      dutyMinutes: 405,
      pairingDutyId: 7,
      acyDebriefTime: '22:35',
    };
    const cancellation = {
      complementRank: 'CC',
      itemType: 'ACY',
      description: 'Airport cancellation',
      pairingItemCode: 'CNA',
      departureStation: 'GRU 22:06',
      departureTime: '22:06',
      arrivalStation: 'GRU 22:20',
      arrivalTime: '22:20',
      dutyMinutes: 0,
      pairingDutyId: 7,
    };
    const dayOff = {
      allocationDate: '2026-03-07T08:51:00.000',
      complementRank: 'CC',
      itemCode: 'DO',
      description: 'Day off',
      reportTime: '08:51',
      departureStation: 'BSB 08:51',
      departureTime: '08:51',
      arrivalStation: 'BSB 08:50(+1)',
      arrivalTime: '08:50(+1)',
      dutyMinutes: 0,
    };
    const { entries } = parseIflightRosterReport(report([standby, cancellation, dayOff]));

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      date: '2026-03-05',
      isFlight: false,
      activityType: 'ASB',
      flightNumber: 'ASB',
      departureAirport: 'GRU',
      departureTime: '16:05',
      arrivalTime: '22:05',
      reportTime: '16:05',
      debriefTime: '22:35',
      dutyHours: 6.75,
      activityLabel: 'Airport stand by',
    });
    expect(entries[0].entryType).not.toBe('other_activity');
    expect(entries[1]).toMatchObject({ date: '2026-03-05', activityType: 'CNA', activityLabel: 'Airport cancellation' });
    expect(entries[2]).toMatchObject({
      date: '2026-03-07',
      activityType: 'DO',
      entryType: 'day_off',
      crossesMidnight: true,
      dutyHours: null,
    });
  });

  it('JSON que não é o relatório do iFlight: erro claro', () => {
    expect(() => parseIflightRosterReport({ foo: 1 })).toThrow('Relatório do iFlight sem linhas da escala');
  });
});

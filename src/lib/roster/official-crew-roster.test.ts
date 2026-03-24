import { describe, it, expect } from 'vitest';
import { isOfficialCrewRosterFileName } from './official-crew-roster';

describe('isOfficialCrewRosterFileName', () => {
  it('aceita prefixo CrewRosterReport (várias formas)', () => {
    expect(isOfficialCrewRosterFileName('CrewRosterReport.pdf')).toBe(true);
    expect(isOfficialCrewRosterFileName('crewrosterreport.pdf')).toBe(true);
    expect(isOfficialCrewRosterFileName('CrewRosterReport_Mar_2026.pdf')).toBe(true);
    expect(isOfficialCrewRosterFileName('crewrosterreport_2026-03.pdf')).toBe(true);
  });

  it('rejeita outros nomes', () => {
    expect(isOfficialCrewRosterFileName('escala.pdf')).toBe(false);
    expect(isOfficialCrewRosterFileName('RosterReport.pdf')).toBe(false);
  });
});

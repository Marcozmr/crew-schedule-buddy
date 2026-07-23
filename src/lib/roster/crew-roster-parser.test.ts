import { describe, expect, it } from 'vitest';
import { normalizeCrewRosterPdfText, parseCrewRosterEntries } from './crew-roster-parser';

describe('CrewRosterReport LATAM', () => {
  it('normaliza mês misto e extrai voos OP/PS e (+1)', () => {
    const raw = `
      03-Mar-2026 LA3953 CC OP BSB 14:10 POA 16:41
      04-Mar-2026 13:35 LA3603 CC PS POA 13:58 GIG 15:48
      17-Mar-2026 LA3494 CC OP BSB 23:35 JPA 02:15 (+1)
      11-Mar-2026 APR CC CGH 22:00 CGH 00:02 (+1)
      02-Mar-2026 HSB
      09-Mar-2026 ASB
      15-Mar-2026 DO
    `;
    const n = normalizeCrewRosterPdfText(raw);
    const { entries, stats } = parseCrewRosterEntries(n);

    expect(stats.totalFlights).toBeGreaterThanOrEqual(3);
    const nums = entries.filter((e) => e.isFlight && e.flightNumber.startsWith('LA')).map((e) => e.flightNumber);
    expect(nums).toContain('LA3953');
    expect(nums).toContain('LA3603');
    expect(nums).toContain('LA3494');

    const ps = entries.find((e) => e.flightNumber === 'LA3603');
    expect(ps?.crewStatusLabel).toBe('Reposicionamento');

    const op = entries.find((e) => e.flightNumber === 'LA3953');
    expect(op?.crewStatusLabel).toBe('Em operação');

    const overnight = entries.find((e) => e.flightNumber === 'LA3494');
    expect(overnight?.crossesMidnight).toBe(true);

    expect(entries.some((e) => e.activityType === 'HSB')).toBe(true);
    expect(entries.some((e) => e.activityType === 'ASB')).toBe(true);
    expect(entries.some((e) => e.activityType === 'DO')).toBe(true);
    expect(stats.totalAfterDedup).toBe(entries.length);
  });

  it('detecta lista de voos LATAM informada pelo produto', () => {
    const line =
      '01-MAR-2026 LA3387 CC OP X 10:00 Y 11:00'.replace(/X/g, 'GRU').replace(/Y/g, 'BSB');
    const n = normalizeCrewRosterPdfText(line);
    const { entries } = parseCrewRosterEntries(n);
    expect(entries.some((e) => e.flightNumber === 'LA3387')).toBe(true);
  });

  it('reconhece códigos de atividade além da whitelist antiga (CPER, DR, VC, CRMBSB)', () => {
    const raw = `
      06-Jul-2026 CPER 09:00 09:00 BSB 09:00 BSB 13:00 13:00 04:00
      16-Jul-2026 CRMBSB 09:00 09:00 BSB 09:00 BSB 13:00 13:00 04:00
      18-Jul-2026 DR 00:00 00:00 BSB 00:00 BSB 23:59 23:59 00:00
      20-Jul-2026 VC 00:00 00:00 BSB 00:00 BSB 23:59 23:59 00:00
    `;
    const n = normalizeCrewRosterPdfText(raw);
    const { entries } = parseCrewRosterEntries(n);

    const cper = entries.find((e) => e.activityType === 'CPER');
    expect(cper?.crewStatusLabel).toBe('Artigos perigosos');
    expect(cper?.entryType).toBe('training');

    const crm = entries.find((e) => e.activityType === 'CRMBSB');
    expect(crm?.crewStatusLabel).toBe('Curso CRM (BSB)');
    expect(crm?.entryType).toBe('training');

    const dr = entries.find((e) => e.activityType === 'DR');
    expect(dr?.crewStatusLabel).toBe('Folga pedida');
    expect(dr?.entryType).toBe('day_off');

    const vc = entries.find((e) => e.activityType === 'VC');
    expect(vc?.crewStatusLabel).toBe('Férias');
    expect(vc?.entryType).toBe('vacation');
  });

  it('mantém ASB como Reserva e HSB como Sobreaviso (não trocados)', () => {
    const raw = `
      02-Mar-2026 HSB
      09-Mar-2026 ASB
    `;
    const n = normalizeCrewRosterPdfText(raw);
    const { entries } = parseCrewRosterEntries(n);

    const hsb = entries.find((e) => e.activityType === 'HSB');
    expect(hsb?.crewStatusLabel).toBe('Sobreaviso');
    expect(hsb?.entryType).toBe('standby');

    const asb = entries.find((e) => e.activityType === 'ASB');
    expect(asb?.crewStatusLabel).toBe('Reserva');
    expect(asb?.entryType).toBe('reserve');
  });
});

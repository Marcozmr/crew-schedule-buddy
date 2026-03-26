import { describe, expect, it } from 'vitest';
import { pickDashboardRosterId } from './dashboard-schedule-consolidation';

const base = (id: string, overrides: Partial<Parameters<typeof pickDashboardRosterId>[0][number]> = {}) => ({
  id,
  is_active: true,
  inserted_count: 5,
  parsed_count: 5,
  import_status: 'success',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('pickDashboardRosterId', () => {
  it('prefere portal com portal_connection_id sobre PDF', () => {
    const portal = base('p1', {
      portal_connection_id: 'pc1',
      roster_provider: 'corporate_portal',
    });
    const pdf = base('pdf1', { roster_provider: 'pdf', inserted_count: 20 });
    expect(pickDashboardRosterId([pdf, portal])).toBe('p1');
  });

  it('prefere PDF com linhas sobre manual quando não há portal', () => {
    const manual = base('m1', { roster_provider: 'manual', import_origin: 'manual' });
    const pdf = base('pdf1', { roster_provider: 'pdf' });
    expect(pickDashboardRosterId([manual, pdf])).toBe('pdf1');
  });
});

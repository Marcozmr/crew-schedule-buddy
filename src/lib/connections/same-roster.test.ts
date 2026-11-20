import { describe, expect, it } from 'vitest';
import { sameRosterPartners } from './same-roster';

const conn = (id: string, n: number) => ({ partnerUserId: id, partnerName: id, partnerAirline: null, flightsTogetherCount: n, hasConversation: false, conversationId: null });

describe('sameRosterPartners', () => {
  it('quem esteve em quase todos os seus voos é a mesma escala em outra conta', () => {
    expect([...sameRosterPartners([conn('mesma', 58), conn('nicole', 4)], 40)]).toEqual(['mesma']);
  });

  it('colega de verdade com muitos voos juntos, mas não todos, continua', () => {
    expect(sameRosterPartners([conn('ana', 20)], 40).size).toBe(0);
  });

  it('com poucos voos na escala não tira conclusão', () => {
    expect(sameRosterPartners([conn('bia', 3)], 3).size).toBe(0);
    expect(sameRosterPartners([conn('bia', 10)], 0).size).toBe(0);
  });
});

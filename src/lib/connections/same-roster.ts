/**
 * "Colega" que esteve em praticamente todos os seus voos é a mesma escala importada em outra conta
 * (ex.: a tripulante e alguém da família com a escala dela). Não é um colega de verdade: some da
 * lista e a tela só avisa. Precisa de pelo menos 5 voos para concluir; abaixo disso, mantém.
 */
import type { CrewConnectionEntry } from '@/lib/services/crew-discovery-service';

const MIN_FLIGHTS = 5;
const SHARE = 0.9;

export function sameRosterPartners(connections: CrewConnectionEntry[], myFlightCount: number): Set<string> {
  const out = new Set<string>();
  if (myFlightCount < MIN_FLIGHTS) return out;
  for (const c of connections) {
    if (c.flightsTogetherCount >= MIN_FLIGHTS && c.flightsTogetherCount >= SHARE * myFlightCount) out.add(c.partnerUserId);
  }
  return out;
}

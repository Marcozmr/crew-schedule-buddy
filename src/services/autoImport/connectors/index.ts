import type { AirlineConnector, AirlineId } from '../autoImportTypes';
import { latamConnector } from './latamConnector';
import { golConnector } from './golConnector';
import { azulConnector } from './azulConnector';
import { genericPdfConnector } from './genericPdfConnector';

const CONNECTORS: Record<AirlineId, AirlineConnector> = {
  LATAM: latamConnector,
  GOL: golConnector,
  AZUL: azulConnector,
  GENERIC: genericPdfConnector,
};

export function getConnector(airline: AirlineId): AirlineConnector {
  return CONNECTORS[airline] ?? genericPdfConnector;
}

export { latamConnector, golConnector, azulConnector, genericPdfConnector };

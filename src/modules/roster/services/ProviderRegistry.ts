/**
 * Provider Registry — registro central de providers de escala.
 */

import { PdfProvider } from '../providers/PdfProvider';
import { ManualProvider } from '../providers/ManualProvider';
import { CorporatePortalProvider } from '../providers/CorporatePortalProvider';
import { IFlightProvider } from '../providers/IFlightProvider';
import { GolProvider } from '../providers/GolProvider';
import { AzulProvider } from '../providers/AzulProvider';
import { AbxProvider } from '../providers/AbxProvider';
import type { RosterProvider, RosterProviderId, RosterSourceInfo } from '../types';

const registry: Record<RosterProviderId, RosterProvider> = {
  pdf: new PdfProvider(),
  manual: new ManualProvider(),
  corporate_portal: new CorporatePortalProvider(),
  iflight: new IFlightProvider(),
  gol: new GolProvider(),
  azul: new AzulProvider(),
  abx: new AbxProvider(),
};

export const ProviderRegistry = {
  getAvailableProviders(): RosterProvider[] {
    return Object.values(registry);
  },

  getProviderById(id: RosterProviderId): RosterProvider {
    return registry[id];
  },

  getDefaultProvider(): RosterProvider {
    return registry.pdf;
  },

  getEnabledProviders(): RosterProvider[] {
    return Object.values(registry).filter((p) => {
      const sources = p.listAvailableSources();
      return sources.some((s) => s.available);
    });
  },

  getAllSources(): RosterSourceInfo[] {
    return Object.values(registry).flatMap((p) => p.listAvailableSources());
  },
};

/**
 * Aeroportos: tabela gerada do OurAirports (airports-data.ts, com fuso IANA) + nomes em português
 * das entradas que o app já usava. Códigos antigos corrigidos: FOZ → IGU (Foz do Iguaçu), CFC → CAC (Cascavel).
 */
import { AIRPORTS_DATA, type AirportRecord } from "./airports-data";

export type AirportInfo = AirportRecord;

/** Nome e cidade em português para os aeroportos mais usados (sobrescrevem os do OurAirports). */
const PT_NAMES: Record<string, { name: string; city: string }> = {
  GRU: { name: "Guarulhos", city: "Guarulhos" },
  CGH: { name: "Congonhas", city: "São Paulo" },
  VCP: { name: "Viracopos", city: "Campinas" },
  BSB: { name: "Brasília", city: "Brasília" },
  GIG: { name: "Galeão", city: "Rio de Janeiro" },
  SDU: { name: "Santos Dumont", city: "Rio de Janeiro" },
  SSA: { name: "Salvador", city: "Salvador" },
  CNF: { name: "Confins", city: "Belo Horizonte" },
  PLU: { name: "Pampulha", city: "Belo Horizonte" },
  POA: { name: "Salgado Filho", city: "Porto Alegre" },
  REC: { name: "Recife", city: "Recife" },
  CWB: { name: "Afonso Pena", city: "Curitiba" },
  FOR: { name: "Fortaleza", city: "Fortaleza" },
  MAO: { name: "Eduardo Gomes", city: "Manaus" },
  BEL: { name: "Val de Cans", city: "Belém" },
  FLN: { name: "Hercílio Luz", city: "Florianópolis" },
  NAT: { name: "Natal", city: "Natal" },
  MCZ: { name: "Maceió", city: "Maceió" },
  VIX: { name: "Vitória", city: "Vitória" },
  CGB: { name: "Marechal Rondon", city: "Cuiabá" },
  GYN: { name: "Santa Genoveva", city: "Goiânia" },
  THE: { name: "Teresina", city: "Teresina" },
  PMW: { name: "Palmas", city: "Palmas" },
  PVH: { name: "Porto Velho", city: "Porto Velho" },
  BVB: { name: "Boa Vista", city: "Boa Vista" },
  MAB: { name: "Marabá", city: "Marabá" },
  SLZ: { name: "Marechal Cunha Machado", city: "São Luís" },
  JPA: { name: "Castro Pinto", city: "João Pessoa" },
  AJU: { name: "Santa Maria", city: "Aracaju" },
  MGF: { name: "Silvio Name Jr.", city: "Maringá" },
  LDB: { name: "Londrina", city: "Londrina" },
  IGU: { name: "Foz do Iguaçu", city: "Foz do Iguaçu" },
  JOI: { name: "Lauro Carneiro de Loyola", city: "Joinville" },
  XAP: { name: "Chapecó", city: "Chapecó" },
  NVT: { name: "Navegantes", city: "Navegantes" },
  UDI: { name: "Uberlândia", city: "Uberlândia" },
  PMG: { name: "Ponta Porã", city: "Ponta Porã" },
  CZS: { name: "Cruzeiro do Sul", city: "Cruzeiro do Sul" },
  STM: { name: "Santarém", city: "Santarém" },
  MCP: { name: "Macapá", city: "Macapá" },
  IOS: { name: "Ilhéus", city: "Ilhéus" },
  BPS: { name: "Porto Seguro", city: "Porto Seguro" },
  PPB: { name: "Presidente Prudente", city: "Presidente Prudente" },
  CAC: { name: "Cascavel", city: "Cascavel" },
  EZE: { name: "Ezeiza", city: "Buenos Aires" },
  SCL: { name: "Santiago", city: "Santiago" },
  LIM: { name: "Lima", city: "Lima" },
  BOG: { name: "Bogotá", city: "Bogotá" },
  MIA: { name: "Miami", city: "Miami" },
  JFK: { name: "JFK", city: "New York" },
  ORY: { name: "Orly", city: "Paris" },
  LIS: { name: "Lisboa", city: "Lisboa" },
};

/** Fora do OurAirports com voo regular, mas usado em escalas antigas. */
const EXTRA: Record<string, AirportRecord> = {
  PLU: { icao: "SBBH", name: "Pampulha", city: "Belo Horizonte", lat: -19.8512, lon: -43.9506, tz: "America/Sao_Paulo" },
};

export const AIRPORTS_DB: Record<string, AirportInfo> = Object.fromEntries(
  Object.entries({ ...EXTRA, ...AIRPORTS_DATA }).map(([iata, a]) => [iata, { ...a, ...(PT_NAMES[iata] ?? {}) }]),
);

export function getAirport(iata: string | null | undefined): AirportInfo | undefined {
  if (!iata) return undefined;
  return AIRPORTS_DB[iata.trim().toUpperCase()];
}

export function airportTz(iata: string | null | undefined): string | undefined {
  return getAirport(iata)?.tz;
}

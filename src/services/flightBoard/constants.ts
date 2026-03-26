/**
 * Constantes do Flight Board
 */

export const CARRIER_NAMES: Record<string, string> = {
  LA: "LATAM",
  G3: "GOL",
  AD: "Azul",
  JJ: "LATAM",
  UA: "United",
  AA: "American",
  DL: "Delta",
  BA: "British Airways",
  AF: "Air France",
  KL: "KLM",
  IB: "Iberia",
  EK: "Emirates",
  QR: "Qatar",
  TK: "Turkish",
  LH: "Lufthansa",
};

export const STATUS_MAP: Record<string, string> = {
  SCHEDULED: "Programado",
  BOARDING: "Embarque",
  DEPARTED: "Partiu",
  LANDED: "Pousou",
  CANCELLED: "Cancelado",
  DELAYED: "Atrasado",
  ON_TIME: "No horário",
  ARRIVED: "Chegou",
  GATE_CHANGE: "Mudança de portão",
  Indisponível: "Indisponível",
  "Destino disponível": "Destino disponível",
};

/** Filtro “todas as bases” na minha escala (Flight Board Pro). */
export const FLIGHT_BOARD_ALL_AIRPORTS = "__ALL__" as const;

export const DEFAULT_AIRPORTS = [
  { code: "GRU", name: "Guarulhos (GRU)" },
  { code: "CGH", name: "Congonhas (CGH)" },
  { code: "BSB", name: "Brasília (BSB)" },
  { code: "GIG", name: "Galeão (GIG)" },
  { code: "CNF", name: "Confins (CNF)" },
  { code: "SSA", name: "Salvador (SSA)" },
  { code: "REC", name: "Recife (REC)" },
];

export const REFRESH_INTERVAL_MS = 1000 * 60 * 5; // 5 minutos
export const MAX_FLIGHTS_PER_LIST = 20;

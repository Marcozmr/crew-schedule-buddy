// Gera src/lib/airports-data.ts a partir do OurAirports (domínio público):
// IATA → ICAO, nome, cidade, coordenadas e fuso IANA.
// Uso: node scripts/gerar-aeroportos.mjs [caminho/airports.csv]
// Sem argumento, baixa https://davidmegginson.github.io/ourairports-data/airports.csv
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
// fileURLToPath decodifica espaço e acento no caminho (URL.pathname deixaria "%20").
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/airports-data.ts');

const SOUTH_AMERICA = new Set(['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE', 'GF']);
const OTHER = new Set(['US', 'MX', 'PA', 'CU', 'DO', 'PT', 'ES', 'IT', 'FR', 'DE', 'GB', 'NL', 'ZA', 'AU', 'NZ']);

const BR_REGION_TZ = {
  'BR-AM': 'America/Manaus', 'BR-RR': 'America/Boa_Vista', 'BR-RO': 'America/Porto_Velho', 'BR-AC': 'America/Rio_Branco',
  'BR-MT': 'America/Cuiaba', 'BR-MS': 'America/Campo_Grande', 'BR-PA': 'America/Belem', 'BR-AP': 'America/Belem',
  'BR-TO': 'America/Araguaina', 'BR-MA': 'America/Fortaleza', 'BR-PI': 'America/Fortaleza', 'BR-CE': 'America/Fortaleza',
  'BR-RN': 'America/Fortaleza', 'BR-PB': 'America/Fortaleza', 'BR-PE': 'America/Recife', 'BR-AL': 'America/Maceio',
  'BR-SE': 'America/Maceio', 'BR-BA': 'America/Bahia',
};
const COUNTRY_TZ = {
  AR: 'America/Argentina/Buenos_Aires', BO: 'America/La_Paz', CL: 'America/Santiago', CO: 'America/Bogota',
  EC: 'America/Guayaquil', GY: 'America/Guyana', PY: 'America/Asuncion', PE: 'America/Lima', SR: 'America/Paramaribo',
  UY: 'America/Montevideo', VE: 'America/Caracas', GF: 'America/Cayenne', MX: 'America/Mexico_City', PA: 'America/Panama',
  CU: 'America/Havana', DO: 'America/Santo_Domingo', PT: 'Europe/Lisbon', ES: 'Europe/Madrid', IT: 'Europe/Rome',
  FR: 'Europe/Paris', DE: 'Europe/Berlin', GB: 'Europe/London', NL: 'Europe/Amsterdam', ZA: 'Africa/Johannesburg',
  NZ: 'Pacific/Auckland',
};
const AU_REGION_TZ = {
  'AU-NSW': 'Australia/Sydney', 'AU-ACT': 'Australia/Sydney', 'AU-VIC': 'Australia/Melbourne', 'AU-QLD': 'Australia/Brisbane',
  'AU-SA': 'Australia/Adelaide', 'AU-WA': 'Australia/Perth', 'AU-TAS': 'Australia/Hobart', 'AU-NT': 'Australia/Darwin',
};
const US_EASTERN = 'CT DC DE FL GA ME MD MA MI NH NJ NY NC OH PA RI SC VT VA WV IN KY';
const US_CENTRAL = 'AL AR IL IA KS LA MN MS MO NE ND OK SD TN TX WI';
const US_MOUNTAIN = 'CO MT NM UT WY ID';
const US_PACIFIC = 'CA NV OR WA';
const US_STATE_TZ = Object.fromEntries([
  ...US_EASTERN.split(' ').map((s) => [s, 'America/New_York']),
  ...US_CENTRAL.split(' ').map((s) => [s, 'America/Chicago']),
  ...US_MOUNTAIN.split(' ').map((s) => [s, 'America/Denver']),
  ...US_PACIFIC.split(' ').map((s) => [s, 'America/Los_Angeles']),
  ['AZ', 'America/Phoenix'], ['HI', 'Pacific/Honolulu'], ['AK', 'America/Anchorage'],
]);
/** Exceções por IATA (ilhas e regiões com fuso próprio). */
const IATA_TZ = {
  FEN: 'America/Noronha', STM: 'America/Santarem', IPC: 'Pacific/Easter', PUQ: 'America/Punta_Arenas',
  GPS: 'Pacific/Galapagos', SCY: 'Pacific/Galapagos', CUN: 'America/Cancun', TIJ: 'America/Tijuana',
  PDL: 'Atlantic/Azores', TER: 'Atlantic/Azores', HOR: 'Atlantic/Azores', FNC: 'Atlantic/Madeira', PXO: 'Atlantic/Madeira',
  LPA: 'Atlantic/Canary', TFS: 'Atlantic/Canary', TFN: 'Atlantic/Canary', ACE: 'Atlantic/Canary', FUE: 'Atlantic/Canary',
  SPC: 'Atlantic/Canary',
};

function tzFor(row) {
  if (IATA_TZ[row.iata_code]) return IATA_TZ[row.iata_code];
  const c = row.iso_country;
  if (c === 'BR') return BR_REGION_TZ[row.iso_region] ?? 'America/Sao_Paulo';
  if (c === 'AU') return AU_REGION_TZ[row.iso_region] ?? null;
  if (c === 'US') return US_STATE_TZ[row.iso_region.replace('US-', '')] ?? null;
  return COUNTRY_TZ[c] ?? null;
}

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function keep(row) {
  if (!/^[A-Z]{3}$/.test(row.iata_code)) return false;
  const scheduled = row.scheduled_service === 'yes';
  if (SOUTH_AMERICA.has(row.iso_country)) {
    if (row.type === 'large_airport') return true;
    if (row.type === 'medium_airport') return scheduled;
    return row.iso_country === 'BR' && row.type === 'small_airport' && scheduled;
  }
  if (OTHER.has(row.iso_country)) return row.type === 'large_airport' && scheduled;
  return false;
}

const text = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : await (await fetch(SOURCE)).text();
const out = {};
let skipped = 0;
for (const row of parseCsv(text)) {
  if (!keep(row)) continue;
  const tz = tzFor(row);
  if (!tz) { skipped++; continue; }
  const prev = out[row.iata_code];
  if (prev && prev.rank <= (row.type === 'large_airport' ? 0 : 1)) continue;
  out[row.iata_code] = {
    rank: row.type === 'large_airport' ? 0 : 1,
    icao: row.icao_code || row.gps_code || row.ident,
    name: row.name,
    city: row.municipality || row.name,
    lat: Math.round(Number(row.latitude_deg) * 1e4) / 1e4,
    lon: Math.round(Number(row.longitude_deg) * 1e4) / 1e4,
    tz,
  };
}

const lines = Object.keys(out).sort().map((iata) => {
  const a = out[iata];
  return `  ${iata}: { icao: ${JSON.stringify(a.icao)}, name: ${JSON.stringify(a.name)}, city: ${JSON.stringify(a.city)}, lat: ${a.lat}, lon: ${a.lon}, tz: ${JSON.stringify(a.tz)} },`;
});
const file = `/**
 * Gerado por scripts/gerar-aeroportos.mjs a partir do OurAirports (domínio público). Não editar à mão.
 * ${lines.length} aeroportos; fuso IANA por estado (Brasil), região (Austrália/EUA) ou país.
 */
export interface AirportRecord {
  icao: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  tz: string;
}

export const AIRPORTS_DATA: Record<string, AirportRecord> = {
${lines.join('\n')}
};
`;
fs.writeFileSync(OUT, file);
console.log(`airports-data.ts: ${lines.length} aeroportos (${skipped} sem fuso conhecido, ignorados)`);

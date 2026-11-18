#!/usr/bin/env node
/**
 * SPIKE (descartável) — resume um arquivo .har do Chrome sem expor segredos.
 *
 * Uso:  node scripts/lab/har-resumo.mjs caminho/iflight.har > resumo.txt
 *
 * Mostra cada requisição do iFlight: método, status, tipo, tamanho, URL (valores sensíveis
 * trocados por …), NOMES dos cabeçalhos e dos campos enviados, e a FORMA do JSON (só chaves).
 * Nunca imprime cookies, valores de cabeçalho, tokens nem o conteúdo da escala.
 * Marca com >>> as respostas que parecem ser a escala (PDF ou JSON com voos LA).
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/lab/har-resumo.mjs arquivo.har');
  process.exit(1);
}

const har = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = har?.log?.entries ?? [];

const STATIC = /\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|map)(\?|$)/i;
const SENSITIVE_KEY = /token|saml|code|state|sess|auth|ticket|sig|pass|key|nonce|assertion|cookie/i;
const BORING_HEADERS = /^(:|accept-encoding|accept-language|connection|host|user-agent|sec-|cookie|referer|origin|priority|cache-control|pragma|upgrade-insecure|dnt)/i;

function clean(u) {
  try {
    const x = new URL(u);
    const parts = [];
    x.searchParams.forEach((v, k) => parts.push(`${k}=${!SENSITIVE_KEY.test(k) && v.length <= 40 ? v : '…'}`));
    return x.origin + x.pathname + (parts.length ? `?${parts.join('&')}` : '');
  } catch {
    return String(u).slice(0, 120);
  }
}

function describe(v) {
  if (Array.isArray(v)) {
    const f = v[0];
    const inner = f && typeof f === 'object' && !Array.isArray(f) ? `{${Object.keys(f).slice(0, 15).join(',')}}` : typeof f;
    return `array[${v.length}] de ${inner}`;
  }
  if (v && typeof v === 'object') return `{${Object.keys(v).slice(0, 15).join(',')}}`;
  return typeof v;
}

function shape(text) {
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j) || !j || typeof j !== 'object') return { '(raiz)': describe(j) };
    return Object.fromEntries(Object.keys(j).slice(0, 25).map((k) => [k, describe(j[k])]));
  } catch {
    return null;
  }
}

function postNames(req) {
  const pd = req.postData;
  if (!pd) return [];
  if (Array.isArray(pd.params) && pd.params.length) return pd.params.map((p) => p.name);
  const t = pd.text ?? '';
  if (t.startsWith('{')) {
    try { return Object.keys(JSON.parse(t)); } catch { return ['(json ilegível)']; }
  }
  if (t.includes('=')) return t.split('&').map((kv) => decodeURIComponent(kv.split('=')[0]));
  return t ? ['(corpo não-formulário)'] : [];
}

let n = 0;
for (const e of entries) {
  const req = e.request ?? {};
  const res = e.response ?? {};
  const url = req.url ?? '';
  if (!/ibsplc\.aero|latam\.com/i.test(url) || STATIC.test(url)) continue;

  const mime = String(res.content?.mimeType ?? '').split(';')[0];
  const size = res.content?.size ?? res.bodySize ?? 0;
  const text = res.content?.text ?? '';
  const decoded = res.content?.encoding === 'base64' ? Buffer.from(text, 'base64').toString('latin1') : text;

  const isPdf = /pdf/i.test(mime) || decoded.startsWith('%PDF');
  const flights = (decoded.match(/\bLA\s?\d{3,4}\b/g) ?? []).length;
  const mark = isPdf || flights >= 3 ? '>>> ' : '    ';

  n++;
  console.log(`${mark}${req.method} ${res.status} ${mime || '-'} ${size}B ${clean(url)}`);

  const hdrs = (req.headers ?? []).map((h) => h.name).filter((h) => !BORING_HEADERS.test(h));
  if (hdrs.length) console.log(`       cabeçalhos: ${[...new Set(hdrs)].join(', ')}`);
  const names = postNames(req);
  if (names.length) console.log(`       campos enviados: ${names.join(', ')}`);
  if (/json/i.test(mime) && decoded) {
    const s = shape(decoded);
    if (s) console.log(`       forma do JSON: ${JSON.stringify(s)}`);
  }
  if (flights) console.log(`       contém ${flights} números de voo LA`);
  if (isPdf) console.log('       É UM PDF');
}

console.log(`\n${n} requisições do iFlight/LATAM listadas (de ${entries.length} no arquivo).`);

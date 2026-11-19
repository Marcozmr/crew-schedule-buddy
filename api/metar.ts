/**
 * Repassa METAR, TAF e SIGMET do aviationweather.gov para o app na web: o serviço não manda
 * cabeçalho de CORS, então o navegador bloqueia a chamada direta. `kind` = metar (padrão) | taf |
 * sigmet; METAR e TAF exigem `ids` com códigos ICAO. Cache de 5 min na Vercel.
 */

const UPSTREAM = 'https://aviationweather.gov/api/data';
const IDS = /^[A-Z]{4}(,[A-Z]{4}){0,19}$/;
const KINDS = new Set(['metar', 'taf', 'sigmet']);

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const kind = (params.get('kind') ?? 'metar').toLowerCase();
  const ids = (params.get('ids') ?? '').trim().toUpperCase();
  // Sem Access-Control-Allow-Origin: só o próprio app na web (mesma origem) usa a rota; o app
  // instalado vai direto pelo HTTP nativo. Assim ela não vira proxy aberto para outros sites.
  const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
  if (!KINDS.has(kind)) return new Response('kind inválido', { status: 400, headers });
  if (kind !== 'sigmet' && !IDS.test(ids)) return new Response('ids inválido', { status: 400, headers });
  try {
    const query = kind === 'sigmet' ? 'format=raw' : `ids=${ids}&format=raw`;
    // Tempo limite de 8 s: se o aviationweather travar, a função responde 502 em vez de esperar.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const upstream = await fetch(`${UPSTREAM}/${kind}?${query}`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    const text = upstream.ok ? await upstream.text() : '';
    return new Response(text, { status: upstream.ok ? 200 : 502, headers: { ...headers, 'Cache-Control': 'public, s-maxage=300' } });
  } catch {
    return new Response('', { status: 502, headers });
  }
}

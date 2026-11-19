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
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain; charset=utf-8' };
  if (!KINDS.has(kind)) return new Response('kind inválido', { status: 400, headers });
  if (kind !== 'sigmet' && !IDS.test(ids)) return new Response('ids inválido', { status: 400, headers });
  try {
    const query = kind === 'sigmet' ? 'format=raw' : `ids=${ids}&format=raw`;
    const upstream = await fetch(`${UPSTREAM}/${kind}?${query}`);
    const text = upstream.ok ? await upstream.text() : '';
    return new Response(text, { status: upstream.ok ? 200 : 502, headers: { ...headers, 'Cache-Control': 'public, s-maxage=300' } });
  } catch {
    return new Response('', { status: 502, headers });
  }
}

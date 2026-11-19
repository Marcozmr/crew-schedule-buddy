import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ native: false, httpGet: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => h.native },
  CapacitorHttp: { get: h.httpGet },
}));

import { fetchAviationWeather, fetchMetar, metarTempC } from './metar';
import { GET } from '../../../api/metar';

const RAW = 'METAR SBBR 191500Z 33006KT 9999 BKN030 27/18 Q1018';

beforeEach(() => {
  h.native = false;
  h.httpGet.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('metarTempC', () => {
  it('lê a temperatura do METAR', () => {
    expect(metarTempC(RAW)).toBe(27);
    expect(metarTempC('METAR SBPA 191500Z 18010KT 9999 M02/M05 Q1030')).toBe(-2);
    expect(metarTempC('')).toBeNull();
  });
});

describe('fetchMetar', () => {
  it('no app instalado usa o HTTP nativo direto no aviationweather (sem CORS)', async () => {
    h.native = true;
    h.httpGet.mockResolvedValue({ status: 200, data: `${RAW}\n` });
    expect(await fetchMetar('SBBR')).toBe(RAW);
    expect(h.httpGet.mock.calls[0][0].url).toBe('https://aviationweather.gov/api/data/metar?ids=SBBR&format=raw');
  });

  it('no navegador usa a rota /api/metar', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(RAW));
    expect(await fetchMetar('SBBR')).toBe(RAW);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/metar?ids=SBBR');
  });

  it('falha devolve texto vazio', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await fetchMetar('SBBR')).toBe('');
  });
});

describe('fetchAviationWeather (TAF e SIGMET para a página do MetCenter)', () => {
  it('TAF no navegador vai pela rota com kind=taf', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('TAF SBBR ...'));
    expect(await fetchAviationWeather('taf', 'SBBR')).toBe('TAF SBBR ...');
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/metar?kind=taf&ids=SBBR');
  });

  it('SIGMET no app instalado vai direto, sem ids', async () => {
    h.native = true;
    h.httpGet.mockResolvedValue({ status: 200, data: 'SIGMET ...' });
    expect(await fetchAviationWeather('sigmet')).toBe('SIGMET ...');
    expect(h.httpGet.mock.calls[0][0].url).toBe('https://aviationweather.gov/api/data/sigmet?format=raw');
  });
});

describe('api/metar (Vercel)', () => {
  it('kind=taf repassa para o endpoint de TAF', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('TAF'));
    await GET(new Request('https://x/api/metar?kind=taf&ids=SBBR'));
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://aviationweather.gov/api/data/taf?ids=SBBR&format=raw');
  });

  it('kind=sigmet não exige ids; kind desconhecido é recusado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('SIGMET'));
    expect((await GET(new Request('https://x/api/metar?kind=sigmet'))).status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://aviationweather.gov/api/data/sigmet?format=raw');
    expect((await GET(new Request('https://x/api/metar?kind=pirep&ids=SBBR'))).status).toBe(400);
  });

  it('recusa ids inválidos', async () => {
    const r = await GET(new Request('https://x/api/metar?ids=../etc'));
    expect(r.status).toBe(400);
  });

  it('repassa ao aviationweather e libera CORS', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(RAW));
    const r = await GET(new Request('https://x/api/metar?ids=SBBR,SBGR'));
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://aviationweather.gov/api/data/metar?ids=SBBR,SBGR&format=raw');
    expect(r.status).toBe(200);
    expect(await r.text()).toBe(RAW);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    expect(r.headers.get('cache-control')).toContain('s-maxage=300');
  });
});

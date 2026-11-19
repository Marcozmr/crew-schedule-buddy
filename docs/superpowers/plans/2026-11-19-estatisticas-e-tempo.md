# Estatísticas, MetCenter realocado e temperatura certa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela de Estatísticas da escala no lugar do MetCenter, tempo discreto no Início e na Escala, e temperatura do pouso correta.

**Architecture:** Cálculos puros em `src/lib/stats/` sobre `ScheduleEntry[]` (todas as importações, mais recente por dia). Tempo em `src/lib/weather/` (previsão horária Open-Meteo no fuso do aeroporto; METAR por HTTP nativo no app e por `api/metar` na web). Tabela de aeroportos gerada do OurAirports com fuso IANA.

**Tech Stack:** React + TypeScript, Vitest, Supabase, Capacitor (`CapacitorHttp`), recharts (já instalado), `d3-geo` + `topojson-client` + `world-atlas` (novos).

**Spec:** `docs/superpowers/specs/2026-11-19-estatisticas-e-tempo-design.md`

## Global Constraints

- Textos da interface em português do Brasil.
- Fixtures de teste **sintéticas**: o repositório é público; a escala real de novembro fica só na pasta de rascunho e é usada numa conferência local (Task 8), nunca commitada.
- Horários da escala (`departure_time`, `arrival_time`, `report_time`) são **locais da estação**; "+1" vem de `crosses_midnight`.
- Voo operado = `is_flight && operation_type === 'OP'`; deadhead = `is_flight && operation_type === 'PS'`.
- Diurno = 06:00–18:00, noturno = 18:00–06:00, **no fuso da base**.
- Volta na Terra = 40.075 km.
- Janela de previsão: 16 dias. Fora dela, a temperatura do pouso não aparece.
- Vento sempre em nós (`wind_speed_unit=kn` no Open-Meteo).
- Nada de dependência nova além de `d3-geo`, `topojson-client`, `world-atlas` (e `@types/d3-geo`, `@types/topojson-client`).

## Review Focus

- Mês sem nenhum voo (só folgas ou vazio) → seções mostram zeros/"—", sem dividir por zero (eficiência, etapas por dia, média).
- Aeroporto fora da tabela (IATA desconhecido) → voo entra em contagens, fica fora de distância/mapa/diurnas, sem quebrar.
- Base não configurada → usa a estação onde mais jornadas começam; sem voos, considera "em casa".
- Voo que sai depois da meia-noite local (00:13) → conta no dia da saída; pouso "+1" conta como depois das 23h.
- Previsão pedida para pouso daqui a 20 dias ou no passado → não mostra número nem a temperatura de hoje.

---

### Task 1: Tabela de aeroportos com fuso

**Files:**
- Create: `scripts/gerar-aeroportos.mjs`, `src/lib/airports-data.ts` (gerado), `src/lib/airports.test.ts`
- Modify: `src/lib/airports.ts`

**Interfaces:**
- Produces: `AIRPORTS_DB: Record<string, AirportInfo>` (mantém o nome e os campos atuais `icao,name,city,lat,lon`, mais `tz: string`), `getAirport(iata: string): AirportInfo | undefined`, `airportTz(iata: string): string | undefined`.

- [ ] **Step 1: Test** `src/lib/airports.test.ts`: `getAirport('BSB').tz === 'America/Sao_Paulo'`; MAO `America/Manaus`; CGB `America/Cuiaba`; BEL e MCP `America/Belem`; REC `America/Recife`; AEP `America/Argentina/Buenos_Aires`; CAC existe; `getAirport('bsb')` (minúsculo) funciona; `getAirport('XXX')` é `undefined`; BSB lat entre -16 e -15.7, lon entre -48.1 e -47.8; existem pelo menos 150 entradas.
- [ ] **Step 2:** `npx vitest run src/lib/airports.test.ts` → FAIL.
- [ ] **Step 3: Script** `scripts/gerar-aeroportos.mjs`: baixa `https://davidmegginson.github.io/ourairports-data/airports.csv`; mantém linhas com `iata_code` e `type` em `large_airport|medium_airport` (e `small_airport` no BR com `scheduled_service=yes`) dos países da América do Sul + `US, MX, PA, CU, DO, PT, ES, IT, FR, DE, GB, NL, ZA, AU, NZ`; fuso brasileiro por `iso_region` (`BR-AM` Manaus, `BR-RR` Boa_Vista, `BR-RO` Porto_Velho, `BR-AC` Rio_Branco, `BR-MT` Cuiaba, `BR-MS` Campo_Grande, `BR-PA`/`BR-AP` Belem, `BR-TO` Araguaina, `BR-MA` Fortaleza, `BR-PI` Fortaleza, `BR-CE` Fortaleza, `BR-RN` Fortaleza, `BR-PB` Fortaleza, `BR-PE` Recife, `BR-AL`/`BR-SE` Maceio, `BR-BA` Bahia, demais Sao_Paulo; FEN Noronha; STM Santarem); demais países por mapa país→fuso (AR por `iso_region`: todas `America/Argentina/Buenos_Aires` exceto Mendoza/Córdoba etc. aceitas como Buenos_Aires; US por estado com tabela curta dos destinos LATAM: MIA/MCO America/New_York, JFK America/New_York, LAX America/Los_Angeles, BOS America/New_York, LAS America/Los_Angeles); escreve `src/lib/airports-data.ts` (`export const AIRPORTS_DATA: Record<string, AirportInfo> = {...}` ordenado por IATA, cidade = `municipality`). Rodar: `node scripts/gerar-aeroportos.mjs`.
- [ ] **Step 4:** `src/lib/airports.ts` reexporta `AirportInfo` (com `tz`), `AIRPORTS_DB = AIRPORTS_DATA`, e implementa `getAirport`/`airportTz` (IATA em maiúsculas, `trim`). Nomes de cidade com acento das 25 entradas antigas sobrescrevem os do CSV (ex.: "São Paulo", "Brasília").
- [ ] **Step 5:** `npx vitest run src/lib/airports.test.ts` → PASS; `npx tsc --noEmit -p tsconfig.app.json` sem erros.
- [ ] **Step 6: Commit** `feat: tabela de aeroportos com fuso (OurAirports)`.

### Task 2: Hora local → UTC e janelas diurna/noturna

**Files:**
- Create: `src/lib/stats/time.ts`, `src/lib/stats/time.test.ts`

**Interfaces:**
- Produces: `localToUtcMs(date: string, hhmm: string, tz: string): number`; `legUtcRange(e: ScheduleEntry): { start: number; end: number } | null` (usa `airportTz` da origem e do destino; soma 1 dia ao fim se `crosses_midnight`; `null` se faltar aeroporto/fuso); `splitDayNightMinutes(startUtc: number, endUtc: number, tz: string): { day: number; night: number }`.

- [ ] **Step 1: Tests:** `localToUtcMs('2026-03-20','17:20','America/Recife') === Date.UTC(2026,2,20,20,20)`; MAO `'12:28'` → 16:28Z; `legUtcRange` de BSB 10:27 → MAO 12:28 = 3h01 (181 min); voo GRU 21:10 → REC 00:15 com `crosses_midnight` = 3h05; `splitDayNightMinutes` de 17:00→19:00 em `America/Sao_Paulo` = `{day: 60, night: 60}`; 23:00→01:00 = `{day:0, night:120}`; aeroporto desconhecido → `legUtcRange` = `null`.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar com `Intl.DateTimeFormat(..., { timeZone })` para achar o deslocamento. **Step 4:** PASS. **Step 5: Commit** `feat(stats): conversão de horário local e diurno/noturno`.

### Task 3: Histórico de escalas (mais recente por dia)

**Files:**
- Create: `src/lib/stats/roster-history.ts`, `src/lib/stats/roster-history.test.ts`, `src/hooks/useRosterHistory.ts`

**Interfaces:**
- Produces: `pickLatestPerDay(entries: ScheduleEntry[], rosterCreatedAt: Record<string, string>): ScheduleEntry[]` (para cada `date`, mantém só as linhas do `roster_id` com `created_at` mais recente; ordena por `sort_datetime`); `useRosterHistory(): { entries: ScheduleEntry[]; loading: boolean; error: string | null; reload(): void }` (todas as entradas da usuária: `imported_rosters` `id, created_at` + `schedule_entries` da usuária, paginando de 1000 em 1000; recarrega em `subscribeRosterUpdated`).

- [ ] **Step 1: Test** de `pickLatestPerDay`: duas importações cobrindo 2026-11-05 (antiga com 1 voo, nova com 2) → fica a nova; dia só na antiga → fica a antiga; resultado ordenado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: Commit** `feat(stats): histórico de escalas com a mais recente por dia`.

### Task 4: Cálculo das estatísticas

**Files:**
- Create: `src/lib/stats/types.ts`, `src/lib/stats/compute.ts`, `src/lib/stats/insights.ts`, `src/lib/stats/__fixtures__/sample-month.ts`, `src/lib/stats/compute.test.ts`, `src/lib/stats/insights.test.ts`

**Interfaces:**
- Consumes: `getAirport`, `airportTz` (Task 1); `legUtcRange`, `splitDayNightMinutes` (Task 2).
- Produces: `computeRosterStats(input: { entries: ScheduleEntry[]; history: ScheduleEntry[]; period: { start: string; end: string }; base?: string | null }): RosterStats` e `buildInsights(stats: RosterStats): string[]` (máx. 5). `RosterStats` em `types.ts`:
  `summary { flownMinutes, dutyMinutes, daysOff, efficiency /*0–1 ou null*/, earlyReports, lateLandings }`,
  `quality { nightsHome, nightsAway, layovers, layoversByCity: {city,count}[], weekendsFree, weekendsTotal, longestOffBlock, longestWorkStreak, base, baseInferred: boolean }`,
  `flights { legs, deadheads, deadheadMinutes, distanceKm, earthLaps, topRoute: {from,to,count}|null, busiestDay: {date,legs}|null, dayMinutes, nightMinutes, flightDays, legsPerDay, avgLegMinutes, longestLeg, shortestLeg /*{from,to,minutes}|null*/ }`,
  `airports { distinct, newAirports: string[], byCount: {iata,count}[], routes: {from,to,count}[] /*top 5*/, mapLegs: {from,to}[] }`,
  `aircraft { dominantType: {type, share}|null, byType: {type,count}[] }`.

Regras (do spec): voadas = soma `flight_hours` dos voos OP; jornada = soma `duty_hours`; folgas = datas distintas com `entry_type === 'day_off'`; madrugada = voos com `report_time < '06:00'`; pouso tarde = voo com `arrival_time >= '23:00'` ou `crosses_midnight`; local da noite = destino do último voo até aquele dia (começa na base); noite em casa = cidade do local igual à cidade da base; fim de semana livre = sábado e domingo do período sem entrada de trabalho (`flight`, `reserve`, `standby`, `on_call`, `training`); distância = haversine de todos os voos (OP e PS) com os dois aeroportos conhecidos; base sem configuração = estação de partida mais comum da primeira perna de cada `pairing_code`/dia.

- [ ] **Step 1: Fixture sintética** `sample-month.ts` (período 2026-03-01..2026-03-31, base BSB), `ScheduleEntry[]`:
  1. 03-03 BSB→GRU **OP** 08:00→09:30, `flight_hours` 1.5, `report_time` 05:30, `duty_hours` 6, 320
  2. 03-03 GRU→BSB **PS** 11:00→12:30, 1.5, 320
  3. 03-04 BSB→MAO **OP** 21:00→23:00, 3, `report_time` 20:00, `duty_hours` 4, 321
  4. 03-05 MAO→BSB **OP** 01:00→05:00, 3, `report_time` 00:00, `duty_hours` 5, 321
  5. 03-10 BSB→GRU **OP** 10:00→11:30, 1.5, `report_time` 09:00, `duty_hours` 3.5, 320
  6. 03-10 GRU→BSB **OP** 13:00→14:30, 1.5, 320
  7. 03-11 ASB (`is_flight` false, `entry_type` `reserve`, `duty_hours` 6)
  8. 03-13, 03-14, 03-15 DO (`entry_type` `day_off`)
- [ ] **Step 2: Tests** (`compute.test.ts`), valores exatos: `legs 5`, `deadheads 1`, `deadheadMinutes 90`, `flownMinutes 630`, `dutyMinutes 1470`, `daysOff 3`, `efficiency ≈ 630/1470`, `earlyReports 2`, `lateLandings 1`; `layovers 1`, `layoversByCity [{city:'Manaus',count:1}]`, `nightsAway 1`, `nightsHome 30`; `weekendsFree 4`, `weekendsTotal 4`; `longestOffBlock 3`, `longestWorkStreak 3`; `airports.distinct 3`; `topRoute {from:'BSB',to:'GRU',count:2}` (empate → ordem alfabética de "origem→destino"); `busiestDay {date:'2026-03-03',legs:2}` (empate → data mais cedo; conta OP e PS); `flightDays 4`, `legsPerDay 1.25`, `avgLegMinutes 126`, `longestLeg {from:'BSB',to:'MAO',minutes:180}`, `shortestLeg {from:'BSB',to:'GRU',minutes:90}`; `dayMinutes 270`, `nightMinutes 420`; `aircraft.dominantType {type:'320', share≈4/6}`; `distanceKm` = 4×haversine(BSB,GRU) + 2×haversine(BSB,MAO) ±1%. Casos extras: entrada com `crosses_midnight` true e `arrival_time` '00:30' conta em `lateLandings`; mês vazio → zeros, `efficiency null`, `topRoute null`; voo com IATA 'XYZ' conta em `legs` e fica fora de `distanceKm`/`mapLegs`; `base` ausente → `baseInferred true`, `base 'BSB'`. `insights.test.ts`: contém "Teve 1 pernoite programado — 1 cidade." e, com `history` sem MAO antes do período, "Você estreou MAO este mês — já são 3 aeroportos operados."
- [ ] **Step 3:** FAIL. **Step 4:** implementar `compute.ts` e `insights.ts`. **Step 5:** PASS. **Step 6: Commit** `feat(stats): cálculo das estatísticas da escala`.

### Task 5: Tempo certo (previsão no pouso, METAR, unidades)

**Files:**
- Create: `src/lib/weather/wmo.ts`, `src/lib/weather/forecast.ts`, `src/lib/weather/metar.ts`, `src/lib/weather/*.test.ts`, `api/metar.ts`, `src/hooks/useLegWeather.ts`
- Modify: `src/hooks/useAirportWeather.ts` (usar `wmo.ts`, `wind_speed_unit=kn`, `fetchMetar`, `getAirport`), `src/components/flight/DutyFlightsSection.tsx`, `src/components/flight/FlightCard.tsx`, `src/components/dashboard/DashboardNextPresentationCard.tsx`

**Interfaces:**
- Produces: `wmoCondition(code: number): { label: string; emoji: string }`; `pickHourly(hourly: { time: string[]; temperature_2m: number[]; weather_code: number[]; wind_speed_10m: number[]; wind_direction_10m: number[] }, date: string, hhmm: string): { temp; code; windKt; windDir } | null` (hora local mais próxima); `forecastAtArrival(iata: string, date: string, hhmm: string, now?: Date): Promise<LegForecast | null>` (`null` se fora de [agora, agora+16 dias] ou aeroporto desconhecido); `fetchMetar(icao: string): Promise<string>` (`CapacitorHttp.get` quando nativo, `fetch('/api/metar?ids=ICAO')` na web); `metarTempC(raw: string): number | null`; `useLegWeather(legs: { key: string; iata: string; date: string; time: string }[]): Record<string, LegForecast & { flightCategory; metarRaw }>`.

- [ ] **Step 1: Tests:** `wmoCondition(80).label === 'Pancadas de chuva'`, `51` → `'Garoa'`, `61` → `'Chuva'`, `95` → `'Trovoada'`, `0` → `'Céu limpo'`; `pickHourly` com horas 19:00/20:00/21:00 e pouso `20:10` → hora 20:00; `forecastAtArrival` com `now` = 2026-11-19 e pouso 2026-12-20 → `null`; pouso ontem → `null`; URL pedida contém `wind_speed_unit=kn` e `timezone=America%2FRecife` para REC (mock de `fetch`); `metarTempC('METAR SBBR 191500Z 33006KT 9999 BKN030 27/18 Q1018') === 27`, `M02/M05` → `-2`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar; `api/metar.ts` (Vercel, Node) repassa `ids` validado por `/^[A-Z]{4}(,[A-Z]{4})*$/` para `https://aviationweather.gov/api/data/metar?ids=…&format=raw` e responde texto com `Cache-Control: s-maxage=300`. **Step 4:** PASS.
- [ ] **Step 5:** Cartões passam a usar `useLegWeather` com a data/hora do pouso de cada perna; o rótulo vira "Previsão no pouso em SBBR às 20:00"; sem previsão, o bloco de tempo não aparece (o METAR/categoria continua). `DashboardNextPresentationCard` idem. Teste de componente: `FlightCard` sem previsão não mostra "°C".
- [ ] **Step 6:** `npx vitest run` todo verde. **Step 7: Commit** `fix(tempo): previsão na hora do pouso, vento em nós, METAR e condições corretas`.

### Task 6: Tela Estatísticas e barra de baixo

**Files:**
- Create: `src/pages/StatsPage.tsx`, `src/components/stats/StatsPeriodBar.tsx`, `src/components/stats/StatsSections.tsx`, `src/components/stats/RouteMap.tsx`, `src/pages/StatsPage.test.tsx`
- Modify: `src/App.tsx` (rota lazy `/estatisticas`), `src/components/AppLayout.tsx` (barra), `package.json`

**Interfaces:**
- Consumes: `useRosterHistory` (Task 3), `computeRosterStats`, `buildInsights` (Task 4), `getAirport` (Task 1); base de `user_settings.base_airport` (consulta existente do perfil/configurações).
- Produces: rota `/estatisticas`; `StatsPage` com abas `Mês | Ano | Sempre` e setas; `RouteMap({ legs: {from,to}[] })`.

- [ ] **Step 1:** `npm i d3-geo topojson-client world-atlas && npm i -D @types/d3-geo @types/topojson-client`.
- [ ] **Step 2: Tests** `StatsPage.test.tsx` (mock de `useRosterHistory` com a fixture da Task 4): mostra "Resumo", "Qualidade de vida", "Voos", "Aeroportos", "Aeronaves", "Descobertas"; trocar para "Ano" recalcula o período; mês vazio mostra "Sem voos neste mês". Em `AppLayout`: barra tem "Estatísticas" (`/estatisticas`) e "Salário" (`/salary`), e não tem "MetCenter".
- [ ] **Step 3:** FAIL. **Step 4:** implementar no visual atual (verde/amarelo, cartões arredondados, sem cores fixas de azul), barras horizontais simples (sem recharts quando uma barra de CSS basta); `RouteMap` em SVG com `geoMercator().fitExtent` sobre os aeroportos do período, países do `world-atlas/countries-110m.json`, botões − + "Enquadrar". Base ausente: cartão "Em que cidade você mora?" com link para `/settings`. **Step 5:** PASS. **Step 6: Commit** `feat: tela de Estatísticas no lugar do MetCenter`.

### Task 7: Faixa de tempo no Início

**Files:**
- Create: `src/components/dashboard/WeatherStrip.tsx`, `src/components/dashboard/WeatherStrip.test.tsx`
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `useAirportWeather` (atual, corrigido na Task 5) para a base; `useLegWeather` para o próximo pouso.
- Produces: `WeatherStrip({ base: string | null; nextArrival: { iata; date; time } | null })`.

- [ ] **Step 1: Test:** mostra "Agora em BSB 27°C" (temperatura do METAR quando houver), "Pouso em REC 20:00 · 29°C" quando houver previsão, link "METAR/TAF" para `/weather`; sem previsão, não mostra o pouso.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (uma linha, texto pequeno, não compete com o cartão da próxima apresentação). **Step 4:** PASS. **Step 5: Commit** `feat: tempo discreto no Início com link para METAR/TAF`.

### Task 8: Conferência com a escala real e no app

**Files:** nenhum arquivo novo commitado.

- [ ] **Step 1:** Teste local temporário (não commitado) que roda `parseIflightRosterReport` + `computeRosterStats` no JSON real em `…/scratchpad/iflight-capture/22-loadRosterReport.txt` e imprime o resumo; conferir à mão: 40 voos (38 OP + 2 PS), dias de folga, pernoites (MAO/Manaus, GRU/São Paulo, BEL/Belém…), aeroportos (inclui AEP, CAC, MCP), madrugadas.
- [ ] **Step 2:** `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint src`, `npx vitest run` → tudo verde.
- [ ] **Step 3:** build + APK + emulador: abrir Estatísticas (Mês/Ano/Sempre), Escala (tempo do pouso com rótulo de previsão), Início (faixa de tempo), conferir que o METAR aparece (categoria diferente de UNKN).
- [ ] **Step 4: Commit** `chore: sincroniza Android com o build` (só se `android/` mudou).

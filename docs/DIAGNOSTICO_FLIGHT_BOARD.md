# Diagnóstico — Flight Board Pro (voos live)

## 1. Fluxo real da chamada (GET, não POST)

O frontend usa **GET** com query params. O `flight-status` não recebe POST.

| Modo | Params enviados |
|------|-----------------|
| **Minha escala** | `airportCode`, `scheduledDepartureDate`, `boardMode=my_schedule`, `carrierCode`, `flightNumber` (opcional) |
| **Base operacional** | `airportCode`, `scheduledDepartureDate`, `boardMode=airport_base`, `carrierCode`, `flightNumber` (opcional) |

**Headers obrigatórios:** `Authorization: Bearer <access_token>` (sessão do usuário). Sem token → 401.

---

## 2. Diferença entre estados do endpoint

| Estado | Significado | Ação |
|--------|-------------|------|
| **Endpoint existe** | GET sem auth retorna 401 (não 404) | Função deployada |
| **Endpoint responde** | GET com auth retorna 200 | Auth ok |
| **Endpoint retorna dados** | `flights.length > 0` | Dados disponíveis |
| **Endpoint retorna vazio** | `flights.length === 0` | Ver motivo (ver seção 4) |
| **Dados sem match live** | `flights.length > 0` mas `openSkyMatchCount === 0` | OpenSky não encontrou posição ao vivo |

---

## 3. Logs no console (F12)

Após as alterações, o frontend grava:

- `[FlightBoardPro] pipeline:fetch_attempt` — payload enviado
- `[FlightBoardPro] pipeline:fetch_result` — flightCount, openSkyMatchCount, fallbackReason
- `[FlightBoardPipeline]` — pipeline final
- `[FlightBoardAirportMode]` — base operacional

Use: **F12 → Console** e filtre por `FlightBoardPro` ou `flight-status`.

---

## 4. Causas prováveis de “não aparece live”

### Minha escala

| Causa | Condição | Solução |
|-------|----------|---------|
| **Sem sessão** | `meta.reason === "no_session"` | Fazer login |
| **Sem roster** | Edge retorna `count: 0`, `fallbackReason: "no_roster_or_no_entries_for_date"` | Importar PDF de escala |
| **Sem schedule_entries** | Roster existe mas sem voos na data | Conferir data e escala |
| **Janela temporal** | Voos futuros → OpenSky `/states/all` não tem match | Normal; posição só para voos ativos |
| **Sem match OpenSky** | `openSkyMatchCount === 0` | Voo fora do radar ou não transmitindo |

### Base operacional

| Causa | Condição | Solução |
|-------|----------|---------|
| **Sem credenciais** | `airportBaseReason: "opensky_credentials_required"` | Configurar OPENSKY_CLIENT_ID e OPENSKY_CLIENT_SECRET |
| **Janela vazia** | `reasonZeroResults: "opensky_empty_for_window"` | OpenSky só retorna voos que **já partiram/chegaram** no intervalo [begin, end] |
| **Data futura** | Data > hoje | Sem dados; OpenSky é histórico |
| **Aeroporto desconhecido** | `airportBaseReason: "unknown_airport_iata"` | Incluir IATA em IATA_TO_ICAO na edge |

---

## 5. Janela temporal do OpenSky

- **`/flights/departure` e `/flights/arrival`**: retornam voos que **já partiram/chegaram** em [begin, end].
- **`/states/all`**: posição em tempo real de aeronaves transmitindo ADS-B.
- **Base operacional**: usa `flights/departure` e `flights/arrival` — só voos realizados no dia.
- **Minha escala**: usa roster + `states/all` para posição; sem match = voo fora da janela ou sem transmissão.

**UX:** Mensagem exibida: *"Dados ao vivo disponíveis apenas para voos ativos ou próximos da operação."*

---

## 6. Correções aplicadas

1. **Logs detalhados** — payload, flightCount, openSkyMatchCount, fallbackReason
2. **`diagnostic` na edge** — `openSkyMatchCount`, `rosterFlights`, `fallbackReason`, `rawDepCount`, `rawArrCount`
3. **Banner de janela temporal** — explica limitação do OpenSky
4. **Fallback de anon key** — FlightStatusPanel e flightStatusService usam `VITE_SUPABASE_PUBLISHABLE_KEY` se `VITE_SUPABASE_ANON_KEY` não existir

---

## 7. Como validar com caso real

1. **Minha escala com voos live**
   - Importar PDF com voos de **hoje**
   - Escolher data de hoje e aeroporto dos voos
   - Verificar voo próximo de decolar (ex.: 1h) ou em voo
   - Abrir Console e conferir `openSkyMatchCount > 0` quando o voo estiver no ar

2. **Base operacional**
   - Definir data de **hoje**
   - GRU ou CGH (alta movimentação)
   - Credenciais OpenSky configuradas
   - Se ainda manhã cedo no Brasil, pode haver poucos voos (UTC)
   - Após meio-dia (horário Brasil), deve retornar vários voos

3. **Teste rápido via curl** (precisa de token)

```powershell
$token = "SEU_ACCESS_TOKEN_AQUI"
curl -s "https://fbryqzwykdhnmskfectg.supabase.co/functions/v1/flight-status?airportCode=GRU&scheduledDepartureDate=2025-03-21&boardMode=airport_base" -H "Authorization: Bearer $token"
```

---

## 8. Checklist de diagnóstico

```
[ ] Usuário logado? (sessão com access_token)
[ ] .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou ANON_KEY)
[ ] Console: pipeline:fetch_attempt com payload correto
[ ] Console: fetch_result com flightCount e openSkyMatchCount
[ ] Minha escala: tem roster importado e schedule_entries para a data?
[ ] Base operacional: OPENSKY_CLIENT_ID e OPENSKY_CLIENT_SECRET na edge?
[ ] Base operacional: data = hoje (OpenSky só retorna voos já realizados)
[ ] Edge: logs no Supabase Dashboard → Edge Functions → flight-status → Logs
```

# Correção definitiva — Flight Board Pro (cors_or_connection)

## Causa exata do erro

O banner "Falha de rede ao contatar o enriquecimento (cors_or_connection)" ocorria porque:

1. **CORS incompleto na edge** — faltava `Access-Control-Allow-Methods` no preflight (OPTIONS), fazendo o browser bloquear a requisição.
2. **Uso de `fetch` direto** — o `flightProvider` usava `fetch()` manual com URL e headers, mais propenso a falhas cross-origin que o cliente Supabase.
3. **Diagnóstico genérico** — erros como `Failed to fetch` eram sempre classificados como `cors_or_connection` sem separar auth, timeout, 404 etc.

---

## Arquivos e trechos alterados

### 1. `supabase/functions/flight-status/index.ts`

- **CORS:** inclusão de `Access-Control-Allow-Methods: GET, POST, OPTIONS` e `Access-Control-Max-Age`.
- **POST:** leitura de `airportCode`, `scheduledDepartureDate`, `boardMode`, `carrierCode`, `flightNumber` do body quando `method === "POST"`.
- **Logs:** log de entrada com `method`, `hasAuth`, `hasApikey`, `url` antes de tratar auth.

### 2. `src/services/flightBoard/flightProvider.ts`

- **Troca de fetch por invoke:** uso de `supabase.functions.invoke("flight-status", { method: "POST", body: {...} })` em vez de `fetch()`.
- **Auth:** uso automático do token da sessão pelo cliente Supabase.
- **Erros:** distinção entre `FunctionsFetchError` (cors/connection), `FunctionsHttpError` (401, 404, 500), timeout e outros.
- **Logs:** payload enviado, `hasData`, `hasError`, `errorName`, `errorMessage`, `likelyCause`.

### 3. `src/components/flight-board/FlightBoard.tsx`

- **Banners:** mensagens específicas para 401 (auth), 404 (função não encontrada), timeout, CORS.
- **Fallbacks:** detalhes de erro mais claros em vez do genérico `cors_or_connection`.

### 4. `src/lib/aviation-api.ts`

- Migração de GET para POST com body alinhado à edge.

---

## Como a função passa a ser chamada

| Antes | Depois |
|-------|--------|
| `fetch(url, { method: "GET", headers: { apikey, Authorization } })` | `supabase.functions.invoke("flight-status", { method: "POST", body: {...} })` |
| URL: `https://xxx.supabase.co/functions/v1/flight-status?airportCode=...` | Body: `{ airportCode, scheduledDepartureDate, boardMode, carrierCode?, flightNumber? }` |
| Headers manuais | Cliente Supabase envia `apikey` e `Authorization` com token da sessão |

A edge continua aceitando **GET** com query params (ex.: Painel de voos, curl).

---

## Como validar no navegador

1. **Deploy da edge:**
   ```powershell
   npm run deploy:flight-status
   ```

2. **Fazer login** no app (a sessão deve estar ativa).

3. **Abrir o Flight Board** (Minha escala ou Base operacional).

4. **Console (F12):**
   - `[FlightBoardPro] pipeline:fetch_attempt` com `method: "POST"`.
   - `[FlightBoardPro] pipeline:fetch_response` com `hasData: true` e sem `hasError` se estiver ok.
   - `[FlightBoardPro] pipeline:fetch_result` com `flightCount` e `openSkyMatchCount`.

5. **Network (F12):**
   - Requisição POST em `.../functions/v1/flight-status` com status 200.
   - Headers `apikey` e `Authorization: Bearer ...` presentes.
   - Response JSON com `flights`, `count`, etc.

6. **Banner de fallback:** não deve aparecer "cors_or_connection" quando a edge estiver acessível. Em caso de sucesso, o banner some ou mostra algo como "sem match live" (esperado).

---

## Confirmação

- Ao usar `supabase.functions.invoke` com POST e corpo, o cliente Supabase:
  - usa a URL configurada em `VITE_SUPABASE_URL`
  - envia o token de sessão automaticamente
  - trata CORS da mesma forma que o resto do SDK

- Os headers CORS na edge garantem que o preflight (OPTIONS) seja aceito pelo navegador.

- Com a URL e sessão corretas, o banner `cors_or_connection` não deve mais aparecer quando a chamada estiver correta.

---

## Cenários de erro mapeados

| Cenário | Meta reason | Banner / mensagem |
|---------|-------------|-------------------|
| Função não encontrada | `http_error` 404 | "Função flight-status não encontrada (404)" |
| Auth ausente/expirada | `http_error` 401 | "Faça login para usar o enriquecimento ao vivo" |
| Erro interno da edge | `http_error` 5xx | "Servidor retornou HTTP 5xx" |
| CORS / conexão | `network`, `cors_or_connection` | "Falha de rede (CORS ou conexão)" |
| Timeout | `network`, `timeout_25s` | "Falha de rede (timeout)" |
| Resposta vazia | `ok`, `flightCount: 0` | "Nenhum voo retornado..." ou "OpenSky: sem match..." |

# Checklist final — Migração EscalaX para fbryqzwykdhnmskfectg

## Status da configuração

- **Projeto destino:** `fbryqzwykdhnmskfectg`
- **URL base:** `https://fbryqzwykdhnmskfectg.supabase.co`
- **Código:** configurado para o novo projeto
- **Ação obrigatória:** ajustar `.env` ou `.env.local` manualmente

---

## 1. Variáveis de ambiente (OBRIGATÓRIO)

Edite `.env` ou `.env.local` e defina:

```env
VITE_SUPABASE_URL=https://fbryqzwykdhnmskfectg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon public do Dashboard>
```

Onde obter a chave: **Supabase Dashboard** → projeto **fbryqzwykdhnmskfectg** → **Settings** → **API** → **anon public**.

> Se `.env` ou `.env.local` ainda tiver `tmqpwwpzhrdvkerhnilr`, o app continuará usando o projeto antigo.

---

## 2. Comandos executáveis

### 2.1 Rodar migrations

```bash
npx supabase db push --project-ref fbryqzwykdhnmskfectg
```

### 2.2 Deploy das edge functions

```bash
npm run deploy:functions
```

Ou por função:

```bash
npm run deploy:flight-status
npm run deploy:send-support-email
```

### 2.3 Configurar secrets

```bash
npx supabase secrets set OPENSKY_CLIENT_ID=seu_id OPENSKY_CLIENT_SECRET=sua_secret --project-ref fbryqzwykdhnmskfectg
```

### 2.4 Validar endpoint flight-status

```bash
curl -s -o /dev/null -w "%{http_code}" "https://fbryqzwykdhnmskfectg.supabase.co/functions/v1/flight-status"
```

Esperado: **401** (não 404)

### 2.5 Rodar local

```bash
npm install
npm run dev
```

---

## 3. Tabelas e buckets (via db push)

> O EscalaX usa `schedule_entries` (não existe tabela `schedule_events`).

| Tabela / bucket | Uso |
|-----------------|-----|
| `profiles` | Perfil do usuário |
| `schedule_entries` | Segmentos de voo |
| `imported_rosters` | Roster importado |
| `user_settings` | Preferências (base, etc.) |
| `documents` | Metadados de documentos |
| `feedback_messages` | Formulário de suporte |
| `flight_swap_offers` | Ofertas de troca |
| `flight_swap_proposals` | Propostas de troca |
| `flight_swap_messages` | Mensagens de troca |
| `notifications` | Notificações |
| `portal_connections` | Portal sync |
| `portal_sync_runs` | Rodadas de sync |
| Bucket `crew-rosters` | PDFs de escala |
| Bucket `documents` | Documentos |
| Bucket `avatars` | Avatares |

---

## 4. Secrets necessárias

| Secret | Obrigatória | Função |
|--------|-------------|--------|
| `OPENSKY_CLIENT_ID` | Sim | flight-status |
| `OPENSKY_CLIENT_SECRET` | Sim | flight-status |
| `SMTP_HOST` | Opcional | send-support-email |
| `SMTP_PORT` | Opcional | send-support-email |
| `SMTP_USER` | Opcional | send-support-email |
| `SMTP_PASS` | Opcional | send-support-email |
| `SUPPORT_TO_EMAIL` | Opcional | send-support-email |

Sem SMTP, a função `send-support-email` grava em `feedback_messages`, mas não envia e-mail.

---

## 5. Checklist de validação

```
[ ] .env / .env.local com URL e anon key do fbryqzwykdhnmskfectg
[ ] npx supabase db push --project-ref fbryqzwykdhnmskfectg
[ ] npm run deploy:functions
[ ] npx supabase secrets set OPENSKY_CLIENT_ID=... OPENSKY_CLIENT_SECRET=... --project-ref fbryqzwykdhnmskfectg
[ ] curl flight-status retorna 401
[ ] npm run dev inicia sem erro
[ ] Login/cadastro funciona
[ ] Flight Board — Minha escala: exibe voos da escala
[ ] Flight Board — Base operacional: não cai em 404
[ ] Upload de PDF (crew-rosters) funciona
```

---

## 6. Arquivos que dependem do Supabase

| Arquivo | Dependência |
|---------|-------------|
| `src/integrations/supabase/client.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `src/services/flightBoard/flightProvider.ts` | `VITE_SUPABASE_URL`, anon key |
| `src/services/flightBoard/flightStatusService.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `src/components/FlightStatusPanel.tsx` | `VITE_SUPABASE_URL`, anon key |
| `src/lib/services/support-service.ts` | `supabase.functions.invoke` (usa client) |
| `src/lib/pdf-import.ts` | `supabase` (storage, tables) |
| `src/lib/auth-context.tsx` | `supabase.auth` |
| Demais hooks/pages | `supabase` via client |

Nenhum desses arquivos referencia o projeto antigo.

---

## 7. Edge functions

- `flight-status`: usa `Deno.env.get` (injetado pelo Supabase)
- `send-support-email`: idem

Nenhuma função tem referência ao projeto antigo.

---

## 8. Confirmação final

Após seguir o checklist:

- O app usa apenas o projeto **fbryqzwykdhnmskfectg**
- O projeto **tmqpwwpzhrdvkerhnilr** não é mais utilizado pelo código
- Flight Board Pro (Minha escala e Base operacional) deve funcionar com o novo projeto
- O endpoint `/functions/v1/flight-status` deve retornar 401 (função publicada)

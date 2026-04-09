# Keep-alive Supabase (plano Free)

Objetivo: gerar **atividade mínima** (invocação da Edge Function + RPC Postgres `SELECT now()`) para reduzir risco de pausa por inatividade no plano Free.  
**Nota:** a política exata de pausa depende da Supabase; isto não substitui monitorização nem garantias contratuais.

## O que conta como atividade

- Pedido HTTP à Edge Function (runtime Deno no projeto).
- Chamada PostgREST/RPC `keep_alive_ping` → execução leve na base Postgres.
- Isto é tráfego real no projeto (não é apenas um “ping” vazio ao domínio).

## O que foi implementado

| Peça | Descrição |
|------|-----------|
| Migration `20260428100000_keep_alive_ping.sql` | RPC `public.keep_alive_ping()` — só `service_role` |
| Edge Function `keep-alive` | Header `x-keep-alive-secret`; resposta com `Cache-Control: no-store` |
| GitHub Actions | Cron diário: POST, timeout 45s, valida HTTP 200 + `ok:true` + `status:"ok"` (corpo **não** vai para o log) |

## Variáveis de ambiente

### Supabase (Edge Function — Secrets)

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `KEEP_ALIVE_SECRET` | Sim | Valor longo e aleatório (ex.: 32+ caracteres). **Não** commitar. |
| `SUPABASE_URL` | Automático | Injetado pelo runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Automático | Injetado pelo runtime |

### GitHub Actions (Secrets do repositório)

| Secret | Valor |
|--------|--------|
| `KEEP_ALIVE_URL` | `https://<PROJECT_REF>.supabase.co/functions/v1/keep-alive` |
| `KEEP_ALIVE_SECRET` | O **mesmo** valor configurado no Supabase |

## Deploy

1. Aplicar migration: `supabase db push` (ou SQL Editor no dashboard).
2. Definir secret na Supabase: `supabase secrets set KEEP_ALIVE_SECRET="<YOUR_SECRET>" --project-ref <PROJECT_REF>`
3. Deploy da função: `npm run deploy:keep-alive`

## Comando único (após login Supabase CLI)

Substitua `<PROJECT_REF>` e use um secret forte (ex.: `openssl rand -hex 32`).

```bash
cd /caminho/para/crew-schedule-buddy
supabase link --project-ref <PROJECT_REF>
supabase db push
supabase secrets set KEEP_ALIVE_SECRET="<YOUR_SECRET>" --project-ref <PROJECT_REF>
npm run deploy:keep-alive
```

## Exemplo `curl` (teste manual)

Substitua URL e secret; **não** cole o secret em issues nem em logs partilhados.

```bash
curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/keep-alive" \
  -H "Content-Type: application/json" \
  -H "x-keep-alive-secret: <YOUR_KEEP_ALIVE_SECRET>" \
  -d '{}'
```

Resposta esperada (HTTP 200):

```json
{"ok":true,"status":"ok","timestamp":"…","source":"keep-alive"}
```

## Logs no Supabase (confirmar execução)

No dashboard: **Edge Functions** → **keep-alive** → **Logs**.

Eventos estruturados (sem valor de secret):

| `event` | Significado |
|---------|-------------|
| `keep_alive_ping_ok` | RPC correu; inclui `timestamp` |
| `keep_alive_auth_failed` | Header secreto incorreto ou ausente |
| `keep_alive_db_failed` | Falha na RPC (inclui `code` genérico) |
| `keep_alive_misconfigured` | Secret/runtime em falta |

## Cache / CDN

- Pedidos são **POST** com corpo JSON — normalmente **não** são cacheados por CDN.
- Respostas JSON incluem `Cache-Control: no-store` e `Pragma: no-cache` como reforço.
- Evite trocar POST por GET com secret na query (cache + vazamento em URLs/referrers).

## Segurança

- O **service_role** só existe no runtime da Edge Function, nunca no frontend.
- Sem header `x-keep-alive-secret` correto → **401**.
- RPC `keep_alive_ping` **não** é executável por `anon`/`authenticated` (apenas `service_role`).
- Não coloque o secret em URLs (query string) nem em repositórios.
- GitHub Actions **não** imprime o corpo da resposta nem o valor do header no passo padrão; evite `ACTIONS_STEP_DEBUG=true` em produção (pode verbosar variáveis).

## Ativar agendamento (GitHub Actions)

1. **Settings** → **Secrets and variables** → **Actions** → criar `KEEP_ALIVE_URL` e `KEEP_ALIVE_SECRET`.
2. O workflow `.github/workflows/supabase-keep-alive.yml` corre **1x/dia** e via **workflow_dispatch**.

### Alternativas

| Opção | Quando usar |
|-------|-------------|
| **cron-job.org** | Job HTTP POST com header custom (confirmar plano). |
| **UptimeRobot** | Grátis costuma ser GET — pouco adequado a header secreto. |

## Checklist de validação

- [ ] Migration aplicada (`keep_alive_ping` visível no SQL).
- [ ] `KEEP_ALIVE_SECRET` definido no Supabase.
- [ ] `npm run deploy:keep-alive` sem erros.
- [ ] `curl` manual → HTTP 200 e JSON com `ok` e `status`.
- [ ] Logs Supabase com `keep_alive_ping_ok` após chamada bem-sucedida.
- [ ] Secrets no GitHub (se usar Actions) e workflow verde.

## Confirmar que está a funcionar

- GitHub **Actions** → última execução verde; mensagem `keep-alive OK (HTTP 200)`.
- Supabase **Edge Functions** → **keep-alive** → **Logs** com `keep_alive_ping_ok`.

# Retenção do histórico de escalas importadas

Objetivo: manter o **histórico de versões** (`imported_rosters` — cada linha é uma escala/PDF
importado, geralmente um mês) por pelo menos **~3 meses** e depois apagar automaticamente,
para não acumular PDFs e registros antigos indefinidamente.

## Regras de retenção

| Regra | Comportamento |
|-------|----------------|
| Idade | Apaga importações com `created_at` mais antigo que `ROSTER_HISTORY_RETENTION_DAYS` (default **90 dias**) |
| Escala ativa | **Nunca** apaga a linha com `is_active = true`, não importa a idade |
| Última do utilizador | **Nunca** apaga a importação mais recente de cada utilizador, mesmo que nenhuma esteja marcada ativa (rede de segurança) |

Ao apagar uma versão, três coisas são removidas juntas:
1. Os `schedule_entries` ligados a essa importação (`roster_id`).
2. O PDF correspondente no Storage (bucket `crew-rosters`).
3. A linha em `imported_rosters`.

## O que foi implementado

| Peça | Descrição |
|------|-----------|
| Edge Function `cleanup-roster-history` | Header `x-cleanup-secret`; roda a limpeza usando `service_role` |
| GitHub Actions | Cron semanal (segunda-feira), POST + validação de HTTP 200 + `ok:true` |

## Variáveis de ambiente

### Supabase (Edge Function — Secrets)

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `CLEANUP_ROSTER_HISTORY_SECRET` | Sim | Valor longo e aleatório (ex.: 32+ caracteres). **Não** commitar. |
| `ROSTER_HISTORY_RETENTION_DAYS` | Não | Dias de retenção mínima (default `90`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Automático | Injetados pelo runtime |

### GitHub Actions (Secrets do repositório)

| Secret | Valor |
|--------|--------|
| `ROSTER_CLEANUP_URL` | `https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-roster-history` |
| `ROSTER_CLEANUP_SECRET` | O **mesmo** valor configurado no Supabase |

## Deploy

```bash
cd /caminho/para/crew-schedule-buddy
supabase secrets set CLEANUP_ROSTER_HISTORY_SECRET="<SECRET_FORTE>" --project-ref <PROJECT_REF>
# Opcional — só se quiser mudar os 90 dias padrão:
# supabase secrets set ROSTER_HISTORY_RETENTION_DAYS=90 --project-ref <PROJECT_REF>
npm run deploy:cleanup-roster-history
```

Depois, em **Settings → Secrets and variables → Actions** no GitHub, crie `ROSTER_CLEANUP_URL`
e `ROSTER_CLEANUP_SECRET` para o workflow `.github/workflows/roster-history-cleanup.yml` rodar
automaticamente.

## Teste manual (curl)

```bash
curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-roster-history" \
  -H "Content-Type: application/json" \
  -H "x-cleanup-secret: <SEU_SECRET>" \
  -d '{}'
```

Resposta esperada:

```json
{"ok":true,"status":"ok","retentionDays":90,"deletedCount":0}
```

## Logs no Supabase

**Edge Functions → cleanup-roster-history → Logs**. Eventos: `cleanup_roster_history_ok`,
`cleanup_roster_history_noop`, `cleanup_roster_history_auth_failed`,
`cleanup_roster_history_misconfigured`, `cleanup_roster_history_entries_failed`,
`cleanup_roster_history_storage_failed`, `cleanup_roster_history_rosters_failed`.

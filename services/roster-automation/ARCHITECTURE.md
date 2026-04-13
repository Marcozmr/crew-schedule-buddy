# Serviço de automação de escala (EscalaX)

## Papel

Processo Node.js separado do frontend Vite e das Supabase Edge Functions. Executa Playwright contra o portal corporativo (fornecedor LATAM no código), persiste `storageState` por utilizador no disco do worker, descarrega o PDF CrewRosterReport e reutiliza o mesmo pipeline de importação que a app (`src/lib/pdf-import.ts`) via cliente service role.

## Fluxo de dados

1. O browser chama o HTTP deste serviço com `Authorization: Bearer <JWT Supabase>` (anon + sessão do utilizador).
2. O serviço valida o JWT com a chave anon e grava estado em `automation_sessions` / `automation_runs` (service role).
3. Playwright corre no servidor (idealmente `ROSTER_AUTOMATION_HEADLESS=0` em desenvolvimento para o utilizador ver o login/MFA).
4. Após PDF válido, `importPdfArrayBufferWithClient` envia para o bucket `crew-rosters`, cria `imported_rosters` e atualiza `user_roster_connection`.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | URL do projeto |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_*` | Validação JWT do utilizador |
| `SUPABASE_SERVICE_ROLE_KEY` | Escrita nas tabelas e Storage |
| `LATAM_PORTAL_LOGIN_URL` | URL de entrada do portal (igual ou espelho de `VITE_CORPORATE_PORTAL_LOGIN_URL`) |
| `ROSTER_AUTOMATION_DATA_DIR` | Raiz para `latam/<userId>/storage.json` |
| `ROSTER_AUTOMATION_PORT` | Default 8790 |
| `ROSTER_AUTOMATION_CORS_ORIGINS` | Origens permitidas (lista separada por vírgula) |
| `ROSTER_AUTOMATION_HEADLESS` | `0` para janela visível |

## Extensão a outros fornecedores

Adicionar `provider` em `automation_sessions`, pasta `src/providers/<id>/` e registar rotas em `src/index.ts`.

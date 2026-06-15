-- Armazena o storageState Playwright cifrado (AES-256-GCM) na base de dados
-- em vez de (apenas) no disco efémero do worker.
-- O blob é criado pelo endpoint POST /v1/latam/session/import (extensão Chrome).
-- O worker decifra em memória antes de passar ao browser.newContext() — nenhum ficheiro
-- temporário com cookies é escrito em disco.

ALTER TABLE public.automation_sessions
  ADD COLUMN IF NOT EXISTS encrypted_session_blob TEXT;

COMMENT ON COLUMN public.automation_sessions.encrypted_session_blob IS
  'StorageState Playwright (cookies LATAM/iFlight) cifrado em AES-256-GCM. '
  'Formato JSON: {iv, tag, data} em hex. Chave em SESSION_ENCRYPTION_KEY no worker.';

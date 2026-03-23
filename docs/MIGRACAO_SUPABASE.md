# Migração Supabase — EscalaX para projeto controlado

**Projeto destino:** `fbryqzwykdhnmskfectg`  
**Projeto origem (Lovable):** `tmqpwwpzhrdvkerhnilr`

---

## 1. Variáveis de ambiente (trocar manualmente)

**Arquivo:** `.env.local` (crie se não existir; **não edite** `.env.example` com valores reais)

Troque:

```env
# ANTES (projeto Lovable)
VITE_SUPABASE_URL=https://tmqpwwpzhrdvkerhnilr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ... (chave do projeto antigo)

# DEPOIS (projeto controlado)
VITE_SUPABASE_URL=https://fbryqzwykdhnmskfectg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ... (chave do projeto fbryqzwykdhnmskfectg)
```

**Onde obter a nova chave:**  
Supabase Dashboard → projeto `fbryqzwykdhnmskfectg` → Settings → API → **anon public**

---

## 2. Migrations

No projeto `fbryqzwykdhnmskfectg`, execute as migrations:

```bash
npx supabase db push --project-ref fbryqzwykdhnmskfectg
```

Ou, se preferir linkar primeiro:

```bash
npx supabase link --project-ref fbryqzwykdhnmskfectg
npx supabase db push
```

**Tabelas criadas:** profiles, user_settings, imported_rosters, schedule_entries, documents, feedback_messages, flight_swap_offers, flight_swap_proposals, portal_connections, notificações e demais do schema EscalaX.

---

## 3. Deploy das edge functions

```bash
npm run deploy:functions
```

Ou individualmente:

```bash
npm run deploy:flight-status
npm run deploy:send-support-email
```

---

## 4. Secrets no projeto fbryqzwykdhnmskfectg

**flight-status:**
```bash
npx supabase secrets set OPENSKY_CLIENT_ID=seu_id OPENSKY_CLIENT_SECRET=sua_secret --project-ref fbryqzwykdhnmskfectg
```

**send-support-email** (se usar envio de e-mail):
```bash
npx supabase secrets set \
  SMTP_HOST=smtp.exemplo.com \
  SMTP_PORT=587 \
  SMTP_USER=... \
  SMTP_PASS=... \
  SUPPORT_TO_EMAIL=support@escalax.app.br \
  SUPPORT_FROM_EMAIL=... \
  --project-ref fbryqzwykdhnmskfectg
```

Conferir:
```bash
npx supabase secrets list --project-ref fbryqzwykdhnmskfectg
```

---

## 5. Validação

### Login
1. Abra o app com `.env.local` já atualizado
2. Faça logout se estiver logado (sessão do projeto antigo não vale)
3. Cadastre-se ou faça login (e-mail/senha ou OAuth se configurado)
4. Confirme que o perfil carrega

### Flight Board
1. Importe uma escala ou use dados de teste
2. Abra o Flight Board em modo **Base operacional**
3. DevTools → Network: verifique chamada para `...fbryqzwykdhnmskfectg.../flight-status`
4. Deve retornar 200 (ou dados); não deve cair em fallback por 404

### Storage
1. Faça upload de um PDF de escala
2. Confirme que o arquivo aparece em Storage → `crew-rosters` no projeto fbryqzwykdhnmskfectg

### Endpoint flight-status (curl)
```bash
curl -s -o /dev/null -w "%{http_code}" "https://fbryqzwykdhnmskfectg.supabase.co/functions/v1/flight-status"
```
- `401` = função deployada (OK, falta token)
- `404` = função não deployada

---

## 6. Riscos conhecidos

| Risco | Mitigação |
|-------|------------|
| **Usuários do projeto antigo** | Novos usuários no novo projeto; re-cadastro necessário |
| **Dados do banco antigo** | Não migram automaticamente; começar do zero |
| **Lovable OAuth (Google/Apple)** | Pode exigir configurar providers no Auth do projeto fbryqzwykdhnmskfectg |
| **Storage (crew-rosters)** | Bucket criado pelas migrations; políticas RLS devem ser aplicadas |

---

## 7. O que depende do projeto Supabase

| Componente | Arquivo/Origem |
|------------|----------------|
| **Auth** | `src/lib/auth-context.tsx`, `src/integrations/lovable/index.ts` (OAuth) |
| **Banco** | `src/integrations/supabase/client.ts` → todas as chamadas `.from()` |
| **Storage** | `supabase.storage.from('crew-rosters')` em `pdf-import.ts` |
| **Edge functions** | `flight-status`, `send-support-email` — URL base do projeto |
| **URLs** | `VITE_SUPABASE_URL` → client + flightProvider + support-service |
| **Client** | `src/integrations/supabase/client.ts` |
| **Policies** | Definidas nas migrations (RLS) |

---

## 8. Checklist final

- [ ] `.env.local` atualizado com URL e anon key do projeto fbryqzwykdhnmskfectg
- [ ] `npx supabase db push --project-ref fbryqzwykdhnmskfectg` executado
- [ ] `npm run deploy:functions` executado
- [ ] Secrets OPENSKY (e SMTP, se usar) configuradas
- [ ] curl em flight-status retorna 401 (não 404)
- [ ] Login/cadastro funcionando no app
- [ ] Flight Board Base operacional sem fallback 404
- [ ] Upload de PDF e Storage ok (se testado)

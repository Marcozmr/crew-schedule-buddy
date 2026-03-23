# Supabase — Deploy e configuração do EscalaX

## Projeto Supabase do EscalaX

O frontend e as edge functions usam o **projeto controlado**:

| Item | Valor |
|------|-------|
| **Project Ref** | `fbryqzwykdhnmskfectg` |
| **URL Base** | `https://fbryqzwykdhnmskfectg.supabase.co` |
| **Endpoint flight-status** | `https://fbryqzwykdhnmskfectg.supabase.co/functions/v1/flight-status` |
| **Endpoint send-support-email** | `https://fbryqzwykdhnmskfectg.supabase.co/functions/v1/send-support-email` |

---

## 1. Variáveis de ambiente do frontend

Em `.env.local` (copie de `.env.example`):

```env
VITE_SUPABASE_URL=https://fbryqzwykdhnmskfectg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

- Obtenha a chave em: **Supabase Dashboard** → **Project fbryqzwykdhnmskfectg** → **Settings** → **API** → **anon public**.
- Não edite `.env.example` com valores reais; use apenas `.env.local`.

---

## 2. Deploy das edge functions

```bash
npm run deploy:functions
```

Ou individualmente:

```bash
npm run deploy:flight-status
npm run deploy:send-support-email
```

### Pré-requisitos

1. **Supabase CLI**: `npm i -g supabase` ou use `npx`
2. **Login**: `supabase login` (conta com acesso ao projeto fbryqzwykdhnmskfectg)

---

## 3. Secrets

```bash
supabase secrets set \
  OPENSKY_CLIENT_ID=seu_id \
  OPENSKY_CLIENT_SECRET=sua_secret \
  --project-ref fbryqzwykdhnmskfectg
```

**flight-status usa:** `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`.  
**send-support-email** pode precisar de SMTP (ver variáveis na função).

Conferir:

```bash
supabase secrets list --project-ref fbryqzwykdhnmskfectg
```

---

## 4. Validação

```bash
curl -s -o /dev/null -w "%{http_code}" "https://fbryqzwykdhnmskfectg.supabase.co/functions/v1/flight-status"
```

- `401` = função deployada  
- `404` = função não deployada

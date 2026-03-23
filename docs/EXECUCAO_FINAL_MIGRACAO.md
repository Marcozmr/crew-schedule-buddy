# Execução final — Migração fbryqzwykdhnmskfectg

## 1. Ordem exata de execução

| # | Etapa | O que fazer |
|---|-------|-------------|
| 1 | `.env.local` | Editar manualmente: URL e anon key do projeto fbryqzwykdhnmskfectg |
| 2 | Migrations | `npx supabase db push --project-ref fbryqzwykdhnmskfectg` |
| 3 | Secrets OpenSky | `npx supabase secrets set ...` (ID + Secret) |
| 4 | Deploy functions | `npm run deploy:functions` |
| 5 | Validar endpoint | `curl` em flight-status → deve retornar 401 |
| 6 | Subir local | `npm install` + `npm run dev` |

---

## 2. Comandos prontos (PowerShell)

### Passo 1 — .env.local (AÇÃO MANUAL)

Crie/edite `.env.local` com:

```
VITE_SUPABASE_URL=https://fbryqzwykdhnmskfectg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<cole aqui a anon key do Dashboard>
```

Onde pegar: Dashboard → fbryqzwykdhnmskfectg → Settings → API → anon public

---

### Passo 2 — Migrations

```powershell
npx supabase db push --project-ref fbryqzwykdhnmskfectg
```

---

### Passo 3 — Secrets OpenSky (substitua pelos seus valores)

```powershell
npx supabase secrets set OPENSKY_CLIENT_ID=SEU_ID OPENSKY_CLIENT_SECRET=SUA_SECRET --project-ref fbryqzwykdhnmskfectg
```

---

### Passo 4 — Deploy das functions

```powershell
npm run deploy:functions
```

---

### Passo 5 — Validar endpoint flight-status

```powershell
curl -s -o NUL -w "%{http_code}" "https://fbryqzwykdhnmskfectg.supabase.co/functions/v1/flight-status"
```

Resultado esperado no terminal: **401**

---

### Passo 6 — Rodar local

```powershell
npm install
```

```powershell
npm run dev
```

---

## 3. Checklist de validação no app

Após subir o app (`npm run dev`), valide:

| # | Teste | OK se... |
|---|-------|----------|
| 1 | Login/Cadastro | Consegue entrar ou criar conta (auth do novo projeto) |
| 2 | Dashboard | Abre sem erro, mostra dados ou tela inicial |
| 3 | Flight Board — Minha escala | Exibe voos da escala (ou “sem voos” se não houver escala) |
| 4 | Flight Board — Base operacional | Lista voos do aeroporto ou fallback; **nunca** 404 |
| 5 | Fallback da escala | Sem escala: UI mostra mensagem amigável, não quebra |
| 6 | Upload PDF | (Opcional) Enviar PDF em crew-rosters e ver importação funcionar |

---

## 4. Critérios objetivos de sucesso

| Etapa | Deu certo quando... |
|-------|---------------------|
| **Migration** | Comando termina com "Applying migration..." e sem erro; no Dashboard → SQL Editor, tabelas `profiles`, `schedule_entries`, `imported_rosters` existem |
| **Function deploy** | Terminal exibe "Deployed function flight-status" e "Deployed function send-support-email" sem erro |
| **Endpoint** | `curl` retorna **401** (não 404) |
| **Local** | `npm run dev` sobe em `http://localhost:5173` (ou outra porta) sem erro de Supabase |
| **Board** | Minha escala e Base operacional carregam sem tela de erro ou 404 |

---

## 5. Ações manuais que só você pode fazer

| Ação | Onde / como |
|------|-------------|
| Editar `.env.local` | Colocar URL e anon key do projeto fbryqzwykdhnmskfectg |
| Obter anon key | Dashboard Supabase → projeto fbryqzwykdhnmskfectg → Settings → API |
| Obter credenciais OpenSky | [OpenSky Network](https://opensky-network.org/) — criar conta e pegar Client ID / Secret |
| Habilitar Auth (se necessário) | Dashboard → Authentication → Providers — escolher Email, Google etc. |

---

## Resumo — sequência mínima

```
1. Editar .env.local (URL + anon key)
2. npx supabase db push --project-ref fbryqzwykdhnmskfectg
3. npx supabase secrets set OPENSKY_CLIENT_ID=... OPENSKY_CLIENT_SECRET=... --project-ref fbryqzwykdhnmskfectg
4. npm run deploy:functions
5. curl ...flight-status → deve retornar 401
6. npm install && npm run dev
7. Validar no browser: login, dashboard, Flight Board (Minha escala + Base operacional)
```

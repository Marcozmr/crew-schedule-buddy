# Conexão com o portal pelo celular — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar o iFlight da LATAM numa WebView do app, capturar o PDF da escala, importar com o leitor atual e, nas próximas vezes, sincronizar escondido com a sessão salva.

**Architecture:** Módulo novo `src/modules/device-portal/`: configuração do portal, script injetado na página, estado local e orquestração sobre `@capgo/inappbrowser` (já instalado na branch). Um card novo entra no topo de `RosterSourcesCard` só no app nativo.

**Tech Stack:** React 18 + TypeScript, Capacitor 8, `@capgo/inappbrowser@8.6.14`, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-18-conexao-portal-no-aparelho-design.md`

## Global Constraints

- URL de entrada: `https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage?companyId=LA`.
- Nunca definir user-agent customizado; nunca preencher campos de login.
- Caminho aprendido e estado ficam só em `localStorage` (chave `escalax.devicePortal.<id>`), nunca enviados ao servidor nem a logs.
- Card visível só quando `Capacitor.isNativePlatform()`.
- Selo de andamento com os textos: "Conectando ao portal", "Lendo sua escala", "Salvando no aparelho", "Pronto".
- Passo a passo exibido: "Menu ≡ → Roster → Roster Calendar → Roster Report".
- Navegação automática desiste após 20 s; sincronização escondida desiste após 45 s.
- Importação via `importPdfArrayBuffer(fileName, bytes, userId)` de `src/lib/pdf-import.ts`.

## Review Focus

- Tripulante fecha a tela no meio do login → resultado `cancelled`, estado não muda.
- Sessão expirada na sincronização (a página escondida cai em Google/Microsoft) → `login_required`, status `expired`, card mostra "Reconectar".
- Caminho aprendido devolve HTML em vez de PDF → `needs_connect` e caminho aprendido apagado.
- O mesmo PDF capturado duas vezes (XHR + blob) → importa uma vez só.
- Importação falha (leitor não entende o PDF) → `error` com a mensagem do leitor, WebView fechada, status não vira `saved`.

---

### Task 1: Configuração do portal e estado local

**Files:**
- Create: `src/modules/device-portal/providers.ts`, `src/modules/device-portal/session-store.ts`
- Test: `src/modules/device-portal/session-store.test.ts`, `src/modules/device-portal/providers.test.ts`

**Interfaces:**
- Produces:
  - `interface LearnedEndpoint { method: string; url: string; body?: string; contentType?: string }`
  - `interface DevicePortalProvider { id: string; title: string; startUrl: string; portalHost: RegExp; loginHost: RegExp; navSteps: RegExp[]; guideText: string }`
  - `const LATAM_IFLIGHT: DevicePortalProvider` (navSteps: `/roster\s*calendar|calend[aá]rio\s*do\s*elenco/i`, `/roster\s*report|crew\s*roster\s*report/i`)
  - `hostKind(provider, url: string): 'portal' | 'login' | 'other'`
  - `type PortalStatus = 'never' | 'saved' | 'expired'`
  - `interface PortalState { status: PortalStatus; lastSyncAt: string | null; learned: LearnedEndpoint | null; lastError: string | null }`
  - `loadPortalState(id): PortalState`, `savePortalState(id, patch: Partial<PortalState>): PortalState`, `resetPortalState(id): void`

- [ ] **Step 1: Testes que falham** — `hostKind(LATAM_IFLIGHT, 'https://accounts.google.com/x')` → `'login'`; `'https://login.microsoftonline.com/x'` → `'login'`; `'https://iflightla.ibsplc.aero/iflight-crew/web/x'` → `'portal'`; `'https://example.com'` → `'other'`; URL inválida → `'other'`. Estado: `loadPortalState('latam')` sem nada salvo → `{status:'never', lastSyncAt:null, learned:null, lastError:null}`; `savePortalState` mescla e persiste; `resetPortalState` volta ao inicial; `localStorage` que lança erro → `loadPortalState` devolve o inicial sem quebrar.
- [ ] **Step 2: Rodar** `npx vitest run src/modules/device-portal` → FAIL (módulos não existem).
- [ ] **Step 3: Implementar** os dois arquivos (leituras/escritas de `localStorage` em `try/catch`).
- [ ] **Step 4: Rodar** de novo → PASS.
- [ ] **Step 5: Commit** `feat(device-portal): configuração do iFlight e estado local`.

### Task 2: Script da página

**Files:**
- Create: `src/modules/device-portal/page-script.ts`
- Test: `src/modules/device-portal/page-script.test.ts`

**Interfaces:**
- Consumes: `LearnedEndpoint`, `DevicePortalProvider` (Task 1).
- Produces:
  - `buildPageScript(provider: DevicePortalProvider, opts: { autoNav: boolean }): string`
  - `buildReplayScript(endpoint: LearnedEndpoint): string`
  - `type PageMessage = { type: 'ready'; url: string } | { type: 'pdf'; base64: string; size: number; request: LearnedEndpoint | null } | { type: 'page'; url: string; title: string; errorHint?: string; navFound: boolean } | { type: 'replay-failed'; status: number; reason: string }`
  - Mensagens saem por `window.mobileApp.postMessage({ detail: PageMessage })` (com os mesmos fallbacks do `src/lab/iflight/hook-script.ts`).
  - A página escuta `window` `messageFromNative` com `detail: { label: string }` e mostra o texto no selo.

Reaproveitar do `src/lab/iflight/hook-script.ts`: ponte de envio com fila, ganchos de fetch/XHR/createObjectURL/window.open/clique em link, checagem `%PDF`, base64, deduplicação, lista de erros de login. Diferenças: o `pdf` leva `request` (método, URL completa, corpo string, content-type) da requisição que o originou; sem mensagens `net`; regex de navegação vem do provider (`source`/`flags` serializados).

- [ ] **Step 1: Testes que falham** (padrão do `hook-script.test.ts`: `new Function(script)()` com `window.mobileApp` e `fetch` falsos):
  - PDF via `fetch('https://iflightla.ibsplc.aero/r', {method:'POST', body:'a=1'})` → uma mensagem `pdf` com `request` `{method:'POST', url:'https://iflightla.ibsplc.aero/r', body:'a=1'}` e base64 começando com `JVBER` (`%PDF`).
  - Mesmo PDF por fetch e por `URL.createObjectURL(blob)` → só uma mensagem `pdf`.
  - Resposta `application/pdf` sem `%PDF` → nenhuma mensagem `pdf`.
  - `dispatchEvent(new CustomEvent('messageFromNative', {detail:{label:'Lendo sua escala'}}))` → elemento `#escalax-status` com esse texto.
  - Página com texto `app_not_configured_for_user` → `page.errorHint === 'app_not_configured_for_user'`.
  - `autoNav: true`, DOM com `<a>Roster Calendar</a>` e, depois do primeiro clique, `<button>Roster Report</button>` → os dois recebem clique em ordem (fake timers); `autoNav: false` → nenhum clique.
  - Sem achar botões em 20 s → elemento `#escalax-guide` com o texto do passo a passo.
  - `buildReplayScript({method:'GET', url:'https://iflightla.ibsplc.aero/r'})` com fetch devolvendo PDF → mensagem `pdf`; devolvendo HTML 200 → `replay-failed` com `reason: 'not_pdf'`.
- [ ] **Step 2: Rodar** `npx vitest run src/modules/device-portal/page-script.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `page-script.ts` (string ES5 via `String.raw`, como no lab).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `feat(device-portal): script da página com captura, selo e navegação`.

### Task 3: Orquestração (conectar / sincronizar / reset)

**Files:**
- Create: `src/modules/device-portal/portal-session.ts`
- Test: `src/modules/device-portal/portal-session.test.ts` (com `vi.mock('@capgo/inappbrowser')`: guarda listeners e expõe `emit(evento, dados)`)

**Interfaces:**
- Consumes: Tasks 1 e 2; `PdfImportResult` de `src/lib/pdf-import.ts`.
- Produces:
  - `type PortalStep = 'conectando' | 'lendo' | 'salvando' | 'pronto'`
  - `type PortalResult = { kind: 'imported'; parsedCount: number; insertedCount: number; duplicate: boolean } | { kind: 'login_required' } | { kind: 'needs_connect' } | { kind: 'cancelled' } | { kind: 'error'; message: string }`
  - `interface PortalDeps { importPdf(fileName: string, bytes: ArrayBuffer): Promise<PdfImportResult>; now?(): Date }`
  - `connectPortal(provider, deps, onStep: (s: PortalStep) => void): Promise<PortalResult>`
  - `syncPortal(provider, deps, onStep): Promise<PortalResult>`
  - `resetPortal(provider): Promise<void>` (fecha WebView, `clearAllCookies`, `resetPortalState`)

`connectPortal`: `openWebView` visível (`title`, `toolbarType: ToolBarType.COMPACT`, `isPresentAfterPageLoad: true`, `preShowScript` = script da página, `preShowScriptInjectionTime: 'documentStart'`, `openBlankTargetInWebView: true`, `handleDownloads: true`); reinjeta em `browserPageLoaded`; manda o rótulo do passo por `postMessage`. Primeira URL de portal → `lendo`; mensagem `pdf` → `salvando`, importa, salva `learned` (se houver `request`), `status:'saved'`, `lastSyncAt`, fecha, `pronto`. `closeEvent` antes disso → `cancelled` (ou `error` com o último `errorHint`, se houve). `downloadCompleted` com PDF → mesmo caminho do `pdf`, sem `learned`.

`syncPortal`: sem `learned` → `needs_connect`. Senão abre com `hidden: true`; primeira página carregada em host de login → fecha, `status:'expired'`, `login_required`; em host do portal → `executeScript(buildReplayScript(learned))`; `pdf` → importa como acima; `replay-failed` → `learned:null`, `needs_connect`; 45 s sem resposta → fecha, `error` "O iFlight não respondeu".

- [ ] **Step 1: Testes que falham** — um para cada linha da Review Focus mais: conectar feliz (passos `conectando, lendo, salvando, pronto`; `importPdf` chamado uma vez; estado `saved` com `learned`); sincronizar feliz (sem WebView visível: `openWebView` recebeu `hidden: true`; `importPdf` chamado); sincronizar sem `learned` → `needs_connect` sem abrir WebView; 45 s (fake timers) → `error`.
- [ ] **Step 2: Rodar** `npx vitest run src/modules/device-portal/portal-session.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `portal-session.ts`.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `feat(device-portal): conectar e sincronizar pelo aparelho`.

### Task 4: Card "iFlight — LATAM" e ligação na tela de fontes

**Files:**
- Create: `src/modules/device-portal/ui/DevicePortalCard.tsx`
- Modify: `src/modules/roster/ui/RosterSourcesCard.tsx` (renderizar o card no topo da lista de fontes, passando `onImported={handleImportComplete}`)
- Modify: `src/pages/SettingsPage.tsx` (link do lab vira "Diagnóstico do iFlight")
- Test: `src/modules/device-portal/ui/DevicePortalCard.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 e 3; `useAuth()` de `src/lib/auth-context.tsx`; `importPdfArrayBuffer`.
- Produces: `DevicePortalCard({ onImported?: () => void }): JSX.Element | null`

Conteúdo: título "iFlight — LATAM"; status com bolinha ("Não conectado" / "Sessão salva" / "Sessão expirada"); "Atualizado em dd/MM HH:mm"; botões: "Conectar iFlight" (`never`) ou "Sincronizar escala" + "Reconectar" (`saved`/`expired`); "Reset" com confirmação; lista dos 3 passos com ✓ durante a operação; mensagem de erro do último resultado (para `login_required`: "Sessão expirada. Toque em Reconectar."). `needs_connect` vindo do sincronizar abre `connectPortal` em seguida.

- [ ] **Step 1: Testes que falham** — com `Capacitor.isNativePlatform` falso o card não renderiza; verdadeiro e estado `never` mostra "Conectar iFlight"; estado `saved` mostra "Sessão salva", "Sincronizar escala" e "Reconectar" (mock de `portal-session` e `auth-context`).
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** o card e as duas modificações.
- [ ] **Step 4: Rodar** `npx vitest run src/modules/device-portal` → PASS; `npx tsc -p tsconfig.app.json --noEmit` e `npx eslint src/modules/device-portal src/modules/roster/ui/RosterSourcesCard.tsx` sem erros.
- [ ] **Step 5: Commit** `feat(device-portal): card de conexão do iFlight nas fontes de escala`.

### Task 5: APK

- [ ] **Step 1:** `npm test` inteiro → tudo PASS.
- [ ] **Step 2:** `npm run build && npx cap sync`.
- [ ] **Step 3:** `JAVA_HOME=~/Android/jdk-21 ./gradlew assembleDebug` em `android/` → `BUILD SUCCESSFUL`; copiar para `~/Downloads/EscalaX-v3.apk`.

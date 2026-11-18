# Visual verde e amarelo (fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o azul pelo verde/amarelo da opção A nos dois temas, mostrar o tipo de cada dia, barra de abas flutuante, tela de Escala nova e logo Órbita.

**Architecture:** As cores vivem nos tokens de `src/index.css`; quase tudo já usa os tokens, então a troca é central. Os tipos de dia ganham tokens próprios e uma função pura que traduz cada lançamento da escala. A tela de Escala ganha um seletor Lista | Mês | PDF sobre o calendário que já existe.

**Tech Stack:** React 18, Tailwind 3 (tokens HSL), Vitest, Playwright (só para rasterizar o logo), Capacitor 8.

**Spec:** `docs/superpowers/specs/2026-11-18-visual-verde-amarelo-design.md`

## Global Constraints

- Valores de cor exatamente os das tabelas da spec (seções 1 e 2), nos dois temas.
- Texto sobre fundo: contraste ≥ 4,5:1. Amarelo nunca como cor de texto.
- Siglas: VOO, FOL, SOB, RES, CUR, FÉR, MED.
- As 6 abas e as rotas não mudam.
- Ajustes continua com Automático / Claro / Escuro (`themeByTime.ts` intacto).
- Nada de botão sem função: Buscar, Compartilhar e Jornadas ficam fora.

## Review Focus

- Dia sem nenhum lançamento → célula neutra sem sigla (não "FOL").
- Dia com voo e sobreaviso → VOO.
- `entry_type` nulo com `crew_status_code` "HSB" → SOB (resolvido por `resolveCrewStatusFromActivityCode`).
- Mês sem escala importada → Lista mostra o estado vazio atual, faixa de 7 dias neutra.
- Tema escuro forçado em Ajustes com horário diurno → continua escuro (não regredir `applyResolvedThemePreference`).

---

### Task 1: Tokens de cor e teste de contraste

**Files:**
- Modify: `src/index.css` (blocos `:root` e `.dark`, `.gradient-primary`, `.gradient-sky`)
- Test: `src/test/theme-contrast.test.ts`

**Interfaces:**
- Produces (CSS, HSL sem `hsl()`, como os tokens atuais): tokens da spec seção 1 e, por tipo, `--day-voo`, `--day-voo-foreground`, `--day-folga`, `--day-folga-foreground`, `--day-sobreaviso`, `--day-sobreaviso-foreground`, `--day-reserva`, `--day-reserva-foreground`, `--day-curso`, `--day-curso-foreground`, `--day-ferias`, `--day-ferias-foreground`, `--day-dispensa`, `--day-dispensa-foreground`. Tailwind: `day.<tipo>` e `day.<tipo>-foreground` em `tailwind.config.ts`.

- [ ] **Step 1: Teste que falha** — lê `src/index.css`, extrai cada par (fundo, texto) de `:root` e `.dark` — `background/foreground`, `card/foreground`, `card/muted-foreground`, `primary/primary-foreground`, `accent/accent-foreground` e os 7 pares `day-*` — e exige razão de contraste ≥ 4,5. Também exige `--primary` = `142 72% 29%` no claro (`#15803D`).
- [ ] **Step 2: Rodar** `npx vitest run src/test/theme-contrast.test.ts` → FAIL.
- [ ] **Step 3: Implementar** os tokens (hex da spec convertidos para HSL), `gradient-primary`/`gradient-sky` em verde e as cores `day` no `tailwind.config.ts`.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `style: paleta verde e amarelo nos temas claro e escuro`.

### Task 2: Tipo de dia

**Files:**
- Create: `src/lib/roster/day-kind.ts`
- Test: `src/lib/roster/day-kind.test.ts`

**Interfaces:**
- Consumes: `ScheduleEntry` (`src/hooks/useScheduleData.ts`), `resolveCrewStatusFromActivityCode` (`src/lib/roster/crew-status-labels.ts`).
- Produces:
  - `type DayKind = 'voo' | 'folga' | 'sobreaviso' | 'reserva' | 'curso' | 'ferias' | 'dispensa' | 'outro' | 'vazio'`
  - `dayKindForEntries(entries: ScheduleEntry[]): DayKind` (prioridade: voo > reserva > sobreaviso > curso > dispensa > ferias > folga > outro; lista vazia → `vazio`)
  - `DAY_KIND_META: Record<DayKind, { label: string; sigla: string; className: string }>` (`className` usa `bg-day-<tipo> text-day-<tipo>-foreground`; folga com `border border-border`; `outro`/`vazio` neutros, sigla vazia)

- [ ] **Step 1: Testes que falham** — um caso por `entry_type` (`day_off`→folga, `vacation`→ferias, `reserve`→reserva, `standby`→sobreaviso, `training`→curso, `sick`→dispensa), `is_flight`→voo, mais as três primeiras linhas da Review Focus; siglas iguais às da spec.
- [ ] **Step 2: Rodar** `npx vitest run src/lib/roster/day-kind.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `feat: tipo de dia com cor e sigla`.

### Task 3: Barra de abas flutuante

**Files:**
- Modify: `src/components/AppLayout.tsx` (componente da barra inferior, ~linha 63; quadradinho do logo nas linhas ~133 e ~378 fica para a Task 6)

- [ ] **Step 1:** `<nav>` inferior passa a `fixed left-3 right-3 z-50 lg:hidden rounded-[34px] bg-card shadow-[0_10px_30px_rgba(17,24,39,0.14)] dark:border dark:border-border` com `bottom: calc(env(safe-area-inset-bottom) + 12px)`; aba ativa: ícone dentro de pílula `bg-day-voo` 44×28 e texto `text-primary font-bold`; inativa `text-muted-foreground`. Ajustar o espaço inferior do conteúdo (`pb-safe-content` em `src/index.css`) para não esconder o fim da página atrás da barra (altura 68 + 12 + área segura).
- [ ] **Step 2:** `npx tsc -p tsconfig.app.json --noEmit` e `npx vitest run src/App.auth-integration.test.tsx` → sem erros.
- [ ] **Step 3: Commit** `style: barra de abas flutuante`.

### Task 4: Tela Escala

**Files:**
- Modify: `src/pages/SchedulePage.tsx`
- Create: `src/components/schedule/WeekStrip.tsx`, `src/components/schedule/DayKindLegend.tsx`, `src/components/schedule/NextEventBanner.tsx`, `src/components/schedule/ScheduleListView.tsx`
- Test: `src/components/schedule/WeekStrip.test.tsx`

**Interfaces:**
- Consumes: `dayKindForEntries`, `DAY_KIND_META` (Task 2); `groupIntoDutyPeriods`, `getNextDutyPeriod` (`src/lib/duty-grouping.ts`); `useScheduleData`; `compareScheduleEntries`; `parseDateBRT`.
- Produces:
  - `WeekStrip({ schedule: ScheduleEntry[]; today: Date; onSelectDay(date: Date): void })` — 7 dias a partir de hoje: letra do dia, número, sigla; hoje com `ring-2 ring-foreground`.
  - `DayKindLegend()` — os 7 tipos com quadradinho e nome.
  - `NextEventBanner({ nextDuty: DutyPeriod | null; now: Date })` — cartão `bg-primary text-primary-foreground` com "PRÓXIMO EVENTO", nome (rota ou "Apresentação"), local · horário e pílula `bg-accent text-accent-foreground` "em XhYY"; sem próximo evento, não renderiza.
  - `ScheduleListView({ entries: ScheduleEntry[] })` — agrupa por dia ("QUA, 18 DE NOV"), cartões com ícone redondo na cor do tipo, rota/nome, `flight_number · aircraft_type`, horário.

Layout final da página, de cima para baixo: título "Escala" + botão redondo de sincronizar (abre `/minha-escala`, que tem a sincronização e o PDF); linha com ‹ mês › e seletor Lista | Mês | PDF (Lista padrão; Mês = calendário atual, recolorido com `DAY_KIND_META`; PDF = navega para `/minha-escala`); `NextEventBanner`; `WeekStrip`; `DayKindLegend`; conteúdo da aba. O `PdfImportDialog` atual continua acessível na aba Lista.

- [ ] **Step 1: Teste que falha** — `WeekStrip` com hoje = 2026-11-18 e lançamentos (18 voo, 20 standby, 21 reserve) mostra 7 células, siglas `VOO`, `SOB`, `RES` nos dias certos, e a célula 18 marcada como hoje (`aria-current="date"`).
- [ ] **Step 2: Rodar** `npx vitest run src/components/schedule` → FAIL.
- [ ] **Step 3: Implementar** os quatro componentes e a nova `SchedulePage`.
- [ ] **Step 4: Rodar** → PASS; `tsc` e `eslint` dos arquivos sem erros.
- [ ] **Step 5: Commit** `feat: tela de Escala com faixa da semana, tipos de dia e próximo evento`.

### Task 5: Cores escritas direto no código

**Files:**
- Modify: `src/components/flight/FlightCard.tsx`, `src/components/OnboardingModal.tsx`, `src/lib/roster/roster-calendar-icons.tsx`, `src/pages/connections/ConnectionSharePage.tsx`, `src/pages/ConnectionsPage.tsx`, `src/pages/PerDiemPage.tsx`, `src/pages/WeatherPage.tsx`, `src/pages/ForgotPasswordPage.tsx`, `src/pages/SignupPage.tsx`, `src/pages/UpdatePasswordPage.tsx`, `src/pages/VerifyEmailPage.tsx`, `src/pages/LoginPage.tsx`

- [ ] **Step 1:** trocar `*-blue-*`, `*-sky-*`, `*-indigo-*`, `*-cyan-*` e os hex azuis por tokens (`primary`, `accent`, `day-*`, `muted`). Cores de meteorologia com significado (ex.: categorias de voo VFR/IFR) ficam como estão.
- [ ] **Step 2:** `grep -rnE "\b(text|bg|border|from|to|via|ring)-(blue|sky|indigo|cyan)-[0-9]" src --include=*.tsx` → só sobram as de significado meteorológico; `npm test` → PASS.
- [ ] **Step 3: Commit** `style: remove azuis fixos`.

### Task 6: Logo Órbita e ícones

**Files:**
- Create: `public/escalax-logo.svg` (com cantos), `scripts/icons/escalax-logo-full.svg` (sem cantos, para iOS/maskable/Android), `scripts/icons/render-icons.mjs`
- Create (gerados): `public/escalax-icon.png` (512), `public/escalax-maskable.png` (512), `public/favicon.png` (64), `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024), `android/app/src/main/res/mipmap-*/ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png` (48/72/96/144/192 e 108dp de frente: 108/162/216/324/432), `android/app/src/main/res/values/ic_launcher_background.xml` (`#15803D`)
- Create: `src/components/brand/EscalaXLogo.tsx`
- Modify: `index.html` (favicon), `vite.config.ts` (ícones do manifesto: `any` e `maskable` separados), `src/components/AppLayout.tsx` (2 lugares), `src/pages/LoginPage.tsx`, `src/pages/SignupPage.tsx`

**Interfaces:**
- Produces: `EscalaXLogo({ size: number; className?: string })` (SVG inline com o desenho de `public/escalax-logo.svg`, `role="img"`, `aria-label="EscalaX"`).

Desenho (512×512): degradê diagonal `#22A35A`→`#0F5B2E`; círculo branco 8% r150; metade de trás da órbita `M56 256 A200 84 0 0 1 456 256` e metade da frente `... 0 0 0 ...`, ambas `rotate(-28 256 256)`, traço `#FACC15` 16; avião lucide `Plane` em `translate(143 140) scale(9.2)`, branco, contorno `#17803F` 1.4 com `paint-order="stroke"`; ponto `#FACC15` r24 em (432,162). Versão com cantos: `rx=116`.

- [ ] **Step 1:** escrever os SVGs e `render-icons.mjs` (Playwright Chromium: abre cada SVG no tamanho pedido, `page.screenshot({ omitBackground })` → PNG; para a frente do Android, só avião + órbita centralizados em 66% da área, fundo transparente).
- [ ] **Step 2:** `node scripts/icons/render-icons.mjs` → todos os arquivos acima existem com o tamanho certo (`file` mostra as dimensões).
- [ ] **Step 3:** `EscalaXLogo` no login, cadastro e barra lateral no lugar do quadrado com `Plane`; `index.html` e `vite.config.ts` apontando para os PNGs novos.
- [ ] **Step 4:** `npm run build` → sem erros; `dist/escalax-icon.png` presente.
- [ ] **Step 5: Commit** `feat: logo Órbita e ícones do app`.

### Task 7: Conferência e APK

- [ ] **Step 1:** `npm test`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint` → sem erros.
- [ ] **Step 2:** `npm run dev` e capturas (Playwright) de `/login` e `/signup` em claro e escuro.
- [ ] **Step 3:** `npx cap sync` e `assembleDebug` → `~/Downloads/EscalaX-v3.apk`.

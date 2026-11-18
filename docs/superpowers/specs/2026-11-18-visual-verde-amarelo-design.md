# Visual verde e amarelo — fase 1

Data: 2026-11-18 · Branch: `feat/visual-verde-amarelo`
Desenho aprovado: https://claude.ai/artifact/RJ1t6M82Mp8VgVCzX4Faew (opção A, telas "Opção A · claro" e "Opção A · escuro")

## Objetivo

Trocar o visual azul do EscalaX por cinza, branco, verde e amarelo, deixar o app com cara moderna no celular e mostrar claramente o tipo de cada dia da escala. Nada muda em dados, rotas ou integrações.

## Decisões já tomadas

- Paleta da opção A ("Pista"), em tema claro e escuro.
- O usuário escolhe o tema em Ajustes. A opção Automático/Claro/Escuro já existe (`SettingsPage` + `themeByTime.ts`) e continua; só as cores mudam.
- As 6 abas de baixo continuam: Início, Escala, Conexões, MetCenter, Stats, Ajustes.
- O logo muda (ver "Logo" abaixo; a opção ainda vai ser escolhida).

## O que muda

### 1. Cores do tema (`src/index.css`)

Os tokens `:root` e `.dark` passam a ser:

| Token | Claro | Escuro |
|---|---|---|
| `--background` | `#EEF0F2` | `#111418` |
| `--card` / `--popover` | `#FFFFFF` | `#1B1F24` |
| `--foreground` | `#111827` | `#F3F4F6` |
| `--muted-foreground` | `#5B6472` | `#A3ACB9` |
| `--border` / `--input` | `#DDE1E6` | `#2A3038` |
| `--primary` (verde) | `#15803D`, texto `#FFFFFF` | `#4ADE80`, texto `#052E16` |
| `--accent` / `--warning` (amarelo) | `#FACC15`, texto `#1F2937` | `#FDE047`, texto `#1F1A00` |
| `--success` | `#15803D` | `#4ADE80` |
| `--ring` | igual a `--primary` | igual a `--primary` |

`--sidebar-*`, `--secondary`, `--muted` seguem os mesmos tons. Todas as combinações de texto/fundo têm contraste ≥ 4,5:1 (conferido). O amarelo nunca é cor de texto: só fundo com texto escuro.

Como 1.364 usos já passam pelos tokens, o app inteiro muda junto. Ajuste manual só onde a cor está escrita direto:

- classes azuis fixas: `FlightCard.tsx`, `OnboardingModal.tsx`, `roster-calendar-icons.tsx`, `ConnectionSharePage.tsx`, `ConnectionsPage.tsx`, `PerDiemPage.tsx`, `WeatherPage.tsx`;
- cores hex em `ForgotPasswordPage`, `SignupPage`, `UpdatePasswordPage`, `VerifyEmailPage`.

### 2. Tipos de dia

Novos tokens por tipo (fundo + texto), nos dois temas:

| Tipo | Sigla | Claro (fundo/texto) | Escuro (fundo/texto) |
|---|---|---|---|
| Voo | VOO | `#DCFCE7` / `#166534` | `#14532D` / `#86EFAC` |
| Folga | FOL | `#FFFFFF` + borda / `#5B6472` | `#1B1F24` + borda / `#A3ACB9` |
| Sobreaviso | SOB | `#FEF9C3` / `#854D0E` | `#422006` / `#FDE68A` |
| Reserva | RES | `#FACC15` / `#1F2937` | `#FDE047` / `#1F1A00` |
| Curso / simulador | CUR | `#15803D` / `#FFFFFF` | `#4ADE80` / `#052E16` |
| Férias | FÉR | `#E5E7EB` / `#374151` | `#2A3038` / `#D1D5DB` |
| Dispensa médica | MED | `#374151` / `#FFFFFF` | `#E5E7EB` / `#111418` |

Uma função única (`src/lib/roster/day-kind.ts`) traduz o `entryType` que o parser já produz (`crew-status-labels.ts`: `day_off`, `vacation`, `reserve`, `standby`, `training`, `sick`, voo) para o tipo de dia acima. Tipos sem correspondência caem em "outro" (cartão neutro, sem sigla). Dia com voo e outro evento: vale o voo.

### 3. Barra de abas flutuante (`AppLayout.tsx`)

A barra fixa com borda vira uma pílula flutuante (margem 12px, canto 34px, sombra), com a aba ativa em verde e um fundo verde claro atrás do ícone. Respeita a área segura do iPhone. Desktop (barra lateral) só recebe as cores novas.

### 4. Tela Escala (`SchedulePage.tsx`)

De cima para baixo, como no desenho:

1. Título "Escala" e botão redondo de sincronizar (o que já existe).
2. Navegação de mês (‹ Nov 2026 ›) e seletor com **Lista** e **PDF**. "PDF" abre o download da escala ativa, que já existe (`ActiveRosterDownloadButton`).
3. Cartão "Próximo evento" verde com a contagem em amarelo, usando o cálculo que o painel já faz (`DashboardNextPresentationCard`).
4. Faixa de 7 dias a partir de hoje, cada dia com a cor e a sigla do tipo; hoje com contorno escuro. Legenda dos 7 tipos embaixo.
5. Lista por dia com os cartões novos (ícone redondo do tipo, rota ou nome do evento, horário, selo de status).

### 5. Logo

Três opções no desenho (quadro "Logo novo — 3 opções"). Depois da escolha:

- SVG fonte em `public/escalax-logo.svg`;
- `public/escalax-icon.png` (512px) e favicon, que hoje estão **faltando** no repositório (o `index.html` e o PWA apontam para um arquivo apagado);
- ícones do Android (`mipmap-*`, ícone adaptativo) e do iPhone (`AppIcon-512@2x.png`, hoje é o ícone padrão do Capacitor);
- o quadradinho com avião no topo da barra lateral passa a usar o logo.

## Fora desta fase

- Fase 2: busca, compartilhar, visões **Mês** e **Jornadas** (o botão só aparece quando a função existir, nada de botão morto).
- Integração das escalas com o iFlight: spec própria, depois do teste do APK (`spike/webview-iflight`) dizer se o login conclui dentro do app.

## Como verificar

- Teste de unidade para `day-kind.ts` (cada `entryType` → tipo e sigla certos).
- Suíte atual (`npm test`), `tsc` e `eslint` sem erros; `npm run build` ok.
- Capturas das telas públicas (login, cadastro) nos dois temas com o app rodando localmente.
- As telas com login são conferidas por você no celular (APK novo) nos dois temas.

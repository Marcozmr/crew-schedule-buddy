# syntax=docker/dockerfile:1
#
# EscalaX — Roster Automation Worker (Node.js + Playwright Chromium)
#
# Build:   docker build -t escalax-roster-automation .
# Run:     docker run --env-file .env -p 8790:8790 escalax-roster-automation
#
# Variáveis obrigatórias em produção (ver README / seção de variáveis abaixo):
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#   ROSTER_AUTOMATION_CORS_ORIGINS, LATAM_PORTAL_LOGIN_URL,
#   LATAM_IFLIGHT_DEEP_LINK_URL, ROSTER_AUTOMATION_HEADLESS

# ── Stage 1: build TypeScript → dist/ ────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

# Não baixar browsers nesta etapa (só precisamos para o build TS)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN npm ci

COPY . .

RUN npm run build

# ── Stage 2: imagem de produção ───────────────────────────────────────────────
FROM node:20-slim AS production

# Dependências de sistema mínimas necessárias antes do playwright install
RUN apt-get update && apt-get install -y \
      ca-certificates \
      curl \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Instalar apenas dependências de produção (playwright, fastify, supabase, etc.)
RUN npm ci --omit=dev

# Instalar o Chromium + todas as dependências de sistema que ele precisa.
# --with-deps roda apt-get automaticamente; só baixa Chromium (não Firefox/WebKit).
RUN npx playwright install chromium --with-deps \
  && rm -rf /root/.cache/ms-playwright/chromium_*/chrome-linux/nacl_irt_x86_64.nexe 2>/dev/null || true

# Copiar artefatos compilados do stage anterior
COPY --from=builder /app/dist ./dist

# ── Configuração de runtime ───────────────────────────────────────────────────

# Headless obrigatório em servidor (sem display)
ENV ROSTER_AUTOMATION_HEADLESS=1

# Railway / Render injetam PORT; ROSTER_AUTOMATION_PORT tem precedência.
# config.ts lê: ROSTER_AUTOMATION_PORT ?? PORT ?? 8790
ENV ROSTER_AUTOMATION_PORT=8790

EXPOSE 8790

# Health check via Node (sem depender de curl no PATH da imagem final)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "\
    const p = +(process.env.ROSTER_AUTOMATION_PORT || process.env.PORT || 8790); \
    require('http').get({host:'localhost',port:p,path:'/health'}, r => \
      process.exit(r.statusCode === 200 ? 0 : 1) \
    ).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]

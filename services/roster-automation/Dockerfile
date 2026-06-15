# syntax=docker/dockerfile:1
#
# EscalaX — Roster Automation Worker (Node.js + Playwright Chromium)
#
# Build:   docker build -t escalax-roster-automation .
# Run:     docker run --env-file .env -p 8790:8790 escalax-roster-automation

FROM node:20-slim

WORKDIR /app

# Certificados para HTTPS (Supabase, LATAM portal, iFlight)
RUN apt-get update && apt-get install -y \
      ca-certificates \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# 1. Dependências npm (prod + dev — tsup é devDependency, necessário para o build)
COPY package.json package-lock.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# 2. Chromium + dependências de sistema (camada cacheada enquanto package.json não mudar)
RUN npx playwright install chromium --with-deps

# 3. Código-fonte e compilação TypeScript → dist/
COPY . .
RUN npm run build

# Falha o build explicitamente se dist/index.js não foi gerado
RUN node -e "require('fs').accessSync('dist/index.js')" \
  && echo "dist/index.js OK"

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV ROSTER_AUTOMATION_HEADLESS=1

# Railway/Render injetam PORT; ROSTER_AUTOMATION_PORT tem precedência (ver config.ts)
ENV ROSTER_AUTOMATION_PORT=8790

EXPOSE 8790

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "\
    const p = +(process.env.ROSTER_AUTOMATION_PORT || process.env.PORT || 8790); \
    require('http').get({host:'localhost',port:p,path:'/health'}, r => \
      process.exit(r.statusCode === 200 ? 0 : 1) \
    ).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]

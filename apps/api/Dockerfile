# apps/api/Dockerfile
# Multi-stage build: deps → dev (for Compose watch) / build → production

# ── Stage 1: Install dependencies ──────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# Copy workspace manifests only (layer-cache friendly)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
# Create stub for web so workspace install succeeds
RUN mkdir -p apps/web && echo '{"name":"@club/web","version":"0.1.0","private":true}' > apps/web/package.json

RUN npm ci --workspace=apps/api --include-workspace-root

# ── Stage 2: Development (used by Docker Compose) ───────────────
FROM deps AS development
WORKDIR /app
COPY apps/api ./apps/api
EXPOSE 3001
CMD ["npx", "tsx", "watch", "apps/api/src/index.ts"]

# ── Stage 3: TypeScript build ───────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY apps/api ./apps/api
RUN npm run build -w apps/api

# ── Stage 4: Production runtime ─────────────────────────────────
FROM node:24-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Only production deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN mkdir -p apps/web && echo '{"name":"@club/web","version":"0.1.0","private":true}' > apps/web/package.json
RUN npm ci --workspace=apps/api --include-workspace-root --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

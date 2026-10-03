# apps/server/Dockerfile
# Multi-stage build: deps → dev (for Compose watch) / build → production

# ── Stage 1: Install dependencies ──────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# Copy workspace manifests only (layer-cache friendly)
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
# Create stub for client so workspace install succeeds
RUN mkdir -p apps/client && echo '{"name":"@club/client","version":"0.1.0","private":true}' > apps/client/package.json

RUN npm ci --workspace=apps/server --include-workspace-root

# ── Stage 2: Development (used by Docker Compose) ───────────────
FROM deps AS development
WORKDIR /app
COPY apps/server ./apps/server
EXPOSE 3001
CMD ["npx", "tsx", "watch", "apps/server/src/index.ts"]

# ── Stage 3: TypeScript build ───────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY apps/server ./apps/server
RUN npm run build -w apps/server

# ── Stage 4: Production runtime ─────────────────────────────────
FROM node:24-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Only production deps
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
RUN mkdir -p apps/client && echo '{"name":"@club/client","version":"0.1.0","private":true}' > apps/client/package.json
RUN npm ci --workspace=apps/server --include-workspace-root --omit=dev

COPY --from=builder /app/apps/server/dist ./apps/server/dist

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]

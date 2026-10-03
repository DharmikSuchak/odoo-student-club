# apps/web/Dockerfile
# Multi-stage build: deps → dev (Compose watch) → production (static serve via preview)

# ── Stage 1: Install dependencies ──────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
# Stub for api so workspace install succeeds
RUN mkdir -p apps/api && echo '{"name":"@club/api","version":"0.1.0","private":true}' > apps/api/package.json

RUN npm ci --workspace=apps/web --include-workspace-root

# ── Stage 2: Development (used by Docker Compose) ──────────────
FROM deps AS development
WORKDIR /app
COPY apps/web ./apps/web
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]

# ── Stage 3: Build static assets ───────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY apps/web ./apps/web
RUN npm run build -w apps/web

# ── Stage 4: Serve (preview mode — swap for nginx in production) ─
FROM node:24-alpine AS production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
RUN mkdir -p apps/api && echo '{"name":"@club/api","version":"0.1.0","private":true}' > apps/api/package.json
RUN npm ci --workspace=apps/web --include-workspace-root --omit=dev

COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 4173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]

# apps/client/Dockerfile
# Multi-stage build: deps → dev (Compose watch) → production (static serve via preview)

# ── Stage 1: Install dependencies ──────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/client/package.json ./apps/client/
# Stub for server so workspace install succeeds
RUN mkdir -p apps/server && echo '{"name":"@club/server","version":"0.1.0","private":true}' > apps/server/package.json

RUN npm ci --workspace=apps/client --include-workspace-root

# ── Stage 2: Development (used by Docker Compose) ──────────────
FROM deps AS development
WORKDIR /app/apps/client
COPY apps/client ./
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]

# ── Stage 3: Build static assets ───────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY apps/client ./apps/client
RUN npm run build -w apps/client

# ── Stage 4: Serve (preview mode — swap for nginx in production) ─
FROM node:20-slim AS production
WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/client/package.json ./apps/client/
RUN mkdir -p apps/server && echo '{"name":"@club/server","version":"0.1.0","private":true}' > apps/server/package.json
RUN npm ci --workspace=apps/client --include-workspace-root --omit=dev

COPY --from=builder /app/apps/client/dist ./apps/client/dist

EXPOSE 4173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]

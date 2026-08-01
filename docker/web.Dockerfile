# ─────────────────────────────────────────────────────────────
#  Image web : build de la PWA puis service statique via Nginx
#  (sert les fichiers + reverse-proxy /api + /socket.io vers le serveur).
#  Le TLS et le domaine sont gérés par Nginx Proxy Manager en amont.
#  Contexte de build attendu : racine du monorepo.
# ─────────────────────────────────────────────────────────────
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @cdf/shared build && pnpm --filter @cdf/web build

# ── Runtime : Nginx sert la PWA et relaie vers le serveur ──
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

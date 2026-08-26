# ─────────────────────────────────────────────────────────────
#  Image serveur (Fastify + Socket.IO + Prisma)
#  Contexte de build attendu : racine du monorepo.
# ─────────────────────────────────────────────────────────────
FROM node:22-slim AS build
# Plafond du tas V8 pendant le build uniquement. L'étape `runtime` ci-dessous
# repart d'une image neuve : le serveur en production n'hérite pas de cette
# limite, qui l'étoufferait.
ARG NODE_BUILD_MEMORY_MB=1024
ENV NODE_OPTIONS=--max-old-space-size=${NODE_BUILD_MEMORY_MB}
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app

# Manifests d'abord (cache des dépendances).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile

# Sources + build.
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @cdf/shared build \
 && pnpm --filter @cdf/server exec prisma generate \
 && pnpm --filter @cdf/server build

# ── Runtime ──────────────────────────────────────────────────
FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app
ENV NODE_ENV=production

# On copie l'espace de travail complet (node_modules inclus, client Prisma généré).
COPY --from=build /app /app

WORKDIR /app/apps/server
COPY docker/server-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

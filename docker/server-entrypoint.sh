#!/bin/sh
set -e
# Applique les migrations puis (au premier démarrage) le seed si la base est vide.
echo "[server] Application des migrations Prisma…"
pnpm exec prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[server] Seed initial (SEED_ON_START=true)…"
  pnpm run db:seed || echo "[server] seed ignoré (déjà présent ?)"
fi

echo "[server] Démarrage du serveur…"
exec node dist/index.js

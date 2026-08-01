#!/bin/sh
# ─────────────────────────────────────────────────────────────
#  Mise à jour de la stack sur le VPS
# ─────────────────────────────────────────────────────────────
#  Usage :  ./scripts/update.sh
#
#  Récupère la dernière version du code, reconstruit les images et redémarre.
#  Les migrations Prisma sont appliquées automatiquement au démarrage du
#  conteneur serveur (voir docker/server-entrypoint.sh).
#
#  ⚠️ Aucune donnée n'est effacée : le volume PostgreSQL est conservé.
set -e

cd "$(dirname "$0")/.."
ROOT=$(pwd)

if [ ! -f "$ROOT/.env" ]; then
  echo "Fichier .env introuvable à la racine — copie .env.example et complète-le." >&2
  exit 1
fi

echo "→ Récupération du code…"
git pull

echo "→ Reconstruction et redémarrage des conteneurs…"
cd "$ROOT/docker"
docker compose --env-file ../.env up -d --build

echo "→ Nettoyage des images inutilisées…"
docker image prune -f >/dev/null 2>&1 || true

echo
echo "✅ Mise à jour terminée."
echo "   Sur les tablettes : recharge la page (la PWA se met à jour toute seule"
echo "   au bout de quelques secondes, ou ferme/rouvre l'application)."

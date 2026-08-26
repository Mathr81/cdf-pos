#!/bin/sh
# ─────────────────────────────────────────────────────────────
#  Mise à jour de la stack sur le VPS
# ─────────────────────────────────────────────────────────────
#  Usage :  ./scripts/update.sh [service…]
#
#    ./scripts/update.sh              # tout reconstruire
#    ./scripts/update.sh web          # seulement la PWA
#    ./scripts/update.sh server web   # dans cet ordre
#
#  Récupère la dernière version du code, reconstruit les images UNE PAR UNE,
#  puis redémarre. Les migrations Prisma sont appliquées automatiquement au
#  démarrage du conteneur serveur (voir docker/server-entrypoint.sh).
#
#  ⚠️ Aucune donnée n'est effacée : le volume PostgreSQL est conservé.
#
#  ── Pourquoi construire un par un ? ────────────────────────
#  `docker compose up --build` construit tous les services EN PARALLÈLE. Or
#  `server` et `web` lancent chacun un `pnpm install` puis un build Node
#  (tsc, puis Rollup pour la PWA) : côte à côte, les deux saturent la mémoire
#  d'un petit VPS et le tuent en plein service. Séquentiellement, chaque build
#  passe sans peine — c'est juste quelques minutes de plus.
#
#  ── Pourquoi tout est dans main() ? ────────────────────────
#  Ce script se met à jour lui-même : `git pull` réécrit le fichier pendant
#  que `sh` est en train de le lire. `sh` lisant le fichier au fur et à mesure,
#  la suite serait lue dans le NOUVEAU fichier à l'ancienne position — au
#  mieux l'ancienne logique s'exécute, au pire la syntaxe part en morceaux.
#  Tout enfermer dans une fonction appelée en dernière ligne force `sh` à
#  parser l'intégralité du script AVANT d'exécuter quoi que ce soit.
set -e

main() {
  cd "$(dirname "$0")/.."
  ROOT=$(pwd)

  if [ ! -f "$ROOT/.env" ]; then
    echo "Fichier .env introuvable à la racine — copie .env.example et complète-le." >&2
    exit 1
  fi

  echo "→ Récupération du code…"
  BEFORE=$(git rev-parse HEAD)
  git pull
  AFTER=$(git rev-parse HEAD)

  # Si le script lui-même a changé, l'ancienne version tourne encore en
  # mémoire : on relance la nouvelle, une seule fois (garde anti-boucle).
  if [ "$BEFORE" != "$AFTER" ] && [ "${CDF_UPDATE_REEXEC:-}" != "1" ]; then
    if ! git diff --quiet "$BEFORE" "$AFTER" -- scripts/update.sh; then
      echo "→ update.sh a été mis à jour : relance de la nouvelle version…"
      CDF_UPDATE_REEXEC=1
      export CDF_UPDATE_REEXEC
      exec sh "$ROOT/scripts/update.sh" "$@"
    fi
  fi

  # Services à reconstruire : ceux passés en argument, sinon tous ceux qui ont
  # une image à construire (`postgres` utilise une image publique).
  SERVICES=${*:-"server web backup-cron"}

  cd "$ROOT/docker"

  # Plafond du tas V8 pendant le build. Sans lui, V8 grossit jusqu'à ce que le
  # noyau tue le processus — et emporte parfois d'autres conteneurs avec. Avec,
  # un build trop gourmand échoue proprement, en le disant. Ajustable :
  #   NODE_BUILD_MEMORY_MB=2048 ./scripts/update.sh
  #
  # Passé en --build-arg et NON en variable d'environnement : le build tourne
  # dans un conteneur isolé, il n'hérite pas de l'environnement de ce script.
  BUILD_MEM=${NODE_BUILD_MEMORY_MB:-1024}

  for service in $SERVICES; do
    echo
    echo "→ Construction de « $service » (mémoire max ${BUILD_MEM} Mo)…"
    # Un seul service à la fois : c'est tout l'intérêt de la boucle.
    # `backup-cron` n'embarque pas Node et ignore simplement l'argument.
    docker compose --env-file ../.env build \
      --build-arg "NODE_BUILD_MEMORY_MB=${BUILD_MEM}" \
      "$service"
  done

  echo
  echo "→ Redémarrage des conteneurs…"
  # Pas de --build ici : les images viennent d'être construites ci-dessus.
  docker compose --env-file ../.env up -d

  echo "→ Nettoyage des images inutilisées…"
  docker image prune -f >/dev/null 2>&1 || true

  echo
  echo "✅ Mise à jour terminée."
  echo "   Sur les tablettes : recharge la page (la PWA se met à jour toute seule"
  echo "   au bout de quelques secondes, ou ferme/rouvre l'application)."
}

main "$@"

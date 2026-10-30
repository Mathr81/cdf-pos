# Worksheet deploy: Hosting & backups
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Docker setup that runs the database, server, web app and a backup container that dumps the database every 15 minutes, plus the update script.
Write to: floorplan/descriptions/deploy.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## docker/backup-cron/backup.sh  (77 loc, shell)
doc: ───────────────────────────────────────────────────────────── Sauvegardes périodiques avec rotation.

## docker/server-entrypoint.sh  (11 loc, shell)

## scripts/update.sh  (130 loc, shell)
doc: ───────────────────────────────────────────────────────────── Mise à jour de la stack sur le VPS ───────────────────────────────────────────────────────────── Usage : ./scripts/update.sh [service…]…

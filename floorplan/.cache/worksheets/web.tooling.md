# Worksheet web.tooling: Build setup
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: How the app is bundled and made installable, plus a script that generates its icons.
Write to: floorplan/descriptions/web.tooling.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/web/scripts/generate-icons.mjs  (89 loc, javascript)
doc: Génère des icônes PNG (192 & 512) pour la PWA, sans dépendance externe.

## apps/web/vite.config.ts  (67 loc, typescript)

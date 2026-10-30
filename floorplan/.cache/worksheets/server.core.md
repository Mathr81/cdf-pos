# Worksheet server.core: Startup & settings
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Starts the server, reads its settings and opens the database connection.
Write to: floorplan/descriptions/server.core.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/server/src/db.ts  (2 loc, typescript)
defines: prisma
uses: Database (PostgreSQL)
used by: Database setup ×2, Google Sheet backup ×2, Event intake ×2, Startup & settings, Web addresses

## apps/server/src/env.ts  (28 loc, typescript)
defines: env
used by: Web addresses ×3, Google Sheet backup ×2, Startup & settings, Live connection

## apps/server/src/index.ts  (51 loc, typescript)
uses: Startup & settings ×2, Event intake, Live connection, Web addresses, Google Sheet backup

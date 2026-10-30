# Worksheet server.backup: Google Sheet backup
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: In the background, copies new events into a Google Sheet so there is a readable copy outside the server.
Write to: floorplan/descriptions/server.backup.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/server/src/backup/index.ts  (14 loc, typescript)
defines: enqueueBackup() (Met un événement en file pour le miroir Google Sheet.)
uses: Startup & settings ×2, Money, stats & bookings
used by: Event intake

## apps/server/src/backup/sheets.ts  (189 loc, typescript)
defines: startBackupWorker()
uses: Startup & settings ×2, Google Sheets ×2, Money, stats & bookings, Event intake
used by: Startup & settings

# Worksheet server.routes: Web addresses
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Plain web requests: signing in with the access code or admin PIN, loading the current state, uploading product pictures, resetting data.
Write to: floorplan/descriptions/server.routes.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/server/src/media.ts  (302 loc, typescript)
defines: MediaMode; MAX_UPLOAD_BYTES (Une photo prise à l'iPad et convertie en JPEG par Safari dépasse régulièrement 8 Mo.); MediaError; ProcessResult; suggestMode() (Suggestion de mode, seulement pour présélectionner le bouton côté UI.); processUpload(); isValidKey(); mediaPath(); purgeMedia() (Vide le dossier média.)
uses: Startup & settings
used by: Event intake, Web addresses

## apps/server/src/routes/admin.ts  (27 loc, typescript)
defines: adminRoutes()
uses: Event intake, Web addresses
used by: Web addresses

## apps/server/src/routes/auth.ts  (34 loc, typescript)
defines: authRoutes()
uses: Startup & settings
used by: Tests, Web addresses

## apps/server/src/routes/guards.ts  (21 loc, typescript)
defines: requireAccess() (Vérifie le code d'accès applicatif (header `x-access-code`).); requireAdmin() (Vérifie le PIN admin (header `x-admin-pin`) en plus du code d'accès.)
uses: Startup & settings
used by: Web addresses ×3

## apps/server/src/routes/index.ts  (12 loc, typescript)
defines: registerRoutes()
uses: Web addresses ×4
used by: Startup & settings
route: GET /api/health  handler ?  NEW

## apps/server/src/routes/media.ts  (76 loc, typescript)
defines: mediaRoutes()
uses: Web addresses ×2
used by: Web addresses, Offline storage & sync
route: POST /admin/media  handler ?  NEW

## apps/server/src/routes/state.ts  (16 loc, typescript)
defines: stateRoutes()
uses: Startup & settings, Web addresses
used by: Web addresses, Offline storage & sync
route: GET /state  handler ?  NEW

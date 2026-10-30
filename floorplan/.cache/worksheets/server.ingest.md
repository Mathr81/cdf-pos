# Worksheet server.ingest: Event intake
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Checks each incoming event (format, permissions, admin PIN), saves it once, and updates the sales and stock tables.
Write to: floorplan/descriptions/server.ingest.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/server/src/ingest.ts  (103 loc, typescript)
defines: IoServer; ingestEvents() (Point d'entrée unique pour intégrer des événements.)
uses: Money, stats & bookings, Event intake, Google Sheet backup
used by: Google Sheet backup, Startup & settings, Tests, Live connection

## apps/server/src/projections.ts  (312 loc, typescript)
defines: ConflictError (Refus définitif : la réservation est déjà encaissée par une autre caisse.); findOrderForVoid() (Encaissement visé par une annulation, pour la règle des 10 min sans PIN.); ApplyResult; applyEvent() (Applique un événement de façon **idempotente** : - insère la ligne Event (l'unicité de `id` garantit qu'un doublon est ignoré) ; - projette les effets de bord dans les tables de vues UNIQUEMENT si l'insert est nouveau.)
uses: Money, stats & bookings, Startup & settings, Database (PostgreSQL)
used by: Database setup, Event intake

## apps/server/src/reset.ts  (111 loc, typescript)
defines: ResetScope; getEpoch() (Renvoie l'epoch courant, en le créant au premier appel.); ResetResult; resetData() (Efface les données puis change l'epoch.)
uses: Startup & settings, Web addresses
used by: Database setup, Web addresses, Live connection

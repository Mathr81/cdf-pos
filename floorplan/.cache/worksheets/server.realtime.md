# Worksheet server.realtime: Live connection
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: The always-on link to each tablet: receives new events, sends back what others did, and tracks which devices are online.
Write to: floorplan/descriptions/server.realtime.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/server/src/presence.ts  (76 loc, typescript)
defines: JoinInfo; PresenceRegistry
uses: Money, stats & bookings
used by: Tests, Live connection

## apps/server/src/socket.ts  (145 loc, typescript)
defines: createSocketServer()
uses: Startup & settings ×2, Event intake ×2, Money, stats & bookings, Live connection, Offline storage & sync
used by: Startup & settings, Offline storage & sync

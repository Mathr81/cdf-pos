# Worksheet tests: Tests
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Automatic checks for the sync logic, event rules, stats, bookings and server intake.
Write to: floorplan/descriptions/tests.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/server/src/ingest.test.ts  (149 loc, typescript)
uses: Money, stats & bookings, Event intake

## apps/server/src/presence.test.ts  (92 loc, typescript)
uses: Live connection

## apps/server/src/routes/auth.test.ts  (74 loc, typescript)
uses: Web addresses

## apps/server/src/test/setup.ts  (6 loc, typescript)
doc: `env.ts` exige DATABASE_URL au chargement.

## apps/server/vitest.config.ts  (8 loc, typescript)

## apps/web/src/components/Numpad.test.ts  (26 loc, typescript)
uses: Shared building blocks

## apps/web/src/lib/deviceInfo.test.ts  (35 loc, typescript)
uses: Offline storage & sync

## apps/web/src/lib/localData.test.ts  (95 loc, typescript)
uses: Offline storage & sync ×2, Money, stats & bookings

## apps/web/src/lib/persist.test.ts  (42 loc, typescript)
uses: Offline storage & sync

## apps/web/src/lib/reservationCsv.test.ts  (65 loc, typescript)
uses: Small helpers

## apps/web/src/lib/sync.test.ts  (90 loc, typescript)
uses: Offline storage & sync ×3, Money, stats & bookings

## apps/web/src/lib/validate.test.ts  (10 loc, typescript)
uses: Small helpers

## apps/web/src/lib/wakeLock.test.ts  (101 loc, typescript)
uses: Offline storage & sync

## apps/web/src/test/setup.ts  (2 loc, typescript)
doc: IndexedDB en mémoire : Dexie tourne tel quel sous Node, sans navigateur.

## apps/web/vitest.config.ts  (10 loc, typescript)

## packages/shared/src/cashup.test.ts  (214 loc, typescript)
uses: Money, stats & bookings, Tests

## packages/shared/src/forecast.test.ts  (114 loc, typescript)
uses: Money, stats & bookings, Tests

## packages/shared/src/offerts.test.ts  (128 loc, typescript)
uses: Money, stats & bookings, Live totals, Tests

## packages/shared/src/projection.test.ts  (343 loc, typescript)
uses: Live totals, Tests

## packages/shared/src/recap.test.ts  (64 loc, typescript)
uses: Money, stats & bookings, Live totals, Tests

## packages/shared/src/reservations.test.ts  (269 loc, typescript)
uses: Money, stats & bookings ×2, Live totals, Tests

## packages/shared/src/stats.test.ts  (328 loc, typescript)
uses: Money, stats & bookings, Tests

## packages/shared/src/test-utils/fixtures.ts  (248 loc, typescript)
defines: resetIds() (Remet le compteur à zéro — à appeler dans un `beforeEach`.); uuid(); SOIREE; at() (Horodatage court : `at("20:30")` → le 24 août 2026 à 20h30 locales.); sale(); reservation(); tariffs(); reservationDelete(); reservationComplete(); voidOrder(); amend(); product(); … +8
uses: Event definitions, Live totals
used by: Tests ×8

## packages/shared/src/training.test.ts  (111 loc, typescript)
uses: Money, stats & bookings, Live totals, Tests

## packages/shared/vitest.config.ts  (7 loc, typescript)

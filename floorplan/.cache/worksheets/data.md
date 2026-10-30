# Worksheet data: Database setup
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: The database's table layout, its step-by-step changes over time, and the starter menu loaded on a fresh install.
Write to: floorplan/descriptions/data.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/server/prisma/menu.ts  (152 loc, typescript)
defines: SeedStation; SeedProduct; STATIONS; PRODUCTS
uses: Money, stats & bookings
used by: Database setup

## apps/server/prisma/migrations/0001_init/migration.sql  (131 loc, sql)

## apps/server/prisma/migrations/0002_stock_unlimited_components_meta/migration.sql  (10 loc, sql)

## apps/server/prisma/migrations/0003_soirees/migration.sql  (22 loc, sql)

## apps/server/prisma/migrations/0004_product_image/migration.sql  (9 loc, sql)

## apps/server/prisma/migrations/0005_product_image_zoom/migration.sql  (11 loc, sql)

## apps/server/prisma/migrations/0006_cash_session/migration.sql  (28 loc, sql)

## apps/server/prisma/migrations/0007_order_reservation/migration.sql  (8 loc, sql)

## apps/server/prisma/reset.ts  (38 loc, typescript)
uses: Event intake, Startup & settings

## apps/server/prisma/seed.ts  (97 loc, typescript)
uses: Money, stats & bookings, Event intake, Startup & settings, Database setup

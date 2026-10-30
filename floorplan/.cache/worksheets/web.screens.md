# Worksheet web.screens: Screens
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: The pages people work on: till, kitchen, stock, bookings, evenings, sales log, stats, end-of-night recap, help.
Write to: floorplan/descriptions/web.screens.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/web/src/App.tsx  (101 loc, typescript)
defines: App()
uses: Screens ×10, Offline storage & sync ×3, Shared building blocks ×2, Money, stats & bookings, Admin settings
used by: Screens

## apps/web/src/main.tsx  (17 loc, typescript)
uses: Screens, Offline storage & sync, Tablet app

## apps/web/src/screens/Aide.tsx  (582 loc, typescript)
defines: AideScreen()
uses: Offline storage & sync ×2, Small helpers ×2, Money, stats & bookings, Shared building blocks
used by: Screens

## apps/web/src/screens/Caisse.tsx  (567 loc, typescript)
defines: CaisseScreen()
uses: Shared building blocks ×7, Offline storage & sync ×4, Small helpers ×3, Money, stats & bookings
used by: Screens

## apps/web/src/screens/Cuisine.tsx  (370 loc, typescript)
defines: CuisineScreen()
uses: Shared building blocks ×5, Offline storage & sync ×2, Small helpers ×2, Money, stats & bookings
used by: Screens

## apps/web/src/screens/Inventaire.tsx  (251 loc, typescript)
defines: InventaireScreen()
uses: Shared building blocks ×5, Offline storage & sync ×2, Small helpers ×2, Money, stats & bookings
used by: Screens

## apps/web/src/screens/Journal.tsx  (434 loc, typescript)
defines: JournalScreen()
uses: Shared building blocks ×4, Small helpers ×3, Offline storage & sync ×2, Money, stats & bookings
used by: Screens

## apps/web/src/screens/Recap.tsx  (281 loc, typescript)
defines: RecapScreen() (Récapitulatif de fin de soirée, pour le trésorier.)
uses: Small helpers ×4, Money, stats & bookings, Offline storage & sync, Shared building blocks
used by: Screens

## apps/web/src/screens/Reservations.tsx  (1.7k loc, typescript)
defines: ReservationsScreen() (Soirées sur réservation : remplace la liste imprimée que chaque caisse surlignait.)
uses: Small helpers ×8, Shared building blocks ×6, Offline storage & sync ×4, Money, stats & bookings, Admin settings
used by: Screens

## apps/web/src/screens/RoleSelect.tsx  (264 loc, typescript)
defines: RoleSelect()
uses: Offline storage & sync ×2, Money, stats & bookings, Shared building blocks, Small helpers
used by: Screens

## apps/web/src/screens/Soirees.tsx  (724 loc, typescript)
defines: SoireesScreen()
uses: Small helpers ×4, Shared building blocks ×4, Offline storage & sync ×3, Money, stats & bookings
used by: Screens

## apps/web/src/screens/Stats.tsx  (729 loc, typescript)
defines: StatsScreen()
uses: Small helpers ×6, Offline storage & sync ×2, Shared building blocks ×2, Money, stats & bookings
used by: Screens

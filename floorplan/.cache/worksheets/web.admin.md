# Worksheet web.admin: Admin settings
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: PIN-protected settings: menu items and pictures, kitchen stations, category order, connected devices, and resetting data.
Write to: floorplan/descriptions/web.admin.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/web/src/screens/admin/AdminScreen.tsx  (271 loc, typescript)
defines: AdminScreen()
uses: Admin settings ×5, Offline storage & sync ×3, Small helpers ×3, Shared building blocks ×2, Money, stats & bookings
used by: Screens

## apps/web/src/screens/admin/CategoryOrderEditor.tsx  (85 loc, typescript)
defines: CategoryOrderEditor() (Ordre des onglets de catégories en caisse, indépendant de l'ordre des produits : on veut « Plats » en premier sans devoir remonter chaque plat au-dessus de chaque entrée.)
uses: Offline storage & sync ×2, Shared building blocks ×2, Money, stats & bookings, Small helpers
used by: Admin settings

## apps/web/src/screens/admin/PresencePanel.tsx  (97 loc, typescript)
defines: PresencePanel()
uses: Small helpers ×2, Money, stats & bookings, Offline storage & sync, Shared building blocks
used by: Admin settings

## apps/web/src/screens/admin/ProductEditor.tsx  (335 loc, typescript)
defines: ProductEditor()
uses: Shared building blocks ×4, Offline storage & sync ×2, Small helpers ×2, Money, stats & bookings, Admin settings
used by: Admin settings

## apps/web/src/screens/admin/ProductVisual.tsx  (410 loc, typescript)
defines: VisualPicker(); TicketColorField() (Couleur du ticket papier.)
uses: Small helpers ×3, Offline storage & sync ×2, Shared building blocks ×2, Admin settings
used by: Admin settings

## apps/web/src/screens/admin/ResetPanel.tsx  (227 loc, typescript)
defines: ResetPanel() (Remise à zéro. Le journal d'événements étant répliqué sur chaque appareil, le serveur change son `epoch` : tous les postes connectés purgent alors leur copie locale et se rechargent automatiquement.)
uses: Offline storage & sync ×4, Shared building blocks ×3, Admin settings, Small helpers
used by: Admin settings

## apps/web/src/screens/admin/StationEditor.tsx  (80 loc, typescript)
defines: StationEditor()
uses: Shared building blocks ×3, Offline storage & sync ×2, Money, stats & bookings
used by: Admin settings

## apps/web/src/screens/admin/TabBtn.tsx  (26 loc, typescript)
defines: TabBtn() (Onglet du bandeau admin, réutilisé par le sélecteur d'apparence produit.)
uses: Small helpers
used by: Admin settings ×2, Screens

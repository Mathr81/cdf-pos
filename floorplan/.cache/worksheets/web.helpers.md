# Worksheet web.helpers: Small helpers
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Little utilities: the shopping cart, ticket colours, icons, CSV import/export of bookings, form checks, image shrinking.
Write to: floorplan/descriptions/web.helpers.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/web/src/lib/cart.ts  (36 loc, typescript)
defines: useCart (Panier courant de la caisse (éphémère, non persisté).)
used by: Screens

## apps/web/src/lib/cn.ts  (5 loc, typescript)
defines: cn() (Concatène des classes conditionnelles.)
used by: Screens ×10, Shared building blocks ×7, Admin settings ×5

## apps/web/src/lib/download.ts  (10 loc, typescript)
doc: Déclenche le téléchargement d'un fichier généré en mémoire.
defines: download() (Déclenche le téléchargement d'un fichier généré en mémoire.)
used by: Small helpers, Offline storage & sync

## apps/web/src/lib/downscale.ts  (74 loc, typescript)
doc: Réduction d'une image avant envoi.
defines: downscaleForUpload() (Renvoie un fichier réduit, ou le fichier d'origine si la réduction n'est ni nécessaire ni possible.)
used by: Offline storage & sync

## apps/web/src/lib/export.ts  (124 loc, typescript)
defines: exportReservationsCsv() (Bilan de fin de soirée sur réservation : une ligne par réservation (venue ou non) et par sur-place, avec ce qui a réellement été encaissé.); exportOrdersCsv() (Exporte le détail des ventes (une ligne par article de commande) en CSV.)
uses: Money, stats & bookings, Small helpers
used by: Screens ×2

## apps/web/src/lib/hooks.ts  (15 loc, typescript)
defines: useRev() (S'abonne aux changements de la projection.); useActiveSoiree() (Soirée active courante (réactive).)
uses: Money, stats & bookings, Offline storage & sync
used by: Screens ×9, Shared building blocks ×2, Admin settings

## apps/web/src/lib/palette.ts  (30 loc, typescript)
doc: Palette pour Recharts.
defines: PALETTE (Palette pour Recharts.)
used by: Small helpers, Screens

## apps/web/src/lib/payLook.ts  (21 loc, typescript)
defines: hatch() (Rayures : la texture distingue là où la teinte ne suffit pas.); payLook
uses: Small helpers
used by: Screens ×2

## apps/web/src/lib/plural.ts  (4 loc, typescript)
doc: « 1 commande », « 2 commandes » ; en français 0 et 1 sont au singulier.
defines: plural() (« 1 commande », « 2 commandes » ; en français 0 et 1 sont au singulier.)
used by: Screens ×4, Admin settings ×3, Shared building blocks

## apps/web/src/lib/productIcons.ts  (158 loc, typescript)
doc: Registre d'icônes produit.
defines: PRODUCT_ICONS (slug → composant. Le slug est la valeur écrite dans `product.emoji`.); ICON_GROUPS (Groupes proposés dans le sélecteur d'icône (Admin → Produits).); isIconSlug()
used by: Shared building blocks, Admin settings

## apps/web/src/lib/reservationCsv.ts  (157 loc, typescript)
defines: ParsedReservation; CsvResult; parseReservationCsv(); decodeCsv() (Excel FR enregistre « CSV (séparateur : point-virgule) » en Windows-1252, pas en UTF-8 : lu en UTF-8, « Lefèvre » devient « Lef�vre ».)
uses: Money, stats & bookings
used by: Tests, Screens

## apps/web/src/lib/ticket.ts  (49 loc, typescript)
doc: Couleur du ticket papier.
defines: luminance() (Luminance relative WCAG (0 = noir, 1 = blanc).); inkOn() (Encre à poser sur un aplat de couleur ticket.); ticketColor() (Couleur ticket exploitable, avec repli sur le défaut du schéma.)
used by: Shared building blocks, Admin settings

## apps/web/src/lib/urlState.ts  (25 loc, typescript)
defines: useUrlState() (Un état d'écran (onglet, filtre) rangé dans l'URL : il survit à un rechargement de la tablette et un lien partagé rouvre le même écran.)
used by: Screens ×3, Admin settings

## apps/web/src/lib/validate.ts  (8 loc, typescript)
doc: Saisies libres des écrans d'admin.
defines: isAmount (Saisies libres des écrans d'admin.); isCount (Quantité entière positive (stock).)
used by: Screens ×2, Tests, Admin settings

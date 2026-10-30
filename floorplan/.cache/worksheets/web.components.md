# Worksheet web.components: Shared building blocks
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Pieces reused across screens: buttons, pop-ups, the payment window, number pad, page frame and alerts.
Write to: floorplan/descriptions/web.components.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/web/src/components/ConfirmModal.tsx  (52 loc, typescript)
defines: ConfirmModal() (Remplace les `window.confirm()` natifs : en PWA plein écran sur iPad, le dialogue système est minuscule, hors charte, et ses boutons sont bien en dessous de la cible tactile de 44px.)
uses: Shared building blocks ×2
used by: Screens ×4, Admin settings ×3

## apps/web/src/components/ConflictModal.tsx  (80 loc, typescript)
defines: ConflictModal() (Une réservation encaissée ici l'avait déjà été par une autre caisse (les deux hors ligne, ou presque en même temps).)
uses: Offline storage & sync ×2, Shared building blocks ×2, Money, stats & bookings, Small helpers
used by: Shared building blocks

## apps/web/src/components/DepletionHint.tsx  (47 loc, typescript)
defines: DepletionHint()
uses: Money, stats & bookings, Offline storage & sync, Small helpers
used by: Screens ×2

## apps/web/src/components/Layout.tsx  (341 loc, typescript)
defines: Layout()
uses: Offline storage & sync ×5, Shared building blocks ×3, Small helpers ×2, Money, stats & bookings
used by: Screens

## apps/web/src/components/Modal.tsx  (110 loc, typescript)
defines: Modal()
uses: Small helpers
used by: Screens ×6, Shared building blocks ×4, Admin settings ×4

## apps/web/src/components/NoSoiree.tsx  (29 loc, typescript)
defines: NoSoiree() (Écran affiché quand aucune soirée n'est active (bloque caisse/cuisine/stock).)
uses: Offline storage & sync, Shared building blocks
used by: Screens ×4

## apps/web/src/components/Numpad.tsx  (90 loc, typescript)
defines: applyKey() (Applique une touche à la saisie (ex "12,50") et renvoie la nouvelle valeur.); Numpad() (Pavé numérique tactile.)
uses: Shared building blocks
used by: Tests, Shared building blocks

## apps/web/src/components/PaymentModal.tsx  (207 loc, typescript)
defines: PaymentModal() (Monté uniquement pendant l'encaissement (voir Caisse.tsx) : c'est le démontage qui remet l'écran de choix Espèces / Carte.)
uses: Shared building blocks ×3, Money, stats & bookings, Small helpers
used by: Screens ×2

## apps/web/src/components/PendingSalesGuard.tsx  (96 loc, typescript)
defines: PendingSalesGuard() (Dernier rempart avant la destruction de ventes qui n'existent nulle part ailleurs.)
uses: Offline storage & sync ×3, Shared building blocks ×2, Small helpers
used by: Shared building blocks

## apps/web/src/components/ProductIcon.tsx  (124 loc, typescript)
defines: ProductIcon() (Résout `product.emoji` : - slug connu du registre Phosphor → icône vectorielle - toute autre chaîne → rendue littéralement C'est ce repli qui rend la bascule sans migration : les produits déjà saisis avec un emoji…); DEFAULT_IMAGE_ZOOM (Part du cadre occupée par le dessin quand aucun zoom n'est enregistré.); ZOOM_MIN (Bornes du réglage de taille.); ZOOM_MAX; TicketBlock()
uses: Small helpers ×3, Offline storage & sync
used by: Screens ×5, Admin settings ×3

## apps/web/src/components/Toast.tsx  (72 loc, typescript)
defines: ToastData; useToast() (Un toast à la fois, et UN minuteur : le précédent est annulé à chaque nouveau message.); Toast()
uses: Small helpers
used by: Screens ×3

## apps/web/src/components/ui.tsx  (275 loc, typescript)
defines: Button(); StepButton() (Bouton carré pour les steppers (+ / −).); Card() (Trois élévations documentées, au lieu des cinq définitions concurrentes de « carte » qui coexistaient dans l'app.); Row() (Filet de séparation. Remplace les cartes empilées dans les listes.); Badge(); FieldLabel() (Petite étiquette de section.); Field(); FieldGroup() (Groupe de boutons (segments, tuiles de choix) sous un libellé.); TextInput() (Champ de saisie : hauteur tactile, contraste vérifié, focus lantern.); SelectInput(); StockChip() (État de stock. L'escalade se fait par la FORME autant que par la teinte, jamais par la couleur seule : glyphe, puis contour, puis aplat plein.); EmptyState() (État vide composé. Remplace les `<p>` gris centrés de l'app.); … +1
uses: Small helpers
used by: Screens ×11, Admin settings ×7, Shared building blocks ×6

## apps/web/src/components/UpdateBanner.tsx  (59 loc, typescript)
defines: UpdateBanner() (Nouvelle version disponible.)
uses: Offline storage & sync
used by: Shared building blocks

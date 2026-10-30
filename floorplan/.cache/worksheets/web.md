# Worksheet web: Appli tablette
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: L'appli des bénévoles sur tablette, téléphone ou ordinateur : caisse, cuisine, stock, réservations et écrans admin. S'installe comme une appli et marche hors ligne.
Write to: floorplan/descriptions/web.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/web/src/screens/reservations/CheckinModal.tsx  (212 loc, typescript)
defines: CheckinModal() (Arrivée d'une réservation (`row`) ou d'un sur-place (`row === null`).)
uses: Stockage local & synchro ×4, Briques d'interface ×4, Appli tablette ×2, Argent, stats & réservations
used by: Appli tablette

## apps/web/src/screens/reservations/CheckinTab.tsx  (252 loc, typescript)
defines: CheckinTab()
uses: Appli tablette ×5, Petits utilitaires ×3, Stockage local & synchro ×2, Briques d'interface ×2, Argent, stats & réservations
used by: Appli tablette

## apps/web/src/screens/reservations/DashboardTab.tsx  (113 loc, typescript)
defines: DashboardTab()
uses: Petits utilitaires ×3, Argent, stats & réservations, Stockage local & synchro, Briques d'interface
used by: Appli tablette

## apps/web/src/screens/reservations/DoorSide.tsx  (176 loc, typescript)
defines: DoorSide() (Colonne de droite de l'accueil, sur iPad en paysage seulement : le bilan de la porte, les remarques des groupes pas encore arrivés, les arrivées par tarif et l'argent reçu par moyen de paiement.)
uses: Petits utilitaires ×2, Appli tablette ×2, Argent, stats & réservations, Stockage local & synchro, Briques d'interface
used by: Appli tablette

## apps/web/src/screens/reservations/EditModal.tsx  (112 loc, typescript)
defines: EditModal()
uses: Briques d'interface ×3, Stockage local & synchro ×2, Argent, stats & réservations, Appli tablette
used by: Appli tablette

## apps/web/src/screens/reservations/ImportModal.tsx  (117 loc, typescript)
defines: ImportModal()
uses: Stockage local & synchro ×2, Petits utilitaires ×2, Briques d'interface ×2, Appli tablette ×2, Argent, stats & réservations
used by: Appli tablette

## apps/web/src/screens/reservations/ManageTab.tsx  (159 loc, typescript)
defines: ManageTab()
uses: Appli tablette ×5, Petits utilitaires ×4, Briques d'interface ×3, Stockage local & synchro ×2, Argent, stats & réservations
used by: Appli tablette

## apps/web/src/screens/reservations/PaidModal.tsx  (235 loc, typescript)
defines: PaidModal()
uses: Stockage local & synchro ×4, Briques d'interface ×4, Appli tablette ×2, Argent, stats & réservations, Petits utilitaires
used by: Appli tablette

## apps/web/src/screens/reservations/parts.tsx  (85 loc, typescript)
defines: TableTag() (« Table 12 » : là où l'accueil place le groupe.); NoteBox(); Counters()
uses: Argent, stats & réservations, Petits utilitaires, Briques d'interface
used by: Appli tablette ×7

## apps/web/src/screens/reservations/PrintList.tsx  (82 loc, typescript)
defines: PrintList() (Feuille de secours pour le jour où le wifi ou les tablettes lâchent : même usage que l'ancien Excel, mais à jour à la minute.)
uses: Petits utilitaires ×3, Argent, stats & réservations, Stockage local & synchro
used by: Appli tablette

## apps/web/src/screens/reservations/ReservationsScreen.tsx  (79 loc, typescript)
defines: ReservationsScreen() (Soirées sur réservation : remplace la liste imprimée que chaque caisse surlignait.)
uses: Appli tablette ×4, Petits utilitaires ×3, Briques d'interface ×3, Stockage local & synchro ×2, Argent, stats & réservations
used by: Écrans

## apps/web/src/screens/reservations/rows.ts  (39 loc, typescript)
defines: countsLabel() (« 2 adultes · 1 enfant » ; les tarifs à zéro sont omis.); hhmm(); onSiteCents() (Argent reçu à la porte pour cette arrivée (hors payé d'avance).); stillExpected() (Personnes encore attendues : toute la réservation tant que personne n'est venu, puis ce qui manque d'un groupe qui arrive en plusieurs fois.); awaited() (À venir : pas encore arrivé, ou groupe arrivé en partie.); extras() (Personnes au-delà de ce qui a été réglé d'avance, par tarif.)
uses: Argent, stats & réservations, Petits utilitaires
used by: Appli tablette ×6

## apps/web/src/screens/reservations/TariffsEditor.tsx  (138 loc, typescript)
defines: TariffsEditor()
uses: Stockage local & synchro ×2, Briques d'interface ×2, Argent, stats & réservations, Petits utilitaires
used by: Appli tablette
